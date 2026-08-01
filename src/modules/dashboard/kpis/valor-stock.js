/**
 * KPI — Valor Stock + Items con stock.
 *
 * Fuente principal: `window.inventarioCompleto` (precalculado por el backend con
 * campo `valor_stock` ya resuelto). Fallback: ingredientStore con cálculo
 * `stock_actual × precio_unitario` usando `getIngredientUnitPrice`.
 *
 * 🧹 2026-08-01 — GÉNERO vs SUMINISTROS
 * El número grande cuenta solo GÉNERO (alimento + bebida): lo que se compra para
 * cocinar y vender. Los suministros (guantes, servilletas, mantelillos, bolsas)
 * van aparte en #kpi-valor-suministros, porque entran por pedido pero no salen
 * por ninguna receta: su stock solo puede subir y arrastraba el KPI hacia arriba
 * sin techo (11.283 € de 51.438 € en La Nave 5 — el 22%).
 *
 * Fail-safe: el criterio vive en `esSuministro()`, que devuelve false cuando el
 * ingrediente no trae `familia`. Si este frontend corre contra un backend que
 * todavía no envía el campo, TODO cuenta como género y el KPI se comporta
 * exactamente como antes — nunca muestra un valor menor del real.
 *
 * Actualiza #kpi-valor-stock (género), #kpi-items-stock (count de género) y
 * #kpi-valor-suministros (línea secundaria, oculta si no hay suministros).
 */

import { cm } from '../../../utils/helpers.js';
import { getIngredientUnitPrice, esSuministro } from '../../../utils/cost-calculator.js';
import { t } from '@/i18n/index.js';
import { ingredientStore } from '../../../stores/ingredientStore.js';

/**
 * Pinta la línea secundaria de suministros. La oculta si no hay nada que contar,
 * para no meter ruido en restaurantes que no registran material no comestible.
 */
function renderLineaSuministros(items, valor) {
    const el = document.getElementById('kpi-valor-suministros');
    if (!el) return;

    if (!(items > 0) || !(valor > 0)) {
        el.style.display = 'none';
        el.textContent = '';
        return;
    }

    el.style.display = 'block';
    el.textContent = `🧹 ${t('dashboard:kpi_supplies')}: ${cm(valor, 0)} · ${items} ${t('dashboard:kpi_items')}`;
}

export function renderKpiValorStock() {
    const valorStockEl = document.getElementById('kpi-valor-stock');
    const itemsStockEl = document.getElementById('kpi-items-stock');

    try {
        const inventario = window.inventarioCompleto || [];

        if (inventario.length > 0) {
            let valorGenero = 0;
            let valorSuministros = 0;
            let itemsGenero = 0;
            let itemsSuministros = 0;

            inventario.forEach(item => {
                const valor = parseFloat(item.valor_stock) || 0;
                // Priorizar stock_actual, fallback a stock_virtual (alias del backend).
                const stock = parseFloat(item.stock_actual ?? item.stock_virtual) || 0;
                const conStock = stock > 0;

                if (esSuministro(item)) {
                    valorSuministros += valor;
                    if (conStock) itemsSuministros++;
                } else {
                    valorGenero += valor;
                    if (conStock) itemsGenero++;
                }
            });

            if (valorStockEl) valorStockEl.textContent = cm(valorGenero, 0);
            if (itemsStockEl) itemsStockEl.textContent = itemsGenero;
            renderLineaSuministros(itemsSuministros, valorSuministros);
            return;
        }

        // Fallback con ingredientes si inventarioCompleto no cargado
        const ingredientesStock = ingredientStore.getState().ingredients;
        if (ingredientesStock.length > 0) {
            let valorGenero = 0;
            let valorSuministros = 0;
            let itemsGenero = 0;
            let itemsSuministros = 0;

            ingredientesStock.forEach(ing => {
                const stock = parseFloat(ing.stock_actual) || 0;
                const valor = stock * getIngredientUnitPrice(null, ing);
                const conStock = stock > 0;

                if (esSuministro(ing)) {
                    valorSuministros += valor;
                    if (conStock) itemsSuministros++;
                } else {
                    valorGenero += valor;
                    if (conStock) itemsGenero++;
                }
            });

            if (valorStockEl) valorStockEl.textContent = cm(valorGenero, 0);
            if (itemsStockEl) itemsStockEl.textContent = itemsGenero;
            renderLineaSuministros(itemsSuministros, valorSuministros);
        } else {
            if (valorStockEl) valorStockEl.textContent = cm(0, 0);
            if (itemsStockEl) itemsStockEl.textContent = '0';
            renderLineaSuministros(0, 0);
        }
    } catch (e) {
        console.error('Error calculando valor stock:', e);
        if (valorStockEl) valorStockEl.textContent = '-';
        if (itemsStockEl) itemsStockEl.textContent = '-';
        renderLineaSuministros(0, 0);
    }
}
