/**
 * @jest-environment jsdom
 *
 * Tests for plan-guard helper.
 *
 * Cubre los 3 escenarios críticos:
 *   1. Plan no cargado (window._planData ausente) → fail-OPEN
 *   2. Plan llega al mínimo requerido → ejecuta el fetch
 *   3. Plan no llega → devuelve fallback sin tocar la red
 */

import { jest } from '@jest/globals';
import { planLevelMet, planGuardedFetch } from '../../modules/plans/plan-guard.js';

describe('planLevelMet()', () => {
    afterEach(() => {
        delete window._planData;
    });

    test('fail-OPEN: sin _planData devuelve true', () => {
        expect(planLevelMet('profesional')).toBe(true);
        expect(planLevelMet('premium')).toBe(true);
    });

    test('fail-OPEN: _planData sin plan devuelve true', () => {
        window._planData = { plan_status: 'active' };
        expect(planLevelMet('profesional')).toBe(true);
    });

    test('starter NO llega a profesional', () => {
        window._planData = { plan: 'starter' };
        expect(planLevelMet('profesional')).toBe(false);
        expect(planLevelMet('premium')).toBe(false);
    });

    test('starter SÍ llega a starter', () => {
        window._planData = { plan: 'starter' };
        expect(planLevelMet('starter')).toBe(true);
    });

    test('trial llega a profesional (alias 14 días)', () => {
        window._planData = { plan: 'trial' };
        expect(planLevelMet('profesional')).toBe(true);
        expect(planLevelMet('premium')).toBe(false);
    });

    test('profesional/pro llegan a profesional pero no a premium', () => {
        window._planData = { plan: 'profesional' };
        expect(planLevelMet('profesional')).toBe(true);
        expect(planLevelMet('premium')).toBe(false);

        window._planData = { plan: 'pro' };
        expect(planLevelMet('profesional')).toBe(true);
        expect(planLevelMet('premium')).toBe(false);
    });

    test('premium llega a todo', () => {
        window._planData = { plan: 'premium' };
        expect(planLevelMet('starter')).toBe(true);
        expect(planLevelMet('profesional')).toBe(true);
        expect(planLevelMet('premium')).toBe(true);
    });
});

describe('planGuardedFetch()', () => {
    afterEach(() => {
        delete window._planData;
    });

    test('llama al fetch cuando el plan llega', async () => {
        window._planData = { plan: 'profesional' };
        const fetchFn = jest.fn().mockResolvedValue([{ id: 1 }]);
        const out = await planGuardedFetch('profesional', fetchFn);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(out).toEqual([{ id: 1 }]);
    });

    test('NO llama al fetch cuando el plan no llega — devuelve fallback', async () => {
        window._planData = { plan: 'starter' };
        const fetchFn = jest.fn().mockResolvedValue([{ id: 1 }]);
        const out = await planGuardedFetch('profesional', fetchFn);
        expect(fetchFn).not.toHaveBeenCalled();
        expect(out).toEqual([]);
    });

    test('fallback custom', async () => {
        window._planData = { plan: 'starter' };
        const fetchFn = jest.fn();
        const out = await planGuardedFetch('profesional', fetchFn, null);
        expect(out).toBeNull();
    });

    test('fail-OPEN: sin _planData ejecuta el fetch', async () => {
        const fetchFn = jest.fn().mockResolvedValue([1, 2, 3]);
        const out = await planGuardedFetch('premium', fetchFn);
        expect(fetchFn).toHaveBeenCalledTimes(1);
        expect(out).toEqual([1, 2, 3]);
    });

    test('propaga el error del fetch al caller', async () => {
        window._planData = { plan: 'premium' };
        const fetchFn = jest.fn().mockRejectedValue(new Error('boom'));
        await expect(planGuardedFetch('profesional', fetchFn)).rejects.toThrow('boom');
    });
});
