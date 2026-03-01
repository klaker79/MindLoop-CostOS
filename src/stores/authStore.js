/**
 * ============================================
 * stores/authStore.js - Authentication State
 * ============================================
 *
 * Gestión de estado de autenticación con Zustand.
 * Mantiene compatibilidad con window.* para código legacy.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

import { createStore } from 'zustand/vanilla';

/**
 * Auth Store - Estado de autenticación
 */
const PLAN_LEVELS = { starter: 1, trial: 2, profesional: 2, premium: 3 };

export const authStore = createStore((set, get) => ({
    // State
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    // Plan state (loaded after auth)
    plan: null,
    plan_status: null,
    trial_days_left: null,
    max_users: null,
    has_subscription: false,
    trial_ends_at: null,

    // Actions
    setUser: (user) => {
        set({ user, isAuthenticated: !!user, isLoading: false });
        // Sync with window for legacy compatibility
        if (typeof window !== 'undefined') {
            window.currentUser = user;
            window.isAuthenticated = !!user;
        }
    },

    setToken: (token) => {
        set({ token });
        // 🔒 SECURITY: Token lives ONLY in httpOnly cookie (set by backend)
        // Do NOT store in localStorage — prevents XSS token theft
        // Legacy cleanup: remove any previously stored token
        localStorage.removeItem('token');
        // Sync with window + sessionStorage (survives reload, clears on tab close)
        if (typeof window !== 'undefined') {
            window.authToken = token;
            if (token) {
                sessionStorage.setItem('_at', token);
            } else {
                sessionStorage.removeItem('_at');
            }
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error de autenticación');
            }

            const data = await response.json();
            get().setUser(data.user);
            get().setToken(data.token);

            return { success: true, user: data.user };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    logout: async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) {
            console.warn('Logout API error:', e);
        }

        set({ user: null, token: null, isAuthenticated: false, error: null });
        localStorage.removeItem('token');

        // Clear window references
        if (typeof window !== 'undefined') {
            window.currentUser = null;
            window.isAuthenticated = false;
            window.authToken = null;
        }
    },

    checkAuth: async () => {
        set({ isLoading: true });
        try {
            const response = await fetch('/api/auth/verify', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                get().setUser(data.user);
                // Load plan data in background (non-blocking)
                get().loadPlanData();
                return true;
            } else {
                get().logout();
                return false;
            }
        } catch (error) {
            get().logout();
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    loadPlanData: async () => {
        try {
            const headers = { 'Content-Type': 'application/json' };
            const token = typeof window !== 'undefined' ? window.authToken : null;
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/stripe/subscription-status', {
                headers,
                credentials: 'include'
            });
            if (!res.ok) return;

            const data = await res.json();
            set({
                plan: data.plan,
                plan_status: data.plan_status,
                trial_days_left: data.trial_days_left,
                max_users: data.max_users,
                has_subscription: data.has_subscription,
                trial_ends_at: data.trial_ends_at
            });

            // Sync to window for legacy access
            if (typeof window !== 'undefined') {
                window._planData = data;
                window.dispatchEvent(new CustomEvent('plan:loaded', { detail: data }));
            }
        } catch (e) {
            console.warn('Could not load plan data:', e.message);
        }
    },

    getPlanLevel: () => {
        const plan = get().plan;
        return PLAN_LEVELS[plan] || 0;
    },

    clearError: () => set({ error: null })
}));

// Plan level constants (exported for use in gating)
export { PLAN_LEVELS };

// Getters for external use
export const getAuthState = () => authStore.getState();
export const getUser = () => authStore.getState().user;
export const isAuthenticated = () => authStore.getState().isAuthenticated;
export const getPlanLevel = () => authStore.getState().getPlanLevel();

// Subscribe helper
export const subscribeToAuth = (callback) => authStore.subscribe(callback);

// Initialize window compatibility layer
if (typeof window !== 'undefined') {
    window.authStore = authStore;
    window.getAuthState = getAuthState;
}

export default authStore;
