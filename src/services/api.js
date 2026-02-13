/**
 * ============================================
 * services/api.js - COMPATIBILITY SHIM
 * ============================================
 *
 * ⚠️  Este archivo es un SHIM de compatibilidad.
 * La fuente de verdad es: src/api/client.js
 *
 * Expone window.API para módulos legacy que aún usan:
 *   - window.API.fetch(endpoint, options)
 *   - window.API.getGastosFijos()
 *   - etc.
 *
 * TODO: Migrar todos los usos de window.API.* a:
 *   import { api } from '../api/client.js';
 *   api.getGastosFijos();
 *
 * Una vez migrados todos, ELIMINAR este archivo.
 */

import { api, apiClient } from '../api/client.js';
import { getApiUrl } from '../config/app-config.js';

const API_BASE = getApiUrl();

/**
 * fetchAPI — wrapper compatible con la firma legacy.
 * 
 * Los módulos legacy llaman:
 *   window.API.fetch('/api/mermas', { method: 'POST', body: JSON.stringify({...}) })
 * 
 * El apiClient moderno llama:
 *   apiClient.post('/mermas', data)
 * 
 * Este bridge traduce entre ambos formatos.
 */
async function fetchAPI(endpoint, options = {}, retries = 2) {
    const method = (options.method || 'GET').toUpperCase();

    // Normalizar endpoint: quitar /api prefix si existe (apiClient ya lo añade)
    let normalizedEndpoint = endpoint;
    if (normalizedEndpoint.startsWith('/api')) {
        normalizedEndpoint = normalizedEndpoint.substring(4);
    }

    // Parse body si viene como string JSON
    let data;
    if (options.body) {
        try {
            data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
        } catch (e) {
            data = options.body;
        }
    }

    try {
        switch (method) {
            case 'GET':
                return await apiClient.get(normalizedEndpoint);
            case 'POST':
                // Si es FormData, usar upload
                if (data instanceof FormData) {
                    return await apiClient.upload(normalizedEndpoint, data);
                }
                return await apiClient.post(normalizedEndpoint, data);
            case 'PUT':
                return await apiClient.put(normalizedEndpoint, data);
            case 'PATCH':
                return await apiClient.patch(normalizedEndpoint, data);
            case 'DELETE':
                return await apiClient.delete(normalizedEndpoint);
            default:
                return await apiClient.get(normalizedEndpoint);
        }
    } catch (error) {
        // Retries para compatibilidad
        if (retries > 0 && (error.status === 500 || error.message?.includes('fetch'))) {
            console.warn(`⚠️ Reintentando ${method} ${normalizedEndpoint} (${retries} restantes)`);
            await new Promise(r => setTimeout(r, 1000));
            return fetchAPI(endpoint, options, retries - 1);
        }

        // Devolver respuesta vacía por defecto (comportamiento legacy)
        console.error(`❌ API Error: ${method} ${normalizedEndpoint}`, error);
        if (normalizedEndpoint.includes('ingredients') || normalizedEndpoint.includes('recipes') ||
            normalizedEndpoint.includes('orders') || normalizedEndpoint.includes('sales') ||
            normalizedEndpoint.includes('suppliers') || normalizedEndpoint.includes('mermas') ||
            normalizedEndpoint.includes('alerts')) {
            return [];
        }
        return null;
    }
}

// ============================
// window.API — Backward compat
// ============================
// Combina funciones de api/client.js con el fetchAPI bridge
window.API = {
    // Bridge method para llamadas raw
    fetch: fetchAPI,

    // Re-export todas las funciones del api client moderno
    ...api,

    // Estado de auth (legacy, solo lectura)
    state: {
        get token() { return localStorage.getItem('token'); },
        get user() { return JSON.parse(localStorage.getItem('user') || 'null'); },
        get isAuthenticated() { return !!document.cookie.includes('token'); },
    },

    // showToast delegado al global (definido en main.js)
    showToast: (message, type = 'info') => {
        if (window.showToast) {
            window.showToast(message, type);
        }
    }
};
