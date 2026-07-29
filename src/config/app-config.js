/**
 * Configuración de la Aplicación - MindLoop CostOS
 *
 * Configuraciones dinámicas y avanzadas de la aplicación.
 *
 * @module config/app-config
 */

import { CACHE_TTL, DEBOUNCE_DELAY, PAGE_SIZE } from './constants.js';

/**
 * API de esta casa cuando el build NO trae `VITE_API_BASE_URL`.
 *
 * 🔒 Rama `lite` = casa Lite (lite.mindloop.cloud + lite-api + BD propia).
 * El fallback DEBE apuntar a la API de esta casa, nunca a la de otra.
 *
 * Antes caía en `lacaleta-api.mindloop.cloud`, que es la API de PRODUCCIÓN de
 * La Nave 5. Si el build de Lite se hace sin la variable — y es fácil: en
 * Dokploy las `VITE_*` van en "Build-time Variables", no en "Environment
 * Settings", y esa confusión ya ocurrió una vez — el frontend de Lite se pone
 * a leer y ESCRIBIR contra la base de datos de La Nave 5. Sin error, sin
 * aviso: la app funciona, solo que contra el tenant equivocado.
 *
 * Con el fallback apuntando aquí, olvidar la variable degrada a "correcto"
 * en vez de a "cruza de casa".
 */
const API_DE_ESTA_CASA = 'https://lite-api.mindloop.cloud';

// Aviso ruidoso: el build salió sin la variable. No rompe la app (el fallback
// ya es el correcto), pero deja rastro para que se arregle en Dokploy.
if (!import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
    console.warn(
        `[config] VITE_API_BASE_URL no está definida en el build. Usando ${API_DE_ESTA_CASA}. `
        + 'Revisa "Build-time Variables" en Dokploy (no "Environment Settings").'
    );
}

/**
 * Configuración de la aplicación
 */
export const appConfig = {
    /**
     * Configuración de API
     */
    api: {
        // En desarrollo: vacío → URLs relativas que pasan por el proxy de Vite
        // En producción: URL absoluta del API de ESTA casa
        baseUrl: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : API_DE_ESTA_CASA),
        timeout: 30000, // 30 segundos
        retries: 3,
        retryDelay: 1000, // 1 segundo entre reintentos
    },

    /**
     * Configuración de Chat
     *
     * backend: "claude" (POST /api/chat, multi-tenant) | "n8n" (webhook legacy)
     *
     * Default "claude". Controlado por VITE_CHAT_BACKEND; solo el valor
     * explícito "n8n" vuelve al webhook.
     *
     * El default era "n8n", de cuando el backend de Claude aún no estaba
     * probado. Hoy eso está al revés: el chat va por `POST /api/chat` y el
     * webhook `CHATBOT_APP_LANAVE5` se cerró por seguridad (no tenía Header
     * Auth). Con el default antiguo, cualquier despliegue que perdiera la
     * variable mandaba el chat a un webhook cerrado — el chat deja de
     * funcionar y el motivo no se ve por ningún lado.
     */
    chat: {
        backend: import.meta.env.VITE_CHAT_BACKEND === 'n8n' ? 'n8n' : 'claude',
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
 * getApiBaseUrl() // 'https://lite-api.mindloop.cloud'
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
