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

        // Update sidebar with restaurant name
        updateSidebarRestaurant();

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

            const restaurants = data.restaurants || [];

            dropdown.innerHTML = restaurants.map(r => `
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
                <button id="switcher-add-btn"
                        style="width: 100%; padding: 10px 12px; background: transparent;
                        border: none; border-radius: 8px; color: #6366f1; cursor: pointer; text-align: left; font-size: 14px;">
                    + Añadir restaurante
                </button>
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

            const addBtn = dropdown.querySelector('#switcher-add-btn');
            if (addBtn) addBtn.addEventListener('click', () => {
                dropdown.style.display = 'none';
                promptCreateRestaurant();
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

// ========== Create Additional Restaurant ==========

const PLANS = {
    starter: { name: 'Starter', monthly: 49, annual: 490, users: 2, level: 1, features: 'Ingredientes, recetas, pedidos, ventas, inventario, mermas, PDF/Excel' },
    profesional: { name: 'Profesional', monthly: 89, annual: 890, users: 5, level: 2, features: 'Todo Starter + alertas, plan de compras, menu engineering, balance P&L, KPIs, equipo' },
    premium: { name: 'Premium', monthly: 149, annual: 1490, users: 999, level: 3, features: 'Todo Profesional + IA: escaneo albaranes, chat IA, compras auto. Soporte prioritario' }
};

async function promptCreateRestaurant() {
    // Fetch current plan to filter available options
    const API_BASE = API_AUTH_URL.replace('/api/auth', '/api');
    let currentPlan = 'starter';
    try {
        const res = await fetch(API_BASE + '/stripe/subscription-status', {
            credentials: 'include',
            headers: window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {}
        });
        if (res.ok) {
            const data = await res.json();
            currentPlan = data.plan || 'starter';
        }
    } catch (e) { /* fallback to starter */ }

    const currentLevel = PLANS[currentPlan]?.level || (currentPlan === 'trial' ? 2 : 1);

    // Build modal
    const overlay = document.createElement('div');
    overlay.id = 'create-restaurant-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

    const availablePlans = Object.entries(PLANS).filter(([, p]) => p.level >= currentLevel);

    overlay.innerHTML = `
    <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;width:92%;max-width:560px;max-height:90vh;overflow-y:auto;padding:32px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
            <h2 style="margin:0;color:#f1f5f9;font-size:20px;">Nuevo restaurante</h2>
            <button id="modal-close" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px 8px;">&times;</button>
        </div>

        <label style="display:block;color:#94a3b8;font-size:13px;margin-bottom:6px;">Nombre del restaurante</label>
        <input id="modal-nombre" type="text" placeholder="Ej: Mi Segundo Restaurante"
            style="width:100%;padding:12px 14px;background:#0f172a;border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:#f1f5f9;font-size:15px;margin-bottom:20px;box-sizing:border-box;outline:none;"
            onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='rgba(255,255,255,0.15)'" />

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="color:#94a3b8;font-size:13px;">Elige tu plan</span>
            <div style="display:flex;background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                <button class="billing-toggle active" data-billing="monthly"
                    style="padding:6px 14px;border:none;font-size:12px;cursor:pointer;background:#6366f1;color:#fff;transition:all 0.2s;">Mensual</button>
                <button class="billing-toggle" data-billing="annual"
                    style="padding:6px 14px;border:none;font-size:12px;cursor:pointer;background:transparent;color:#94a3b8;transition:all 0.2s;">Anual <span style="color:#10b981;font-size:10px;">-17%</span></button>
            </div>
        </div>

        <div id="modal-plans" style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
            ${availablePlans.map(([key, p], i) => `
                <label class="plan-card" data-plan="${key}"
                    style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:${i === 0 ? 'rgba(99,102,241,0.12)' : '#0f172a'};border:2px solid ${i === 0 ? '#6366f1' : 'rgba(255,255,255,0.08)'};border-radius:12px;cursor:pointer;transition:all 0.2s;">
                    <input type="radio" name="plan" value="${key}" ${i === 0 ? 'checked' : ''}
                        style="accent-color:#6366f1;width:18px;height:18px;flex-shrink:0;" />
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:space-between;align-items:baseline;">
                            <span style="color:#f1f5f9;font-weight:600;font-size:15px;">${p.name}</span>
                            <span style="color:#f1f5f9;font-weight:700;font-size:16px;">
                                <span class="plan-price-monthly">${p.monthly}&euro;</span><span class="plan-price-annual" style="display:none">${p.annual}&euro;</span><span class="plan-period-monthly" style="color:#94a3b8;font-size:12px;font-weight:400;">/mes</span><span class="plan-period-annual" style="display:none;color:#94a3b8;font-size:12px;font-weight:400;">/a&ntilde;o</span>
                            </span>
                        </div>
                        <div style="color:#94a3b8;font-size:12px;margin-top:3px;line-height:1.4;">${p.features}</div>
                        <div style="color:#64748b;font-size:11px;margin-top:2px;">${p.users === 999 ? 'Usuarios ilimitados' : `Hasta ${p.users} usuarios`}</div>
                    </div>
                </label>
            `).join('')}
        </div>

        <button id="modal-submit"
            style="width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">
            Crear y pagar
        </button>
        <p style="text-align:center;color:#64748b;font-size:11px;margin:12px 0 0;">Pago seguro con Stripe. Puedes cancelar en cualquier momento.</p>
    </div>`;

    document.body.appendChild(overlay);

    // Billing toggle
    let billing = 'monthly';
    overlay.querySelectorAll('.billing-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            billing = btn.dataset.billing;
            overlay.querySelectorAll('.billing-toggle').forEach(b => {
                const isActive = b.dataset.billing === billing;
                b.style.background = isActive ? '#6366f1' : 'transparent';
                b.style.color = isActive ? '#fff' : '#94a3b8';
                b.classList.toggle('active', isActive);
            });
            overlay.querySelectorAll('.plan-price-monthly').forEach(el => el.style.display = billing === 'monthly' ? '' : 'none');
            overlay.querySelectorAll('.plan-price-annual').forEach(el => el.style.display = billing === 'annual' ? '' : 'none');
            overlay.querySelectorAll('.plan-period-monthly').forEach(el => el.style.display = billing === 'monthly' ? '' : 'none');
            overlay.querySelectorAll('.plan-period-annual').forEach(el => el.style.display = billing === 'annual' ? '' : 'none');
        });
    });

    // Plan card selection highlight
    overlay.querySelectorAll('.plan-card').forEach(card => {
        card.addEventListener('click', () => {
            overlay.querySelectorAll('.plan-card').forEach(c => {
                c.style.background = '#0f172a';
                c.style.borderColor = 'rgba(255,255,255,0.08)';
            });
            card.style.background = 'rgba(99,102,241,0.12)';
            card.style.borderColor = '#6366f1';
            card.querySelector('input[type=radio]').checked = true;
        });
    });

    // Close
    const closeModal = () => overlay.remove();
    overlay.querySelector('#modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Submit
    overlay.querySelector('#modal-submit').addEventListener('click', async () => {
        const nombre = overlay.querySelector('#modal-nombre').value.trim();
        if (!nombre) {
            overlay.querySelector('#modal-nombre').style.borderColor = '#ef4444';
            overlay.querySelector('#modal-nombre').focus();
            return;
        }
        const selectedPlan = overlay.querySelector('input[name=plan]:checked')?.value;
        if (!selectedPlan) return;

        const submitBtn = overlay.querySelector('#modal-submit');
        submitBtn.textContent = 'Creando...';
        submitBtn.style.opacity = '0.6';
        submitBtn.disabled = true;

        await createAdditionalRestaurant(nombre, selectedPlan, billing, closeModal);
    });

    overlay.querySelector('#modal-nombre').focus();
}

async function createAdditionalRestaurant(nombre, plan, billing, closeModal) {
    try {
        const res = await fetch(API_AUTH_URL + '/create-restaurant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ nombre, plan, billing }),
        });

        const data = await res.json();

        if (!res.ok) {
            window.showToast?.(data.error || 'Error creando restaurante', 'error');
            const btn = document.querySelector('#modal-submit');
            if (btn) { btn.textContent = 'Crear y pagar'; btn.style.opacity = '1'; btn.disabled = false; }
            return;
        }

        // Redirect to Stripe Checkout
        if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
        } else {
            window.showToast?.('Error: no se pudo crear la sesión de pago', 'error');
            if (closeModal) closeModal();
        }
    } catch (err) {
        window.showToast?.('Error de conexión', 'error');
        const btn = document.querySelector('#modal-submit');
        if (btn) { btn.textContent = 'Crear y pagar'; btn.style.opacity = '1'; btn.disabled = false; }
    }
}

// Handle Stripe Checkout return (?checkout=success&new_restaurant=ID)
export async function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const newRestaurant = params.get('new_restaurant');

    if (!checkout) return;

    // Clean URL
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (checkout === 'success' && newRestaurant) {
        window.showToast?.('Restaurante creado. Activando suscripción...', 'success');
        // Auto-switch to the new restaurant after a short delay (webhook may need a moment)
        setTimeout(async () => {
            try {
                await switchRestaurant(parseInt(newRestaurant));
            } catch (e) {
                window.showToast?.('Pago confirmado. Recarga la página para ver tu nuevo restaurante.', 'info');
            }
        }, 2000);
    } else if (checkout === 'canceled' && newRestaurant) {
        window.showToast?.('Pago cancelado. El restaurante no fue activado.', 'warning');
        // Cleanup orphaned pending_payment restaurant
        try {
            await fetch(API_AUTH_URL + '/pending-restaurant/' + newRestaurant, {
                method: 'DELETE',
                credentials: 'include',
                headers: window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {}
            });
        } catch (_e) { /* best effort */ }
    } else if (checkout === 'canceled') {
        window.showToast?.('Pago cancelado.', 'warning');
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

    // Update sidebar with current restaurant name
    updateSidebarRestaurant();

    if (typeof window.init === 'function') {
        window.init();
    } else if (typeof window.cargarDatos === 'function') {
        window.cargarDatos();
    }
}

function updateSidebarRestaurant() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const name = user.restaurante || user.nombre || 'Mi Restaurante';
        const avatarEl = document.getElementById('sidebar-avatar');
        const nameEl = document.getElementById('sidebar-restaurant-name');
        if (avatarEl) {
            // Generate initials from restaurant name (first 2 words)
            const words = name.trim().split(/\s+/);
            const initials = words.length >= 2
                ? (words[0][0] + words[1][0]).toUpperCase()
                : name.substring(0, 2).toUpperCase();
            avatarEl.textContent = initials;
        }
        if (nameEl) nameEl.textContent = name;
    } catch (_e) { /* ignore */ }
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
