/**
 * @jest-environment node
 * 
 * API Surface Contract Test
 * ==========================
 * Ensures ALL critical functions exist in the api export from client.js.
 * If any function is accidentally removed or renamed, this test will fail.
 * 
 * This was created after a P0 bug where adjustStock/bulkAdjustStock were missing
 * from client.js, causing "Confirmar Recepción" to break completely.
 */

// We can't import the full client (it uses window/fetch), so we test the api object shape
// by reading the source and verifying function names exist as exports.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(
    resolve(__dirname, '../../api/client.js'),
    'utf-8'
);

describe('API Client Surface Contract', () => {

    // ═══════════════════════════════════════════════════
    // CRITICAL: These functions MUST exist in client.js
    // Adding a function here = permanent guard against removal
    // ═══════════════════════════════════════════════════

    const CRITICAL_API_FUNCTIONS = [
        // 🔒 ATOMIC STOCK — P0 bug if missing (Confirmar Recepción breaks)
        'adjustStock',
        'bulkAdjustStock',

        // Ingredientes
        'getIngredientes',
        'getIngrediente',
        'createIngrediente',
        'updateIngrediente',
        'deleteIngrediente',

        // Recetas
        'getRecetas',
        'getReceta',
        'createReceta',
        'updateReceta',
        'deleteReceta',

        // Pedidos
        'getPedidos',
        'getPedido',
        'createPedido',
        'updatePedido',
        'deletePedido',

        // Proveedores
        'getProveedores',
        'getProveedor',
        'createProveedor',
        'updateProveedor',
        'deleteProveedor',

        // Sales
        'getSales',
        'createSale',
        'createBulkSales',
        'deleteSale',

        // Team
        'getEmpleados',
        'getHorarios',

        // Inventory
        'getInventario',
        'updateStock',

        // Auth
        'login',
        'logout',
        'checkAuth',
    ];

    test.each(CRITICAL_API_FUNCTIONS)(
        '✅ api.%s must be defined in client.js',
        (fnName) => {
            // Check that the function name appears as a key in the api object
            const pattern = new RegExp(`\\b${fnName}\\s*[:(/]`);
            expect(clientSource).toMatch(pattern);
        }
    );

    test('api object is exposed on window for legacy compatibility', () => {
        expect(clientSource).toContain('window.api');
    });

    test('api object merges with existing window.api (not overwrites)', () => {
        // Must use spread to merge: { ...window.api, ...api }
        expect(clientSource).toContain('...window.api');
    });

    test('apiClient is exposed on window', () => {
        expect(clientSource).toContain('window.apiClient');
    });

    // Guard against specific P0 regressions
    describe('P0 Regression Guards', () => {

        test('adjustStock calls POST to /ingredients/:id/adjust-stock', () => {
            expect(clientSource).toMatch(/adjustStock.*ingredients.*adjust-stock/s);
        });

        test('bulkAdjustStock calls POST to /ingredients/bulk-adjust-stock', () => {
            expect(clientSource).toMatch(/bulkAdjustStock.*bulk-adjust-stock/s);
        });

        test('handleResponse adds .status to thrown errors (BUG-5 fix)', () => {
            expect(clientSource).toContain('error.status');
        });
    });
});
