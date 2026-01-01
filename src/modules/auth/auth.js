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
    // Toggle entre login y registro si existe
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
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
    localStorage.removeItem('user');
    localStorage.removeItem('token'); // Legacy cleanup
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
    window.logout = logout;
}
