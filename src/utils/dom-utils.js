/**
 * Utilidades DOM extraídas de app-core.js
 * @module utils/dom-utils
 */

/**
 * Muestra un indicador de carga
 * @param {string} message - Mensaje a mostrar
 */
export function showLoading(message = 'Cargando...') {
    let overlay = document.getElementById('loading-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <p class="loading-message">${message}</p>
        `;
        document.body.appendChild(overlay);
    } else {
        const msgEl = overlay.querySelector('.loading-message');
        if (msgEl) msgEl.textContent = message;
    }

    overlay.classList.add('active');
}

/**
 * Oculta el indicador de carga
 */
export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Añade clase temporalmente a un elemento
 * @param {HTMLElement} element
 * @param {string} className
 * @param {number} duration - ms
 */
export function flashClass(element, className, duration = 300) {
    if (!element) return;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration);
}

/**
 * Scroll suave a un elemento
 * @param {string|HTMLElement} target - Selector o elemento
 */
export function scrollToElement(target) {
    const element = typeof target === 'string'
        ? document.querySelector(target)
        : target;

    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export default { showLoading, hideLoading, flashClass, scrollToElement };
