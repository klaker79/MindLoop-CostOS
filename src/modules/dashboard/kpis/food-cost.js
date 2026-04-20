/**
 * KPI — Margen Real / Food Cost.
 *
 * Fuente de verdad: /analytics/pnl-breakdown (ventas_diarias_resumen joined
 * con recetas.categoria). Food y beverage se muestran por separado porque
 * tienen perfiles de margen muy distintos (food ≤30-35%, beverage 25-45%);
 * mezclarlos en un único Food Cost engañaría al usuario.
 *
 * KPI principal = food cost de FOOD (estándar de hostelería).
 * Actualiza #kpi-margen, #kpi-fc-bar, #kpi-fc-detail.
 */

import { apiClient } from '../../../api/client.js';
import { rangoPeriodo } from '../_shared.js';
import { t } from '@/i18n/index.js';

export async function actualizarMargenReal(periodo) {
    const margenEl = document.getElementById('kpi-margen');
    const fcBar = document.getElementById('kpi-fc-bar');
    const fcDetail = document.getElementById('kpi-fc-detail');
    if (!margenEl) return;

    try {
        const { desde, hasta } = rangoPeriodo(periodo);
        const resp = await apiClient.get(`/analytics/pnl-breakdown?desde=${desde}&hasta=${hasta}`);
        const foodData = resp?.food || { ingresos: 0, food_cost_pct: 0 };
        const bevData = resp?.beverage || { ingresos: 0, food_cost_pct: 0 };
        const totalIngresos = parseFloat(foodData.ingresos) + parseFloat(bevData.ingresos);

        if (totalIngresos === 0) {
            margenEl.textContent = '—';
            if (fcBar) { fcBar.style.width = '0%'; fcBar.style.background = '#E2E8F0'; }
            if (fcDetail) fcDetail.textContent = '';
            return;
        }

        const foodCost = parseFloat(foodData.food_cost_pct) || 0;
        const bevCost = parseFloat(bevData.food_cost_pct) || 0;

        margenEl.textContent = Math.round(foodCost) + '%';
        margenEl.style.color = foodCost <= 30 ? '#059669' : foodCost <= 35 ? '#0EA5E9' : foodCost <= 40 ? '#D97706' : '#DC2626';

        if (fcBar) {
            const barWidth = Math.min(foodCost, 50) * 2;
            fcBar.style.width = barWidth + '%';
            fcBar.style.background = foodCost <= 30 ? '#059669' : foodCost <= 35 ? '#0EA5E9' : foodCost <= 40 ? '#D97706' : '#DC2626';
        }

        if (fcDetail) {
            const foodLabel = t('dashboard:kpi_food_cost_food') || 'Comida';
            const bevLabel = t('dashboard:kpi_food_cost_beverage') || 'Bebida';
            const bevText = bevData.ingresos > 0 ? ` · ${bevLabel} ${Math.round(bevCost)}%` : '';
            fcDetail.textContent = `${foodLabel} ${Math.round(foodCost)}%${bevText}`;
        }
    } catch (error) {
        console.error('Error calculando food cost:', error);
        margenEl.textContent = '—';
        if (fcBar) fcBar.style.width = '0%';
        if (fcDetail) fcDetail.textContent = '';
    }
}
