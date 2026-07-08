/**
 * Cálculo del Punto de Equilibrio (número de supervivencia).
 *
 * Verifica la fórmula con números comprobables a mano y los estados de
 * borde. El margen de contribución es PONDERADO por ventas reales, no un
 * promedio simple — este test lo blinda.
 */
import { computeBreakeven, DIAS_SERVICIO_MES_DEFAULT, esImpuesto, sumaGastosOperativos } from '@modules/analisis/breakeven-calc.js';

describe('computeBreakeven — fórmula ponderada', () => {
    // 2 platos:
    //   A: precio 10, food 40% → margen 6, vendidas 100
    //   B: precio 20, food 30% → margen 14, vendidas 300
    // unidades = 400
    // margen ponderado = (6*100 + 14*300) / 400 = (600+4200)/400 = 12
    // ticket medio    = (10*100 + 20*300) / 400 = (1000+6000)/400 = 17,5
    // food cost = COGS/ingresos: COGS = (4*100 + 6*300)=2200; ingresos=7000 → 31,43%
    //   (NO la media de % ponderada por unidades, que daría 32,5% — método erróneo)
    const platos = [
        { precio_venta: 10, foodCost: 40, margen: 6, popularidad: 100 },
        { precio_venta: 20, foodCost: 30, margen: 14, popularidad: 300 }
    ];

    test('margen/ticket ponderados por ventas + food cost = COGS/ingresos', () => {
        const s = computeBreakeven({ platos, gastosFijosMes: 12000 });
        expect(s.estado).toBe('ok');
        expect(s.margenPonderado).toBeCloseTo(12, 6);
        expect(s.ticketMedio).toBeCloseTo(17.5, 6);
        // COGS/ingresos = (7000-4800)/7000 = 2200/7000 = 31,4286%
        expect(s.foodCostMedio).toBeCloseTo(31.4286, 3);
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

describe('esImpuesto / sumaGastosOperativos — La Nave 5 real', () => {
    // Conceptos EXACTOS de gastos_fijos de La Nave 5 (restaurante_id=3), 2026-07-08.
    const gastosNave5 = [
        { concepto: 'Nóminas', monto_mensual: 14857.64 },
        { concepto: 'Seguridad Social', monto_mensual: 7113.48 },
        { concepto: 'IVA', monto_mensual: 4395.06 },
        { concepto: 'IAE', monto_mensual: 4333.34 },
        { concepto: 'Cuota préstamo', monto_mensual: 3809.00 },
        { concepto: 'Alquiler', monto_mensual: 3700.00 },
        { concepto: 'Comunidad', monto_mensual: 1755.60 },
        { concepto: 'Luz', monto_mensual: 1500.00 },
        { concepto: 'Seguro local', monto_mensual: 979.11 },
        { concepto: 'IRPF', monto_mensual: 843.71 },
        { concepto: 'Coche', monto_mensual: 714.40 },
        { concepto: 'Gas', monto_mensual: 600.00 },
        { concepto: 'Agua', monto_mensual: 560.00 },
        { concepto: 'Web/dominio', monto_mensual: 469.49 },
        { concepto: 'Comisión TPV', monto_mensual: 14.52 },
        { concepto: 'Gestoría', monto_mensual: 0 },
        { concepto: 'SGAE', monto_mensual: 0 },
        { concepto: 'Basura', monto_mensual: 0 },
        { concepto: 'Comisiones cuenta', monto_mensual: 0 },
        { concepto: 'Sociedades', monto_mensual: 0 }
    ];

    test('marca como impuesto SOLO IVA, IAE, IRPF, Sociedades', () => {
        expect(esImpuesto('IVA')).toBe(true);
        expect(esImpuesto('IAE')).toBe(true);
        expect(esImpuesto('IRPF')).toBe(true);
        expect(esImpuesto('Sociedades')).toBe(true);
        expect(esImpuesto('Impuesto de Sociedades')).toBe(true);
        expect(esImpuesto('IGIC')).toBe(true);
        expect(esImpuesto('IBI')).toBe(true);
    });

    test('NO marca como impuesto los gastos operativos legítimos', () => {
        ['Nóminas', 'Seguridad Social', 'Cuota préstamo', 'Alquiler', 'Comunidad',
         'Luz', 'Seguro local', 'Coche', 'Gas', 'Agua', 'Web/dominio', 'Comisión TPV',
         'Gestoría', 'SGAE', 'Basura', 'Comisiones cuenta'].forEach(c => {
            expect(esImpuesto(c)).toBe(false);
        });
    });

    test('suma operativa de La Nave 5 = 36.073,24€ (45.645,35 − 9.572,11 impuestos)', () => {
        expect(sumaGastosOperativos(gastosNave5)).toBeCloseTo(36073.24, 2);
    });

    test('con impuestos fuera, el punto de equilibrio es realista', () => {
        const operativos = sumaGastosOperativos(gastosNave5); // 36.073,24
        // margen ponderado ~11,25 y ticket ~16,17 (datos reales La Nave 5)
        const platos = [{ precio_venta: 16.17, foodCost: 29, margen: 11.25, popularidad: 1000 }];
        const s = computeBreakeven({ platos, gastosFijosMes: operativos });
        expect(s.breakevenPlatosMes).toBe(Math.ceil(36073.24 / 11.25)); // 3207
        // ventas/día claramente por debajo de la facturación real (~2000€/día servicio)
        expect(s.ventasEquilibrioDia).toBeLessThan(2100);
        expect(s.ventasEquilibrioDia).toBeGreaterThan(1800);
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
