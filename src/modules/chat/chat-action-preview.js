/**
 * Modal de validación previa para acciones del chat (botón Confirmar).
 *
 * Diseño Iker 2026-06-06: "csi confirmas, con modal validando el cambio".
 * Antes de ejecutar el [ACTION:...] que devuelve el chat, mostramos un
 * modal con:
 *   - Qué entidad se va a modificar (nombre del ingrediente / receta / etc).
 *   - Qué campo va a cambiar y qué valor nuevo le ponemos.
 *   - Valor actual (cuando lo podemos resolver desde el cache de window.*).
 *   - Botones "Aplicar cambio" (verde) y "Cancelar" (gris). Esc/click fuera → cancela.
 *
 * NO depende del DOM del chat — se monta como overlay independiente para
 * que se pueda usar también desde otros sitios (Coach IA en el futuro).
 */

import { escapeHTML, cm } from '../../utils/helpers.js';

const MODAL_ID = 'chat-action-preview-modal';

function fmtValor(field, value) {
    if (value === null || value === undefined) return '—';
    const v = String(value).trim();
    if (field === 'precio' || field === 'precio_venta') {
        const n = parseFloat(v);
        return Number.isFinite(n) ? cm(n.toFixed(2)) : v;
    }
    if (field === 'stock' || field === 'cantidad') {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n.toString() : v;
    }
    return v;
}

function resolverActual(entity, name, field) {
    if (!name || !field) return null;
    const lower = String(name).toLowerCase();
    if (entity === 'ingrediente') {
        const ing = (window.ingredientes || []).find(i =>
            (i.nombre || '').toLowerCase().includes(lower)
        );
        if (!ing) return null;
        if (field === 'precio') return ing.precio;
        if (field === 'stock') return ing.stock_actual ?? ing.stockActual;
        return null;
    }
    if (entity === 'receta') {
        const rec = (window.recetas || []).find(r =>
            (r.nombre || '').toLowerCase().includes(lower)
        );
        if (!rec) return null;
        if (field === 'precio' || field === 'precio_venta') return rec.precio_venta;
        return null;
    }
    return null;
}

/**
 * Parsea actionData "update|ingrediente|TOMATE|precio|2.50" → estructura.
 */
function parseAction(actionData) {
    const parts = String(actionData || '').split('|');
    return {
        action: parts[0] || '',
        entity: parts[1] || '',
        name: parts[2] || '',
        field: parts[3] || '',
        value: parts[4] || '',
        extra: parts.slice(5)
    };
}

const LABEL_ACTION = {
    update: 'Actualizar',
    add: 'Crear',
    merma: 'Registrar merma'
};

const LABEL_ENTITY = {
    ingrediente: 'ingrediente',
    receta: 'receta',
    receta_ingrediente: 'ingrediente de receta',
    venta: 'venta',
    pedido: 'pedido'
};

const LABEL_FIELD = {
    precio: 'precio',
    precio_venta: 'precio de venta',
    stock: 'stock actual',
    cantidad: 'cantidad'
};

/**
 * Genera un objeto con título, detalle y campos para mostrar en el modal.
 */
export function describeAction(actionData) {
    const parsed = parseAction(actionData);
    const actionLabel = LABEL_ACTION[parsed.action] || parsed.action;
    const entityLabel = LABEL_ENTITY[parsed.entity] || parsed.entity;
    const fieldLabel = LABEL_FIELD[parsed.field] || parsed.field;
    const valorActual = resolverActual(parsed.entity, parsed.name, parsed.field);

    return {
        parsed,
        titulo: `${actionLabel} ${entityLabel}`,
        objeto: parsed.name,
        campo: fieldLabel,
        valorNuevo: fmtValor(parsed.field, parsed.value),
        valorActual: valorActual !== null ? fmtValor(parsed.field, valorActual) : null
    };
}

let escListener = null;
function bindEsc(close) {
    escListener = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escListener);
}
function unbindEsc() {
    if (escListener) document.removeEventListener('keydown', escListener);
    escListener = null;
}

/**
 * Muestra el modal de validación previa.
 *
 * @param {string} actionData - el ACTION crudo del chat
 * @returns {Promise<boolean>} true si el usuario aplica, false si cancela
 */
export function showActionConfirmModal(actionData) {
    return new Promise((resolve) => {
        const desc = describeAction(actionData);

        // Si la acción no se reconoce, no abrimos modal — devolvemos true
        // para no bloquear el flujo legacy (executeAction validará después).
        if (!desc.parsed.action || !desc.parsed.entity) {
            resolve(true);
            return;
        }

        // Si ya hay un modal abierto, lo cerramos antes
        document.getElementById(MODAL_ID)?.remove();

        const overlay = document.createElement('div');
        overlay.id = MODAL_ID;
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15, 23, 42, 0.55);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            animation: cap-fade 0.18s ease-out;
        `;

        // Construir comparación valor actual → valor nuevo cuando se puede
        const comparacionHTML = desc.valorActual !== null
            ? `<div class="cap-compare">
                    <div class="cap-side cap-side--current">
                        <div class="cap-side__label">Valor actual</div>
                        <div class="cap-side__value">${escapeHTML(String(desc.valorActual))}</div>
                    </div>
                    <div class="cap-arrow">→</div>
                    <div class="cap-side cap-side--new">
                        <div class="cap-side__label">Valor nuevo</div>
                        <div class="cap-side__value">${escapeHTML(String(desc.valorNuevo))}</div>
                    </div>
               </div>`
            : `<div class="cap-single">
                    <div class="cap-side__label">Valor a aplicar</div>
                    <div class="cap-side__value">${escapeHTML(String(desc.valorNuevo))}</div>
               </div>`;

        overlay.innerHTML = `
            <style>
                @keyframes cap-fade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes cap-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
                #${MODAL_ID} .cap-modal {
                    background: white; border-radius: 16px; max-width: 460px; width: 100%;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
                    animation: cap-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                #${MODAL_ID} .cap-header { padding: 22px 24px 8px; }
                #${MODAL_ID} .cap-warning {
                    display: inline-flex; align-items: center; gap: 6px;
                    background: #fef3c7; color: #92400e;
                    padding: 4px 10px; border-radius: 999px;
                    font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.4px;
                }
                #${MODAL_ID} .cap-title {
                    margin: 12px 0 4px; font-size: 18px; font-weight: 700; color: #111827;
                }
                #${MODAL_ID} .cap-subtitle { margin: 0; font-size: 14px; color: #6b7280; }
                #${MODAL_ID} .cap-object { color: #111827; font-weight: 600; }
                #${MODAL_ID} .cap-body { padding: 16px 24px 8px; }
                #${MODAL_ID} .cap-compare {
                    display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px;
                    align-items: center; padding: 14px;
                    background: #f9fafb; border-radius: 10px;
                }
                #${MODAL_ID} .cap-single {
                    padding: 14px; background: #f9fafb; border-radius: 10px; text-align: center;
                }
                #${MODAL_ID} .cap-side { text-align: center; }
                #${MODAL_ID} .cap-side__label {
                    font-size: 11px; color: #6b7280; text-transform: uppercase;
                    letter-spacing: 0.4px; font-weight: 600; margin-bottom: 4px;
                }
                #${MODAL_ID} .cap-side__value {
                    font-size: 18px; font-weight: 700; color: #111827;
                }
                #${MODAL_ID} .cap-side--new .cap-side__value { color: #047857; }
                #${MODAL_ID} .cap-arrow { color: #9ca3af; font-size: 22px; font-weight: 700; }
                #${MODAL_ID} .cap-footer {
                    display: flex; gap: 8px; justify-content: flex-end;
                    padding: 16px 24px; background: #fafafa;
                    border-radius: 0 0 16px 16px;
                }
                #${MODAL_ID} .cap-btn {
                    border: 1px solid transparent; padding: 9px 16px; border-radius: 8px;
                    font-weight: 700; font-size: 14px; cursor: pointer;
                }
                #${MODAL_ID} .cap-btn--ghost {
                    background: white; color: #374151; border-color: #e5e7eb;
                }
                #${MODAL_ID} .cap-btn--ghost:hover { background: #f9fafb; }
                #${MODAL_ID} .cap-btn--apply {
                    background: linear-gradient(135deg, #10b981, #059669); color: white;
                    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.35);
                }
                #${MODAL_ID} .cap-btn--apply:hover { transform: translateY(-1px); }
            </style>
            <div class="cap-modal" role="dialog" aria-modal="true">
                <div class="cap-header">
                    <span class="cap-warning">⚠ Confirmar cambio</span>
                    <h2 class="cap-title">${escapeHTML(desc.titulo)}</h2>
                    <p class="cap-subtitle">Vas a modificar el <strong>${escapeHTML(desc.campo)}</strong> de <span class="cap-object">${escapeHTML(desc.objeto)}</span>.</p>
                </div>
                <div class="cap-body">${comparacionHTML}</div>
                <div class="cap-footer">
                    <button type="button" class="cap-btn cap-btn--ghost" data-action="cancel">Cancelar</button>
                    <button type="button" class="cap-btn cap-btn--apply" data-action="apply">Aplicar cambio</button>
                </div>
            </div>
        `;

        const close = (decision) => {
            unbindEsc();
            overlay.remove();
            resolve(decision);
        };

        document.body.appendChild(overlay);
        bindEsc(() => close(false));

        overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(false));
        overlay.querySelector('[data-action="apply"]')?.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}
