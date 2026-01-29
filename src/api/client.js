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
 * FIXED: Use correct /api/ prefix and English endpoint names
 */
export const api = {
    // Ingredientes (backend uses /api/ingredients)
    getIngredientes: () => apiClient.get('/api/ingredients'),
    getIngrediente: (id) => apiClient.get(`/api/ingredients/${id}`),
    createIngrediente: (data) => apiClient.post('/api/ingredients', data),
    updateIngrediente: (id, data) => apiClient.put(`/api/ingredients/${id}`, data),
    deleteIngrediente: (id) => apiClient.delete(`/api/ingredients/${id}`),

    // Recetas (backend uses /api/recipes)
    getRecetas: () => apiClient.get('/api/recipes'),
    getReceta: (id) => apiClient.get(`/api/recipes/${id}`),
    createReceta: (data) => apiClient.post('/api/recipes', data),
    updateReceta: (id, data) => apiClient.put(`/api/recipes/${id}`, data),
    deleteReceta: (id) => apiClient.delete(`/api/recipes/${id}`),

    // Pedidos (backend uses /api/orders)
    getPedidos: () => apiClient.get('/api/orders'),
    getPedido: (id) => apiClient.get(`/api/orders/${id}`),
    createPedido: (data) => apiClient.post('/api/orders', data),
    updatePedido: (id, data) => apiClient.put(`/api/orders/${id}`, data),
    deletePedido: (id) => apiClient.delete(`/api/orders/${id}`),

    // Proveedores (backend uses /api/suppliers)
    getProveedores: () => apiClient.get('/api/suppliers'),
    getProveedor: (id) => apiClient.get(`/api/suppliers/${id}`),
    createProveedor: (data) => apiClient.post('/api/suppliers', data),
    updateProveedor: (id, data) => apiClient.put(`/api/suppliers/${id}`, data),
    deleteProveedor: (id) => apiClient.delete(`/api/suppliers/${id}`),

    // Ventas
    getSales: () => apiClient.get('/api/sales'),
    createSale: (data) => apiClient.post('/api/sales', data),
    createBulkSales: (data) => apiClient.post('/api/sales/bulk', data),
    deleteSale: (id) => apiClient.delete(`/api/sales/${id}`),

    // Empleados (backend uses /api/team)
    getEmpleados: () => apiClient.get('/api/team'),
    getHorarios: (desde, hasta) => apiClient.get(`/api/horarios?desde=${desde}&hasta=${hasta}`),

    // Inventario
    getInventario: () => apiClient.get('/api/inventory/complete'),
    updateStock: (data) => apiClient.post('/api/inventory/ajuste', data),

    // Auth
    login: (credentials) => apiClient.post('/api/auth/login', credentials),
    logout: () => apiClient.post('/api/auth/logout', {}),
    checkAuth: () => apiClient.get('/api/auth/check')
};

// Expose globally for legacy code compatibility
if (typeof window !== 'undefined') {
    window.apiClient = apiClient;
    window.api = { ...window.api, ...api };
}

export default apiClient;
