/**
 * Feature Gating — capa visual sobre el sistema de planes.
 *
 * Filosofía "feature teasing" (estilo Notion/Spotify/Linear): los botones
 * de funciones de plan superior NO se ocultan al cliente. Se muestran con
 * una corona 👑 y al pulsarlos abren el modal de upgrade en lugar de
 * ejecutar la acción. Convierte mucho mejor que ocultar.
 *
 * Cómo se usa:
 *   1. Marca el botón en HTML con `data-feature="smart_order"` (clave de
 *      FEATURE_REQUIREMENTS).
 *   2. Asegúrate de que mountFeatureLocks() se llama tras cargar el
 *      plan del usuario (lo enganchamos al evento 'plan:loaded').
 *   3. La capa visual hace el resto. El backend mantiene su propio gate
 *      con requirePlan() — defensa en profundidad.
 */
import { authStore } from '../../stores/authStore.js';
import { FEATURE_REQUIREMENTS, PLAN_LEVELS, getRequiredPlan } from './feature-map.js';

const LOCKED_CLASS = 'locked-feature';
const LOCK_DATA_ATTR = 'data-locked-original-onclick';

/**
 * Devuelve true si el plan actual del usuario llega para usar la feature.
 *
 * @param {string} feature - clave de FEATURE_REQUIREMENTS
 * @returns {boolean}
 */
export function canUse(feature) {
    const required = getRequiredPlan(feature);
    if (!required) return true; // feature sin gate → libre
    const userPlan = authStore.getState().plan;
    if (!userPlan) return false; // no se ha cargado plan → bloqueamos por seguridad
    const userLevel = PLAN_LEVELS[userPlan] || 0;
    const requiredLevel = PLAN_LEVELS[required] || 0;
    return userLevel >= requiredLevel;
}

/**
 * Marca un botón como bloqueado por plan: añade clase, badge corona y
 * sustituye el onclick por la apertura del modal de upgrade. El
 * onclick original se preserva en un data attribute por si más tarde
 * se desbloquea (cambio de plan en caliente sin recargar).
 *
 * @param {HTMLElement} btn - el botón a bloquear
 * @param {string} requiredPlan - 'pro' | 'premium'
 */
export function lockButton(btn, requiredPlan) {
    if (!btn || btn.classList.contains(LOCKED_CLASS)) return;

    btn.classList.add(LOCKED_CLASS);
    btn.dataset.lockedRequiredPlan = requiredPlan;
    btn.title = `Disponible en plan ${requiredPlan.toUpperCase()}`;
    btn.setAttribute('aria-disabled', 'true');

    // Preservar onclick original en data attribute (string) para poder
    // restaurarlo si el usuario hace upgrade y volvemos a llamar a
    // mountFeatureLocks tras un plan:loaded con permisos suficientes.
    if (btn.getAttribute('onclick') && !btn.getAttribute(LOCK_DATA_ATTR)) {
        btn.setAttribute(LOCK_DATA_ATTR, btn.getAttribute('onclick'));
    }
    btn.removeAttribute('onclick');

    // Añadir badge corona si no existe
    if (!btn.querySelector('.locked-feature-crown')) {
        const crown = document.createElement('span');
        crown.className = 'locked-feature-crown';
        crown.textContent = '👑';
        crown.setAttribute('aria-hidden', 'true');
        btn.appendChild(crown);
    }

    // Reemplazar el handler. Usamos addEventListener con flag interno para
    // evitar duplicar listeners si lockButton se llama varias veces.
    if (!btn._lockHandlerAttached) {
        btn._lockHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.promptUpgradePlan === 'function') {
                window.promptUpgradePlan();
            } else {
                window.showToast?.(
                    `Esta función requiere plan ${requiredPlan.toUpperCase()}`,
                    'info'
                );
            }
        };
        btn.addEventListener('click', btn._lockHandler, true); // capture
        btn._lockHandlerAttached = true;
    }
}

/**
 * Quita el lock de un botón previamente bloqueado.
 */
export function unlockButton(btn) {
    if (!btn || !btn.classList.contains(LOCKED_CLASS)) return;

    btn.classList.remove(LOCKED_CLASS);
    delete btn.dataset.lockedRequiredPlan;
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('title');

    const original = btn.getAttribute(LOCK_DATA_ATTR);
    if (original) {
        btn.setAttribute('onclick', original);
        btn.removeAttribute(LOCK_DATA_ATTR);
    }

    const crown = btn.querySelector('.locked-feature-crown');
    if (crown) crown.remove();

    if (btn._lockHandler && btn._lockHandlerAttached) {
        btn.removeEventListener('click', btn._lockHandler, true);
        btn._lockHandlerAttached = false;
        btn._lockHandler = null;
    }
}

/**
 * Escanea el DOM en busca de elementos con `data-feature` y aplica
 * lock/unlock según el plan actual del usuario. Idempotente.
 */
export function applyFeatureLocks(root = document) {
    const elements = root.querySelectorAll('[data-feature]');
    elements.forEach(el => {
        const feature = el.dataset.feature;
        if (!feature) return;
        const required = getRequiredPlan(feature);
        if (!required) {
            unlockButton(el);
            return;
        }
        if (canUse(feature)) {
            unlockButton(el);
        } else {
            lockButton(el, required);
        }
    });
}

/**
 * Inicialización: aplica locks ahora y se reaplica cada vez que el
 * authStore carga datos de plan nuevos (login, cambio de tenant,
 * trial expirado, etc.).
 */
export function mountFeatureLocks() {
    // Primera pasada (puede ser pre-plan-loaded; si no hay plan, todos
    // los gates devuelven false y se bloquean. Cuando llegue plan:loaded,
    // se reevalúa).
    applyFeatureLocks();

    // Reaplicar cuando llegue el plan del backend.
    window.addEventListener('plan:loaded', () => applyFeatureLocks());

    // Si hay cambio de plan en caliente (upgrade/downgrade desde la app),
    // dispatchéalo desde donde corresponda y la UI se actualizará.
    window.addEventListener('plan:changed', () => applyFeatureLocks());
}

// Exponer para uso desde inline o consola si fuera útil.
if (typeof window !== 'undefined') {
    window.canUse = canUse;
    window.applyFeatureLocks = applyFeatureLocks;
}
