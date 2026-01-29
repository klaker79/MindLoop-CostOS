/**
 * Tests para módulo de exportación Excel
 */

import { exportToExcel, exportIngredientesToExcel, exportRecipesToExcel } from '../../../src/modules/export/excel-export.js';

// Mock XLSX
jest.mock('xlsx-js-style', () => ({
    utils: {
        book_new: jest.fn(() => ({})),
        json_to_sheet: jest.fn(() => ({})),
        book_append_sheet: jest.fn()
    },
    writeFile: jest.fn()
}));

describe('excel-export module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('exportToExcel', () => {
        it('should not export when data is empty', () => {
            const XLSX = require('xlsx-js-style');
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            exportToExcel([], 'test');

            expect(XLSX.writeFile).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('exportToExcel: No hay datos para exportar');
            consoleSpy.mockRestore();
        });

        it('should not export when data is null', () => {
            const XLSX = require('xlsx-js-style');
            exportToExcel(null, 'test');
            expect(XLSX.writeFile).not.toHaveBeenCalled();
        });

        it('should export data correctly', () => {
            const XLSX = require('xlsx-js-style');
            const data = [{ name: 'Test', value: 100 }];

            exportToExcel(data, 'test-file');

            expect(XLSX.utils.book_new).toHaveBeenCalled();
            expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(data, expect.any(Object));
            expect(XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'test-file.xlsx');
        });

        it('should apply column widths when specified', () => {
            const XLSX = require('xlsx-js-style');
            const data = [{ name: 'Test' }];
            const ws = {};
            XLSX.utils.json_to_sheet.mockReturnValue(ws);

            exportToExcel(data, 'test', { columnWidths: [20, 30] });

            expect(ws['!cols']).toEqual([{ wch: 20 }, { wch: 30 }]);
        });
    });

    describe('exportIngredientesToExcel', () => {
        it('should format ingredient data correctly', () => {
            const XLSX = require('xlsx-js-style');
            const ingredientes = [{
                nombre: 'Tomate',
                familia_nombre: 'Verduras',
                precio_kg: 2.50,
                stock_actual: 10,
                stock_minimo: 5,
                unidad: 'kg',
                proveedor_nombre: 'Proveedor 1'
            }];

            exportIngredientesToExcel(ingredientes);

            expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
            expect(XLSX.writeFile).toHaveBeenCalled();

            // Verificar que el filename contiene la fecha
            const writeFileCall = XLSX.writeFile.mock.calls[0];
            expect(writeFileCall[1]).toMatch(/ingredientes_\d{4}-\d{2}-\d{2}\.xlsx/);
        });

        it('should handle missing optional fields', () => {
            const XLSX = require('xlsx-js-style');
            const ingredientes = [{
                nombre: 'Item sin datos'
            }];

            exportIngredientesToExcel(ingredientes);

            expect(XLSX.writeFile).toHaveBeenCalled();
        });
    });

    describe('exportRecipesToExcel', () => {
        it('should format recipe data correctly', () => {
            const XLSX = require('xlsx-js-style');
            const recetas = [{
                nombre: 'Paella',
                categoria_nombre: 'Arroces',
                precio_venta: 15.00,
                coste_calculado: 5.50,
                margen_porcentaje: 63.3,
                food_cost: 36.7,
                raciones: 2
            }];

            exportRecipesToExcel(recetas);

            expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
            expect(XLSX.writeFile).toHaveBeenCalled();

            const writeFileCall = XLSX.writeFile.mock.calls[0];
            expect(writeFileCall[1]).toMatch(/recetas_\d{4}-\d{2}-\d{2}\.xlsx/);
        });
    });
});
