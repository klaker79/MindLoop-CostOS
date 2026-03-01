/**
 * Módulo de Suscripción - MindLoop CostOS
 * Gestión de plan, trial, upgrade y facturación Stripe
 */

import { getApiUrl } from '../../config/app-config.js';
import { t } from '@/i18n/index.js';

const API_BASE = getApiUrl();

function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.authToken : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

const PLANS = {
    starter: { name: 'Starter', monthly: 49, annual: 490, users: 2, level: 1 },
    profesional: { name: 'Profesional', monthly: 89, annual: 890, users: 5, level: 2 },
    premium: { name: 'Premium', monthly: 149, annual: 1490, users: 999, level: 3 }
};

/**
 * Carga el estado de suscripción y renderiza la tarjeta de plan
 */
export async function loadSubscriptionStatus() {
    const container = document.getElementById('plan-info-container');
    if (!container) return;

    try {
        const res = await fetch(API_BASE + '/stripe/subscription-status', {
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!res.ok) {
            container.innerHTML = '<p style="color:#94a3b8;">No se pudo cargar la información del plan</p>';
            return;
        }

        const data = await res.json();
        renderPlanCard(container, data);
        renderTrialBanner(data);
    } catch (err) {
        console.error('Error loading subscription status:', err);
        container.innerHTML = '<p style="color:#94a3b8;">Error al cargar el plan</p>';
    }
}

function renderPlanCard(container, data) {
    const planName = PLANS[data.plan]?.name || data.plan || 'Trial';
    const isTrialing = data.plan === 'trial' || data.plan_status === 'trialing';
    const isExpired = data.plan_status === 'expired';
    const isActive = data.plan_status === 'active';
    const isPastDue = data.plan_status === 'past_due';

    let statusBadge = '';
    if (isTrialing && !isExpired) {
        statusBadge = `<span style="background:#fbbf24;color:#78350f;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${t('settings:plan_trial_days_left', { days: data.trial_days_left || 0 })}</span>`;
    } else if (isExpired) {
        statusBadge = '<span style="background:#ef4444;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Trial expirado</span>';
    } else if (isActive) {
        statusBadge = `<span style="background:#10b981;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${t('settings:plan_active')}</span>`;
    } else if (isPastDue) {
        statusBadge = '<span style="background:#f59e0b;color:#78350f;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Pago pendiente</span>';
    }

    const showUpgrade = isTrialing || isExpired || !data.has_subscription;
    const showBilling = data.has_subscription;

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;">
                    <svg width="24" height="24" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                    <div style="font-size:18px;font-weight:700;color:#1e293b;">Plan ${planName}</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
                        ${statusBadge}
                        ${data.trial_ends_at && isTrialing ? `<span style="color:#64748b;font-size:12px;">Hasta ${new Date(data.trial_ends_at).toLocaleDateString('es-ES')}</span>` : ''}
                    </div>
                </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${showUpgrade ? `
                    <button onclick="window.promptUpgradePlan()"
                        style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:none;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        ${t('settings:btn_change_plan')}
                    </button>
                ` : ''}
                ${showBilling ? `
                    <button onclick="window.openBillingPortal()"
                        style="background:transparent;color:#6366f1;border:2px solid #6366f1;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        ${t('settings:btn_manage_billing')}
                    </button>
                ` : ''}
            </div>
        </div>

        ${isTrialing || isExpired ? `
        <div style="margin-top:16px;padding:14px 16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;border:1px solid #93c5fd;">
            <p style="font-size:13px;color:#1e40af;margin:0;">
                ${isExpired
                    ? 'Tu periodo de prueba ha terminado. Elige un plan para seguir usando todas las funciones.'
                    : `Tienes acceso completo durante ${data.trial_days_left || 0} d\u00edas. Despu\u00e9s podr\u00e1s elegir el plan que mejor se adapte a tu negocio.`
                }
            </p>
        </div>
        ` : ''}
    `;
}

/**
 * Muestra/oculta el banner de trial en el header de la app
 */
function renderTrialBanner(data) {
    const banner = document.getElementById('trial-banner');
    if (!banner) return;

    const isTrialing = data.plan === 'trial' || data.plan_status === 'trialing';
    const isExpired = data.plan_status === 'expired';

    if (!isTrialing && !isExpired) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'flex';

    if (isExpired) {
        banner.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        banner.innerHTML = `
            <span style="flex:1;">Tu periodo de prueba ha terminado. Elige un plan para continuar.</span>
            <button onclick="window.promptUpgradePlan()" style="background:white;color:#dc2626;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;">Elegir plan</button>
        `;
    } else {
        const days = data.trial_days_left || 0;
        const urgent = days <= 3;
        banner.style.background = urgent
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
        banner.innerHTML = `
            <span style="flex:1;">Te quedan <strong>${days}</strong> d\u00edas de prueba gratuita</span>
            <button onclick="window.promptUpgradePlan()" style="background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.3);padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;">Elegir plan</button>
        `;
    }
}

/**
 * Modal para elegir plan y upgrade via Stripe Checkout
 */
export function promptUpgradePlan() {
    // Remove any existing modal
    const existing = document.getElementById('upgrade-plan-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'upgrade-plan-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

    const availablePlans = Object.entries(PLANS);

    overlay.innerHTML = `
    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;width:92%;max-width:560px;max-height:90vh;overflow-y:auto;padding:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <h2 style="margin:0;color:#f1f5f9;font-size:20px;">Elige tu plan</h2>
            <button id="upgrade-modal-close" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px 8px;">&times;</button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="color:#94a3b8;font-size:13px;">Facturaci\u00f3n</span>
            <div style="display:flex;background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                <button class="billing-toggle active" data-billing="monthly"
                    style="padding:6px 14px;border:none;font-size:12px;cursor:pointer;background:#6366f1;color:#fff;transition:all 0.2s;">Mensual</button>
                <button class="billing-toggle" data-billing="annual"
                    style="padding:6px 14px;border:none;font-size:12px;cursor:pointer;background:transparent;color:#94a3b8;transition:all 0.2s;">Anual <span style="color:#10b981;font-size:10px;">-17%</span></button>
            </div>
        </div>

        <div id="upgrade-plans" style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
            ${availablePlans.map(([key, p], i) => `
                <label class="plan-card" data-plan="${key}"
                    style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:${i === 1 ? 'rgba(99,102,241,0.12)' : '#0f172a'};border:2px solid ${i === 1 ? '#6366f1' : 'rgba(255,255,255,0.08)'};border-radius:12px;cursor:pointer;transition:all 0.2s;">
                    <input type="radio" name="upgrade-plan" value="${key}" ${i === 1 ? 'checked' : ''}
                        style="accent-color:#6366f1;width:18px;height:18px;flex-shrink:0;" />
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;">
                            <span style="color:#f1f5f9;font-weight:600;font-size:15px;">${p.name}</span>
                            <span style="color:#f1f5f9;font-weight:700;font-size:16px;">
                                <span class="plan-price-monthly">${p.monthly}\u20ac</span><span class="plan-price-annual" style="display:none">${p.annual}\u20ac</span><span class="plan-period-monthly" style="color:#94a3b8;font-size:12px;font-weight:400;">/mes</span><span class="plan-period-annual" style="display:none;color:#94a3b8;font-size:12px;font-weight:400;">/a\u00f1o</span>
                            </span>
                        </div>
                        <div style="color:#94a3b8;font-size:12px;margin-top:3px;line-height:1.4;">${getPlanFeatures(key)}</div>
                        <div style="color:#64748b;font-size:11px;margin-top:2px;">${p.users === 999 ? 'Usuarios ilimitados' : `Hasta ${p.users} usuarios`}</div>
                    </div>
                </label>
            `).join('')}
        </div>

        <button id="upgrade-submit"
            style="width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">
            Continuar al pago
        </button>
        <p style="text-align:center;color:#64748b;font-size:11px;margin:12px 0 0;">Pago seguro con Stripe. Puedes cancelar en cualquier momento.</p>
    </div>`;

    document.body.appendChild(overlay);

    // Billing toggle
    let billing = 'monthly';
    overlay.querySelectorAll('.billing-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            billing = btn.dataset.billing;
            overlay.querySelectorAll('.billing-toggle').forEach(b => {
                const isActive = b.dataset.billing === billing;
                b.style.background = isActive ? '#6366f1' : 'transparent';
                b.style.color = isActive ? '#fff' : '#94a3b8';
            });
            overlay.querySelectorAll('.plan-price-monthly').forEach(el => el.style.display = billing === 'monthly' ? '' : 'none');
            overlay.querySelectorAll('.plan-price-annual').forEach(el => el.style.display = billing === 'annual' ? '' : 'none');
            overlay.querySelectorAll('.plan-period-monthly').forEach(el => el.style.display = billing === 'monthly' ? '' : 'none');
            overlay.querySelectorAll('.plan-period-annual').forEach(el => el.style.display = billing === 'annual' ? '' : 'none');
        });
    });

    // Plan card selection highlight
    overlay.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', () => {
            overlay.querySelectorAll('.plan-card').forEach(c => {
                c.style.background = '#0f172a';
                c.style.borderColor = 'rgba(255,255,255,0.08)';
            });
            card.style.background = 'rgba(99,102,241,0.12)';
            card.style.borderColor = '#6366f1';
            card.querySelector('input[type=radio]').checked = true;
        });
    });

    // Close
    const closeModal = () => overlay.remove();
    overlay.querySelector('#upgrade-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Submit — call /stripe/create-checkout-session
    overlay.querySelector('#upgrade-submit').addEventListener('click', async () => {
        const selectedPlan = overlay.querySelector('input[name=upgrade-plan]:checked')?.value;
        if (!selectedPlan) return;

        const submitBtn = overlay.querySelector('#upgrade-submit');
        submitBtn.textContent = 'Redirigiendo a Stripe...';
        submitBtn.style.opacity = '0.6';
        submitBtn.disabled = true;

        const priceKey = `${selectedPlan}_${billing}`;

        try {
            const res = await fetch(API_BASE + '/stripe/create-checkout-session', {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ priceKey })
            });

            const data = await res.json();

            if (!res.ok) {
                window.showToast?.(data.error || 'Error al crear sesión de pago', 'error');
                submitBtn.textContent = 'Continuar al pago';
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
                return;
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                window.showToast?.('Error al obtener URL de pago', 'error');
                submitBtn.textContent = 'Continuar al pago';
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
            }
        } catch (err) {
            window.showToast?.('Error de conexión', 'error');
            submitBtn.textContent = 'Continuar al pago';
            submitBtn.style.opacity = '1';
            submitBtn.disabled = false;
        }
    });
}

/**
 * Abre el portal de facturación de Stripe
 */
export async function openBillingPortal() {
    try {
        window.showToast?.('Abriendo portal de facturación...', 'info');
        const res = await fetch(API_BASE + '/stripe/customer-portal', {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        const data = await res.json();

        if (!res.ok) {
            window.showToast?.(data.error || 'Error al abrir el portal', 'error');
            return;
        }

        if (data.url) {
            window.location.href = data.url;
        }
    } catch (err) {
        window.showToast?.('Error de conexión', 'error');
    }
}

function getPlanFeatures(plan) {
    const features = {
        starter: 'Ingredientes, recetas, pedidos, inventario, dashboard',
        profesional: 'Todo Starter + escandallos, variantes, OCR albaranes, analítica avanzada',
        premium: 'Todo Profesional + API access, soporte prioritario, integraciones premium'
    };
    return features[plan] || '';
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.loadSubscriptionStatus = loadSubscriptionStatus;
    window.promptUpgradePlan = promptUpgradePlan;
    window.openBillingPortal = openBillingPortal;
}
