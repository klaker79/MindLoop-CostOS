/**
 * Componente: KPICharts
 * Gráficos de KPIs con Chart.js
 */

// Importar Chart.js como ES module
import Chart from 'chart.js/auto';

/**
 * Renderiza gráficos de KPIs
 */
export async function renderKPICharts(container) {
    if (!container || !window.API) return;

    container.innerHTML = '<div class="loading">Cargando gráficos...</div>';

    try {
        // Cargar datos
        const [weekData, monthData] = await Promise.all([
            window.API.getDailyRangeKPIs ? window.API.getDailyRangeKPIs(7) : null,
            window.API.getDailyRangeKPIs ? window.API.getDailyRangeKPIs(30) : null
        ]);

        const weekKPIs = weekData?.data || [];
        const monthKPIs = monthData?.data || [];

        if (weekKPIs.length === 0 && monthKPIs.length === 0) {
            container.innerHTML = '<div class="kpi-charts__empty">📊 No hay datos suficientes para mostrar gráficos</div>';
            return;
        }

        container.innerHTML = `
            <div class="kpi-charts">
                <div class="kpi-charts__row">
                    <div class="chart-container chart-container--bar">
                        <h4>📊 Ingresos vs Costes (7 días)</h4>
                        <canvas id="chart-revenue-cost"></canvas>
                    </div>
                    <div class="chart-container chart-container--line">
                        <h4>📈 Evolución Margen % (30 días)</h4>
                        <canvas id="chart-margin-trend"></canvas>
                    </div>
                </div>
                <div class="kpi-charts__row">
                    <div class="chart-container chart-container--bar">
                        <h4>🍽️ Food Cost % (7 días)</h4>
                        <canvas id="chart-food-cost"></canvas>
                    </div>
                    <div class="chart-container chart-container--line">
                        <h4>💰 Beneficio Bruto (30 días)</h4>
                        <canvas id="chart-profit-trend"></canvas>
                    </div>
                </div>
            </div>
        `;

        // Renderizar gráficos
        renderRevenueVsCostChart(weekKPIs);
        renderMarginTrendChart(monthKPIs);
        renderFoodCostChart(weekKPIs);
        renderProfitTrendChart(monthKPIs);

    } catch (error) {
        console.error('Error loading KPI charts:', error);
        container.innerHTML = '<div class="error">Error cargando gráficos</div>';
    }
}

function renderRevenueVsCostChart(data) {
    const ctx = document.getElementById('chart-revenue-cost');
    if (!ctx || data.length === 0) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => formatShortDate(d.date)),
            datasets: [
                {
                    label: 'Ingresos',
                    data: data.map(d => d.revenue),
                    backgroundColor: 'rgba(34, 197, 94, 0.7)',
                    borderColor: 'rgb(34, 197, 94)',
                    borderWidth: 1
                },
                {
                    label: 'Costes',
                    data: data.map(d => d.cost),
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => '€' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

function renderMarginTrendChart(data) {
    const ctx = document.getElementById('chart-margin-trend');
    if (!ctx || data.length === 0) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatShortDate(d.date)),
            datasets: [{
                label: 'Margen %',
                data: data.map(d => d.margin),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            }
        }
    });
}

function renderFoodCostChart(data) {
    const ctx = document.getElementById('chart-food-cost');
    if (!ctx || data.length === 0) return;

    // Línea de umbral (35%)
    const threshold = Array(data.length).fill(35);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => formatShortDate(d.date)),
            datasets: [
                {
                    label: 'Food Cost %',
                    data: data.map(d => d.foodCost),
                    backgroundColor: data.map(d =>
                        d.foodCost > 35 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)'
                    ),
                    borderWidth: 1
                },
                {
                    label: 'Umbral (35%)',
                    data: threshold,
                    type: 'line',
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    min: 0,
                    max: 50,
                    ticks: {
                        callback: value => value + '%'
                    }
                }
            }
        }
    });
}

function renderProfitTrendChart(data) {
    const ctx = document.getElementById('chart-profit-trend');
    if (!ctx || data.length === 0) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatShortDate(d.date)),
            datasets: [{
                label: 'Beneficio €',
                data: data.map(d => d.grossProfit),
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    ticks: {
                        callback: value => '€' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch (e) {
        return dateStr;
    }
}

export default { renderKPICharts };
