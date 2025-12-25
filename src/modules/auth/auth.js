/**
 * Módulo de Autenticación - MindLoop CostOS
 * Maneja login, logout, y verificación de sesión
 */

const API_AUTH_URL = 'https://lacaleta-api.mindloop.cloud/api/auth';

/**
 * Verifica si el usuario está autenticado
 */
export async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        mostrarLogin();
        return false;
    }

    try {
        const res = await fetch(API_AUTH_URL + '/verify', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            mostrarLogin();
            return false;
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
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

/**
 * Muestra la pantalla de registro
 */
export function mostrarRegistro() {
    // Toggle entre login y registro si existe
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

/**
 * Cierra sesión del usuario
 */
export function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    mostrarLogin();
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
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (errorEl) errorEl.textContent = data.error || 'Error de autenticación';
                return;
            }

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Ocultar login, mostrar app
            const loginScreen = document.getElementById('login-screen');
            const appContainer = document.getElementById('app-container');
            if (loginScreen) loginScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';

            // Cargar datos iniciales
            if (typeof window.cargarDatos === 'function') {
                window.cargarDatos();
            }
        } catch (err) {
            if (errorEl) errorEl.textContent = 'Error de conexión';
        }
    });
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.checkAuth = checkAuth;
    window.mostrarLogin = mostrarLogin;
    window.mostrarRegistro = mostrarRegistro;
    window.logout = logout;
}
