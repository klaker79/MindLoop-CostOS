/**
 * ============================================
 * stores/ingredientStore.js - Ingredients State
 * ============================================
 *
 * Gestión de estado de ingredientes con Zustand.
 * Incluye: CRUD, filtros, búsqueda, selección.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

import { createStore } from 'zustand/vanilla';

const API_BASE = '/api';

/**
 * Ingredient Store
 */
export const ingredientStore = createStore((set, get) => ({
    // State
    ingredients: [],
    filteredIngredients: [],
    selectedIngredient: null,
    isLoading: false,
    error: null,

    // Filters
    searchTerm: '',
    familyFilter: 'all',
    sortBy: 'nombre',
    sortOrder: 'asc',

    // Computed
    get totalValue() {
        return get().ingredients.reduce((sum, ing) => {
            const precio = parseFloat(ing.precio) || 0;
            const stock = parseFloat(ing.stock_actual) || 0;
            return sum + (precio * stock);
        }, 0);
    },

    get lowStockItems() {
        return get().ingredients.filter(ing => {
            const stock = parseFloat(ing.stock_actual) || 0;
            const minStock = parseFloat(ing.stock_minimo) || 0;
            return stock <= minStock && minStock > 0;
        });
    },

    // Actions

    // Direct setter for ingredients (used by legacy code sync)
    setIngredients: (ingredients) => {
        const ingredientsList = Array.isArray(ingredients) ? ingredients : [];
        set({ ingredients: ingredientsList });
        get().applyFilters();

        // Sync with window for legacy compatibility
        if (typeof window !== 'undefined') {
            window.ingredientes = ingredientsList;
        }
    },

    fetchIngredients: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/ingredients`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error fetching ingredients');

            const data = await response.json();
            const ingredients = Array.isArray(data) ? data : [];

            set({ ingredients, isLoading: false });
            get().applyFilters();

            // Sync with window for legacy compatibility
            if (typeof window !== 'undefined') {
                window.ingredientes = ingredients;
            }

            return ingredients;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return [];
        }
    },

    createIngredient: async (ingredientData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(ingredientData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error creating ingredient');
            }

            const newIngredient = await response.json();
            set((state) => ({
                ingredients: [...state.ingredients, newIngredient],
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.ingredientes = get().ingredients;
            }

            return { success: true, data: newIngredient };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    updateIngredient: async (id, ingredientData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/ingredients/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(ingredientData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error updating ingredient');
            }

            const updatedIngredient = await response.json();
            set((state) => ({
                ingredients: state.ingredients.map(ing =>
                    ing.id === id ? updatedIngredient : ing
                ),
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.ingredientes = get().ingredients;
            }

            return { success: true, data: updatedIngredient };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    deleteIngredient: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/ingredients/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error deleting ingredient');

            set((state) => ({
                ingredients: state.ingredients.filter(ing => ing.id !== id),
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.ingredientes = get().ingredients;
            }

            return { success: true };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    // Filtering
    setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().applyFilters();
    },

    setFamilyFilter: (family) => {
        set({ familyFilter: family });
        get().applyFilters();
    },

    setSorting: (sortBy, sortOrder = 'asc') => {
        set({ sortBy, sortOrder });
        get().applyFilters();
    },

    applyFilters: () => {
        const { ingredients, searchTerm, familyFilter, sortBy, sortOrder } = get();

        let filtered = [...ingredients];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(ing =>
                ing.nombre?.toLowerCase().includes(term) ||
                ing.familia?.toLowerCase().includes(term)
            );
        }

        // Apply family filter
        if (familyFilter && familyFilter !== 'all') {
            filtered = filtered.filter(ing =>
                ing.familia?.toLowerCase() === familyFilter.toLowerCase()
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        set({ filteredIngredients: filtered });
    },

    // Selection
    selectIngredient: (id) => {
        const ingredient = get().ingredients.find(ing => ing.id === id);
        set({ selectedIngredient: ingredient });
    },

    clearSelection: () => set({ selectedIngredient: null }),

    // Stock management
    updateStock: async (id, cantidad, operation = 'set') => {
        const current = get().ingredients.find(ing => ing.id === id);
        if (!current) return { success: false, error: 'Ingredient not found' };

        let newStock;
        if (operation === 'add') {
            newStock = (parseFloat(current.stock_actual) || 0) + cantidad;
        } else if (operation === 'subtract') {
            newStock = (parseFloat(current.stock_actual) || 0) - cantidad;
        } else {
            newStock = cantidad;
        }

        return get().updateIngredient(id, { stock_actual: newStock });
    },

    // Utilities
    getById: (id) => get().ingredients.find(ing => ing.id === id),

    clearError: () => set({ error: null }),

    reset: () => set({
        ingredients: [],
        filteredIngredients: [],
        selectedIngredient: null,
        isLoading: false,
        error: null,
        searchTerm: '',
        familyFilter: 'all'
    })
}));

// Getters for external use
export const getIngredients = () => ingredientStore.getState().ingredients;
export const getFilteredIngredients = () => ingredientStore.getState().filteredIngredients;
export const getIngredientById = (id) => ingredientStore.getState().getById(id);

// Subscribe helper
export const subscribeToIngredients = (callback) => ingredientStore.subscribe(callback);

// Initialize window compatibility layer
if (typeof window !== 'undefined') {
    window.ingredientStore = ingredientStore;
    window.getIngredients = getIngredients;
}

export default ingredientStore;
