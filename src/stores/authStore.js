/**
 * ============================================
 * stores/authStore.js - Authentication State
 * ============================================
 *
 * Gestión de estado de autenticación con Zustand.
 *
 * AUTH STRATEGY:
 * - Primary: httpOnly cookies via credentials: 'include' (apiClient)
 * - Fallback: Bearer token in localStorage (legacy code compatibility)
 * - Token is stored in localStorage ONLY for legacy modules that use
 *   raw fetch() with Authorization header. New code should use apiClient.
 *
 * @author MindLoopIA
 * @version 2.1.0
 */

import { createStore } from 'zustand/vanilla';

/**
 * Auth Store - Estado de autenticación
 */
export const authStore = createStore((set, get) => ({
    // State
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

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
        // Store in localStorage for legacy code that uses raw fetch()
        // with Authorization: Bearer header (20+ callsites)
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
        if (typeof window !== 'undefined') {
            window.authToken = token;
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
            // Store token for legacy code compatibility
            if (data.token) {
                get().setToken(data.token);
            }

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
        } catch (_e) {
            // Continue with local logout even if backend call fails
        }

        set({ user: null, token: null, isAuthenticated: false, error: null });
        localStorage.removeItem('token');
        localStorage.removeItem('user');

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
                return true;
            } else {
                get().logout();
                return false;
            }
        } catch (_error) {
            get().logout();
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    clearError: () => set({ error: null })
}));

// Getters for external use
export const getAuthState = () => authStore.getState();
export const getUser = () => authStore.getState().user;
export const isAuthenticated = () => authStore.getState().isAuthenticated;

// Subscribe helper
export const subscribeToAuth = (callback) => authStore.subscribe(callback);

// Listen for auth:expired events from apiClient and auto-logout
if (typeof window !== 'undefined') {
    window.addEventListener('auth:expired', () => {
        authStore.getState().logout();
    });

    window.authStore = authStore;
    window.getAuthState = getAuthState;
}

export default authStore;
