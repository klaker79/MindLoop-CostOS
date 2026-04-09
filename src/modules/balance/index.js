/**
 * Balance Module - P&L y Simulador Financiero
 * Migrado desde: src/legacy/app-core.js
 * Fecha: 2026-01-30
 */

import { showToast } from '../../ui/toast.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { t } from '@/i18n/index.js';

// === BALANCE / P&L UNIFICADO ===
export async function renderizarBalance() {
    try {
        // 1. Cargar gastos fijos desde la BD (fuente de verdad)
        try {
            const gastosFijos = await window.API.getGastosFijos();
            if (gastosFijos && gastosFijos.length > 0) {
                gastosFijos.forEach(gasto => {
                    const concepto = gasto.concepto.toLowerCase();
                    const monto = parseFloat(gasto.monto_mensual) || 0;
                    if (concepto.includes('alquiler')) {
                        const el = document.getElementById('pl-input-alquiler');
                        if (el) el.value = monto;
                    } else if (concepto.includes('nómina') || concepto.includes('nomina') || concepto.includes('personal')) {
                        const el = document.getElementById('pl-input-personal');
                        if (el) el.value = monto;
                    } else if (concepto.includes('agua') || concepto.includes('suministro')) {
                        const el = document.getElementById('pl-input-suministros');
                        if (el) el.value = monto;
                    } else if (concepto.includes('luz') || concepto.includes('otros')) {
                        const el = document.getElementById('pl-input-otros');
                        if (el) el.value = monto;
                    }
                });
                // Actualizar sliders y KPI de gastos fijos
                if (typeof window.cargarValoresGastosFijos === 'function') {
                    window.cargarValoresGastosFijos();
                }
            }
        } catch (error) {
            console.warn('Using localStorage for gastos fijos:', error.message);
            let savedOpex = {};
            try {
                savedOpex = JSON.parse(localStorage.getItem('opex_inputs') || '{}');
            } catch (parseError) {
                console.warn('opex_inputs corrupto:', parseError.message);
            }
            const alquilerEl = document.getElementById('pl-input-alquiler');
            const personalEl = document.getElementById('pl-input-personal');
            const suministrosEl = document.getElementById('pl-input-suministros');
            const otrosEl = document.getElementById('pl-input-otros');
            if (alquilerEl && savedOpex.alquiler) alquilerEl.value = savedOpex.alquiler;
            if (personalEl && savedOpex.personal) personalEl.value = savedOpex.personal;
            if (suministrosEl && savedOpex.suministros) suministrosEl.value = savedOpex.suministros;
            if (otrosEl && savedOpex.otros) otrosEl.value = savedOpex.otros;
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
        setEl('pl-ingresos', ingresos.toFixed(2) + ' €');
        setEl('pl-cogs', cogs.toFixed(2) + ' €');
        const cogsPct = ingresos > 0 ? (cogs / ingresos) * 100 : 0;
        setEl('pl-cogs-pct', cogsPct.toFixed(1) + t('balance:pct_over_sales'));
        const margenBruto = ingresos - cogs;
        setEl('pl-margen-bruto', margenBruto.toFixed(2) + ' €');
        const margenPct = ingresos > 0 ? (margenBruto / ingresos) * 100 : 0;
        setEl('pl-kpi-margen', margenPct.toFixed(1) + '%');
        const diaDelMes = ahora.getDate();
        const ventasDiarias = ingresos / diaDelMes;
        setEl('pl-kpi-ventas-diarias', ventasDiarias.toFixed(2) + ' €');

        calcularPL();
    } catch (error) {
        console.error('Error renderizando P&L:', error);
        showToast(t('balance:error_loading'), 'error');
    }
}

export function calcularPL() {
    const ingresosEl = document.getElementById('pl-ingresos');
    const cogsEl = document.getElementById('pl-cogs');
    const alquilerEl = document.getElementById('pl-input-alquiler');
    const personalEl = document.getElementById('pl-input-personal');
    const suministrosEl = document.getElementById('pl-input-suministros');
    const otrosEl = document.getElementById('pl-input-otros');

    if (!ingresosEl || !cogsEl || !alquilerEl || !personalEl || !suministrosEl || !otrosEl) {
        console.warn(t('balance:inputs_not_loaded'));
        return;
    }

    const ingresos = parseFloat(ingresosEl.textContent.replace(' €', '').replace(',', '.')) || 0;
    const cogs = parseFloat(cogsEl.textContent.replace(' €', '').replace(',', '.')) || 0;
    const margenBruto = ingresos - cogs;

    const alquiler = parseFloat(alquilerEl.value) || 0;
    const personal = parseFloat(personalEl.value) || 0;
    const suministros = parseFloat(suministrosEl.value) || 0;
    const otros = parseFloat(otrosEl.value) || 0;

    localStorage.setItem('opex_inputs', JSON.stringify({ alquiler, personal, suministros, otros }));

    const opexTotal = alquiler + personal + suministros + otros;
    const opexTotalEl = document.getElementById('pl-opex-total');
    if (opexTotalEl) opexTotalEl.textContent = opexTotal.toFixed(2) + ' €';

    const beneficioNeto = margenBruto - opexTotal;
    const netoEl = document.getElementById('pl-neto');
    if (netoEl) {
        netoEl.textContent = beneficioNeto.toFixed(2) + ' €';
        netoEl.style.color = beneficioNeto >= 0 ? '#10b981' : '#ef4444';
    }

    const rentabilidad = ingresos > 0 ? (beneficioNeto / ingresos) * 100 : 0;
    const netoPctEl = document.getElementById('pl-neto-pct');
    if (netoPctEl) netoPctEl.textContent = rentabilidad.toFixed(1) + t('balance:pct_profitability');

    let margenContribucionPct = ingresos > 0 ? margenBruto / ingresos : 0.7;
    if (margenContribucionPct <= 0) margenContribucionPct = 0.1;

    const breakEven = opexTotal / margenContribucionPct;
    const breakEvenEl = document.getElementById('pl-breakeven');
    if (breakEvenEl) breakEvenEl.textContent = breakEven.toFixed(2) + ' €';

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
