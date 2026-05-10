/**
 * Módulo de Suscripción — MindLoop CostOS (single-plan model 2026-05-10)
 *
 * Antes había 3 planes (Starter / Profesional / Premium) con feature gating.
 * Ahora hay UN ÚNICO plan (95€/mes) más un add-on opcional Chat IA (30€/mes
 * vía Polar). Todo el flujo de "elige tu plan" + banner trial + modal trial
 * expirado se eliminó por petición de Iker — ya no aplica al modelo de pricing.
 *
 * Este módulo:
 *   - Lee /stripe/subscription-status para sincronizar window._planData (otros
 *     consumidores escuchan el evento `plan:loaded`).
 *   - Renderiza una tarjeta simple "Plan MindLoop · Activo" en Settings.
 *   - Pinta la tarjeta del Chat IA add-on (chat-addon-card.js gestiona su
 *     estado y los flujos de Polar checkout/portal).
 */

import { getApiUrl } from '../../config/app-config.js';
import { authStore } from '../../stores/authStore.js';
import { renderChatAddonCard } from './chat-addon-card.js';

const API_BASE = getApiUrl();
const PLAN_PRICE_EUR = 95;

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

function renderPlanCard(container, data) {
    const isActive = data.plan_status === 'active' || data.has_subscription;
    const statusBadge = isActive
        ? '<span style="background:#10b981;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Activo</span>'
        : '<span style="background:#f59e0b;color:#78350f;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Pendiente</span>';

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;">
                    <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                    <div style="font-size:18px;font-weight:700;color:var(--text-primary, #1e293b);">Plan MindLoop</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                        ${statusBadge}
                        <span style="color:#64748b;font-size:13px;">${PLAN_PRICE_EUR}€/mes</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Expuesto globalmente para uso desde main.js bootstrap y desde chat-addon-card
if (typeof window !== 'undefined') {
    window.loadSubscriptionStatus = loadSubscriptionStatus;
}
