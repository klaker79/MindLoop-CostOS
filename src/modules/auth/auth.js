/**
 * Módulo de Autenticación - MindLoop CostOS
 * Maneja login, logout, registro, verificación de sesión, y multi-restaurante
 */

import { getAuthUrl } from '../../config/app-config.js';
import { resetAllStores } from '../../stores/index.js';

const API_AUTH_URL = getAuthUrl();

/**
 * Verifica si el usuario está autenticado
 * Si la sesión es válida, carga los datos iniciales
 */
export async function checkAuth() {
    try {
        // 🔒 Restore token from sessionStorage (survives reload)
        if (!window.authToken && sessionStorage.getItem('_at')) {
            window.authToken = sessionStorage.getItem('_at');
        }
        // Verificar sesión via cookie httpOnly + Bearer fallback
        const verifyHeaders = {};
        if (window.authToken) verifyHeaders['Authorization'] = `Bearer ${window.authToken}`;
        const res = await fetch(API_AUTH_URL + '/verify', {
            credentials: 'include',
            headers: verifyHeaders
        });
        if (!res.ok) {
            mostrarLogin();
            return false;
        }

        // ✅ Sesión válida: mostrar app y cargar datos
        const loginScreen = document.getElementById('login-screen');
        const selectorScreen = document.getElementById('restaurant-selector-screen');
        const appContainer = document.getElementById('app-container');
        if (loginScreen) loginScreen.style.display = 'none';
        if (selectorScreen) selectorScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';

        // ✅ Importante: cargar datos Y renderizar cuando ya hay sesión activa
        if (typeof window.init === 'function') {
            await window.init();
        } else if (typeof window.cargarDatos === 'function') {
            await window.cargarDatos();
        }

        return true;
    } catch {
        mostrarLogin();
        return false;
    }
}

/**
 * Muestra la pantalla de login
 */
export function mostrarLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const selectorScreen = document.getElementById('restaurant-selector-screen');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    if (selectorScreen) selectorScreen.style.display = 'none';
}

/**
 * Muestra la pantalla de registro
 */
export function mostrarRegistro() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginFooter = document.querySelector('.login-footer');
    if (loginForm) loginForm.style.display = 'none';
    if (loginFooter) loginFooter.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

/**
 * Vuelve a la pantalla de login desde registro
 */
export function volverALogin() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginFooter = document.querySelector('.login-footer');
    if (loginForm) loginForm.style.display = 'block';
    if (loginFooter) loginFooter.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    const errorEl = document.getElementById('register-error');
    if (errorEl) { errorEl.textContent = ''; errorEl.style.color = ''; }
}

/**
 * Initializes the registration form event listener
 */
export function initRegisterForm() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('reg-nombre')?.value?.trim();
        const email = document.getElementById('reg-email')?.value?.trim();
        const password = document.getElementById('reg-password')?.value;
        const password2 = document.getElementById('reg-password2')?.value;
        const errorEl = document.getElementById('register-error');
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        if (!nombre || !email || !password) {
            if (errorEl) errorEl.textContent = 'Completa todos los campos';
            return;
        }

        if (password !== password2) {
            if (errorEl) errorEl.textContent = 'Las contraseñas no coinciden';
            return;
        }

        if (password.length < 8) {
            if (errorEl) errorEl.textContent = 'La contraseña debe tener al menos 8 caracteres';
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creando...';
            }

            const res = await fetch(API_AUTH_URL + '/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ nombre, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (errorEl) errorEl.textContent = data.error || 'Error en el registro';
                return;
            }

            // Email verification required
            if (data.needsVerification) {
                if (errorEl) {
                    errorEl.style.color = '#10b981';
                    errorEl.textContent = 'Cuenta creada. Revisa tu email para verificarla.';
                }
                setTimeout(() => volverALogin(), 4000);
                return;
            }

            // Auto-verified (dev mode): auto login
            if (data.token) {
                window.authToken = data.token;
                sessionStorage.setItem('_at', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                enterApp();
            } else {
                volverALogin();
                const loginError = document.getElementById('login-error');
                if (loginError) {
                    loginError.style.color = '#10b981';
                    loginError.textContent = 'Restaurante creado. Inicia sesión con tus credenciales.';
                }
            }
        } catch (err) {
            if (errorEl) errorEl.textContent = 'Error de conexión';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Crear Restaurante';
            }
        }
    });
}

/**
 * Cierra sesión del usuario
 */
export async function logout() {
    try {
        await fetch(API_AUTH_URL + '/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_e) {
        // Continuar aunque falle
    }

    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.clear();
    window.authToken = null;

    // ⚡ FIX W2: Reset ALL Zustand stores before reload
    resetAllStores();

    mostrarLogin();
    window.location.reload();
}

/**
 * Inicializa los event listeners del formulario de login
 */
export function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        const errorEl = document.getElementById('login-error');

        if (!email || !password) {
            if (errorEl) errorEl.textContent = 'Completa todos los campos';
            return;
        }

        try {
            const res = await fetch(API_AUTH_URL + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.needsVerification) {
                    if (errorEl) errorEl.textContent = 'Tu email no está verificado. Revisa tu bandeja de entrada.';
                } else {
                    if (errorEl) errorEl.textContent = data.error || 'Error de autenticación';
                }
                return;
            }

            // Multi-restaurant: needs selection
            if (data.needsSelection) {
                showRestaurantSelector(data.restaurants, data.selectionToken);
                return;
            }

            // Single restaurant: direct login (backward-compatible)
            if (data.token) {
                window.authToken = data.token;
                sessionStorage.setItem('_at', data.token);
            }
            localStorage.setItem('user', JSON.stringify(data.user));

            enterApp();
        } catch (err) {
            if (errorEl) errorEl.textContent = 'Error de conexión';
        }
    });
}

// ========== Multi-Restaurant: Selection Screen ==========

function showRestaurantSelector(restaurants, selectionToken) {
    const loginScreen = document.getElementById('login-screen');
    const selectorScreen = document.getElementById('restaurant-selector-screen');
    const listEl = document.getElementById('restaurant-list');

    if (loginScreen) loginScreen.style.display = 'none';
    if (selectorScreen) selectorScreen.style.display = 'flex';

    listEl.innerHTML = restaurants.map(r => `
        <button class="restaurant-option" data-id="${r.restaurante_id}"
                style="padding: 16px 20px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
                       border-radius: 12px; color: #e2e8f0; font-size: 16px; cursor: pointer; text-align: left;
                       transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;"
                onmouseover="this.style.background='rgba(99,102,241,0.2)'; this.style.borderColor='#6366f1'"
                onmouseout="this.style.background='rgba(255,255,255,0.08)'; this.style.borderColor='rgba(255,255,255,0.15)'">
            <strong style="font-weight: 600;">${escapeHtml(r.nombre)}</strong>
            <span style="opacity: 0.5; font-size: 13px;">${r.rol}</span>
        </button>
    `).join('');

    listEl.querySelectorAll('.restaurant-option').forEach(btn => {
        btn.addEventListener('click', () => selectRestaurant(parseInt(btn.dataset.id), selectionToken));
    });
}

async function selectRestaurant(restauranteId, selectionToken) {
    try {
        const res = await fetch(API_AUTH_URL + '/select-restaurant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ selectionToken, restauranteId }),
        });

        const data = await res.json();

        if (!res.ok) {
            window.showToast?.('Error: ' + (data.error || 'No se pudo seleccionar'), 'error');
            mostrarLogin();
            return;
        }

        if (data.token) {
            window.authToken = data.token;
            sessionStorage.setItem('_at', data.token);
        }
        localStorage.setItem('user', JSON.stringify(data.user));

        const selectorScreen = document.getElementById('restaurant-selector-screen');
        if (selectorScreen) selectorScreen.style.display = 'none';

        enterApp();
    } catch (err) {
        window.showToast?.('Error de conexión', 'error');
        mostrarLogin();
    }
}

// ========== Multi-Restaurant: Sidebar Switcher ==========

export async function initRestaurantSwitcher() {
    const switcher = document.getElementById('sidebar-restaurant-switcher');
    if (!switcher) return;

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('restaurant-switcher-dropdown');
        if (dropdown && dropdown.style.display !== 'none' && !switcher.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    switcher.addEventListener('click', async (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('restaurant-switcher-dropdown');
        if (!dropdown) return;

        if (dropdown.style.display !== 'none') {
            dropdown.style.display = 'none';
            return;
        }

        try {
            const headers = {};
            if (window.authToken) headers['Authorization'] = `Bearer ${window.authToken}`;
            const res = await fetch(API_AUTH_URL + '/my-restaurants', {
                credentials: 'include',
                headers
            });
            const data = await res.json();

            if (!data.restaurants || data.restaurants.length <= 1) {
                // Single restaurant: just logout
                window.logout();
                return;
            }

            dropdown.innerHTML = data.restaurants.map(r => `
                <button class="switch-restaurant-btn" data-id="${r.id}"
                        style="width: 100%; padding: 10px 12px; background: ${r.id === data.current ? 'rgba(99,102,241,0.2)' : 'transparent'};
                               border: none; border-radius: 8px; color: #e2e8f0; cursor: pointer; text-align: left;
                               font-size: 14px; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(99,102,241,0.15)'"
                        onmouseout="this.style.background='${r.id === data.current ? 'rgba(99,102,241,0.2)' : 'transparent'}'">
                    ${r.id === data.current ? '&#10003; ' : '&nbsp;&nbsp;&nbsp;'}${escapeHtml(r.nombre)}
                </button>
            `).join('') + `
                <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 8px 0;">
                <button id="switcher-logout-btn"
                        style="width: 100%; padding: 10px 12px; background: transparent;
                        border: none; border-radius: 8px; color: #ef4444; cursor: pointer; text-align: left; font-size: 14px;">
                    Cerrar Sesión
                </button>`;

            dropdown.style.display = 'block';

            dropdown.querySelectorAll('.switch-restaurant-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const newId = parseInt(btn.dataset.id);
                    if (newId === data.current) { dropdown.style.display = 'none'; return; }
                    await switchRestaurant(newId);
                });
            });

            const logoutBtn = dropdown.querySelector('#switcher-logout-btn');
            if (logoutBtn) logoutBtn.addEventListener('click', () => window.logout());
        } catch (err) {
            // If fetching restaurants fails, fallback to logout
            window.logout();
        }
    });
}

async function switchRestaurant(restauranteId) {
    try {
        const res = await fetch(API_AUTH_URL + '/switch-restaurant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ restauranteId }),
        });

        const data = await res.json();

        if (data.token) {
            window.authToken = data.token;
            sessionStorage.setItem('_at', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.reload();
        }
    } catch (err) {
        window.showToast?.('Error cambiando restaurante', 'error');
    }
}

// ========== Helpers ==========

function enterApp() {
    const loginScreen = document.getElementById('login-screen');
    const selectorScreen = document.getElementById('restaurant-selector-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = 'none';
    if (selectorScreen) selectorScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';

    if (typeof window.init === 'function') {
        window.init();
    } else if (typeof window.cargarDatos === 'function') {
        window.cargarDatos();
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.checkAuth = checkAuth;
    window.mostrarLogin = mostrarLogin;
    window.mostrarRegistro = mostrarRegistro;
    window.volverALogin = volverALogin;
    window.logout = logout;
    window.initRestaurantSwitcher = initRestaurantSwitcher;
}
