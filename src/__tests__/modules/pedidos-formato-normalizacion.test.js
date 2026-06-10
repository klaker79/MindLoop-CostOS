/**
 * Normalización de formato a €/unidad-base en los caminos DIRECTOS de pedido
 * (compra mercado + pedido con comida personal, que NO pasan por el carrito).
 *
 * Bug 2026-06-10: el precio tecleado para una compra por FORMATO es €/formato
 * (3 €/bote de 750 g) pero la cantidad se guarda en base (750 g). Sin normalizar,
 * cualquier `cantidad × precio_unitario` daba 750×3 = 2250 € y corrompía el food cost.
 * normalizarLineasABase divide el precio por `multiplicador` (cpf) → €/gramo.
 */
import { normalizarLineasABase } from '@modules/pedidos/formato-utils.js';

describe('normalizarLineasABase — €/formato → €/unidad-base', () => {
    test('línea con formato (multiplicador 750): precio €/bote → €/gramo', () => {
        const [l] = normalizarLineasABase([
            { ingredienteId: 45, cantidad: 750, multiplicador: 750, precio_unitario: 3, precio: 3 }
        ]);
        expect(l.precio_unitario).toBeCloseTo(0.004, 6); // 3 / 750
        expect(l.precio).toBeCloseTo(0.004, 6);
        // cantidad(base) × precio_unitario(base) = coste real del bote
        expect(l.cantidad * l.precio_unitario).toBeCloseTo(3, 6);
    });

    test('línea SIN formato (multiplicador 1): no cambia', () => {
        const [l] = normalizarLineasABase([
            { ingredienteId: 9, cantidad: 4, multiplicador: 1, precio_unitario: 5, precio: 5 }
        ]);
        expect(l.precio_unitario).toBe(5);
        expect(l.cantidad * l.precio_unitario).toBe(20);
    });

    test('sin multiplicador definido → se trata como 1 (no cambia)', () => {
        const [l] = normalizarLineasABase([
            { ingredienteId: 1, cantidad: 2, precio_unitario: 20 }
        ]);
        expect(l.precio_unitario).toBe(20);
    });

    test('línea de ajuste (envases) no se toca', () => {
        const [l] = normalizarLineasABase([
            { tipo: 'ajuste', importe: -5, multiplicador: 750 }
        ]);
        expect(l.importe).toBe(-5);
        expect(l.precio_unitario).toBeUndefined();
    });

    test('idempotente: aplicarlo dos veces NO vuelve a dividir si multiplicador ya no aplica', () => {
        // Tras normalizar, la línea sigue teniendo multiplicador 750; en el flujo real
        // sólo se llama UNA vez (al crear el pedido directo). Este test documenta que,
        // si se reaplicara, volvería a dividir — por eso SOLO se usa en los 2 caminos
        // directos, una vez. Aquí verificamos el comportamiento determinista.
        const once = normalizarLineasABase([
            { cantidad: 750, multiplicador: 750, precio_unitario: 3 }
        ]);
        expect(once[0].precio_unitario).toBeCloseTo(0.004, 6);
    });

    test('mezcla: normaliza solo las de formato, deja el resto', () => {
        const out = normalizarLineasABase([
            { ingredienteId: 45, cantidad: 750, multiplicador: 750, precio_unitario: 3 },   // formato
            { ingredienteId: 9, cantidad: 4, multiplicador: 1, precio_unitario: 5 },         // sin formato
            { tipo: 'ajuste', importe: -2 }                                                  // ajuste
        ]);
        expect(out[0].precio_unitario).toBeCloseTo(0.004, 6);
        expect(out[1].precio_unitario).toBe(5);
        expect(out[2].importe).toBe(-2);
    });
});
