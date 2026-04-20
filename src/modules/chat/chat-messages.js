/**
 * Chat — Render de mensajes, envío al backend y botones rápidos.
 *
 * Este módulo posee toda la manipulación del DOM del panel de mensajes:
 *   - addMessage / addMessageWithAction — insertan un mensaje (con botón PDF
 *     para el bot, con confirm/cancel si viene con [ACTION:...]).
 *   - showTyping / hideTyping — indicador de 3 puntos.
 *   - sendMessage — ruta dual: POST /api/chat (Claude, multi-tenant por JWT)
 *     o webhook n8n legacy con payload grande de getCurrentTabContext.
 *   - renderChatHistory — re-render desde `getMessages()` usando DocumentFragment.
 *   - updateQuickButtons — 4 sugerencias contextuales según pestaña activa.
 *   - clearChat — borrado con doble-click (anti accidental).
 *
 * El listener de tab-click se registra en top-level al importar este módulo.
 */

import { logger } from '../../utils/logger.js';
import { appConfig } from '../../config/app-config.js';
import { api } from '../../api/client.js';
import { t } from '@/i18n/index.js';
import { parseMarkdown } from './chat-markdown.js';
import { getCurrentTab, getCurrentTabContext } from './chat-context.js';
import { executeAction } from './chat-actions.js';
import { CHAT_CONFIG, getSessionId, getMessages, pushMessage, resetHistory } from './chat-state.js';

let isWaitingResponse = false;
let clearClickCount = 0;
let clearClickTimer = null;

/**
 * Añade un mensaje. Si `type==='bot'` y no es bienvenida, inserta botón PDF
 * (que invoca `window.exportMessageToPDF` — registrado por chat-pdf.js).
 */
export function addMessage(type, text, save = true) {
    const messagesContainer = document.getElementById('chat-messages');
    const lang = window.getCurrentLanguage?.() || 'es';
    const time = new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });

    const isWelcome = text === CHAT_CONFIG.welcomeMessage;

    let pdfButton = '';
    if (type === 'bot' && !isWelcome) {
        try {
            const encodedText = btoa(unescape(encodeURIComponent(text)));
            pdfButton = `<button class="chat-pdf-btn"
                 data-pdf-text="${encodedText}"
                 title="${t('chat:export_pdf_title')}"
                 style="background:none;border:none;cursor:pointer;padding:2px 6px;font-size:12px;opacity:0.6;transition:opacity 0.2s;"
                 onmouseover="this.style.opacity='1'"
                 onmouseout="this.style.opacity='0.6'"
                 onclick="window.exportMessageToPDF(decodeURIComponent(escape(atob(this.dataset.pdfText))))">📄</button>`;
        } catch (e) {
            console.warn('Error encoding text for PDF:', e);
        }
    }

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    messageEl.innerHTML = `
        <div class="chat-message-avatar">${type === 'bot' ? '🤖' : '👤'}</div>
        <div>
            <div class="chat-message-content">${parseMarkdown(text)}</div>
            <div class="chat-message-time">${time} ${pdfButton}</div>
        </div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (save) {
        pushMessage({ type, text, time: Date.now() });
    }
}

/**
 * Añade un mensaje del bot con botones Confirmar/Cancelar que ejecutan
 * `actionData` a través de executeAction (voice dispatcher).
 */
function addMessageWithAction(type, text, actionData) {
    const messagesContainer = document.getElementById('chat-messages');
    const lang = window.getCurrentLanguage?.() || 'es';
    const time = new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
    const actionId = 'action_' + Date.now();

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    messageEl.innerHTML = `
        <div class="chat-message-avatar">🤖</div>
        <div>
            <div class="chat-message-content">${parseMarkdown(text)}</div>
            <div class="chat-action-buttons" id="${actionId}" style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="chat-action-confirm" data-action="${encodeURIComponent(actionData)}"
                    style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    ✅ ${t('chat:action_confirm')}
                </button>
                <button class="chat-action-cancel"
                    style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    ❌ ${t('chat:action_cancel')}
                </button>
            </div>
            <div class="chat-message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const confirmBtn = messageEl.querySelector('.chat-action-confirm');
    const cancelBtn = messageEl.querySelector('.chat-action-cancel');
    const buttonsContainer = document.getElementById(actionId);

    confirmBtn.addEventListener('click', async () => {
        buttonsContainer.innerHTML = `<span style="color: #f59e0b;">⏳ ${t('chat:action_executing')}</span>`;
        const success = await executeAction(actionData);
        if (success) {
            buttonsContainer.innerHTML =
                `<span style="color: #10b981;">✅ ${t('chat:action_done')}</span>`;
            addMessage('bot', `✅ ${t('chat:action_completed')}`, false);
        } else {
            buttonsContainer.innerHTML =
                `<span style="color: #ef4444;">❌ ${t('chat:action_error')}</span>`;
        }
    });

    cancelBtn.addEventListener('click', () => {
        buttonsContainer.innerHTML = `<span style="color: #64748b;">🚫 ${t('chat:action_cancelled')}</span>`;
    });

    // Guardar mensaje sin la acción (la acción ya se ejecutó o canceló cuando se re-renderice).
    pushMessage({ type, text, time: Date.now() });
}

export function showTyping() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingEl = document.createElement('div');
    typingEl.id = 'chat-typing';
    typingEl.className = 'chat-typing';
    typingEl.innerHTML = `
        <div class="chat-message-avatar" style="width:28px;height:28px;font-size:12px;">🤖</div>
        <div class="chat-typing-dots">
            <div class="chat-typing-dot"></div>
            <div class="chat-typing-dot"></div>
            <div class="chat-typing-dot"></div>
        </div>
    `;
    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function hideTyping() {
    const typingEl = document.getElementById('chat-typing');
    if (typingEl) typingEl.remove();
}

/**
 * Envía el mensaje actual del input al backend (Claude o n8n según
 * appConfig.chat.backend). Si la respuesta trae `[ACTION:...]`, separa la
 * acción del texto visible y pinta los botones de confirmación.
 */
export async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const message = input.value.trim();

    if (!message || isWaitingResponse) return;

    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    isWaitingResponse = true;
    sendBtn.disabled = true;
    input.disabled = true;
    showTyping();

    try {
        const lang = window.getCurrentLanguage?.() || 'es';
        let data;

        if (appConfig.chat.backend === 'claude') {
            // Claude API (multi-tenant vía JWT). El backend saca contexto con tools.
            data = await api.chat(message, lang, getSessionId());
        } else {
            // Legacy: webhook n8n con payload completo de contexto de pestaña.
            const tabContext = getCurrentTabContext();
            const response = await fetch(CHAT_CONFIG.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    sessionId: getSessionId(),
                    restaurante: window.getRestaurantName ? window.getRestaurantName() : 'Restaurante',
                    timestamp: new Date().toISOString(),
                    fechaHoy: new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'es-ES', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    }),
                    fechaISO: new Date().toISOString().split('T')[0],
                    contexto: tabContext,
                    lang,
                }),
            });
            if (!response.ok) throw new Error('Error en la respuesta');
            data = await response.text();
        }

        hideTyping();

        const actionMatch = data.match(/\[ACTION:([^\]]+)\]/);
        if (actionMatch) {
            const actionData = actionMatch[1];
            const cleanMessage = data.replace(/\[ACTION:[^\]]+\]/, '').trim();
            addMessageWithAction('bot', cleanMessage, actionData);
        } else {
            addMessage('bot', data || t('chat:no_response'));
        }
    } catch (error) {
        hideTyping();
        logger.error('Chat error:', error);
        addMessage('bot', CHAT_CONFIG.errorMessage);
    } finally {
        isWaitingResponse = false;
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

/**
 * Re-renderiza todo el historial. Usa DocumentFragment para un único reflow.
 */
export function renderChatHistory() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';

    const fragment = document.createDocumentFragment();

    getMessages().forEach(msg => {
        const time = new Date(msg.time).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${msg.type}`;
        let pdfButton = '';
        if (msg.type === 'bot' && msg.text !== CHAT_CONFIG.welcomeMessage) {
            try {
                const encodedText = btoa(unescape(encodeURIComponent(msg.text)));
                pdfButton = `<button class="chat-pdf-btn"
                     data-pdf-text="${encodedText}"
                     title="${t('chat:export_pdf_title')}"
                     style="background:none;border:none;cursor:pointer;padding:2px 6px;font-size:12px;opacity:0.6;transition:opacity 0.2s;"
                     onmouseover="this.style.opacity='1'"
                     onmouseout="this.style.opacity='0.6'"
                     onclick="window.exportMessageToPDF(decodeURIComponent(escape(atob(this.dataset.pdfText))))">📄</button>`;
            } catch (e) {
                console.warn('Error encoding text for PDF:', e);
            }
        }

        messageEl.innerHTML = `
            <div class="chat-message-avatar">${msg.type === 'bot' ? '🤖' : '👤'}</div>
            <div>
                <div class="chat-message-content">${parseMarkdown(msg.text)}</div>
                <div class="chat-message-time">${time} ${pdfButton}</div>
            </div>
        `;
        fragment.appendChild(messageEl);
    });

    messagesContainer.appendChild(fragment);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Borra historial tras dos clicks en 2s (anti-accidental). El primero muestra
 * el hint de confirmación; el segundo resetea y pinta el welcome.
 */
export function clearChat() {
    clearClickCount++;

    if (clearClickCount === 1) {
        window.showToast?.(t('chat:clear_confirm_hint'), 'warning');
        clearClickTimer = setTimeout(() => {
            clearClickCount = 0;
        }, 2000);
    } else if (clearClickCount >= 2) {
        clearTimeout(clearClickTimer);
        clearClickCount = 0;
        resetHistory();
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            addMessage('bot', CHAT_CONFIG.welcomeMessage);
        }
        window.showToast?.(t('chat:history_cleared'), 'success');
    }
}

/**
 * Pinta 3-4 botones de sugerencias según la pestaña activa.
 */
export function updateQuickButtons() {
    const container = document.getElementById('chat-quick-actions');
    if (!container) return;

    const currentTab = getCurrentTab();

    const buttonsByTab = {
        ingredientes: [
            { msg: t('chat:suggestion_price_increase'), label: `📈 ${t('chat:suggestion_price_increase_short')}` },
            { msg: t('chat:suggestion_low_stock'), label: `⚠️ ${t('chat:suggestion_low_stock_short')}` },
            { msg: t('chat:suggestion_most_expensive'), label: `💰 ${t('chat:suggestion_most_expensive_short')}` },
        ],
        recetas: [
            { msg: t('chat:suggestion_most_profitable'), label: `⭐ ${t('chat:suggestion_most_profitable_short')}` },
            { msg: t('chat:suggestion_high_food_cost'), label: `🔴 ${t('chat:suggestion_high_food_cost_short')}` },
            { msg: t('chat:suggestion_price_suggestion'), label: `💵 ${t('chat:suggestion_price_suggestion_short')}` },
        ],
        proveedores: [
            { msg: t('chat:suggestion_compare_suppliers'), label: `🏪 ${t('chat:suggestion_compare_suppliers_short')}` },
            { msg: t('chat:suggestion_spending'), label: `💳 ${t('chat:suggestion_spending_short')}` },
        ],
        dashboard: [
            { msg: t('chat:suggestion_summary'), label: `📊 ${t('chat:suggestion_summary_short')}` },
            { msg: t('chat:suggestion_food_cost'), label: `🎯 ${t('chat:suggestion_food_cost_short')}` },
            { msg: t('chat:suggestion_portions'), label: `🍽️ ${t('chat:suggestion_portions_short')}` },
        ],
        default: [
            { msg: t('chat:suggestion_food_cost'), label: `📊 ${t('chat:suggestion_food_cost_short')}` },
            { msg: t('chat:suggestion_portions'), label: `🍽️ ${t('chat:suggestion_portions_short')}` },
            { msg: t('chat:suggestion_suppliers'), label: `🏪 ${t('chat:suggestion_suppliers_short')}` },
            { msg: t('chat:suggestion_margins'), label: `📈 ${t('chat:suggestion_margins_short')}` },
        ],
    };

    const buttons = buttonsByTab[currentTab] || buttonsByTab['default'];

    container.innerHTML = buttons
        .map(btn => `<button class="chat-quick-btn" data-msg="${btn.msg}">${btn.label}</button>`)
        .join('');
}

// Escuchar cambios de pestaña para actualizar botones rápidos (registrado al importar).
document.addEventListener('click', e => {
    if (e.target.classList.contains('tab-btn')) {
        setTimeout(updateQuickButtons, 100);
    }
});
