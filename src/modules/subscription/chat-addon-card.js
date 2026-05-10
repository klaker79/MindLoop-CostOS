/**
 * Chat IA Add-on — tarjeta en Settings.
 *
 * Renderiza el estado del add-on (activado / no activado) y dispara el
 * flujo de Polar (Merchant of Record):
 *   - Activar  → POST /chat-addon/checkout-session → redirige a Polar
 *   - Cancelar → POST /chat-addon/customer-portal  → redirige al portal
 *
 * El frontend NUNCA cambia chat_addon directamente. El flag se setea
 * cuando Polar manda el webhook firmado tras el cobro real.
 *
 * UX: la activación abre Polar (página segura, marca clara, IVA correcto).
 * El cliente confirma el cargo en Polar, no en nuestra app.
 */

import { api } from '../../api/client.js';
import { getDateLocale } from '../../utils/helpers.js';

const ADDON_PRICE_EUR = 30;

export async function renderChatAddonCard(container) {
    if (!container) return;

    // Volver de Polar tras pagar: el webhook pudo no haber llegado todavía
    // (latencia ~1-3s normalmente). Esperamos ese rango antes de pedir el
    // status para que el cliente vea "activado" desde la primera carga.
    handlePolarReturn();

    container.innerHTML = `<p style="color:#94a3b8;">Cargando estado del Asistente IA...</p>`;

    try {
        const status = await api.chatStatus();
        paint(container, status);
    } catch (err) {
        container.innerHTML = `<p style="color:#94a3b8;">No se pudo cargar el estado del Asistente IA</p>`;
        console.error('chat-status failed:', err);
    }
}

let polarReturnHandled = false;
function handlePolarReturn() {
    if (polarReturnHandled) return;
    const params = new URLSearchParams(window.location.search);
    const addon = params.get('addon');
    if (!addon) return;
    polarReturnHandled = true;

    if (addon === 'success') {
        window.showToast?.('🎉 Asistente IA activado. Recargando...', 'success', 3000);
        // Damos tiempo al webhook + UI de toast antes del reload
        setTimeout(() => {
            params.delete('addon');
            const cleanUrl = window.location.pathname +
                (params.toString() ? `?${params.toString()}` : '') +
                window.location.hash;
            window.location.replace(cleanUrl);
        }, 2500);
    } else {
        // ?addon=cancel u otros valores → solo limpiamos el query param
        params.delete('addon');
        const cleanUrl = window.location.pathname +
            (params.toString() ? `?${params.toString()}` : '') +
            window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
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
            ?.addEventListener('click', () => startCheckout());
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
        ?.addEventListener('click', () => openCustomerPortal());
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

/**
 * Inicia el flujo de checkout en Polar. Llama al backend para obtener la
 * URL de checkout y redirige al cliente. La activación real del flag
 * chat_addon ocurre cuando Polar manda el webhook tras el cobro.
 *
 * No usamos modal de confirmación intermedio: Polar es la página segura
 * de pago y allí el cliente ve precio, IVA y método de pago de forma
 * explícita antes de confirmar. Doblar la confirmación añade fricción.
 */
async function startCheckout() {
    const btn = document.getElementById('chat-addon-activate-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Abriendo página de pago...';
        btn.style.opacity = '0.7';
    }
    try {
        const res = await api.createChatAddonCheckout();
        if (!res?.url) throw new Error('Backend no devolvió URL de checkout');
        // Redirigir al checkout de Polar (página segura, MoR)
        window.location.href = res.url;
    } catch (err) {
        console.error('createChatAddonCheckout failed:', err);
        window.showToast?.('No se pudo abrir el pago. Inténtalo de nuevo.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = `Activar Asistente IA · +${ADDON_PRICE_EUR}€/mes`;
            btn.style.opacity = '1';
        }
    }
}

/**
 * Abre el portal del cliente en Polar para que el usuario pueda cancelar
 * o cambiar tarjeta. La cancelación efectiva del flag chat_addon llega
 * por webhook (subscription.canceled).
 */
async function openCustomerPortal() {
    const btn = document.getElementById('chat-addon-deactivate-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Abriendo portal...';
    }
    try {
        const res = await api.openChatAddonPortal();
        if (!res?.url) throw new Error('Backend no devolvió URL del portal');
        window.location.href = res.url;
    } catch (err) {
        console.error('openChatAddonPortal failed:', err);
        const msg = err?.status === 400
            ? 'No tienes una suscripción activa para gestionar.'
            : 'No se pudo abrir el portal. Inténtalo de nuevo.';
        window.showToast?.(msg, 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Cancelar add-on';
        }
    }
}

if (typeof window !== 'undefined') {
    window.renderChatAddonCard = renderChatAddonCard;
}
