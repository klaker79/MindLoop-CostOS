/**
 * ============================================
 * api/client.js - Centralized API Client
 * ============================================
 *
 * Wrapper centralizado para todas las llamadas fetch.
 * Maneja: autenticación, errores, rate limiting, timeout.
 *
 * AUTH STRATEGY:
 * - Primary: httpOnly cookies via credentials: 'include'
 * - Fallback: Bearer token in localStorage (legacy backend compatibility)
 *
 * @author MindLoopIA
 * @version 2.1.0
 */

import { getApiUrl } from '../config/app-config.js';

const API_BASE = getApiUrl();

/**
 * Default configuration for API calls
 */
const defaultConfig = {
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json'
    }
};

/**
 * Get authorization headers with Bearer token from localStorage
 */
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Simple client-side rate limiter to prevent API abuse
 * Tracks request counts per sliding window
 */
const rateLimiter = {
    requests: [],
    maxRequests: 60,    // max requests per window
    windowMs: 60000,    // 1 minute window

    canMakeRequest() {
        const now = Date.now();
        // Remove expired entries
        this.requests = this.requests.filter(t => now - t < this.windowMs);
        if (this.requests.length >= this.maxRequests) {
            return false;
        }
        this.requests.push(now);
        return true;
    }
};

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Handle API errors consistently
 */
async function handleResponse(response) {
    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (_e) {
            // Response wasn't JSON, use default message
        }

        // Handle 401 - session expired, trigger logout
        if (response.status === 401) {
            console.warn('API: Session expired or invalid');
            window.dispatchEvent(new CustomEvent('auth:expired'));
        }

        throw new Error(errorMessage);
    }

    // Handle empty responses (204 No Content, etc.)
    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

/**
 * Execute a fetch request with timeout and rate limiting
 */
async function executeFetch(url, config) {
    if (!rateLimiter.canMakeRequest()) {
        throw new Error('Demasiadas solicitudes. Por favor, espera un momento.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('La solicitud ha tardado demasiado. Intenta de nuevo.');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Main API client with all HTTP methods
 * Auth: httpOnly cookies + Bearer token fallback
 */
export const apiClient = {
    /**
     * GET request
     * @param {string} endpoint - API endpoint (e.g., '/ingredientes')
     * @param {object} options - Additional fetch options
     */
    async get(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const response = await executeFetch(url, {
            method: 'GET',
            ...defaultConfig,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...options.headers
            },
            ...options
        });

        return handleResponse(response);
    },

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @param {object} options - Additional fetch options
     */
    async post(endpoint, data, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const response = await executeFetch(url, {
            method: 'POST',
            ...defaultConfig,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...options.headers
            },
            body: JSON.stringify(data),
            ...options
        });

        return handleResponse(response);
    },

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @param {object} options - Additional fetch options
     */
    async put(endpoint, data, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const response = await executeFetch(url, {
            method: 'PUT',
            ...defaultConfig,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...options.headers
            },
            body: JSON.stringify(data),
            ...options
        });

        return handleResponse(response);
    },

    /**
     * PATCH request
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body
     * @param {object} options - Additional fetch options
     */
    async patch(endpoint, data, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const response = await executeFetch(url, {
            method: 'PATCH',
            ...defaultConfig,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...options.headers
            },
            body: JSON.stringify(data),
            ...options
        });

        return handleResponse(response);
    },

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @param {object} options - Additional fetch options
     */
    async delete(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const response = await executeFetch(url, {
            method: 'DELETE',
            ...defaultConfig,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...options.headers
            },
            ...options
        });

        return handleResponse(response);
    },

    /**
     * POST with FormData (for file uploads)
     * @param {string} endpoint - API endpoint
     * @param {FormData} formData - Form data with files
     */
    async upload(endpoint, formData) {
        const url = `${API_BASE}${endpoint}`;

        const response = await executeFetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                ...getAuthHeaders()
            },
            // Don't set Content-Type for FormData, browser sets it with boundary
            body: formData
        });

        return handleResponse(response);
    }
};

/**
 * Convenience exports for common endpoints
 * NOTE: Rutas EN INGLES para coincidir con backend lacaleta-api
 */
export const api = {
    // Ingredients
    getIngredientes: () => apiClient.get('/ingredients'),
    getIngrediente: (id) => apiClient.get(`/ingredients/${id}`),
    createIngrediente: (data) => apiClient.post('/ingredients', data),
    updateIngrediente: (id, data) => apiClient.put(`/ingredients/${id}`, data),
    deleteIngrediente: (id) => apiClient.delete(`/ingredients/${id}`),

    // Recipes
    getRecetas: () => apiClient.get('/recipes'),
    getReceta: (id) => apiClient.get(`/recipes/${id}`),
    createReceta: (data) => apiClient.post('/recipes', data),
    updateReceta: (id, data) => apiClient.put(`/recipes/${id}`, data),
    deleteReceta: (id) => apiClient.delete(`/recipes/${id}`),

    // Orders
    getPedidos: () => apiClient.get('/orders'),
    getPedido: (id) => apiClient.get(`/orders/${id}`),
    createPedido: (data) => apiClient.post('/orders', data),
    updatePedido: (id, data) => apiClient.put(`/orders/${id}`, data),
    deletePedido: (id) => apiClient.delete(`/orders/${id}`),

    // Suppliers
    getProveedores: () => apiClient.get('/suppliers'),
    getProveedor: (id) => apiClient.get(`/suppliers/${id}`),
    createProveedor: (data) => apiClient.post('/suppliers', data),
    updateProveedor: (id, data) => apiClient.put(`/suppliers/${id}`, data),
    deleteProveedor: (id) => apiClient.delete(`/suppliers/${id}`),

    // Sales
    getSales: () => apiClient.get('/sales'),
    createSale: (data) => apiClient.post('/sales', data),
    createBulkSales: (data) => apiClient.post('/sales/bulk', data),
    deleteSale: (id) => apiClient.delete(`/sales/${id}`),

    // Team
    getEmpleados: () => apiClient.get('/team'),
    getHorarios: (desde, hasta) => apiClient.get(`/horarios?desde=${desde}&hasta=${hasta}`),

    // Inventory
    getInventario: () => apiClient.get('/inventory/complete'),
    updateStock: (data) => apiClient.post('/inventory/ajuste', data),

    // Auth
    login: (credentials) => apiClient.post('/auth/login', credentials),
    logout: () => apiClient.post('/auth/logout', {}),
    checkAuth: () => apiClient.get('/auth/check')
};

// Expose globally for legacy code compatibility
if (typeof window !== 'undefined') {
    window.apiClient = apiClient;
    window.api = { ...window.api, ...api };
}

export default apiClient;
