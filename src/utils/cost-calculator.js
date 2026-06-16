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
    // OVERRIDE manual (precio_fijado): si el usuario fijó el precio, el coste usa el
    // precio manual (precio/cpf) e IGNORA la media de compras. Mismo criterio que el
    // backend (getBackendIngredientUnitPrice). Si el precio manual no es válido, cae
    // a la cascada normal. Flag false/ausente → comportamiento de siempre.
    const fijado = invItem?.precio_fijado ?? ing?.precio_fijado;
    if (fijado === true || fijado === 'true' || fijado === 't') {
        // Precio manual por unidad = precio/cpf. Si no hay precio crudo en el objeto,
        // usar precio_medio (inventarioCompleto ya lo expone como precio/cpf).
        const precioManual = parseFloat(ing?.precio ?? invItem?.precio);
        if (precioManual > 0) {
            const cpfManual = parseFloat(ing?.cantidad_por_formato ?? invItem?.cantidad_por_formato) || 1;
            return precioManual / cpfManual;
        }
        const pmManual = parseFloat(invItem?.precio_medio);
        if (pmManual > 0) return pmManual;
    }
    // 🔒 AUDITORÍA 2026-06-12 (M1): comparar con > 0 en vez de truthy, igual que
    // getBackendIngredientUnitPrice (businessHelpers.js). La API devuelve NUMERIC
    // como string: "0.0000" es truthy, así que el check anterior devolvía 0€ en
    // vez de caer al siguiente nivel de la cascada (el backend sí caía → FE y BE
    // podían dar precios distintos para el mismo ingrediente).
    const pmc = parseFloat(invItem?.precio_medio_compra);
    if (pmc > 0) return pmc;
    const pm = parseFloat(invItem?.precio_medio);
    if (pm > 0) return pm;
    const precioFormato = parseFloat(ing?.precio);
    if (precioFormato > 0) {
        const cpf = parseFloat(ing?.cantidad_por_formato) || 1;
        return precioFormato / cpf;
    }
    return 0;
}

/**
 * Returns the NOMINAL unit price for an ingredient, ignoring purchase averages.
 * Uses only the value configured by the user in the ingredient (precio / cpf).
 *
 * This is the "standard cost" of classic menu engineering: what the owner
 * declared as the expected price. It is stable and only changes when the
 * user edits the ingredient itself.
 *
 * Use it as a reference to compare against `getIngredientUnitPrice()` and
 * detect poisoned purchase data (OCR errors, orphan rows, outliers).
 *
 * @param {Object|null} ing - Ingredient object from ingredientes
 * @returns {number} Nominal unit price (always >= 0)
 */
export function getIngredientNominalPrice(ing) {
    if (!ing?.precio) return 0;
    const precioFormato = parseFloat(ing.precio);
    const cpf = parseFloat(ing.cantidad_por_formato) || 1;
    return precioFormato / cpf;
}

/**
 * Umbral por defecto de desviación de precio (±70%) para el guard de recepción.
 * Un dedazo típico es ×10 o /10 (muy por encima del 70%); una subida real de
 * proveedor suele quedar por debajo, así que no cría lobos.
 */
export const UMBRAL_DESVIACION_PRECIO = 0.70;

/**
 * Detecta si un precio tecleado se desvía demasiado del precio de referencia
 * del ingrediente — para avisar ANTES de que entre en la media de compras y la
 * distorsione. NO bloquea: solo informa para que el usuario confirme o corrija.
 *
 * @param {number} precioNuevo - Precio unitario tecleado en la recepción.
 * @param {number} precioRef - Precio de referencia (media de compras o configurado).
 * @param {number} umbral - Desviación relativa a partir de la cual avisar (default 0.70).
 * @returns {{sospechoso: boolean, pct: number}} pct = desviación con signo (%).
 */
export function precioDesviacionSospechosa(precioNuevo, precioRef, umbral = UMBRAL_DESVIACION_PRECIO) {
    const nuevo = parseFloat(precioNuevo);
    const ref = parseFloat(precioRef);
    if (!(nuevo > 0) || !(ref > 0)) return { sospechoso: false, pct: 0 };
    const desviacion = (nuevo - ref) / ref;
    return { sospechoso: Math.abs(desviacion) >= umbral, pct: Math.round(desviacion * 100) };
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
