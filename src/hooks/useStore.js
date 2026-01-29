/**
 * Hooks unificados para acceso a stores
 * Punto único de acceso al estado
 */

import useIngredientStore from '../stores/ingredientStore.js';
import useRecipeStore from '../stores/recipeStore.js';
import useOrderStore from '../stores/orderStore.js';
import useSaleStore from '../stores/saleStore.js';
import useSupplierStore from '../stores/supplierStore.js';
import useAuthStore from '../stores/authStore.js';
import useUIStore from '../stores/uiStore.js';

/**
 * Hook para obtener ingredientes con filtros
 */
export function useIngredients() {
    const store = useIngredientStore();
    return {
        ingredients: store.ingredients,
        filtered: store.getFilteredIngredients?.() || store.ingredients,
        loading: store.loading,
        error: store.error,
        // Actions
        fetch: store.fetchIngredients,
        create: store.createIngredient,
        update: store.updateIngredient,
        delete: store.deleteIngredient,
        setFilter: store.setFilter
    };
}

/**
 * Hook para obtener recetas
 */
export function useRecipes() {
    const store = useRecipeStore();
    return {
        recipes: store.recipes,
        loading: store.loading,
        error: store.error,
        fetch: store.fetchRecipes,
        create: store.createRecipe,
        update: store.updateRecipe,
        delete: store.deleteRecipe
    };
}

/**
 * Hook para autenticación
 */
export function useAuth() {
    const store = useAuthStore();
    return {
        user: store.user,
        isAuthenticated: store.isAuthenticated,
        login: store.login,
        logout: store.logout,
        checkAuth: store.checkAuth
    };
}

/**
 * Hook para UI state
 */
export function useUI() {
    const store = useUIStore();
    return {
        activeTab: store.activeTab,
        modals: store.modals,
        setActiveTab: store.setActiveTab,
        openModal: store.openModal,
        closeModal: store.closeModal,
        showToast: store.showToast
    };
}

/**
 * Hook para pedidos
 */
export function useOrders() {
    const store = useOrderStore();
    return {
        orders: store.orders,
        cartItems: store.cartItems,
        loading: store.loading,
        error: store.error,
        fetch: store.fetchOrders,
        create: store.createOrder,
        addToCart: store.addToCart,
        removeFromCart: store.removeFromCart,
        clearCart: store.clearCart
    };
}

/**
 * Hook para ventas
 */
export function useSales() {
    const store = useSaleStore();
    return {
        sales: store.sales,
        loading: store.loading,
        error: store.error,
        fetch: store.fetchSales,
        create: store.createSale
    };
}

/**
 * Hook para proveedores
 */
export function useSuppliers() {
    const store = useSupplierStore();
    return {
        suppliers: store.suppliers,
        loading: store.loading,
        error: store.error,
        fetch: store.fetchSuppliers,
        create: store.createSupplier,
        update: store.updateSupplier,
        delete: store.deleteSupplier
    };
}

export default {
    useIngredients,
    useRecipes,
    useAuth,
    useUI,
    useOrders,
    useSales,
    useSuppliers
};
