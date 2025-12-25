/**
 * Configuración de la Aplicación - MindLoop CostOS
 *
 * Configuraciones dinámicas y avanzadas de la aplicación.
 *
 * @module config/app-config
 */

import { CACHE_TTL, DEBOUNCE_DELAY, PAGE_SIZE } from './constants.js';

/**
 * Configuración de la aplicación
 */
export const appConfig = {
    /**
     * Configuración de API
     */
    api: {
        baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://lacaleta-api.mindloop.cloud',
        timeout: 30000, // 30 segundos
        retries: 3,
        retryDelay: 1000 // 1 segundo entre reintentos
    },

    /**
     * Configuración de Chat
     */
    chat: {
        webhookUrl: import.meta.env.VITE_CHAT_WEBHOOK_URL ||
            'https://n8niker.mindloop.cloud/webhook/3f075a6e-b005-407d-911c-93f710727449',
        botName: 'Asistente CostOS',
        enabled: true,
        maxHistoryMessages: 50
    },

    /**
     * Configuración de Cache
     */
    cache: {
        enabled: true,
        ttl: CACHE_TTL,
        maxSize: 100, // Máximo número de entradas en cache
        strategy: 'LRU' // Least Recently Used
    },

    /**
     * Configuración de Búsquedas
     */
    search: {
        debounceDelay: DEBOUNCE_DELAY.SEARCH,
        minLength: 2,
        maxResults: 50,
        highlightMatches: true
    },

    /**
     * Configuración de Paginación
     */
    pagination: {
        pageSize: PAGE_SIZE,
        showPagination: true,
        showPageNumbers: true
    },

    /**
     * Configuración de Validaciones
     */
    validation: {
        showInlineErrors: true,
        validateOnBlur: true,
        validateOnChange: false
    },

    /**
     * Configuración de UI
     */
    ui: {
        theme: 'default',
        showAnimations: true,
        compactMode: false,
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        firstDayOfWeek: 1 // Lunes
    },

    /**
     * Configuración de Notificaciones
     */
    notifications: {
        enabled: true,
        position: 'top-right',
        autoClose: true,
        pauseOnHover: true
    },

    /**
     * Configuración de Performance Monitoring
     */
    performance: {
        enabled: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING !== 'false',
        logSlowQueries: true,
        slowQueryThreshold: 1000, // ms
        trackMemory: false
    },

    /**
     * Configuración de Debug
     */
    debug: {
        enabled: import.meta.env.VITE_ENABLE_DEBUG === 'true',
        logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
        showPerformanceMetrics: false
    }
};

/**
 * Obtiene un valor de configuración por ruta (dot notation)
 * @param {string} path - Ruta de configuración (ej: 'api.timeout')
 * @param {any} defaultValue - Valor por defecto si no existe
 * @returns {any} Valor de configuración
 *
 * @example
 * getConfig('api.timeout') // 30000
 * getConfig('cache.ttl.recipes') // 300000
 * getConfig('nonexistent.path', 'default') // 'default'
 */
export function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let value = appConfig;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }

    return value;
}

/**
 * Actualiza un valor de configuración (runtime)
 * @param {string} path - Ruta de configuración
 * @param {any} value - Nuevo valor
 *
 * @example
 * setConfig('ui.compactMode', true)
 * setConfig('cache.enabled', false)
 */
export function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = appConfig;

    for (const key of keys) {
        if (!(key in target)) {
            target[key] = {};
        }
        target = target[key];
    }

    target[lastKey] = value;
}

/**
 * Exporta la configuración completa (útil para debugging)
 */
export function exportConfig() {
    return JSON.parse(JSON.stringify(appConfig));
}
