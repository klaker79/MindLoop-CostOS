/**
 * Parser puro del Excel de ingredientes.
 *
 * Extraído de `src/legacy/inventario-masivo.js` el 2026-05-31 para hacerlo
 * testeable. Las dependencias antes leídas de `window.ingredientes` y
 * `window.proveedores` ahora se INYECTAN como parámetros.
 *
 * Reglas de negocio (cristalizadas tras la tanda de bugs 2026-05-29..31):
 *   - El import sólo CREA nuevos. Los existentes se saltan para no duplicar
 *     inventario (decisión Iker 2026-05-29).
 *   - EXCEPCIÓN caso B (2026-05-30): si el ingrediente ya existe SIN
 *     proveedor y el Excel SÍ trae uno emparejado, se actualiza SOLO el
 *     campo proveedor (no precio/stock). Resuelve el caso de huérfanos.
 *   - Columna "Proveedor" se empareja por nombre contra los proveedores del
 *     tenant (case-insensitive + trim). Si no casa, el ingrediente se
 *     importa SIN proveedor + aviso (no bloquea).
 *
 * @module utils/ingredientes-parser
 */

/**
 * Parsea las filas del Excel de ingredientes y las marca según deban
 * crearse, saltarse o actualizar-sólo-proveedor (caso B).
 *
 * @param {Object[]} data - filas del Excel (objetos clave/valor).
 * @param {Array} ingredientesArr - ingredientes existentes del tenant.
 * @param {Array} proveedoresArr - proveedores del tenant para resolver el nombre.
 * @returns {Object[]} array con flags `valido`, `yaExiste`, `dupEnArchivo`,
 *                     `actualizarProveedor`, `proveedorId`, `proveedorAviso`,
 *                     `existenteId`, etc.
 */
export function parseIngredientes(data, ingredientesArr = [], proveedoresArr = []) {
    if (!Array.isArray(data) || data.length === 0) return [];
    const existentesMap = new Map(
        ingredientesArr.map(i => [String(i.nombre || '').trim().toLowerCase(), i])
    );
    const vistosEnArchivo = new Set();
    const provMap = new Map(
        proveedoresArr.map(p => [String(p.nombre || '').trim().toLowerCase(), p])
    );

    return data.map(row => {
        const nombre = row['Nombre'] || row['nombre'] || row['NOMBRE'] || '';
        const precio = parseFloat(row['Precio'] || row['Precio (€)'] || row['precio'] || row['PRECIO'] || 0);
        const unidad = row['Unidad'] || row['unidad'] || row['UNIDAD'] || 'kg';
        const stockActual = parseFloat(
            row['Stock Actual'] || row['stock_actual'] || row['Stock'] || 0
        );
        const stockMinimo = parseFloat(
            row['Stock Mínimo'] || row['stock_minimo'] || row['Stock Minimo'] || 0
        );

        const proveedorNombreRaw = String(
            row['Proveedor'] || row['proveedor'] || row['PROVEEDOR'] || row['Supplier'] || ''
        ).trim();
        let proveedorId = null;
        let proveedorAviso = null;
        if (proveedorNombreRaw) {
            const match = provMap.get(proveedorNombreRaw.toLowerCase());
            if (match) proveedorId = match.id;
            else proveedorAviso = `Proveedor "${proveedorNombreRaw}" no existe`;
        }

        const nombreTrim = nombre.trim();
        const clave = nombreTrim.toLowerCase();
        const valido = nombreTrim.length > 0;
        let yaExiste = false;
        let dupEnArchivo = false;
        let existenteRef = null;
        if (valido) {
            existenteRef = existentesMap.get(clave) || null;
            yaExiste = !!existenteRef;
            dupEnArchivo = vistosEnArchivo.has(clave);
            vistosEnArchivo.add(clave);
        }
        // Caso B: existente sin proveedor + Excel con proveedor emparejado → UPDATE.
        const provExistente = existenteRef && (existenteRef.proveedor_id || existenteRef.proveedorId);
        const actualizarProveedor = yaExiste && !dupEnArchivo && !provExistente && !!proveedorId;
        return {
            nombre: nombreTrim,
            precio: isNaN(precio) ? 0 : precio,
            unidad: unidad,
            stockActual: isNaN(stockActual) ? 0 : stockActual,
            stockMinimo: isNaN(stockMinimo) ? 0 : stockMinimo,
            proveedorNombre: proveedorNombreRaw,
            proveedorId,
            proveedorAviso,
            valido: valido,
            yaExiste,
            dupEnArchivo,
            actualizarProveedor,
            existenteId: existenteRef ? existenteRef.id : null,
            error: valido ? null : 'Nombre requerido',
        };
    });
}
