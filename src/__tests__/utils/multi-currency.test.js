/**
 * multi-currency.test.js — formatCurrency / cm respetan moneda del tenant.
 *
 * Contrato crítico: cada tenant ve SU moneda. La Nave 5 (España) ve €,
 * Stefania KL (Malasia) ve RM. Un fix/feature nuevo que hardcodee "€" o
 * asuma moneda fija rompe la experiencia de los tenants Malasia y es un
 * bug que Iker ha pedido explícitamente prevenir (feedback_multicurrency_rm).
 *
 * Este test fija el contrato de formatCurrency y su alias cm():
 *   - Lee moneda de window.currentUser.moneda
 *   - €/fallback: "12,50€" (símbolo sufijo, coma decimal)
 *   - RM / $ / £: "RM 12.50" (símbolo prefijo, punto decimal)
 *   - Cambio de tenant recalcula al nuevo símbolo sin necesidad de reload.
 */
import { jest } from '@jest/globals';

let helpers;

beforeAll(async () => {
    jest.unstable_mockModule('../../utils/lazy-vendors.js', () => ({
        loadXLSX: jest.fn(),
    }));
    helpers = await import('../../utils/helpers.js');
});

function setTenantMoneda(moneda) {
    if (moneda === null) {
        delete window.currentUser;
        return;
    }
    window.currentUser = { restauranteId: 1, moneda };
}

describe('formatCurrency — multi-currency', () => {
    afterEach(() => {
        delete window.currentUser;
    });

    test('sin currentUser → fallback a € (sufijo, coma)', () => {
        setTenantMoneda(null);
        expect(helpers.formatCurrency(12.5)).toBe('12,50€');
    });

    test('moneda = "€" → "X,XX€" (sufijo, coma decimal)', () => {
        setTenantMoneda('€');
        expect(helpers.formatCurrency(12.5)).toBe('12,50€');
        expect(helpers.formatCurrency(0)).toBe('0,00€');
        expect(helpers.formatCurrency(1234.567)).toBe('1234,57€');
    });

    test('moneda = "RM" → "RM X.XX" (prefijo, punto decimal)', () => {
        setTenantMoneda('RM');
        expect(helpers.formatCurrency(12.5)).toBe('RM 12.50');
        expect(helpers.formatCurrency(0)).toBe('RM 0.00');
        expect(helpers.formatCurrency(87.3)).toBe('RM 87.30');
    });

    test('moneda = "$" → "$ X.XX"', () => {
        setTenantMoneda('$');
        expect(helpers.formatCurrency(100)).toBe('$ 100.00');
    });

    test('moneda = "£" → "£ X.XX"', () => {
        setTenantMoneda('£');
        expect(helpers.formatCurrency(50.5)).toBe('£ 50.50');
    });

    test('valor null/undefined/NaN → 0 en la moneda correcta', () => {
        setTenantMoneda('RM');
        expect(helpers.formatCurrency(null)).toBe('RM 0.00');
        expect(helpers.formatCurrency(undefined)).toBe('RM 0.00');
        expect(helpers.formatCurrency(NaN)).toBe('RM 0.00');
    });

    test('decimals custom respeta la moneda', () => {
        setTenantMoneda('RM');
        expect(helpers.formatCurrency(12.5, 0)).toBe('RM 13');
        expect(helpers.formatCurrency(12.56, 1)).toBe('RM 12.6');

        setTenantMoneda('€');
        expect(helpers.formatCurrency(12.56, 1)).toBe('12,6€');
    });

    test('cambio de tenant A (€) → tenant B (RM) reformatea sin reload', () => {
        setTenantMoneda('€');
        expect(helpers.formatCurrency(100)).toBe('100,00€');

        // Simular switchRestaurant: cambia currentUser a un tenant en Malasia
        setTenantMoneda('RM');
        expect(helpers.formatCurrency(100)).toBe('RM 100.00');

        // Y vuelta
        setTenantMoneda('€');
        expect(helpers.formatCurrency(100)).toBe('100,00€');
    });
});

describe('cm — alias de formatCurrency', () => {
    afterEach(() => {
        delete window.currentUser;
    });

    test('cm() y formatCurrency() dan el mismo resultado', () => {
        setTenantMoneda('RM');
        expect(helpers.cm(50)).toBe(helpers.formatCurrency(50));

        setTenantMoneda('€');
        expect(helpers.cm(50)).toBe(helpers.formatCurrency(50));
    });

    test('cm respeta decimals', () => {
        setTenantMoneda('€');
        expect(helpers.cm(12.345, 3)).toBe('12,345€');
    });
});
