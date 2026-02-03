/**
 * ============================================
 * stores/recipeStore.js - Recipes State
 * ============================================
 *
 * Gestión de estado de recetas con Zustand.
 * Incluye: CRUD, filtros, búsqueda, cálculo de costes.
 *
 * @author MindLoopIA
 * @version 2.0.0 - Migrado a apiClient
 */

import { createStore } from 'zustand/vanilla';
import { apiClient } from '../api/client.js';
import { validateRecipeData } from '../utils/validation-schemas.js';

/**
 * Recipe Store
 */
export const recipeStore = createStore((set, get) => ({
    // State
    recipes: [],
    filteredRecipes: [],
    selectedRecipe: null,
    isLoading: false,
    error: null,

    // Filters
    searchTerm: '',
    categoryFilter: 'all',
    sortBy: 'nombre',
    sortOrder: 'asc',

    // Actions

    // Direct setter for recipes (used by legacy code sync)
    setRecipes: (recipes) => {
        const recipesList = Array.isArray(recipes) ? recipes : [];
        set({ recipes: recipesList });
        get().applyFilters();

        // Sync with window for legacy compatibility
        if (typeof window !== 'undefined') {
            window.recetas = recipesList;
        }
    },

    fetchRecipes: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await apiClient.get('/recipes');
            const recipes = Array.isArray(data) ? data : [];

            set({ recipes, isLoading: false });
            get().applyFilters();

            // Sync with window for legacy compatibility
            if (typeof window !== 'undefined') {
                window.recetas = recipes;
            }

            return recipes;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return [];
        }
    },

    createRecipe: async (recipeData) => {
        const validation = validateRecipeData(recipeData, false);
        if (!validation.valid) {
            const errorMsg = validation.errors.join(', ');
            set({ error: errorMsg });
            return { success: false, error: errorMsg };
        }
        set({ isLoading: true, error: null });
        try {
            const newRecipe = await apiClient.post('/recipes', validation.sanitized);

            set((state) => ({
                recipes: [...state.recipes, newRecipe],
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.recetas = get().recipes;
            }

            return { success: true, data: newRecipe };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    updateRecipe: async (id, recipeData) => {
        const validation = validateRecipeData(recipeData, true);
        if (!validation.valid) {
            const errorMsg = validation.errors.join(', ');
            set({ error: errorMsg });
            return { success: false, error: errorMsg };
        }
        set({ isLoading: true, error: null });
        try {
            const updatedRecipe = await apiClient.put(`/recipes/${id}`, validation.sanitized);

            set((state) => ({
                recipes: state.recipes.map(rec =>
                    rec.id === id ? updatedRecipe : rec
                ),
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.recetas = get().recipes;
            }

            return { success: true, data: updatedRecipe };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    deleteRecipe: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await apiClient.delete(`/recipes/${id}`);

            set((state) => ({
                recipes: state.recipes.filter(rec => rec.id !== id),
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.recetas = get().recipes;
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

    setCategoryFilter: (category) => {
        set({ categoryFilter: category });
        get().applyFilters();
    },

    setSorting: (sortBy, sortOrder = 'asc') => {
        set({ sortBy, sortOrder });
        get().applyFilters();
    },

    applyFilters: () => {
        const { recipes, searchTerm, categoryFilter, sortBy, sortOrder } = get();

        let filtered = [...recipes];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(rec =>
                rec.nombre?.toLowerCase().includes(term) ||
                rec.codigo?.toString().includes(term)
            );
        }

        // Apply category filter
        if (categoryFilter && categoryFilter !== 'all') {
            filtered = filtered.filter(rec =>
                rec.categoria?.toLowerCase() === categoryFilter.toLowerCase()
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

        set({ filteredRecipes: filtered });
    },

    // Selection
    selectRecipe: (id) => {
        const recipe = get().recipes.find(rec => rec.id === id);
        set({ selectedRecipe: recipe });
    },

    clearSelection: () => set({ selectedRecipe: null }),

    // Utilities
    getById: (id) => get().recipes.find(rec => rec.id === id),

    clearError: () => set({ error: null }),

    reset: () => set({
        recipes: [],
        filteredRecipes: [],
        selectedRecipe: null,
        isLoading: false,
        error: null,
        searchTerm: '',
        categoryFilter: 'all'
    })
}));

// Getters for external use
export const getRecipes = () => recipeStore.getState().recipes;
export const getFilteredRecipes = () => recipeStore.getState().filteredRecipes;
export const getRecipeById = (id) => recipeStore.getState().getById(id);

// Subscribe helper
export const subscribeToRecipes = (callback) => recipeStore.subscribe(callback);

// Initialize window compatibility layer
if (typeof window !== 'undefined') {
    window.recipeStore = recipeStore;
    window.getRecipes = getRecipes;
}

export default recipeStore;
