/**
 * Utilidades Compartidas - MindLoop CostOS
 * Funciones de UI y exportación usadas en toda la aplicación
 * @copyright MindLoopIA
 */

/**
 * Obtiene el nombre del restaurante del usuario actual
 * Usado para exports, PDFs, y cualquier referencia dinámica
 * @returns {string} Nombre del restaurante o fallback genérico
 */
export function getRestaurantName() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.restaurante || user.nombre || 'Mi Restaurante';
    } catch {
        return 'Mi Restaurante';
    }
}

/**
 * Obtiene nombre sanitizado para archivos (sin espacios ni caracteres especiales)
 * @returns {string} Nombre seguro para archivos
 */
export function getRestaurantNameForFile() {
    return getRestaurantName()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, '');
}

/**
 * Muestra un toast de notificación
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success' | 'error' | 'warning' | 'info'
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('[Toast] Contenedor toast-container no encontrado');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    // Crear estructura sin inyectar mensaje directamente (previene XSS)
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-message"></div>
    `;

    // Establecer mensaje de forma segura
    toast.querySelector('.toast-message').textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Muestra overlay de carga
 */
export function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

/**
 * Oculta overlay de carga
 */
export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Exporta datos a Excel usando SheetJS (XLSX)
 * @param {Array} datos - Array de objetos a exportar
 * @param {string} nombreArchivo - Nombre base del archivo
 * @param {Array} columnas - Configuración de columnas [{header, key} o {header, value: fn}]
 */
export function exportarAExcel(datos, nombreArchivo, columnas) {
    // Verificar que XLSX esté disponible
    if (typeof XLSX === 'undefined') {
        console.error('[Excel] SheetJS (XLSX) no está cargado');
        showToast('Error: Librería Excel no disponible', 'error');
        return;
    }

    if (!datos || !Array.isArray(datos) || datos.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    try {
        // Preparar datos para Excel
        const datosExcel = datos.map(item => {
            const fila = {};
            columnas.forEach(col => {
                fila[col.header] = col.key ? item[col.key] : col.value(item);
            });
            return fila;
        });

        // Crear libro y hoja
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExcel);

        // Ajustar ancho de columnas
        ws['!cols'] = columnas.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, "Datos");

        // Descargar con fecha
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `${nombreArchivo}_${fecha}.xlsx`);

        showToast('Excel descargado correctamente', 'success');
    } catch (error) {
        console.error('[Excel] Error exportando:', error);
        showToast('Error al exportar Excel', 'error');
    }
}

/**
 * Formatea número a moneda EUR
 * @param {number} value - Valor a formatear
 * @returns {string} Valor formateado (ej: "12,50€")
 */
export function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toFixed(2).replace('.', ',') + '€';
}

/**
 * Formatea fecha a formato español
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada (ej: "21/12/2025")
 */
export function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('es-ES');
}

/**
 * Formatea fecha y hora a formato español
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha y hora formateada
 */
export function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('es-ES');
}

/**
 * Debounce - Retrasa ejecución hasta que pare de llamarse
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Milisegundos de espera
 * @returns {Function} Función con debounce
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Exponer al scope global para compatibilidad
if (typeof window !== 'undefined') {
    window.showToast = showToast;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.exportarAExcel = exportarAExcel;
    window.formatCurrency = formatCurrency;
    window.formatDate = formatDate;
    window.formatDateTime = formatDateTime;
    window.debounce = debounce;
    window.getRestaurantName = getRestaurantName;
    window.getRestaurantNameForFile = getRestaurantNameForFile;
}
