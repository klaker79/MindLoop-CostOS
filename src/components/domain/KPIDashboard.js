/**
 * Componente: KPIDashboard
 * Muestra KPIs principales del negocio
 */

import { formatCurrency } from '../../utils/helpers.js';

/**
 * Renderiza el dashboard de KPIs
 * @param {Object} data - { daily, alerts, topRecipes }
 * @param {HTMLElement} container
 */
export function renderKPIDashboard(data, container) {
    if (!container) return;

    const { daily = {}, alerts = [], topRecipes = [] } = data;

    const html = `
        <div class="kpi-dashboard">
            <!-- KPIs del día -->
            <div class="kpi-dashboard__section">
                <h3>Hoy</h3>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <span class="kpi-card__label">Ingresos</span>
                        <span class="kpi-card__value">${formatCurrency(daily.revenue || 0)}</span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-card__label">Coste</span>
                        <span class="kpi-card__value">${formatCurrency(daily.cost || 0)}</span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-card__label">Beneficio</span>
                        <span class="kpi-card__value ${(daily.grossProfit || 0) >= 0 ? 'positive' : 'negative'}">
                            ${formatCurrency(daily.grossProfit || 0)}
                        </span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-card__label">Margen</span>
                        <span class="kpi-card__value ${getMarginClass(daily.margin || 0)}">
                            ${(daily.margin || 0).toFixed(1)}%
                        </span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-card__label">Food Cost</span>
                        <span class="kpi-card__value ${(daily.foodCost || 0) > 35 ? 'warning' : ''}">
                            ${(daily.foodCost || 0).toFixed(1)}%
                        </span>
                    </div>
                    <div class="kpi-card">
                        <span class="kpi-card__label">Ventas</span>
                        <span class="kpi-card__value">${daily.saleCount || 0}</span>
                    </div>
                </div>
            </div>

            <!-- Alertas activas -->
            ${alerts && alerts.length > 0 ? `
                <div class="kpi-dashboard__section kpi-dashboard__alerts">
                    <h3>⚠️ Alertas Activas (${alerts.length})</h3>
                    <ul class="alert-list">
                        ${alerts.slice(0, 5).map(alert => `
                            <li class="alert-item alert-item--${alert.severity}">
                                <span class="alert-item__icon">${getAlertIcon(alert.severity)}</span>
                                <span class="alert-item__title">${alert.title}</span>
                                <button class="btn-small" data-action="acknowledge" data-alert-id="${alert.id}">
                                    OK
                                </button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}

            <!-- Top recetas por margen -->
            ${topRecipes && topRecipes.length > 0 ? `
                <div class="kpi-dashboard__section">
                    <h3>📊 Top Recetas por Ingresos</h3>
                    <table class="mini-table">
                        <thead>
                            <tr>
                                <th>Receta</th>
                                <th>Margen</th>
                                <th>Vendidas (30d)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topRecipes.slice(0, 5).map(recipe => `
                                <tr>
                                    <td>${recipe.nombre}</td>
                                    <td class="${getMarginClass(recipe.margen_porcentaje || 70)}">
                                        ${(recipe.margen_porcentaje || 70).toFixed(1)}%
                                    </td>
                                    <td>${recipe.total_vendido || 0}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = html;

    // Bind eventos de alertas
    container.querySelectorAll('[data-action="acknowledge"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const alertId = btn.dataset.alertId;
            if (window.API && window.API.acknowledgeAlert) {
                await window.API.acknowledgeAlert(alertId);
                loadKPIDashboard(container);
            }
        });
    });
}

function getMarginClass(margin) {
    if (margin >= 70) return 'excellent';
    if (margin >= 60) return 'good';
    if (margin >= 50) return 'warning';
    return 'bad';
}

function getAlertIcon(severity) {
    const icons = {
        critical: '🔴',
        warning: '🟡',
        info: '🔵'
    };
    return icons[severity] || '⚪';
}

/**
 * Carga datos y renderiza dashboard
 */
export async function loadKPIDashboard(container) {
    const API = window.API;
    if (!API) return;

    try {
        container.innerHTML = '<div class="loading">Cargando KPIs...</div>';

        // Cargar datos en paralelo
        const [dailyRes, alertsRes, topRes] = await Promise.all([
            API.getDailyKPIs ? API.getDailyKPIs() : { data: {} },
            API.getActiveAlerts ? API.getActiveAlerts() : { data: [] },
            API.getTopRecipes ? API.getTopRecipes(5) : { data: [] }
        ]);

        renderKPIDashboard({
            daily: dailyRes?.data || dailyRes,
            alerts: alertsRes?.data || alertsRes,
            topRecipes: topRes?.data || topRes
        }, container);

    } catch (error) {
        console.error('Error loading KPI dashboard:', error);
        container.innerHTML = '<div class="error">Error cargando KPIs</div>';
    }
}

export default { renderKPIDashboard, loadKPIDashboard };
