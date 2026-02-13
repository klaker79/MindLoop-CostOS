/**
 * @jest-environment node
 * 
 * Real Module Import Tests: validation.js
 * ========================================
 * Tests that ACTUALLY IMPORT the validation module from src/utils/validation.js
 * Unlike the existing tests, these verify the real code, not inline copies.
 */

import {
    isRequired,
    isNumber,
    isPositive,
    isNonNegative,
    hasLength,
    isEmail,
    isPhone,
    validateIngrediente,
    validateReceta,
    validatePedido,
    validateProveedor
} from '../../utils/validation.js';

// ─── Helper Validators ────────────────────────────────────────────

describe('validation.js — Helper Validators (real import)', () => {

    describe('isRequired', () => {
        test('accepts non-empty string', () => {
            const result = isRequired('Tomate');
            expect(result.valid).toBe(true);
        });

        test('rejects empty string', () => {
            const result = isRequired('');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('obligatorio');
        });

        test('rejects null', () => {
            expect(isRequired(null).valid).toBe(false);
        });

        test('rejects undefined', () => {
            expect(isRequired(undefined).valid).toBe(false);
        });

        test('rejects whitespace-only string', () => {
            expect(isRequired('   ').valid).toBe(false);
        });

        test('includes field name in error', () => {
            const result = isRequired('', 'Nombre');
            expect(result.error).toContain('Nombre');
        });
    });

    describe('isNumber', () => {
        test('accepts valid number', () => {
            const result = isNumber(10);
            expect(result.valid).toBe(true);
            expect(result.value).toBe(10);
        });

        test('accepts string number', () => {
            const result = isNumber('10.5');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(10.5);
        });

        test('rejects NaN', () => {
            expect(isNumber('abc').valid).toBe(false);
        });

        test('enforces min', () => {
            expect(isNumber(5, { min: 10 }).valid).toBe(false);
        });

        test('enforces max', () => {
            expect(isNumber(100, { max: 50 }).valid).toBe(false);
        });

        test('accepts value within range', () => {
            expect(isNumber(25, { min: 10, max: 50 }).valid).toBe(true);
        });
    });

    describe('isPositive', () => {
        test('accepts positive number', () => {
            expect(isPositive(5).valid).toBe(true);
        });

        test('rejects zero', () => {
            expect(isPositive(0).valid).toBe(false);
        });

        test('rejects negative', () => {
            expect(isPositive(-1).valid).toBe(false);
        });
    });

    describe('isNonNegative', () => {
        test('accepts zero', () => {
            expect(isNonNegative(0).valid).toBe(true);
        });

        test('accepts positive', () => {
            expect(isNonNegative(10).valid).toBe(true);
        });

        test('rejects negative', () => {
            expect(isNonNegative(-1).valid).toBe(false);
        });
    });

    describe('hasLength', () => {
        test('accepts string within limits', () => {
            expect(hasLength('Hola', { min: 1, max: 10 }).valid).toBe(true);
        });

        test('rejects too short', () => {
            expect(hasLength('Hi', { min: 5 }).valid).toBe(false);
        });

        test('rejects too long', () => {
            expect(hasLength('Hello World', { max: 5 }).valid).toBe(false);
        });
    });

    describe('isEmail', () => {
        test('accepts valid email', () => {
            expect(isEmail('test@example.com').valid).toBe(true);
        });

        test('rejects invalid email', () => {
            expect(isEmail('not-an-email').valid).toBe(false);
        });

        test('accepts empty (email is optional)', () => {
            // Empty email is valid — the field itself is optional in suppliers
            expect(isEmail('').valid).toBe(true);
        });
    });

    describe('isPhone', () => {
        test('accepts Spanish mobile', () => {
            expect(isPhone('612345678').valid).toBe(true);
        });

        test('accepts with spaces', () => {
            expect(isPhone('612 345 678').valid).toBe(true);
        });

        test('rejects too short', () => {
            expect(isPhone('12345').valid).toBe(false);
        });
    });
});

// ─── Business Validators ──────────────────────────────────────────

describe('validation.js — validateIngrediente (real import)', () => {

    test('valid ingredient passes', () => {
        const result = validateIngrediente({
            nombre: 'Tomate',
            unidad: 'kg',
            precio: 2.50,
            familia: 'alimento'
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitized).toBeDefined();
        expect(result.sanitized.nombre).toBe('Tomate');
    });

    test('empty name fails', () => {
        const result = validateIngrediente({
            nombre: '',
            unidad: 'kg',
            precio: 2.50
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('missing unit fails', () => {
        const result = validateIngrediente({
            nombre: 'Tomate',
            unidad: '',
            precio: 2.50
        });
        expect(result.valid).toBe(false);
    });

    test('negative price fails', () => {
        const result = validateIngrediente({
            nombre: 'Tomate',
            unidad: 'kg',
            precio: -5
        });
        expect(result.valid).toBe(false);
    });

    test('zero price is accepted (free items exist)', () => {
        const result = validateIngrediente({
            nombre: 'Agua del grifo',
            unidad: 'l',
            precio: 0,
            familia: 'alimento'
        });
        expect(result.valid).toBe(true);
    });

    test('invalid family is rejected', () => {
        const result = validateIngrediente({
            nombre: 'Tomate',
            unidad: 'kg',
            precio: 2.50,
            familia: 'invalid_familia'
        });
        expect(result.valid).toBe(false);
    });

    test('negative stock fails', () => {
        const result = validateIngrediente({
            nombre: 'Tomate',
            unidad: 'kg',
            precio: 2.50,
            familia: 'alimento',
            stock_actual: -10
        });
        expect(result.valid).toBe(false);
    });

    test('cantidad_por_formato must be positive if provided', () => {
        const result = validateIngrediente({
            nombre: 'Cerveza Barril',
            unidad: 'l',
            precio: 50,
            familia: 'bebida',
            cantidad_por_formato: 0
        });
        expect(result.valid).toBe(false);
    });

    test('sanitized data is clean', () => {
        const result = validateIngrediente({
            nombre: '  Tomate  ',
            unidad: 'kg',
            precio: '2.50',
            familia: 'alimento'
        });
        expect(result.valid).toBe(true);
        // Sanitized should have trimmed name
        expect(result.sanitized.nombre).not.toMatch(/^\s/);
    });
});

describe('validation.js — validateReceta (real import)', () => {

    test('valid recipe passes', () => {
        const result = validateReceta({
            nombre: 'Paella Valenciana',
            precio_venta: 15.50,
            ingredientes: [
                { ingredienteId: 1, cantidad: 0.5 },
                { ingredienteId: 2, cantidad: 0.3 }
            ],
            categoria: 'principales'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeDefined();
    });

    test('empty name fails', () => {
        const result = validateReceta({
            nombre: '',
            precio_venta: 10,
            ingredientes: [{ ingredienteId: 1, cantidad: 0.5 }]
        });
        expect(result.valid).toBe(false);
    });

    test('zero price fails', () => {
        const result = validateReceta({
            nombre: 'Paella',
            precio_venta: 0,
            ingredientes: [{ ingredienteId: 1, cantidad: 0.5 }]
        });
        expect(result.valid).toBe(false);
    });

    test('empty ingredients array fails', () => {
        const result = validateReceta({
            nombre: 'Paella',
            precio_venta: 15,
            ingredientes: []
        });
        expect(result.valid).toBe(false);
    });

    test('ingredient with zero quantity fails', () => {
        const result = validateReceta({
            nombre: 'Paella',
            precio_venta: 15,
            ingredientes: [{ ingredienteId: 1, cantidad: 0 }]
        });
        expect(result.valid).toBe(false);
    });

    test('porciones must be > 0 (division by zero guard)', () => {
        const result = validateReceta({
            nombre: 'Paella',
            precio_venta: 15,
            ingredientes: [{ ingredienteId: 1, cantidad: 0.5 }],
            porciones: 0
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.toLowerCase().includes('porcion'))).toBe(true);
    });

    test('porciones = 4 passes and is sanitized', () => {
        const result = validateReceta({
            nombre: 'Paella',
            precio_venta: 15,
            ingredientes: [{ ingredienteId: 1, cantidad: 0.5 }],
            porciones: 4
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized.porciones).toBe(4);
    });
});

describe('validation.js — validatePedido (real import)', () => {

    test('valid order passes', () => {
        const result = validatePedido({
            proveedorId: 1,
            ingredientes: [
                { ingredienteId: 1, cantidad: 10, precio: 2.50 }
            ]
        });
        expect(result.valid).toBe(true);
    });

    test('missing supplier fails', () => {
        const result = validatePedido({
            proveedorId: null,
            ingredientes: [{ ingredienteId: 1, cantidad: 10, precio: 2.50 }]
        });
        expect(result.valid).toBe(false);
    });

    test('empty ingredientes fails', () => {
        const result = validatePedido({
            proveedorId: 1,
            ingredientes: []
        });
        expect(result.valid).toBe(false);
    });

    test('ingredient with zero quantity fails', () => {
        const result = validatePedido({
            proveedorId: 1,
            ingredientes: [{ ingredienteId: 1, cantidad: 0, precio: 2.50 }]
        });
        expect(result.valid).toBe(false);
    });
});

describe('validation.js — validateProveedor (real import)', () => {

    test('valid supplier passes', () => {
        const result = validateProveedor({
            nombre: 'Makro',
            telefono: '912345678',
            email: 'pedidos@makro.es'
        });
        expect(result.valid).toBe(true);
    });

    test('empty name fails', () => {
        const result = validateProveedor({
            nombre: '',
            telefono: '912345678'
        });
        expect(result.valid).toBe(false);
    });

    test('invalid email fails', () => {
        const result = validateProveedor({
            nombre: 'Makro',
            email: 'not-valid'
        });
        expect(result.valid).toBe(false);
    });

    test('valid supplier with partial data passes', () => {
        const result = validateProveedor({
            nombre: 'Pescadería Local'
        });
        // Should pass — email/phone are optional
        expect(result.valid).toBe(true);
    });
});
