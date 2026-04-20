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

let isChatOpen = false;

export function initChatWidget() {
    createChatStyles();
    createChatHTML();
    bindChatEvents();

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
            <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <span class="notification-dot"></span>
        </button>

        <!-- Chat Window -->
        <div class="chat-window" id="chat-window">
            <div class="chat-header">
                <div class="chat-header-avatar">🤖</div>
                <div class="chat-header-info">
                    <h3>${CHAT_CONFIG.botName}</h3>
                    <p>${t('chat:subtitle')}</p>
                </div>
                <div class="chat-header-status"></div>
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

    document.getElementById('chat-clear').addEventListener('click', () => clearChat());

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
        fab.querySelector('.notification-dot').style.display = 'none';
        document.getElementById('chat-input').focus();
    }
}

// Exportar para uso global (onclick inline y compat legacy)
window.initChatWidget = initChatWidget;
window.clearChatHistory = clearChatHistory;
window.toggleChat = toggleChat;
