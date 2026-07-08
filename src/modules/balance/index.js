/**
 * Balance Module - P&L y Simulador Financiero
 * Migrado desde: src/legacy/app-core.js
 * Fecha: 2026-01-30
 */

import { showToast } from '../../ui/toast.js';
import { calcularCosteRecetaCompleto } from '../recetas/recetas-crud.js';
import { t } from '@/i18n/index.js';
import { cm } from '../../utils/helpers.js';
import { renderPersonalExtra } from './personal-extra.js';
import { apiClient } from '../../api/client.js';
import { sumaGastosOperativos } from '../analisis/breakeven-calc.js';
import { getBreakevenSnapshot } from '../analisis/breakeven.js';

/** Devuelve {desde, hasta} del mes actual en YYYY-MM-DD (mismo rango que el P&L). */
function rangoMesActual() {
    const ahora = new Date();
    const ymd = (d) => {
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    };
    const desde = ymd(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
    const hasta = ymd(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0));
    return { desde, hasta };
}

// === BALANCE / P&L UNIFICADO ===
export async function renderizarBalance() {
    try {
        // 1. Render dynamic fixed-expenses widget (each restaurant has its own categories)
        if (typeof window.renderizarGastosFijosDinamicos === 'function') {
            await window.renderizarGastosFijosDinamicos();
        }

        // 1b. Personal extra (por horas) — justo debajo de los gastos fijos,
        // con el MISMO rango (mes actual) que usa el P&L.
        const contenedorExtra = document.getElementById('personal-extra-list');
        if (contenedorExtra) {
            await renderPersonalExtra(contenedorExtra, rangoMesActual());
        }

        // 2. Obtener datos reales del MES EN CURSO desde la fuente CANÓNICA:
        // /analytics/pnl-breakdown (ventas_diarias_resumen, coste CONGELADO el
        // día de la venta) — la MISMA que las tarjetas del Diario/Dashboard,
        // Omnes y el equilibrio. Antes esta pestaña recalculaba el COGS con los
        // precios ACTUALES de los ingredientes (calcularCosteRecetaCompleto ×
        // ventas), así que en cuanto un precio cambiaba a mitad de mes su margen
        // divergía del resto de la app (auditoría 2026-07-08).
        const ahora = new Date();
        const ymdLocal = (d) => {
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${d.getFullYear()}-${m}-${day}`;
        };
        const desdeMes = ymdLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
        const hastaMesExcl = ymdLocal(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1));

        // Ventas individuales del mes: para contar los DÍAS CON VENTAS (los
        // gastos fijos se devengan solo en días trabajados — criterio del
        // P&L del Diario, Iker 2026-07-08) y como fallback de ingresos/COGS.
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
        const ventas = await window.api.getSales(inicioMes);
        const inicioMesMs = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
        const ventasMes = ventas.filter(v => new Date(v.fecha).getTime() >= inicioMesMs);
        const diasConVentas = new Set(ventasMes.map(v => String(v.fecha).substring(0, 10))).size;
        const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();

        let ingresos, cogs;
        try {
            const pnl = await apiClient.get(`/analytics/pnl-breakdown?desde=${desdeMes}&hasta=${hastaMesExcl}`);
            ingresos = parseFloat(pnl?.total?.ingresos) || 0;
            cogs = parseFloat(pnl?.total?.cogs) || 0;
        } catch (e) {
            // Fallback si el endpoint falla: cálculo local (menos preciso: usa
            // precios actuales, no el coste congelado). Mantiene la pestaña viva.
            console.warn('[balance] pnl-breakdown falló, fallback local:', e?.message);
            ingresos = ventasMes.reduce((sum, v) => sum + parseFloat(v.total), 0);
            const recetasMap = new Map((window.recetas || []).map(r => [r.id, r]));
            cogs = 0;
            ventasMes.forEach(venta => {
                const receta = recetasMap.get(venta.receta_id);
                if (receta && receta.ingredientes) {
                    const costePorPorcion = calcularCosteRecetaCompleto(receta);
                    const factorVariante = parseFloat(venta.factor_variante) || 1;
                    cogs += costePorPorcion * venta.cantidad * factorVariante;
                }
            });
        }

        // 3. Actualizar UI
        // 🔒 FIX F2: Helper para acceso seguro a DOM (evita crash si el HTML no está listo)
        const setEl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setEl('pl-ingresos', cm(ingresos));
        setEl('pl-cogs', cm(cogs));
        const cogsPct = ingresos > 0 ? (cogs / ingresos) * 100 : 0;
        setEl('pl-cogs-pct', cogsPct.toFixed(1) + t('balance:pct_over_sales'));
        const margenBruto = ingresos - cogs;
        setEl('pl-margen-bruto', cm(margenBruto));
        const margenPct = ingresos > 0 ? (margenBruto / ingresos) * 100 : 0;
        setEl('pl-kpi-margen', margenPct.toFixed(1) + '%');
        const diaDelMes = ahora.getDate();
        const ventasDiarias = ingresos / diaDelMes;
        setEl('pl-kpi-ventas-diarias', cm(ventasDiarias));

        await calcularPL({ ingresos, cogs, diasConVentas, diasMes });
    } catch (error) {
        console.error('Error renderizando P&L:', error);
        showToast(t('balance:error_loading'), 'error');
    }
}

/**
 * Calcula breakeven, beneficio neto y termómetro a partir de ingresos+cogs ya
 * calculados por `renderizarBalance`.
 *
 * 🔒 Auditoría Capa 7 (A5-C5): antes leía los valores re-parseando el texto
 * formateado por `cm()` desde el DOM, lo cual rompía con separadores de miles
 * y/o cuando el tenant usaba RM (Stefania KL). Ahora se aceptan ingresos/cogs
 * como argumentos. Mantenemos un fallback que lee del DOM (sin parsear formato)
 * para retrocompatibilidad cuando se llama externamente sin args.
 *
 * @param {{ingresos?: number, cogs?: number}} [opts]
 */
export async function calcularPL(opts = {}) {
    const ingresosEl = document.getElementById('pl-ingresos');
    const cogsEl = document.getElementById('pl-cogs');

    if (!ingresosEl || !cogsEl) {
        console.warn(t('balance:inputs_not_loaded'));
        return;
    }

    // Preferir los valores numéricos pasados por renderizarBalance.
    // Fallback: parsear el texto del DOM (legado, frágil con separadores de miles).
    const parseFromDom = (el) =>
        parseFloat(el.textContent.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    const ingresos = Number.isFinite(opts.ingresos) ? opts.ingresos : parseFromDom(ingresosEl);
    const cogs = Number.isFinite(opts.cogs) ? opts.cogs : parseFromDom(cogsEl);
    const margenBruto = ingresos - cogs;

    // Gastos fijos OPERATIVOS (de explotación): excluye SOLO IVA/IGIC/IRPF/
    // Sociedades y mantiene IAE/IBI/tasas — la MISMA regla que el P&L del
    // Diario, el equilibrio y Omnes (antes esta pestaña restaba la suma CRUDA
    // con impuestos y su beneficio descuadraba 5.238,77€ con el resto).
    let opexMesOperativo = 0;
    try {
        const gastos = await window.api.getGastosFijos();
        opexMesOperativo = sumaGastosOperativos(Array.isArray(gastos) ? gastos : []);
    } catch (e) {
        console.warn('[balance] gastos fijos no disponibles:', e?.message);
    }

    // Devengo por DÍAS CON VENTAS (criterio Iker 2026-07-08, el mismo que la
    // Cuenta de Resultados y Omnes): cada día trabajado carga su gasto fijo
    // diario; los días cerrados no. Sin dato de días (llamada externa sin
    // args), cae al mes completo (comportamiento antiguo).
    const diasMes = Number.isFinite(opts.diasMes) && opts.diasMes > 0
        ? opts.diasMes
        : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const opexDevengado = Number.isFinite(opts.diasConVentas)
        ? Math.round((opexMesOperativo * Math.min(opts.diasConVentas, diasMes) / diasMes) * 100) / 100
        : opexMesOperativo;
    const opexTotalEl = document.getElementById('pl-opex-total');
    if (opexTotalEl) {
        opexTotalEl.textContent = cm(opexDevengado);
        opexTotalEl.title = `Gastos operativos devengados en los días con ventas del mes. Referencia mes completo: ${cm(opexMesOperativo)}`;
    }

    const beneficioNeto = margenBruto - opexDevengado;
    const netoEl = document.getElementById('pl-neto');
    if (netoEl) {
        netoEl.textContent = cm(beneficioNeto);
        netoEl.style.color = beneficioNeto >= 0 ? '#10b981' : '#ef4444';
    }

    const rentabilidad = ingresos > 0 ? (beneficioNeto / ingresos) * 100 : 0;
    const netoPctEl = document.getElementById('pl-neto-pct');
    if (netoPctEl) netoPctEl.textContent = rentabilidad.toFixed(1) + t('balance:pct_profitability');

    // Punto de equilibrio CANÓNICO: el mismo snapshot (margen ponderado por
    // ventas reales, ventana 90 días, gastos operativos) que el bloque de
    // Análisis y el mini del Diario → el € de equilibrio mensual es EL MISMO
    // número en las tres pantallas. Fallback: fórmula local si el módulo falla.
    let breakEven;
    try {
        const snap = await getBreakevenSnapshot();
        if (snap && snap.estado === 'ok' && snap.ventasEquilibrioMes > 0) {
            breakEven = snap.ventasEquilibrioMes;
        }
    } catch (e) {
        console.warn('[balance] snapshot de equilibrio no disponible:', e?.message);
    }
    if (!Number.isFinite(breakEven)) {
        let margenContribucionPct = ingresos > 0 ? margenBruto / ingresos : 0.7;
        if (margenContribucionPct <= 0) margenContribucionPct = 0.1;
        breakEven = opexMesOperativo / margenContribucionPct;
    }
    const breakEvenEl = document.getElementById('pl-breakeven');
    if (breakEvenEl) breakEvenEl.textContent = cm(breakEven);

    const estadoBadge = document.getElementById('pl-badge-estado');
    const termometroFill = document.getElementById('pl-termometro-fill');
    const mensajeAnalisis = document.getElementById('pl-mensaje-analisis');

    const porcentajeCumplimiento = breakEven > 0 ? (ingresos / breakEven) * 100 : (opexMesOperativo === 0 ? 100 : 0);
    const alturaTermometro = Math.min(porcentajeCumplimiento / 2, 100);
    if (termometroFill) termometroFill.style.height = `${alturaTermometro}%`;

    if (ingresos < breakEven) {
        if (estadoBadge) {
            estadoBadge.textContent = t('balance:status_loss');
            estadoBadge.style.background = '#fee2e2';
            estadoBadge.style.color = '#991b1b';
        }
        const falta = breakEven - ingresos;
        if (mensajeAnalisis) mensajeAnalisis.innerHTML = t('balance:analysis_loss', { amount: falta.toFixed(0), pct: porcentajeCumplimiento.toFixed(0) });
    } else {
        if (estadoBadge) {
            estadoBadge.textContent = t('balance:status_profit');
            estadoBadge.style.background = '#d1fae5';
            estadoBadge.style.color = '#065f46';
        }
        const sobra = ingresos - breakEven;
        if (mensajeAnalisis) mensajeAnalisis.innerHTML = t('balance:analysis_profit', { amount: beneficioNeto.toFixed(0), surplus: sobra.toFixed(0) });
    }
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.renderizarBalance = renderizarBalance;
    window.calcularPL = calcularPL;
}
