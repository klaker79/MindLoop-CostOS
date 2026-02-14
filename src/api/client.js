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
            console.warn('🔒 API: Token expirado o inválido — redirigiendo a login');
            window.dispatchEvent(new CustomEvent('auth:expired'));
            // Clear auth state and redirect
            document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            if (!window.location.pathname.includes('login')) {
                window.location.href = '/login.html';
            }
        }

        // 🔧 FIX BUG-5: Incluir .status para que callers puedan distinguir 4xx de 5xx
        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
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
        const { headers: optHeaders, ...restOptions } = options;
        const headers = {
            ...defaultConfig.headers,
            ...getAuthHeaders(),
            ...optHeaders
        };

        const response = await fetch(url, {
            method: 'GET',
            ...defaultConfig,
            ...restOptions,
            headers,
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
        const { headers: optHeaders, ...restOptions } = options;

        const response = await fetch(url, {
            method: 'POST',
            ...defaultConfig,
            ...restOptions,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...optHeaders
            },
            body: JSON.stringify(data),
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
        const { headers: optHeaders, ...restOptions } = options;

        const response = await fetch(url, {
            method: 'PUT',
            ...defaultConfig,
            ...restOptions,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...optHeaders
            },
            body: JSON.stringify(data),
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
        const { headers: optHeaders, ...restOptions } = options;

        const response = await fetch(url, {
            method: 'PATCH',
            ...defaultConfig,
            ...restOptions,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...optHeaders
            },
            body: JSON.stringify(data),
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
        const { headers: optHeaders, ...restOptions } = options;

        const response = await fetch(url, {
            method: 'DELETE',
            ...defaultConfig,
            ...restOptions,
            headers: {
                ...defaultConfig.headers,
                ...getAuthHeaders(),
                ...optHeaders
            },
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
 * NOTE: Rutas EN INGLÉS para coincidir con backend lacaleta-api
 * SINGLE SOURCE OF TRUTH — services/api.js es solo un shim de compatibilidad
 */
export const api = {
    // Raw fetch passthrough (para endpoints no definidos aquí)
    fetch: (endpoint, options) => apiClient.get ?
        (/POST|PUT|PATCH|DELETE/i.test(options?.method) ?
            apiClient[options.method.toLowerCase()](endpoint, options?.body ? JSON.parse(options.body) : undefined) :
            apiClient.get(endpoint)) :
        null,

    // Ingredients (antes: ingredientes)
    getIngredientes: () => apiClient.get('/ingredients'),
    getIngrediente: (id) => apiClient.get(`/ingredients/${id}`),
    getIngredients: () => apiClient.get('/ingredients'),
    getIngredientsAll: () => apiClient.get('/ingredients?all=true'),
    createIngrediente: (data) => apiClient.post('/ingredients', data),
    createIngredient: (data) => apiClient.post('/ingredients', data),
    updateIngrediente: (id, data) => apiClient.put(`/ingredients/${id}`, data),
    updateIngredient: (id, data) => apiClient.put(`/ingredients/${id}`, data),
    deleteIngrediente: (id) => apiClient.delete(`/ingredients/${id}`),
    deleteIngredient: (id) => apiClient.delete(`/ingredients/${id}`),
    toggleIngredientActive: (id, activo) => apiClient.patch(`/ingredients/${id}/toggle`, { activo }),

    // Recipes (antes: recetas)
    getRecetas: () => apiClient.get('/recipes'),
    getReceta: (id) => apiClient.get(`/recipes/${id}`),
    getRecipes: () => apiClient.get('/recipes'),
    createReceta: (data) => apiClient.post('/recipes', data),
    createRecipe: (data) => apiClient.post('/recipes', data),
    updateReceta: (id, data) => apiClient.put(`/recipes/${id}`, data),
    updateRecipe: (id, data) => apiClient.put(`/recipes/${id}`, data),
    deleteReceta: (id) => apiClient.delete(`/recipes/${id}`),
    deleteRecipe: (id) => apiClient.delete(`/recipes/${id}`),

    // Recipe Cost Calculation (V2)
    calculateRecipeCost: (id) => apiClient.get(`/recipes/${id}/cost`),
    getRecipeCostStats: () => apiClient.get('/recipes/cost-stats'),
    recalculateAllRecipes: () => apiClient.post('/recipes/recalculate', {}),

    // Orders (antes: pedidos)
    getPedidos: () => apiClient.get('/orders'),
    getPedido: (id) => apiClient.get(`/orders/${id}`),
    getOrders: () => apiClient.get('/orders'),
    createPedido: (data) => apiClient.post('/orders', data),
    updatePedido: (id, data) => apiClient.put(`/orders/${id}`, data),
    deletePedido: (id) => apiClient.delete(`/orders/${id}`),

    // Suppliers (antes: proveedores)
    getProveedores: () => apiClient.get('/suppliers'),
    getProveedor: (id) => apiClient.get(`/suppliers/${id}`),
    getSuppliers: () => apiClient.get('/suppliers'),
    createProveedor: (data) => apiClient.post('/suppliers', data),
    updateProveedor: (id, data) => apiClient.put(`/suppliers/${id}`, data),
    deleteProveedor: (id) => apiClient.delete(`/suppliers/${id}`),

    // Sales (ya estaba en inglés)
    getSales: (fecha = null) => apiClient.get(fecha ? `/sales?fecha=${fecha}` : '/sales'),
    createSale: (data) => apiClient.post('/sales', data),
    createBulkSales: (data) => apiClient.post('/sales/bulk', data),
    bulkSales: (data) => apiClient.post('/sales/bulk', data),
    deleteSale: (id) => apiClient.delete(`/sales/${id}`),

    // Team (antes: empleados)
    getEmpleados: () => apiClient.get('/team'),
    getTeam: () => apiClient.get('/team'),
    getHorarios: (desde, hasta) => apiClient.get(`/horarios?desde=${desde}&hasta=${hasta}`),

    // Inventory (antes: inventario)
    getInventario: () => apiClient.get('/inventory/complete'),
    getInventoryComplete: () => apiClient.get('/inventory/complete'),
    updateStock: (data) => apiClient.post('/inventory/ajuste', data),

    // 🔒 ATOMIC STOCK: Ajuste atómico individual y masivo
    adjustStock: (id, delta, reason = '') => apiClient.post(`/ingredients/${id}/adjust-stock`, { delta, reason }),
    bulkAdjustStock: (adjustments, reason = '') => apiClient.post('/ingredients/bulk-adjust-stock', { adjustments, reason }),

    // Balance / P&L
    getBalance: (mes, ano) => apiClient.get(`/balance/mes?month=${ano}-${String(mes).padStart(2, '0')}`),

    // Gastos Fijos
    getGastosFijos: () => apiClient.get('/gastos-fijos'),
    getTotalGastosFijos: () => apiClient.get('/gastos-fijos/total'),
    createGastoFijo: (concepto, monto) => apiClient.post('/gastos-fijos', { concepto, monto_mensual: monto }),
    updateGastoFijo: (id, concepto, monto) => apiClient.put(`/gastos-fijos/${id}`, { concepto, monto_mensual: monto }),
    deleteGastoFijo: (id) => apiClient.delete(`/gastos-fijos/${id}`),

    // Mermas
    getMermas: (mes, ano) => {
        const params = [];
        if (mes) params.push(`mes=${mes}`);
        if (ano) params.push(`ano=${ano}`);
        return apiClient.get(`/mermas${params.length ? '?' + params.join('&') : ''}`);
    },
    getMermasResumen: () => apiClient.get('/mermas/resumen'),

    // KPIs
    getDailyKPIs: (date = null) => apiClient.get(date ? `/kpis/daily?date=${date}` : '/kpis/daily'),
    getMonthlyKPIs: (year, month) => apiClient.get(`/kpis/monthly?year=${year}&month=${month}`),
    getKPIComparison: (months = 6) => apiClient.get(`/kpis/comparison?months=${months}`),
    getTopRecipes: (limit = 10) => apiClient.get(`/kpis/top-recipes?limit=${limit}`),

    // Alerts
    getActiveAlerts: () => apiClient.get('/v2/alerts/active'),
    getAlertStats: () => apiClient.get('/v2/alerts/stats'),
    acknowledgeAlert: (id) => apiClient.patch(`/v2/alerts/${id}/acknowledge`, {}),
    resolveAlert: (id) => apiClient.patch(`/v2/alerts/${id}/resolve`, {}),

    // Auth
    login: (credentials) => apiClient.post('/auth/login', credentials),
    logout: () => apiClient.post('/auth/logout', {}),
    checkAuth: () => apiClient.get('/auth/check'),
    initAuth: () => apiClient.get('/auth/check'),
    generateAPIToken: (nombre = 'n8n Integration', duracionDias = 365) =>
        apiClient.post('/auth/api-token', { nombre, duracionDias }),
};

// Expose globally for legacy code compatibility
if (typeof window !== 'undefined') {
    window.apiClient = apiClient;
    window.api = { ...window.api, ...api };
}

export default apiClient;

