/**
 * MindLoop CostOS - API Client V2
 * Cliente profesional optimizado para seguridad y robustez.
 */

const API_CONFIG = {
    // Detecta automáticamente si está en localhost o producción
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://lacaleta-api.mindloop.cloud', // URL de producción por defecto
    TIMEOUT: 15000, // 15 segundos
    RETRY_ATTEMPTS: 2
};

// Estado global reactivo (básico)
const AppState = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isAuthenticated: !!localStorage.getItem('token')
};

/**
 * Wrapper principal para peticiones Fetch con manejo de errores centralizado
 */
async function fetchAPI(endpoint, options = {}, retries = API_CONFIG.RETRY_ATTEMPTS) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
    };

    if (AppState.token) {
        headers['Authorization'] = `Bearer ${AppState.token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);

        // Si es 401 (No autorizado) -> Probablemente token expirado
        if (response.status === 401) {
            handleAuthError();
            throw new Error('Sesión expirada o inválida');
        }

        // Si no es OK, intentar leer el error del cuerpo
        if (!response.ok) {
            let errorMsg = `Error ${response.status}: ${response.statusText}`;
            try {
                const errorBody = await response.json();
                errorMsg = errorBody.error || errorMsg;
            } catch (e) { /* No es JSON */ }
            throw new Error(errorMsg);
        }

        // Si es 204 (No Content)
        if (response.status === 204) return null;

        return await response.json();

    } catch (error) {
        // Lógica de reintento para errores de red (no errores de cliente 4xx)
        if (retries > 0 && isNetworkError(error)) {
            console.warn(`Reintentando ${endpoint} (${retries} restantes)...`);
            await new Promise(r => setTimeout(r, 1000));
            return fetchAPI(endpoint, options, retries - 1);
        }

        console.error(`API Error (${endpoint}):`, error.message);
        showToast(error.message, 'error');
        throw error; // Re-lanzar para que el componente lo maneje si quiere
    }
}

function isNetworkError(error) {
    return error.message === 'Failed to fetch' || error.message.includes('NetworkError');
}

function handleAuthError() {
    console.warn('Cerrando sesión por error de autenticación 401');
    logout();
}

// ==========================================
// FUNCIONES DE AUTENTICACIÓN
// ==========================================

async function login(email, password) {
    try {
        const data = await fetchAPI('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        }, 0); // No reintentar POST de login

        if (data.token) {
            AppState.token = data.token;
            AppState.user = data.user;
            AppState.isAuthenticated = true;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            return { success: true, user: data.user };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function logout() {
    AppState.token = null;
    AppState.user = null;
    AppState.isAuthenticated = false;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload(); // Recargar para limpiar estado de UI
}

async function checkAuth() {
    if (!AppState.token) return false;
    try {
        await fetchAPI('/api/auth/verify', { method: 'GET' });
        return true;
    } catch (e) {
        return false;
    }
}

// ==========================================
// RECURSOS API (CRUD Helpers)
// ==========================================

const API = {
    auth: {
        login,
        logout,
        check: checkAuth
    },
    ingredients: {
        list: () => fetchAPI('/api/ingredients')
            .then(data => Array.isArray(data) ? data : [])
            .catch(() => []), // Fallback seguro a array
        create: (data) => fetchAPI('/api/ingredients', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => fetchAPI(`/api/ingredients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => fetchAPI(`/api/ingredients/${id}`, { method: 'DELETE' })
    },
    recipes: {
        list: () => fetchAPI('/api/recipes')
            .then(data => Array.isArray(data) ? data : [])
            .catch(() => []),
        create: (data) => fetchAPI('/api/recipes', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => fetchAPI(`/api/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => fetchAPI(`/api/recipes/${id}`, { method: 'DELETE' })
    },
    suppliers: {
        list: () => fetchAPI('/api/suppliers')
            .then(data => Array.isArray(data) ? data : [])
            .catch(() => []),
        create: (data) => fetchAPI('/api/suppliers', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => fetchAPI(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => fetchAPI(`/api/suppliers/${id}`, { method: 'DELETE' })
    },
    orders: {
        list: () => fetchAPI('/api/orders')
            .then(data => Array.isArray(data) ? data : [])
            .catch(() => []),
        create: (data) => fetchAPI('/api/orders', { method: 'POST', body: JSON.stringify(data) })
    },
    sales: {
        create: (data) => fetchAPI('/api/sales', { method: 'POST', body: JSON.stringify(data) }),
        // Bulk es un array de ventas
        createBulk: async (ventas) => {
            const promises = ventas.map(v => API.sales.create(v));
            // Esperar todas, capturando errores individuales si es necesario
            return Promise.allSettled(promises);
        }
    },
    monthly: {
        summary: (mes, ano) => fetchAPI(`/api/monthly/summary?mes=${mes}&ano=${ano}`)
            .catch(() => ({})) // Fallback a objeto vacío
    }
};

// ==========================================
// UTILIDADES UI (TOASTS)
// ==========================================

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;gap:10px;display:flex;flex-direction:column;pointer-events:none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = { info: '#3b82f6', success: '#10b981', error: '#ef4444', warning: '#f59e0b' };

    toast.style.cssText = `
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        pointer-events: auto;
        max-width: 350px;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    // Animación entrada
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Auto eliminar
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Exponer globalmente
window.API = API;
window.showToast = showToast; // Helper global útil
window.AppState = AppState;

console.log('✅ MindLoop API Client v2 cargado');
