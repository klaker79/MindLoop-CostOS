/**
 * Chat IA Add-on — tarjeta en Settings.
 *
 * Renderiza el estado del add-on (activado / no activado) y permite
 * activar/desactivar. Muestra contador X/300 y fecha de reset cuando está activo.
 *
 * El cargo real (30€/mes) lo gestionará el proveedor de pago cuando se enchufe;
 * mientras tanto los endpoints /chat-addon/activate y /deactivate son
 * placeholders SIN pago y se eliminarán al integrar Stripe (u otro).
 *
 * UX: la activación pide confirmación EXPLÍCITA del importe (Iker lo enfatizó
 * — un click no debe poder generar un cobro sin que el usuario lo entienda).
 */

import { api } from '../../api/client.js';
import { getDateLocale } from '../../utils/helpers.js';

const ADDON_PRICE_EUR = 30;

export async function renderChatAddonCard(container) {
    if (!container) return;
    container.innerHTML = `<p style="color:#94a3b8;">Cargando estado del Asistente IA...</p>`;

    try {
        const status = await api.chatStatus();
        paint(container, status);
    } catch (err) {
        container.innerHTML = `<p style="color:#94a3b8;">No se pudo cargar el estado del Asistente IA</p>`;
        console.error('chat-status failed:', err);
    }
}

function paint(container, status) {
    const enabled = !!status.enabled;
    const used = Number(status.used || 0);
    const limit = Number(status.limit || 300);
    const resetsAt = status.resets_at ? new Date(status.resets_at) : null;
    const pct = Math.min(100, Math.round((used / limit) * 100));

    if (!enabled) {
        container.innerHTML = renderInactiveState();
        container.querySelector('#chat-addon-activate-btn')
            ?.addEventListener('click', () => promptActivation(container));
        return;
    }

    const resetStr = resetsAt
        ? resetsAt.toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:20px;">🤖</div>
                <div>
                    <div style="font-size:15px;font-weight:600;color:var(--text-primary,#1e293b);">Asistente IA activado</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">${ADDON_PRICE_EUR}€/mes · 300 consultas/mes</div>
                </div>
            </div>
            <button id="chat-addon-deactivate-btn"
                style="background:transparent;color:#ef4444;border:1px solid #fca5a5;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">
                Cancelar add-on
            </button>
        </div>

        <div style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;color:#475569;margin-bottom:6px;">
                <span>Consultas este mes</span>
                <span><strong>${used}</strong> / ${limit}</span>
            </div>
            <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#10b981,#059669);transition:width 0.3s;"></div>
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:8px;">
                Próximo reset: <strong>${resetStr}</strong>
            </div>
        </div>
    `;

    container.querySelector('#chat-addon-deactivate-btn')
        ?.addEventListener('click', () => confirmDeactivation(container));
}

function renderInactiveState() {
    return `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:6px 0;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🤖</div>
            <div style="flex:1;">
                <div style="font-size:15px;font-weight:600;color:var(--text-primary,#1e293b);margin-bottom:4px;">Asistente IA</div>
                <div style="font-size:13px;color:#64748b;line-height:1.5;margin-bottom:14px;">
                    Habla con Chef Costos para preguntar por tus números, ingredientes y recetas en lenguaje natural. Hasta 300 consultas/mes.
                </div>
                <button id="chat-addon-activate-btn"
                    style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                    Activar Asistente IA · +${ADDON_PRICE_EUR}€/mes
                </button>
            </div>
        </div>
    `;
}

function promptActivation(container) {
    const existing = document.getElementById('chat-addon-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'chat-addon-confirm-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;width:90%;max-width:440px;padding:28px;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:24px;">🤖</div>
                <h2 style="margin:0;font-size:18px;font-weight:700;color:#1e293b;">Activar Asistente IA</h2>
            </div>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 14px;">
                Vas a activar el add-on <strong>Asistente IA</strong> por <strong>${ADDON_PRICE_EUR}€ al mes</strong>.
            </p>
            <ul style="color:#475569;font-size:13px;line-height:1.8;margin:0 0 18px;padding-left:20px;">
                <li>Hasta <strong>300 consultas/mes</strong> a Chef Costos</li>
                <li>Se renueva automáticamente cada mes</li>
                <li>Puedes <strong>cancelar en cualquier momento</strong> desde esta misma pantalla</li>
            </ul>
            <label style="display:flex;align-items:flex-start;gap:8px;background:#f8fafc;padding:10px 12px;border-radius:8px;font-size:13px;color:#475569;cursor:pointer;margin-bottom:18px;">
                <input type="checkbox" id="chat-addon-consent" style="margin-top:2px;">
                <span>Entiendo que se cargará <strong>${ADDON_PRICE_EUR}€/mes</strong> en mi método de pago hasta que cancele.</span>
            </label>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="chat-addon-cancel-btn"
                    style="background:transparent;color:#64748b;border:1px solid #e2e8f0;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
                    Cancelar
                </button>
                <button id="chat-addon-confirm-btn" disabled
                    style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;cursor:not-allowed;opacity:0.5;">
                    Confirmar y activar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const consent = overlay.querySelector('#chat-addon-consent');
    const confirmBtn = overlay.querySelector('#chat-addon-confirm-btn');
    consent.addEventListener('change', () => {
        confirmBtn.disabled = !consent.checked;
        confirmBtn.style.cursor = consent.checked ? 'pointer' : 'not-allowed';
        confirmBtn.style.opacity = consent.checked ? '1' : '0.5';
    });

    overlay.querySelector('#chat-addon-cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Activando...';
        try {
            await api.activateChatAddon();
            overlay.remove();
            window.showToast?.('Asistente IA activado. Recarga para usarlo.', 'success');
            await renderChatAddonCard(container);
            // Recargar plan global para que el widget se monte en próxima carga
            window.loadSubscriptionStatus?.();
        } catch (err) {
            console.error('activateChatAddon failed:', err);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirmar y activar';
            window.showToast?.('Error al activar. Inténtalo de nuevo.', 'error');
        }
    });
}

function confirmDeactivation(container) {
    const ok = window.confirm(
        '¿Cancelar el add-on Asistente IA?\n\n' +
        'Dejarás de tener acceso al chat al final del ciclo actual. ' +
        'Tu contador de consultas se conserva hasta entonces.'
    );
    if (!ok) return;

    api.deactivateChatAddon()
        .then(async () => {
            window.showToast?.('Add-on cancelado.', 'info');
            await renderChatAddonCard(container);
            window.loadSubscriptionStatus?.();
        })
        .catch(err => {
            console.error('deactivateChatAddon failed:', err);
            window.showToast?.('Error al cancelar. Inténtalo de nuevo.', 'error');
        });
}

if (typeof window !== 'undefined') {
    window.renderChatAddonCard = renderChatAddonCard;
}
