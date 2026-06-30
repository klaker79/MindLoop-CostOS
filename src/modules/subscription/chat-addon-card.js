/**
 * Chat IA — tarjeta en Settings.
 *
 * En el modelo single-plan (2026-06-08) el Asistente IA viene INCLUIDO en
 * el plan. Esta tarjeta solo muestra estado y consumo del mes (cuota 300
 * consultas/mes gestionada por chatAddonGate en backend).
 *
 * Las funciones de checkout/customer-portal de Polar quedaron obsoletas
 * al fusionar el add-on dentro del plan.
 */

import { api } from '../../api/client.js';
import { getDateLocale } from '../../utils/helpers.js';

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
    const used = Number(status.used || 0);
    const limit = Number(status.limit || 300);
    const resetsAt = status.resets_at ? new Date(status.resets_at) : null;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const resetStr = resetsAt
        ? resetsAt.toLocaleDateString(getDateLocale(), { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    container.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:20px;">🤖</div>
            <div>
                <div style="font-size:15px;font-weight:600;color:var(--text-primary,#1e293b);">Asistente IA</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">Incluido en tu plan · 300 consultas/mes</div>
            </div>
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
}

if (typeof window !== 'undefined') {
    window.renderChatAddonCard = renderChatAddonCard;
}
