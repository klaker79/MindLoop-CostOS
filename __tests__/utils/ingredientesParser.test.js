/**
 * Tests del parser de Excel/CSV de ingredientes.
 *
 * Iker 2026-06-08: la plantilla original solo capturaba Nombre/Precio/Unidad/
 * Stock/Proveedor. Sin cantidad_por_formato, comprar por caja o garrafa con el
 * precio del formato inflaba el precio unitario × N — food cost mentiría.
 * Estos tests blindan que el parser lee TODOS los campos críticos.
 */

import { parseIngredientes } from '../../src/utils/ingredientes-parser.js';

describe('parseIngredientes — campos básicos (legacy)', () => {
    test('lee nombre, precio, unidad, stock', () => {
        const result = parseIngredientes([
            { Nombre: 'TOMATE', Precio: '2.30', Unidad: 'kg', 'Stock Actual': 5, 'Stock Mínimo': 2 }
        ], [], []);
        expect(result[0].nombre).toBe('TOMATE');
        expect(result[0].precio).toBeCloseTo(2.30);
        expect(result[0].unidad).toBe('kg');
        expect(result[0].stockActual).toBe(5);
        expect(result[0].stockMinimo).toBe(2);
    });

    test('sin nombre → inválido', () => {
        const result = parseIngredientes([
            { Nombre: '', Precio: 10 }
        ], [], []);
        expect(result[0].valido).toBe(false);
        expect(result[0].error).toBe('Nombre requerido');
    });
});

describe('parseIngredientes — formato de compra (cpf, formato, rendimiento)', () => {
    test('lee cantidad por formato (caja de cervezas)', () => {
        const result = parseIngredientes([
            { Nombre: 'CERVEZA', Precio: '30', Unidad: 'ud', 'Cantidad por formato': 24, Formato: 'caja' }
        ], [], []);
        expect(result[0].cantidadPorFormato).toBe(24);
        expect(result[0].formatoCompra).toBe('caja');
    });

    test('lee cantidad por formato decimal (garrafa 5L)', () => {
        const result = parseIngredientes([
            { Nombre: 'ACEITE', Precio: '36', Unidad: 'L', 'Cantidad por formato': '5', Formato: 'garrafa' }
        ], [], []);
        expect(result[0].cantidadPorFormato).toBe(5);
        expect(result[0].formatoCompra).toBe('garrafa');
    });

    test('sin formato → cantidadPorFormato y formatoCompra null', () => {
        const result = parseIngredientes([
            { Nombre: 'SAL', Precio: '1.40', Unidad: 'kg' }
        ], [], []);
        expect(result[0].cantidadPorFormato).toBeNull();
        expect(result[0].formatoCompra).toBeNull();
    });

    test('cantidad por formato 0 o negativa → null (defensivo)', () => {
        const result = parseIngredientes([
            { Nombre: 'X', Precio: '5', 'Cantidad por formato': 0 },
            { Nombre: 'Y', Precio: '5', 'Cantidad por formato': -3 }
        ], [], []);
        expect(result[0].cantidadPorFormato).toBeNull();
        expect(result[1].cantidadPorFormato).toBeNull();
    });

    test('rendimiento 80% (pulpo congelado)', () => {
        const result = parseIngredientes([
            { Nombre: 'PULPO', Precio: '18', Unidad: 'kg', 'Rendimiento (%)': 80 }
        ], [], []);
        expect(result[0].rendimiento).toBe(80);
    });

    test('rendimiento fuera de rango → null (defensivo)', () => {
        const r1 = parseIngredientes([{ Nombre: 'A', Precio: 1, 'Rendimiento (%)': 0 }], [], []);
        const r2 = parseIngredientes([{ Nombre: 'B', Precio: 1, 'Rendimiento (%)': 150 }], [], []);
        const r3 = parseIngredientes([{ Nombre: 'C', Precio: 1, 'Rendimiento (%)': -10 }], [], []);
        expect(r1[0].rendimiento).toBeNull();
        expect(r2[0].rendimiento).toBeNull();
        expect(r3[0].rendimiento).toBeNull();
    });
});

describe('parseIngredientes — familia/categoría', () => {
    test('familia alimentos por defecto si no viene en archivo', () => {
        const result = parseIngredientes([
            { Nombre: 'TOMATE', Precio: '2' }
        ], [], []);
        expect(result[0].familia).toBe('alimento');
    });

    test('familia "bebidas" se normaliza a "bebida"', () => {
        const result = parseIngredientes([
            { Nombre: 'VINO', Precio: '10', Familia: 'bebidas' }
        ], [], []);
        expect(result[0].familia).toBe('bebida');
    });

    test('familia "alimentos" → "alimento"', () => {
        const result = parseIngredientes([
            { Nombre: 'TOMATE', Precio: '2', Familia: 'alimentos' }
        ], [], []);
        expect(result[0].familia).toBe('alimento');
    });

    test('familia "suministros" → "suministro"', () => {
        const result = parseIngredientes([
            { Nombre: 'PAPEL HORNO', Precio: '5', Familia: 'suministros' }
        ], [], []);
        expect(result[0].familia).toBe('suministro');
    });

    test('familia inválida → fallback a "alimento"', () => {
        const result = parseIngredientes([
            { Nombre: 'X', Precio: '1', Familia: 'hierbas raras' }
        ], [], []);
        expect(result[0].familia).toBe('alimento');
    });
});

describe('parseIngredientes — flujo completo plantilla canónica', () => {
    test('row completo de la plantilla parseado bien (caso cerveza)', () => {
        const result = parseIngredientes([
            {
                Nombre: 'CERVEZA ESTRELLA',
                Precio: '30',
                Unidad: 'ud',
                'Cantidad por formato': 24,
                Formato: 'caja',
                'Rendimiento (%)': 100,
                'Stock Actual': 48,
                'Stock Mínimo': 12,
                Familia: 'bebidas',
                Proveedor: 'BODEGA RIBEIRO'
            }
        ], [], [{ id: 7, nombre: 'BODEGA RIBEIRO' }]);
        const ing = result[0];
        expect(ing.nombre).toBe('CERVEZA ESTRELLA');
        expect(ing.precio).toBe(30);
        expect(ing.unidad).toBe('ud');
        expect(ing.cantidadPorFormato).toBe(24);
        expect(ing.formatoCompra).toBe('caja');
        expect(ing.rendimiento).toBe(100);
        expect(ing.stockActual).toBe(48);
        expect(ing.stockMinimo).toBe(12);
        expect(ing.familia).toBe('bebida');
        expect(ing.proveedorId).toBe(7);
        expect(ing.valido).toBe(true);
    });
});
