/**
 * ============================================
 * stores/index.js - Store Registry
 * ============================================
 *
 * Exporta todos los stores y funciones de utilidad.
 * Inicializa la compatibilidad con window.* para código legacy.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

// Store imports
import authStore, { getAuthState, getUser, isAuthenticated } from './authStore.js';
import ingredientStore, { getIngredients, getFilteredIngredients, getIngredientById } from './ingredientStore.js';
import uiStore, { showToast, showSuccess, showError, openModal, closeModal, getActiveTab } from './uiStore.js';

// Export stores
export {
    authStore,
    ingredientStore,
    uiStore
};

// Export auth functions
export {
    getAuthState,
    getUser,
    isAuthenticated
};

// Export ingredient functions
export {
    getIngredients,
    getFilteredIngredients,
    getIngredientById
};

// Export UI functions
export {
    showToast,
    showSuccess,
    showError,
    openModal,
    closeModal,
    getActiveTab
};

/**
 * Initialize all stores and sync with window
 */
export function initializeStores() {
    if (typeof window === 'undefined') return;

    // Expose stores to window for legacy compatibility
    window.stores = {
        auth: authStore,
        ingredients: ingredientStore,
        ui: uiStore
    };

    // Sync initial state
    const ingredientState = ingredientStore.getState();
    window.ingredientes = ingredientState.ingredients;

    const authState = authStore.getState();
    window.currentUser = authState.user;
    window.isAuthenticated = authState.isAuthenticated;

    console.log('✅ Zustand stores initialized');
}

/**
 * Reset all stores (useful for logout)
 */
export function resetAllStores() {
    authStore.getState().logout();
    ingredientStore.getState().reset();
    uiStore.getState().clearToasts();
}

// Note: initializeStores() is called explicitly from main.js
// Do not auto-initialize here to avoid duplicate initialization

export default {
    authStore,
    ingredientStore,
    uiStore,
    initializeStores,
    resetAllStores
};
