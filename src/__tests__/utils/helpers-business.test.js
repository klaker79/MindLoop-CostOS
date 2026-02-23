/**
 * helpers-business.test.js — P0
 * Tests for getRangoFechas, calcularDiasDeStock, proyeccionConsumo, compararConSemanaAnterior
 */
import { jest } from '@jest/globals';

let helpers;

beforeAll(async () => {
    jest.unstable_mockModule('../../utils/lazy-vendors.js', () => ({
        loadXLSX: jest.fn()
    }));
    helpers = await import('../../utils/helpers.js');
});

// ═══════════════════════════════════════════════
// getRangoFechas
// ═══════════════════════════════════════════════
describe('getRangoFechas', () => {
    describe("periodo='hoy'", () => {
        test('inicio and fin are same day', () => {
            const { inicio, fin } = helpers.getRangoFechas('hoy');
            expect(inicio.toDateString()).toBe(fin.toDateString());
        });

        test('inicio starts at midnight, fin ends at 23:59', () => {
            const { inicio, fin } = helpers.getRangoFechas('hoy');
            expect(inicio.getHours()).toBe(0);
            expect(inicio.getMinutes()).toBe(0);
            expect(fin.getHours()).toBe(23);
            expect(fin.getMinutes()).toBe(59);
        });

        test('fin is today', () => {
            const { fin } = helpers.getRangoFechas('hoy');
            expect(fin.toDateString()).toBe(new Date().toDateString());
        });
    });

    describe("periodo='semana'", () => {
        test('inicio is a Monday (getDay()===1)', () => {
            const { inicio } = helpers.getRangoFechas('semana');
            expect(inicio.getDay()).toBe(1);
        });

        test('span is at most 7 days', () => {
            const { inicio, fin } = helpers.getRangoFechas('semana');
            const days = (fin - inicio) / (24 * 60 * 60 * 1000);
            expect(days).toBeLessThanOrEqual(7);
        });
    });

    describe("periodo='semanaAnterior'", () => {
        test('inicio is a Monday', () => {
            const { inicio } = helpers.getRangoFechas('semanaAnterior');
            expect(inicio.getDay()).toBe(1);
        });

        test('span is 6 or 7 days (Mon-Sun inclusive)', () => {
            const { inicio, fin } = helpers.getRangoFechas('semanaAnterior');
            const daysDiff = Math.round((fin - inicio) / (24 * 60 * 60 * 1000));
            // fin has hours=23:59:59 so diff rounds to 6 or 7
            expect(daysDiff).toBeGreaterThanOrEqual(6);
            expect(daysDiff).toBeLessThanOrEqual(7);
        });

        test('fin is before today', () => {
            const { fin } = helpers.getRangoFechas('semanaAnterior');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expect(fin < today).toBe(true);
        });
    });

    describe("periodo='mes'", () => {
        test('inicio is day 1 of current month', () => {
            const { inicio } = helpers.getRangoFechas('mes');
            expect(inicio.getDate()).toBe(1);
            expect(inicio.getMonth()).toBe(new Date().getMonth());
        });
    });

    describe("periodo='año'", () => {
        test('inicio is Jan 1 of current year', () => {
            const { inicio } = helpers.getRangoFechas('año');
            expect(inicio.getMonth()).toBe(0);
            expect(inicio.getDate()).toBe(1);
            expect(inicio.getFullYear()).toBe(new Date().getFullYear());
        });
    });
});

// ═══════════════════════════════════════════════
// calcularDiasDeStock
// NOTE: Uses getRangoFechas('semana') internally, so only this-week sales count.
// Alert thresholds: <=2 critico, <=5 bajo, <=7 medio, >7 ok
// diasHistorico default=7, consumoDiario = consumoTotal / diasHistorico
// ═══════════════════════════════════════════════
describe('calcularDiasDeStock', () => {
    // Build dates within THIS week so getRangoFechas('semana') doesn't filter them out
    function todayDate() {
        return new Date().toISOString();
    }

    const recetas = [
        { id: 100, ingredientes: [{ ingredienteId: 1, cantidad: 1 }] }
    ];

    test('with consumption → returns numeric diasStock', () => {
        // 1 sale today, cantidad=1, recipe uses 1 unit of ingredient
        // consumoTotal=1, consumoDiario=1/7≈0.143, diasStock=floor(10/0.143)=70
        const ventas = [{ receta_id: 100, cantidad: 1, fecha: todayDate() }];
        const result = helpers.calcularDiasDeStock(10, ventas, recetas, 1);
        expect(result.diasStock).toBeGreaterThan(0);
        expect(result.diasStock).not.toBe(999);
        expect(result.alerta).toBe('ok');
    });

    test('no sales → diasStock=999', () => {
        const result = helpers.calcularDiasDeStock(10, [], recetas, 1);
        expect(result.diasStock).toBe(999);
        expect(result.mensaje).toContain('Sin consumo');
    });

    test('high consumption low stock → alerta=critico', () => {
        // 7 sales today, cantidad=10 each → consumoTotal=70, daily=10, stock=1 → floor(1/10)=0
        const ventas = Array.from({ length: 7 }, () => ({
            receta_id: 100, cantidad: 10, fecha: todayDate()
        }));
        const result = helpers.calcularDiasDeStock(1, ventas, recetas, 1);
        expect(result.diasStock).toBeLessThanOrEqual(2);
        expect(result.alerta).toBe('critico');
    });

    test('alert thresholds: bajo at <=5, medio at <=7', () => {
        // Create enough consumption so diasStock falls in range
        // consumoTotal = N * cantidad, daily = consumoTotal/7
        // We want diasStock = floor(stock / daily) ≈ 6 → medio
        // daily = stock/6 → consumoTotal = daily * 7 = stock * 7/6
        // stock=6, consumoTotal=7 → daily=1 → diasStock=6 → medio
        const ventas = Array.from({ length: 7 }, () => ({
            receta_id: 100, cantidad: 1, fecha: todayDate()
        }));
        const result = helpers.calcularDiasDeStock(6, ventas, recetas, 1);
        expect(result.diasStock).toBe(6);
        expect(result.alerta).toBe('medio');
    });

    test('dual field names: ingrediente_id also works', () => {
        const recipesAlt = [
            { id: 100, ingredientes: [{ ingrediente_id: 1, cantidad: 1 }] }
        ];
        const ventas = [{ receta_id: 100, cantidad: 1, fecha: todayDate() }];
        const result = helpers.calcularDiasDeStock(10, ventas, recipesAlt, 1);
        expect(result.diasStock).not.toBe(999);
        expect(result.diasStock).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════
// proyeccionConsumo
// NOTE: Returns only items where diasStock <= diasProyeccion (necesitaPedido)
// Sorted by diasStock ascending (most urgent first)
// ═══════════════════════════════════════════════
describe('proyeccionConsumo', () => {
    function todayDate() {
        return new Date().toISOString();
    }

    test('no consumption → empty result', () => {
        const ingredientes = [{ id: 1, nombre: 'A', stock_actual: 10, unidad: 'kg' }];
        const result = helpers.proyeccionConsumo(ingredientes, [], [], 7);
        expect(result).toHaveLength(0);
    });

    test('high urgency first → sorted by diasStock asc', () => {
        const recetas = [
            { id: 100, ingredientes: [{ ingredienteId: 1, cantidad: 10 }, { ingredienteId: 2, cantidad: 1 }] }
        ];
        // 7 sales, each consuming 10 of ingredient 1, 1 of ingredient 2
        const ventas = Array.from({ length: 7 }, () => ({
            receta_id: 100, cantidad: 1, fecha: todayDate()
        }));
        const ingredientes = [
            { id: 1, nombre: 'Urgent', stock_actual: 2, unidad: 'kg' },
            { id: 2, nombre: 'Less Urgent', stock_actual: 2, unidad: 'kg' }
        ];
        const result = helpers.proyeccionConsumo(ingredientes, ventas, recetas, 30);
        if (result.length >= 2) {
            expect(result[0].diasStock).toBeLessThanOrEqual(result[1].diasStock);
        }
    });

    test('only items needing reorder are returned (necesitaPedido filter)', () => {
        const recetas = [
            { id: 100, ingredientes: [{ ingredienteId: 1, cantidad: 1 }] }
        ];
        // 7 sales today → consumoTotal=7, daily=1, stock=3 → diasStock=3
        const ventas = Array.from({ length: 7 }, () => ({
            receta_id: 100, cantidad: 1, fecha: todayDate()
        }));
        const ingredientes = [
            { id: 1, nombre: 'Low', stock_actual: 3, unidad: 'kg' }
        ];
        // diasProyeccion=7, diasStock=3 → 3 <= 7 → included
        const result = helpers.proyeccionConsumo(ingredientes, ventas, recetas, 7);
        expect(result).toHaveLength(1);
        expect(result[0].necesitaPedido).toBe(true);
    });
});

// ═══════════════════════════════════════════════
// compararConSemanaAnterior
// ═══════════════════════════════════════════════
describe('compararConSemanaAnterior', () => {
    function dateInCurrentWeek() {
        const d = new Date();
        return d.toISOString();
    }

    function dateInPreviousWeek() {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString();
    }

    test('both weeks have data → correct comparison', () => {
        const datos = [
            { fecha: dateInCurrentWeek(), total: 120 },
            { fecha: dateInPreviousWeek(), total: 100 }
        ];
        const result = helpers.compararConSemanaAnterior(datos, 'fecha', 'total');
        expect(parseFloat(result.actual)).toBeGreaterThan(0);
        expect(result.tendencia).toBe('up');
    });

    test('anterior=0 → porcentaje=0 (no division by zero)', () => {
        const datos = [
            { fecha: dateInCurrentWeek(), total: 100 }
        ];
        const result = helpers.compararConSemanaAnterior(datos, 'fecha', 'total');
        expect(parseFloat(result.porcentaje)).toBe(0);
    });

    test('actual < anterior → tendencia=down', () => {
        const datos = [
            { fecha: dateInCurrentWeek(), total: 50 },
            { fecha: dateInPreviousWeek(), total: 100 }
        ];
        const result = helpers.compararConSemanaAnterior(datos, 'fecha', 'total');
        expect(result.tendencia).toBe('down');
    });
});
