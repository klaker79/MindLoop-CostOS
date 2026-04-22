/**
 * food-cost-thresholds.js — Umbrales de food cost unificados.
 *
 * Un único sitio que define los thresholds. Cualquier módulo que pinte
 * rojo/amarillo/verde según food cost debe importar de aquí — así evitamos
 * que unos módulos usen 30/35/40 y otros 28/33/38 y terminemos mostrando
 * al usuario diagnósticos inconsistentes para la misma receta.
 *
 * Escala (alineada con CLAUDE.md de ambos repos):
 *   ≤30%  → 'excellent' (verde oscuro)
 *   31-35 → 'target'    (verde / ok)
 *   36-40 → 'watch'     (naranja)
 *   >40%  → 'alert'     (rojo)
 *
 * Vinos tienen target diferente (≤45%) — ver WINE_COST_THRESHOLDS.
 */

export const FOOD_COST_THRESHOLDS = Object.freeze({
    EXCELLENT_MAX: 30,
    TARGET_MAX: 35,
    WATCH_MAX: 40,
});

export const WINE_COST_THRESHOLDS = Object.freeze({
    EXCELLENT_MAX: 40,
    TARGET_MAX: 45,
    WATCH_MAX: 50,
});

/**
 * Clasifica un food cost (%) en una categoría semántica.
 * @param {number} pct  food cost en porcentaje (0-100)
 * @returns {'excellent'|'target'|'watch'|'alert'|'unknown'}
 */
export function classifyFoodCost(pct) {
    if (pct === null || pct === undefined || pct === '') return 'unknown';
    const n = Number(pct);
    if (!Number.isFinite(n)) return 'unknown';
    if (n <= FOOD_COST_THRESHOLDS.EXCELLENT_MAX) return 'excellent';
    if (n <= FOOD_COST_THRESHOLDS.TARGET_MAX) return 'target';
    if (n <= FOOD_COST_THRESHOLDS.WATCH_MAX) return 'watch';
    return 'alert';
}

/**
 * Devuelve el color hex estándar para un food cost %.
 * Paleta: verde oscuro / verde claro / naranja / rojo.
 */
export function foodCostColor(pct) {
    switch (classifyFoodCost(pct)) {
        case 'excellent': return '#059669';
        case 'target':    return '#10B981';
        case 'watch':     return '#F59E0B';
        case 'alert':     return '#EF4444';
        default:          return '#9CA3AF';
    }
}
