/**
 * Dashboard — Sparklines.
 *
 * Renderiza los gráficos sparkline del KPI de Ingresos usando datos históricos
 * de `visual-effects`. Si el contenedor no existe, no hace nada.
 */

import { renderSparkline, getHistoricalData } from '../../ui/visual-effects.js';

export function renderSparklines() {
    const sparklineIngresos = document.getElementById('sparkline-ingresos');
    if (sparklineIngresos) {
        const historicalData = getHistoricalData('ingresos');
        renderSparkline(sparklineIngresos, historicalData);
    }
}
