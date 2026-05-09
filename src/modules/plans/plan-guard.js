/**
 * Plan guard: evita disparar fetches a endpoints Pro/Premium cuando el
 * usuario actual no llega al plan requerido.
 *
 * Por qué existe:
 *   El frontend hace requests a endpoints como /recipes-variants y
 *   /gastos-fijos en la carga inicial (módulos compartidos: dashboard,
 *   buscador, recetas). Esos endpoints están protegidos por
 *   `requirePlan('profesional')` en el backend, así que un usuario
 *   Starter recibía 403 silenciosos en cascada → toasts molestos +
 *   ruido en consola.
 *
 * Estrategia:
 *   - `planLevelMet(minPlan)` consulta `window._planData` (set por
 *     subscription-status). Fail-OPEN: si no hay datos de plan
 *     (en login, error de red, primer render) devuelve true. El
 *     backend ya tiene su gate definitivo, así que un fetch que pase
 *     el guard erróneamente caerá en 403 silencioso (handler ya silenciado).
 *
 *   - `planGuardedFetch(minPlan, fetchFn, fallback)` envuelve un fetch:
 *     si el plan no llega, devuelve `fallback` sin tocar la red.
 *     `fallback` por defecto es `[]` (la mayoría de endpoints
 *     devuelven arrays); pasar `null` u objeto cuando aplique.
 *
 * Uso típico desde un módulo ESM:
 *
 *     import { planGuardedFetch } from '../plans/plan-guard.js';
 *
 *     const variantes = await planGuardedFetch(
 *         'profesional',
 *         () => fetch(API + '/recipes-variants').then(r => r.json()),
 *         []
 *     );
 *
 * Uso desde un script legacy <script> plano:
 *
 *     const variantes = await window.__planGuard.planGuardedFetch(
 *         'profesional',
 *         () => fetchWithCreds(API + '/recipes-variants').then(r => r.json()),
 *         []
 *     );
 *
 * Multi-tenant: leer `_planData` siempre del usuario logueado actual
 * (sincronizado en `subscription.js` tras `loadSubscriptionStatus`).
 */

import { PLAN_LEVELS } from './feature-map.js';

/**
 * @param {string} minPlan - 'starter' | 'profesional' | 'pro' | 'premium' | 'trial'
 * @returns {boolean} true si el plan del usuario llega al mínimo, o si no hay
 *   plan cargado todavía (fail-OPEN).
 */
export function planLevelMet(minPlan) {
    if (typeof window === 'undefined') return true;
    const planData = window._planData;
    if (!planData || !planData.plan) return true; // fail-OPEN
    const userLevel = PLAN_LEVELS[planData.plan] || 0;
    const requiredLevel = PLAN_LEVELS[minPlan] || 0;
    return userLevel >= requiredLevel;
}

/**
 * Wraps a fetch function. Si el plan no llega, devuelve `fallback`
 * directamente, sin tocar la red. Idempotente, sin side-effects.
 *
 * @template T
 * @param {string} minPlan
 * @param {() => Promise<T>} fetchFn
 * @param {T} [fallback=[]] - valor a devolver si plan no llega
 * @returns {Promise<T>}
 */
export async function planGuardedFetch(minPlan, fetchFn, fallback = []) {
    if (!planLevelMet(minPlan)) {
        return /** @type {T} */ (fallback);
    }
    return fetchFn();
}
