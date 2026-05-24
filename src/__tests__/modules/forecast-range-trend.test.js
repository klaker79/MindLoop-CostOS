/**
 * Tests para las dos mejoras de forecast (sprint 2026-05-25):
 *   A) Horquilla de la prediccion total (banda ±σ × √N).
 *   B) Tendencia 4 semanas vs 4 anteriores con factor aplicable.
 *
 * Las funciones publicas a verificar son:
 *   - calcularHorquillaTotal(predicciones, ventasPorDia) → { min, max, sigmaDiario }
 *   - calcularTendencia4S(ventasPorDia) → { factor, porcentaje, direccion, aplicable }
 *
 * Ambas se exportan desde src/modules/analytics/forecast.js.
 */

import {
    calcularHorquillaTotal,
    calcularTendencia4S
} from '../../modules/analytics/forecast.js';

// Helper: construye un mapa fecha→total a partir de un array de pares.
function mapa(pares) {
    return Object.fromEntries(pares);
}

// Helper: ventasPorDia uniforme de N dias, valor V.
function ventasUniformes(dias, valor, inicioOffset = 0) {
    const out = {};
    const hoy = new Date();
    for (let i = 0; i < dias; i++) {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() - (i + inicioOffset));
        const k = d.toISOString().split('T')[0];
        out[k] = valor;
    }
    return out;
}

describe('forecast.calcularHorquillaTotal', () => {
    it('devuelve sigmaDiario=0 y min=max=suma si la serie es constante', () => {
        const ventasPorDia = ventasUniformes(30, 1000);
        const predicciones = [
            { prediccion: 1000 }, { prediccion: 1000 }, { prediccion: 1000 },
            { prediccion: 1000 }, { prediccion: 1000 }, { prediccion: 1000 },
            { prediccion: 1000 }
        ];

        const out = calcularHorquillaTotal(predicciones, ventasPorDia);

        expect(out.sigmaDiario).toBe(0);
        expect(out.min).toBe(7000);
        expect(out.max).toBe(7000);
    });

    it('genera horquilla simetrica alrededor del total cuando hay variabilidad', () => {
        // Construye serie con desviacion conocida: alternando 800/1200 → σ=200 (pop)
        const ventasPorDia = {};
        const hoy = new Date();
        for (let i = 0; i < 30; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            const k = d.toISOString().split('T')[0];
            ventasPorDia[k] = i % 2 === 0 ? 800 : 1200;
        }
        const predicciones = Array.from({ length: 7 }, () => ({ prediccion: 1000 }));

        const out = calcularHorquillaTotal(predicciones, ventasPorDia);

        expect(out.sigmaDiario).toBeGreaterThan(150);
        expect(out.sigmaDiario).toBeLessThan(250);
        // total=7000, banda ≈ σ × √7
        const total = 7000;
        expect(out.min).toBeLessThan(total);
        expect(out.max).toBeGreaterThan(total);
        // Simetria razonable (±5%)
        const ancho = (out.max - out.min) / 2;
        const distMin = total - out.min;
        expect(Math.abs(distMin - ancho)).toBeLessThan(1);
    });

    it('nunca devuelve min negativo (clamp a 0)', () => {
        // Variabilidad altisima con total pequeno → la banda se iria a negativo si no clampa.
        const ventasPorDia = mapa([
            ['2026-05-01', 0], ['2026-05-02', 4000], ['2026-05-03', 0],
            ['2026-05-04', 4000], ['2026-05-05', 0], ['2026-05-06', 4000],
            ['2026-05-07', 0], ['2026-05-08', 4000]
        ]);
        const predicciones = [{ prediccion: 100 }, { prediccion: 100 }];

        const out = calcularHorquillaTotal(predicciones, ventasPorDia);

        expect(out.min).toBeGreaterThanOrEqual(0);
        expect(out.max).toBeGreaterThan(out.min);
    });

    it('con menos de 7 dias de datos devuelve sigmaDiario=null (no fiable)', () => {
        const ventasPorDia = mapa([
            ['2026-05-20', 1000], ['2026-05-21', 1200], ['2026-05-22', 800]
        ]);
        const predicciones = [{ prediccion: 1000 }];

        const out = calcularHorquillaTotal(predicciones, ventasPorDia);

        expect(out.sigmaDiario).toBeNull();
        expect(out.min).toBeNull();
        expect(out.max).toBeNull();
    });

    it('predicciones vacias → todo a 0', () => {
        const ventasPorDia = ventasUniformes(30, 1000);
        const out = calcularHorquillaTotal([], ventasPorDia);
        expect(out.min).toBe(0);
        expect(out.max).toBe(0);
    });
});

describe('forecast.calcularTendencia4S', () => {
    it('marca aplicable=false con menos de 56 dias de datos', () => {
        const ventasPorDia = ventasUniformes(40, 1000);
        const out = calcularTendencia4S(ventasPorDia);
        expect(out.aplicable).toBe(false);
        expect(out.factor).toBe(1);
    });

    it('detecta tendencia plana (porcentaje pequeno → estable)', () => {
        const ventasPorDia = ventasUniformes(60, 1000);
        const out = calcularTendencia4S(ventasPorDia);
        expect(out.aplicable).toBe(true);
        expect(Math.abs(out.porcentaje)).toBeLessThanOrEqual(2);
        expect(out.direccion).toBe('estable');
        expect(out.factor).toBeCloseTo(1, 2);
    });

    it('detecta tendencia alcista cuando las ultimas 4 semanas suman mas', () => {
        // 4 semanas (dias 0-27): 1200/dia. 4 anteriores (dias 28-55): 1000/dia.
        // → +20%.
        const ventasPorDia = {};
        const hoy = new Date();
        for (let i = 0; i < 28; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            ventasPorDia[d.toISOString().split('T')[0]] = 1200;
        }
        for (let i = 28; i < 56; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            ventasPorDia[d.toISOString().split('T')[0]] = 1000;
        }

        const out = calcularTendencia4S(ventasPorDia);

        expect(out.aplicable).toBe(true);
        expect(out.direccion).toBe('up');
        expect(out.porcentaje).toBeGreaterThan(15);
        expect(out.porcentaje).toBeLessThan(25);
        expect(out.factor).toBeCloseTo(1.2, 1);
    });

    it('detecta tendencia bajista', () => {
        // Reciente 800, anterior 1000 → -20%
        const ventasPorDia = {};
        const hoy = new Date();
        for (let i = 0; i < 28; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            ventasPorDia[d.toISOString().split('T')[0]] = 800;
        }
        for (let i = 28; i < 56; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            ventasPorDia[d.toISOString().split('T')[0]] = 1000;
        }

        const out = calcularTendencia4S(ventasPorDia);

        expect(out.direccion).toBe('down');
        expect(out.porcentaje).toBeLessThan(-15);
    });

    it('si suma_anterior=0 devuelve no-aplicable (no dividir por 0)', () => {
        // Solo datos recientes.
        const ventasPorDia = ventasUniformes(28, 1000);
        const out = calcularTendencia4S(ventasPorDia);
        expect(out.aplicable).toBe(false);
        expect(out.factor).toBe(1);
    });

    it('cap del factor: subida >40% se trunca a 1.4 (defensivo contra outliers)', () => {
        const ventasPorDia = {};
        const hoy = new Date();
        for (let i = 0; i < 28; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            ventasPorDia[d.toISOString().split('T')[0]] = 5000; // ×5
        }
        for (let i = 28; i < 56; i++) {
            const d = new Date(hoy);
            d.setDate(hoy.getDate() - i);
            ventasPorDia[d.toISOString().split('T')[0]] = 1000;
        }

        const out = calcularTendencia4S(ventasPorDia);

        expect(out.factor).toBeLessThanOrEqual(1.4);
        expect(out.factor).toBeGreaterThan(1);
    });
});
