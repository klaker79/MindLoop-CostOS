/**
 * tenant-storage.test.js — Multi-tenant isolation.
 *
 * Garantiza que las keys de localStorage se aíslan por restauranteId y que
 * cambiar de tenant en el mismo navegador NUNCA mezcla datos entre cuentas.
 * La regla #10 de Iker es inquebrantable — cualquier regresión aquí filtra
 * datos de La Nave 5 a Stefania KL (o viceversa).
 */

import {
    tenantKey,
    tenantStorage,
    currentTenantId,
    purgeLegacyUnscopedKeys,
    clearCurrentTenantKeys,
} from '../../utils/tenant-storage.js';

function setCurrentUser(user) {
    if (user === null) {
        delete window.currentUser;
        localStorage.removeItem('user');
        return;
    }
    window.currentUser = user;
    localStorage.setItem('user', JSON.stringify(user));
}

describe('tenant-storage — aislamiento por restauranteId', () => {
    beforeEach(() => {
        localStorage.clear();
        delete window.currentUser;
    });

    describe('currentTenantId', () => {
        test('sin sesión → "anon"', () => {
            expect(currentTenantId()).toBe('anon');
        });

        test('lee window.currentUser.restauranteId', () => {
            setCurrentUser({ id: 1, restauranteId: 3 });
            expect(currentTenantId()).toBe('3');
        });

        test('fallback a localStorage.user si no hay window.currentUser', () => {
            localStorage.setItem('user', JSON.stringify({ restauranteId: 28 }));
            expect(currentTenantId()).toBe('28');
        });

        test('devuelve string (para que tenantKey concatene bien)', () => {
            setCurrentUser({ restauranteId: 3 });
            expect(typeof currentTenantId()).toBe('string');
        });

        test('user malformado → "anon"', () => {
            localStorage.setItem('user', 'not-valid-json{');
            expect(currentTenantId()).toBe('anon');
        });
    });

    describe('tenantKey', () => {
        test('anon sufijo cuando no hay sesión', () => {
            expect(tenantKey('ultimoInventario')).toBe('ultimoInventario_anon');
        });

        test('prefija con restauranteId', () => {
            setCurrentUser({ restauranteId: 3 });
            expect(tenantKey('ultimoInventario')).toBe('ultimoInventario_3');
        });

        test('dos tenants distintos producen keys distintas', () => {
            setCurrentUser({ restauranteId: 3 });
            const a = tenantKey('gf_open_cats');
            setCurrentUser({ restauranteId: 28 });
            const b = tenantKey('gf_open_cats');
            expect(a).not.toBe(b);
        });
    });

    describe('tenantStorage wrapper', () => {
        test('setItem + getItem roundtrip dentro del mismo tenant', () => {
            setCurrentUser({ restauranteId: 3 });
            tenantStorage.setItem('opex_inputs', JSON.stringify({ alquiler: 2000 }));
            expect(JSON.parse(tenantStorage.getItem('opex_inputs'))).toEqual({ alquiler: 2000 });
        });

        test('tenant B NO ve los datos del tenant A (regla #10 Iker)', () => {
            setCurrentUser({ restauranteId: 3 });
            tenantStorage.setItem('ultimoInventario', '2026-04-22T10:00:00Z');

            setCurrentUser({ restauranteId: 28 });
            expect(tenantStorage.getItem('ultimoInventario')).toBeNull();

            setCurrentUser({ restauranteId: 3 });
            expect(tenantStorage.getItem('ultimoInventario')).toBe('2026-04-22T10:00:00Z');
        });

        test('removeItem solo afecta al tenant actual', () => {
            setCurrentUser({ restauranteId: 3 });
            tenantStorage.setItem('gf_open_cats', '["Personal"]');

            setCurrentUser({ restauranteId: 28 });
            tenantStorage.setItem('gf_open_cats', '["Impuestos"]');
            tenantStorage.removeItem('gf_open_cats');
            expect(tenantStorage.getItem('gf_open_cats')).toBeNull();

            setCurrentUser({ restauranteId: 3 });
            expect(tenantStorage.getItem('gf_open_cats')).toBe('["Personal"]');
        });

        test('la key física en localStorage lleva el sufijo', () => {
            setCurrentUser({ restauranteId: 3 });
            tenantStorage.setItem('opex_inputs', '{}');
            expect(localStorage.getItem('opex_inputs_3')).toBe('{}');
            expect(localStorage.getItem('opex_inputs')).toBeNull();
        });
    });

    describe('purgeLegacyUnscopedKeys', () => {
        test('borra keys flat legacy dejando las scopeadas intactas', () => {
            localStorage.setItem('ultimoInventario', '2026-01-01');
            localStorage.setItem('ultimoInventario_3', '2026-04-22');
            localStorage.setItem('opex_inputs', '{"alquiler":1}');
            localStorage.setItem('gf_open_cats', '[]');
            localStorage.setItem('restaurant_name', 'LA NAVE 5');
            localStorage.setItem('pedidoCarrito_undefined', '{}');
            localStorage.setItem('pedidoCarrito_3', '{"items":[]}');

            purgeLegacyUnscopedKeys();

            expect(localStorage.getItem('ultimoInventario')).toBeNull();
            expect(localStorage.getItem('opex_inputs')).toBeNull();
            expect(localStorage.getItem('gf_open_cats')).toBeNull();
            expect(localStorage.getItem('restaurant_name')).toBeNull();
            expect(localStorage.getItem('pedidoCarrito_undefined')).toBeNull();

            expect(localStorage.getItem('ultimoInventario_3')).toBe('2026-04-22');
            expect(localStorage.getItem('pedidoCarrito_3')).toBe('{"items":[]}');
        });

        test('es idempotente', () => {
            purgeLegacyUnscopedKeys();
            expect(() => purgeLegacyUnscopedKeys()).not.toThrow();
        });
    });

    describe('clearCurrentTenantKeys', () => {
        test('borra solo keys del tenant actual, deja otras intactas', () => {
            setCurrentUser({ restauranteId: 3 });
            tenantStorage.setItem('opex_inputs', '{}');
            tenantStorage.setItem('gf_open_cats', '[]');

            setCurrentUser({ restauranteId: 28 });
            tenantStorage.setItem('opex_inputs', '{"alquiler":500}');

            setCurrentUser({ restauranteId: 3 });
            clearCurrentTenantKeys();

            expect(localStorage.getItem('opex_inputs_3')).toBeNull();
            expect(localStorage.getItem('gf_open_cats_3')).toBeNull();
            expect(localStorage.getItem('opex_inputs_28')).toBe('{"alquiler":500}');
        });

        test('no toca globales (theme, user, mindloop_lang)', () => {
            setCurrentUser({ restauranteId: 3 });
            localStorage.setItem('theme', 'dark');
            localStorage.setItem('mindloop_lang', 'es');
            tenantStorage.setItem('opex_inputs', '{}');

            clearCurrentTenantKeys();

            expect(localStorage.getItem('theme')).toBe('dark');
            expect(localStorage.getItem('mindloop_lang')).toBe('es');
            expect(localStorage.getItem('user')).toBeTruthy();
            expect(localStorage.getItem('opex_inputs_3')).toBeNull();
        });
    });
});
