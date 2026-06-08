/**
 * subscription-modal.js — overlay full-screen "Tu prueba ha terminado".
 *
 * Se muestra cuando CUALQUIER endpoint del backend responde 403 con
 * `error: 'SUBSCRIPTION_REQUIRED'`. El interceptor global de
 * `src/api/client.js` dispara el evento `subscription:required`.
 *
 * Una sola instancia por sesión (no se acumulan modales si vuelven 5 endpoints
 * a la vez). Una vez mostrado, no se puede cerrar — el cliente debe pagar
 * o contactar.
 *
 * URLs de pasarela configurables vía Vite env vars:
 *   VITE_POLAR_CHECKOUT_URL_SELF  → link directo a checkout Self 95€/mes
 *   VITE_POLAR_CHECKOUT_URL_PRO   → link directo a checkout Pro 185€/mes
 *   VITE_CONTACT_FALLBACK_URL     → fallback WhatsApp/email cuando Polar no listo
 *
 * Si las env vars no están definidas, el botón cae al fallback de contacto.
 * Así el deploy funciona desde el día 1 aunque Polar todavía no esté listo
 * (alta autónomos + Polar onboarding).
 *
 * Iker, 2026-06-08.
 */

const MODAL_ID = 'subscription-modal-overlay';
let modalShown = false;

function getEnv(name) {
    try {
        if (typeof import.meta !== 'undefined' && import.meta?.env) {
            return import.meta.env[name] || '';
        }
    } catch (_e) { /* nada */ }
    return '';
}

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildTitle(reason) {
    switch (reason) {
        case 'trial_expired':
            return 'Tu periodo de prueba ha terminado';
        case 'cancelled':
            return 'Tu suscripción no está activa';
        case 'no_subscription':
        default:
            return 'Necesitas una suscripción activa';
    }
}

function buildSubtitle(reason) {
    switch (reason) {
        case 'trial_expired':
            return 'Para seguir usando CostOS, elige tu plan y suscríbete. Tus datos están a salvo — todo vuelve cuando pagues.';
        case 'cancelled':
            return 'Reactiva tu suscripción para volver a usar la app. Tus datos están intactos.';
        default:
            return 'Suscríbete para acceder a CostOS — escandallos, food cost, P&L diario, mermas y chat IA, todo incluido.';
    }
}

function isAuthenticated() {
    // El SPA puede seguir mostrando URL /login.html aunque el usuario ya esté
    // logado y viendo el dashboard — por eso NO podemos filtrar por pathname.
    // Fuente de verdad: localStorage.user (se setea en app-core.js tras login).
    try {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        const raw = window.localStorage.getItem('user');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return !!(parsed && (parsed.id || parsed.email));
    } catch (_e) {
        return false;
    }
}

function showSubscriptionModal(detail) {
    if (modalShown) return;
    // Solo mostrar dentro de la app. Si no hay sesión, el visitante todavía no
    // sabe qué es CostOS y le saldría "Tu prueba ha terminado" sin contexto.
    if (!isAuthenticated()) return;
    modalShown = true;

    const reason = detail?.reason || 'no_subscription';
    const urlSelf = getEnv('VITE_POLAR_CHECKOUT_URL_SELF');
    const urlPro = getEnv('VITE_POLAR_CHECKOUT_URL_PRO');
    const urlFallback = getEnv('VITE_CONTACT_FALLBACK_URL') || 'mailto:iker@mindloop.cloud';
    const polarReady = !!(urlSelf && urlPro);

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15, 23, 42, 0.92);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        backdrop-filter: blur(6px);
    `;

    const planBlock = polarReady
        ? `
            <a href="${escapeHTML(urlSelf)}" style="display: block; padding: 16px 20px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px; text-align: center;">
                Suscribirme a CostOS Self — 95€/mes
            </a>
            <a href="${escapeHTML(urlPro)}" style="display: block; padding: 14px 20px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: white; border-radius: 12px; font-weight: 600; text-decoration: none; font-size: 14px; text-align: center;">
                Quiero CostOS Pro con onboarding — 185€/mes
            </a>
            <a href="${escapeHTML(urlFallback)}" style="display: block; padding: 10px; color: #94a3b8; text-decoration: none; font-size: 13px; text-align: center;">
                ¿Tienes dudas? Hablar conmigo →
            </a>
          `
        : `
            <a href="${escapeHTML(urlFallback)}" style="display: block; padding: 16px 20px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px; text-align: center;">
                Hablar con Iker para suscribirme
            </a>
            <p style="margin: 8px 0 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
                CostOS Self 95€/mes · Pro con onboarding 185€/mes (tarifa fundador para los 10 primeros)
            </p>
          `;

    overlay.innerHTML = `
        <div style="max-width: 480px; width: 100%; padding: 40px 36px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 20px; color: #f8fafc; box-shadow: 0 30px 70px -10px rgba(15, 23, 42, 0.6); animation: subModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="font-size: 52px; margin-bottom: 16px; text-align: center;">🔒</div>
            <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: #f8fafc; text-align: center; line-height: 1.3;">${escapeHTML(buildTitle(reason))}</h2>
            <p style="margin: 0 0 28px 0; font-size: 14px; color: #cbd5e1; line-height: 1.6; text-align: center;">${escapeHTML(buildSubtitle(reason))}</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">${planBlock}</div>
        </div>
        <style>
            @keyframes subModalIn {
                from { opacity: 0; transform: scale(0.94); }
                to { opacity: 1; transform: scale(1); }
            }
        </style>
    `;
    document.body.appendChild(overlay);
}

/**
 * Wrap GLOBAL de window.fetch para detectar 403 SUBSCRIPTION_REQUIRED
 * desde CUALQUIER cliente HTTP (apiClient, fetchWithCreds del legacy app-core,
 * llamadas directas a fetch()). Necesario porque el frontend tiene varios
 * clientes HTTP y no todos pasan por el handleResponse de api/client.js.
 *
 * Solo wrap UNA vez. Idempotente.
 */
/**
 * Wrap GLOBAL de window.fetch (idempotente). Captura 403 SUBSCRIPTION_REQUIRED
 * desde cualquier cliente. Guarda el último detail en window.__pendingSub para
 * que mountSubscriptionModal lo dispare aunque el evento se haya enviado antes
 * de que el listener esté atado (race condition: peticiones que arrancan antes
 * de DOMContentLoaded).
 */
function installFetchInterceptor() {
    if (typeof window === 'undefined' || !window.fetch) return;
    if (window.__subscriptionInterceptorInstalled) return;
    window.__subscriptionInterceptorInstalled = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function (...args) {
        const response = await originalFetch(...args);
        try {
            if (response && response.status === 403) {
                const body = await response.clone().json().catch(() => null);
                if (body && body.error === 'SUBSCRIPTION_REQUIRED') {
                    const detail = {
                        reason: body.reason || 'no_subscription',
                        trialEndedAt: body.trial_ended_at || null,
                        plan: body.plan || null,
                        planStatus: body.plan_status || null,
                    };
                    // Buffer: si el modal aún no se montó, queda guardado
                    window.__pendingSub = detail;
                    window.dispatchEvent(new CustomEvent('subscription:required', { detail }));
                }
            }
        } catch (_e) { /* swallow — no romper el fetch original */ }
        return response;
    };
}

// Instalar el interceptor INMEDIATAMENTE al import (no esperar DOMContentLoaded).
// Las peticiones que arrancan al cargar la app (chatStatus, getIngredientes, etc.)
// salen antes del DOMContentLoaded — si esperamos, perdemos esos 403.
installFetchInterceptor();

export function mountSubscriptionModal() {
    if (typeof window === 'undefined') return;
    window.addEventListener('subscription:required', (event) => {
        showSubscriptionModal(event?.detail || {});
    });
    // Expuesto para testing manual desde consola
    window.showSubscriptionModal = showSubscriptionModal;
    // Si el interceptor ya recibió un 403 antes de que se montara el listener,
    // dispararlo ahora (race condition al arrancar la app).
    if (window.__pendingSub) {
        showSubscriptionModal(window.__pendingSub);
        window.__pendingSub = null;
    }
}
