/**
 * Utility for calculating recipe and ingredient costs
 * Pure functions for "Anchored" logic testing
 *
 * SINGLE SOURCE OF TRUTH for price priority across ALL modules:
 *   1. precio_medio_compra (real purchase average from albaranes)
 *   2. precio_medio (configured price / cantidad_por_formato)
 *   3. precio / cantidad_por_formato (raw fallback)
 */

/**
 * Returns the unit price for an ingredient using the unified priority.
 * This function MUST be used everywhere recipe/ingredient costs are calculated.
 *
 * Priority:
 *   1. invItem.precio_medio_compra — real average from precios_compra_diarios
 *   2. invItem.precio_medio — configured price / cantidad_por_formato
 *   3. ing.precio / ing.cantidad_por_formato — raw fallback
 *
 * @param {Object|null} invItem - Inventory item from inventarioCompleto (by ingredient id)
 * @param {Object|null} ing - Ingredient object from ingredientes
 * @returns {number} Unit price (always >= 0)
 */
export function getIngredientUnitPrice(invItem, ing) {
    if (invItem?.precio_medio_compra) {
        return parseFloat(invItem.precio_medio_compra);
    }
    if (invItem?.precio_medio) {
        return parseFloat(invItem.precio_medio);
    }
    if (ing?.precio) {
        const precioFormato = parseFloat(ing.precio);
        const cpf = parseFloat(ing.cantidad_por_formato) || 1;
        return precioFormato / cpf;
    }
    return 0;
}

/**
 * Calculates the real cost of an ingredient usage based on price, quantity and yield.
 * Formula: (Price / (Yield / 100)) * Quantity
 *
 * @param {number} price - Unit price of the ingredient
 * @param {number} quantity - Quantity used in the recipe
 * @param {number} yieldPercent - Yield percentage (0-100). Defaults to 100.
 * @returns {number} The calculated cost
 */
export function calculateIngredientCost(price, quantity, yieldPercent = 100) {
    const safeYield = yieldPercent <= 0 ? 100 : yieldPercent; // Avoid division by zero
    const factor = safeYield / 100;

    // Cost increases if yield is low (e.g. 50% yield = double cost)
    const costPerUnit = price / factor;

    return costPerUnit * quantity;
}

/**
 * Calculates the total cost of a list of recipe items
 * @param {Array} items - Array of { price, quantity, yield }
 * @returns {number} Total cost
 */
export function calculateBatchCost(items) {
    return items.reduce((total, item) => {
        return total + calculateIngredientCost(item.price || 0, item.quantity || 0, item.yield || 100);
    }, 0);
}
