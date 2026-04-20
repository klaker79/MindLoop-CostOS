/**
 * Chat — Estado de sesión, historial y configuración.
 *
 * TENANT ISOLATION: las claves de localStorage se prefijan con el restauranteId
 * para que cambiar de tenant en el mismo navegador nunca mezcle conversaciones.
 *   chatHistory_<restauranteId>, chatSessionId_<restauranteId>
 * Sin sesión → "anon" (pantalla de login).
 *
 * Importar este módulo tiene un side-effect one-time: limpia las claves legacy
 * sin prefijo (`chatHistory`, `chatSessionId`) que existían antes del fix.
 *
 * Expone accessors puros — nunca exports mutables — para que todos los módulos
 * vean el mismo estado.
 */

import { appConfig } from '../../config/app-config.js';
import { t } from '@/i18n/index.js';

export const CHAT_CONFIG = {
    webhookUrl: appConfig.chat.webhookUrl,
    get botName() { return t('chat:bot_name') || appConfig.chat.botName || 'CostOS Assistant'; },
    get welcomeMessage() {
        return `${t('chat:welcome')}\n\n• 📊 ${t('chat:welcome_food_cost')}\n• 💰 ${t('chat:welcome_costs')}\n• 📦 ${t('chat:welcome_stock')}\n• 📈 ${t('chat:welcome_margins')}\n• 🏪 ${t('chat:welcome_suppliers')}\n\n${t('chat:welcome_cta')}`;
    },
    get placeholderText() { return t('chat:placeholder'); },
    get errorMessage() { return t('chat:error_generic'); },
};

function generateSessionId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getCurrentRestauranteId() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.restauranteId ? String(user.restauranteId) : 'anon';
    } catch {
        return 'anon';
    }
}

export function chatHistoryKey() { return 'chatHistory_' + getCurrentRestauranteId(); }
export function chatSessionKey() { return 'chatSessionId_' + getCurrentRestauranteId(); }

// One-time cleanup: legacy un-prefixed keys would leak cross-tenant.
try {
    localStorage.removeItem('chatHistory');
    localStorage.removeItem('chatSessionId');
} catch { /* ignore */ }

let chatSessionId = localStorage.getItem(chatSessionKey()) || generateSessionId();
localStorage.setItem(chatSessionKey(), chatSessionId);

let chatMessages = [];
try {
    const storedHistory = localStorage.getItem(chatHistoryKey());
    if (storedHistory) {
        chatMessages = JSON.parse(storedHistory);
        if (!Array.isArray(chatMessages)) {
            console.warn('⚠️ chatHistory corrupto, reseteando...');
            chatMessages = [];
            localStorage.removeItem(chatHistoryKey());
        }
    }
} catch (parseError) {
    console.error('❌ Error parseando chatHistory, reseteando:', parseError);
    chatMessages = [];
    localStorage.removeItem(chatHistoryKey());
}

/** Devuelve el sessionId actual. */
export function getSessionId() {
    return chatSessionId;
}

/** Devuelve el array de mensajes (no copiar — es el array vivo). */
export function getMessages() {
    return chatMessages;
}

/**
 * Añade un mensaje al historial, trunca a 50 y persiste.
 */
export function pushMessage(msg) {
    chatMessages.push(msg);
    if (chatMessages.length > 50) chatMessages = chatMessages.slice(-50);
    localStorage.setItem(chatHistoryKey(), JSON.stringify(chatMessages));
}

/**
 * Vacía el historial, regenera la sesión y persiste todo.
 */
export function resetHistory() {
    chatMessages = [];
    localStorage.removeItem(chatHistoryKey());
    chatSessionId = generateSessionId();
    localStorage.setItem(chatSessionKey(), chatSessionId);
}
