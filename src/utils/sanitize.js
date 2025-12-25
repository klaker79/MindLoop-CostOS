/**
 * Módulo de Sanitización - Seguridad XSS
 * Protección contra ataques Cross-Site Scripting (XSS)
 *
 * Usa DOMPurify para limpiar HTML antes de insertarlo en el DOM
 */

import DOMPurify from 'dompurify';

/**
 * Configur

ación segura de DOMPurify
 */
const CONFIG = {
    // Permitir solo tags seguros
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span', 'div', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
    ALLOWED_ATTR: ['href', 'class', 'id', 'style', 'onclick'],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false
};

/**
 * Sanitiza HTML de forma segura
 * @param {string} dirty - HTML sin sanitizar
 * @param {object} customConfig - Configuración personalizada (opcional)
 * @returns {string} - HTML sanitizado y seguro
 */
export function sanitizeHTML(dirty, customConfig = {}) {
    if (typeof dirty !== 'string') {
        return '';
    }

    const config = { ...CONFIG, ...customConfig };
    return DOMPurify.sanitize(dirty, config);
}

/**
 * Establece contenido HTML de forma segura en un elemento
 * @param {HTMLElement|string} element - Elemento o ID del elemento
 * @param {string} html - HTML a insertar
 */
export function setHTMLSafe(element, html) {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (!el) {
        console.warn('Elemento no encontrado:', element);
        return;
    }

    el.innerHTML = sanitizeHTML(html);
}

/**
 * Para contenido que NO necesita HTML, usar textContent
 * Esta es la opción MÁS SEGURA
 * @param {HTMLElement|string} element - Elemento o ID del elemento
 * @param {string} text - Texto plano
 */
export function setTextSafe(element, text) {
    const el = typeof element === 'string' ? document.getElementById(element) : element;
    if (!el) {
        console.warn('Elemento no encontrado:', element);
        return;
    }

    el.textContent = String(text);
}

/**
 * Sanitiza atributos de URL para prevenir javascript: y data: URLs
 * @param {string} url - URL a validar
 * @returns {string} - URL segura o cadena vacía
 */
export function sanitizeURL(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }

    const trimmed = url.trim().toLowerCase();

    // Prevenir javascript: y data: URLs
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
        console.warn('URL peligrosa bloqueada:', url);
        return '';
    }

    return url;
}

export default {
    sanitizeHTML,
    setHTMLSafe,
    setTextSafe,
    sanitizeURL
};
