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
 * Get authorization headers
 * 🔒 SECURITY: Uses in-memory token (window.authToken) — NOT localStorage
 * This supports the backend's Dual-Mode auth (cookie + Bearer header)
 * Cookie handles same-origin (production), Bearer handles cross-origin (local dev)
 */
function getAuthHeaders() {
    const token = typeof window !== 'undefined' ? window.authToken : null;
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
            // Only redirect on critical auth endpoints, not background checks
            const url = response.url || '';
            const nonCriticalPaths = ['/owner/restaurants', '/stripe/subscription-status', '/v2/alerts', '/monthly/summary', '/transfers/pending-count'];
            const isNonCritical = nonCriticalPaths.some(p => url.includes(p));

            if (isNonCritical) {
                console.warn('🔒 API: 401 en endpoint no crítico (ignorando redirect):', url);
            } else {
                console.warn('🔒 API: Token expirado o inválido — redirigiendo a login');
                // 🔒 SECURITY: Clean all auth state
                window.authToken = null;
                sessionStorage.removeItem('_at');
                window.dispatchEvent(new CustomEvent('auth:expired'));
                // Redirect only if not already on login (prevent loops)
                if (!window._authRedirecting && !window.location.pathname.includes('login')) {
                    window._authRedirecting = true;
                    window.location.href = '/login.html';
                }
            }
        }

        // 🆕 2026-06-08: detectar 403 SUBSCRIPTION_REQUIRED (gating global del
        // backend tras trial caducado o sin plan activo). Disparar evento global
        // para que un único componente muestre overlay full-screen con CTA Polar.
        // No bloquea el throw: la ruta que llamó también recibe el error, pero
        // el overlay tapa toda la UI.
        if (response.status === 403) {
            try {
                const bodyClone = await response.clone().json().catch(() => null);
                if (bodyClone && bodyClone.error === 'SUBSCRIPTION_REQUIRED') {
                    window.dispatchEvent(new CustomEvent('subscription:required', {
                        detail: {
                            reason: bodyClone.reason || 'no_subscription',
                            trialEndedAt: bodyClone.trial_ended_at || null,
                            plan: bodyClone.plan || null,
                            planStatus: bodyClone.plan_status || null,
                        }
                    }));
                }
            } catch (_e) { /* nada */ }
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
    createIngrediente: async (data) => {
        const r = await apiClient.post('/ingredients', data);
        setTimeout(() => window.refreshOnboardingSpotlight?.(), 600);
        return r;
    },
    createIngredient: async (data) => {
        const r = await apiClient.post('/ingredients', data);
        setTimeout(() => window.refreshOnboardingSpotlight?.(), 600);
        return r;
    },
    updateIngrediente: (id, data) => apiClient.put(`/ingredients/${id}`, data),
    updateIngredient: (id, data) => apiClient.put(`/ingredients/${id}`, data),
    deleteIngrediente: (id) => apiClient.delete(`/ingredients/${id}`),
    deleteIngredient: (id) => apiClient.delete(`/ingredients/${id}`),
    toggleIngredientActive: (id, activo) => apiClient.patch(`/ingredients/${id}/toggle`, { activo }),

    // Recipes (antes: recetas)
    getRecetas: () => apiClient.get('/recipes'),
    getReceta: (id) => apiClient.get(`/recipes/${id}`),
    getRecipes: () => apiClient.get('/recipes'),
    createReceta: async (data) => {
        const r = await apiClient.post('/recipes', data);
        setTimeout(() => window.refreshOnboardingSpotlight?.(), 600);
        return r;
    },
    createRecipe: async (data) => {
        const r = await apiClient.post('/recipes', data);
        setTimeout(() => window.refreshOnboardingSpotlight?.(), 600);
        return r;
    },
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
    createPedido: async (data) => {
        const r = await apiClient.post('/orders', data);
        setTimeout(() => window.refreshOnboardingSpotlight?.(), 600);
        return r;
    },
    updatePedido: (id, data) => apiClient.put(`/orders/${id}`, data),
    deletePedido: (id) => apiClient.delete(`/orders/${id}`),

    // Onboarding checklist (4 pasos: proveedores -> ingredientes -> recetas -> pedidos)
    getOnboardingStatus: () => apiClient.get('/onboarding/status'),

    // Análisis — Ingeniería de Menú y Principios de Omnes
    // Periodo opcional via { desde, hasta } en formato YYYY-MM-DD.
    // Sin periodo → backend usa el histórico completo (compat back).
    getMenuEngineering: (opts) => {
        const qs = new URLSearchParams();
        if (opts?.desde) qs.set('desde', opts.desde);
        if (opts?.hasta) qs.set('hasta', opts.hasta);
        const query = qs.toString();
        return apiClient.get(`/analysis/menu-engineering${query ? '?' + query : ''}`);
    },
    getOmnes: (opts) => {
        const qs = new URLSearchParams();
        if (opts?.desde) qs.set('desde', opts.desde);
        if (opts?.hasta) qs.set('hasta', opts.hasta);
        const query = qs.toString();
        return apiClient.get(`/analysis/omnes${query ? '?' + query : ''}`);
    },

    // Suppliers (antes: proveedores)
    getProveedores: () => apiClient.get('/suppliers'),
    getProveedor: (id) => apiClient.get(`/suppliers/${id}`),
    getSuppliers: () => apiClient.get('/suppliers'),
    createProveedor: async (data) => {
        const r = await apiClient.post('/suppliers', data);
        setTimeout(() => window.refreshOnboardingSpotlight?.(), 600);
        return r;
    },
    updateProveedor: (id, data) => apiClient.put(`/suppliers/${id}`, data),
    deleteProveedor: (id) => apiClient.delete(`/suppliers/${id}`),

    // Sales (ya estaba en inglés)
    // page/limit opcionales: si se pasa limit, el backend pagina (ORDER BY fecha
    // DESC, LIMIT/OFFSET). Sin ellos devuelve todas (comportamiento previo, usado
    // por balance/gráfico de ingresos). La pestaña Ventas usa la versión paginada.
    getSales: (fecha = null, page = null, limit = null) => {
        const qs = [];
        if (fecha) qs.push(`fecha=${fecha}`);
        if (limit) { qs.push(`limit=${limit}`); qs.push(`page=${page || 1}`); }
        return apiClient.get(`/sales${qs.length ? `?${qs.join('&')}` : ''}`);
    },
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

    // P&L canónico por rango (food/beverage/otros/total). Fuente única de food
    // cost e ingresos por periodo (dashboard, Diario, punto de equilibrio).
    getPnlBreakdown: (desde, hasta) => apiClient.get(`/analytics/pnl-breakdown?desde=${desde}&hasta=${hasta}`),

    // Balance / P&L
    getBalance: (mes, ano) => apiClient.get(`/balance/mes?month=${ano}-${String(mes).padStart(2, '0')}`),
    // 🧾 IVA soportado del periodo (informativo, SEPARADO de la P&L). Migración 015.
    getIvaSoportado: (mes, ano) => apiClient.get(`/balance/iva-soportado?mes=${mes}&ano=${ano}`),

    // Gastos Fijos
    getGastosFijos: () => apiClient.get('/gastos-fijos'),
    getTotalGastosFijos: () => apiClient.get('/gastos-fijos/total'),
    createGastoFijo: (concepto, monto) => apiClient.post('/gastos-fijos', { concepto, monto_mensual: monto }),
    updateGastoFijo: (id, concepto, monto) => apiClient.put(`/gastos-fijos/${id}`, { concepto, monto_mensual: monto }),
    deleteGastoFijo: (id) => apiClient.delete(`/gastos-fijos/${id}`),

    // Personal extra (pagos a extras por horas) — mismo patrón que gastos-fijos
    getPersonalExtra: (desde, hasta) => {
        const params = [];
        if (desde) params.push(`desde=${desde}`);
        if (hasta) params.push(`hasta=${hasta}`);
        return apiClient.get(`/personal-extra${params.length ? '?' + params.join('&') : ''}`);
    },
    crearPersonalExtra: (data) => apiClient.post('/personal-extra', data),
    actualizarPersonalExtra: (id, data) => apiClient.put(`/personal-extra/${id}`, data),
    borrarPersonalExtra: (id) => apiClient.delete(`/personal-extra/${id}`),

    // Mermas
    getMermas: (mes, ano) => {
        const params = [];
        if (mes) params.push(`mes=${mes}`);
        if (ano) params.push(`ano=${ano}`);
        return apiClient.get(`/mermas${params.length ? '?' + params.join('&') : ''}`);
    },
    getMermasResumen: () => apiClient.get('/mermas/resumen'),
    /**
     * Registra un lote de mermas en la tabla `mermas`. Cada merma descuenta
     * stock_actual del ingrediente y aparece en "Historial de Mermas".
     * Payload: { mermas: [{ ingredienteId, ingredienteNombre, cantidad,
     *   unidad, valorPerdida, motivo, nota, responsableId? }] }
     */
    createMermas: (mermas) => apiClient.post('/mermas', { mermas }),

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

    // Chat (Claude API backend). Returns plain text (multi-tenant via JWT).
    // En error, el caller necesita acceder al body JSON (resets_at en 429,
    // mensaje en 403) — por eso no se delega en handleResponse genérico.
    chat: async (message, lang = 'es', sessionId = null, history = []) => {
        const url = `${API_BASE}/chat`;
        const response = await fetch(url, {
            method: 'POST',
            ...defaultConfig,
            headers: { ...defaultConfig.headers, ...getAuthHeaders() },
            body: JSON.stringify({ message, lang, sessionId, history })
        });
        if (!response.ok) {
            let body = null;
            try { body = await response.json(); } catch (e) { /* not JSON */ }
            const err = new Error(body?.error || `HTTP ${response.status}`);
            err.status = response.status;
            err.data = body;
            throw err;
        }
        return response.text();
    },

    // Chat IA: INCLUIDO en el plan único (90€/mes). El add-on de 30€ ya no se
    // ofrece; estos endpoints quedan por compatibilidad/auditoría. La cuota
    // mensual de consultas la gestiona chatAddonGate en backend.
    chatStatus: () => apiClient.get('/chat-status'),
    createChatAddonCheckout: () => apiClient.post('/chat-addon/checkout-session', {}),
    openChatAddonPortal: () => apiClient.post('/chat-addon/customer-portal', {}),

    // Health Check semanal del Asistente IA (Coach).
    // POST genera o devuelve el report cacheado de la semana ISO actual.
    // GET status devuelve si hay report nuevo no leído (para badge "nuevo").
    getHealthCheck: () => apiClient.post('/chat/health-check', {}),
    getHealthCheckStatus: () => apiClient.get('/chat/health-check/status'),

    // Plan único MindLoop CostOS (90€/mes vía Polar, chat incluido).
    // Mismo patrón que el add-on: backend devuelve URL Polar para checkout
    // o customer portal; el flag plan_status se actualiza via webhook.
    createBasePlanCheckout: () => apiClient.post('/subscription/checkout-base', {}),
    openSubscriptionPortal: () => apiClient.post('/subscription/customer-portal', {}),

    // Informe ejecutivo mensual (HTML listo para imprimir/guardar PDF).
    // Devuelve string con HTML completo. El caller lo abre en pestaña nueva.
    // No consume contador del chat — verifica chat_addon aparte en backend.
    // mes (opcional): 'YYYY-MM'. Si no se pasa, backend usa mes en curso.
    getChatInformeMensualHtml: async (lang = 'es', mes = null) => {
        const params = new URLSearchParams({ lang });
        if (mes) params.set('mes', mes);
        const url = `${API_BASE}/chat/informe-mensual/html?${params.toString()}`;
        const response = await fetch(url, {
            method: 'GET',
            ...defaultConfig,
            headers: { ...defaultConfig.headers, ...getAuthHeaders() }
        });
        if (!response.ok) {
            let body = null;
            try { body = await response.json(); } catch (e) { /* not JSON */ }
            const err = new Error(body?.error || `HTTP ${response.status}`);
            err.status = response.status;
            err.data = body;
            throw err;
        }
        return response.text();
    },

    // Búsqueda: sales/purchases with date range + optional filters
    // Returns: { tipo, periodo, total_registros, total_importe, resultados, truncado, ... }
    search: (params) => {
        const qs = new URLSearchParams();
        Object.entries(params || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') qs.append(k, v);
        });
        return apiClient.get(`/search?${qs.toString()}`);
    },
};

// Expose globally for legacy code compatibility
if (typeof window !== 'undefined') {
    window.apiClient = apiClient;
    window.api = { ...window.api, ...api };
}

export default apiClient;

