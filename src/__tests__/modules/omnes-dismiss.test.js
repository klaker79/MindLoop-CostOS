/**
 * Descartes de avisos Omnes: persistencia tenant-scoped + caducidad 7 días.
 */
import { dismissAviso, isDismissed, filtrarVisibles, loadDismissed } from '@modules/inteligencia/omnes-dismiss.js';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ restauranteId: 3 }));
});

describe('omnes-dismiss', () => {
    test('descartar marca como descartado y filtra de la lista', () => {
        const now = 1_000_000_000;
        dismissAviso('receta-12', now);
        expect(isDismissed('receta-12', now)).toBe(true);
        expect(isDismissed('stock-5', now)).toBe(false);

        const avisos = [{ id: 'receta-12' }, { id: 'stock-5' }, { id: 'precio-9' }];
        const visibles = filtrarVisibles(avisos, now);
        expect(visibles.map(a => a.id)).toEqual(['stock-5', 'precio-9']);
    });

    test('el descarte caduca a los 7 días (reaparece)', () => {
        const t0 = 1_000_000_000;
        dismissAviso('stock-5', t0);
        expect(isDismissed('stock-5', t0 + 6 * DAY)).toBe(true);   // antes de 7 días sigue oculto
        expect(isDismissed('stock-5', t0 + 8 * DAY)).toBe(false);  // tras 7 días reaparece
    });

    test('aislamiento por tenant: un tenant no ve los descartes de otro', () => {
        const now = 1_000_000_000;
        dismissAviso('receta-12', now);                 // tenant 3
        localStorage.setItem('user', JSON.stringify({ restauranteId: 99 }));
        expect(isDismissed('receta-12', now)).toBe(false); // tenant 99 no lo tiene
    });

    test('loadDismissed purga los caducados del storage', () => {
        const t0 = 1_000_000_000;
        dismissAviso('a', t0);
        dismissAviso('b', t0 + 8 * DAY); // 'a' caduca respecto a este now
        const map = loadDismissed(t0 + 8 * DAY);
        expect(Object.keys(map)).toEqual(['b']);
    });
});
