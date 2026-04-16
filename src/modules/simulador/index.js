/**
 * Simulador Financiero Module
 * Migrado desde: src/legacy/app-core.js línea 457
 * Fecha: 2026-01-30
 */

import { t } from '@/i18n/index.js';
import { cm } from '../../utils/helpers.js';

export function actualizarSimulador() {
    const alquiler = parseInt(document.getElementById('input-alquiler')?.value) || 0;
    const personal = parseInt(document.getElementById('input-personal')?.value) || 0;
    const suministros = parseInt(document.getElementById('input-suministros')?.value) || 0;

    // Actualizar etiquetas
    const labelAlquiler = document.getElementById('label-alquiler');
    const labelPersonal = document.getElementById('label-personal');
    const labelSuministros = document.getElementById('label-suministros');

    if (labelAlquiler) labelAlquiler.textContent = cm(alquiler);
    if (labelPersonal) labelPersonal.textContent = cm(personal);
    if (labelSuministros) labelSuministros.textContent = cm(suministros);

    // Obtener Margen Bruto
    const margenBrutoElem = document.getElementById('balance-ganancia');
    let margenBruto = 0;
    if (margenBrutoElem) {
        const cleanText = margenBrutoElem.textContent.replace('€', '').trim();
        margenBruto = parseFloat(cleanText) || 0;
    }

    const costosFijos = alquiler + personal + suministros;
    const neto = margenBruto - costosFijos;

    // Actualizar UI Simulador
    const simMargenBruto = document.getElementById('sim-margen-bruto');
    const simCostosFijos = document.getElementById('sim-costos-fijos');
    const netoElem = document.getElementById('sim-resultado-neto');
    const progressBar = document.getElementById('sim-progreso-fill');
    const analytics = document.getElementById('sim-analytics');

    if (simMargenBruto) simMargenBruto.textContent = cm(margenBruto);
    if (simCostosFijos) simCostosFijos.textContent = cm(costosFijos);

    let porcentajeCubierto = costosFijos > 0 ? (margenBruto / costosFijos) * 100 : 100;
    const widthPct = Math.min(Math.max(porcentajeCubierto, 0), 100);

    if (netoElem) {
        netoElem.textContent = cm(neto);
        netoElem.style.color = neto >= 0 ? '#10b981' : '#ef4444';
    }

    if (progressBar) {
        progressBar.style.width = widthPct + '%';
        progressBar.style.background = neto >= 0
            ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
            : 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
    }

    if (analytics) {
        if (neto >= 0) {
            analytics.innerHTML = '<span>🚀</span> ' + t('simulador:profit_message', { pct: porcentajeCubierto.toFixed(0) });
            analytics.style.color = '#059669';
        } else {
            analytics.innerHTML = '<span>🚑</span> ' + t('simulador:loss_message', { pct: porcentajeCubierto.toFixed(0) });
            analytics.style.color = '#dc2626';
        }
    }

    // Break-Even
    const ingresosElem = document.getElementById('balance-ingresos');
    let ingresos = 0;
    if (ingresosElem) {
        ingresos = parseFloat(ingresosElem.textContent.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    }

    let breakEven = 0;
    if (ingresos > 0) {
        const margenPorcentaje = margenBruto / ingresos;
        if (margenPorcentaje > 0) breakEven = costosFijos / margenPorcentaje;
    }

    const breakEvenDisplay = document.getElementById('break-even-display');
    if (breakEvenDisplay) breakEvenDisplay.textContent = cm(breakEven);

    // Actualizar Card de Beneficio Neto superior
    const balanceNeto = document.getElementById('balance-neto');
    if (balanceNeto) balanceNeto.textContent = cm(neto);
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.actualizarSimulador = actualizarSimulador;
}
