/**
 * MindLoop CostOS - Chat Widget con IA
 * Integración con n8n para asistente contable inteligente
 */

import { logger } from '../../utils/logger.js';
import { createChatStyles } from './chat-styles.js';
import { appConfig } from '../../config/app-config.js';
import { loadPDF } from '../../utils/lazy-vendors.js';
import { t } from '@/i18n/index.js';

const CHAT_CONFIG = {
    // Webhook URL desde configuración centralizada (requiere VITE_CHAT_WEBHOOK_URL en .env)
    webhookUrl: appConfig.chat.webhookUrl,
    get botName() { return t('chat:bot_name') || appConfig.chat.botName || 'CostOS Assistant'; },
    get welcomeMessage() {
        return `${t('chat:welcome')}\n\n• 📊 ${t('chat:welcome_food_cost')}\n• 💰 ${t('chat:welcome_costs')}\n• 📦 ${t('chat:welcome_stock')}\n• 📈 ${t('chat:welcome_margins')}\n• 🏪 ${t('chat:welcome_suppliers')}\n\n${t('chat:welcome_cta')}`;
    },
    get placeholderText() { return t('chat:placeholder'); },
    get errorMessage() { return t('chat:error_generic'); },
};

// Generar sessionId único
function generateSessionId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

let chatSessionId = localStorage.getItem('chatSessionId') || generateSessionId();
localStorage.setItem('chatSessionId', chatSessionId);

// 🔒 FIX: Proteger JSON.parse con try/catch para evitar crash si localStorage está corrupto
let chatMessages = [];
try {
    const storedHistory = localStorage.getItem('chatHistory');
    if (storedHistory) {
        chatMessages = JSON.parse(storedHistory);
        // Validar que es un array
        if (!Array.isArray(chatMessages)) {
            console.warn('⚠️ chatHistory corrupto, reseteando...');
            chatMessages = [];
            localStorage.removeItem('chatHistory');
        }
    }
} catch (parseError) {
    console.error('❌ Error parseando chatHistory, reseteando:', parseError);
    chatMessages = [];
    localStorage.removeItem('chatHistory');
}

let isChatOpen = false;
let isWaitingResponse = false;
let ttsEnabled = localStorage.getItem('ttsEnabled') === 'true'; // Text-to-Speech toggle

/**
 * Text-to-Speech: Lee respuestas en voz alta
 */
function speakResponse(text) {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;

    // Cancelar cualquier audio previo
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Buscar voz en español si está disponible
    const voices = speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) utterance.voice = spanishVoice;

    speechSynthesis.speak(utterance);
}

/**
 * Exporta un mensaje del chat a PDF profesional
 * Renderiza tablas manualmente sin dependencia de autoTable
 * @param {string} rawText - Texto raw del mensaje (markdown)
 */
async function exportMessageToPDF(rawText) {
    try {
        window.showToast?.(t('chat:pdf_generating'), 'info');

        // Cargar jsPDF bajo demanda
        await loadPDF();
        const { jsPDF } = window.jspdf;

        const restaurante = window.getRestaurantName ? window.getRestaurantName() : 'Mi Restaurante';
        const fecha = new Date().toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const usableWidth = pageWidth - margin * 2;
        let y = margin;

        // --- Header con gradiente simulado ---
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setFillColor(118, 108, 230);
        doc.rect(0, 12, pageWidth, 12, 'F');
        doc.setFillColor(139, 92, 226);
        doc.rect(0, 24, pageWidth, 11, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(restaurante, margin, 18);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(t('chat:pdf_subtitle'), margin, 27);
        doc.setFontSize(9);
        doc.text(fecha, pageWidth - margin, 32, { align: 'right' });

        y = 45;
        doc.setTextColor(30, 41, 59);

        function cleanText(text) {
            if (!text) return '';
            return text
                .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                .replace(/[\u{2600}-\u{26FF}]/gu, '')
                .replace(/[\u{2700}-\u{27BF}]/gu, '')
                .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
                .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/__(.+?)__/g, '$1')
                .replace(/_(.+?)_/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/^#{1,3}\s*/, '')
                .trim();
        }

        function renderTable(headers, rows, startY) {
            const rowHeight = 8;
            const cellPadding = 3;
            const colCount = headers.length;
            const colWidth = usableWidth / colCount;
            let currentY = startY;

            const cleanHeaders = headers.map(h => cleanText(h));

            doc.setFillColor(102, 126, 234);
            doc.rect(margin, currentY, usableWidth, rowHeight, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            cleanHeaders.forEach((header, idx) => {
                doc.text(header.substring(0, 20), margin + idx * colWidth + cellPadding, currentY + 5.5);
            });
            currentY += rowHeight;

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'normal');
            rows.forEach((row, rowIdx) => {
                if (rowIdx % 2 === 0) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(margin, currentY, usableWidth, rowHeight, 'F');
                }
                doc.setDrawColor(226, 232, 240);
                doc.rect(margin, currentY, usableWidth, rowHeight, 'S');
                row.forEach((cell, idx) => {
                    doc.text(cleanText(cell).substring(0, 25), margin + idx * colWidth + cellPadding, currentY + 5.5);
                });
                currentY += rowHeight;
            });
            return currentY + 5;
        }

        const lines = rawText.split('\n');
        let i = 0;
        while (i < lines.length) {
            if (i + 1 < lines.length && lines[i].includes('|') &&
                /^[\s\-:|]+$/.test(lines[i + 1].trim())) {
                const tableLines = [];
                let j = i;
                while (j < lines.length && (lines[j].includes('|') || /^[\s\-:|]+$/.test(lines[j].trim()))) {
                    if (!/^[\s\-:|]+$/.test(lines[j].trim())) tableLines.push(lines[j]);
                    j++;
                }
                if (tableLines.length >= 2) {
                    const parseCells = line => line.split('|').map(c => c.trim()).filter(c => c !== '');
                    const headers = parseCells(tableLines[0]);
                    const rows = tableLines.slice(1).map(parseCells);
                    const tableHeight = (rows.length + 1) * 8 + 10;
                    if (y + tableHeight > 270) { doc.addPage(); y = margin; }
                    y = renderTable(headers, rows, y);
                }
                i = j;
                continue;
            }

            const line = lines[i].trim();
            if (y > 270) { doc.addPage(); y = margin; }
            if (!line) { y += 4; i++; continue; }

            const cleanedLine = cleanText(line);
            const isMdHeader = /^#{1,3}\s/.test(line);
            const isEmojiHeader = /^[^\w\s]/.test(line) && /[A-ZÁÉÍÓÚÑ]{2,}/.test(line);

            if (isMdHeader || isEmojiHeader) {
                y += 3;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(102, 126, 234);
                const splitLines = doc.splitTextToSize(cleanedLine, usableWidth);
                doc.text(splitLines, margin, y);
                y += splitLines.length * 6;
                doc.setTextColor(30, 41, 59);
            } else if (line.startsWith('- ') || line.startsWith('• ')) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const bulletText = cleanedLine.replace(/^[-•]\s*/, '');
                const splitLines = doc.splitTextToSize('  •  ' + bulletText, usableWidth);
                doc.text(splitLines, margin, y);
                y += splitLines.length * 5;
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const splitLines = doc.splitTextToSize(cleanedLine, usableWidth);
                doc.text(splitLines, margin, y);
                y += splitLines.length * 5;
            }
            i++;
        }

        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.setDrawColor(226, 232, 240);
            doc.line(margin, 284, pageWidth - margin, 284);
            doc.text(
                `${restaurante} — Generado por MindLoop CostOS — Página ${p}/${totalPages}`,
                pageWidth / 2, 289, { align: 'center' }
            );
        }

        const fechaFile = new Date().toISOString().split('T')[0];
        const nombreFile = restaurante.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        doc.save(`Informe_${nombreFile}_${fechaFile}.pdf`);
        window.showToast?.(t('chat:pdf_downloaded'), 'success');
    } catch (error) {
        console.error('Error generando PDF:', error);
        window.showToast?.(t('chat:pdf_error') + ': ' + error.message, 'error');
    }
}

// Exponer para uso desde botones
window.exportMessageToPDF = exportMessageToPDF;

/**
 * Inicializa el widget de chat
 */
export function initChatWidget() {
    createChatStyles();
    createChatHTML();
    bindChatEvents();

    // Mostrar mensaje de bienvenida si no hay historial
    if (chatMessages.length === 0) {
        addMessage('bot', CHAT_CONFIG.welcomeMessage);
    } else {
        renderChatHistory();
    }

    // Chat Widget inicializado
}


/**
 * Crea el HTML del chat
 */
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
            <!-- Header -->
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
                <button class="chat-tts-btn" id="chat-tts" title="${t('chat:toggle_voice_title')}" style="background:none;border:none;cursor:pointer;padding:8px;margin-right:4px;opacity:${ttsEnabled ? '1' : '0.5'}">
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
            
            <!-- Messages -->
            <div class="chat-messages" id="chat-messages"></div>
            
            <!-- Quick Actions (contextual) -->
            <div class="chat-quick-actions" id="chat-quick-actions">
                <!-- Se actualizan dinámicamente según la pestaña -->
            </div>
            
            <!-- Input -->
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

/**
 * Vincula eventos del chat
 */
function bindChatEvents() {
    const fab = document.getElementById('chat-fab');
    const chatWindow = document.getElementById('chat-window');
    const closeBtn = document.getElementById('chat-close');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const quickBtns = document.querySelectorAll('.chat-quick-btn');

    // Toggle chat
    fab.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));

    // Clear chat
    const clearBtn = document.getElementById('chat-clear');
    clearBtn.addEventListener('click', () => clearChat());

    // TTS Toggle
    const ttsBtn = document.getElementById('chat-tts');
    ttsBtn.addEventListener('click', () => {
        ttsEnabled = !ttsEnabled;
        localStorage.setItem('ttsEnabled', ttsEnabled);
        ttsBtn.style.opacity = ttsEnabled ? '1' : '0.5';
        ttsBtn.title = ttsEnabled ? t('chat:tts_toggle_on') : t('chat:tts_toggle_off');
        window.showToast?.(ttsEnabled ? t('chat:tts_enabled') : t('chat:tts_disabled'), 'info');
        if (ttsEnabled) speakResponse(t('chat:tts_speak_activated'));
    });

    // Send message
    sendBtn.addEventListener('click', () => sendMessage());

    // Enter to send
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // Quick actions (delegated event)
    document.getElementById('chat-quick-actions').addEventListener('click', e => {
        if (e.target.classList.contains('chat-quick-btn')) {
            input.value = e.target.dataset.msg;
            sendMessage();
        }
    });

    // Speech recognition (voice input)
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
                recognition.start();
                micBtn.classList.add('recording');
                isRecording = true;
            }
        });

        recognition.onresult = event => {
            // 🔒 FIX: Verificar que existen los índices antes de acceder
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
            // Optional: auto-send after recognition
            // sendMessage();
        };

        recognition.onerror = event => {
            logger.error('Speech recognition error:', event.error);
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
        // Browser doesn't support speech recognition
        micBtn.style.display = 'none';
    }

    // Update quick buttons on tab change
    updateQuickButtons();
}

/**
 * Toggle ventana de chat
 */
function toggleChat(forceState) {
    const chatWindow = document.getElementById('chat-window');
    const fab = document.getElementById('chat-fab');

    isChatOpen = forceState !== undefined ? forceState : !isChatOpen;

    chatWindow.classList.toggle('open', isChatOpen);
    fab.classList.toggle('active', isChatOpen);

    // Hide notification dot when opened
    if (isChatOpen) {
        fab.querySelector('.notification-dot').style.display = 'none';
        document.getElementById('chat-input').focus();
    }
}

/**
 * Añade un mensaje al chat
 */
function addMessage(type, text, save = true) {
    const messagesContainer = document.getElementById('chat-messages');
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Verificar si es mensaje de bienvenida (no mostrar botón PDF)
    const isWelcome = text === CHAT_CONFIG.welcomeMessage;

    // Botón PDF para mensajes del bot
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

    // Guardar en historial
    if (save) {
        chatMessages.push({ type, text, time: Date.now() });
        // Mantener solo los últimos 50 mensajes
        if (chatMessages.length > 50) chatMessages = chatMessages.slice(-50);
        localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
    }
}

/**
 * Añade mensaje con botones de acción
 */
function addMessageWithAction(type, text, actionData) {
    const messagesContainer = document.getElementById('chat-messages');
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
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

    // Eventos de los botones
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

    // Guardar mensaje (sin la acción)
    chatMessages.push({ type, text, time: Date.now() });
    if (chatMessages.length > 50) chatMessages = chatMessages.slice(-50);
    localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
}

/**
 * Ejecuta una acción del chat
 * Formato: tipo|entidad|campo|valor (ej: "update|ingrediente|PULPO|precio|25")
 */
async function executeAction(actionData) {
    try {
        const parts = actionData.split('|');
        const action = parts[0]; // update, add, etc.
        const entity = parts[1]; // ingrediente, receta
        const name = parts[2]; // nombre del item
        const field = parts[3]; // campo a modificar
        const value = parts[4]; // nuevo valor

        // Ejecutando acción

        if (action === 'update' && entity === 'ingrediente') {
            // Buscar ingrediente por nombre
            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(name.toLowerCase())
            );
            if (!ing) {
                logger.error('Ingrediente no encontrado:', name);
                return false;
            }

            // 🔒 FIX v2: Para stock usar ajuste atómico, para precio usar updateIngrediente
            if (field === 'stock') {
                // Calcular delta: nuevo_valor - valor_actual
                const stockActual = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0);
                const nuevoValor = parseFloat(value);
                const delta = nuevoValor - stockActual;
                await window.api.adjustStock(ing.id, delta, 'chat_voice');
            } else if (field === 'precio') {
                await window.api.updateIngrediente(ing.id, { precio: parseFloat(value) });
            }

            await window.cargarDatos();
            window.renderizarIngredientes?.();

            // 🔥 FIX: Si el formulario de edición está abierto para este ingrediente, actualizarlo
            if (window.editandoIngredienteId === ing.id) {
                const ingredienteActualizado = window.ingredientes?.find(i => i.id === ing.id);
                if (ingredienteActualizado) {
                    if (field === 'precio') {
                        document.getElementById('ing-precio').value = ingredienteActualizado.precio;
                    }
                    if (field === 'stock') {
                        document.getElementById('ing-stock').value =
                            ingredienteActualizado.stock_actual;
                    }
                }
            }

            window.showToast?.(`${ing.nombre} actualizado: ${field} = ${value}`, 'success');
            return true;
        } else if (action === 'update' && entity === 'receta') {
            // Buscar receta por nombre
            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(name.toLowerCase())
            );
            if (!rec) {
                logger.error('Receta no encontrada:', name);
                return false;
            }

            // Preparar actualización
            const updates = { ...rec };
            if (field === 'precio' || field === 'precio_venta')
                updates.precio_venta = parseFloat(value);

            // Llamar API
            await window.api.updateReceta(rec.id, updates);
            await window.cargarDatos();
            window.renderizarRecetas?.();

            // 🔥 FIX: Si el formulario de edición está abierto para esta receta, actualizarlo
            if (window.editandoRecetaId === rec.id) {
                const recetaActualizada = window.recetas?.find(r => r.id === rec.id);
                if (recetaActualizada) {
                    if (field === 'precio' || field === 'precio_venta') {
                        document.getElementById('rec-precio_venta').value =
                            recetaActualizada.precio_venta;
                    }
                    // Recalcular coste y márgenes
                    window.calcularCosteReceta?.();
                }
            }

            window.showToast?.(`${rec.nombre} actualizado: precio = ${value}€`, 'success');
            return true;
        } else if (action === 'update' && entity === 'receta_ingrediente') {
            // Formato: update|receta_ingrediente|RECETA|INGREDIENTE|cantidad|VALOR
            // parts[0]=update, parts[1]=receta_ingrediente, parts[2]=RECETA, parts[3]=INGREDIENTE, parts[4]=cantidad, parts[5]=VALOR
            const recetaNombre = parts[2];
            const ingredienteNombre = parts[3];
            const nuevaCantidad = parseFloat(parts[5]); // El valor está en parts[5]

            // Actualizando receta_ingrediente

            if (isNaN(nuevaCantidad)) {
                logger.error('Cantidad inválida:', parts[5]);
                return false;
            }

            // Buscar receta
            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(recetaNombre.toLowerCase())
            );
            if (!rec) {
                logger.error('Receta no encontrada:', recetaNombre);
                return false;
            }

            // Buscar ingrediente
            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(ingredienteNombre.toLowerCase())
            );
            if (!ing) {
                logger.error('Ingrediente no encontrado:', ingredienteNombre);
                return false;
            }

            // Buscar el ingrediente en la receta
            const ingredienteIdx = rec.ingredientes?.findIndex(
                item => item.ingredienteId === ing.id
            );
            if (ingredienteIdx === -1 || ingredienteIdx === undefined) {
                logger.error('El ingrediente no está en la receta');
                return false;
            }

            // Actualizar cantidad (crear nuevo array para asegurar inmutabilidad)
            const nuevosIngredientes = [...rec.ingredientes];
            nuevosIngredientes[ingredienteIdx] = {
                ...nuevosIngredientes[ingredienteIdx],
                cantidad: nuevaCantidad,
            };

            // Crear objeto actualizado
            const recetaActualizada = {
                ...rec,
                ingredientes: nuevosIngredientes,
            };

            // Llamar API para actualizar receta
            await window.api.updateReceta(rec.id, recetaActualizada);
            await window.cargarDatos();
            window.renderizarRecetas?.();
            window.calcularCosteReceta?.();
            window.showToast?.(`${rec.nombre}: ${ing.nombre} ahora = ${nuevaCantidad}`, 'success');
            return true;
        }

        // ========== NUEVAS ACCIONES DE VOZ ==========

        // ADD INGREDIENTE: add|ingrediente|NOMBRE|precio|VALOR|unidad|UNIDAD
        if (action === 'add' && entity === 'ingrediente') {
            const nombre = parts[2];
            const precio = parseFloat(parts[4]) || 0;
            const unidad = parts[6] || 'kg';

            const nuevoIng = await window.api.createIngrediente({
                nombre: nombre.toUpperCase(),
                precio: precio,
                unidad: unidad,
                stock_actual: 0,
                stock_minimo: 0,
                proveedor_id: null
            });

            await window.cargarDatos();
            window.renderizarIngredientes?.();
            window.showToast?.(`✅ Ingrediente ${nombre} creado a ${precio}€/${unidad}`, 'success');
            speakResponse(`Ingrediente ${nombre} añadido correctamente`);
            return true;
        }

        // REGISTRAR MERMA: merma|ingrediente|NOMBRE|cantidad|VALOR
        if (action === 'merma' && entity === 'ingrediente') {
            const nombre = parts[2];
            const cantidad = parseFloat(parts[4]) || 0;

            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(nombre.toLowerCase())
            );
            if (!ing) {
                logger.error('Ingrediente no encontrado:', nombre);
                window.showToast?.(`Ingrediente ${nombre} no encontrado`, 'error');
                return false;
            }

            // Backend handles stock deduction in POST /api/mermas (symmetric with DELETE restore)
            if (window.API?.fetch) {
                await window.API.fetch('/api/mermas', {
                    method: 'POST',
                    body: JSON.stringify({
                        mermas: [{
                            ingredienteId: ing.id,
                            ingredienteNombre: ing.nombre,
                            cantidad: cantidad,
                            unidad: ing.unidad || 'ud',
                            valorPerdida: 0,
                            motivo: 'Chat/Voz',
                            nota: t('chat:note_registered_via_chat'),
                            responsableId: null
                        }]
                    })
                });
            }

            await window.cargarDatos();
            window.renderizarIngredientes?.();
            window.showToast?.(`📉 Merma registrada: -${cantidad} ${ing.unidad} de ${ing.nombre}`, 'success');
            speakResponse(`Merma de ${cantidad} ${ing.unidad} de ${ing.nombre} registrada`);
            return true;
        }

        // ADD PEDIDO: add|pedido|PROVEEDOR|ingrediente|NOMBRE|cantidad|VALOR|precio|PRECIO
        if (action === 'add' && entity === 'pedido') {
            const proveedorNombre = parts[2];
            const ingredienteNombre = parts[4];
            const cantidad = parseFloat(parts[6]) || 0;
            const precio = parseFloat(parts[8]) || 0;

            // Buscar proveedor
            const proveedor = window.proveedores?.find(p =>
                p.nombre.toLowerCase().includes(proveedorNombre.toLowerCase())
            );

            // Buscar ingrediente
            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(ingredienteNombre.toLowerCase())
            );
            if (!ing) {
                window.showToast?.(`Ingrediente ${ingredienteNombre} no encontrado`, 'error');
                return false;
            }

            await window.api.createPedido({
                proveedor_id: proveedor?.id || null,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'pendiente',
                items: [{
                    ingrediente_id: ing.id,
                    cantidad: cantidad,
                    precio_unitario: precio || ing.precio
                }],
                total: cantidad * (precio || ing.precio)
            });

            await window.cargarDatos();
            window.renderizarPedidos?.();
            window.showToast?.(`📦 Pedido creado: ${cantidad} ${ing.unidad} de ${ing.nombre}`, 'success');
            speakResponse(`Pedido de ${cantidad} ${ing.unidad} de ${ing.nombre} creado`);
            return true;
        }

        // ADD VENTA: add|venta|RECETA|cantidad|VALOR
        if (action === 'add' && entity === 'venta') {
            const recetaNombre = parts[2];
            const cantidad = parseInt(parts[4]) || 1;

            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(recetaNombre.toLowerCase())
            );
            if (!rec) {
                window.showToast?.(`Receta ${recetaNombre} no encontrada`, 'error');
                return false;
            }

            const precioVenta = parseFloat(rec.precio_venta) || 0;
            const total = cantidad * precioVenta;

            await window.api.createSale({
                receta_id: rec.id,
                fecha: new Date().toISOString().split('T')[0],
                cantidad: cantidad,
                precio_unitario: precioVenta,
                total: total
            });

            await window.cargarDatos();
            window.renderizarVentas?.();
            window.showToast?.(`💰 Venta registrada: ${cantidad}x ${rec.nombre} = ${total.toFixed(2)}€`, 'success');
            speakResponse(`Venta de ${cantidad} ${rec.nombre} registrada por ${total.toFixed(2)} euros`);
            return true;
        }

        // ========== FIN NUEVAS ACCIONES ==========

        logger.warn('Acción no reconocida:', actionData);
        return false;
    } catch (error) {
        logger.error('Error ejecutando acción:', error);
        window.showToast?.('Error: ' + error.message, 'error');
        return false;
    }
}

/**
 * Muestra indicador de typing
 */
function showTyping() {
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

/**
 * Oculta indicador de typing
 */
function hideTyping() {
    const typingEl = document.getElementById('chat-typing');
    if (typingEl) typingEl.remove();
}

/**
 * Envía mensaje al webhook
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const message = input.value.trim();

    if (!message || isWaitingResponse) return;

    // Add user message
    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    // Disable input
    isWaitingResponse = true;
    sendBtn.disabled = true;
    input.disabled = true;
    showTyping();

    try {
        const tabContext = getCurrentTabContext();

        const response = await fetch(CHAT_CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                sessionId: chatSessionId,
                restaurante: window.getRestaurantName ? window.getRestaurantName() : 'Restaurante',
                timestamp: new Date().toISOString(),
                fechaHoy: new Date().toLocaleDateString((window.getCurrentLanguage?.() || 'es') === 'en' ? 'en-GB' : 'es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                }),
                fechaISO: new Date().toISOString().split('T')[0],
                contexto: tabContext,
                lang: window.getCurrentLanguage?.() || 'es',
            }),
        });

        hideTyping();

        if (!response.ok) {
            throw new Error('Error en la respuesta');
        }

        const data = await response.text();

        // Detectar si hay una acción pendiente de confirmar
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
 * Renderiza el historial
 * ⚡ Optimizado: Usa DocumentFragment para evitar múltiples reflows
 */
function renderChatHistory() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';

    // ⚡ OPTIMIZACIÓN: Crear fragmento para batch DOM operations
    const fragment = document.createDocumentFragment();

    chatMessages.forEach(msg => {
        const time = new Date(msg.time).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
        });
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${msg.type}`;
        // Botón PDF para mensajes del bot (no para bienvenida)
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

    // Una sola operación DOM en lugar de N operaciones
    messagesContainer.appendChild(fragment);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Limpia el historial
 */
export function clearChatHistory() {
    chatMessages = [];
    localStorage.removeItem('chatHistory');
    chatSessionId = generateSessionId();
    localStorage.setItem('chatSessionId', chatSessionId);

    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        addMessage('bot', CHAT_CONFIG.welcomeMessage);
    }
}

/**
 * Limpia el chat (wrapper para el botón)
 * Usa doble clic como confirmación para evitar borrado accidental
 */
let clearClickCount = 0;
let clearClickTimer = null;

function clearChat() {
    clearClickCount++;

    if (clearClickCount === 1) {
        // Primer clic - mostrar aviso
        window.showToast?.(t('chat:clear_confirm_hint'), 'warning');
        clearClickTimer = setTimeout(() => {
            clearClickCount = 0; // Reset después de 2 segundos
        }, 2000);
    } else if (clearClickCount >= 2) {
        // Segundo clic - borrar
        clearTimeout(clearClickTimer);
        clearClickCount = 0;
        clearChatHistory();
        window.showToast?.(t('chat:history_cleared'), 'success');
    }
}

/**
 * Actualiza botones rápidos según la pestaña actual
 */
function updateQuickButtons() {
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

/**
 * Obtiene la pestaña actual
 */
function getCurrentTab() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        return activeTab.textContent
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
    return 'dashboard';
}

/**
 * Obtiene contexto de la pestaña actual para enviar al agente
 */
function getCurrentTabContext() {
    const tab = getCurrentTab();
    const context = { tab };

    try {
        // Siempre incluir gastos fijos reales
        const opex = JSON.parse(localStorage.getItem('opex_inputs') || '{}');
        context.gastosFijos = {
            alquiler: parseFloat(opex.alquiler) || 0,
            personal: parseFloat(opex.personal) || 0,
            suministros: parseFloat(opex.suministros) || 0,
            otros: parseFloat(opex.otros) || 0,
            total:
                (parseFloat(opex.alquiler) || 0) +
                (parseFloat(opex.personal) || 0) +
                (parseFloat(opex.suministros) || 0) +
                (parseFloat(opex.otros) || 0),
        };

        // Siempre incluir TODOS los ingredientes con datos compactos
        if (window.ingredientes && Array.isArray(window.ingredientes)) {
            // Calcular valor total del inventario
            let valorTotalStock = 0;
            context.ingredientes = window.ingredientes.map(i => {
                const stock = parseFloat(i.stock_actual) || parseFloat(i.stock_virtual) || 0;
                const precio = parseFloat(i.precio_medio) || parseFloat(i.precio) || 0;
                valorTotalStock += stock * precio;
                return {
                    nombre: i.nombre,
                    precio: precio,
                    unidad: i.unidad || 'kg',
                    stock: stock,
                };
            });
            context.totalIngredientes = window.ingredientes.length;
            context.valorTotalStock = Math.round(valorTotalStock * 100) / 100;
            context.stockBajo = window.ingredientes.filter(
                i => i.stock_minimo > 0 && parseFloat(i.stock_actual) <= parseFloat(i.stock_minimo)
            ).length;
        }

        // Siempre incluir resumen de recetas con ingredientes detallados
        if (window.recetas && Array.isArray(window.recetas)) {
            context.recetas = window.recetas.slice(0, 15).map(r => {
                const coste = window.calcularCosteRecetaCompleto
                    ? window.calcularCosteRecetaCompleto(r)
                    : 0;
                const precioVenta = parseFloat(r.precio_venta) || 0;
                const foodCost = precioVenta > 0 ? (coste / precioVenta) * 100 : 0;
                const margen = precioVenta > 0 ? ((precioVenta - coste) / precioVenta) * 100 : 0;

                // Incluir ingredientes detallados
                const ingredientesDetalle = (r.ingredientes || []).map(item => {
                    const ing = window.ingredientes?.find(i => i.id === item.ingredienteId);
                    const precio = ing ? parseFloat(ing.precio) || 0 : 0;
                    const cantidad = parseFloat(item.cantidad) || 0;
                    return {
                        nombre: ing?.nombre || 'Desconocido',
                        cantidad: cantidad,
                        unidad: ing?.unidad || 'kg',
                        precioUd: precio,
                        coste: Math.round(precio * cantidad * 100) / 100,
                    };
                });

                return {
                    nombre: r.nombre,
                    categoria: r.categoria,
                    coste: Math.round(coste * 100) / 100,
                    precioVenta: precioVenta,
                    foodCost: Math.round(foodCost * 10) / 10,
                    margen: Math.round(margen * 10) / 10,
                    ingredientes: ingredientesDetalle,
                };
            });
            context.totalRecetas = window.recetas.length;
            context.recetasFoodCostAlto = context.recetas.filter(r => r.foodCost > 33).length;
        }

        // Incluir proveedores
        if (window.proveedores && Array.isArray(window.proveedores)) {
            context.proveedores = window.proveedores.map(p => ({
                id: p.id,
                nombre: p.nombre,
                telefono: p.telefono || '',
                email: p.email || '',
            }));
            context.totalProveedores = window.proveedores.length;
        }

        // 🆕 Incluir relación ingrediente → proveedores (para preguntas de múltiples proveedores)
        if (window.ingredientes && window.proveedores) {
            // Calcular ingredientes con múltiples proveedores
            const ingredientesConProveedores = window.ingredientes
                .filter(ing => ing.proveedores && Array.isArray(ing.proveedores) && ing.proveedores.length > 0)
                .map(ing => {
                    const proveedoresNombres = ing.proveedores.map(p => {
                        const prov = window.proveedores.find(pr => pr.id === p.proveedor_id);
                        return prov ? prov.nombre : 'Desconocido';
                    });
                    return {
                        ingrediente: ing.nombre,
                        numProveedores: ing.proveedores.length,
                        proveedores: proveedoresNombres.join(', '),
                    };
                });

            context.ingredientesMultiplesProveedores = ingredientesConProveedores.filter(i => i.numProveedores >= 2);
            context.totalIngredientesConMultiplesProveedores = context.ingredientesMultiplesProveedores.length;

            // Ingredientes sin proveedor asignado
            context.ingredientesSinProveedor = window.ingredientes
                .filter(ing => !ing.proveedores || ing.proveedores.length === 0)
                .filter(ing => !ing.proveedor_id && !ing.proveedorId)
                .map(ing => ing.nombre)
                .slice(0, 20); // Limitar para no saturar el contexto
        }

        // Incluir ventas si existen
        if (window.ventas && Array.isArray(window.ventas)) {
            const hoy = new Date().toISOString().split('T')[0];
            const ventasHoy = window.ventas.filter(v => v.fecha === hoy);
            const totalVentasHoy = ventasHoy.reduce(
                (sum, v) => sum + (parseFloat(v.total) || 0),
                0
            );
            context.ventas = {
                hoy: Math.round(totalVentasHoy * 100) / 100,
                totalRegistros: window.ventas.length,
            };
        }

        // Incluir empleados
        if (window.empleados && Array.isArray(window.empleados)) {
            context.empleados = window.empleados.map(e => ({
                id: e.id,
                nombre: e.nombre,
                puesto: e.puesto || '',
            }));
            context.totalEmpleados = window.empleados.length;
        }

        // Incluir horarios de hoy
        if (window.horarios && Array.isArray(window.horarios)) {
            const hoyISO = new Date().toISOString().split('T')[0];
            const horariosHoy = window.horarios.filter(h => {
                const fechaH = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha;
                return fechaH === hoyISO;
            });
            context.horariosHoy = horariosHoy.map(h => {
                const emp = window.empleados?.find(e => e.id === h.empleado_id);
                return {
                    empleado: emp?.nombre || 'Desconocido',
                    turno: h.turno,
                    horaInicio: h.hora_inicio,
                    horaFin: h.hora_fin,
                };
            });
            // Calcular quién trabaja y quién libra
            const idsTrabajan = new Set(horariosHoy.map(h => h.empleado_id));
            context.trabajanHoy = (window.empleados || [])
                .filter(e => idsTrabajan.has(e.id))
                .map(e => e.nombre);
            context.libranHoy = (window.empleados || [])
                .filter(e => !idsTrabajan.has(e.id))
                .map(e => e.nombre);
        }

        // 🆕 Incluir datos del P&L/Diario (datosResumenMensual)
        if (window.datosResumenMensual) {
            const resumen = window.datosResumenMensual;
            context.diario = {
                dias: resumen.dias || [],
                totalCompras: resumen.compras?.total || 0,
                totalIngresos: resumen.ventas?.totalIngresos || 0,
                totalCostes: resumen.ventas?.totalCostes || 0,
                beneficioBruto: resumen.ventas?.beneficioBruto || 0,
                foodCost: resumen.resumen?.foodCost || 0,
                margenPromedio: resumen.resumen?.margenPromedio || 0,
            };

            // Incluir datos por día (últimos 7 días para no saturar)
            if (resumen.ventas?.recetas) {
                const datosPorDia = {};
                for (const [nombre, recetaData] of Object.entries(resumen.ventas.recetas)) {
                    for (const [fecha, diaData] of Object.entries(recetaData.dias || {})) {
                        if (!datosPorDia[fecha]) {
                            datosPorDia[fecha] = { ingresos: 0, costes: 0, vendidas: 0 };
                        }
                        datosPorDia[fecha].ingresos += diaData.ingresos || 0;
                        datosPorDia[fecha].costes += diaData.coste || 0;
                        datosPorDia[fecha].vendidas += diaData.vendidas || 0;
                    }
                }
                // Convertir a array ordenado por fecha (últimos 7)
                context.diario.porDia = Object.entries(datosPorDia)
                    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                    .slice(0, 7)
                    .map(([fecha, data]) => ({
                        fecha,
                        ingresos: Math.round(data.ingresos * 100) / 100,
                        costes: Math.round(data.costes * 100) / 100,
                        margenBruto: Math.round((data.ingresos - data.costes) * 100) / 100,
                        foodCost: data.ingresos > 0 ? Math.round((data.costes / data.ingresos) * 1000) / 10 : 0,
                        vendidas: data.vendidas
                    }));
            }
        }
    } catch (e) {
        logger.warn('Error obteniendo contexto:', e);
    }

    return context;
}

// Escuchar cambios de pestaña para actualizar botones
document.addEventListener('click', e => {
    if (e.target.classList.contains('tab-btn')) {
        setTimeout(updateQuickButtons, 100);
    }
});

/**
 * Parse Markdown to HTML (tablas, negritas, listas, código)
 */
function parseMarkdown(text) {
    if (!text) return '';

    // Detectar si hay una tabla markdown (líneas con | y separador con ---)
    const lines = text.split('\n');
    let tableStartIndex = -1;
    let tableEndIndex = -1;
    let hasSeparator = false;

    // Buscar tabla markdown estándar
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detectar separador de tabla (|---|---|)
        if (/^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(line) || /^[\-\|:\s]+$/.test(line)) {
            if (tableStartIndex === -1 && i > 0) tableStartIndex = i - 1;
            hasSeparator = true;
            continue;
        }

        // Línea con pipes (posible fila de tabla)
        if (line.includes('|') && hasSeparator) {
            tableEndIndex = i;
        } else if (line.includes('|') && tableStartIndex === -1) {
            tableStartIndex = i;
        } else if (!line.includes('|') && tableEndIndex > tableStartIndex) {
            // Fin de la tabla
            break;
        }
    }

    // Si encontramos una tabla, convertirla
    if (hasSeparator && tableStartIndex >= 0 && tableEndIndex > tableStartIndex) {
        const beforeTable = lines.slice(0, tableStartIndex).join('\n');
        const tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
        const afterTable = lines.slice(tableEndIndex + 1).join('\n');

        let tableHtml = '<div class="chat-table-wrapper"><table class="chat-table"><tbody>';
        let isHeader = true;

        for (const line of tableLines) {
            // Ignorar separadores
            if (/^[\s\-:|]+$/.test(line.trim())) continue;
            if (/^\|?[\s\-:]+\|/.test(line.trim())) continue;

            // Extraer celdas
            const cells = line
                .split('|')
                .map(c => c.trim())
                .filter(c => c !== '');

            if (cells.length > 0) {
                const tag = isHeader ? 'th' : 'td';
                // SEGURIDAD: Escapar HTML en celdas de tabla
                tableHtml += '<tr>' + cells.map(c => {
                    const safeCell = c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<${tag}>${safeCell}</${tag}>`;
                }).join('') + '</tr>';
                isHeader = false;
            }
        }

        tableHtml += '</tbody></table></div>';

        return formatTextContent(beforeTable) + tableHtml + formatTextContent(afterTable);
    }

    // Fallback: formateo normal sin tabla
    return formatTextContent(text);
}

/**
 * Formatea contenido de texto (negritas, listas, etc.)
 */
function formatTextContent(text) {
    if (!text) return '';

    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Negritas **texto** o __texto__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Código inline `código`
    html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

    // Listas con •
    html = html.replace(/•\s+([^\n]+)/g, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul class="chat-list">$&</ul>');

    // Emojis en mayúsculas como títulos (simplificado)
    html = html.replace(
        /([📊💰📦📈🏪🎯✅❌⚠️🔴🟢🟡])\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]*:)/g,
        '<strong>$1 $2</strong>'
    );

    // Saltos de línea
    html = html.replace(/\n/g, '<br>');

    return html;
}

// Exportar para uso global
window.initChatWidget = initChatWidget;
window.clearChatHistory = clearChatHistory;
window.toggleChat = toggleChat;
