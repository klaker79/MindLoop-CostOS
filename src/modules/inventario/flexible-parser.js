/**
 * Flexible inventory parser & matcher.
 *
 * Permite que el cliente suba SU Excel propio con sus columnas naturales
 * (Zona / Clasificación / C. Botella / Referencia / STOCK / Formato …)
 * en lugar de obligarle a usar la plantilla de 2 columnas (Name + Stock Real).
 *
 * Composición:
 *   1. detectColumns(headers)   → identifica qué columna es Name, Stock,
 *                                  Código TPV y Formato basándose en el header.
 *   2. parseFlexibleExcel(rows) → normaliza cada fila a {name, stock, codigo, formato}.
 *   3. matchRow(row, ctx)       → busca el ingrediente al que apunta:
 *                                  prioridad 1 = código TPV vía variantes,
 *                                  prioridad 2 = nombre exacto normalizado,
 *                                  prioridad 3 = nombre fuzzy (substring).
 *   4. convertToBaseUnit(...)   → si la fila trae formato (BARRIL / CAJA) y coincide
 *                                  con el formato_compra del ingrediente, multiplica
 *                                  por cantidad_por_formato. Si no, asume que el
 *                                  valor ya está en unidad base.
 *
 * No toca el backend: el endpoint /inventory/consolidate sigue recibiendo
 * `[{id, stock_real}]` con stock en unidad base.
 *
 * Diseñado puro y sin side-effects para poder testearlo con jest sin DOM.
 */

const NAME_HEADER_PATTERNS = [
    /^name$/i,
    /^nombre$/i,
    /^ingrediente$/i,
    /^referencia$/i,
    /^reference$/i,
    /^descripci[oó]n$/i,
    /^description$/i,
    /^producto$/i,
    /^item$/i,
];

const STOCK_HEADER_PATTERNS = [
    /^stock$/i,
    /^stock\s*real$/i,
    /^current\s*stock$/i,
    /^cantidad$/i,
    /^qty$/i,
    /^unidades$/i,
    /^contado$/i,
    /^conteo$/i,
];

const CODE_HEADER_PATTERNS = [
    /^c\.?\s*botella$/i,
    /^codigo\s*botella$/i,
    /^c[oó]digo\s*tpv$/i,
    /^tpv$/i,
    /^code$/i,
    /^c[oó]digo$/i,
];

const FORMAT_HEADER_PATTERNS = [
    /^formato$/i,
    /^format$/i,
    /^unidad$/i,
    /^unit$/i,
];

/**
 * Normaliza un string: minúsculas, sin tildes, espacios condensados.
 */
export function normalize(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Devuelve true si la cabecera del Excel coincide con la plantilla nativa
 * (Ingrediente + Stock Real, en cualquier orden). Cuando es plantilla nativa
 * NO usamos el parser flexible — caemos al flujo legacy con matching exacto
 * por nombre, manteniendo 100% de compatibilidad hacia atrás.
 */
export function isLegacyTemplate(headers) {
    if (!Array.isArray(headers) || headers.length < 2) return false;
    const h0 = normalize(headers[0]);
    const h1 = normalize(headers[1]);
    const isName = h => h === 'ingrediente' || h === 'name' || h === 'nombre';
    const isStock = h => h === 'stock real' || h === 'stock';
    return (isName(h0) && isStock(h1)) || (isName(h1) && isStock(h0));
}

/**
 * Identifica qué índice de columna corresponde a cada campo.
 *
 * @param {string[]} headers - cabecera del Excel (fila 0)
 * @returns {{name:number|null, stock:number|null, code:number|null, format:number|null, ambiguous:string[]}}
 */
export function detectColumns(headers) {
    const result = { name: null, stock: null, code: null, format: null, ambiguous: [] };
    if (!Array.isArray(headers)) return result;

    const matchOne = (header, patterns) =>
        patterns.some(p => p.test(String(header || '').trim()));

    headers.forEach((h, i) => {
        if (matchOne(h, CODE_HEADER_PATTERNS) && result.code === null) {
            result.code = i;
        } else if (matchOne(h, STOCK_HEADER_PATTERNS) && result.stock === null) {
            result.stock = i;
        } else if (matchOne(h, NAME_HEADER_PATTERNS) && result.name === null) {
            result.name = i;
        } else if (matchOne(h, FORMAT_HEADER_PATTERNS) && result.format === null) {
            result.format = i;
        }
    });

    if (result.name === null && result.code === null) {
        result.ambiguous.push('Sin columna de Nombre o Código TPV');
    }
    if (result.stock === null) {
        result.ambiguous.push('Sin columna de Stock');
    }
    return result;
}

/**
 * Convierte cada fila bruta del Excel a una estructura normalizada.
 * Filtra filas vacías (sin nombre/código y sin stock).
 *
 * @param {Array<Array<any>>} rows - filas crudas (rows[0] = cabecera)
 * @param {ReturnType<typeof detectColumns>} cols
 * @returns {Array<{rowIndex:number, name:string, stock:number, codigo:string|null, formato:string|null}>}
 */
export function parseFlexibleRows(rows, cols) {
    const out = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const name = cols.name !== null ? String(r[cols.name] ?? '').trim() : '';
        const codigo = cols.code !== null ? String(r[cols.code] ?? '').trim() : '';
        const stockRaw = cols.stock !== null ? r[cols.stock] : null;
        const formato = cols.format !== null ? String(r[cols.format] ?? '').trim() : '';

        // Excel a veces envía números como string con coma → normalizar
        const stockStr = String(stockRaw ?? '').replace(',', '.').trim();
        const stock = stockStr === '' ? NaN : parseFloat(stockStr);

        if (!name && !codigo) continue;
        if (Number.isNaN(stock)) continue;

        out.push({
            rowIndex: i + 1, // 1-based para mensajes al usuario
            name,
            codigo: codigo || null,
            stock,
            formato: formato || null,
        });
    }
    return out;
}

/**
 * Construye un Map<codigoNormalizado, ingrediente_id> a partir de las
 * variantes del restaurante y sus recetas. Acepta códigos con o sin
 * cero a la izquierda (BBDD usa "01272", el cliente suele usar "1272").
 *
 * @param {Array<{codigo:string, receta_id:number}>} variantes
 * @param {Map<number, {ingredientes: Array<{ingredienteId?:number, ingrediente_id?:number}>}>} recetasById
 * @returns {Map<string, number>}
 */
export function buildCodeIndex(variantes, recetasById) {
    const idx = new Map();
    if (!Array.isArray(variantes)) return idx;
    for (const v of variantes) {
        if (!v.codigo) continue;
        const receta = recetasById.get(v.receta_id);
        if (!receta || !Array.isArray(receta.ingredientes) || receta.ingredientes.length === 0) continue;
        const first = receta.ingredientes[0];
        const ingId = first.ingredienteId ?? first.ingrediente_id ?? first.id;
        if (typeof ingId !== 'number') continue;

        const codeStr = String(v.codigo).trim();
        idx.set(codeStr, ingId);
        // Versión sin ceros a la izquierda
        const stripped = codeStr.replace(/^0+/, '');
        if (stripped && stripped !== codeStr) idx.set(stripped, ingId);
    }
    return idx;
}

/**
 * Construye un Map<nombreNormalizado, ingrediente> para búsqueda rápida
 * por nombre exacto (case-insensitive, sin tildes).
 */
export function buildNameIndex(ingredientes) {
    const idx = new Map();
    if (!Array.isArray(ingredientes)) return idx;
    for (const ing of ingredientes) {
        const k = normalize(ing.nombre);
        if (k && !idx.has(k)) idx.set(k, ing);
    }
    return idx;
}

/**
 * Busca el ingrediente al que apunta una fila usando 3 estrategias
 * en cascada. Devuelve `{ingrediente, method}` o `null` si no encuentra.
 *
 * @param {{name:string, codigo:string|null}} row
 * @param {{ingredientes:Array, codeIndex:Map<string,number>, nameIndex:Map<string,object>}} ctx
 */
export function matchRow(row, ctx) {
    // 1. Por código TPV
    if (row.codigo && ctx.codeIndex.size > 0) {
        const code = String(row.codigo).trim();
        const ingId = ctx.codeIndex.get(code) ?? ctx.codeIndex.get(code.replace(/^0+/, ''));
        if (ingId !== undefined) {
            const ing = ctx.ingredientes.find(i => i.id === ingId);
            if (ing) return { ingrediente: ing, method: 'codigo_tpv' };
        }
    }

    // 2. Por nombre exacto normalizado
    if (row.name) {
        const k = normalize(row.name);
        const exact = ctx.nameIndex.get(k);
        if (exact) return { ingrediente: exact, method: 'nombre_exacto' };

        // 3. Por inclusión (referencia corta del cliente ⊂ nombre largo BBDD,
        //    o BBDD ⊂ cliente). Solo si la coincidencia es inequívoca:
        //    una sola entrada cuyo nombre normalizado contiene/está contenido.
        const incluyentes = [];
        for (const [bbddNorm, ing] of ctx.nameIndex) {
            if (bbddNorm.includes(k) || k.includes(bbddNorm)) incluyentes.push(ing);
        }
        if (incluyentes.length === 1) {
            return { ingrediente: incluyentes[0], method: 'nombre_fuzzy' };
        }

        // 4. Token-overlap: cuando los tokens significativos de uno son todos
        //    subset del otro (insensible al orden y a stopwords como "de la").
        //    Cubre casos como "Alma de Autor" ↔ "ALMA AUTOR".
        const tokenMatches = matchByTokens(k, ctx.nameIndex);
        if (tokenMatches.length === 1) {
            return { ingrediente: tokenMatches[0], method: 'nombre_tokens' };
        }
    }

    return null;
}

const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'da', 'do', 'di', 'du', 'al', 'a']);

function significantTokens(s) {
    return String(s).split(/\s+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Devuelve los ingredientes cuyos tokens significativos son superset/subset
 * de los del nombre dado. Útil cuando "Alma de Autor" ↔ "ALMA AUTOR".
 *
 * Conservador: requiere al menos 2 tokens compartidos para evitar falsos
 * positivos del estilo "Vino Tinto X" ↔ "Vino Tinto Y".
 */
function matchByTokens(nameNorm, nameIndex) {
    const ta = significantTokens(nameNorm);
    if (ta.length < 2) return [];
    const out = [];
    for (const [bbddNorm, ing] of nameIndex) {
        const tb = significantTokens(bbddNorm);
        if (tb.length < 2) continue;
        const aInB = ta.every(t => tb.includes(t));
        const bInA = tb.every(t => ta.includes(t));
        if (aInB || bInA) out.push(ing);
    }
    return out;
}

/**
 * Convierte el stock contado a la unidad base del ingrediente.
 *
 * Si la fila trae `formato` y coincide (case-insensitive) con
 * `ingrediente.formato_compra`, multiplica `stock × cantidad_por_formato`.
 * Si NO trae formato (o no coincide) asume que el valor ya está en
 * unidad base — comportamiento idéntico al modal actual, retro-compatible.
 *
 * @returns {{stockBase:number, applied:boolean, factor:number}}
 */
export function convertToBaseUnit(stock, rowFormato, ingrediente) {
    if (!Number.isFinite(stock)) return { stockBase: NaN, applied: false, factor: 1 };
    if (!rowFormato || !ingrediente) {
        return { stockBase: stock, applied: false, factor: 1 };
    }
    const ingFormato = ingrediente.formato_compra
        ? String(ingrediente.formato_compra).toLowerCase().trim()
        : null;
    const rowFmt = String(rowFormato).toLowerCase().trim();
    const cpf = parseFloat(ingrediente.cantidad_por_formato);
    if (ingFormato && rowFmt === ingFormato && Number.isFinite(cpf) && cpf > 1) {
        return { stockBase: stock * cpf, applied: true, factor: cpf };
    }
    return { stockBase: stock, applied: false, factor: 1 };
}
