/**
 * ingredientStore.test.js — P0
 * Tests for totalValue (C1 fix), lowStockItems (B2 fix), filters, CRUD
 */
import { jest } from '@jest/globals';

let ingredientStore;
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
    const mod = await import('../../stores/ingredientStore.js');
    ingredientStore = mod.ingredientStore;
});

beforeEach(() => {
    ingredientStore.getState().reset();
    jest.clearAllMocks();
});

// ═══════════════════════════════════════════════
// totalValue — C1 bug fix
// Formula: (precio / cantidad_por_formato) * stock_actual
// ═══════════════════════════════════════════════
describe('totalValue — C1 bug fix', () => {
    test('basic: precio=10, cpf=2, stock=5 → 25', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Test', precio: 10, cantidad_por_formato: 2, stock_actual: 5 }
        ]);
        expect(ingredientStore.getState().totalValue()).toBeCloseTo(25.0);
    });

    test('real data: aceite 5L, precio=30, cpf=6, stock=10 → 50', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Aceite 5L', precio: 30, cantidad_por_formato: 6, stock_actual: 10 }
        ]);
        expect(ingredientStore.getState().totalValue()).toBeCloseTo(50.0);
    });

    test('zero price → 0', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Free', precio: 0, cantidad_por_formato: 1, stock_actual: 100 }
        ]);
        expect(ingredientStore.getState().totalValue()).toBe(0);
    });

    test('cpf=0 fallback to 1 → precio * stock', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Item', precio: 10, cantidad_por_formato: 0, stock_actual: 5 }
        ]);
        // cpf=0 → parseFloat(0) || 1 = 1 → precio/1 * stock = 50
        expect(ingredientStore.getState().totalValue()).toBeCloseTo(50);
    });

    test('string stock parsed correctly', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Item', precio: 10, cantidad_por_formato: 1, stock_actual: '12.5' }
        ]);
        expect(ingredientStore.getState().totalValue()).toBeCloseTo(125);
    });

    test('multiple ingredients → correct sum', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'A', precio: 10, cantidad_por_formato: 2, stock_actual: 5 },  // 25
            { id: 2, nombre: 'B', precio: 20, cantidad_por_formato: 1, stock_actual: 3 },  // 60
            { id: 3, nombre: 'C', precio: 15, cantidad_por_formato: 5, stock_actual: 10 }  // 30
        ]);
        expect(ingredientStore.getState().totalValue()).toBeCloseTo(115);
    });

    test('empty array → 0', () => {
        ingredientStore.getState().setIngredients([]);
        expect(ingredientStore.getState().totalValue()).toBe(0);
    });
});

// ═══════════════════════════════════════════════
// lowStockItems — B2 bug fix
// Rule: stock_actual === null must NOT trigger alert
// ═══════════════════════════════════════════════
describe('lowStockItems — B2 bug fix', () => {
    test('stock=null → excluded (no false alarm)', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'New', stock_actual: null, stock_minimo: 5 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(0);
    });

    test('stock=undefined → excluded', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'New', stock_minimo: 5 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(0);
    });

    test('stock=0, min=5 → included', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Empty', stock_actual: 0, stock_minimo: 5 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(1);
    });

    test('stock=4, min=5 → included', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Low', stock_actual: 4, stock_minimo: 5 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(1);
    });

    test('stock=5, min=5 (boundary) → included', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Boundary', stock_actual: 5, stock_minimo: 5 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(1);
    });

    test('stock=6, min=5 → excluded', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'OK', stock_actual: 6, stock_minimo: 5 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(0);
    });

    test('min=0 (no minimum set) → excluded', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'NoMin', stock_actual: 0, stock_minimo: 0 }
        ]);
        expect(ingredientStore.getState().lowStockItems()).toHaveLength(0);
    });

    test('mixed array → correct subset', () => {
        ingredientStore.getState().setIngredients([
            { id: 1, nombre: 'Low', stock_actual: 2, stock_minimo: 5 },     // yes
            { id: 2, nombre: 'OK', stock_actual: 10, stock_minimo: 5 },     // no
            { id: 3, nombre: 'Null', stock_actual: null, stock_minimo: 5 }, // no
            { id: 4, nombre: 'Zero', stock_actual: 0, stock_minimo: 3 }     // yes
        ]);
        const low = ingredientStore.getState().lowStockItems();
        expect(low).toHaveLength(2);
        expect(low.map(i => i.id)).toEqual(expect.arrayContaining([1, 4]));
    });
});

// ═══════════════════════════════════════════════
// applyFilters
// ═══════════════════════════════════════════════
describe('applyFilters', () => {
    const testData = [
        { id: 1, nombre: 'Tomate Triturado', familia: 'verduras', precio: 2 },
        { id: 2, nombre: 'Leche Entera', familia: 'lácteos', precio: 1.2 },
        { id: 3, nombre: 'Aceite Oliva', familia: 'aceites', precio: 8 }
    ];

    beforeEach(() => {
        ingredientStore.getState().setIngredients(testData);
    });

    test('search by nombre: tomate', () => {
        ingredientStore.getState().setSearchTerm('tomate');
        const filtered = ingredientStore.getState().filteredIngredients;
        expect(filtered).toHaveLength(1);
        expect(filtered[0].nombre).toBe('Tomate Triturado');
    });

    test('search by familia: láct', () => {
        ingredientStore.getState().setSearchTerm('láct');
        const filtered = ingredientStore.getState().filteredIngredients;
        expect(filtered).toHaveLength(1);
        expect(filtered[0].familia).toBe('lácteos');
    });

    test('search no match: xyz', () => {
        ingredientStore.getState().setSearchTerm('xyz');
        expect(ingredientStore.getState().filteredIngredients).toHaveLength(0);
    });

    test('family filter: verduras', () => {
        ingredientStore.getState().setFamilyFilter('verduras');
        const filtered = ingredientStore.getState().filteredIngredients;
        expect(filtered).toHaveLength(1);
        expect(filtered[0].nombre).toBe('Tomate Triturado');
    });

    test('family=all → all returned', () => {
        ingredientStore.getState().setFamilyFilter('all');
        expect(ingredientStore.getState().filteredIngredients).toHaveLength(3);
    });

    test('sort nombre asc → A→Z', () => {
        ingredientStore.getState().setSorting('nombre', 'asc');
        const names = ingredientStore.getState().filteredIngredients.map(i => i.nombre);
        expect(names).toEqual(['Aceite Oliva', 'Leche Entera', 'Tomate Triturado']);
    });

    test('sort precio desc → high→low', () => {
        ingredientStore.getState().setSorting('precio', 'desc');
        const prices = ingredientStore.getState().filteredIngredients.map(i => i.precio);
        expect(prices).toEqual([8, 2, 1.2]);
    });
});

// ═══════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════
describe('CRUD', () => {
    test('createIngredient success', async () => {
        const newIng = { id: 99, nombre: 'Nuevo' };
        mockApiClient.post.mockResolvedValue(newIng);
        const result = await ingredientStore.getState().createIngredient({ nombre: 'Nuevo' });
        expect(result.success).toBe(true);
        expect(ingredientStore.getState().ingredients).toContainEqual(newIng);
    });

    test('createIngredient failure → error set', async () => {
        mockApiClient.post.mockRejectedValue(new Error('Duplicate'));
        const result = await ingredientStore.getState().createIngredient({ nombre: 'Dup' });
        expect(result.success).toBe(false);
        expect(ingredientStore.getState().error).toBe('Duplicate');
        expect(ingredientStore.getState().isLoading).toBe(false);
    });

    test('updateIngredient success', async () => {
        ingredientStore.getState().setIngredients([{ id: 1, nombre: 'Old' }]);
        mockApiClient.put.mockResolvedValue({ id: 1, nombre: 'Updated' });
        await ingredientStore.getState().updateIngredient(1, { nombre: 'Updated' });
        expect(ingredientStore.getState().ingredients[0].nombre).toBe('Updated');
    });

    test('deleteIngredient success', async () => {
        ingredientStore.getState().setIngredients([{ id: 1, nombre: 'Del' }, { id: 2, nombre: 'Keep' }]);
        mockApiClient.delete.mockResolvedValue({});
        await ingredientStore.getState().deleteIngredient(1);
        expect(ingredientStore.getState().ingredients).toHaveLength(1);
        expect(ingredientStore.getState().ingredients[0].id).toBe(2);
    });

    test('fetchIngredients success', async () => {
        mockApiClient.get.mockResolvedValue([{ id: 1, nombre: 'A' }, { id: 2, nombre: 'B' }]);
        await ingredientStore.getState().fetchIngredients();
        expect(ingredientStore.getState().ingredients).toHaveLength(2);
    });

    test('fetchIngredients non-array → coerced to []', async () => {
        mockApiClient.get.mockResolvedValue({});
        await ingredientStore.getState().fetchIngredients();
        expect(ingredientStore.getState().ingredients).toEqual([]);
    });
});
