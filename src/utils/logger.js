/**
 * Sistema de Logging Centralizado - MindLoop CostOS
 *
 * Logger profesional con niveles de log, formateo y control por entorno.
 *
 * @module utils/logger
 *
 * @example
 * import { logger } from '@utils/logger';
 *
 * logger.log('Datos cargados');
 * logger.warn('Stock bajo');
 * logger.error('Error al guardar', error);
 * logger.debug('Estado:', state);
 */

import { APP_INFO } from '../config/constants.js';

/**
 * Niveles de log
 */
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    LOG: 3,
    DEBUG: 4
};

/**
 * Nivel actual basado en entorno
 */
const currentLevel = (() => {
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LOG_LEVELS) {
        return LOG_LEVELS[envLevel];
    }
    // Producción: solo errors y warnings
    // Desarrollo: todo
    return import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
})();

/**
 * Verifica si debug está habilitado
 */
const isDebugEnabled = import.meta.env.VITE_ENABLE_DEBUG === 'true';

/**
 * Formatea timestamp
 */
function getTimestamp() {
    const now = new Date();
    return now.toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
}

/**
 * Formatea el mensaje con metadata
 */
function formatMessage(level, args) {
    const timestamp = getTimestamp();
    const prefix = `[${timestamp}] [${level}]`;
    return [prefix, ...args];
}

/**
 * Estilos para console
 */
const STYLES = {
    ERROR: 'color: #ef4444; font-weight: bold;',
    WARN: 'color: #f59e0b; font-weight: bold;',
    INFO: 'color: #3b82f6;',
    LOG: 'color: #6b7280;',
    DEBUG: 'color: #8b5cf6;'
};

/**
 * Logger principal
 */
export const logger = {
    /**
     * Error crítico - Siempre se muestra
     */
    error(...args) {
        if (currentLevel >= LOG_LEVELS.ERROR) {
            const formatted = formatMessage('ERROR', args);
            console.error('%c' + formatted[0], STYLES.ERROR, ...formatted.slice(1));

            // Enviar a sistema de error tracking si está configurado
            if (window.Sentry) {
                window.Sentry.captureException(args[0]);
            }
        }
    },

    /**
     * Warning - Problemas no críticos
     */
    warn(...args) {
        if (currentLevel >= LOG_LEVELS.WARN) {
            const formatted = formatMessage('WARN', args);
            console.warn('%c' + formatted[0], STYLES.WARN, ...formatted.slice(1));
        }
    },

    /**
     * Info - Información importante
     */
    info(...args) {
        if (currentLevel >= LOG_LEVELS.INFO) {
            const formatted = formatMessage('INFO', args);
            console.info('%c' + formatted[0], STYLES.INFO, ...formatted.slice(1));
        }
    },

    /**
     * Log general - Solo en desarrollo o si debug activado
     */
    log(...args) {
        if (currentLevel >= LOG_LEVELS.LOG || isDebugEnabled) {
            const formatted = formatMessage('LOG', args);
            console.log('%c' + formatted[0], STYLES.LOG, ...formatted.slice(1));
        }
    },

    /**
     * Debug - Solo en modo debug
     */
    debug(...args) {
        if (currentLevel >= LOG_LEVELS.DEBUG || isDebugEnabled) {
            const formatted = formatMessage('DEBUG', args);
            console.log('%c' + formatted[0], STYLES.DEBUG, ...formatted.slice(1));
        }
    },

    /**
     * Log de grupo (colapsable)
     */
    group(label, ...args) {
        if (currentLevel >= LOG_LEVELS.LOG || isDebugEnabled) {
            console.group(`[${getTimestamp()}] ${label}`);
            args.forEach(arg => console.log(arg));
            console.groupEnd();
        }
    },

    /**
     * Log de tabla
     */
    table(data, columns) {
        if (currentLevel >= LOG_LEVELS.LOG || isDebugEnabled) {
            console.log(`%c[${getTimestamp()}] [TABLE]`, STYLES.LOG);
            console.table(data, columns);
        }
    },

    /**
     * Performance timing
     */
    time(label) {
        if (currentLevel >= LOG_LEVELS.DEBUG || isDebugEnabled) {
            console.time(`[${getTimestamp()}] ${label}`);
        }
    },

    timeEnd(label) {
        if (currentLevel >= LOG_LEVELS.DEBUG || isDebugEnabled) {
            console.timeEnd(`[${getTimestamp()}] ${label}`);
        }
    },

    /**
     * Assert con mensaje personalizado
     */
    assert(condition, ...args) {
        if (!condition && currentLevel >= LOG_LEVELS.ERROR) {
            const formatted = formatMessage('ASSERT FAILED', args);
            console.error('%c' + formatted[0], STYLES.ERROR, ...formatted.slice(1));
        }
    }
};

/**
 * Logger especializado para API calls
 */
export const apiLogger = {
    request(method, url, data) {
        logger.debug(`API ${method}:`, url, data);
    },

    response(method, url, response, duration) {
        logger.debug(`API ${method} Response (${duration}ms):`, url, response);
    },

    error(method, url, error) {
        logger.error(`API ${method} Error:`, url, error);
    }
};

/**
 * Logger especializado para Performance
 */
export const perfLogger = {
    measure(name, startTime, endTime) {
        const duration = endTime - startTime;
        const formatted = duration.toFixed(2);

        if (duration > 1000) {
            logger.warn(`⚠️ Slow operation: ${name} took ${formatted}ms`);
        } else {
            logger.debug(`⚡ Performance: ${name} took ${formatted}ms`);
        }

        return duration;
    },

    mark(name) {
        if (isDebugEnabled) {
            performance.mark(name);
        }
    },

    measure(name, startMark, endMark) {
        if (isDebugEnabled) {
            try {
                performance.measure(name, startMark, endMark);
                const measure = performance.getEntriesByName(name)[0];
                logger.debug(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
            } catch (e) {
                logger.warn('Performance measure failed:', e);
            }
        }
    }
};

/**
 * Logger inicial con información del sistema
 */
export function logSystemInfo() {
    if (import.meta.env.DEV || isDebugEnabled) {
        console.group('%c🚀 MindLoop CostOS', 'color: #667eea; font-size: 16px; font-weight: bold;');
        console.log('%cVersion:', 'font-weight: bold;', APP_INFO.VERSION);
        console.log('%cEnvironment:', 'font-weight: bold;', APP_INFO.ENV);
        console.log('%cBuild Date:', 'font-weight: bold;', APP_INFO.BUILD_DATE);
        console.log('%cLog Level:', 'font-weight: bold;', Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLevel));
        console.log('%cDebug Mode:', 'font-weight: bold;', isDebugEnabled);
        console.groupEnd();
    }
}

// Default export
export default logger;
