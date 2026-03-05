/**
 * ============================================
 * utils/error-handler.js - Global Error Handler
 * ============================================
 *
 * Manejo centralizado de errores para toda la aplicación.
 * Captura errores no manejados, errores de promesas, y errores de API.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

/**
 * Tipos de errores
 */
export const ErrorTypes = {
    NETWORK: 'network',
    API: 'api',
    VALIDATION: 'validation',
    AUTH: 'auth',
    UNKNOWN: 'unknown'
};

/**
 * Clasifica un error por tipo
 */
export function classifyError(error) {
    if (!error) return { type: ErrorTypes.UNKNOWN, message: 'Error desconocido' };

    const message = error.message || String(error);
    const status = error.status || error.statusCode;

    // Error de red
    if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
        return {
            type: ErrorTypes.NETWORK,
            message: 'Error de conexión. Verifica tu internet.',
            original: message
        };
    }

    // Error de autenticación
    if (status === 401 || message.includes('401') || message.includes('unauthorized') || message.includes('token')) {
        return {
            type: ErrorTypes.AUTH,
            message: 'Sesión expirada. Por favor, inicia sesión de nuevo.',
            original: message
        };
    }

    // Error de servidor
    if (status >= 500 || message.includes('500') || message.includes('server')) {
        return {
            type: ErrorTypes.API,
            message: 'Error del servidor. Intenta de nuevo en unos minutos.',
            original: message
        };
    }

    // Error de validación (400)
    if (status === 400 || message.includes('400') || message.includes('validation')) {
        return {
            type: ErrorTypes.VALIDATION,
            message: message,
            original: message
        };
    }

    // Error desconocido
    return {
        type: ErrorTypes.UNKNOWN,
        message: message,
        original: message
    };
}

/**
 * Maneja un error de forma consistente
 * @param {Error} error - Error a manejar
 * @param {string} context - Contexto donde ocurrió (ej: 'guardando ingrediente')
 * @param {Object} options - Opciones adicionales
 */
export function handleError(error, context = '', options = {}) {
    const { silent = false, rethrow = false, showToast = true } = options;

    const classified = classifyError(error);

    // Log para debugging
    console.error(`❌ Error ${context ? 'en ' + context : ''}:`, {
        type: classified.type,
        message: classified.message,
        original: classified.original,
        stack: error?.stack
    });

    // Mostrar toast al usuario (si no es silent)
    if (showToast && !silent && typeof window.showToast === 'function') {
        const userMessage = context
            ? `Error ${context}: ${classified.message}`
            : classified.message;
        window.showToast(userMessage, 'error');
    }

    // Acción especial para errores de auth
    if (classified.type === ErrorTypes.AUTH) {
        // Limpiar sesión y redirigir
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Solo redirigir si no estamos ya en login
        if (!window.location.pathname.includes('landing')) {
            setTimeout(() => {
                window.location.href = '/landing.html';
            }, 2000);
        }
    }

    // Re-lanzar si se pide
    if (rethrow) {
        throw error;
    }

    return classified;
}

/**
 * Wrapper para funciones async que maneja errores automáticamente
 * @param {Function} fn - Función async a ejecutar
 * @param {string} context - Contexto del error
 * @returns {Function} Función wrapped
 */
export function withErrorHandler(fn, context = '') {
    return async function (...args) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            handleError(error, context);
            return null;
        }
    };
}

/**
 * Ejecuta una función con retry en caso de error
 * @param {Function} fn - Función async a ejecutar
 * @param {number} maxRetries - Número máximo de reintentos
 * @param {number} delayMs - Delay entre reintentos
 */
export async function withRetry(fn, maxRetries = 2, delayMs = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const classified = classifyError(error);

            // No reintentar errores de validación o auth
            if (classified.type === ErrorTypes.VALIDATION || classified.type === ErrorTypes.AUTH) {
                throw error;
            }

            // Si hay más reintentos, esperar
            if (attempt < maxRetries) {
                console.warn(`⚠️ Reintento ${attempt + 1}/${maxRetries} en ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError;
}

/**
 * Inicializa handlers globales para errores no capturados
 */
export function initGlobalErrorHandlers() {
    // Errores síncronos no capturados
    window.addEventListener('error', (event) => {
        console.error('🔴 Error global no capturado:', event.error);

        // No mostrar toast para errores de scripts externos
        if (event.filename && !event.filename.includes(window.location.origin)) {
            return;
        }

        handleError(event.error, 'error global', { showToast: true });
    });

    // Promesas rechazadas no capturadas
    window.addEventListener('unhandledrejection', (event) => {
        console.error('🔴 Promise rechazada no capturada:', event.reason);

        handleError(event.reason, 'promesa no manejada', { showToast: true });

        // Prevenir el mensaje por defecto del browser
        event.preventDefault();
    });

    // eslint-disable-next-line no-console
    console.log('✅ Global error handlers initialized');
}

// Auto-inicializar al cargar el módulo
if (typeof window !== 'undefined') {
    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalErrorHandlers);
    } else {
        initGlobalErrorHandlers();
    }

    // Exponer globalmente
    window.ErrorHandler = {
        handleError,
        classifyError,
        withErrorHandler,
        withRetry,
        ErrorTypes
    };
}

export default {
    handleError,
    classifyError,
    withErrorHandler,
    withRetry,
    initGlobalErrorHandlers,
    ErrorTypes
};
