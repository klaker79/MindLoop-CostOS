/**
 * Helper de validación de desvío de precio en pedidos.
 *
 * Detecta cuando el precio_unitario que el usuario está metiendo en un pedido
 * difiere mucho del precio configurado del ingrediente (precio / cpf), como
 * pista de que se ha confundido la unidad o el formato.
 *
 * No bloquea — devuelve un objeto descriptivo que la UI muestra como aviso.
 *
 * Casos cubiertos:
 *  - Camarero mete 60 huevos a 0,25 € cuando la unidad es "Docena" (debería
 *    haber metido 5 docenas a 3 €). El total cuadra (15 €) pero el precio
 *    unitario está 12× por debajo del configurado.
 *  - Subida de proveedor casi al doble (Lotus 14,90 → 28,90) — también dispara
 *    aviso, lo cual es lo deseado: que el usuario lo confirme.
 */

const UMBRAL_DESVIO = 0.5; // ±50%

/**
 * @param {object} ing - Ingrediente: {precio, cantidad_por_formato, unidad, nombre}
 * @param {number} precioMetidoPorFormato - Precio que el usuario está metiendo
 *   en el formulario. Ya viene "por formato" cuando el formato está activo
 *   (es decir, lo que el usuario teclea en "Precio unit." del modal: si elige
 *   "CAJA", es €/CAJA; si elige "unidad suelta", es €/unidad).
 * @param {boolean} usandoFormato - Si true, precioMetidoPorFormato está en
 *   €/FORMATO y hay que dividir por cpf antes de comparar con precio_unit_config.
 *   Si false, precioMetidoPorFormato ya está en €/unidad base.
 * @returns {{warn:boolean, mensaje:string, precioConfig:number, precioMetido:number, diffPct:number}|null}
 *   null si no hay desvío significativo o no hay datos suficientes.
 */
export function validarDesvioPrecio(ing, precioMetidoPorFormato, usandoFormato) {
    if (!ing) return null;
    const precioConfig = parseFloat(ing.precio) || 0;
    const cpf = parseFloat(ing.cantidad_por_formato) || 1;
    if (precioConfig <= 0) return null;

    const precioConfigUnit = precioConfig / (cpf || 1);
    const precioMetidoUnit = usandoFormato
        ? (precioMetidoPorFormato || 0) / (cpf || 1)
        : (precioMetidoPorFormato || 0);

    if (precioMetidoUnit <= 0) return null;

    const diff = (precioMetidoUnit - precioConfigUnit) / precioConfigUnit;
    if (Math.abs(diff) <= UMBRAL_DESVIO) return null;

    const diffPct = Math.round(diff * 100);
    const flecha = diff > 0 ? '↑' : '↓';
    const unidad = ing.unidad || 'ud';
    const mensaje = `⚠️ Precio fuera de rango: ${precioMetidoUnit.toFixed(2)} €/${unidad} vs ${precioConfigUnit.toFixed(2)} €/${unidad} configurado (${flecha}${Math.abs(diffPct)}%). ¿Has confundido la unidad o el formato?`;

    return {
        warn: true,
        mensaje,
        precioConfig: precioConfigUnit,
        precioMetido: precioMetidoUnit,
        diffPct
    };
}
