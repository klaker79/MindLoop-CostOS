/**
 * supplierStore.test.js — P1
 * Tests for search (nombre/contacto/telefono), sorting, CRUD
 */
import { jest } from '@jest/globals';

let supplierStore;
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
    const mod = await import('../../stores/supplierStore.js');
    supplierStore = mod.supplierStore;
});

beforeEach(() => {
    supplierStore.getState().reset();
    jest.clearAllMocks();
});

const testSuppliers = [
    { id: 1, nombre: 'Proveedor García', contacto: 'Ana López', telefono: '666123456' },
    { id: 2, nombre: 'Distribuciones Norte', contacto: 'Carlos Ruiz', telefono: '912345678' },
    { id: 3, nombre: 'Mariscos Atlántico', contacto: 'María Pérez', telefono: '666789012' }
];

// ═══════════════════════════════════════════════
// applyFilters — search
// ═══════════════════════════════════════════════
describe('applyFilters — search', () => {
    beforeEach(() => { supplierStore.getState().setSuppliers(testSuppliers); });

    test("search by nombre: 'Garcia' matches 'Proveedor García'", () => {
        supplierStore.getState().setSearchTerm('garc');
        const filtered = supplierStore.getState().filteredSuppliers;
        expect(filtered).toHaveLength(1);
        expect(filtered[0].nombre).toBe('Proveedor García');
    });

    test("search by contacto: 'Ana' matches contacto 'Ana López'", () => {
        supplierStore.getState().setSearchTerm('ana');
        const filtered = supplierStore.getState().filteredSuppliers;
        expect(filtered).toHaveLength(1);
        expect(filtered[0].contacto).toBe('Ana López');
    });

    test("search by telefono: '666' matches two", () => {
        supplierStore.getState().setSearchTerm('666');
        expect(supplierStore.getState().filteredSuppliers).toHaveLength(2);
    });

    test('search no match → empty', () => {
        supplierStore.getState().setSearchTerm('xyz');
        expect(supplierStore.getState().filteredSuppliers).toHaveLength(0);
    });

    test('empty searchTerm → all returned', () => {
        supplierStore.getState().setSearchTerm('');
        expect(supplierStore.getState().filteredSuppliers).toHaveLength(3);
    });
});

// ═══════════════════════════════════════════════
// applyFilters — sorting
// ═══════════════════════════════════════════════
describe('applyFilters — sorting', () => {
    beforeEach(() => { supplierStore.getState().setSuppliers(testSuppliers); });

    test('sort by nombre asc → A→Z', () => {
        supplierStore.getState().setSorting('nombre', 'asc');
        const names = supplierStore.getState().filteredSuppliers.map(s => s.nombre);
        expect(names).toEqual(['Distribuciones Norte', 'Mariscos Atlántico', 'Proveedor García']);
    });

    test('sort by nombre desc → Z→A', () => {
        supplierStore.getState().setSorting('nombre', 'desc');
        const names = supplierStore.getState().filteredSuppliers.map(s => s.nombre);
        expect(names).toEqual(['Proveedor García', 'Mariscos Atlántico', 'Distribuciones Norte']);
    });
});

// ═══════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════
describe('CRUD', () => {
    test('createSupplier → post + appended', async () => {
        const newSup = { id: 99, nombre: 'Nuevo' };
        mockApiClient.post.mockResolvedValue(newSup);
        const result = await supplierStore.getState().createSupplier({ nombre: 'Nuevo' });
        expect(result.success).toBe(true);
        expect(supplierStore.getState().suppliers).toContainEqual(newSup);
    });

    test('createSupplier failure → error stored', async () => {
        mockApiClient.post.mockRejectedValue(new Error('Dup'));
        const result = await supplierStore.getState().createSupplier({ nombre: 'Dup' });
        expect(result.success).toBe(false);
        expect(supplierStore.getState().error).toBe('Dup');
    });

    test('updateSupplier → put + replaced', async () => {
        supplierStore.getState().setSuppliers([{ id: 1, nombre: 'Old' }]);
        mockApiClient.put.mockResolvedValue({ id: 1, nombre: 'Updated' });
        await supplierStore.getState().updateSupplier(1, { nombre: 'Updated' });
        expect(supplierStore.getState().suppliers[0].nombre).toBe('Updated');
    });

    test('deleteSupplier → delete + removed', async () => {
        supplierStore.getState().setSuppliers([{ id: 1 }, { id: 2 }]);
        mockApiClient.delete.mockResolvedValue({});
        await supplierStore.getState().deleteSupplier(1);
        expect(supplierStore.getState().suppliers).toHaveLength(1);
    });

    test('fetchSuppliers → populates state', async () => {
        mockApiClient.get.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        await supplierStore.getState().fetchSuppliers();
        expect(supplierStore.getState().suppliers).toHaveLength(2);
    });

    test('fetchSuppliers failure → error stored', async () => {
        mockApiClient.get.mockRejectedValue(new Error('500'));
        await supplierStore.getState().fetchSuppliers();
        expect(supplierStore.getState().error).toBe('500');
    });
});

// ═══════════════════════════════════════════════
// selection
// ═══════════════════════════════════════════════
describe('selection', () => {
    test('selectSupplier → sets selectedSupplier', () => {
        supplierStore.getState().setSuppliers(testSuppliers);
        supplierStore.getState().selectSupplier(2);
        expect(supplierStore.getState().selectedSupplier.nombre).toBe('Distribuciones Norte');
    });

    test('clearSelection → null', () => {
        supplierStore.getState().setSuppliers(testSuppliers);
        supplierStore.getState().selectSupplier(1);
        supplierStore.getState().clearSelection();
        expect(supplierStore.getState().selectedSupplier).toBeNull();
    });

    test('getById → correct supplier', () => {
        supplierStore.getState().setSuppliers(testSuppliers);
        expect(supplierStore.getState().getById(3).nombre).toBe('Mariscos Atlántico');
    });
});
