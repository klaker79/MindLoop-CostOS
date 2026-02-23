/**
 * Lazy Vendor Loaders — MindLoop CostOS
 * Carga asíncrona de librerías pesadas bajo demanda
 * 
 * Chart.js (~399 KB) → se carga al abrir gráficos
 * jsPDF + autotable (~336 KB) → se carga al exportar PDF
 * xlsx-js-style (~250 KB) → se carga al exportar Excel
 * 
 * @module utils/lazy-vendors
 */

// ─── Chart.js ────────────────────────────────────────────────
let chartPromise = null;

/**
 * Carga Chart.js bajo demanda (primera vez ~399 KB)
 * @returns {Promise<typeof import('chart.js/auto').default>}
 */
export async function loadChart() {
    if (window.Chart) return window.Chart;
    if (!chartPromise) {
        chartPromise = import('chart.js/auto').then(m => {
            window.Chart = m.default;
            return m.default;
        });
    }
    return chartPromise;
}

// ─── jsPDF + autoTable ───────────────────────────────────────
let pdfPromise = null;

/**
 * Carga jsPDF + autoTable bajo demanda (primera vez ~336 KB)
 * @returns {Promise<typeof import('jspdf').jsPDF>}
 */
export async function loadPDF() {
    if (window.jsPDF) return window.jsPDF;
    if (!pdfPromise) {
        pdfPromise = Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]).then(([jspdfModule]) => {
            const { jsPDF } = jspdfModule;
            window.jsPDF = jsPDF;
            window.jspdf = { jsPDF }; // AutoTable busca window.jspdf.jsPDF
            return jsPDF;
        });
    }
    return pdfPromise;
}

// ─── XLSX (SheetJS) ──────────────────────────────────────────
let xlsxPromise = null;

/**
 * Carga xlsx-js-style bajo demanda (primera vez ~250 KB)
 * @returns {Promise<typeof import('xlsx-js-style')>}
 */
export async function loadXLSX() {
    if (window.XLSX) return window.XLSX;
    if (!xlsxPromise) {
        xlsxPromise = import('xlsx-js-style').then(m => {
            window.XLSX = m;
            return m;
        });
    }
    return xlsxPromise;
}
