/**
 * Feature Gating — capa visual sobre el sistema de planes.
 *
 * Filosofía "feature teasing" (Notion/Spotify/Linear): los botones de
 * funciones de plan superior NO se ocultan al cliente. Se muestran con
 * una corona dorada y al pulsarlos abren el modal de upgrade en lugar
 * de ejecutar la acción.
 *
 * 🔑 PRINCIPIO CLAVE: FAIL-OPEN.
 *    - Si NO sabemos el plan del usuario (cargando, error de red, etc.)
 *      → MOSTRAMOS el botón funcional. NO lo bloqueamos por seguridad.
 *    - SOLO bloqueamos cuando el backend confirma explícitamente que el
 *      plan del usuario es inferior al requerido.
 *    - Razón: el backend ya protege con requirePlan(). Si nuestra capa
 *      visual falla y muestra un botón "no debería ver", al pulsarlo el
 *      backend devuelve 403 limpio. Nada se rompe. En cambio, fail-closed
 *      bloquea a clientes Premium si por bug nuestro el plan no carga.
 *
 * Defensa en profundidad: backend ya bloquea con requirePlan en
 * planGate.js. Esta capa es solo UX (corona, paywall, conversion).
 */
import { FEATURE_REQUIREMENTS, PLAN_LEVELS, getRequiredPlan } from './feature-map.js';

const LOCKED_CLASS = 'locked-feature';
const LOCK_ATTR = 'data-locked-required-plan';

/**
 * Devuelve true si el plan actual del usuario llega para usar la feature.
 *
 * @param {string} feature - clave de FEATURE_REQUIREMENTS
 * @returns {boolean}
 */
export function canUse(feature) {
    const required = getRequiredPlan(feature);
    if (!required) return true; // feature sin gate → libre.

    const planData = (typeof window !== 'undefined' && window._planData) || null;
    // ⚡ FAIL-OPEN: sin datos de plan no bloqueamos. El backend ya tiene
    // su propio gate (requirePlan); si por bug visual mostramos algo que
    // no debería verse, el backend devuelve 403 limpio al pulsar.
    if (!planData || !planData.plan) return true;

    const userLevel = PLAN_LEVELS[planData.plan] || 0;
    const requiredLevel = PLAN_LEVELS[required] || 0;
    return userLevel >= requiredLevel;
}

/**
 * Marca un botón como bloqueado por plan.
 *
 * @param {HTMLElement} btn
 * @param {string} requiredPlan - 'pro' | 'premium'
 */
export function lockButton(btn, requiredPlan) {
    if (!btn || btn.classList.contains(LOCKED_CLASS)) return;

    btn.classList.add(LOCKED_CLASS);
    btn.setAttribute(LOCK_ATTR, requiredPlan);
    btn.title = `Disponible en plan ${requiredPlan.toUpperCase()}`;
    btn.setAttribute('aria-disabled', 'true');

    // Preservar onclick original para poder restaurarlo si el usuario
    // hace upgrade y volvemos a llamar a applyFeatureLocks.
    if (btn.getAttribute('onclick') && !btn.getAttribute('data-locked-original-onclick')) {
        btn.setAttribute('data-locked-original-onclick', btn.getAttribute('onclick'));
    }
    btn.removeAttribute('onclick');

    // Badge corona dorada en la esquina.
    if (!btn.querySelector('.locked-feature-crown')) {
        const crown = document.createElement('span');
        crown.className = 'locked-feature-crown';
        crown.textContent = '👑';
        crown.setAttribute('aria-hidden', 'true');
        btn.appendChild(crown);
    }

    // Listener que abre el modal de upgrade en lugar de ejecutar acción.
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
    btn.removeAttribute(LOCK_ATTR);
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('title');

    const original = btn.getAttribute('data-locked-original-onclick');
    if (original) {
        btn.setAttribute('onclick', original);
        btn.removeAttribute('data-locked-original-onclick');
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
 * Escanea el DOM y aplica lock/unlock según el plan actual.
 * Idempotente.
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
 * Inicialización: aplica locks ahora y los reaplica cada vez que llega
 * `plan:loaded` (carga inicial o cambio de plan en caliente).
 *
 * Como canUse es fail-open, el primer applyFeatureLocks ejecutado antes
 * de que el plan cargue NO bloquea nada. Cuando llega plan:loaded
 * reevaluamos y bloqueamos solo lo que toca.
 */
export function mountFeatureLocks() {
    applyFeatureLocks();
    if (typeof window !== 'undefined') {
        window.addEventListener('plan:loaded', () => applyFeatureLocks());
        window.addEventListener('plan:changed', () => applyFeatureLocks());
    }
}

// Exponer para debug en consola.
if (typeof window !== 'undefined') {
    window.canUse = canUse;
    window.applyFeatureLocks = applyFeatureLocks;
}
