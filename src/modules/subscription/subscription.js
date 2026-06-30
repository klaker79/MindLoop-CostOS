/**
 * Módulo de Suscripción — MindLoop CostOS (single-plan model)
 *
 * Pricing tras 2026-06-12: UN SOLO PLAN.
 *   - Plan único MindLoop CostOS: 90€/mes (Polar, ver subscription.routes.js).
 *     Chat IA INCLUIDO (ya no hay add-on de 30€; el gating se colapsó el 8-jun).
 *
 * Este módulo:
 *   - Lee /stripe/subscription-status (legacy path, devuelve plan_status desde
 *     BD — el endpoint NO usa Stripe SDK, solo conserva el path por compat).
 *   - Pinta la tarjeta "Plan MindLoop" en Settings con dos estados:
 *       · activo  → "Activo" + botón "Gestionar suscripción" (portal Polar)
 *       · inactivo (trial/pending_payment/expired/canceled) → CTA
 *         "Suscribirse · 90€/mes" que abre checkout Polar
 *   - Maneja el retorno desde Polar (?subscription=success) con toast + refresh.
 *   - Pinta la tarjeta del Chat IA add-on (delegado a chat-addon-card.js).
 */

import { getApiUrl } from '../../config/app-config.js';
import { authStore } from '../../stores/authStore.js';
import { api } from '../../api/client.js';
import { renderChatAddonCard } from './chat-addon-card.js';

const API_BASE = getApiUrl();
const PLAN_PRICE_EUR = 90;

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.authToken : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

/**
 * Carga el estado de suscripción y renderiza las tarjetas de Settings.
 * Mantiene window._planData y dispara `plan:loaded` para los consumidores
 * legacy (chat widget guard, etc.).
 */
export async function loadSubscriptionStatus() {
    const planContainer = document.getElementById('plan-info-container');
    const addonContainer = document.getElementById('chat-addon-container');

    // Atendemos primero el retorno desde Polar (puede llegar antes que la BD
    // tenga el plan_status actualizado por el webhook — 1-3s típicos).
    handlePolarSubscriptionReturn();

    try {
        const res = await fetch(API_BASE + '/stripe/subscription-status', {
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!res.ok) {
            if (planContainer) {
                planContainer.innerHTML = '<p style="color:#94a3b8;">No se pudo cargar el plan</p>';
            }
            // Aun así intentamos pintar la tarjeta del add-on (independiente)
            if (addonContainer) renderChatAddonCard(addonContainer);
            return;
        }

        const data = await res.json();

        // Sync con authStore + window para consumidores legacy
        authStore.setState({
            plan: data.plan,
            plan_status: data.plan_status,
            max_users: data.max_users,
            has_subscription: data.has_subscription
        });
        if (typeof window !== 'undefined') {
            window._planData = data;
            window.dispatchEvent(new CustomEvent('plan:loaded', { detail: data }));
        }

        if (planContainer) renderPlanCard(planContainer, data);
        if (addonContainer) renderChatAddonCard(addonContainer);
    } catch (err) {
        console.error('Error loading subscription status:', err);
        if (planContainer) {
            planContainer.innerHTML = '<p style="color:#94a3b8;">Error al cargar el plan</p>';
        }
        if (addonContainer) renderChatAddonCard(addonContainer);
    }
}

/**
 * Maneja el query param `?subscription=success` cuando el cliente vuelve
 * tras pagar el plan base en Polar. Muestra toast + recarga para que el
 * webhook ya haya tenido tiempo de actualizar plan_status.
 */
let subscriptionReturnHandled = false;
function handlePolarSubscriptionReturn() {
    if (subscriptionReturnHandled) return;
    const params = new URLSearchParams(window.location.search);
    const sub = params.get('subscription');
    if (!sub) return;
    subscriptionReturnHandled = true;

    if (sub === 'success') {
        window.showToast?.('🎉 Plan MindLoop activado. Recargando...', 'success', 3000);
        setTimeout(() => {
            params.delete('subscription');
            const cleanUrl = window.location.pathname +
                (params.toString() ? `?${params.toString()}` : '') +
                window.location.hash;
            window.location.replace(cleanUrl);
        }, 2500);
    } else {
        // cancel u otros → solo limpiamos el query param
        params.delete('subscription');
        const cleanUrl = window.location.pathname +
            (params.toString() ? `?${params.toString()}` : '') +
            window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
    }
}

function renderPlanCard(container, data) {
    const isActive = data.plan_status === 'active';
    if (isActive) {
        renderActiveCard(container);
    } else {
        renderInactiveCard(container, data);
    }
}

function renderActiveCard(container) {
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;">
                    <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                    <div style="font-size:18px;font-weight:700;color:var(--text-primary, #1e293b);">Plan MindLoop</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                        <span style="background:#10b981;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Activo</span>
                        <span style="color:#64748b;font-size:13px;">${PLAN_PRICE_EUR}€/mes</span>
                    </div>
                </div>
            </div>
            <button id="plan-base-manage-btn"
                style="background:transparent;color:#475569;border:1px solid #cbd5e1;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                Gestionar suscripción
            </button>
        </div>
    `;
    container.querySelector('#plan-base-manage-btn')
        ?.addEventListener('click', () => openSubscriptionPortal());
}

function renderInactiveCard(container, data) {
    const status = data.plan_status || 'pending_payment';
    const statusLabel = {
        trialing: 'En periodo de prueba',
        expired: 'Periodo de prueba caducado',
        pending_payment: 'Pendiente de activación',
        past_due: 'Pago vencido',
        canceled: 'Cancelado'
    }[status] || 'Inactivo';

    const statusColor = status === 'trialing' ? '#f59e0b' : '#ef4444';
    const trialDays = data.trial_days_left !== null && data.trial_days_left !== undefined && status === 'trialing'
        ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">Te quedan <strong>${data.trial_days_left}</strong> días de prueba gratuita.</div>`
        : '';

    container.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:6px 0;">
            <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                    <span style="font-size:18px;font-weight:700;color:var(--text-primary,#1e293b);">Plan MindLoop</span>
                    <span style="background:${statusColor};color:white;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;">${statusLabel}</span>
                </div>
                <div style="font-size:13px;color:#64748b;line-height:1.5;margin-bottom:14px;">
                    Acceso completo a MindLoop CostOS: pedidos, escandallos, food cost, P&amp;L, informes, multi-tenancy.
                    ${trialDays}
                </div>
                <button id="plan-base-activate-btn"
                    style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                    Suscribirse · ${PLAN_PRICE_EUR}€/mes
                </button>
            </div>
        </div>
    `;
    container.querySelector('#plan-base-activate-btn')
        ?.addEventListener('click', () => startBasePlanCheckout());
}

/**
 * Inicia el flujo de checkout del plan base en Polar.
 */
async function startBasePlanCheckout() {
    const btn = document.getElementById('plan-base-activate-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Abriendo página de pago...';
        btn.style.opacity = '0.7';
    }
    try {
        const res = await api.createBasePlanCheckout();
        if (!res?.url) throw new Error('Backend no devolvió URL de checkout');
        window.location.href = res.url;
    } catch (err) {
        console.error('createBasePlanCheckout failed:', err);
        window.showToast?.('No se pudo abrir el pago. Inténtalo de nuevo.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = `Suscribirse · ${PLAN_PRICE_EUR}€/mes`;
            btn.style.opacity = '1';
        }
    }
}

/**
 * Abre el portal del cliente en Polar (mismo portal sirve para gestionar
 * plan base y add-on Chat IA — ambos comparten customer).
 */
async function openSubscriptionPortal() {
    const btn = document.getElementById('plan-base-manage-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Abriendo portal...';
    }
    try {
        const res = await api.openSubscriptionPortal();
        if (!res?.url) throw new Error('Backend no devolvió URL del portal');
        window.location.href = res.url;
    } catch (err) {
        console.error('openSubscriptionPortal failed:', err);
        const msg = err?.status === 400
            ? 'No tienes una suscripción activa para gestionar.'
            : 'No se pudo abrir el portal. Inténtalo de nuevo.';
        window.showToast?.(msg, 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Gestionar suscripción';
        }
    }
}

// Expuesto globalmente para uso desde main.js bootstrap y desde chat-addon-card
if (typeof window !== 'undefined') {
    window.loadSubscriptionStatus = loadSubscriptionStatus;
}
