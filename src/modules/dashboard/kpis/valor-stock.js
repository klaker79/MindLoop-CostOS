/**
 * KPI — Valor Stock + Items con stock.
 *
 * Fuente principal: `window.inventarioCompleto` (precalculado por el backend con
 * campo `valor_stock` ya resuelto). Fallback: ingredientStore con cálculo
 * `stock_actual × precio_unitario` usando `getIngredientUnitPrice`.
 *
 * Actualiza #kpi-valor-stock (valor total) y #kpi-items-stock (count).
 */

import { cm } from '../../../utils/helpers.js';
import { getIngredientUnitPrice } from '../../../utils/cost-calculator.js';
import { ingredientStore } from '../../../stores/ingredientStore.js';

export function renderKpiValorStock() {
    const valorStockEl = document.getElementById('kpi-valor-stock');
    const itemsStockEl = document.getElementById('kpi-items-stock');

    try {
        const inventario = window.inventarioCompleto || [];

        if (inventario.length > 0) {
            const valorTotal = inventario.reduce((sum, item) => {
                return sum + (parseFloat(item.valor_stock) || 0);
            }, 0);

            // Priorizar stock_actual, fallback a stock_virtual (alias del backend).
            const itemsConStock = inventario.filter(i => {
                const stock = parseFloat(i.stock_actual ?? i.stock_virtual) || 0;
                return stock > 0;
            }).length;

            if (valorStockEl) valorStockEl.textContent = cm(valorTotal, 0);
            if (itemsStockEl) itemsStockEl.textContent = itemsConStock;
            return;
        }

        // Fallback con ingredientes si inventarioCompleto no cargado
        const ingredientesStock = ingredientStore.getState().ingredients;
        if (ingredientesStock.length > 0) {
            const valorTotal = ingredientesStock.reduce((sum, ing) => {
                const stock = parseFloat(ing.stock_actual) || 0;
                const precioUnitario = getIngredientUnitPrice(null, ing);
                return sum + (stock * precioUnitario);
            }, 0);

            const itemsConStock = ingredientesStock.filter(i =>
                (parseFloat(i.stock_actual) || 0) > 0
            ).length;

            if (valorStockEl) valorStockEl.textContent = cm(valorTotal, 0);
            if (itemsStockEl) itemsStockEl.textContent = itemsConStock;
        } else {
            if (valorStockEl) valorStockEl.textContent = cm(0, 0);
            if (itemsStockEl) itemsStockEl.textContent = '0';
        }
    } catch (e) {
        console.error('Error calculando valor stock:', e);
        if (valorStockEl) valorStockEl.textContent = '-';
        if (itemsStockEl) itemsStockEl.textContent = '-';
    }
}
