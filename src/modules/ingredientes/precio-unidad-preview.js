/**
 * Preview en vivo del precio por unidad base al configurar un ingrediente (puro,
 * sin dependencias pesadas → testeable).
 *
 * El `precio` de un ingrediente se guarda como €/FORMATO y TODA la app calcula el
 * precio unitario como `precio / cantidad_por_formato`. Si el usuario configura una
 * combinación incoherente (ej. unidad='unidad' + cantidad_por_formato=750 →
 * "1 bote = 750 unidades" → 0,004 €/unidad), el food cost queda absurdo. Este
 * helper devuelve qué precio por unidad usará la app y un nivel de aviso, para
 * mostrarlo mientras el usuario rellena el formulario y cazar el error al vuelo.
 */

// Unidad genérica "unidad" donde un cpf>1 casi siempre significa que la unidad
// base está mal (debería ser g/ml/kg/l): un bote de 750 g mal puesto como 750
// 'unidad'. NO se incluye 'botella' ni 'docena' porque "1 CAJA = 6 botella" es
// una config perfectamente válida (vino por caja) y avisar ahí es falso positivo.
const UNIDADES_DISCRETAS = ['unidad'];

/**
 * @param {{precio:any, cantidadPorFormato:any, formato:any, unidad:any}} input
 * @returns {{visible:boolean, precio?:number, cpf?:number, formato?:string,
 *   unidad?:string, unitPrice?:number, level?:'ok'|'falta_nombre'|'sospechoso'}}
 */
export function calcularPreviewPrecioUnidad({ precio, cantidadPorFormato, formato, unidad } = {}) {
    const p = parseFloat(precio) || 0;
    const cpfRaw = parseFloat(cantidadPorFormato);
    const cpf = cpfRaw > 1 ? cpfRaw : 1;
    const nombreFormato = String(formato || '').trim();
    const u = String(unidad || 'unidad');

    if (p <= 0) return { visible: false };

    const unitPrice = p / cpf;

    let level = 'ok';
    if (cpf > 1 && !nombreFormato) {
        level = 'falta_nombre';
    } else if (cpf > 1 && UNIDADES_DISCRETAS.includes(u)) {
        level = 'sospechoso';
    }

    return { visible: true, precio: p, cpf, formato: nombreFormato, unidad: u, unitPrice, level };
}
