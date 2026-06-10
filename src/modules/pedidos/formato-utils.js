/**
 * Utilidades de FORMATO para pedidos (puro, sin dependencias pesadas → testeable).
 */

/**
 * Normaliza `precio_unitario`/`precio` de las líneas a €/UNIDAD-BASE.
 *
 * El precio tecleado para una compra por FORMATO es €/formato (ej. 3 €/bote de
 * 750 g), pero `cantidad` se guarda en unidad base (1500 g). Cualquier consumidor
 * que haga `cantidad_base × precio_unitario` (food cost vía precios_compra_diarios,
 * comida personal, editar, repetir…) inflaría ×multiplicador y corrompería el
 * precio medio (bug formato 2026-06-10: MERMELADA 750 g × 3 €/bote = 2250 €).
 *
 * SOLO se usa en los caminos DIRECTOS (compra mercado y pedido con comida personal)
 * que NO pasan por el carrito. El carrito ya normaliza por su cuenta (precio/cpf),
 * así que esas líneas NO deben volver a normalizarse. `multiplicador <= 1` (sin
 * formato) o líneas de ajuste se devuelven sin tocar → idempotente para cpf=1.
 *
 * @param {Array} lineas - líneas de ingredientesPedido (de pushLinea)
 * @returns {Array} líneas con precio_unitario/precio en €/unidad-base
 */
export function normalizarLineasABase(lineas) {
    return (lineas || []).map(l => {
        const mult = parseFloat(l.multiplicador) || 1;
        if (l.tipo === 'ajuste' || !(mult > 1)) return l;
        const precioBase = (parseFloat(l.precio_unitario) || 0) / mult;
        return { ...l, precio_unitario: precioBase, precio: precioBase };
    });
}
