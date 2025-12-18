/**
 * API Client Robusto para MindLoop CostOS
 * Maneja errores, reintenta conexiones, y previene TypeErrors
 * 
 * INSTRUCCIONES:
 * 1. Incluir este archivo en tu index.html ANTES del script principal
 * 2. O copiar el contenido dentro de <script> en index.html
 */

const API_BASE = 'https://lacaleta-api.mindloop.cloud';

// Estado global de la aplicación
const AppState = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isAuthenticated: false,
    lastError: null
};

/**
 * Inicializa el estado de autenticación
 */
async function initAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        AppState.isAuthenticated = false;
        return false;
    }

    try {
        const result = await fetchAPI('/api/auth/verify', { method: 'GET' });
        if (result.valid) {
            AppState.isAuthenticated = true;
            AppState.token = token;
            return true;
        }
    } catch (e) {
        console.warn('Token inválido o expirado, limpiando sesión...');
        logout();
    }
    return false;
}

/**
 * Cliente API con manejo robusto de errores
 * @param {string} endpoint - Ruta del API (ej: '/api/ingredients')
 * @param {object} options - Opciones de fetch
 * @returns {Promise<any>} - Datos de respuesta o array/objeto vacío en caso de error
 */
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);

        // Intentar parsear JSON
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error(`Error parseando respuesta de ${endpoint}:`, parseError);
            return getDefaultResponse(endpoint);
        }

        // Manejar errores de autenticación
        if (response.status === 401) {
            console.warn(`Auth error en ${endpoint}:`, data.error || 'Token inválido');
            AppState.lastError = {
                code: data.code || 'AUTH_ERROR',
                message: data.error || 'Error de autenticación'
            };

            // Token expirado o inválido
            if (data.code === 'TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') {
                showToast('Tu sesión ha expirado. Por favor, vuelve a iniciar sesión.', 'error');
                logout();
            }

            return getDefaultResponse(endpoint);
        }

        // Manejar otros errores HTTP
        if (!response.ok) {
            console.error(`Error HTTP ${response.status} en ${endpoint}:`, data.error || response.statusText);
            AppState.lastError = {
                code: response.status,
                message: data.error || response.statusText
            };

            // Si la respuesta tiene datos a pesar del error, usarlos
            if (data && !data.error) {
                return data;
            }

            return getDefaultResponse(endpoint);
        }

        // Éxito - limpiar último error
        AppState.lastError = null;

        return data;

    } catch (networkError) {
        console.error(`Error de red en ${endpoint}:`, networkError);
        AppState.lastError = {
            code: 'NETWORK_ERROR',
            message: 'Error de conexión. Verifica tu internet.'
        };

        showToast('Error de conexión con el servidor', 'error');

        return getDefaultResponse(endpoint);
    }
}

/**
 * Retorna respuesta por defecto según el tipo de endpoint
 * Previene TypeErrors como "ingredients.filter is not a function"
 */
function getDefaultResponse(endpoint) {
    // Endpoints que devuelven arrays
    const arrayEndpoints = [
        '/api/ingredients',
        '/api/recipes',
        '/api/suppliers',
        '/api/orders',
        '/api/sales',
        '/api/team',
        '/api/inventory/complete',
        '/api/balance/comparativa',
        '/api/analysis/menu-engineering'
    ];

    // Verificar si el endpoint devuelve array
    for (const path of arrayEndpoints) {
        if (endpoint.includes(path)) {
            return [];
        }
    }

    // Por defecto, devolver objeto vacío
    return {};
}

/**
 * Funciones helper para cada tipo de recurso
 */
async function getIngredients() {
    const data = await fetchAPI('/api/ingredients');
    return Array.isArray(data) ? data : [];
}

async function getRecipes() {
    const data = await fetchAPI('/api/recipes');
    return Array.isArray(data) ? data : [];
}

async function getSuppliers() {
    const data = await fetchAPI('/api/suppliers');
    return Array.isArray(data) ? data : [];
}

async function getOrders() {
    const data = await fetchAPI('/api/orders');
    return Array.isArray(data) ? data : [];
}

async function getSales(fecha = null) {
    const query = fecha ? `?fecha=${fecha}` : '';
    const data = await fetchAPI(`/api/sales${query}`);
    return Array.isArray(data) ? data : [];
}

async function getInventoryComplete() {
    const data = await fetchAPI('/api/inventory/complete');
    return Array.isArray(data) ? data : [];
}

async function getTeam() {
    const data = await fetchAPI('/api/team');
    return Array.isArray(data) ? data : [];
}

async function getBalance(mes, ano) {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes);
    if (ano) params.append('ano', ano);
    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchAPI(`/api/balance/mes${query}`);
}

/**
 * Funciones de modificación
 */
async function createIngredient(data) {
    return await fetchAPI('/api/ingredients', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function updateIngredient(id, data) {
    return await fetchAPI(`/api/ingredients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function deleteIngredient(id) {
    return await fetchAPI(`/api/ingredients/${id}`, {
        method: 'DELETE'
    });
}

async function createRecipe(data) {
    return await fetchAPI('/api/recipes', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function updateRecipe(id, data) {
    return await fetchAPI(`/api/recipes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function deleteRecipe(id) {
    return await fetchAPI(`/api/recipes/${id}`, {
        method: 'DELETE'
    });
}

async function createSale(recetaId, cantidad) {
    return await fetchAPI('/api/sales', {
        method: 'POST',
        body: JSON.stringify({ recetaId, cantidad })
    });
}

async function bulkSales(ventas) {
    return await fetchAPI('/api/sales/bulk', {
        method: 'POST',
        body: JSON.stringify({ ventas })
    });
}

/**
 * Autenticación
 */
async function login(email, password) {
    const result = await fetchAPI('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    if (result.token) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        AppState.token = result.token;
        AppState.user = result.user;
        AppState.isAuthenticated = true;
        return { success: true, user: result.user };
    }

    return { success: false, error: result.error || 'Error de autenticación' };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    AppState.token = null;
    AppState.user = null;
    AppState.isAuthenticated = false;

    // Mostrar pantalla de login
    if (typeof mostrarLogin === 'function') {
        mostrarLogin();
    } else {
        // Fallback: recargar página
        window.location.reload();
    }
}

/**
 * Toast/Notificaciones
 */
function showToast(message, type = 'info') {
    // Buscar contenedor de toast existente o crear uno
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        info: '#3498db',
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12'
    };

    toast.style.cssText = `
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease;
        max-width: 350px;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-remove después de 5 segundos
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// CSS para animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

/**
 * Generar token de API para n8n (solo admin)
 */
async function generateAPIToken(nombre = 'n8n Integration', duracionDias = 365) {
    const result = await fetchAPI('/api/auth/api-token', {
        method: 'POST',
        body: JSON.stringify({ nombre, duracionDias })
    });

    if (result.apiToken) {
        console.log('✅ Token generado exitosamente');
        console.log('📋 Copia este token para n8n:', result.apiToken);
        return result;
    }

    return null;
}

// Exponer funciones globalmente
window.API = {
    fetch: fetchAPI,
    getIngredients,
    getRecipes,
    getSuppliers,
    getOrders,
    getSales,
    getInventoryComplete,
    getTeam,
    getBalance,
    createIngredient,
    updateIngredient,
    deleteIngredient,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    createSale,
    bulkSales,
    login,
    logout,
    initAuth,
    generateAPIToken,
    showToast,
    state: AppState
};

console.log('🚀 API Client cargado. Usa window.API para acceder a las funciones.');
