/**
 * @jest-environment node
 *
 * Tests for the flexible inventory Excel parser.
 *
 * Cubre el caso real del Excel del camarero de La Nave 5:
 *   columnas: Zona / Clasificación / C. Copa / C. Botella / Referencia /
 *             Precio copa / Precio botella / Precio compra sin IVA /
 *             Precio compra con IVA / Proveedor / STOCK / Valor / extra
 */

import {
    normalize,
    isLegacyTemplate,
    detectColumns,
    parseFlexibleRows,
    buildCodeIndex,
    buildNameIndex,
    matchRow,
    convertToBaseUnit,
} from '../../modules/inventario/flexible-parser.js';

describe('normalize()', () => {
    test('quita tildes, baja a minúsculas y compacta espacios', () => {
        expect(normalize('Xión')).toBe('xion');
        expect(normalize('  Pazo de  Lusco  Albariño  ')).toBe('pazo de lusco albarino');
        expect(normalize(null)).toBe('');
        expect(normalize(undefined)).toBe('');
    });
});

describe('isLegacyTemplate()', () => {
    test('detecta cabecera de la plantilla nativa', () => {
        expect(isLegacyTemplate(['Ingrediente', 'Stock Real'])).toBe(true);
        expect(isLegacyTemplate(['Name', 'Stock Real'])).toBe(true);
        expect(isLegacyTemplate(['Stock Real', 'Ingrediente'])).toBe(true); // orden invertido
    });

    test('detecta Excel del cliente como NO legacy', () => {
        const headers = [
            'Zona', 'Clasificación', 'C. Copa', 'C. Botella', 'Referencia',
            'Precio copa', 'Precio botella', 'Proveedor', 'STOCK',
        ];
        expect(isLegacyTemplate(headers)).toBe(false);
    });
});

describe('detectColumns()', () => {
    test('mapea las columnas del Excel real del camarero', () => {
        const headers = [
            'Zona', 'Clasificación', 'C. Copa', 'C. Botella', 'Referencia',
            'Precio copa', 'Precio botella', 'Precio compra sin IVA',
            'Precio compra con IVA', 'Proveedor', 'STOCK',
        ];
        const cols = detectColumns(headers);
        expect(cols.code).toBe(3);    // C. Botella
        expect(cols.name).toBe(4);    // Referencia
        expect(cols.stock).toBe(10);  // STOCK
        expect(cols.format).toBe(null);
        expect(cols.ambiguous).toEqual([]);
    });

    test('detecta una columna Formato si existe', () => {
        const headers = ['Nombre', 'STOCK', 'Formato'];
        const cols = detectColumns(headers);
        expect(cols.name).toBe(0);
        expect(cols.stock).toBe(1);
        expect(cols.format).toBe(2);
    });

    test('reporta ambigüedad si falta el stock', () => {
        const cols = detectColumns(['Nombre', 'Proveedor']);
        expect(cols.stock).toBe(null);
        expect(cols.ambiguous).toContain('Sin columna de Stock');
    });

    test('reporta ambigüedad si no hay nombre ni código', () => {
        const cols = detectColumns(['Stock', 'Proveedor']);
        expect(cols.ambiguous).toContain('Sin columna de Nombre o Código TPV');
    });
});

describe('parseFlexibleRows()', () => {
    const cols = { name: 4, stock: 10, code: 3, format: null };

    test('parsea filas válidas y filtra las vacías', () => {
        const rows = [
            // header
            ['Zona', 'Clas', 'CC', 'C. Botella', 'Referencia', 'P', 'P', 'P', 'P', 'Prov', 'STOCK'],
            // Xión válida
            ['Rías Baixas', 'Dentro DO', '1271', '1272', 'Xión', 4, 22, 9.34, 11.30, 'Prima Vinia', 57],
            // fila vacía
            ['', '', '', '', '', '', '', '', '', '', ''],
            // Lusco con número como string "3,00" (Excel a veces así)
            ['', '', '518', '1088', 'Lusco', '', 24, 10.95, 13.25, '', '3,00'],
        ];
        const out = parseFlexibleRows(rows, cols);
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ name: 'Xión', codigo: '1272', stock: 57 });
        expect(out[1]).toMatchObject({ name: 'Lusco', codigo: '1088', stock: 3 });
    });

    test('filas sin nombre ni código se descartan', () => {
        const rows = [['n', 'c', 's'], [null, null, 5]];
        const out = parseFlexibleRows(rows, { name: 0, stock: 2, code: 1, format: null });
        expect(out).toHaveLength(0);
    });

    test('filas con stock no numérico se descartan', () => {
        const rows = [['n', 's'], ['Xión', 'No']];
        const out = parseFlexibleRows(rows, { name: 0, stock: 1, code: null, format: null });
        expect(out).toHaveLength(0);
    });
});

describe('buildCodeIndex()', () => {
    test('mapea código TPV → ingrediente_id (con y sin cero a la izquierda)', () => {
        const variantes = [
            { codigo: '01272', receta_id: 64 },
            { codigo: '00121', receta_id: 99 },
        ];
        const recetasById = new Map([
            [64, { ingredientes: [{ ingredienteId: 161, cantidad: 1 }] }],
            [99, { ingredientes: [{ ingredienteId: 200, cantidad: 1 }] }],
        ]);
        const idx = buildCodeIndex(variantes, recetasById);
        // Con cero a la izquierda
        expect(idx.get('01272')).toBe(161);
        // Sin cero (lo que suele tener el Excel del cliente)
        expect(idx.get('1272')).toBe(161);
        expect(idx.get('121')).toBe(200);
    });

    test('tolera receta sin ingredientes', () => {
        const variantes = [{ codigo: '0001', receta_id: 1 }];
        const recetasById = new Map([[1, { ingredientes: [] }]]);
        expect(buildCodeIndex(variantes, recetasById).size).toBe(0);
    });
});

describe('matchRow()', () => {
    const ingredientes = [
        { id: 161, nombre: 'Xión' },
        { id: 757, nombre: 'Pazo de Lusco Albariño 2024 75 cl c/6 bot' },
        { id: 619, nombre: 'ALMA AUTOR' },
    ];
    const ctx = {
        ingredientes,
        codeIndex: new Map([['1272', 161], ['01272', 161]]),
        nameIndex: buildNameIndex(ingredientes),
    };

    test('match por código TPV es prioritario', () => {
        const r = matchRow({ name: 'No-importa', codigo: '1272' }, ctx);
        expect(r.method).toBe('codigo_tpv');
        expect(r.ingrediente.id).toBe(161);
    });

    test('match por nombre exacto sin tildes', () => {
        const r = matchRow({ name: 'XION', codigo: null }, ctx);
        expect(r.method).toBe('nombre_exacto');
        expect(r.ingrediente.id).toBe(161);
    });

    test('match fuzzy: cliente "Lusco" ⊂ BBDD "Pazo de Lusco Albariño..."', () => {
        const r = matchRow({ name: 'Lusco', codigo: null }, ctx);
        expect(r.method).toBe('nombre_fuzzy');
        expect(r.ingrediente.id).toBe(757);
    });

    test('match por tokens: cliente "Alma de Autor" ↔ BBDD "ALMA AUTOR"', () => {
        const r = matchRow({ name: 'Alma de Autor', codigo: null }, ctx);
        expect(r.method).toBe('nombre_tokens');
        expect(r.ingrediente.id).toBe(619);
    });

    test('null si no hay match', () => {
        expect(matchRow({ name: 'NO EXISTE', codigo: null }, ctx)).toBeNull();
    });
});

describe('convertToBaseUnit()', () => {
    const ingredienteBarril = {
        id: 287, nombre: 'BARRIL 30L', unidad: 'l',
        formato_compra: 'BARRIL', cantidad_por_formato: 30,
    };
    const ingredienteCajaVino = {
        id: 757, nombre: 'Lusco', unidad: 'botella',
        formato_compra: 'CAJA', cantidad_por_formato: 6,
    };
    const ingredienteSinFormato = {
        id: 161, nombre: 'Xión', unidad: 'botella',
        formato_compra: null, cantidad_por_formato: 1,
    };

    test('multiplica cuando formato del Excel coincide con formato_compra', () => {
        // Camarero contó 0.5 barriles
        const r = convertToBaseUnit(0.5, 'BARRIL', ingredienteBarril);
        expect(r.applied).toBe(true);
        expect(r.factor).toBe(30);
        expect(r.stockBase).toBe(15);
    });

    test('caja insensible a mayúsculas', () => {
        const r = convertToBaseUnit(8, 'caja', ingredienteCajaVino);
        expect(r.applied).toBe(true);
        expect(r.stockBase).toBe(48); // 8 cajas × 6 botellas
    });

    test('si no hay formato en la fila, asume valor en unidad base', () => {
        const r = convertToBaseUnit(57, null, ingredienteSinFormato);
        expect(r.applied).toBe(false);
        expect(r.stockBase).toBe(57);
    });

    test('si formato del Excel NO coincide, asume valor en unidad base (no multiplica)', () => {
        const r = convertToBaseUnit(20, 'BIDON', ingredienteBarril);
        expect(r.applied).toBe(false);
        expect(r.stockBase).toBe(20);
    });

    test('NaN entra → NaN sale', () => {
        const r = convertToBaseUnit(NaN, 'BARRIL', ingredienteBarril);
        expect(Number.isNaN(r.stockBase)).toBe(true);
    });
});
