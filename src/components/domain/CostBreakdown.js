/**
 * Componente: CostBreakdown
 * Muestra el desglose de costes de una receta
 */

import { formatCurrency } from '../../utils/helpers.js';
import { escapeHTML } from '../../utils/sanitize.js';

/**
 * Renderiza el breakdown de costes
 * @param {Object} breakdown - Datos del breakdown
 * @param {HTMLElement} container - Contenedor destino
 */
export function renderCostBreakdown(breakdown, container) {
    if (!container || !breakdown) return;

    const { lines, totalCost, costPerPortion, marginPercentage, foodCostPercentage, isComplete, missingIngredients } = breakdown;

    // Determinar clase de margen
    let marginClass = 'margin-good';
    if (marginPercentage < 50) marginClass = 'margin-bad';
    else if (marginPercentage < 65) marginClass = 'margin-warning';

    const html = `
        <div class="cost-breakdown">
            <div class="cost-breakdown__header">
                <h4>Desglose de Costes</h4>
                ${!isComplete ? '<span class="badge badge-warning">Ingredientes faltantes</span>' : ''}
            </div>

            <table class="cost-breakdown__table">
                <thead>
                    <tr>
                        <th>Ingrediente</th>
                        <th>Cantidad</th>
                        <th>Coste/ud</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${(lines || []).map(line => `
                        <tr>
                            <td>${escapeHTML(line.ingredientName || '')}</td>
                            <td>${line.quantity || 0} ${line.unit || 'g'}</td>
                            <td>${formatCurrency(line.unitCost || 0)}/kg</td>
                            <td>${formatCurrency(line.lineCost || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3"><strong>Coste Total</strong></td>
                        <td><strong>${formatCurrency(totalCost || 0)}</strong></td>
                    </tr>
                    <tr>
                        <td colspan="3">Coste por ración</td>
                        <td>${formatCurrency(costPerPortion || 0)}</td>
                    </tr>
                </tfoot>
            </table>

            <div class="cost-breakdown__kpis">
                <div class="kpi ${marginClass}">
                    <span class="kpi-label">Margen</span>
                    <span class="kpi-value">${(marginPercentage || 0).toFixed(1)}%</span>
                </div>
                <div class="kpi ${(foodCostPercentage || 0) > 35 ? 'margin-warning' : ''}">
                    <span class="kpi-label">Food Cost</span>
                    <span class="kpi-value">${(foodCostPercentage || 0).toFixed(1)}%</span>
                </div>
            </div>

            ${(missingIngredients || []).length > 0 ? `
                <div class="cost-breakdown__warning">
                    <strong>Ingredientes no encontrados:</strong>
                    IDs: ${missingIngredients.join(', ')}
                </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Carga y muestra el breakdown de una receta
 * @param {number} recipeId
 * @param {HTMLElement} container
 */
export async function loadAndRenderCostBreakdown(recipeId, container) {
    const API = window.API;

    if (!API?.calculateRecipeCost) {
        console.error('API.calculateRecipeCost no disponible');
        return;
    }

    try {
        container.innerHTML = '<div class="loading">Calculando costes...</div>';

        const result = await API.calculateRecipeCost(recipeId);

        if (result.success && result.data) {
            renderCostBreakdown(result.data.breakdown, container);
        } else {
            container.innerHTML = '<div class="error">Error al calcular costes</div>';
        }
    } catch (error) {
        console.error('Error loading cost breakdown:', error);
        container.innerHTML = `<div class="error">Error: ${escapeHTML(error.message || 'Error desconocido')}</div>`;
    }
}

export default { renderCostBreakdown, loadAndRenderCostBreakdown };
