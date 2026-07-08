import { computeBeneficioNetoDiario } from '../../modules/analisis/pnl-diario-calc.js';

/**
 * Protege el "Beneficio neto por día" del Diario. El invariante que se rompió el
 * 2026-07-08 (el TOTAL no cuadraba con la suma de las columnas porque el gasto
 * fijo total se calculaba por días de CALENDARIO en vez de por días mostrados)
 * queda fijado aquí: total === suma de las columnas, siempre.
 */
describe('computeBeneficioNetoDiario', () => {
    const dia = (over = {}) => ({
        dia: 1, ingresos: 0, costos: 0, merma: 0, comida: 0, extra: 0,
        cantidadVendida: 0, tieneActividad: true, ...over
    });

    test('beneficio neto del día = ingresos − costos − merma − comida − extra − gastoFijoDia', () => {
        const r = computeBeneficioNetoDiario(
            [dia({ ingresos: 500, costos: 100, merma: 10, comida: 20, extra: 30 })],
            100
        );
        // 500 − 100 − 10 − 20 − 30 − 100 = 240
        expect(r.barras[0].beneficio).toBe(240);
        expect(r.beneficioRealTotal).toBe(240);
    });

    test('⛔ INVARIANTE: el TOTAL es SIEMPRE la suma de las columnas diarias', () => {
        const dias = [
            dia({ dia: 1, ingresos: 500, costos: 100 }),
            dia({ dia: 2, ingresos: 800, costos: 200 }),
            dia({ dia: 3, ingresos: 300, costos: 50, extra: 40 }),
            dia({ dia: 4, ingresos: 0, costos: 0, tieneActividad: false }), // día cerrado
            dia({ dia: 5, ingresos: 0, costos: 0, tieneActividad: false })  // día cerrado
        ];
        const r = computeBeneficioNetoDiario(dias, 100);
        const sumaColumnas = r.barras.reduce((s, b) => s + b.beneficio, 0);
        expect(r.beneficioRealTotal).toBeCloseTo(sumaColumnas, 6);
    });

    test('el gasto fijo total = gastoFijoDia × nº de días MOSTRADOS (no de calendario)', () => {
        const dias = [
            dia({ dia: 1, ingresos: 600, costos: 100 }),
            dia({ dia: 2, ingresos: 600, costos: 100 }),
            dia({ dia: 3, ingresos: 600, costos: 100 }),
            dia({ dia: 4, ingresos: 600, costos: 100 })
        ]; // 4 días con datos, mes en curso (habría más días de calendario)
        const r = computeBeneficioNetoDiario(dias, 100);
        expect(r.totalGastosFijos).toBe(400);           // 100 × 4 días mostrados (NO × 30/31)
        // total = Σ columnas: cada día 600−100−100 = 400 → 4×400 = 1600
        expect(r.beneficioRealTotal).toBe(1600);
        expect(r.beneficioRealTotal).toBe(r.barras.reduce((s, b) => s + b.beneficio, 0));
    });

    test('días sin actividad: solo restan gasto fijo y suman a gastosPendientes', () => {
        const dias = [
            dia({ dia: 1, ingresos: 500, costos: 100 }),           // activo
            dia({ dia: 2, tieneActividad: false }),                 // cerrado
            dia({ dia: 3, tieneActividad: false })                  // cerrado
        ];
        const r = computeBeneficioNetoDiario(dias, 120);
        expect(r.diasConDatos).toBe(1);
        expect(r.diasSinActividad).toBe(2);
        expect(r.gastosPendientes).toBe(240);                       // 120 × 2
        expect(r.barras[1].beneficio).toBe(-120);                   // solo el gasto fijo
        expect(r.barras[1].activo).toBe(false);
    });

    test('caso realista tipo La Nave 5 (4 días de ventas): total = suma de columnas', () => {
        const g = 1303.44;
        const dias = [
            dia({ dia: 1, ingresos: 3884.70, costos: 1210.12 }),
            dia({ dia: 2, ingresos: 4114.20, costos: 1289.91 }),
            dia({ dia: 3, ingresos: 3966.80, costos: 1239.45, comida: 18.66 }),
            dia({ dia: 4, ingresos: 3917.70, costos: 1247.18, comida: 45.73 })
        ];
        const r = computeBeneficioNetoDiario(dias, g);
        const suma = r.barras.reduce((s, b) => s + b.beneficio, 0);
        expect(r.beneficioRealTotal).toBeCloseTo(suma, 6);          // cuadra con las columnas
        expect(r.totalGastosFijos).toBeCloseTo(g * 4, 6);           // 4 días mostrados
        expect(r.diasConDatos).toBe(4);
    });

    test('entrada vacía → todo a cero (sin romper)', () => {
        const r = computeBeneficioNetoDiario([], 100);
        expect(r.beneficioRealTotal).toBe(0);
        expect(r.totalGastosFijos).toBe(0);
        expect(r.barras).toEqual([]);
    });
});
