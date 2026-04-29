/**
 * Utilidades Compartidas - MindLoop CostOS
 * Funciones de UI y exportación usadas en toda la aplicación
 * @copyright MindLoopIA
 */

import { loadXLSX } from './lazy-vendors.js';
import { getCurrentLanguage, t } from '@/i18n/index.js';

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
export async function exportarAExcel(datos, nombreArchivo, columnas) {
    // Cargar XLSX bajo demanda
    await loadXLSX();
    const XLSX = window.XLSX;
    if (!XLSX) {
        console.error('[Excel] SheetJS (XLSX) no está cargado');
        showToast(t('common:toast_excel_unavailable'), 'error');
        return;
    }

    try {
        let ws;
        if (!datos || !Array.isArray(datos) || datos.length === 0) {
            // Export empty template with headers only
            const headers = columnas.map(col => col.header);
            ws = XLSX.utils.aoa_to_sheet([headers]);
        } else {
            // Preparar datos para Excel
            const datosExcel = datos.map(item => {
                const fila = {};
                columnas.forEach(col => {
                    fila[col.header] = col.key ? item[col.key] : col.value(item);
                });
                return fila;
            });
            ws = XLSX.utils.json_to_sheet(datosExcel);
        }

        // Crear libro y hoja
        const wb = XLSX.utils.book_new();

        // Ajustar ancho de columnas
        ws['!cols'] = columnas.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, 'Datos');

        // Descargar con fecha
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `${nombreArchivo}_${fecha}.xlsx`);

        showToast(t('common:toast_excel_downloaded'), 'success');
    } catch (error) {
        console.error('[Excel] Error exportando:', error);
        showToast(t('common:toast_excel_error'), 'error');
    }
}

/**
 * Formatea número a moneda del restaurante
 * @param {number} value - Valor a formatear
 * @returns {string} Valor formateado (ej: "12,50€" o "12,50RM")
 */
export function formatCurrency(value, decimals = 2) {
    const num = parseFloat(value) || 0;
    const moneda = window.currentUser?.moneda || '€';
    const prefixCurrencies = ['RM', '$', '£'];
    if (prefixCurrencies.includes(moneda)) {
        return moneda + ' ' + num.toFixed(decimals);
    }
    return num.toFixed(decimals).replace('.', ',') + moneda;
}

/**
 * Alias corto de formatCurrency para uso masivo en template literals.
 * Uso: `${cm(valor)}` en vez de `${valor.toFixed(2)}€`
 */
export function cm(value, decimals = 2) {
    return formatCurrency(value, decimals);
}

/**
 * Devuelve el BCP-47 locale apropiado para FORMATEO de fecha/hora en UI según
 * el idioma activo del usuario. Centralizado para Capa 7 (auditoría 2026-04-28)
 * — antes había ~17 sitios con `'es-ES'` hardcodeado que rompían tenants Malasia.
 *
 * Variantes:
 *   - 'en' → 'en-GB' (formato europeo dd/mm/yyyy, evita el am/pm yanqui)
 *   - 'zh' → 'zh-CN'
 *   - resto → 'es-ES'
 *
 * NOTA: Este helper es SOLO para formateo de display. NO usarlo para construir
 * keys de agrupamiento ni para enviar fechas al backend (usa ISO en esos casos).
 *
 * @returns {string} BCP-47 locale tag
 */
export function getDateLocale() {
    const lang = getCurrentLanguage();
    if (lang === 'en') return 'en-GB';
    if (lang === 'zh') return 'zh-CN';
    return 'es-ES';
}

/**
 * Formatea fecha a formato español
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada (ej: "21/12/2025")
 */
export function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString(getDateLocale());
}

/**
 * Formatea fecha y hora a formato español
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha y hora formateada
 */
export function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString(getDateLocale());
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

// ═══════════════════════════════════════════════════════════════
// 🗓️ FUNCIONES DE CALENDARIO Y TIEMPO
// ═══════════════════════════════════════════════════════════════

/**
 * Obtiene la fecha actual del sistema
 * @returns {Date} Fecha actual
 */
export function getFechaHoy() {
    return new Date();
}

/**
 * Obtiene fecha formateada para mostrar en UI
 * @returns {string} Ej: "Lunes, 23 de Diciembre de 2025"
 */
export function getFechaHoyFormateada() {
    const hoy = new Date();
    const opciones = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    return hoy.toLocaleDateString(getDateLocale(), opciones);
}

/**
 * Obtiene el período actual (semana, mes, año)
 * @returns {Object} {semana, mes, año, trimestre}
 */
export function getPeriodoActual() {
    const hoy = new Date();
    const locale = getDateLocale();
    const inicioAño = new Date(hoy.getFullYear(), 0, 1);
    const diasDesdeInicio = Math.floor((hoy - inicioAño) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((diasDesdeInicio + inicioAño.getDay() + 1) / 7);

    return {
        dia: hoy.getDate(),
        diaSemana: hoy.toLocaleDateString(locale, { weekday: 'long' }),
        semana: semana,
        mes: hoy.getMonth() + 1,
        mesNombre: hoy.toLocaleDateString(locale, { month: 'long' }),
        año: hoy.getFullYear(),
        trimestre: Math.ceil((hoy.getMonth() + 1) / 3),
    };
}

/**
 * Obtiene rango de fechas para un período
 * @param {string} periodo - 'hoy', 'semana', 'mes', 'año'
 * @returns {Object} {inicio, fin}
 */
export function getRangoFechas(periodo = 'semana') {
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    let inicio = new Date(hoy);

    switch (periodo) {
        case 'hoy':
            inicio.setHours(0, 0, 0, 0);
            break;
        case 'semana': {
            const diaSemana = hoy.getDay() || 7; // Lunes = 1
            inicio.setDate(hoy.getDate() - diaSemana + 1);
            inicio.setHours(0, 0, 0, 0);
            break;
        }
        case 'mes':
            inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            break;
        case 'año':
            inicio = new Date(hoy.getFullYear(), 0, 1);
            break;
        case 'semanaAnterior': {
            const diaSem = hoy.getDay() || 7;
            inicio.setDate(hoy.getDate() - diaSem - 6);
            inicio.setHours(0, 0, 0, 0);
            const finSemAnt = new Date(inicio);
            finSemAnt.setDate(inicio.getDate() + 6);
            finSemAnt.setHours(23, 59, 59, 999);
            return { inicio, fin: finSemAnt };
        }
        default:
            inicio.setDate(hoy.getDate() - 7);
    }

    return { inicio, fin: hoy };
}

/**
 * Filtra array de datos por rango de fechas
 * @param {Array} datos - Array de objetos con campo fecha
 * @param {string} campoFecha - Nombre del campo de fecha
 * @param {string} periodo - 'hoy', 'semana', 'mes', 'año'
 * @returns {Array} Datos filtrados
 */
export function filtrarPorPeriodo(datos, campoFecha = 'fecha', periodo = 'semana') {
    const { inicio, fin } = getRangoFechas(periodo);

    return datos.filter(item => {
        const fecha = new Date(item[campoFecha]);
        return fecha >= inicio && fecha <= fin;
    });
}

/**
 * Compara métricas de la semana actual vs semana anterior
 * @param {Array} datos - Array de objetos con campo fecha y valor
 * @param {string} campoFecha - Nombre del campo de fecha
 * @param {string} campoValor - Nombre del campo numérico a sumar
 * @returns {Object} {actual, anterior, diferencia, porcentaje}
 */
export function compararConSemanaAnterior(datos, campoFecha = 'fecha', campoValor = 'total') {
    const rangoActual = getRangoFechas('semana');
    const rangoAnterior = getRangoFechas('semanaAnterior');

    const sumaPeriodo = (inicio, fin) => {
        return datos
            .filter(item => {
                const fecha = new Date(item[campoFecha]);
                return fecha >= inicio && fecha <= fin;
            })
            .reduce((acc, item) => acc + (parseFloat(item[campoValor]) || 0), 0);
    };

    const actual = sumaPeriodo(rangoActual.inicio, rangoActual.fin);
    const anterior = sumaPeriodo(rangoAnterior.inicio, rangoAnterior.fin);
    const diferencia = actual - anterior;
    const porcentaje = anterior > 0 ? (diferencia / anterior) * 100 : 0;

    return {
        actual: actual.toFixed(2),
        anterior: anterior.toFixed(2),
        diferencia: diferencia.toFixed(2),
        porcentaje: porcentaje.toFixed(1),
        tendencia: diferencia >= 0 ? 'up' : 'down',
    };
}

/**
 * Calcula días de stock disponible basado en consumo histórico
 * ⚡ OPTIMIZADO: Usa Maps para búsquedas O(1)
 * @param {number} stockActual - Stock actual del ingrediente
 * @param {Array} ventas - Array de ventas históricas
 * @param {Array} recetas - Array de recetas
 * @param {number} ingredienteId - ID del ingrediente
 * @param {number} diasHistorico - Días para calcular promedio (default 7)
 * @returns {Object} {diasStock, consumoDiario, alerta}
 */
export function calcularDiasDeStock(
    stockActual,
    ventas,
    recetas,
    ingredienteId,
    diasHistorico = 7
) {
    // Obtener ventas de los últimos X días
    const { inicio } = getRangoFechas('semana');
    const ventasRecientes = ventas.filter(v => new Date(v.fecha) >= inicio);

    // ⚡ OPTIMIZACIÓN: Usar Map de recetas (O(1) en lugar de O(n))
    const recetasMap = window.dataMaps?.recetasMap || new Map(recetas.map(r => [r.id, r]));

    // Calcular consumo total del ingrediente
    let consumoTotal = 0;

    ventasRecientes.forEach(venta => {
        const receta = recetasMap.get(venta.receta_id);
        if (receta && receta.ingredientes) {
            const ingredienteEnReceta = receta.ingredientes.find(
                ing => ing.ingredienteId === ingredienteId || ing.ingrediente_id === ingredienteId
            );
            if (ingredienteEnReceta) {
                // 🔒 Auditoría Capa 7 (A1-M13): parseFloat preserva medias porciones (0.5)
                consumoTotal +=
                    (parseFloat(ingredienteEnReceta.cantidad) || 0) *
                    (parseFloat(venta.cantidad) || 0);
            }
        }
    });

    const consumoDiario = consumoTotal / diasHistorico;
    const diasStock = consumoDiario > 0 ? Math.floor(stockActual / consumoDiario) : 999;

    let alerta = 'ok';
    if (diasStock <= 2) alerta = 'critico';
    else if (diasStock <= 5) alerta = 'bajo';
    else if (diasStock <= 7) alerta = 'medio';

    return {
        diasStock,
        consumoDiario: consumoDiario.toFixed(2),
        alerta,
        mensaje: diasStock === 999 ? 'Sin consumo reciente' : `Stock para ${diasStock} días`,
    };
}

/**
 * Genera proyección de consumo para los próximos días
 * ⚡ OPTIMIZADO: Calcula consumo una sola vez para todos los ingredientes
 * @param {Array} ingredientes - Lista de ingredientes
 * @param {Array} ventas - Historial de ventas
 * @param {Array} recetas - Lista de recetas
 * @param {number} diasProyeccion - Días a proyectar (default 7)
 * @returns {Array} Lista de ingredientes con proyección
 */
export function proyeccionConsumo(ingredientes, ventas, recetas, diasProyeccion = 7) {
    const diasHistorico = 7;
    const { inicio } = getRangoFechas('semana');
    const ventasRecientes = ventas.filter(v => new Date(v.fecha) >= inicio);

    // ⚡ OPTIMIZACIÓN: Pre-calcular consumo de TODOS los ingredientes una sola vez
    const recetasMap = window.dataMaps?.recetasMap || new Map(recetas.map(r => [r.id, r]));
    const consumoPorIngrediente = new Map();

    // Recorrer ventas una sola vez y acumular consumos
    ventasRecientes.forEach(venta => {
        const receta = recetasMap.get(venta.receta_id);
        if (receta && receta.ingredientes) {
            // 🔒 Auditoría Capa 7 (A1-M13): parseFloat preserva medias porciones (0.5)
            const cantidadVenta = parseFloat(venta.cantidad) || 0;
            receta.ingredientes.forEach(item => {
                const ingId = item.ingredienteId || item.ingrediente_id;
                const cantidadConsumida = (parseFloat(item.cantidad) || 0) * cantidadVenta;
                const consumoActual = consumoPorIngrediente.get(ingId) || 0;
                consumoPorIngrediente.set(ingId, consumoActual + cantidadConsumida);
            });
        }
    });

    // Ahora mapear ingredientes con búsquedas O(1)
    return ingredientes
        .map(ing => {
            const consumoTotal = consumoPorIngrediente.get(ing.id) || 0;
            const consumoDiario = consumoTotal / diasHistorico;
            const stockActual = parseFloat(ing.stock_actual) || 0;
            const diasStock = consumoDiario > 0 ? Math.floor(stockActual / consumoDiario) : 999;

            let alerta = 'ok';
            if (diasStock <= 2) alerta = 'critico';
            else if (diasStock <= 5) alerta = 'bajo';
            else if (diasStock <= 7) alerta = 'medio';

            return {
                id: ing.id,
                nombre: ing.nombre,
                stockActual: ing.stock_actual,
                unidad: ing.unidad,
                diasStock,
                consumoDiario: consumoDiario.toFixed(2),
                alerta,
                mensaje:
                    diasStock === 999 ? 'Sin consumo reciente' : `Stock para ${diasStock} días`,
                necesitaPedido: diasStock <= diasProyeccion,
            };
        })
        .filter(ing => ing.necesitaPedido)
        .sort((a, b) => a.diasStock - b.diasStock);
}

// ═══════════════════════════════════════════════════════════════
// 🛡️ FUNCIONES DE SEGURIDAD Y VALIDACIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Escapa caracteres HTML para prevenir XSS
 * CONSOLIDADO: Esta función existía duplicada en 13+ archivos
 * @param {any} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeHTML(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Convierte valor a número seguro
 * CONSOLIDADO: Esta función existía duplicada en múltiples archivos
 * @param {any} value - Valor a convertir
 * @param {number} defaultValue - Valor por defecto si no es número válido
 * @returns {number} Número válido
 */
export function safeNumber(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Formatea fecha en español (alias legacy)
 * @param {string|Date} fecha - Fecha a formatear
 * @returns {string} Fecha formateada (ej: "21/12/2025")
 */
export function formatearFecha(fecha) {
    return formatDate(fecha);
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
    window.getDateLocale = getDateLocale;
    window.debounce = debounce;
    window.getRestaurantName = getRestaurantName;
    window.getRestaurantNameForFile = getRestaurantNameForFile;
    // Funciones de calendario
    window.getFechaHoy = getFechaHoy;
    window.getFechaHoyFormateada = getFechaHoyFormateada;
    window.getPeriodoActual = getPeriodoActual;
    window.getRangoFechas = getRangoFechas;
    window.filtrarPorPeriodo = filtrarPorPeriodo;
    window.compararConSemanaAnterior = compararConSemanaAnterior;
    window.calcularDiasDeStock = calcularDiasDeStock;
    window.proyeccionConsumo = proyeccionConsumo;
    // Funciones de seguridad y validación (consolidadas)
    window.escapeHTML = escapeHTML;
    window.safeNumber = safeNumber;
    window.formatearFecha = formatearFecha;
}
