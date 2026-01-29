/**
 * ============================================
 * stores/orderStore.js - Orders State
 * ============================================
 *
 * Gestión de estado de pedidos con Zustand.
 * Incluye: CRUD, filtros, estados de pedido.
 *
 * @author MindLoopIA
 * @version 2.0.0 - Migrado a apiClient
 */

import { createStore } from 'zustand/vanilla';
import { apiClient } from '../api/client.js';

/**
 * Order Store
 */
export const orderStore = createStore((set, get) => ({
    // State
    orders: [],
    filteredOrders: [],
    selectedOrder: null,
    isLoading: false,
    error: null,

    // Filters
    searchTerm: '',
    statusFilter: 'all', // 'all', 'pendiente', 'recibido'
    supplierFilter: null,
    sortBy: 'fecha',
    sortOrder: 'desc',

    // Actions

    // Direct setter for orders (used by legacy code sync)
    setOrders: (orders) => {
        const ordersList = Array.isArray(orders) ? orders : [];
        set({ orders: ordersList });
        get().applyFilters();

        // Sync with window for legacy compatibility
        if (typeof window !== 'undefined') {
            window.pedidos = ordersList;
        }
    },

    fetchOrders: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await apiClient.get('/api/orders');
            const orders = Array.isArray(data) ? data : [];

            set({ orders, isLoading: false });
            get().applyFilters();

            // Sync with window for legacy compatibility
            if (typeof window !== 'undefined') {
                window.pedidos = orders;
            }

            return orders;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return [];
        }
    },

    createOrder: async (orderData) => {
        set({ isLoading: true, error: null });
        try {
            const newOrder = await apiClient.post('/api/orders', orderData);

            set((state) => ({
                orders: [...state.orders, newOrder],
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.pedidos = get().orders;
            }

            return { success: true, data: newOrder };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    updateOrder: async (id, orderData) => {
        set({ isLoading: true, error: null });
        try {
            const updatedOrder = await apiClient.put(`/api/orders/${id}`, orderData);

            set((state) => ({
                orders: state.orders.map(ord =>
                    ord.id === id ? updatedOrder : ord
                ),
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.pedidos = get().orders;
            }

            return { success: true, data: updatedOrder };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    deleteOrder: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await apiClient.delete(`/api/orders/${id}`);

            set((state) => ({
                orders: state.orders.filter(ord => ord.id !== id),
                isLoading: false
            }));
            get().applyFilters();

            // Sync with window
            if (typeof window !== 'undefined') {
                window.pedidos = get().orders;
            }

            return { success: true };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    // Mark order as received
    markAsReceived: async (id, receptionData) => {
        const order = get().orders.find(o => o.id === id);
        if (!order) return { success: false, error: 'Order not found' };

        return get().updateOrder(id, {
            ...order,
            ...receptionData,
            estado: 'recibido',
            fecha_recepcion: new Date().toISOString()
        });
    },

    // Filtering
    setSearchTerm: (term) => {
        set({ searchTerm: term });
        get().applyFilters();
    },

    setStatusFilter: (status) => {
        set({ statusFilter: status });
        get().applyFilters();
    },

    setSupplierFilter: (supplierId) => {
        set({ supplierFilter: supplierId });
        get().applyFilters();
    },

    setSorting: (sortBy, sortOrder = 'desc') => {
        set({ sortBy, sortOrder });
        get().applyFilters();
    },

    applyFilters: () => {
        const { orders, searchTerm, statusFilter, supplierFilter, sortBy, sortOrder } = get();

        let filtered = [...orders];

        // Apply status filter
        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(ord => ord.estado === statusFilter);
        }

        // Apply supplier filter
        if (supplierFilter) {
            filtered = filtered.filter(ord =>
                ord.proveedorId === supplierFilter || ord.proveedor_id === supplierFilter
            );
        }

        // Apply search (by supplier name would need supplier data)
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(ord =>
                ord.id?.toString().includes(term) ||
                ord.estado?.toLowerCase().includes(term)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'fecha') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        set({ filteredOrders: filtered });
    },

    // Selection
    selectOrder: (id) => {
        const order = get().orders.find(ord => ord.id === id);
        set({ selectedOrder: order });
    },

    clearSelection: () => set({ selectedOrder: null }),

    // Computed
    getPendingOrders: () => get().orders.filter(o => o.estado === 'pendiente'),
    getReceivedOrders: () => get().orders.filter(o => o.estado === 'recibido'),
    getTotalPending: () => get().getPendingOrders().reduce((sum, o) => sum + parseFloat(o.total || 0), 0),

    // Utilities
    getById: (id) => get().orders.find(ord => ord.id === id),

    clearError: () => set({ error: null }),

    reset: () => set({
        orders: [],
        filteredOrders: [],
        selectedOrder: null,
        isLoading: false,
        error: null,
        searchTerm: '',
        statusFilter: 'all',
        supplierFilter: null
    })
}));

// Getters for external use
export const getOrders = () => orderStore.getState().orders;
export const getFilteredOrders = () => orderStore.getState().filteredOrders;
export const getOrderById = (id) => orderStore.getState().getById(id);
export const getPendingOrders = () => orderStore.getState().getPendingOrders();

// Subscribe helper
export const subscribeToOrders = (callback) => orderStore.subscribe(callback);

// Initialize window compatibility layer
if (typeof window !== 'undefined') {
    window.orderStore = orderStore;
    window.getOrders = getOrders;
}

export default orderStore;
