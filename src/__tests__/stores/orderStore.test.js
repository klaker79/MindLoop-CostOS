/**
 * orderStore.test.js — P0+P1
 * Tests for applyFilters (dual supplier field names), markAsReceived, CRUD
 */
import { jest } from '@jest/globals';

let orderStore;
let mockApiClient;

beforeAll(async () => {
    mockApiClient = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn()
    };
    jest.unstable_mockModule('../../api/client.js', () => ({
        apiClient: mockApiClient,
        default: mockApiClient
    }));
    const mod = await import('../../stores/orderStore.js');
    orderStore = mod.orderStore;
});

beforeEach(() => {
    orderStore.getState().reset();
    jest.clearAllMocks();
});

// ═══════════════════════════════════════════════
// applyFilters — dual supplier field names
// ═══════════════════════════════════════════════
describe('applyFilters — dual supplier field names', () => {
    test('supplierFilter=10 with camelCase proveedorId → included', () => {
        orderStore.getState().setOrders([
            { id: 1, proveedorId: 10, estado: 'pendiente', fecha: '2026-01-01' }
        ]);
        orderStore.getState().setSupplierFilter(10);
        expect(orderStore.getState().filteredOrders).toHaveLength(1);
    });

    test('supplierFilter=10 with snake_case proveedor_id → included', () => {
        orderStore.getState().setOrders([
            { id: 1, proveedor_id: 10, estado: 'pendiente', fecha: '2026-01-01' }
        ]);
        orderStore.getState().setSupplierFilter(10);
        expect(orderStore.getState().filteredOrders).toHaveLength(1);
    });

    test('supplierFilter=10 → both camel and snake included, different excluded', () => {
        orderStore.getState().setOrders([
            { id: 1, proveedorId: 10, estado: 'pendiente', fecha: '2026-01-01' },
            { id: 2, proveedor_id: 10, estado: 'pendiente', fecha: '2026-01-02' },
            { id: 3, proveedorId: 20, estado: 'pendiente', fecha: '2026-01-03' }
        ]);
        orderStore.getState().setSupplierFilter(10);
        expect(orderStore.getState().filteredOrders).toHaveLength(2);
    });

    test('supplierFilter=null → all orders returned', () => {
        orderStore.getState().setOrders([
            { id: 1, proveedorId: 10, estado: 'pendiente', fecha: '2026-01-01' },
            { id: 2, proveedor_id: 20, estado: 'pendiente', fecha: '2026-01-02' }
        ]);
        orderStore.getState().setSupplierFilter(null);
        expect(orderStore.getState().filteredOrders).toHaveLength(2);
    });
});

// ═══════════════════════════════════════════════
// applyFilters — statusFilter
// ═══════════════════════════════════════════════
describe('applyFilters — statusFilter', () => {
    const orders = [
        { id: 1, estado: 'pendiente', fecha: '2026-01-01' },
        { id: 2, estado: 'recibido', fecha: '2026-01-02' },
        { id: 3, estado: 'pendiente', fecha: '2026-01-03' }
    ];

    beforeEach(() => { orderStore.getState().setOrders(orders); });

    test("statusFilter='pendiente' → only pending", () => {
        orderStore.getState().setStatusFilter('pendiente');
        expect(orderStore.getState().filteredOrders).toHaveLength(2);
    });

    test("statusFilter='recibido' → only received", () => {
        orderStore.getState().setStatusFilter('recibido');
        expect(orderStore.getState().filteredOrders).toHaveLength(1);
    });

    test("statusFilter='all' → all orders", () => {
        orderStore.getState().setStatusFilter('all');
        expect(orderStore.getState().filteredOrders).toHaveLength(3);
    });
});

// ═══════════════════════════════════════════════
// applyFilters — searchTerm
// ═══════════════════════════════════════════════
describe('applyFilters — searchTerm', () => {
    const orders = [
        { id: 1, estado: 'pendiente', fecha: '2026-01-01' },
        { id: 2, estado: 'recibido', fecha: '2026-01-02' },
        { id: 13, estado: 'pendiente', fecha: '2026-01-03' }
    ];

    beforeEach(() => { orderStore.getState().setOrders(orders); });

    test("searchTerm='1' matches id containing '1'", () => {
        orderStore.getState().setSearchTerm('1');
        const f = orderStore.getState().filteredOrders;
        expect(f.length).toBeGreaterThanOrEqual(2); // id=1, id=13
    });

    test("searchTerm='pend' matches estado='pendiente'", () => {
        orderStore.getState().setSearchTerm('pend');
        expect(orderStore.getState().filteredOrders).toHaveLength(2);
    });

    test('empty searchTerm → all returned', () => {
        orderStore.getState().setSearchTerm('');
        expect(orderStore.getState().filteredOrders).toHaveLength(3);
    });
});

// ═══════════════════════════════════════════════
// applyFilters — sorting
// ═══════════════════════════════════════════════
describe('applyFilters — sorting', () => {
    const orders = [
        { id: 1, estado: 'pendiente', fecha: '2026-01-15' },
        { id: 2, estado: 'recibido', fecha: '2026-01-10' },
        { id: 3, estado: 'pendiente', fecha: '2026-01-20' }
    ];

    beforeEach(() => { orderStore.getState().setOrders(orders); });

    test('sortOrder=desc (default) → newest first', () => {
        const f = orderStore.getState().filteredOrders;
        expect(f[0].id).toBe(3);
        expect(f[2].id).toBe(2);
    });

    test('sortOrder=asc → oldest first', () => {
        orderStore.getState().setSorting('fecha', 'asc');
        const f = orderStore.getState().filteredOrders;
        expect(f[0].id).toBe(2);
        expect(f[2].id).toBe(3);
    });
});

// ═══════════════════════════════════════════════
// markAsReceived
// ═══════════════════════════════════════════════
describe('markAsReceived', () => {
    test('valid order → calls updateOrder with estado=recibido', async () => {
        orderStore.getState().setOrders([
            { id: 1, estado: 'pendiente', total: 100, fecha: '2026-01-01' }
        ]);
        mockApiClient.put.mockResolvedValue({ id: 1, estado: 'recibido' });
        const result = await orderStore.getState().markAsReceived(1, { observaciones: 'OK' });
        expect(result.success).toBe(true);
        expect(mockApiClient.put).toHaveBeenCalledWith('/orders/1', expect.objectContaining({
            estado: 'recibido'
        }));
    });

    test('invalid id → {success:false}', async () => {
        const result = await orderStore.getState().markAsReceived(999, {});
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════
// computed
// ═══════════════════════════════════════════════
describe('computed', () => {
    test('getPendingOrders → only pending', () => {
        orderStore.getState().setOrders([
            { id: 1, estado: 'pendiente' },
            { id: 2, estado: 'recibido' },
            { id: 3, estado: 'pendiente' }
        ]);
        expect(orderStore.getState().getPendingOrders()).toHaveLength(2);
    });

    test('getReceivedOrders → only received', () => {
        orderStore.getState().setOrders([
            { id: 1, estado: 'pendiente' },
            { id: 2, estado: 'recibido' }
        ]);
        expect(orderStore.getState().getReceivedOrders()).toHaveLength(1);
    });

    test('getTotalPending → sums pending totals', () => {
        orderStore.getState().setOrders([
            { id: 1, estado: 'pendiente', total: 100 },
            { id: 2, estado: 'pendiente', total: 50 },
            { id: 3, estado: 'recibido', total: 200 }
        ]);
        expect(orderStore.getState().getTotalPending()).toBeCloseTo(150);
    });
});

// ═══════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════
describe('CRUD', () => {
    test('createOrder → post + appended', async () => {
        const newOrder = { id: 99, estado: 'pendiente', total: 50 };
        mockApiClient.post.mockResolvedValue(newOrder);
        const result = await orderStore.getState().createOrder({ total: 50 });
        expect(result.success).toBe(true);
        expect(orderStore.getState().orders).toContainEqual(newOrder);
    });

    test('updateOrder → put + replaced', async () => {
        orderStore.getState().setOrders([{ id: 1, estado: 'pendiente', total: 50 }]);
        mockApiClient.put.mockResolvedValue({ id: 1, estado: 'recibido', total: 50 });
        await orderStore.getState().updateOrder(1, { estado: 'recibido' });
        expect(orderStore.getState().orders[0].estado).toBe('recibido');
    });

    test('deleteOrder → delete + removed', async () => {
        orderStore.getState().setOrders([{ id: 1 }, { id: 2 }]);
        mockApiClient.delete.mockResolvedValue({});
        await orderStore.getState().deleteOrder(1);
        expect(orderStore.getState().orders).toHaveLength(1);
    });

    test('fetchOrders → populates state', async () => {
        mockApiClient.get.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        await orderStore.getState().fetchOrders();
        expect(orderStore.getState().orders).toHaveLength(2);
    });

    test('fetchOrders failure → error stored', async () => {
        mockApiClient.get.mockRejectedValue(new Error('Timeout'));
        await orderStore.getState().fetchOrders();
        expect(orderStore.getState().error).toBe('Timeout');
    });
});
