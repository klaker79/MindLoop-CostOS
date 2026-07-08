/**
 * Cálculo del Punto de Equilibrio (número de supervivencia).
 *
 * Verifica la fórmula con números comprobables a mano y los estados de
 * borde. El margen de contribución es PONDERADO por ventas reales, no un
 * promedio simple — este test lo blinda.
 */
import { computeBreakeven, DIAS_SERVICIO_MES_DEFAULT } from '@modules/analisis/breakeven-calc.js';

describe('computeBreakeven — fórmula ponderada', () => {
    // 2 platos:
    //   A: precio 10, food 40% → margen 6, vendidas 100
    //   B: precio 20, food 30% → margen 14, vendidas 300
    // unidades = 400
    // margen ponderado = (6*100 + 14*300) / 400 = (600+4200)/400 = 12
    // ticket medio    = (10*100 + 20*300) / 400 = (1000+6000)/400 = 17,5
    // food medio      = (40*100 + 30*300) / 400 = (4000+9000)/400 = 32,5
    const platos = [
        { precio_venta: 10, foodCost: 40, margen: 6, popularidad: 100 },
        { precio_venta: 20, foodCost: 30, margen: 14, popularidad: 300 }
    ];

    test('margen/ticket/food ponderados por ventas (no promedio simple)', () => {
        const s = computeBreakeven({ platos, gastosFijosMes: 12000 });
        expect(s.estado).toBe('ok');
        expect(s.margenPonderado).toBeCloseTo(12, 6);
        expect(s.ticketMedio).toBeCloseTo(17.5, 6);
        expect(s.foodCostMedio).toBeCloseTo(32.5, 6);
    });

    test('punto de equilibrio en platos = ceil(gastos / margen ponderado)', () => {
        const s = computeBreakeven({ platos, gastosFijosMes: 12000 });
        // 12000 / 12 = 1000 platos/mes
        expect(s.breakevenPlatosMes).toBe(1000);
        // ventas equilibrio mes = 1000 * 17,5 = 17.500
        expect(s.ventasEquilibrioMes).toBeCloseTo(17500, 6);
    });

    test('traducción diaria sobre los días de servicio', () => {
        const s = computeBreakeven({ platos, gastosFijosMes: 12000, diasServicio: 25 });
        expect(s.diasServicio).toBe(25);
        expect(s.ventasEquilibrioDia).toBeCloseTo(17500 / 25, 6); // 700 €/día
        expect(s.platosDia).toBe(Math.ceil(1000 / 25)); // 40
    });

    test('usa 26 días por defecto', () => {
        const s = computeBreakeven({ platos, gastosFijosMes: 12000 });
        expect(s.diasServicio).toBe(DIAS_SERVICIO_MES_DEFAULT);
        expect(DIAS_SERVICIO_MES_DEFAULT).toBe(26);
    });

    test('palancas: +1€ margen y −500€ gastos bajan el objetivo', () => {
        const s = computeBreakeven({ platos, gastosFijosMes: 12000 });
        // +1€ margen: 12000 / 13 = 923,07 → ceil 924
        expect(s.palancas.platosSiMargenMas1).toBe(Math.ceil(12000 / 13));
        expect(s.palancas.reduccionMargenMas1).toBe(1000 - Math.ceil(12000 / 13));
        // −500€: 11500 / 12 = 958,3 → ceil 959
        expect(s.palancas.platosSiGastosMenos500).toBe(Math.ceil(11500 / 12));
        // food −2pts: margen sube ticket*0.02 = 0,35 → 12,35; 12000/12,35 = 971,6 → 972
        expect(s.palancas.platosSiFood2).toBe(Math.ceil(12000 / (12 + 17.5 * 0.02)));
    });
});

describe('computeBreakeven — estados de borde', () => {
    const platos = [{ precio_venta: 10, foodCost: 40, margen: 6, popularidad: 100 }];

    test('sin gastos fijos → sin_gastos', () => {
        expect(computeBreakeven({ platos, gastosFijosMes: 0 }).estado).toBe('sin_gastos');
        expect(computeBreakeven({ platos, gastosFijosMes: -5 }).estado).toBe('sin_gastos');
    });

    test('sin ventas → sin_ventas', () => {
        expect(computeBreakeven({ platos: [], gastosFijosMes: 5000 }).estado).toBe('sin_ventas');
        const sinPop = [{ precio_venta: 10, foodCost: 40, margen: 6, popularidad: 0 }];
        expect(computeBreakeven({ platos: sinPop, gastosFijosMes: 5000 }).estado).toBe('sin_ventas');
    });

    test('margen medio ≤ 0 → sin_margen', () => {
        const perdida = [{ precio_venta: 10, foodCost: 120, margen: -2, popularidad: 50 }];
        const s = computeBreakeven({ platos: perdida, gastosFijosMes: 5000 });
        expect(s.estado).toBe('sin_margen');
        expect(s.margenPonderado).toBeLessThanOrEqual(0);
    });

    test('usa cantidad_vendida cuando no hay popularidad', () => {
        const platos = [
            { precio_venta: 20, foodCost: 30, margen: 14, cantidad_vendida: 300 },
            { precio_venta: 10, foodCost: 40, margen: 6, cantidad_vendida: 100 }
        ];
        const s = computeBreakeven({ platos, gastosFijosMes: 12000 });
        expect(s.estado).toBe('ok');
        expect(s.unidades).toBe(400);
        expect(s.margenPonderado).toBeCloseTo(12, 6);
    });

    test('robusto ante strings/NaN en los campos', () => {
        const sucio = [
            { precio_venta: '20', foodCost: '30', margen: '14', popularidad: '300' },
            { precio_venta: null, foodCost: undefined, margen: 'x', popularidad: 100 }
        ];
        const s = computeBreakeven({ platos: sucio, gastosFijosMes: '4000' });
        expect(s.estado).toBe('ok');
        expect(Number.isFinite(s.breakevenPlatosMes)).toBe(true);
    });
});
