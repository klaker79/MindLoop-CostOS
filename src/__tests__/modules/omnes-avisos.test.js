/**
 * Lógica determinista de los avisos de Omnes (sin IA → sin errores).
 */
import { calcularSubidasPrecio, calcularStockCritico, UMBRALES } from '@modules/inteligencia/omnes-avisos.js';

describe('calcularSubidasPrecio', () => {
    const ingMap = new Map([
        [1, { id: 1, nombre: 'Aguacate', unidad: 'kg' }],
        [2, { id: 2, nombre: 'Tomate', unidad: 'kg' }],
    ]);
    // pedidos recibidos, más reciente primero por fecha
    const pedidos = [
        { estado: 'recibido', fecha: '2026-06-10', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.9 }, { ingredienteId: 2, precio_unitario: 2 }] },
        { estado: 'recibido', fecha: '2026-06-03', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.0 }, { ingredienteId: 2, precio_unitario: 2 }] },
    ];

    test('detecta subida >= umbral (aguacate +18%)', () => {
        const r = calcularSubidasPrecio(pedidos, ingMap);
        expect(r).toHaveLength(1);
        expect(r[0].nombre).toBe('Aguacate');
        expect(r[0].pct).toBeCloseTo(18, 0);
    });
    test('ignora sin cambio (tomate igual) y bajadas', () => {
        const r = calcularSubidasPrecio(pedidos, ingMap);
        expect(r.find(x => x.nombre === 'Tomate')).toBeUndefined();
    });
    test('subida por debajo del umbral no se incluye', () => {
        const peq = [
            { estado: 'recibido', fecha: '2026-06-10', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.1 }] },
            { estado: 'recibido', fecha: '2026-06-03', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.0 }] },
        ];
        expect(calcularSubidasPrecio(peq, ingMap, UMBRALES.subidaPrecioPct)).toHaveLength(0); // +2% < 8%
    });
    test('salta líneas de comida personal', () => {
        const conPersonal = [
            { estado: 'recibido', fecha: '2026-06-10', ingredientes: [{ ingredienteId: 1, precio_unitario: 50, personal: true }] },
            { estado: 'recibido', fecha: '2026-06-03', ingredientes: [{ ingredienteId: 1, precio_unitario: 5 }] },
        ];
        expect(calcularSubidasPrecio(conPersonal, ingMap)).toHaveLength(0);
    });
});

describe('calcularStockCritico', () => {
    test('stock 0 → crítico; <= mínimo → bajo; ok → fuera', () => {
        const ings = [
            { id: 1, nombre: 'Pimentón', stock_actual: 0, stock_minimo: 2, unidad: 'kg' },
            { id: 2, nombre: 'Ajo', stock_actual: 1, stock_minimo: 5, unidad: 'kg' },
            { id: 3, nombre: 'Sal', stock_actual: 50, stock_minimo: 5, unidad: 'kg' },
        ];
        const r = calcularStockCritico(ings);
        expect(r.map(x => x.nombre)).toEqual(['Pimentón', 'Ajo']); // Sal fuera; cero primero
        expect(r[0].cero).toBe(true);
        expect(r[1].cero).toBe(false);
    });
    test('ignora borrados/inactivos y sin stock numérico', () => {
        const ings = [
            { id: 1, nombre: 'X', stock_actual: 0, stock_minimo: 2, deleted_at: '2026-01-01' },
            { id: 2, nombre: 'Y', stock_actual: 0, stock_minimo: 2, activo: false },
            { id: 3, nombre: 'Z', stock_actual: null, stock_minimo: 2 },
        ];
        expect(calcularStockCritico(ings)).toEqual([]);
    });
});
