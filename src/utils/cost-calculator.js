/**
 * Utility for calculating recipe and ingredient costs
 * Pure functions for "Anchored" logic testing
 */

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
