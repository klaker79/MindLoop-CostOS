/**
 * Helper de validación de desvío de precio en pedidos.
 *
 * Compara el subtotal calculado del item (cantidad × precio metido) con el
 * subtotal esperado según la config del ingrediente (cantidad × precio_unit_config).
 * Si la diferencia supera el umbral, devuelve un aviso descriptivo.
 *
 * Pensado para pillar errores como:
 *  - Camarero mete 60 huevos a 0,25 € (subtotal 15 €) cuando la unidad es
 *    "Docena" y el precio config es 3 €/Doc → esperado 180 €. Diff -91% → avisa.
 *  - Cambio de proveedor con precio muy distinto (Lotus 14,90 → 28,90 €) → avisa
 *    para que el usuario confirme la subida.
 *  - Cantidad metida en orden de magnitud incorrecto (3 cuando son 30) → avisa.
 *
 * No salta cuando el usuario usa el precio autocompletado (porque entonces
 * subtotal_metido == subtotal_esperado).
 */

const UMBRAL_DESVIO = 0.5; // ±50%

/**
 * @param {object} ing - Ingrediente: {precio, cantidad_por_formato, unidad, nombre}
 * @param {number} cantidad - Cantidad real en unidades base (ya multiplicada
 *   por formato si aplica; misma escala que la unidad del ingrediente).
 * @param {number} subtotalMetido - Lo que el usuario está pagando por la línea
 *   (cantidad × precio que ha tecleado, en su escala).
 * @returns {{warn:boolean, mensaje:string, subtotalEsperado:number, subtotalMetido:number, diffPct:number}|null}
 */
export function validarDesvioPrecio(ing, cantidad, subtotalMetido) {
    if (!ing) return null;
    const precioConfig = parseFloat(ing.precio) || 0;
    const cpf = parseFloat(ing.cantidad_por_formato) || 1;
    const cant = parseFloat(cantidad) || 0;
    const subM = parseFloat(subtotalMetido) || 0;

    if (precioConfig <= 0 || cant <= 0 || subM <= 0) return null;

    const precioConfigUnit = precioConfig / (cpf || 1);
    const subtotalEsperado = cant * precioConfigUnit;
    if (subtotalEsperado <= 0) return null;

    const diff = (subM - subtotalEsperado) / subtotalEsperado;
    if (Math.abs(diff) <= UMBRAL_DESVIO) return null;

    const diffPct = Math.round(diff * 100);
    const flecha = diff > 0 ? '↑' : '↓';
    const sentido = diff > 0 ? 'MÁS' : 'MENOS';
    const mensaje = `⚠️ Estás pagando ${sentido} de lo esperado: ${subM.toFixed(2)} € vs ${subtotalEsperado.toFixed(2)} € (${flecha}${Math.abs(diffPct)}%). Revisa cantidad y precio — ¿unidad correcta?`;

    return {
        warn: true,
        mensaje,
        subtotalEsperado,
        subtotalMetido: subM,
        diffPct
    };
}
