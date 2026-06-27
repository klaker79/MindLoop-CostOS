/**
 * Reparto del descuento/bonificación del albarán al COSTE (recepción de pedidos).
 *
 * Incidente La Nave 5 (2026-06-27): la cerveza EG se recibía a precio BRUTO de
 * tarifa (5,214 €/L) + el descuento como "ajuste" (que NO baja el coste) → food
 * cost inflado. calcularFactorAlbaran reparte el descuento entre las líneas para
 * que el coste registrado refleje lo que se paga de verdad.
 */
import { calcularFactorAlbaran } from '@modules/pedidos/formato-utils.js';

describe('calcularFactorAlbaran — reparte el descuento del albarán al coste', () => {
    test('GOLDEN cerveza EG: 20 L a 5,214 €/L bruto, total albarán 82,01 → 4,10 €/L', () => {
        const items = [{ cantidadRecibida: 20, precioReal: 5.214 }];
        const factor = calcularFactorAlbaran(items, 82.01);
        // base = 104,28 → factor = 82,01 / 104,28
        expect(factor).toBeCloseTo(82.01 / 104.28, 6);
        const precioNeto = 5.214 * factor;
        expect(precioNeto).toBeCloseTo(4.10, 2); // ≈ precio real (marzo: 4,14)
        // El coste cuadrado = exactamente el total del albarán
        expect(20 * precioNeto).toBeCloseTo(82.01, 6);
    });

    test('multilínea: el descuento se reparte proporcional y el coste total cuadra', () => {
        const items = [
            { cantidadRecibida: 20, precioReal: 5 },   // 100
            { cantidadRecibida: 10, precioReal: 10 },  // 100
        ]; // base = 200
        const factor = calcularFactorAlbaran(items, 150); // 25% descuento
        expect(factor).toBeCloseTo(0.75, 6);
        const total = items.reduce((s, it) => s + it.cantidadRecibida * (it.precioReal * factor), 0);
        expect(total).toBeCloseTo(150, 6);
    });

    test('sin descuento (total = suma de líneas) → factor 1, no cambia nada', () => {
        const items = [{ cantidadRecibida: 20, precioReal: 5.214 }];
        expect(calcularFactorAlbaran(items, 104.28)).toBeCloseTo(1, 6);
    });

    test('bordes: total 0, base 0 o items vacíos → factor 1 (no toca precios)', () => {
        expect(calcularFactorAlbaran([{ cantidadRecibida: 20, precioReal: 5 }], 0)).toBe(1);
        expect(calcularFactorAlbaran([{ cantidadRecibida: 0, precioReal: 0 }], 82)).toBe(1);
        expect(calcularFactorAlbaran([], 82)).toBe(1);
        expect(calcularFactorAlbaran(null, 82)).toBe(1);
    });
});
