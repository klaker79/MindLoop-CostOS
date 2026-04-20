/**
 * KPI — Stock Bajo. Cuenta ingredientes con:
 *   stock_actual = 0  OR  (stock_minimo > 0 AND stock_actual <= stock_minimo)
 *
 * Fuente: `window.ingredientes` (fallback al store).
 * Actualiza #kpi-stock y #kpi-stock-msg.
 */

import { animateCounter } from '../../ui/visual-effects.js';
import { ingredientStore } from '../../../stores/ingredientStore.js';
import { t } from '@/i18n/index.js';

export function renderKpiStockBajo() {
    const ingredientes = window.ingredientes || ingredientStore.getState().ingredients || [];
    const stockBajo = ingredientes.filter(ing => {
        // null/undefined = no registrado, no es alerta (alineado con ingredientStore.lowStockItems)
        if (ing.stock_actual === null || ing.stock_actual === undefined) return false;
        const stock = parseFloat(ing.stock_actual) || 0;
        const minimo = parseFloat(ing.stock_minimo) || parseFloat(ing.stockMinimo) || 0;
        return stock === 0 || (minimo > 0 && stock <= minimo);
    }).length;

    const stockEl = document.getElementById('kpi-stock');
    if (stockEl) {
        stockEl.textContent = stockBajo;
        if (stockBajo > 0) animateCounter(stockEl, stockBajo, '', 800);
    }

    const stockMsgEl = document.getElementById('kpi-stock-msg');
    if (stockMsgEl) {
        stockMsgEl.textContent = stockBajo > 0
            ? t('dashboard:stock_needs_attention')
            : t('dashboard:stock_all_ok');
    }

    return stockBajo;
}
