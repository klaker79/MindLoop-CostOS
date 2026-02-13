/**
 * @jest-environment node
 * 
 * Real Module Import Tests: api/client.js
 * ========================================
 * Actually imports apiClient and api objects from the real module.
 * Validates the shape, method signatures, and configuration.
 * 
 * Uses jest.unstable_mockModule to mock config dependencies that
 * rely on import.meta.env (unavailable in Node/Jest).
 */

import { jest } from '@jest/globals';

// Mock the config modules that use import.meta.env
jest.unstable_mockModule('../../config/constants.js', () => ({
    STOCK_WARNING_THRESHOLD: 0.2,
    COST_MULTIPLIER: 1.0,
    CACHE_TTL: { ingredients: 300000, recipes: 300000, suppliers: 600000, orders: 60000 },
    DEBOUNCE_DELAY: { SEARCH: 300, VALIDATION: 500 },
    PAGE_SIZE: 25,
}));

jest.unstable_mockModule('../../config/app-config.js', () => ({
    appConfig: {
        api: { baseUrl: 'http://localhost:3001', timeout: 30000, retries: 3, retryDelay: 1000 },
    },
    getConfig: (path, def) => def,
    setConfig: () => { },
    getApiBaseUrl: () => 'http://localhost:3001',
    getApiUrl: () => 'http://localhost:3001/api',
    getAuthUrl: () => 'http://localhost:3001/api/auth',
}));

// Dynamic import AFTER mocking
const { default: apiClient, api } = await import('../../api/client.js');

// ─── Shape Validation ─────────────────────────────────────────────

describe('api/client.js — apiClient object (real import)', () => {

    test('apiClient has get method', () => {
        expect(typeof apiClient.get).toBe('function');
    });

    test('apiClient has post method', () => {
        expect(typeof apiClient.post).toBe('function');
    });

    test('apiClient has put method', () => {
        expect(typeof apiClient.put).toBe('function');
    });

    test('apiClient has delete method', () => {
        expect(typeof apiClient.delete).toBe('function');
    });

    test('apiClient has patch method', () => {
        expect(typeof apiClient.patch).toBe('function');
    });
});

// ─── API Convenience Functions: All Domains ───────────────────────

describe('api/client.js — api object (real import)', () => {

    // Ingredientes
    test('api.getIngredientes exists', () => expect(typeof api.getIngredientes).toBe('function'));
    test('api.getIngredients exists (English)', () => expect(typeof api.getIngredients).toBe('function'));
    test('api.createIngrediente exists', () => expect(typeof api.createIngrediente).toBe('function'));
    test('api.updateIngrediente exists', () => expect(typeof api.updateIngrediente).toBe('function'));
    test('api.deleteIngrediente exists', () => expect(typeof api.deleteIngrediente).toBe('function'));
    test('api.toggleIngredientActive exists', () => expect(typeof api.toggleIngredientActive).toBe('function'));

    // Recetas
    test('api.getRecetas exists', () => expect(typeof api.getRecetas).toBe('function'));
    test('api.getRecipes exists (English)', () => expect(typeof api.getRecipes).toBe('function'));
    test('api.calculateRecipeCost exists (V2)', () => expect(typeof api.calculateRecipeCost).toBe('function'));
    test('api.recalculateAllRecipes exists (V2)', () => expect(typeof api.recalculateAllRecipes).toBe('function'));

    // Pedidos
    test('api.getPedidos exists', () => expect(typeof api.getPedidos).toBe('function'));
    test('api.getOrders exists (English)', () => expect(typeof api.getOrders).toBe('function'));

    // Proveedores
    test('api.getProveedores exists', () => expect(typeof api.getProveedores).toBe('function'));
    test('api.getSuppliers exists (English)', () => expect(typeof api.getSuppliers).toBe('function'));

    // Sales
    test('api.getSales exists', () => expect(typeof api.getSales).toBe('function'));
    test('api.bulkSales exists (legacy)', () => expect(typeof api.bulkSales).toBe('function'));

    // Inventory
    test('api.getInventario exists', () => expect(typeof api.getInventario).toBe('function'));
    test('api.getInventoryComplete exists (English)', () => expect(typeof api.getInventoryComplete).toBe('function'));

    // Atomic stock (P0 critical)
    test('api.adjustStock exists', () => expect(typeof api.adjustStock).toBe('function'));
    test('api.bulkAdjustStock exists', () => expect(typeof api.bulkAdjustStock).toBe('function'));

    // Gastos Fijos
    test('api.getGastosFijos exists', () => expect(typeof api.getGastosFijos).toBe('function'));
    test('api.createGastoFijo exists', () => expect(typeof api.createGastoFijo).toBe('function'));
    test('api.updateGastoFijo exists', () => expect(typeof api.updateGastoFijo).toBe('function'));
    test('api.deleteGastoFijo exists', () => expect(typeof api.deleteGastoFijo).toBe('function'));

    // Mermas
    test('api.getMermas exists', () => expect(typeof api.getMermas).toBe('function'));
    test('api.getMermasResumen exists', () => expect(typeof api.getMermasResumen).toBe('function'));

    // KPIs
    test('api.getDailyKPIs exists', () => expect(typeof api.getDailyKPIs).toBe('function'));
    test('api.getMonthlyKPIs exists', () => expect(typeof api.getMonthlyKPIs).toBe('function'));
    test('api.getTopRecipes exists', () => expect(typeof api.getTopRecipes).toBe('function'));

    // Alerts
    test('api.getActiveAlerts exists', () => expect(typeof api.getActiveAlerts).toBe('function'));
    test('api.acknowledgeAlert exists', () => expect(typeof api.acknowledgeAlert).toBe('function'));
    test('api.resolveAlert exists', () => expect(typeof api.resolveAlert).toBe('function'));

    // Auth
    test('api.login exists', () => expect(typeof api.login).toBe('function'));
    test('api.logout exists', () => expect(typeof api.logout).toBe('function'));
    test('api.checkAuth exists', () => expect(typeof api.checkAuth).toBe('function'));
    test('api.initAuth exists', () => expect(typeof api.initAuth).toBe('function'));
    test('api.generateAPIToken exists', () => expect(typeof api.generateAPIToken).toBe('function'));

    // Balance / Team
    test('api.getBalance exists', () => expect(typeof api.getBalance).toBe('function'));
    test('api.getTeam exists', () => expect(typeof api.getTeam).toBe('function'));

    // Raw fetch bridge
    test('api.fetch exists', () => expect(typeof api.fetch).toBe('function'));
});

// ─── Completeness Guards ──────────────────────────────────────────

describe('api/client.js — Completeness (real import)', () => {

    const WINDOW_API_METHODS = [
        // Every method that window.API shim must expose
        'getIngredients', 'getIngredientsAll', 'getRecipes', 'getSuppliers',
        'getOrders', 'getSales', 'getInventoryComplete', 'getTeam',
        'getBalance', 'getGastosFijos', 'getMermas', 'getMermasResumen',
        'createIngredient', 'updateIngredient', 'deleteIngredient',
        'toggleIngredientActive', 'createRecipe', 'updateRecipe', 'deleteRecipe',
        'createSale', 'bulkSales',
        'calculateRecipeCost', 'getRecipeCostStats', 'recalculateAllRecipes',
        'getDailyKPIs', 'getMonthlyKPIs', 'getKPIComparison', 'getTopRecipes',
        'getActiveAlerts', 'getAlertStats', 'acknowledgeAlert', 'resolveAlert',
        'login', 'logout', 'initAuth', 'generateAPIToken',
    ];

    test.each(WINDOW_API_METHODS)(
        '✅ api.%s is defined (real import)',
        (methodName) => {
            expect(api[methodName]).toBeDefined();
            expect(typeof api[methodName]).toBe('function');
        }
    );

    test('api has at least 40 methods', () => {
        const methods = Object.keys(api).filter(k => typeof api[k] === 'function');
        expect(methods.length).toBeGreaterThanOrEqual(40);
    });
});
