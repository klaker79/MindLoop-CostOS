/**
 * saleStore.test.js — P0
 * Tests for getTodayRevenue, filters, CRUD
 */
import { jest } from '@jest/globals';

let saleStore;
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
    const mod = await import('../../stores/saleStore.js');
    saleStore = mod.saleStore;
});

beforeEach(() => {
    saleStore.getState().reset();
    jest.clearAllMocks();
});

// ═══════════════════════════════════════════════
// getTodayRevenue
// ═══════════════════════════════════════════════
describe('getTodayRevenue', () => {
    function todayISO() { return new Date().toISOString(); }
    function yesterdayISO() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString();
    }

    test('no sales → 0', () => {
        expect(saleStore.getState().getTodayRevenue()).toBe(0);
    });

    test('only today sales → sum of totals', () => {
        saleStore.getState().setSales([
            { id: 1, fecha: todayISO(), total: 25.50 },
            { id: 2, fecha: todayISO(), total: 30 }
        ]);
        expect(saleStore.getState().getTodayRevenue()).toBeCloseTo(55.50);
    });

    test('mixed today + old → only today summed', () => {
        saleStore.getState().setSales([
            { id: 1, fecha: todayISO(), total: 25 },
            { id: 2, fecha: todayISO(), total: 30 },
            { id: 3, fecha: yesterdayISO(), total: 100 }
        ]);
        expect(saleStore.getState().getTodayRevenue()).toBeCloseTo(55);
    });

    test('total as string → parsed correctly', () => {
        saleStore.getState().setSales([
            { id: 1, fecha: todayISO(), total: '25.50' }
        ]);
        expect(saleStore.getState().getTodayRevenue()).toBeCloseTo(25.50);
    });
});

// ═══════════════════════════════════════════════
// applyFilters
// ═══════════════════════════════════════════════
describe('applyFilters', () => {
    const testSales = [
        { id: 1, fecha: '2026-01-10', total: 10, receta_id: 5 },
        { id: 2, fecha: '2026-01-15', total: 20, receta_id: 5 },
        { id: 3, fecha: '2026-01-20', total: 30, receta_id: 10 },
        { id: 4, fecha: '2026-01-25', total: 40, receta_id: 10 }
    ];

    beforeEach(() => {
        saleStore.getState().setSales(testSales);
    });

    test('dateFrom only → older excluded', () => {
        saleStore.getState().setDateRange('2026-01-15', null);
        const filtered = saleStore.getState().filteredSales;
        expect(filtered.every(s => new Date(s.fecha) >= new Date('2026-01-15'))).toBe(true);
    });

    test('dateTo only → newer excluded', () => {
        saleStore.getState().setDateRange(null, '2026-01-15');
        const filtered = saleStore.getState().filteredSales;
        expect(filtered.every(s => new Date(s.fecha) <= new Date('2026-01-15'))).toBe(true);
    });

    test('both dates → within range only', () => {
        saleStore.getState().setDateRange('2026-01-15', '2026-01-20');
        const filtered = saleStore.getState().filteredSales;
        expect(filtered.length).toBe(2);
    });

    test('recipeFilter → only matching', () => {
        saleStore.getState().setRecipeFilter(5);
        const filtered = saleStore.getState().filteredSales;
        expect(filtered.every(s => s.receta_id === 5)).toBe(true);
        expect(filtered).toHaveLength(2);
    });

    test('no filters → all, sorted desc by fecha', () => {
        const filtered = saleStore.getState().filteredSales;
        expect(filtered).toHaveLength(4);
        // Should be sorted newest first
        expect(filtered[0].id).toBe(4);
        expect(filtered[3].id).toBe(1);
    });
});

// ═══════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════
describe('CRUD', () => {
    test('createSale → post + appended', async () => {
        const newSale = { id: 99, fecha: '2026-01-01', total: 50 };
        mockApiClient.post.mockResolvedValue(newSale);
        const result = await saleStore.getState().createSale({ total: 50 });
        expect(result.success).toBe(true);
        expect(saleStore.getState().sales).toContainEqual(newSale);
    });

    test('createBulkSales → calls /sales/bulk, refreshes', async () => {
        mockApiClient.post.mockResolvedValueOnce({ count: 3 });
        mockApiClient.get.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);
        const result = await saleStore.getState().createBulkSales([{}, {}, {}]);
        expect(result.success).toBe(true);
        expect(mockApiClient.post).toHaveBeenCalledWith('/sales/bulk', [{}, {}, {}]);
    });

    test('deleteSale → removed from state', async () => {
        saleStore.getState().setSales([{ id: 1, total: 10 }, { id: 2, total: 20 }]);
        mockApiClient.delete.mockResolvedValue({});
        await saleStore.getState().deleteSale(1);
        expect(saleStore.getState().sales).toHaveLength(1);
        expect(saleStore.getState().sales[0].id).toBe(2);
    });

    test('fetchSales success → sales set', async () => {
        mockApiClient.get.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        await saleStore.getState().fetchSales();
        expect(saleStore.getState().sales).toHaveLength(2);
    });

    test('fetchSales failure → error stored', async () => {
        mockApiClient.get.mockRejectedValue(new Error('Network'));
        await saleStore.getState().fetchSales();
        expect(saleStore.getState().error).toBe('Network');
        expect(saleStore.getState().isLoading).toBe(false);
    });
});
