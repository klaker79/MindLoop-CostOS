/**
 * DOM Helpers - Funciones seguras para acceso al DOM
 * Previene crashes por elementos null/undefined
 */

/**
 * Obtiene elemento por ID de forma segura
 * @param {string} id - ID del elemento
 * @param {string} context - Contexto para debugging
 * @returns {HTMLElement|null}
 */
export function getElement(id, context = '') {
    const element = document.getElementById(id);
    if (!element && context) {
        console.warn(`[DOM] Elemento '${id}' no encontrado en contexto: ${context}`);
    }
    return element;
}

/**
 * Establece texto de un elemento de forma segura
 * @param {string} id - ID del elemento
 * @param {string} text - Texto a establecer
 * @param {string} fallback - Texto por defecto si elemento no existe
 */
export function setElementText(id, text, fallback = '') {
    const element = getElement(id);
    if (element) {
        element.textContent = text;
    } else if (fallback) {
        console.warn(`[DOM] No se pudo establecer texto en '${id}', usando fallback`);
    }
}

/**
 * Establece HTML de un elemento de forma segura
 * ADVERTENCIA: Solo usar con HTML trusted, no con input de usuario
 * @param {string} id - ID del elemento  
 * @param {string} html - HTML a establecer
 */
export function setElementHTML(id, html) {
    const element = getElement(id);
    if (element) {
        element.innerHTML = html;
    }
}

/**
 * Obtiene valor de input de forma segura
 * @param {string} id - ID del input
 * @returns {string}
 */
export function getInputValue(id) {
    const element = getElement(id);
    return element ? element.value : '';
}

/**
 * Establece valor de input de forma segura
 * @param {string} id - ID del input
 * @param {string} value - Valor a establecer
 */
export function setInputValue(id, value) {
    const element = getElement(id);
    if (element) {
        element.value = value;
    }
}

/**
 * Añade clase a elemento de forma segura
 * @param {string} id - ID del elemento
 * @param {string} className - Clase a añadir
 */
export function addElementClass(id, className) {
    const element = getElement(id);
    if (element) {
        element.classList.add(className);
    }
}

/**
 * Elimina clase de elemento de forma segura
 * @param {string} id - ID del elemento
 * @param {string} className - Clase a eliminar
 */
export function removeElementClass(id, className) {
    const element = getElement(id);
    if (element) {
        element.classList.remove(className);
    }
}

/**
 * Toggle clase de elemento de forma segura
 * @param {string} id - ID del elemento
 * @param {string} className - Clase a toggle
 */
export function toggleElementClass(id, className) {
    const element = getElement(id);
    if (element) {
        element.classList.toggle(className);
    }
}

/**
 * Muestra elemento (display: block)
 * @param {string} id - ID del elemento
 */
export function showElement(id) {
    const element = getElement(id);
    if (element) {
        element.style.display = 'block';
    }
}

/**
 * Oculta elemento (display: none)
 * @param {string} id - ID del elemento
 */
export function hideElement(id) {
    const element = getElement(id);
    if (element) {
        element.style.display = 'none';
    }
}
