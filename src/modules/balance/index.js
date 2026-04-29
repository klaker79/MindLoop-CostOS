/**
 * Balance Module - P&L y Simulador Financiero
 * Migrado desde: src/legacy/app-core.js
 * Fecha: 2026-01-30
 */

import { showToast } from '../../ui/toast.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { t } from '@/i18n/index.js';
import { cm } from '../../utils/helpers.js';

// === BALANCE / P&L UNIFICADO ===
export async function renderizarBalance() {
    try {
        // 1. Render dynamic fixed-expenses widget (each restaurant has its own categories)
        if (typeof window.renderizarGastosFijosDinamicos === 'function') {
            await window.renderizarGastosFijosDinamicos();
        }

        // 2. Obtener Datos Reales
        // fix M7: pasar la fecha al servidor para evitar cargar todo el historial de ventas
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
        const ventas = await window.api.getSales(inicioMes);
        // fix M8: comparar con timestamps para tolerar distintos formatos de fecha del backend
        const inicioMesMs = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
        const ventasMes = ventas.filter(v => new Date(v.fecha).getTime() >= inicioMesMs);
        const ingresos = ventasMes.reduce((sum, v) => sum + parseFloat(v.total), 0);

        // Calcular COGS
        const recetasMap = new Map((window.recetas || []).map(r => [r.id, r]));
        const ingredientesMap = new Map((window.ingredientes || []).map(i => [i.id, i]));
        const inventarioMap = new Map((window.inventarioCompleto || []).map(i => [i.id, i]));

        let cogs = 0;
        ventasMes.forEach(venta => {
            const receta = recetasMap.get(venta.receta_id);
            if (receta && receta.ingredientes) {
                const porciones = Math.max(1, parseInt(receta.porciones) || 1);
                const costeReceta = receta.ingredientes.reduce((sum, item) => {
                    const ing = ingredientesMap.get(item.ingredienteId);
                    if (!ing) return sum;
                    // 💰 Precio unitario: función centralizada (precio_medio_compra > precio_medio > precio/cpf)
                    const invItem = inventarioMap.get(item.ingredienteId);
                    const precioUnitario = getIngredientUnitPrice(invItem, ing);
                    // Rendimiento: priorizar el de la receta, fallback al ingrediente base
                    let rendimientoVal = parseFloat(item.rendimiento);
                    if (!rendimientoVal || rendimientoVal === 100) {
                        if (ing?.rendimiento) {
                            rendimientoVal = parseFloat(ing.rendimiento);
                        } else {
                            rendimientoVal = 100;
                        }
                    }
                    const rendimiento = rendimientoVal / 100;
                    const factorRendimiento = rendimiento > 0 ? (1 / rendimiento) : 1;
                    return sum + (precioUnitario * item.cantidad * factorRendimiento);
                }, 0);
                cogs += (costeReceta / porciones) * venta.cantidad;
            }
        });

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

        await calcularPL({ ingresos, cogs });
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

    // Use the generic sum from DB so all categories (27+ dynamic) count.
    // calcularTotalGastosFijos is exposed by legacy/modales.js and reads gastos_fijos via API.
    const opexTotal = typeof window.calcularTotalGastosFijos === 'function'
        ? (await window.calcularTotalGastosFijos()) || 0
        : 0;
    const opexTotalEl = document.getElementById('pl-opex-total');
    if (opexTotalEl) opexTotalEl.textContent = cm(opexTotal);

    const beneficioNeto = margenBruto - opexTotal;
    const netoEl = document.getElementById('pl-neto');
    if (netoEl) {
        netoEl.textContent = cm(beneficioNeto);
        netoEl.style.color = beneficioNeto >= 0 ? '#10b981' : '#ef4444';
    }

    const rentabilidad = ingresos > 0 ? (beneficioNeto / ingresos) * 100 : 0;
    const netoPctEl = document.getElementById('pl-neto-pct');
    if (netoPctEl) netoPctEl.textContent = rentabilidad.toFixed(1) + t('balance:pct_profitability');

    let margenContribucionPct = ingresos > 0 ? margenBruto / ingresos : 0.7;
    if (margenContribucionPct <= 0) margenContribucionPct = 0.1;

    const breakEven = opexTotal / margenContribucionPct;
    const breakEvenEl = document.getElementById('pl-breakeven');
    if (breakEvenEl) breakEvenEl.textContent = cm(breakEven);

    const estadoBadge = document.getElementById('pl-badge-estado');
    const termometroFill = document.getElementById('pl-termometro-fill');
    const mensajeAnalisis = document.getElementById('pl-mensaje-analisis');

    let porcentajeCumplimiento = breakEven > 0 ? (ingresos / breakEven) * 100 : (opexTotal === 0 ? 100 : 0);
    let alturaTermometro = Math.min(porcentajeCumplimiento / 2, 100);
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
