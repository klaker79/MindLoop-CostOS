/**
 * recipeStore.test.js — P1
 * Tests for filters (nombre/codigo/categoria), sorting, CRUD
 */
import { jest } from '@jest/globals';

let recipeStore;
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
    const mod = await import('../../stores/recipeStore.js');
    recipeStore = mod.recipeStore;
});

beforeEach(() => {
    recipeStore.getState().reset();
    jest.clearAllMocks();
});

const testRecipes = [
    { id: 1, nombre: 'Tortilla Española', codigo: 'TORT-001', categoria: 'entrantes', precio_venta: 12 },
    { id: 2, nombre: 'Pulpo a la Gallega', codigo: 'PUL-002', categoria: 'principales', precio_venta: 22 },
    { id: 3, nombre: 'Crema Catalana', codigo: 'CREM-003', categoria: 'postres', precio_venta: 8 }
];

// ═══════════════════════════════════════════════
// applyFilters — search
// ═══════════════════════════════════════════════
describe('applyFilters — search', () => {
    beforeEach(() => { recipeStore.getState().setRecipes(testRecipes); });

    test("search by nombre: 'tortilla'", () => {
        recipeStore.getState().setSearchTerm('tortilla');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(1);
        expect(recipeStore.getState().filteredRecipes[0].nombre).toBe('Tortilla Española');
    });

    test("search by codigo: 'PUL'", () => {
        recipeStore.getState().setSearchTerm('PUL');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(1);
        expect(recipeStore.getState().filteredRecipes[0].codigo).toBe('PUL-002');
    });

    test('search no match → empty', () => {
        recipeStore.getState().setSearchTerm('xyz');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(0);
    });

    test('empty searchTerm → all returned', () => {
        recipeStore.getState().setSearchTerm('');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(3);
    });
});

// ═══════════════════════════════════════════════
// applyFilters — category
// ═══════════════════════════════════════════════
describe('applyFilters — category', () => {
    beforeEach(() => { recipeStore.getState().setRecipes(testRecipes); });

    test("categoryFilter='entrantes' → 1", () => {
        recipeStore.getState().setCategoryFilter('entrantes');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(1);
    });

    test("categoryFilter='all' → all", () => {
        recipeStore.getState().setCategoryFilter('all');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(3);
    });

    test('case insensitive: Postres = postres', () => {
        recipeStore.getState().setCategoryFilter('Postres');
        expect(recipeStore.getState().filteredRecipes).toHaveLength(1);
    });
});

// ═══════════════════════════════════════════════
// applyFilters — sorting
// ═══════════════════════════════════════════════
describe('applyFilters — sorting', () => {
    beforeEach(() => { recipeStore.getState().setRecipes(testRecipes); });

    test('sort nombre asc → A→Z', () => {
        recipeStore.getState().setSorting('nombre', 'asc');
        const names = recipeStore.getState().filteredRecipes.map(r => r.nombre);
        expect(names).toEqual(['Crema Catalana', 'Pulpo a la Gallega', 'Tortilla Española']);
    });

    test('sort precio_venta desc → high→low', () => {
        recipeStore.getState().setSorting('precio_venta', 'desc');
        const prices = recipeStore.getState().filteredRecipes.map(r => r.precio_venta);
        expect(prices).toEqual([22, 12, 8]);
    });
});

// ═══════════════════════════════════════════════
// Selection
// ═══════════════════════════════════════════════
describe('selection', () => {
    test('selectRecipe → sets selectedRecipe', () => {
        recipeStore.getState().setRecipes(testRecipes);
        recipeStore.getState().selectRecipe(2);
        expect(recipeStore.getState().selectedRecipe.nombre).toBe('Pulpo a la Gallega');
    });

    test('clearSelection → null', () => {
        recipeStore.getState().setRecipes(testRecipes);
        recipeStore.getState().selectRecipe(1);
        recipeStore.getState().clearSelection();
        expect(recipeStore.getState().selectedRecipe).toBeNull();
    });

    test('getById → correct recipe', () => {
        recipeStore.getState().setRecipes(testRecipes);
        expect(recipeStore.getState().getById(3).nombre).toBe('Crema Catalana');
    });
});

// ═══════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════
describe('CRUD', () => {
    test('createRecipe → post + appended', async () => {
        const newRecipe = { id: 99, nombre: 'Nueva' };
        mockApiClient.post.mockResolvedValue(newRecipe);
        const result = await recipeStore.getState().createRecipe({ nombre: 'Nueva' });
        expect(result.success).toBe(true);
        expect(recipeStore.getState().recipes).toContainEqual(newRecipe);
    });

    test('createRecipe failure → error stored', async () => {
        mockApiClient.post.mockRejectedValue(new Error('Validation'));
        const result = await recipeStore.getState().createRecipe({ nombre: '' });
        expect(result.success).toBe(false);
        expect(recipeStore.getState().error).toBe('Validation');
    });

    test('updateRecipe → put + replaced', async () => {
        recipeStore.getState().setRecipes([{ id: 1, nombre: 'Old' }]);
        mockApiClient.put.mockResolvedValue({ id: 1, nombre: 'Updated' });
        await recipeStore.getState().updateRecipe(1, { nombre: 'Updated' });
        expect(recipeStore.getState().recipes[0].nombre).toBe('Updated');
    });

    test('deleteRecipe → delete + removed', async () => {
        recipeStore.getState().setRecipes([{ id: 1 }, { id: 2 }]);
        mockApiClient.delete.mockResolvedValue({});
        await recipeStore.getState().deleteRecipe(1);
        expect(recipeStore.getState().recipes).toHaveLength(1);
    });

    test('fetchRecipes → populates state', async () => {
        mockApiClient.get.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        await recipeStore.getState().fetchRecipes();
        expect(recipeStore.getState().recipes).toHaveLength(2);
    });

    test('fetchRecipes failure → error', async () => {
        mockApiClient.get.mockRejectedValue(new Error('500'));
        await recipeStore.getState().fetchRecipes();
        expect(recipeStore.getState().error).toBe('500');
    });
});
