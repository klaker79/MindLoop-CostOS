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

    // Normalizar endpoint: asegurarse de que empiece con /api
    let normalizedEndpoint = endpoint;
    if (normalizedEndpoint.startsWith('/api')) {
        normalizedEndpoint = normalizedEndpoint.substring(4);
    }

    // Construir URL completa
    const url = `${API_BASE}${normalizedEndpoint}`;

    // Auth headers explícitos (misma lógica que cargarDatos en core.js)
    const token = localStorage.getItem('token');
    const fetchOptions = {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
    };

    // Body handling
    if (options.body) {
        if (options.body instanceof FormData) {
            // FormData: no poner Content-Type (browser lo pone con boundary)
            delete fetchOptions.headers['Content-Type'];
            fetchOptions.body = options.body;
        } else {
            fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }
    }

    try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) { /* no-op */ }

            // 401 → redirigir a login
            if (response.status === 401) {
                console.warn('🔒 API: Token expirado — redirigiendo a login');
                window.dispatchEvent(new CustomEvent('auth:expired'));
                document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                if (!window.location.pathname.includes('login')) {
                    window.location.href = '/login.html';
                }
            }

            const error = new Error(errorMessage);
            error.status = response.status;
            throw error;
        }

        // Parse response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();

    } catch (error) {
        // Retries para 500 o errores de red
        if (retries > 0 && (error.status === 500 || error.message?.includes('fetch') || error.message?.includes('Failed'))) {
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
