/**
 * Renderiza HTML de forma segura usando DOMPurify
 * @param {string} html - HTML potencialmente peligroso
 * @returns {string} HTML sanitizado
 */
import DOMPurify from 'dompurify';

export function sanitizeHTML(html) {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'p'],
        ALLOWED_ATTR: ['class', 'style']
    });
}

/**
 * Escapa HTML para texto plano (sin tags permitidos)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Renderiza contenido en un elemento de forma segura
 * @param {HTMLElement} element - Elemento destino
 * @param {string} html - HTML a renderizar
 * @param {boolean} allowTags - Si permite tags HTML básicos
 */
export function renderSafeHTML(element, html, allowTags = false) {
    if (!element) return;

    if (allowTags) {
        element.innerHTML = sanitizeHTML(html);
    } else {
        element.textContent = html;
    }
}

export default { sanitizeHTML, escapeHTML, renderSafeHTML };
