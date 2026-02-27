/**
 * Módulo de exportación a Excel
 * Extraído de app-core.js
 * @module modules/export/excel-export
 */

import { loadXLSX } from '../../utils/lazy-vendors.js';
import { t } from '@/i18n/index.js';

/**
 * Exporta datos a archivo Excel
 * @param {Array<Object>} data - Datos a exportar
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {Object} options - Opciones de formato
 */
export async function exportToExcel(data, filename, options = {}) {
    // Cargar XLSX bajo demanda
    await loadXLSX();
    const XLSX = window.XLSX;
    const {
        sheetName = t('export:excel_sheet_data'),
        headers = null,
        columnWidths = null
    } = options;

    // Crear workbook
    const wb = XLSX.utils.book_new();

    let ws;
    if (!data || !data.length) {
        // Export empty template with headers only
        ws = XLSX.utils.aoa_to_sheet([headers || []]);
    } else {
        // Crear worksheet desde datos
        ws = XLSX.utils.json_to_sheet(data, { header: headers });
    }

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
export async function exportIngredientesToExcel(ingredientes) {
    const data = ingredientes.map(ing => ({
        [t('export:excel_col_name')]: ing.nombre,
        [t('export:excel_col_family')]: ing.familia_nombre || t('export:excel_default_no_family'),
        [t('export:excel_col_price_kg')]: ing.precio_kg?.toFixed(2) || '0.00',
        [t('export:excel_col_stock_actual')]: ing.stock_actual?.toFixed(2) || '0.00',
        [t('export:excel_col_stock_min')]: ing.stock_minimo?.toFixed(2) || '0.00',
        [t('export:excel_col_unit')]: ing.unidad || 'kg',
        [t('export:excel_col_supplier')]: ing.proveedor_nombre || t('export:excel_default_no_supplier')
    }));

    await exportToExcel(data, `ingredientes_${new Date().toISOString().split('T')[0]}`, {
        sheetName: t('export:excel_sheet_ingredients'),
        columnWidths: [30, 20, 12, 12, 12, 10, 25]
    });
}

/**
 * Exporta recetas a Excel con formato
 * @param {Array} recetas
 */
export async function exportRecipesToExcel(recetas) {
    const data = recetas.map(rec => ({
        [t('export:excel_col_name')]: rec.nombre,
        [t('export:excel_col_category')]: rec.categoria_nombre || t('export:excel_default_no_category'),
        [t('export:excel_col_sale_price')]: rec.precio_venta?.toFixed(2) || '0.00',
        [t('export:excel_col_cost')]: rec.coste_calculado?.toFixed(2) || 'N/A',
        [t('export:excel_col_margin_pct')]: rec.margen_porcentaje?.toFixed(1) || 'N/A',
        [t('export:excel_col_food_cost_pct')]: rec.food_cost?.toFixed(1) || 'N/A',
        [t('export:excel_col_portions')]: rec.raciones || 1
    }));

    await exportToExcel(data, `recetas_${new Date().toISOString().split('T')[0]}`, {
        sheetName: t('export:excel_sheet_recipes'),
        columnWidths: [35, 20, 12, 12, 12, 12, 10]
    });
}

export default {
    exportToExcel,
    exportIngredientesToExcel,
    exportRecipesToExcel
};
