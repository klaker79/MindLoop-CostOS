/**
 * Módulo de Autenticación - MindLoop CostOS
 * Maneja login, logout, y verificación de sesión
 */

import { getAuthUrl } from '../../config/app-config.js';

const API_AUTH_URL = getAuthUrl();

/**
 * Verifica si el usuario está autenticado
 * Si la sesión es válida, carga los datos iniciales
 */
export async function checkAuth() {
    try {
        // Verificar sesión via cookie httpOnly (se envía automáticamente)
        const res = await fetch(API_AUTH_URL + '/verify', {
            credentials: 'include'
        });
        if (!res.ok) {
            mostrarLogin();
            return false;
        }

        // ✅ Sesión válida: mostrar app y cargar datos
        const loginScreen = document.getElementById('login-screen');
        const appContainer = document.getElementById('app-container');
        if (loginScreen) loginScreen.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';

        // ✅ Importante: cargar datos cuando ya hay sesión activa
        if (typeof window.cargarDatos === 'function') {
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
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
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
    // Clear errors
    const errorEl = document.getElementById('register-error');
    if (errorEl) errorEl.textContent = '';
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
        const codigoInvitacion = document.getElementById('reg-codigo')?.value?.trim();
        const errorEl = document.getElementById('register-error');
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        if (!nombre || !email || !password || !codigoInvitacion) {
            if (errorEl) errorEl.textContent = 'Completa todos los campos';
            return;
        }

        if (password !== password2) {
            if (errorEl) errorEl.textContent = 'Las contraseñas no coinciden';
            return;
        }

        if (password.length < 6) {
            if (errorEl) errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
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
                body: JSON.stringify({ nombre, email, password, codigoInvitacion }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (errorEl) errorEl.textContent = data.error || 'Error en el registro';
                return;
            }

            // Registration successful - auto login
            const loginRes = await fetch(API_AUTH_URL + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            if (loginRes.ok) {
                const loginData = await loginRes.json();
                localStorage.setItem('user', JSON.stringify(loginData.user));
                const loginScreen = document.getElementById('login-screen');
                const appContainer = document.getElementById('app-container');
                if (loginScreen) loginScreen.style.display = 'none';
                if (appContainer) appContainer.style.display = 'block';
                if (typeof window.cargarDatos === 'function') {
                    window.cargarDatos();
                }
            } else {
                // Login failed but registration succeeded - go back to login
                volverALogin();
                const loginError = document.getElementById('login-error');
                if (loginError) loginError.textContent = '✅ Restaurante creado. Inicia sesión con tus credenciales.';
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
    // Limpiar cookie httpOnly via backend
    try {
        await fetch(API_AUTH_URL + '/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_e) {
        // Continuar aunque falle
    }

    // Limpiar TODO el almacenamiento local y de sesión
    localStorage.removeItem('user');
    localStorage.removeItem('token'); // Legacy cleanup
    sessionStorage.clear(); // 🧹 Limpiar caché de sesión (KPIs, stock, etc.)

    // Forzar recarga para limpiar estado en memoria
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
                credentials: 'include', // Recibir cookie httpOnly
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (errorEl) errorEl.textContent = data.error || 'Error de autenticación';
                return;
            }

            // Solo guardamos user info localmente (token está en cookie httpOnly)
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
    window.volverALogin = volverALogin;
    window.logout = logout;
}
