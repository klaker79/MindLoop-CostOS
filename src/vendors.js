/**
 * Vendors - Bibliotecas externas
 * Importa y expone bibliotecas externas globalmente
 * Migrado de CDN a npm para mayor seguridad y control
 */

// Chart.js para gráficos
import Chart from 'chart.js/auto';

// XLSX para exportación a Excel
import * as XLSX from 'xlsx';

// jsPDF para generación de PDFs
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Exponer globalmente para compatibilidad con código legacy
window.Chart = Chart;
window.XLSX = XLSX;
window.jsPDF = jsPDF;

console.log('📦 Vendors cargados desde npm (no CDN)');
