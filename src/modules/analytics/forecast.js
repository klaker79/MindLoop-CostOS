/**
 * Sales Forecast Module
 * Predicts revenue for next 7 days based on historical data
 * 
 * Algorithm: Weighted Moving Average + Day-of-Week Pattern
 * 
 * @module modules/analytics/forecast
 */

/**
 * Calculates sales forecast for the next N days
 * @param {Array} ventas - Array of sales with {fecha, total}
 * @param {number} dias - Number of days to forecast (default: 7)
 * @returns {Object} Forecast data with predictions and chart data
 */
export function calcularForecast(ventas, dias = 7) {
    if (!ventas || ventas.length === 0) {
        return getEmptyForecast(dias);
    }

    // Group sales by date
    const ventasPorDia = agruparPorDia(ventas);

    // Calculate day-of-week averages (for pattern detection)
    const patronSemanal = calcularPatronSemanal(ventasPorDia);

    // Calculate moving average (last 14 days)
    const mediaMovil = calcularMediaMovil(ventasPorDia, 14);

    // Calculate week comparison (this week vs last week)
    const comparativaSemana = calcularComparativaSemana(ventasPorDia);

    // Generate forecast
    const predicciones = [];
    const hoy = new Date();

    for (let i = 1; i <= dias; i++) {
        const fechaFutura = new Date(hoy);
        fechaFutura.setDate(hoy.getDate() + i);

        const diaSemana = fechaFutura.getDay();
        const factorDia = patronSemanal[diaSemana] || 1;

        // Predicted value = moving average * day pattern factor
        const prediccion = Math.round(mediaMovil * factorDia);

        predicciones.push({
            fecha: fechaFutura.toISOString().split('T')[0],
            fechaFormateada: formatearFecha(fechaFutura),
            diaSemana: getDiaSemana(diaSemana),
            prediccion: prediccion,
            confianza: calcularConfianza(ventasPorDia)
        });
    }

    // Prepare chart data (last N days actual + N days forecast)
    const chartData = prepararDatosChart(ventasPorDia, predicciones, dias);

    // Total forecast
    const totalPrediccion = predicciones.reduce((sum, p) => sum + p.prediccion, 0);

    return {
        predicciones,
        chartData,
        totalPrediccion,
        mediaMovil,
        confianza: calcularConfianza(ventasPorDia),
        comparativaSemana
    };
}

/**
 * Calculates current week vs previous week comparison
 */
function calcularComparativaSemana(ventasPorDia) {
    const hoy = new Date();
    const diaSemana = hoy.getDay();

    // Calculate start of current week (Monday)
    const inicioSemanaActual = new Date(hoy);
    inicioSemanaActual.setDate(hoy.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
    inicioSemanaActual.setHours(0, 0, 0, 0);

    // Previous week
    const inicioSemanaAnterior = new Date(inicioSemanaActual);
    inicioSemanaAnterior.setDate(inicioSemanaActual.getDate() - 7);

    let totalSemanaActual = 0;
    let totalSemanaAnterior = 0;

    // Sum sales for each week (up to today's day of week)
    Object.entries(ventasPorDia).forEach(([fecha, total]) => {
        const fechaVenta = new Date(fecha);

        // Current week (from Monday to today)
        if (fechaVenta >= inicioSemanaActual && fechaVenta <= hoy) {
            totalSemanaActual += total;
        }

        // Previous week (same days for fair comparison)
        const finSemanaAnterior = new Date(inicioSemanaAnterior);
        finSemanaAnterior.setDate(inicioSemanaAnterior.getDate() + (diaSemana === 0 ? 6 : diaSemana - 1));

        if (fechaVenta >= inicioSemanaAnterior && fechaVenta <= finSemanaAnterior) {
            totalSemanaAnterior += total;
        }
    });

    // Calculate percentage change
    let porcentaje = 0;
    let tendencia = 'igual';

    if (totalSemanaAnterior > 0) {
        porcentaje = Math.round(((totalSemanaActual - totalSemanaAnterior) / totalSemanaAnterior) * 100);
        tendencia = porcentaje > 0 ? 'up' : porcentaje < 0 ? 'down' : 'igual';
    } else if (totalSemanaActual > 0) {
        porcentaje = 100;
        tendencia = 'up';
    }

    return {
        actual: Math.round(totalSemanaActual),
        anterior: Math.round(totalSemanaAnterior),
        porcentaje: Math.abs(porcentaje),
        tendencia
    };
}

/**
 * Groups sales by date
 */
function agruparPorDia(ventas) {
    const agrupado = {};

    ventas.forEach(v => {
        const fecha = (v.fecha || '').split('T')[0];
        if (fecha) {
            if (!agrupado[fecha]) {
                agrupado[fecha] = 0;
            }
            agrupado[fecha] += parseFloat(v.total) || 0;
        }
    });

    return agrupado;
}

/**
 * Calculates day-of-week pattern factors
 * Returns multipliers for each day (0=Sun, 6=Sat)
 */
function calcularPatronSemanal(ventasPorDia) {
    const sumaPorDia = [0, 0, 0, 0, 0, 0, 0];
    const contadorPorDia = [0, 0, 0, 0, 0, 0, 0];

    Object.entries(ventasPorDia).forEach(([fecha, total]) => {
        const diaSemana = new Date(fecha).getDay();
        sumaPorDia[diaSemana] += total;
        contadorPorDia[diaSemana]++;
    });

    // Calculate average per day
    const mediaPorDia = sumaPorDia.map((sum, i) =>
        contadorPorDia[i] > 0 ? sum / contadorPorDia[i] : 0
    );

    // Calculate global average
    const mediaGlobal = mediaPorDia.reduce((a, b) => a + b, 0) / 7;

    // Return factors (1 = average, >1 = above average, <1 = below)
    if (mediaGlobal === 0) return [1, 1, 1, 1, 1, 1, 1];

    return mediaPorDia.map(m => m / mediaGlobal || 1);
}

/**
 * Calculates moving average for last N days
 */
function calcularMediaMovil(ventasPorDia, dias = 14) {
    const fechas = Object.keys(ventasPorDia).sort().slice(-dias);

    if (fechas.length === 0) return 0;

    const suma = fechas.reduce((acc, fecha) => acc + ventasPorDia[fecha], 0);
    return suma / fechas.length;
}

/**
 * Calculates confidence level based on data availability
 */
function calcularConfianza(ventasPorDia) {
    const diasConDatos = Object.keys(ventasPorDia).length;

    if (diasConDatos >= 30) return 'alta';
    if (diasConDatos >= 14) return 'media';
    if (diasConDatos >= 7) return 'baja';
    return 'muy_baja';
}

/**
 * Prepares data for Chart.js
 * For 7 days: shows daily view
 * For 30 days: shows weekly summary
 */
function prepararDatosChart(ventasPorDia, predicciones, dias = 7) {
    const hoy = new Date();

    if (dias <= 7) {
        // DAILY VIEW for 7 days
        const historicoCompleto = [];
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            const valor = ventasPorDia[fechaStr] || 0;
            historicoCompleto.push({
                x: formatearFechaCorta(fechaStr),
                y: Math.round(valor)
            });
        }

        const ultimoHistorico = historicoCompleto[historicoCompleto.length - 1]?.y || 0;

        return {
            labels: [...historicoCompleto.map(h => h.x), ...predicciones.map(p => p.fechaFormateada)],
            historico: [...historicoCompleto.map(h => h.y), ...Array(predicciones.length).fill(null)],
            forecast: [...Array(historicoCompleto.length - 1).fill(null), ultimoHistorico, ...predicciones.map(p => p.prediccion)]
        };
    } else {
        // WEEKLY VIEW for month
        const labels = ['Sem -2', 'Sem -1', 'Sem actual', 'Sem +1', 'Sem +2', 'Sem +3', 'Sem +4'];

        // Calculate weekly totals for historical
        const semanas = [0, 0, 0]; // -2, -1, actual
        Object.entries(ventasPorDia).forEach(([fecha, total]) => {
            const fechaVenta = new Date(fecha);
            const diasAtras = Math.floor((hoy - fechaVenta) / (1000 * 60 * 60 * 24));
            if (diasAtras < 7) semanas[2] += total;
            else if (diasAtras < 14) semanas[1] += total;
            else if (diasAtras < 21) semanas[0] += total;
        });

        // Calculate weekly forecast totals
        const forecastSemanas = [0, 0, 0, 0]; // +1, +2, +3, +4
        predicciones.forEach((p, i) => {
            const semana = Math.floor(i / 7);
            if (semana < 4) forecastSemanas[semana] += p.prediccion;
        });

        const ultimoHistorico = Math.round(semanas[2]);

        return {
            labels,
            historico: [...semanas.map(s => Math.round(s)), ...Array(4).fill(null)],
            forecast: [null, null, ultimoHistorico, ...forecastSemanas.map(s => Math.round(s))]
        };
    }
}

/**
 * Returns empty forecast for no data case
 */
function getEmptyForecast(dias) {
    const predicciones = [];
    const hoy = new Date();

    for (let i = 1; i <= dias; i++) {
        const fechaFutura = new Date(hoy);
        fechaFutura.setDate(hoy.getDate() + i);
        predicciones.push({
            fecha: fechaFutura.toISOString().split('T')[0],
            fechaFormateada: formatearFecha(fechaFutura),
            diaSemana: getDiaSemana(fechaFutura.getDay()),
            prediccion: 0,
            confianza: 'sin_datos'
        });
    }

    return {
        predicciones,
        chartData: { labels: [], historico: [], forecast: [] },
        totalPrediccion: 0,
        mediaMovil: 0,
        confianza: 'sin_datos'
    };
}

/**
 * Format date as "Lun 28"
 */
function formatearFecha(date) {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${dias[date.getDay()]} ${date.getDate()}`;
}

function formatearFechaCorta(fechaStr) {
    const date = new Date(fechaStr);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${dias[date.getDay()]} ${date.getDate()}`;
}

function getDiaSemana(dia) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[dia];
}

/**
 * Renders forecast chart using Chart.js
 */
export function renderForecastChart(containerId, chartData) {
    const ctx = document.getElementById(containerId);
    if (!ctx) return null;

    const Chart = window.Chart;
    if (!Chart) {
        console.warn('Chart.js not loaded');
        return null;
    }

    // Destroy existing chart
    if (window._forecastChart) {
        window._forecastChart.destroy();
    }

    // Create gradient fills for premium look
    const canvas = ctx.canvas || ctx;
    const chartCtx = canvas.getContext ? canvas.getContext('2d') : ctx;

    // Green gradient for actual sales
    const greenGradient = chartCtx.createLinearGradient(0, 0, 0, canvas.height || 80);
    greenGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    greenGradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.12)');
    greenGradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

    // Purple gradient for forecast
    const purpleGradient = chartCtx.createLinearGradient(0, 0, 0, canvas.height || 80);
    purpleGradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    purpleGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.1)');
    purpleGradient.addColorStop(1, 'rgba(139, 92, 246, 0.01)');

    window._forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Ventas reales',
                    data: chartData.historico,
                    borderColor: '#10B981',
                    backgroundColor: greenGradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#10B981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointHoverBorderWidth: 3,
                    pointHoverBackgroundColor: '#10B981',
                    pointHoverBorderColor: '#ffffff'
                },
                {
                    label: 'Proyección',
                    data: chartData.forecast,
                    borderColor: '#8B5CF6',
                    backgroundColor: purpleGradient,
                    borderWidth: 2.5,
                    borderDash: [6, 4],
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#8B5CF6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointHoverBorderWidth: 3,
                    pointHoverBackgroundColor: '#8B5CF6',
                    pointHoverBorderColor: '#ffffff',
                    pointStyle: 'rectRounded'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: { size: 11, weight: '600' },
                        padding: 12,
                        color: '#475569'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#E2E8F0',
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 13 },
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}€`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(148, 163, 184, 0.08)',
                        drawBorder: false
                    },
                    border: { display: false },
                    ticks: {
                        callback: (value) => value + '€',
                        color: '#94A3B8',
                        font: { size: 10, weight: '500' },
                        padding: 6
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: '#94A3B8',
                        font: { size: 10, weight: '500' },
                        padding: 4
                    }
                }
            }
        }
    });

    return window._forecastChart;
}

// Export for global access
if (typeof window !== 'undefined') {
    window.calcularForecast = calcularForecast;
    window.renderForecastChart = renderForecastChart;
}
