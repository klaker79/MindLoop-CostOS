/**
 * Tests de blindaje de executeAction (dispatcher de acciones del chat).
 * Bug: un nombre vacío en el ACTION (ej "update|ingrediente||precio|5") hacía
 * que `'tomate'.includes('')` === true y se actualizaba el PRIMER ingrediente
 * por error. executeAction debe rechazar acciones sin nombre de entidad válido.
 *
 * logger.js arrastra config/constants.js (import.meta.env), no disponible en
 * Jest/Node — lo mockeamos como hace src/__tests__/api/api-client-real.test.js.
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../utils/logger.js', () => ({
    logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
    log: jest.fn(),
}));

const { executeAction } = await import('./chat-actions.js');

describe('executeAction — blindaje de entrada', () => {
    beforeEach(() => {
        window.ingredientes = [
            { id: 1, nombre: 'TOMATE', stock_actual: 10, precio: 2 },
            { id: 2, nombre: 'CEBOLLA', stock_actual: 5, precio: 1 },
        ];
        window.api = {
            updateIngrediente: jest.fn().mockResolvedValue({}),
            adjustStock: jest.fn().mockResolvedValue({}),
        };
        window.cargarDatos = jest.fn().mockResolvedValue();
        window.showToast = jest.fn();
    });

    test('nombre vacío NO actualiza el primer ingrediente y devuelve false', async () => {
        const ok = await executeAction('update|ingrediente||precio|5');
        expect(ok).toBe(false);
        expect(window.api.updateIngrediente).not.toHaveBeenCalled();
    });

    test('sin entidad devuelve false sin tocar la API', async () => {
        const ok = await executeAction('update');
        expect(ok).toBe(false);
        expect(window.api.updateIngrediente).not.toHaveBeenCalled();
        expect(window.api.adjustStock).not.toHaveBeenCalled();
    });

    test('acción válida con nombre sí actualiza (no rompemos el camino feliz)', async () => {
        const ok = await executeAction('update|ingrediente|TOMATE|precio|5');
        expect(ok).toBe(true);
        expect(window.api.updateIngrediente).toHaveBeenCalledWith(1, { precio: 5 });
    });
});
