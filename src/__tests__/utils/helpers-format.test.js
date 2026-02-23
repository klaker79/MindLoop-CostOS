/**
 * helpers-format.test.js — P0
 * Tests for escapeHTML (XSS prevention) and safeNumber
 */
import { jest } from '@jest/globals';

let helpers;

beforeAll(async () => {
    jest.unstable_mockModule('../../utils/lazy-vendors.js', () => ({
        loadXLSX: jest.fn()
    }));
    helpers = await import('../../utils/helpers.js');
});

// ═══════════════════════════════════════════════
// escapeHTML — XSS prevention
// ═══════════════════════════════════════════════
describe('escapeHTML — XSS prevention', () => {
    test('escapes <script> tags', () => {
        const result = helpers.escapeHTML('<script>alert(1)</script>');
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
    });

    test('escapes event handler attributes', () => {
        const result = helpers.escapeHTML('<img onerror=alert(1)>');
        expect(result).not.toContain('<img');
    });

    test('normal text passes through unchanged', () => {
        expect(helpers.escapeHTML('Tomate fresco')).toBe('Tomate fresco');
    });

    test('null → empty string', () => {
        expect(helpers.escapeHTML(null)).toBe('');
    });

    test('undefined → empty string', () => {
        expect(helpers.escapeHTML(undefined)).toBe('');
    });

    test('number → stringified', () => {
        const result = helpers.escapeHTML(42);
        expect(result).toBe('42');
    });

    test('escapes ampersand', () => {
        expect(helpers.escapeHTML('A&B')).toContain('&amp;');
    });

    test('escapes angle brackets', () => {
        const result = helpers.escapeHTML('<div>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
    });

    test('empty string → empty string', () => {
        expect(helpers.escapeHTML('')).toBe('');
    });

    test('Spanish characters pass through', () => {
        expect(helpers.escapeHTML('Piña Ñoño')).toBe('Piña Ñoño');
    });
});

// ═══════════════════════════════════════════════
// safeNumber
// ═══════════════════════════════════════════════
describe('safeNumber', () => {
    test('valid string → parsed', () => {
        expect(helpers.safeNumber('12.5')).toBe(12.5);
    });

    test('number → returned as-is', () => {
        expect(helpers.safeNumber(42)).toBe(42);
    });

    test('NaN string → default 0', () => {
        expect(helpers.safeNumber('abc')).toBe(0);
    });

    test('null → default 0', () => {
        expect(helpers.safeNumber(null)).toBe(0);
    });

    test('undefined → default 0', () => {
        expect(helpers.safeNumber(undefined)).toBe(0);
    });

    test('custom default: ("bad", 99) → 99', () => {
        expect(helpers.safeNumber('bad', 99)).toBe(99);
    });

    test('"0" → 0 (not defaultValue)', () => {
        expect(helpers.safeNumber('0')).toBe(0);
    });

    test('negative string → negative number', () => {
        expect(helpers.safeNumber('-5.3')).toBeCloseTo(-5.3);
    });

    test('empty string → default (parseFloat("") = NaN)', () => {
        expect(helpers.safeNumber('')).toBe(0);
    });
});
