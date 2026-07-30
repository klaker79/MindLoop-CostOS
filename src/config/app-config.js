/**
 * Configuración de la Aplicación - MindLoop CostOS
 *
 * Configuraciones dinámicas y avanzadas de la aplicación.
 *
 * @module config/app-config
 */

import { CACHE_TTL, DEBOUNCE_DELAY, PAGE_SIZE } from './constants.js';

/**
 * A qué API habla ESTA casa. ÚNICA fuente del dominio del backend.
 *
 * Historia: el dominio de la API de PRODUCCIÓN estaba escrito a mano como
 * fallback en DOCE sitios (app-core, inventario-masivo, modales, authStore…).
 * Consecuencia real: el bundle de STAGING llevaba dentro la URL de producción
 * — si en cualquier momento `window.API_CONFIG` no estaba definido, staging
 * llamaba a la API de La Nave 5. Hoy lo frena el CORS (403), pero una lista
 * de CORS no es un plan: es la última red, no la primera.
 *
 * Regla nueva:
 *  1. `VITE_API_BASE_URL` manda siempre (se fija por entorno en Dokploy).
 *  2. Sin variable, la API se deduce del DOMINIO que sirve la app: cada casa
 *     solo conoce a su propia API. app→lacaleta-api, staging→staging-api,
 *     lite→lite-api.
 *  3. Una casa desconocida NO cae a producción: devuelve vacío y canta el
 *     error en consola. Mejor romperse a la vista que llamar a la casa
 *     equivocada en silencio — así se descubrió el agujero de Lite (una
 *     comprobación en vivo devolvió 401 donde tocaba 403).
 */
export const API_POR_CASA = Object.freeze({
    'app.mindloop.cloud': 'https://lacaleta-api.mindloop.cloud',
    'staging.mindloop.cloud': 'https://staging-api.mindloop.cloud',
    'lite.mindloop.cloud': 'https://lite-api.mindloop.cloud',
});

export function apiBaseSegunCasa(casa = (typeof window !== 'undefined' ? window.location.hostname : '')) {
    const porEnv = import.meta.env.VITE_API_BASE_URL;
    if (porEnv) return porEnv;

    // En desarrollo: vacío → URLs relativas que pasan por el proxy de Vite.
    if (import.meta.env.DEV) return '';

    if (API_POR_CASA[casa]) return API_POR_CASA[casa];

    console.error(
        `❌ CosteOS: dominio desconocido "${casa}" y sin VITE_API_BASE_URL. ` +
        'No se asume ninguna API: configúralo en el build (Dokploy) o añade la casa al mapa de app-config.js.'
    );
    return '';
}

/**
 * Configuración de la aplicación
 */
export const appConfig = {
    /**
     * Configuración de API
     */
    api: {
        baseUrl: apiBaseSegunCasa(),
        timeout: 30000, // 30 segundos
        retries: 3,
        retryDelay: 1000, // 1 segundo entre reintentos
    },

    /**
     * Configuración de Chat
     *
     * backend: "n8n" (legacy webhook) | "claude" (POST /api/chat, multi-tenant)
     * Controlado por VITE_CHAT_BACKEND. Default "n8n" para mantener la producción
     * intacta hasta que estemos 100% seguros de que el backend de Claude funciona.
     */
    chat: {
        backend: import.meta.env.VITE_CHAT_BACKEND === 'claude' ? 'claude' : 'n8n',
        webhookUrl: import.meta.env.VITE_CHAT_WEBHOOK_URL || '',
        botName: 'Asistente CostOS',
        enabled: true,
        maxHistoryMessages: 50,
    },

    /**
     * Configuración de Cache
     */
    cache: {
        enabled: true,
        ttl: CACHE_TTL,
        maxSize: 100, // Máximo número de entradas en cache
        strategy: 'LRU', // Least Recently Used
    },

    /**
     * Configuración de Búsquedas
     */
    search: {
        debounceDelay: DEBOUNCE_DELAY.SEARCH,
        minLength: 2,
        maxResults: 50,
        highlightMatches: true,
    },

    /**
     * Configuración de Paginación
     */
    pagination: {
        pageSize: PAGE_SIZE,
        showPagination: true,
        showPageNumbers: true,
    },

    /**
     * Configuración de Validaciones
     */
    validation: {
        showInlineErrors: true,
        validateOnBlur: true,
        validateOnChange: false,
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
        firstDayOfWeek: 1, // Lunes
    },

    /**
     * Configuración de Notificaciones
     */
    notifications: {
        enabled: true,
        position: 'top-right',
        autoClose: true,
        pauseOnHover: true,
    },

    /**
     * Configuración de Performance Monitoring
     */
    performance: {
        enabled: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING !== 'false',
        logSlowQueries: true,
        slowQueryThreshold: 1000, // ms
        trackMemory: false,
    },

    /**
     * Configuración de Debug
     */
    debug: {
        enabled: import.meta.env.VITE_ENABLE_DEBUG === 'true',
        logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
        showPerformanceMetrics: false,
    },
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

/**
 * Obtiene la URL base de la API
 * @returns {string} URL base de la API
 * 
 * @example
 * getApiBaseUrl() // 'https://lacaleta-api.mindloop.cloud'
 * getApiBaseUrl() + '/api/ingredientes'
 */
export function getApiBaseUrl() {
    return appConfig.api.baseUrl;
}

/**
 * Obtiene la URL base de la API con /api
 * @returns {string} URL base con /api
 */
export function getApiUrl() {
    return appConfig.api.baseUrl + '/api';
}

/**
 * Obtiene la URL de autenticación
 * @returns {string} URL de auth
 */
export function getAuthUrl() {
    return appConfig.api.baseUrl + '/api/auth';
}
