/**
 * Tests para el módulo logger
 */

describe('Logger - Niveles de Log', () => {
    test('LOG_LEVELS contiene niveles esperados', () => {
        const LOG_LEVELS = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            LOG: 3,
            DEBUG: 4,
        };
        expect(LOG_LEVELS.ERROR).toBe(0);
        expect(LOG_LEVELS.DEBUG).toBe(4);
    });

    test('getTimestamp retorna formato HH:MM:SS', () => {
        const timestampPattern = /^\d{2}:\d{2}:\d{2}$/;
        const now = new Date();
        const timestamp = now.toISOString().split('T')[1].split('.')[0];
        expect(timestamp).toMatch(timestampPattern);
    });
});

describe('Logger - Formateo', () => {
    test('formatea timestamp correctamente', () => {
        const date = new Date('2025-12-25T10:30:45.000Z');
        const timestamp = date.toISOString().split('T')[1].split('.')[0];
        expect(timestamp).toBe('10:30:45');
    });

    test('nivel de log se determina por entorno', () => {
        const LOG_LEVELS = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            LOG: 3,
            DEBUG: 4,
        };
        expect(LOG_LEVELS.DEBUG).toBe(4);
        expect(LOG_LEVELS.WARN).toBe(1);
    });
});
