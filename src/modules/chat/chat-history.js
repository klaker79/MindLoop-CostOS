/**
 * Chat — Mapeo del historial local al formato que espera el backend Claude.
 *
 * El historial se guarda como { type:'user'|'bot', text, time } y el backend
 * (processChat → buildConversationMessages) espera { role:'user'|'assistant',
 * content }. Enviamos solo los turnos más recientes para dar memoria
 * conversacional sin disparar el coste en tokens (el backend vuelve a acotar y
 * sanear, así que esto es solo una primera poda).
 *
 * Módulo puro y sin side-effects (testeable de forma aislada).
 */

/**
 * @param {Array<{type:string, text:string}>} messages historial local
 * @param {number} limit nº máximo de mensajes recientes a enviar
 * @returns {Array<{role:'user'|'assistant', content:string}>}
 */
export function mapHistoryForBackend(messages, limit = 8) {
    if (!Array.isArray(messages)) return [];
    return messages
        .filter(m =>
            m &&
            typeof m.text === 'string' &&
            m.text.trim() &&
            (m.type === 'user' || m.type === 'bot')
        )
        .slice(-limit)
        .map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text,
        }));
}
