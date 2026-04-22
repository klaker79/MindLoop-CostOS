/**
 * tenant-storage.js — Aislamiento de localStorage por tenant (restauranteId).
 *
 * Multi-tenant inquebrantable: cuando un usuario cambia de restaurante
 * (`switchRestaurant` en auth.js) o hace login como otro usuario, las keys
 * flat (sin prefijo) dejan colgados datos del tenant anterior en el mismo
 * navegador y los lee el siguiente tenant = fuga cross-tenant.
 *
 * Patrón: `tenantKey('ultimoInventario')` → `'ultimoInventario_<id>'`.
 * Si no hay sesión (login screen), usa sufijo `anon` y los lectores verán
 * un storage vacío — no datos residuales.
 *
 * Las funciones replican la API de `localStorage` pero auto-scopean la key.
 * Uso recomendado:
 *
 *     import { tenantStorage } from '@/utils/tenant-storage.js';
 *     tenantStorage.setItem('ultimoInventario', new Date().toISOString());
 *     const raw = tenantStorage.getItem('ultimoInventario');
 *
 * `purgeLegacyUnscopedKeys()` se llama una sola vez al cargar la app para
 * borrar las keys planas que existían antes del fix.
 */

const LEGACY_KEYS_TO_PURGE = Object.freeze([
    'ultimoInventario',
    'inventario_sugerido_dismissed',
    'gf_open_cats',
    'opex_inputs',
    'restaurant_name',
    'pedidoCarrito_undefined',
]);

/**
 * Devuelve el restauranteId actual del usuario logueado, o 'anon' si no hay.
 * Fuente canónica: `window.currentUser` (synced desde authStore), con fallback
 * a `localStorage.user` para el boot antes de que initializeStores corra.
 */
export function currentTenantId() {
    try {
        const winId = typeof window !== 'undefined' ? window.currentUser?.restauranteId : undefined;
        if (winId !== undefined && winId !== null) return String(winId);
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
        if (!raw) return 'anon';
        const user = JSON.parse(raw);
        const id = user?.restauranteId;
        return id !== undefined && id !== null ? String(id) : 'anon';
    } catch {
        return 'anon';
    }
}

/** `base` → `base_<tenantId>`. No escapa nada: solo para keys del proyecto. */
export function tenantKey(base) {
    return `${base}_${currentTenantId()}`;
}

/** Wrapper seguro sobre localStorage — devuelve null/no-op si no hay storage. */
export const tenantStorage = Object.freeze({
    getItem(base) {
        if (typeof localStorage === 'undefined') return null;
        try { return localStorage.getItem(tenantKey(base)); } catch { return null; }
    },
    setItem(base, value) {
        if (typeof localStorage === 'undefined') return;
        try { localStorage.setItem(tenantKey(base), value); } catch { /* quota */ }
    },
    removeItem(base) {
        if (typeof localStorage === 'undefined') return;
        try { localStorage.removeItem(tenantKey(base)); } catch { /* noop */ }
    },
});

/**
 * Elimina claves flat legacy (pre-fix) del localStorage del navegador.
 * Idempotente: si ya no existen, no pasa nada. Se llama una sola vez por
 * carga de app desde `main.js`.
 */
export function purgeLegacyUnscopedKeys(keys = LEGACY_KEYS_TO_PURGE) {
    if (typeof localStorage === 'undefined') return;
    for (const key of keys) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
}

/**
 * Borra TODAS las keys de localStorage con el patrón `<base>_<tenantId>` para
 * el tenant actual. Útil al hacer switchRestaurant para no dejar estado colgado
 * aunque el nuevo tenant leerá siempre su propio scope.
 * No tocamos keys globales (`user`, `token`, `theme`, `mindloop_lang`, `ttsEnabled`).
 */
export function clearCurrentTenantKeys() {
    if (typeof localStorage === 'undefined') return;
    const suffix = `_${currentTenantId()}`;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith(suffix)) keysToRemove.push(k);
    }
    for (const k of keysToRemove) {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
}

// Exponer al global para código legacy que no hace imports ES6.
if (typeof window !== 'undefined') {
    window.tenantStorage = tenantStorage;
    window.tenantKey = tenantKey;
    window.currentTenantId = currentTenantId;
}
