/**
 * ============================================
 * stores/supplierStore.js - Suppliers State
 * ============================================
 *
 * Gestión de estado de proveedores con Zustand.
 * Incluye: CRUD, filtros, búsqueda.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

import { createStore } from 'zustand/vanilla';
import { getApiUrl } from '../config/app-config.js';

const API_BASE = getApiUrl();

/**
 * Supplier Store
 */
export const supplierStore = createStore((set, get) => ({
    // State
    suppliers: [],
    filteredSuppliers: [],
    selectedSupplier: null,
    isLoading: false,
    error: null,

    // Filters
    searchTerm: '',
    sortBy: 'nombre',
    sortOrder: 'asc',

    // Actions

    setSuppliers: (suppliers) => {
        const suppliersList = Array.isArray(suppliers) ? suppliers : [];
        set({ suppliers: suppliersList });
        get().applyFilters();

        if (typeof window !== 'undefined') {
            window.proveedores = suppliersList;
        }
    },

    fetchSuppliers: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/suppliers`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error fetching suppliers');

            const data = await response.json();
            const suppliers = Array.isArray(data) ? data : [];

            set({ suppliers, isLoading: false });
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.proveedores = suppliers;
            }

            return suppliers;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return [];
        }
    },

    createSupplier: async (supplierData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/suppliers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(supplierData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error creating supplier');
            }

            const newSupplier = await response.json();
            set((state) => ({
                suppliers: [...state.suppliers, newSupplier],
                isLoading: false
            }));
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.proveedores = get().suppliers;
            }

            return { success: true, data: newSupplier };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    updateSupplier: async (id, supplierData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/suppliers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(supplierData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error updating supplier');
            }

            const updatedSupplier = await response.json();
            set((state) => ({
                suppliers: state.suppliers.map(sup =>
                    sup.id === id ? updatedSupplier : sup
                ),
                isLoading: false
            }));
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.proveedores = get().suppliers;
            }

            return { success: true, data: updatedSupplier };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    deleteSupplier: async (id) => {
        set({ isLoading: true, error: null });
        try {
            const response = await fetch(`${API_BASE}/suppliers/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Error deleting supplier');

            set((state) => ({
                suppliers: state.suppliers.filter(sup => sup.id !== id),
                isLoading: false
            }));
            get().applyFilters();

            if (typeof window !== 'undefined') {
                window.proveedores = get().suppliers;
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

    setSorting: (sortBy, sortOrder = 'asc') => {
        set({ sortBy, sortOrder });
        get().applyFilters();
    },

    applyFilters: () => {
        const { suppliers, searchTerm, sortBy, sortOrder } = get();

        let filtered = [...suppliers];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(sup =>
                sup.nombre?.toLowerCase().includes(term) ||
                sup.contacto?.toLowerCase().includes(term) ||
                sup.telefono?.includes(term)
            );
        }

        filtered.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        set({ filteredSuppliers: filtered });
    },

    selectSupplier: (id) => {
        const supplier = get().suppliers.find(sup => sup.id === id);
        set({ selectedSupplier: supplier });
    },

    clearSelection: () => set({ selectedSupplier: null }),

    getById: (id) => get().suppliers.find(sup => sup.id === id),

    clearError: () => set({ error: null }),

    reset: () => set({
        suppliers: [],
        filteredSuppliers: [],
        selectedSupplier: null,
        isLoading: false,
        error: null,
        searchTerm: ''
    })
}));

// Exports
export const getSuppliers = () => supplierStore.getState().suppliers;
export const getSupplierById = (id) => supplierStore.getState().getById(id);
export const subscribeToSuppliers = (callback) => supplierStore.subscribe(callback);

if (typeof window !== 'undefined') {
    window.supplierStore = supplierStore;
}

export default supplierStore;
