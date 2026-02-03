/**
 * ============================================
 * stores/authStore.js - Authentication State
 * ============================================
 *
 * Gestión de estado de autenticación con Zustand.
 * SECURITY: Authentication uses httpOnly cookies set by the server.
 * NO tokens are stored in localStorage (XSS-safe).
 *
 * @author MindLoopIA
 * @version 2.0.0
 */

import { createStore } from 'zustand/vanilla';

/**
 * Auth Store - Estado de autenticación
 */
export const authStore = createStore((set, get) => ({
    // State
    user: null,
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
            // Token is set as httpOnly cookie by the server - we only store user info
            get().setUser(data.user);

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

        set({ user: null, isAuthenticated: false, error: null });

        // Clean up any legacy localStorage tokens
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
