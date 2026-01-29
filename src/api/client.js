/**
 * ============================================
 * api/client.js - Centralized API Client
 * ============================================
 *
 * Wrapper centralizado para todas las llamadas fetch.
 * Maneja: autenticación, errores, retries, logging.
 *
 * @author MindLoopIA
 * @version 1.0.0
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
 * Get authorization headers with Bearer token
 */
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Handle API errors consistently
 */
async function handleResponse(response) {
    if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
            // Response wasn't JSON, use default message
        }

        // Handle specific status codes
        if (response.status === 401) {
            console.warn('🔒 API: Token expirado o inválido');
            // Could trigger logout here if needed
            // window.dispatchEvent(new CustomEvent('auth:expired'));
        }

        throw new Error(errorMessage);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

/**
 * Main API client with all HTTP methods
 */
export const apiClient = {
    /**
     * GET request
     * @param {string} endpoint - API endpoint (e.g., '/ingredientes')
     * @param {object} options - Additional fetch options
     */
    async get(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;

        const response = await fetch(url, {
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

        const response = await fetch(url, {
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

        const response = await fetch(url, {
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

        const response = await fetch(url, {
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

        const response = await fetch(url, {
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

        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                ...getAuthHeaders()
                // Note: Don't set Content-Type for FormData, browser sets it with boundary
            },
            body: formData
        });

        return handleResponse(response);
    }
};

/**
 * Convenience exports for common endpoints
 */
export const api = {
    // Ingredientes
    getIngredientes: () => apiClient.get('/ingredientes'),
    getIngrediente: (id) => apiClient.get(`/ingredientes/${id}`),
    createIngrediente: (data) => apiClient.post('/ingredientes', data),
    updateIngrediente: (id, data) => apiClient.put(`/ingredientes/${id}`, data),
    deleteIngrediente: (id) => apiClient.delete(`/ingredientes/${id}`),

    // Recetas
    getRecetas: () => apiClient.get('/recetas'),
    getReceta: (id) => apiClient.get(`/recetas/${id}`),
    createReceta: (data) => apiClient.post('/recetas', data),
    updateReceta: (id, data) => apiClient.put(`/recetas/${id}`, data),
    deleteReceta: (id) => apiClient.delete(`/recetas/${id}`),

    // Pedidos
    getPedidos: () => apiClient.get('/pedidos'),
    getPedido: (id) => apiClient.get(`/pedidos/${id}`),
    createPedido: (data) => apiClient.post('/pedidos', data),
    updatePedido: (id, data) => apiClient.put(`/pedidos/${id}`, data),
    deletePedido: (id) => apiClient.delete(`/pedidos/${id}`),

    // Proveedores
    getProveedores: () => apiClient.get('/proveedores'),
    getProveedor: (id) => apiClient.get(`/proveedores/${id}`),
    createProveedor: (data) => apiClient.post('/proveedores', data),
    updateProveedor: (id, data) => apiClient.put(`/proveedores/${id}`, data),
    deleteProveedor: (id) => apiClient.delete(`/proveedores/${id}`),

    // Ventas
    getSales: () => apiClient.get('/sales'),
    createSale: (data) => apiClient.post('/sales', data),
    createBulkSales: (data) => apiClient.post('/sales/bulk', data),
    deleteSale: (id) => apiClient.delete(`/sales/${id}`),

    // Empleados
    getEmpleados: () => apiClient.get('/empleados'),
    getHorarios: (desde, hasta) => apiClient.get(`/horarios?desde=${desde}&hasta=${hasta}`),

    // Inventario
    getInventario: () => apiClient.get('/inventario'),
    updateStock: (data) => apiClient.post('/inventario/ajuste', data),

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
