/**
 * Cálculo PURO del "Beneficio neto por día" del Diario (sin DOM, sin fetch, sin
 * window) para poder testarlo y para que el gráfico del Diario y la fila de
 * totales usen EXACTAMENTE la misma lógica.
 *
 * ⛔ INVARIANTE CRÍTICO (esto es lo que se rompió el 2026-07-08 y hay que
 * proteger para siempre):
 *
 *     beneficioRealTotal === Σ (beneficio neto de cada día)
 *
 * Es decir: el TOTAL del mes es SIEMPRE la suma de las columnas diarias. Cada
 * día ya lleva restado su gasto fijo del día (gastosFijosDia); el total suma lo
 * mismo. NO se puede recalcular el gasto fijo total por otra vía (p.ej. días de
 * CALENDARIO transcurridos), que fue justo el bug: con 4 días de ventas salía
 * −396 € / −78 € en vez de la suma real de las columnas.
 *
 * Fórmula del beneficio neto de un día (misma que la Cuenta de Resultados):
 *   beneficioNeto = ingresos − costos − merma − comidaPersonal − personalExtra − gastosFijosDia
 *
 * @param {Array} diasInput - un elemento por día MOSTRADO (con o sin actividad):
 *   { dia, ingresos, costos, merma, comida, extra, cantidadVendida, tieneActividad }
 * @param {number} gastosFijosDia - gasto fijo operativo repartido por día.
 * @returns {Object} { barras, beneficioRealTotal, sumaTotal, diasConDatos,
 *   diasSinActividad, gastosPendientes, totalPlatosVendidos, totalGastosFijos }
 *   - barras: [{ dia, beneficio, activo }] para el gráfico.
 *   - totalGastosFijos: gastosFijosDia × nº de días (para la fila de gastos fijos).
 */
export function computeBeneficioNetoDiario(diasInput, gastosFijosDia) {
    const dias = Array.isArray(diasInput) ? diasInput : [];
    const gfd = Number.isFinite(gastosFijosDia) && gastosFijosDia > 0 ? gastosFijosDia : 0;

    const barras = [];
    let beneficioRealTotal = 0;
    let sumaTotal = 0;
    let diasConDatos = 0;
    let diasSinActividad = 0;
    let gastosPendientes = 0;
    let totalPlatosVendidos = 0;

    for (const d of dias) {
        const ingresos = Number(d.ingresos) || 0;
        const costos = Number(d.costos) || 0;
        const merma = Number(d.merma) || 0;
        const comida = Number(d.comida) || 0;
        const extra = Number(d.extra) || 0;
        const activo = !!d.tieneActividad;

        const beneficio = ingresos - costos - merma - comida - extra - gfd;
        beneficioRealTotal += beneficio;

        if (activo) {
            sumaTotal += beneficio;
            diasConDatos++;
        } else {
            diasSinActividad++;
            gastosPendientes += gfd;
        }
        totalPlatosVendidos += Number(d.cantidadVendida) || 0;

        barras.push({ dia: d.dia, beneficio, activo });
    }

    // Total de gastos fijos coherente con las columnas: gasto fijo × nº de días
    // MOSTRADOS (los que tienen columna). NUNCA por días de calendario.
    const totalGastosFijos = gfd * dias.length;

    return {
        barras,
        beneficioRealTotal,
        sumaTotal,
        diasConDatos,
        diasSinActividad,
        gastosPendientes,
        totalPlatosVendidos,
        totalGastosFijos
    };
}
