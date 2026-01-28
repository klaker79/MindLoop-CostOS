/**
 * ============================================
 * stores/saleStore.js - Sales State
 * ============================================
 *
 * Gestión de estado de ventas con Zustand.
 * Incluye: CRUD, filtros por fecha, estadísticas.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

import { createStore } from 'zustand/vanilla';
import { getApiUrl } from '../config/app-config.js';

const API_BASE = getApiUrl();

/**
 * Sale Store
 */
export const saleStore = createStore((set, get) => ({
    // State
    sales: [],
    filteredSales: [],
    isLoading: false,
    error: null,

    // Filters
    dateFrom: null,
    dateTo: null,
    recipeFilter: null,

    // Actions

    setSales: (sales) => {
        const salesList = Array.isArray(sales) ? sales : [];
        set({ sales: salesList });
        get().applyFilters();

        if (typeof window !== 'undefined') {
            window.ventas = salesList;
        }
    },

    fetchSales: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/sales`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error fetching sales');

            const data = await response.json();
            const sales = Array.isArray(data) ? data : [];

            set({ sales, isLoading: false });
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.ventas = sales;
            }

            return sales;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return [];
        }
    },

    createSale: async (saleData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(saleData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error creating sale');
            }

            const newSale = await response.json();
            set((state) => ({
                sales: [...state.sales, newSale],
                isLoading: false
            }));
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.ventas = get().sales;
            }

            return { success: true, data: newSale };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    // Bulk create sales
    createBulkSales: async (salesArray) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/sales/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(salesArray)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error creating bulk sales');
            }

            const result = await response.json();

            // Refresh sales list
            await get().fetchSales();

            return { success: true, data: result };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    deleteSale: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/sales/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error deleting sale');

            set((state) => ({
                sales: state.sales.filter(sale => sale.id !== id),
                isLoading: false
            }));
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.ventas = get().sales;
            }

            return { success: true };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    // Filtering
    setDateRange: (from, to) => {
        set({ dateFrom: from, dateTo: to });
        get().applyFilters();
    },

    setRecipeFilter: (recipeId) => {
        set({ recipeFilter: recipeId });
        get().applyFilters();
    },

    applyFilters: () => {
        const { sales, dateFrom, dateTo, recipeFilter } = get();

        let filtered = [...sales];

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(sale => new Date(sale.fecha) >= fromDate);
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            filtered = filtered.filter(sale => new Date(sale.fecha) <= toDate);
        }

        if (recipeFilter) {
            filtered = filtered.filter(sale => sale.receta_id === recipeFilter);
        }

        // Sort by date descending (newest first)
        filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        set({ filteredSales: filtered });
    },

    // Statistics
    getTotalRevenue: () => get().sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
    getTodayRevenue: () => {
        const today = new Date().toDateString();
        return get().sales
            .filter(s => new Date(s.fecha).toDateString() === today)
            .reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
    },
    getSalesCount: () => get().sales.length,

    clearError: () => set({ error: null }),

    reset: () => set({
        sales: [],
        filteredSales: [],
        isLoading: false,
        error: null,
        dateFrom: null,
        dateTo: null,
        recipeFilter: null
    })
}));

// Exports
export const getSales = () => saleStore.getState().sales;
export const getTodayRevenue = () => saleStore.getState().getTodayRevenue();
export const subscribeToSales = (callback) => saleStore.subscribe(callback);

if (typeof window !== 'undefined') {
    window.saleStore = saleStore;
}

export default saleStore;
