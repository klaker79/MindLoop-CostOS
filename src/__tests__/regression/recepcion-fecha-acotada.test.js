/**
 * @jest-environment node
 *
 * Guard de regresión — recibir un pedido PROGRAMADO (Iker, 2026-08-03).
 *
 * Error real: "Error recibiendo pedido: Fecha de recepción inválida: La fecha no
 * puede ser futura".
 *
 * Al permitir pedidos con fecha futura (pedir hoy para el viernes), la recepción
 * seguía heredando `ped.fecha` tal cual. Con un pedido del viernes, recibirlo hoy
 * mandaba una fecha de recepción futura y el backend la rechazaba
 * (`validators.js`, allowFuture:false) → pedido imposible de recibir.
 *
 * La recepción es el día en que la mercancía ENTRA. Si el pedido era para el
 * viernes y llega hoy, se recibe HOY. Si lo recibes el viernes, ese día su fecha
 * ya no es futura y se respeta.
 */
import { acotarAHoy } from '../../utils/fechas.js';

const enDias = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('fecha de recepción acotada a hoy', () => {
    test('un pedido programado para el viernes se recibe HOY', () => {
        expect(acotarAHoy(enDias(5))).toBe(enDias(0));
    });

    test('hoy se respeta', () => {
        expect(acotarAHoy(enDias(0))).toBe(enDias(0));
    });

    // Retroactivas: el albarán de un pedido viejo mantiene SU fecha, que es la
    // que debe llegar al Diario.
    test('una fecha pasada se respeta (albarán retroactivo)', () => {
        expect(acotarAHoy('2026-07-15')).toBe('2026-07-15');
    });

    // El backend devuelve ISO completo en `pedidos.fecha`.
    test('acepta el ISO completo que devuelve la API', () => {
        expect(acotarAHoy('2026-07-15T00:00:00.000Z')).toBe('2026-07-15');
    });

    test('un ISO futuro también se acota', () => {
        expect(acotarAHoy(`${enDias(10)}T00:00:00.000Z`)).toBe(enDias(0));
    });

    // Sin fecha o con basura: hoy, nunca undefined (antes el fallback era
    // `new Date().toISOString()`, un datetime completo).
    test.each([null, undefined, '', 'no-es-fecha', {}])('entrada inválida (%p) → hoy', (v) => {
        expect(acotarAHoy(v)).toBe(enDias(0));
    });

    test('devuelve YYYY-MM-DD, no un datetime', () => {
        expect(acotarAHoy(undefined)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
