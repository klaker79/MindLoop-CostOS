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
 * - 7 days: Line chart with daily data
 * - 30 days: Bar chart with 4 weekly bars
 * - 90 days: Bar chart with 3 monthly bars
 */
function prepararDatosChart(ventasPorDia, predicciones, dias = 7) {
    const hoy = new Date();

    // For 7 days: show daily line chart
    if (dias <= 7) {
        return prepararChartDiario(ventasPorDia, predicciones);
    }

    // For 30 days: show 4 weekly bars
    if (dias <= 30) {
        return prepararChartSemanal(predicciones);
    }

    // For 90 days: show 3 monthly bars
    return prepararChartMensual(predicciones);
}

/**
 * Daily line chart (for 7-day view)
 */
function prepararChartDiario(ventasPorDia, predicciones) {
    const hoy = new Date();
    const historicoCompleto = [];

    // Last 7 days of historical data
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

    const ultimoHistorico = historicoCompleto.length > 0
        ? historicoCompleto[historicoCompleto.length - 1].y
        : 0;

    const labels = [
        ...historicoCompleto.map(h => h.x),
        ...predicciones.map(p => p.fechaFormateada)
    ];

    const historico = [
        ...historicoCompleto.map(h => h.y),
        ...Array(predicciones.length).fill(null)
    ];

    const forecast = [
        ...Array(historicoCompleto.length - 1).fill(null),
        ultimoHistorico,
        ...predicciones.map(p => p.prediccion)
    ];

    return { labels, historico, forecast, chartType: 'line' };
}

/**
 * Weekly line chart (for 30-day view)
 * Shows 4 points: Sem 1, Sem 2, Sem 3, Sem 4
 */
function prepararChartSemanal(predicciones) {
    const semanas = [
        { label: 'Semana 1', total: 0 },
        { label: 'Semana 2', total: 0 },
        { label: 'Semana 3', total: 0 },
        { label: 'Semana 4', total: 0 }
    ];

    // Group predictions by week
    predicciones.forEach((p, i) => {
        const semanaIdx = Math.floor(i / 7);
        if (semanaIdx < 4) {
            semanas[semanaIdx].total += p.prediccion;
        }
    });

    return {
        labels: semanas.map(s => s.label),
        historico: [],
        forecast: semanas.map(s => s.total),
        chartType: 'line'
    };
}

/**
 * Monthly line chart (for 90-day view)
 * Shows 3 points: Mes 1, Mes 2, Mes 3
 */
function prepararChartMensual(predicciones) {
    const hoy = new Date();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const mesActual = hoy.getMonth();
    const barras = [
        { label: meses[(mesActual + 1) % 12], total: 0 },
        { label: meses[(mesActual + 2) % 12], total: 0 },
        { label: meses[(mesActual + 3) % 12], total: 0 }
    ];

    // Group predictions by month (approx 30 days each)
    predicciones.forEach((p, i) => {
        const mesIdx = Math.floor(i / 30);
        if (mesIdx < 3) {
            barras[mesIdx].total += p.prediccion;
        }
    });

    return {
        labels: barras.map(b => b.label),
        historico: [],
        forecast: barras.map(b => b.total),
        chartType: 'line'
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
 * Format date - includes month for clarity
 * For monthly/quarterly views, include abbreviated month
 */
function formatearFecha(date) {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${meses[date.getMonth()]}`;
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
 * Supports both line charts (7-day) and bar charts (30/90-day)
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

    const isBarChart = chartData.chartType === 'bar';

    // Configure datasets based on chart type
    const datasets = isBarChart
        ? [
            {
                label: 'Proyección',
                data: chartData.forecast,
                backgroundColor: 'rgba(139, 92, 246, 0.7)',
                borderColor: '#8B5CF6',
                borderWidth: 1,
                borderRadius: 6
            }
        ]
        : [
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
        ];

    window._forecastChart = new Chart(ctx, {
        type: isBarChart ? 'bar' : 'line',
        data: {
            labels: chartData.labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: !isBarChart,
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
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('es-ES')}€`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => value.toLocaleString('es-ES') + '€'
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
