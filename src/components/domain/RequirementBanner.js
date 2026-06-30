/**
 * Requirement Banner — banner ámbar de prerequisito faltante.
 *
 * Se monta arriba de pestañas que dependen lógicamente de otra:
 * - Recetas requiere Ingredientes (no puedes hacer escandallo sin ingredientes).
 * - Pedidos requiere Proveedores.
 *
 * Si la dependencia está cubierta (hay >=1 dato), el banner no se renderiza.
 * NO bloquea la interacción — sólo señala dónde empezar.
 *
 * Acompaña al OnboardingChecklist del dashboard cuando el cliente entra
 * directamente a una pestaña sin terminar onboarding.
 */
import { escapeHTML } from '../../utils/helpers.js';

/**
 * Inyecta el banner como primer hijo del container si no existe ya.
 *
 * @param {HTMLElement} parent - contenedor de la pestaña (donde renderiza la UI)
 * @param {Object} opts
 * @param {string} opts.id - id único del banner (para idempotencia)
 * @param {string} opts.message - mensaje principal
 * @param {string} opts.ctaLabel - texto del botón
 * @param {string} opts.ctaTab - nombre del tab al que navegar
 */
export function renderRequirementBanner(parent, { id, message, ctaLabel, ctaTab }) {
    if (!parent) return;
    if (document.getElementById(id)) return; // idempotente

    const html = `
        <div id="${escapeHTML(id)}" style="
            background:linear-gradient(135deg,#fef3c7,#fde68a);
            border:1px solid #f59e0b;
            border-radius:12px;
            padding:14px 18px;
            margin-bottom:16px;
            display:flex;align-items:center;gap:14px;
            box-shadow:0 1px 3px rgba(245,158,11,0.15);
        ">
            <div style="
                background:#f59e0b;color:white;
                width:32px;height:32px;border-radius:8px;
                display:flex;align-items:center;justify-content:center;
                font-size:16px;flex-shrink:0;
            ">⚠️</div>
            <div style="flex:1;color:#78350f;font-size:14px;font-weight:500;">
                ${escapeHTML(message)}
            </div>
            <button onclick="(window.cambiarTab||function(t){const b=document.querySelector('[data-tab=\\''+t+'\\']');if(b)b.click();})('${escapeHTML(ctaTab)}')"
                    style="
                        background:#92400e;color:white;border:none;
                        padding:8px 16px;border-radius:8px;
                        font-weight:600;font-size:13px;cursor:pointer;
                        white-space:nowrap;flex-shrink:0;
                    ">
                ${escapeHTML(ctaLabel)} →
            </button>
        </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    parent.insertBefore(wrapper.firstElementChild, parent.firstChild);
}

/**
 * Quita el banner si existe (cuando el prerequisito se cumple).
 */
export function removeRequirementBanner(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}
