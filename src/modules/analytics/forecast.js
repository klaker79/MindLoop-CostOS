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
        confianza: calcularConfianza(ventasPorDia)
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
 * Fills in missing days with 0 to show continuous timeline
 * For longer periods, shows sampled data points
 */
function prepararDatosChart(ventasPorDia, predicciones, dias = 7) {
    const hoy = new Date();
    const historicoCompleto = [];

    // For longer periods, show fewer historical days
    const diasHistoricos = dias <= 7 ? 7 : Math.min(14, dias);

    for (let i = diasHistoricos - 1; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - i);
        const fechaStr = fecha.toISOString().split('T')[0];
        const valor = ventasPorDia[fechaStr] || 0;

        historicoCompleto.push({
            x: formatearFechaCorta(fechaStr),
            y: Math.round(valor)
        });
    }

    // For month/quarter, sample forecast points (weekly)
    let forecastMostrar = predicciones;
    if (dias > 14) {
        // Show every 7th day for month/quarter
        forecastMostrar = predicciones.filter((_, i) => i === 0 || (i + 1) % 7 === 0 || i === predicciones.length - 1);
    }

    const ultimoHistorico = historicoCompleto.length > 0
        ? historicoCompleto[historicoCompleto.length - 1].y
        : 0;

    // Build forecast array with proper null padding
    const forecastData = forecastMostrar.map(p => p.prediccion);

    // Labels for x-axis
    const labels = [
        ...historicoCompleto.map(h => h.x),
        ...forecastMostrar.map(p => p.fechaFormateada)
    ];

    // Historical data + nulls for forecast portion
    const historico = [
        ...historicoCompleto.map(h => h.y),
        ...Array(forecastMostrar.length).fill(null)
    ];

    // Nulls for historical + connection point + forecast
    const forecast = [
        ...Array(historicoCompleto.length - 1).fill(null),
        ultimoHistorico,
        ...forecastData
    ];

    return {
        labels,
        historico,
        forecast
    };
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

    window._forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Ventas reales',
                    data: chartData.historico,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#10B981'
                },
                {
                    label: 'Proyección',
                    data: chartData.forecast,
                    borderColor: '#8B5CF6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#8B5CF6'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}€`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => value + '€'
                    }
                },
                x: {
                    grid: { display: false }
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
