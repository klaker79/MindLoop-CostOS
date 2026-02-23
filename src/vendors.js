/**
 * Vendors - Lazy loading (no se cargan hasta que se necesitan)
 * Ver src/utils/lazy-vendors.js para los loaders
 * 
 * ANTES: Chart.js + jsPDF + XLSX se importaban aquí y añadían ~985 KB al bundle inicial
 * AHORA: Se cargan bajo demanda cuando el usuario accede a gráficos, exporta PDF o exporta Excel
 */

// No eager imports — vendors load on demand via lazy-vendors.js
console.log('📦 Vendors: lazy loading habilitado (Chart.js, jsPDF, XLSX se cargan bajo demanda)');
