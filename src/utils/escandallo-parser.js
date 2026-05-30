/**
 * Parser puro del Excel de escandallo de recetas.
 *
 * Extraído de `src/legacy/inventario-masivo.js` el 2026-05-31 para hacerlo
 * testeable. Las dependencias antes leídas de `window.ingredientes` y
 * `window.recetas` ahora se INYECTAN como parámetros — el parser no toca
 * window ni el DOM.
 *
 * Se usa desde el legacy a través de `window.__importParsers.*` (expuesto
 * en main.js) para respetar la regla legacy-no-esm.
 *
 * @module utils/escandallo-parser
 */

/**
 * Lee una celda probando varios nombres de columna (case-insensitive, trim).
 * Devuelve '' si ninguno coincide o está vacío.
 *
 * @param {Object} row - fila del Excel (objeto plano clave/valor).
 * @param {string[]} nombres - lista de nombres candidatos en orden de preferencia.
 * @returns {*} valor o ''.
 */
export function celdaReceta(row, nombres) {
    const keys = Object.keys(row);
    for (const n of nombres) {
        const target = String(n).trim().toLowerCase();
        for (const k of keys) {
            if (String(k).trim().toLowerCase() === target) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
        }
    }
    return '';
}

/**
 * Comportamiento histórico: una fila = una receta vacía (sólo cabecera).
 * Se usa cuando el Excel NO trae columna "Ingrediente".
 *
 * @param {Object[]} data - filas del Excel.
 * @returns {Object[]} array de recetas listas para `createReceta`.
 */
export function parseRecetasSoloCabecera(data) {
    return data.map(row => {
        const nombre = row['Nombre'] || row['nombre'] || row['NOMBRE'] || '';
        const categoria = row['Categoría'] || row['categoria'] || row['Categoria'] || 'principal';
        const precioVenta = parseFloat(
            row['Precio Venta'] || row['precio_venta'] || row['Precio'] || 0
        );
        const porciones = parseInt(row['Porciones'] || row['porciones'] || 1);

        const valido = nombre.trim().length > 0;
        return {
            nombre: nombre.trim(),
            categoria: categoria,
            precioVenta: isNaN(precioVenta) ? 0 : precioVenta,
            porciones: isNaN(porciones) || porciones < 1 ? 1 : porciones,
            ingredientes: [],
            sinEmparejar: [],
            valido: valido,
            error: valido ? null : 'Nombre requerido',
        };
    });
}

/**
 * Formato largo: varias filas por receta, cada una una línea del escandallo.
 *
 * Reglas:
 *  - Empareja "Ingrediente" por nombre (case-insensitive, trim) contra
 *    `ingredientesArr`; si no casa, intenta como SUBRECETA contra `recetasArr`
 *    (ingredienteId = 100000 + recetaId, convención de toda la app).
 *  - Auto-referencia bloqueada: una receta no puede ser subreceta de sí misma.
 *  - Rendimiento en blanco = hereda del ingrediente (no se fija en la línea).
 *  - Cabecera (categoría/precio/porciones/código TPV) puede ir SÓLO en la 1ª
 *    fila de cada receta — las posteriores se rellenan por forward-fill.
 *  - El nombre de receta debe ir en cada fila (o se arrastra del current).
 *  - Líneas sin emparejar se reportan en `sinEmparejar` (no bloquean si hay
 *    al menos una línea válida).
 *
 * @param {Object[]} data - filas del Excel.
 * @param {Array<{id:number, nombre:string}>} ingredientesArr - ingredientes del tenant.
 * @param {Array<{id:number, nombre:string}>} recetasArr - recetas del tenant (para subrecetas).
 * @returns {Object[]} array de recetas agrupadas con sus líneas.
 */
export function parseRecetasConEscandallo(data, ingredientesArr = [], recetasArr = []) {
    const ingMap = new Map(
        ingredientesArr.map(i => [String(i.nombre || '').trim().toLowerCase(), i])
    );
    const recMap = new Map(
        recetasArr.map(r => [String(r.nombre || '').trim().toLowerCase(), r])
    );
    const porNombre = new Map();
    const orden = [];
    let current = '';

    for (const row of data) {
        const recetaCell = String(celdaReceta(row, ['Receta', 'Nombre'])).trim();
        if (recetaCell) {
            current = recetaCell;
            if (!porNombre.has(current)) {
                porNombre.set(current, {
                    nombre: current,
                    categoria: String(celdaReceta(row, ['Categoría', 'Categoria'])).trim() || 'principal',
                    precioVenta: parseFloat(celdaReceta(row, ['Precio Venta', 'Precio (€)', 'Precio'])) || 0,
                    porciones: parseInt(celdaReceta(row, ['Porciones'])) || 1,
                    codigo: String(celdaReceta(row, ['Código TPV', 'Codigo TPV', 'Código', 'Codigo'])).trim() || null,
                    ingredientes: [],
                    sinEmparejar: [],
                    valido: true,
                    error: null,
                });
                orden.push(current);
            } else {
                // Rellenar cabecera si esta fila la trae y aún no estaba fijada
                const r = porNombre.get(current);
                const cat = String(celdaReceta(row, ['Categoría', 'Categoria'])).trim();
                const precio = parseFloat(celdaReceta(row, ['Precio Venta', 'Precio (€)', 'Precio']));
                const porc = parseInt(celdaReceta(row, ['Porciones']));
                const cod = String(celdaReceta(row, ['Código TPV', 'Codigo TPV', 'Código', 'Codigo'])).trim();
                if (cat && r.categoria === 'principal') r.categoria = cat;
                if (precio > 0 && !r.precioVenta) r.precioVenta = precio;
                if (porc > 1 && r.porciones === 1) r.porciones = porc;
                if (cod && !r.codigo) r.codigo = cod;
            }
        }
        if (!current) continue;
        const r = porNombre.get(current);
        const ingNombre = String(celdaReceta(row, ['Ingrediente'])).trim();
        if (!ingNombre) continue; // fila solo de cabecera, sin línea
        const cantidad = parseFloat(celdaReceta(row, ['Cantidad']));
        if (!(cantidad > 0)) { r.sinEmparejar.push(`${ingNombre} (cantidad inválida)`); continue; }
        const clave = ingNombre.toLowerCase();
        const ing = ingMap.get(clave);
        let linea;
        if (ing) {
            linea = { ingredienteId: ing.id, cantidad };
        } else {
            // ¿Es una subreceta? La reconocemos por nombre de receta, evitando que
            // una receta se incluya a sí misma como subreceta (auto-referencia).
            const sub = recMap.get(clave);
            if (sub && clave !== current.trim().toLowerCase()) {
                linea = { ingredienteId: 100000 + sub.id, cantidad };
            } else {
                r.sinEmparejar.push(ingNombre);
                continue;
            }
        }
        const rend = parseFloat(celdaReceta(row, ['Rendimiento', 'Rendimiento (%)']));
        if (rend > 0 && rend <= 100) linea.rendimiento = rend; // blanco = hereda del ingrediente
        r.ingredientes.push(linea);
    }

    const resultado = orden.map(n => porNombre.get(n));
    resultado.forEach(r => {
        if (!r.nombre) { r.valido = false; r.error = 'Nombre requerido'; }
        else if (r.ingredientes.length === 0) { r.valido = false; r.error = 'Sin líneas válidas emparejadas'; }
    });
    return resultado;
}

/**
 * Entry point: detecta el formato del Excel y elige el parser.
 * Si alguna fila tiene columna "Ingrediente" → formato escandallo.
 * Si no → comportamiento histórico (sólo cabeceras).
 *
 * @param {Object[]} data - filas del Excel.
 * @param {Array} ingredientesArr - ingredientes del tenant.
 * @param {Array} recetasArr - recetas del tenant (para subrecetas).
 * @returns {Object[]} array de recetas con sus líneas.
 */
export function parseRecetas(data, ingredientesArr = [], recetasArr = []) {
    if (!Array.isArray(data) || data.length === 0) return [];
    const tieneEscandallo = data.some(row =>
        Object.keys(row).some(k => String(k).trim().toLowerCase() === 'ingrediente')
    );
    return tieneEscandallo
        ? parseRecetasConEscandallo(data, ingredientesArr, recetasArr)
        : parseRecetasSoloCabecera(data);
}
