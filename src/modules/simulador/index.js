/**
 * Simulador Financiero Module
 * Migrado desde: src/legacy/app-core.js línea 457
 * Fecha: 2026-01-30
 */

export function actualizarSimulador() {
    const alquiler = parseInt(document.getElementById('input-alquiler')?.value) || 0;
    const personal = parseInt(document.getElementById('input-personal')?.value) || 0;
    const suministros = parseInt(document.getElementById('input-suministros')?.value) || 0;

    // Actualizar etiquetas
    const labelAlquiler = document.getElementById('label-alquiler');
    const labelPersonal = document.getElementById('label-personal');
    const labelSuministros = document.getElementById('label-suministros');

    if (labelAlquiler) labelAlquiler.textContent = alquiler.toLocaleString('es-ES') + ' €';
    if (labelPersonal) labelPersonal.textContent = personal.toLocaleString('es-ES') + ' €';
    if (labelSuministros) labelSuministros.textContent = suministros.toLocaleString('es-ES') + ' €';

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

    if (simMargenBruto) simMargenBruto.textContent = margenBruto.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
    if (simCostosFijos) simCostosFijos.textContent = costosFijos.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

    let porcentajeCubierto = costosFijos > 0 ? (margenBruto / costosFijos) * 100 : 100;
    const widthPct = Math.min(Math.max(porcentajeCubierto, 0), 100);

    if (netoElem) {
        netoElem.textContent = neto.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
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
            analytics.innerHTML = '<span>🚀</span> ¡Beneficio! Cubres el <strong>' + porcentajeCubierto.toFixed(0) + '%</strong> de tus costes fijos.';
            analytics.style.color = '#059669';
        } else {
            analytics.innerHTML = '<span>🚑</span> Pérdidas. Solo cubres el <strong>' + porcentajeCubierto.toFixed(0) + '%</strong> de tus costos fijos.';
            analytics.style.color = '#dc2626';
        }
    }

    // Break-Even
    const ingresosElem = document.getElementById('balance-ingresos');
    let ingresos = 0;
    if (ingresosElem) {
        ingresos = parseFloat(ingresosElem.textContent.replace('€', '').trim()) || 0;
    }

    let breakEven = 0;
    if (ingresos > 0) {
        const margenPorcentaje = margenBruto / ingresos;
        if (margenPorcentaje > 0) breakEven = costosFijos / margenPorcentaje;
    }

    const breakEvenDisplay = document.getElementById('break-even-display');
    if (breakEvenDisplay) breakEvenDisplay.textContent = breakEven.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';

    // Actualizar Card de Beneficio Neto superior
    const balanceNeto = document.getElementById('balance-neto');
    if (balanceNeto) balanceNeto.textContent = neto.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.actualizarSimulador = actualizarSimulador;
}
