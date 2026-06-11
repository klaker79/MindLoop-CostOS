/**
 * MindLoop CostOS — Chat Widget (entry / orchestrator).
 *
 * Este módulo arma la UI (FAB + ventana + header) y engancha eventos. Toda la
 * lógica (estado, mensajes, acciones, contexto, markdown, PDF) vive en los
 * submódulos bajo `src/modules/chat/`.
 *
 * Exporta:
 *   - initChatWidget (también expuesta en window para compatibilidad).
 *   - clearChatHistory (también en window; resetea historial y regenera sesión).
 * Expone window.toggleChat para el FAB/onclicks legacy.
 */

import { logger } from '../../utils/logger.js';
import { createChatStyles } from './chat-styles.js';
import { t } from '@/i18n/index.js';
import './chat-pdf.js';
import { CHAT_CONFIG, getMessages, resetHistory } from './chat-state.js';
import { isTtsEnabled, toggleTts, speakResponse } from './chat-actions.js';
import {
    addMessage,
    sendMessage,
    renderChatHistory,
    updateQuickButtons,
    clearChat
} from './chat-messages.js';
import { api } from '../../api/client.js';
import { buildMonthOptions } from './month-options.js';

let isChatOpen = false;
let isMounted = false;
let chatStatusCache = null;

/**
 * Intenta montar el widget. Si el add-on Chat IA NO está activado para
 * este tenant, no monta nada (la activación se hace desde Settings).
 *
 * Llama a /chat-status — si el endpoint falla (500, network) se hace
 * fail-CLOSED: NO monta. Es preferible no enseñar el widget que enseñarlo
 * y luego que cada mensaje devuelva error.
 */
export async function initChatWidget() {
    if (isMounted) return;
    try {
        chatStatusCache = await api.chatStatus();
    } catch (err) {
        logger.warn('chat-status fetch failed; widget no se monta:', err.message || err);
        return;
    }
    if (!chatStatusCache?.enabled) return;
    mountWidget();
}

function mountWidget() {
    isMounted = true;
    createChatStyles();
    createChatHTML();
    bindChatEvents();
    updateUsageBadge(chatStatusCache.used, chatStatusCache.limit);

    if (getMessages().length === 0) {
        addMessage('bot', CHAT_CONFIG.welcomeMessage);
    } else {
        renderChatHistory();
    }

    // Al cambiar idioma: refresca header/placeholder/botones, y resetea para
    // que el mensaje de bienvenida aparezca en el nuevo idioma.
    window.addEventListener('languageChanged', () => {
        const headerInfo = document.querySelector('.chat-header-info');
        if (headerInfo) {
            headerInfo.querySelector('h3').textContent = CHAT_CONFIG.botName;
            headerInfo.querySelector('p').textContent = t('chat:subtitle');
        }
        const input = document.getElementById('chat-input');
        if (input) input.placeholder = CHAT_CONFIG.placeholderText;
        updateQuickButtons();
        clearChatHistory();
    });
}

/**
 * Limpia el historial, regenera sesión y muestra el mensaje de bienvenida.
 * Expuesto en window para uso desde el botón del header (legacy) y desde
 * el listener de languageChanged arriba.
 */
export function clearChatHistory() {
    resetHistory();
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        addMessage('bot', CHAT_CONFIG.welcomeMessage);
    }
}

function createChatHTML() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-widget-container';
    chatContainer.innerHTML = `
        <!-- Chat FAB Button -->
        <button class="chat-fab" id="chat-fab" title="${t('chat:fab_title')}">
            <video class="chat-fab-owl" autoplay loop muted playsinline disablepictureinpicture poster="/images/omnes.png">
                <source src="/images/omnes-fab.mp4" type="video/mp4">
            </video>
            <span class="notification-dot"></span>
        </button>
        <div class="chat-fab-bubble" id="chat-fab-bubble" role="button" tabindex="0">
            <span class="chat-fab-bubble-text">${t('chat:fab_invite')}</span>
            <button class="chat-fab-bubble-x" id="chat-fab-bubble-x" type="button" aria-label="${t('chat:fab_invite_close')}">✕</button>
        </div>

        <!-- Chat Window -->
        <div class="chat-window" id="chat-window">
            <div class="chat-header">
                <div class="chat-header-avatar"><img src="/images/omnes.png" alt="Omnes" onerror="this.parentElement.textContent='🦉'" style="width:100%;height:100%;object-fit:contain;border-radius:50%;background:#fff;"></div>
                <div class="chat-header-info">
                    <h3>${CHAT_CONFIG.botName}</h3>
                    <p>${t('chat:subtitle')}</p>
                </div>
                <button class="chat-informe-btn" id="chat-informe" title="${t('chat:btn_informe') || 'Informe ejecutivo del mes'}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                    <span class="chat-informe-label">${t('chat:btn_informe_short') || 'Informe'}</span>
                </button>
                <button class="chat-informe-btn chat-healthcheck-btn" id="chat-healthcheck" title="${t('chat:btn_healthcheck') || 'Health Check semanal'}" style="position:relative;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
                    </svg>
                    <span class="chat-informe-label">${t('chat:btn_healthcheck_short') || 'Coach'}</span>
                    <span id="chat-healthcheck-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;width:10px;height:10px;border-radius:50%;border:2px solid #1e293b;"></span>
                </button>
                <button class="chat-clear-btn" id="chat-clear" title="${t('chat:btn_clear')}" style="background:none;border:none;cursor:pointer;padding:8px;margin-right:4px;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
                <button class="chat-tts-btn" id="chat-tts" title="${t('chat:toggle_voice_title')}" style="background:none;border:none;cursor:pointer;padding:8px;margin-right:4px;opacity:${isTtsEnabled() ? '1' : '0.5'}">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                </button>
                <button class="chat-close-btn" id="chat-close">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>

            <div class="chat-usage-badge" id="chat-header-usage" title="${t('chat:usage_title') || 'Consultas usadas este mes'}"></div>
            <div class="chat-messages" id="chat-messages"></div>

            <div class="chat-quick-actions" id="chat-quick-actions"></div>

            <div class="chat-input-container">
                <textarea
                    class="chat-input"
                    id="chat-input"
                    placeholder="${CHAT_CONFIG.placeholderText}"
                    rows="1"
                ></textarea>
                <button class="chat-mic-btn" id="chat-mic" title="${t('chat:btn_speak')}">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                </button>
                <button class="chat-send-btn" id="chat-send">
                    <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);
}

function bindChatEvents() {
    const fab = document.getElementById('chat-fab');
    const closeBtn = document.getElementById('chat-close');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    fab.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));

    // Globo de invitación junto al FAB: aparece a los ~1,8s, se cierra con la ✕,
    // y al pulsarlo abre el chat.
    const bubble = document.getElementById('chat-fab-bubble');
    const bubbleX = document.getElementById('chat-fab-bubble-x');
    if (bubble) {
        setTimeout(() => { if (!isChatOpen) bubble.classList.add('show'); }, 1800);
        bubble.addEventListener('click', () => toggleChat(true));
        if (bubbleX) bubbleX.addEventListener('click', (e) => { e.stopPropagation(); bubble.classList.remove('show'); });
    }

    document.getElementById('chat-clear').addEventListener('click', () => clearChat());

    const informeBtn = document.getElementById('chat-informe');
    if (informeBtn) {
        informeBtn.addEventListener('click', () => toggleInformeMenu(informeBtn));
    }

    const healthBtn = document.getElementById('chat-healthcheck');
    if (healthBtn) {
        healthBtn.addEventListener('click', () => generarHealthCheck(healthBtn));
        // Tras montar el chat, comprobamos si hay report nuevo (lunes o no leído).
        checkHealthCheckStatus();
    }

    const ttsBtn = document.getElementById('chat-tts');
    ttsBtn.addEventListener('click', () => {
        const enabled = toggleTts();
        ttsBtn.style.opacity = enabled ? '1' : '0.5';
        ttsBtn.title = enabled ? t('chat:tts_toggle_on') : t('chat:tts_toggle_off');
        window.showToast?.(enabled ? t('chat:tts_enabled') : t('chat:tts_disabled'), 'info');
        if (enabled) speakResponse(t('chat:tts_speak_activated'));
    });

    sendBtn.addEventListener('click', () => sendMessage());

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    document.getElementById('chat-quick-actions').addEventListener('click', e => {
        if (e.target.classList.contains('chat-quick-btn')) {
            input.value = e.target.dataset.msg;
            sendMessage();
        }
    });

    // Speech recognition (voice input).
    const micBtn = document.getElementById('chat-mic');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = (window.getCurrentLanguage?.() || 'es') === 'en' ? 'en-US' : 'es-ES';
        recognition.continuous = false;
        recognition.interimResults = false;

        let isRecording = false;

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
                micBtn.classList.remove('recording');
                isRecording = false;
            } else {
                try {
                    recognition.start();
                    micBtn.classList.add('recording');
                    isRecording = true;
                } catch (e) {
                    // InvalidStateError: recognition already started (double-click race).
                    logger.warn('Speech recognition start failed:', e.message);
                    micBtn.classList.remove('recording');
                    isRecording = false;
                }
            }
        });

        recognition.onresult = event => {
            const transcript = event.results?.[0]?.[0]?.transcript || '';
            if (!transcript) {
                logger.warn('Speech recognition: transcripción vacía');
                micBtn.classList.remove('recording');
                isRecording = false;
                return;
            }
            input.value = transcript;
            input.focus();
            micBtn.classList.remove('recording');
            isRecording = false;
        };

        recognition.onerror = event => {
            logger.warn('Speech recognition error:', event.error);
            micBtn.classList.remove('recording');
            isRecording = false;
            if (event.error === 'not-allowed') {
                window.showToast?.(t('chat:mic_permission'), 'warning');
            }
        };

        recognition.onend = () => {
            micBtn.classList.remove('recording');
            isRecording = false;
        };
    } else {
        micBtn.style.display = 'none';
    }

    updateQuickButtons();
}

function toggleChat(forceState) {
    const chatWindow = document.getElementById('chat-window');
    const fab = document.getElementById('chat-fab');

    isChatOpen = forceState !== undefined ? forceState : !isChatOpen;

    chatWindow.classList.toggle('open', isChatOpen);
    fab.classList.toggle('active', isChatOpen);

    if (isChatOpen) {
        document.getElementById('chat-fab-bubble')?.classList.remove('show');
        fab.querySelector('.notification-dot').style.display = 'none';
        document.getElementById('chat-input').focus();
    }
}

/**
 * Toggle del popover de selección de mes. Si está abierto lo cierra.
 * El popover se posiciona absolute respecto al chat-window.
 */
function toggleInformeMenu(btn) {
    const existing = document.getElementById('chat-informe-menu');
    if (existing) {
        existing.remove();
        return;
    }
    const lang = String(window.getCurrentLanguage?.() || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
    const opts = buildMonthOptions(lang);
    const menu = document.createElement('div');
    menu.id = 'chat-informe-menu';
    menu.className = 'chat-informe-menu';
    menu.innerHTML = `
        <div class="chat-informe-menu-header">${t('chat:informe_choose_month') || (lang === 'en' ? 'Choose month' : 'Elige mes')}</div>
        ${opts.map((o, i) => `
            <button class="chat-informe-menu-item" data-mes="${o.mes || ''}" data-idx="${i}">
                <span class="chat-informe-menu-label">${o.label}</span>
                ${o.sublabel ? `<span class="chat-informe-menu-sub">${o.sublabel}</span>` : ''}
            </button>
        `).join('')}
    `;
    // Insertar dentro del chat-window para que herede el position:fixed
    const chatWindow = document.getElementById('chat-window');
    chatWindow.appendChild(menu);

    menu.addEventListener('click', e => {
        const item = e.target.closest('.chat-informe-menu-item');
        if (!item) return;
        const mes = item.dataset.mes || null;
        menu.remove();
        generarInforme(btn, mes);
    });

    // Cerrar al hacer click fuera (próximo tick para no atrapar el click actual)
    setTimeout(() => {
        const closeOnOutside = (ev) => {
            if (!menu.contains(ev.target) && ev.target !== btn) {
                menu.remove();
                document.removeEventListener('click', closeOnOutside);
            }
        };
        document.addEventListener('click', closeOnOutside);
    }, 0);
}

/**
 * Pide el informe ejecutivo HTML al backend y lo abre en una pestaña nueva.
 * El backend hace una llamada Claude single-shot (~5-15s) para el análisis,
 * por eso mostramos un spinner en el botón mientras tanto.
 *
 * @param {HTMLElement} btn — el botón del header (para feedback visual)
 * @param {string|null} mes — 'YYYY-MM' o null para mes en curso
 */
async function generarInforme(btn, mes = null) {
    if (btn.dataset.loading === '1') return;
    btn.dataset.loading = '1';
    const originalHtml = btn.innerHTML;
    const loadingLabel = t('chat:informe_loading') || 'Generando…';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg><span class="chat-informe-label">${loadingLabel}</span>`;
    btn.style.opacity = '0.85';
    btn.style.cursor = 'wait';
    btn.querySelector('svg').style.animation = 'chat-informe-spin 1s linear infinite';
    if (!document.getElementById('chat-informe-spin-style')) {
        const style = document.createElement('style');
        style.id = 'chat-informe-spin-style';
        style.textContent = '@keyframes chat-informe-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }
    try {
        // Idioma del usuario: i18next puede devolver 'en-US' o 'es-ES' — nos
        // quedamos con el prefijo. Default 'es'.
        const rawLang = window.getCurrentLanguage?.() || 'es';
        const lang = String(rawLang).toLowerCase().startsWith('en') ? 'en' : 'es';
        const html = await api.getChatInformeMensualHtml(lang, mes);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
            window.showToast?.(t('chat:informe_popup_blocked') || 'Permite los popups para ver el informe', 'warning');
        }
    } catch (err) {
        logger.warn('Error generando informe mensual:', err.message || err);
        const msg = err.status === 403
            ? (t('chat:informe_addon_required') || 'Necesitas el add-on Chat IA activo para generar informes.')
            : (t('chat:informe_error') || 'No se pudo generar el informe. Inténtalo en un momento.');
        window.showToast?.(msg, 'error');
    } finally {
        btn.dataset.loading = '0';
        btn.style.opacity = '';
        btn.style.cursor = '';
        btn.innerHTML = originalHtml;
    }
}

/**
 * Pide el Health Check semanal al backend y lo inserta como mensaje del bot
 * en el chat. Cacheado por semana ISO en backend — pulsar varias veces el
 * mismo lunes no consume tokens repetidamente.
 *
 * @param {HTMLElement} btn — el botón del header (para feedback visual)
 */
async function generarHealthCheck(btn) {
    if (btn.dataset.loading === '1') return;
    btn.dataset.loading = '1';
    const originalHtml = btn.innerHTML;
    const loadingLabel = t('chat:healthcheck_loading') || 'Analizando…';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg><span class="chat-informe-label">${loadingLabel}</span>`;
    btn.style.opacity = '0.85';
    btn.style.cursor = 'wait';
    btn.querySelector('svg').style.animation = 'chat-informe-spin 1s linear infinite';
    try {
        // El chat se abre si no lo estaba — el cliente debe ver el resultado
        toggleChat(true);
        const report = await api.getHealthCheck();
        // Ocultar badge (ya está leído)
        const badge = document.getElementById('chat-healthcheck-badge');
        if (badge) badge.style.display = 'none';
        // Renderizar como mensaje del bot. Usamos markdown sencillo: el parser
        // del chat ya soporta negrita y saltos.
        const text =
            `🩺 **Health Check semanal (${report.semana_iso})**\n\n` +
            `🔴 **${report.critico.titulo}**\n${report.critico.detalle}\n\n` +
            `🟢 **${report.oportunidad.titulo}**\n${report.oportunidad.detalle}\n\n` +
            `🔵 **${report.accion.titulo}**\n${report.accion.detalle}`;
        addMessage('bot', text);
    } catch (err) {
        logger.warn('Error generando health check:', err.message || err);
        const msg = err.status === 403
            ? (t('chat:healthcheck_addon_required') || 'Necesitas el add-on Chat IA activo para el Health Check.')
            : (t('chat:healthcheck_error') || 'No se pudo generar el Health Check. Inténtalo en un momento.');
        window.showToast?.(msg, 'error');
    } finally {
        btn.dataset.loading = '0';
        btn.style.opacity = '';
        btn.style.cursor = '';
        btn.innerHTML = originalHtml;
    }
}

/**
 * Comprueba si hay report nuevo (no leído / lunes) y pinta el badge rojo
 * sobre el botón Coach. Llamado al inicializar el chat. Endpoint es barato
 * (solo lectura BD), no consume tokens.
 */
async function checkHealthCheckStatus() {
    try {
        const status = await api.getHealthCheckStatus();
        const badge = document.getElementById('chat-healthcheck-badge');
        if (!badge) return;
        // Mostramos el punto si hay report nuevo no leído, o si es lunes y
        // todavía no se ha generado uno esta semana (oportunidad de ver).
        if (status?.has_new && status?.addon_enabled !== false) {
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        // No bloquea nada, simplemente no se pinta el badge
        logger.warn('checkHealthCheckStatus failed (ignorado):', err.message || err);
    }
}

/**
 * Actualiza el contador "X/300 este mes" en el header del chat.
 * La llama chat-messages.js tras cada respuesta exitosa para mantenerlo fresco.
 */
export function updateUsageBadge(used, limit) {
    const el = document.getElementById('chat-header-usage');
    if (!el || used === undefined || used === null) return;
    el.textContent = `${used}/${limit}`;
    el.title = `${used} de ${limit} consultas usadas este mes`;
}

// Exportar para uso global (onclick inline y compat legacy)
window.initChatWidget = initChatWidget;
window.clearChatHistory = clearChatHistory;
window.toggleChat = toggleChat;
window.updateChatUsageBadge = updateUsageBadge;
