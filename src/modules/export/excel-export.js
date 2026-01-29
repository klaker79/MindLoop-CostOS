/**
 * Módulo de exportación a Excel
 * Extraído de app-core.js
 * @module modules/export/excel-export
 */

import * as XLSX from 'xlsx-js-style';

/**
 * Exporta datos a archivo Excel
 * @param {Array<Object>} data - Datos a exportar
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {Object} options - Opciones de formato
 */
export function exportToExcel(data, filename, options = {}) {
    if (!data || !data.length) {
        console.warn('exportToExcel: No hay datos para exportar');
        return;
    }

    const {
        sheetName = 'Datos',
        headers = null,
        columnWidths = null
    } = options;

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Crear worksheet desde datos
    const ws = XLSX.utils.json_to_sheet(data, {
        header: headers
    });

    // Aplicar anchos de columna si se especifican
    if (columnWidths) {
        ws['!cols'] = columnWidths.map(w => ({ wch: w }));
    }

    // Añadir worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generar archivo y descargar
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exporta ingredientes a Excel con formato
 * @param {Array} ingredientes
 */
export function exportIngredientesToExcel(ingredientes) {
    const data = ingredientes.map(ing => ({
        'Nombre': ing.nombre,
        'Familia': ing.familia_nombre || 'Sin familia',
        'Precio/kg': ing.precio_kg?.toFixed(2) || '0.00',
        'Stock Actual': ing.stock_actual?.toFixed(2) || '0.00',
        'Stock Mínimo': ing.stock_minimo?.toFixed(2) || '0.00',
        'Unidad': ing.unidad || 'kg',
        'Proveedor': ing.proveedor_nombre || 'Sin proveedor'
    }));

    exportToExcel(data, `ingredientes_${new Date().toISOString().split('T')[0]}`, {
        sheetName: 'Ingredientes',
        columnWidths: [30, 20, 12, 12, 12, 10, 25]
    });
}

/**
 * Exporta recetas a Excel con formato
 * @param {Array} recetas
 */
export function exportRecipesToExcel(recetas) {
    const data = recetas.map(rec => ({
        'Nombre': rec.nombre,
        'Categoría': rec.categoria_nombre || 'Sin categoría',
        'Precio Venta': rec.precio_venta?.toFixed(2) || '0.00',
        'Coste': rec.coste_calculado?.toFixed(2) || 'N/A',
        'Margen %': rec.margen_porcentaje?.toFixed(1) || 'N/A',
        'Food Cost %': rec.food_cost?.toFixed(1) || 'N/A',
        'Raciones': rec.raciones || 1
    }));

    exportToExcel(data, `recetas_${new Date().toISOString().split('T')[0]}`, {
        sheetName: 'Recetas',
        columnWidths: [35, 20, 12, 12, 12, 12, 10]
    });
}

export default {
    exportToExcel,
    exportIngredientesToExcel,
    exportRecipesToExcel
};
