/**
 * Modulo de Suscripcion - MindLoop CostOS
 * Gestion de plan, trial, upgrade y facturacion Stripe
 */

import { getApiUrl } from '../../config/app-config.js';
import { authStore } from '../../stores/authStore.js';

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

const PLAN_FEATURES = {
    starter: [
        { text: 'Ingredientes y recetas', included: true },
        { text: 'Pedidos e inventario', included: true },
        { text: 'Dashboard basico', included: true },
        { text: 'Hasta 2 usuarios', included: true },
        { text: 'Escandallos y variantes', included: false },
        { text: 'OCR albaranes', included: false },
        { text: 'Analitica avanzada e IA', included: false },
        { text: 'Gestion de horarios', included: false }
    ],
    profesional: [
        { text: 'Todo lo de Starter', included: true },
        { text: 'Escandallos y variantes', included: true },
        { text: 'OCR albaranes automatico', included: true },
        { text: 'Analitica avanzada (BCG, P&L)', included: true },
        { text: 'Inteligencia IA', included: true },
        { text: 'Gestion de horarios', included: true },
        { text: 'Hasta 5 usuarios', included: true },
        { text: 'Integraciones premium', included: false }
    ],
    premium: [
        { text: 'Todo lo de Profesional', included: true },
        { text: 'Usuarios ilimitados', included: true },
        { text: 'API access', included: true },
        { text: 'Integraciones premium', included: true },
        { text: 'Soporte prioritario', included: true }
    ]
};

/**
 * Carga el estado de suscripcion y renderiza la tarjeta de plan + banner
 */
export async function loadSubscriptionStatus() {
    const container = document.getElementById('plan-info-container');

    try {
        const res = await fetch(API_BASE + '/stripe/subscription-status', {
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!res.ok) {
            if (container) container.innerHTML = '<p style="color:#94a3b8;">No se pudo cargar la informacion del plan</p>';
            return;
        }

        const data = await res.json();

        // Update authStore with fresh data
        authStore.setState({
            plan: data.plan,
            plan_status: data.plan_status,
            trial_days_left: data.trial_days_left,
            max_users: data.max_users,
            has_subscription: data.has_subscription,
            trial_ends_at: data.trial_ends_at
        });

        if (container) renderPlanCard(container, data);
        renderTrialBanner(data);

        // Update sidebar locks with fresh plan data
        window.updateSidebarLocks?.();

        // Show trial expired modal if needed (only once per session)
        const isExpired = data.plan_status === 'expired' || (data.plan === 'trial' && data.trial_days_left !== null && data.trial_days_left <= 0);
        if (isExpired && !window._trialExpiredShown) {
            window._trialExpiredShown = true;
            showTrialExpiredModal();
        }
    } catch (err) {
        console.error('Error loading subscription status:', err);
        if (container) container.innerHTML = '<p style="color:#94a3b8;">Error al cargar el plan</p>';
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
        statusBadge = `<span style="background:#fbbf24;color:#78350f;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Prueba: ${data.trial_days_left || 0} dias restantes</span>`;
    } else if (isExpired) {
        statusBadge = '<span style="background:#ef4444;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Trial expirado</span>';
    } else if (isActive) {
        statusBadge = '<span style="background:#10b981;color:white;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Activo</span>';
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
                    <div style="font-size:18px;font-weight:700;color:var(--text-primary, #1e293b);">Plan ${planName}</div>
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
                        Elegir plan
                    </button>
                ` : ''}
                ${showBilling ? `
                    <button onclick="window.openBillingPortal()"
                        style="background:transparent;color:#6366f1;border:2px solid #6366f1;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;">
                        Gestionar facturacion
                    </button>
                ` : ''}
            </div>
        </div>

        ${isTrialing || isExpired ? `
        <div style="margin-top:16px;padding:14px 16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;border:1px solid #93c5fd;">
            <p style="font-size:13px;color:#1e40af;margin:0;">
                ${isExpired
                    ? 'Tu periodo de prueba ha terminado. Elige un plan para seguir usando todas las funciones.'
                    : `Tienes acceso completo a todas las funciones durante ${data.trial_days_left || 0} dias. Despues podras elegir el plan que mejor se adapte a tu negocio.`
                }
            </p>
        </div>
        ` : ''}
    `;
}

/**
 * Banner de trial con urgencia progresiva
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
    const days = data.trial_days_left || 0;

    if (isExpired || days <= 0) {
        // Expired: red, strong CTA
        banner.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        banner.innerHTML = `
            <span style="flex:1;">Tu periodo de prueba ha terminado. Elige un plan para continuar usando todas las funciones.</span>
            <button onclick="window.promptUpgradePlan()" style="background:white;color:#dc2626;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:13px;">Elegir plan</button>
        `;
    } else if (days <= 1) {
        // Last day: red, urgent
        banner.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        banner.innerHTML = `
            <span style="flex:1;">Ultimo dia de prueba gratuita. Elige tu plan para no perder acceso.</span>
            <button onclick="window.promptUpgradePlan()" style="background:white;color:#dc2626;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:13px;">Elegir plan ahora</button>
        `;
    } else if (days <= 3) {
        // Last 3 days: amber, visible
        banner.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        banner.innerHTML = `
            <span style="flex:1;">Tu prueba termina en <strong>${days}</strong> dias. Elige un plan para seguir con acceso completo.</span>
            <button onclick="window.promptUpgradePlan()" style="background:rgba(255,255,255,0.9);color:#92400e;border:none;padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:13px;">Elegir plan</button>
        `;
    } else {
        // Normal trial: indigo, subtle
        banner.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
        banner.innerHTML = `
            <span style="flex:1;">Te quedan <strong>${days}</strong> dias de prueba gratuita con acceso completo</span>
            <button onclick="window.promptUpgradePlan()" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);padding:8px 20px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;font-size:13px;">Ver planes</button>
        `;
    }
}

/**
 * Modal de trial expirado — se muestra una vez al iniciar sesion si el trial ha terminado
 */
function showTrialExpiredModal() {
    const existing = document.getElementById('trial-expired-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'trial-expired-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);';

    overlay.innerHTML = `
    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:90%;max-width:480px;padding:40px 32px;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <svg width="32" height="32" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>

        <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 12px;font-weight:700;">Tu prueba gratuita ha terminado</h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 8px;">
            Durante estos 14 dias has tenido acceso completo a todas las funciones.
        </p>

        <div style="background:#0f172a;border-radius:12px;padding:16px;margin:20px 0;text-align:left;">
            <p style="color:#64748b;font-size:12px;margin:0 0 10px;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">Con el plan gratuito mantendras:</p>
            <div style="color:#94a3b8;font-size:13px;line-height:2;">
                <div>Ingredientes y recetas</div>
                <div>Pedidos e inventario</div>
                <div>Dashboard basico</div>
            </div>
            <p style="color:#64748b;font-size:12px;margin:12px 0 0;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">Perderas acceso a:</p>
            <div style="color:#ef4444;font-size:13px;line-height:2;opacity:0.8;">
                <div>Escandallos y variantes</div>
                <div>OCR albaranes</div>
                <div>Analitica avanzada e IA</div>
                <div>Gestion de horarios</div>
            </div>
        </div>

        <button id="trial-expired-upgrade" style="width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:white;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:10px;transition:opacity 0.2s;">
            Elegir plan
        </button>
        <button id="trial-expired-starter" style="width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:12px;color:#94a3b8;font-size:13px;cursor:pointer;transition:all 0.2s;">
            Continuar con plan gratuito
        </button>
        <p style="color:#475569;font-size:11px;margin:16px 0 0;">Sin permanencia. Puedes cambiar de plan cuando quieras.</p>
    </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#trial-expired-upgrade').addEventListener('click', () => {
        overlay.remove();
        promptUpgradePlan();
    });

    overlay.querySelector('#trial-expired-starter').addEventListener('click', async () => {
        const btn = overlay.querySelector('#trial-expired-starter');
        btn.textContent = 'Configurando...';
        btn.disabled = true;
        try {
            const res = await fetch(API_BASE + '/stripe/choose-starter', {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                window.showToast?.('Plan Starter activado', 'success');
                // Reload plan data
                await authStore.getState().loadPlanData();
                window.loadSubscriptionStatus?.();
            } else {
                window.showToast?.('Error al cambiar de plan', 'error');
            }
        } catch (e) {
            window.showToast?.('Error de conexion', 'error');
        }
        overlay.remove();
    });
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

    overlay.innerHTML = `
    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:20px;width:92%;max-width:580px;max-height:90vh;overflow-y:auto;padding:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <h2 style="margin:0;color:#f1f5f9;font-size:22px;font-weight:700;">Elige tu plan</h2>
            <button id="upgrade-modal-close" style="background:rgba(255,255,255,0.1);border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:6px 10px;border-radius:8px;line-height:1;">&times;</button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <span style="color:#94a3b8;font-size:13px;">Facturacion</span>
            <div style="display:flex;background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                <button class="billing-toggle active" data-billing="monthly"
                    style="padding:7px 16px;border:none;font-size:12px;cursor:pointer;background:#6366f1;color:#fff;transition:all 0.2s;font-weight:500;">Mensual</button>
                <button class="billing-toggle" data-billing="annual"
                    style="padding:7px 16px;border:none;font-size:12px;cursor:pointer;background:transparent;color:#94a3b8;transition:all 0.2s;font-weight:500;">Anual <span style="color:#10b981;font-weight:600;">-17%</span></button>
            </div>
        </div>

        <div id="upgrade-plans" style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
            ${buildPlanCards()}
        </div>

        <button id="upgrade-submit"
            style="width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">
            Continuar al pago
        </button>
        <p style="text-align:center;color:#64748b;font-size:11px;margin:14px 0 0;">
            Pago seguro con Stripe. Sin permanencia. Cancela cuando quieras.
        </p>
    </div>`;

    document.body.appendChild(overlay);
    setupModalHandlers(overlay);
}

function buildPlanCards() {
    return Object.entries(PLANS).map(([key, p], i) => {
        const isRecommended = i === 1; // Profesional
        const features = PLAN_FEATURES[key] || [];

        return `
        <label class="plan-card" data-plan="${key}"
            style="display:flex;flex-direction:column;gap:10px;padding:16px 18px;background:${isRecommended ? 'rgba(99,102,241,0.1)' : '#0f172a'};border:2px solid ${isRecommended ? '#6366f1' : 'rgba(255,255,255,0.08)'};border-radius:14px;cursor:pointer;transition:all 0.2s;position:relative;">
            ${isRecommended ? '<span style="position:absolute;top:-10px;right:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-size:10px;font-weight:700;padding:3px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">Recomendado</span>' : ''}
            <div style="display:flex;align-items:center;gap:12px;">
                <input type="radio" name="upgrade-plan" value="${key}" ${isRecommended ? 'checked' : ''}
                    style="accent-color:#6366f1;width:18px;height:18px;flex-shrink:0;" />
                <div style="flex:1;display:flex;justify-content:space-between;align-items:baseline;">
                    <span style="color:#f1f5f9;font-weight:600;font-size:16px;">${p.name}</span>
                    <span style="color:#f1f5f9;font-weight:700;font-size:18px;">
                        <span class="plan-price-monthly">${p.monthly}&euro;</span><span class="plan-price-annual" style="display:none">${p.annual}&euro;</span><span class="plan-period-monthly" style="color:#94a3b8;font-size:12px;font-weight:400;">/mes</span><span class="plan-period-annual" style="display:none;color:#94a3b8;font-size:12px;font-weight:400;">/ano</span>
                    </span>
                </div>
            </div>
            <div style="color:#64748b;font-size:11px;margin-left:30px;">${p.users === 999 ? 'Usuarios ilimitados' : `Hasta ${p.users} usuarios`}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-left:30px;">
                ${features.map(f => `
                    <span style="font-size:12px;color:${f.included ? '#94a3b8' : '#475569'};display:flex;align-items:center;gap:4px;min-width:45%;">
                        ${f.included
                            ? '<svg width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
                            : '<svg width="14" height="14" fill="none" stroke="#475569" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
                        }
                        ${f.text}
                    </span>
                `).join('')}
            </div>
        </label>`;
    }).join('');
}

function setupModalHandlers(overlay) {
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
            card.style.background = 'rgba(99,102,241,0.1)';
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
                window.showToast?.(data.error || 'Error al crear sesion de pago', 'error');
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
            window.showToast?.('Error de conexion', 'error');
            submitBtn.textContent = 'Continuar al pago';
            submitBtn.style.opacity = '1';
            submitBtn.disabled = false;
        }
    });
}

/**
 * Abre el portal de facturacion de Stripe
 */
export async function openBillingPortal() {
    try {
        window.showToast?.('Abriendo portal de facturacion...', 'info');
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
        window.showToast?.('Error de conexion', 'error');
    }
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.loadSubscriptionStatus = loadSubscriptionStatus;
    window.promptUpgradePlan = promptUpgradePlan;
    window.openBillingPortal = openBillingPortal;
}
