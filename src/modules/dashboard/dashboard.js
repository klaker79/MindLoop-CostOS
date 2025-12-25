/**
 * Dashboard Module
 * Actualización de KPIs del dashboard con soporte de calendario
 */

import {
    getFechaHoyFormateada,
    getPeriodoActual,
    filtrarPorPeriodo,
    compararConSemanaAnterior
} from '../../utils/helpers.js';

// Variable para recordar el período actual (default: semana)
let periodoVistaActual = 'semana';

/**
 * Inicializa el banner de fecha actual en el dashboard
 */
export function inicializarFechaActual() {
    const fechaTexto = document.getElementById('fecha-hoy-texto');
    const periodoInfo = document.getElementById('periodo-info');

    if (fechaTexto) {
        try {
            const fechaFormateada = getFechaHoyFormateada();
            // Capitalizar primera letra
            fechaTexto.textContent = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
        } catch (e) {
            fechaTexto.textContent = new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    if (periodoInfo) {
        try {
            const periodo = getPeriodoActual();
            const mesCapitalizado = periodo.mesNombre.charAt(0).toUpperCase() + periodo.mesNombre.slice(1);
            periodoInfo.textContent = `Semana ${periodo.semana} · ${mesCapitalizado} ${periodo.año}`;
        } catch (e) {
            periodoInfo.textContent = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        }
    }
}

/**
 * Cambia el período de vista y actualiza los KPIs
 */
export function cambiarPeriodoVista(periodo) {
    periodoVistaActual = periodo;

    // Actualizar botones activos
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        if (btn.dataset.periodo === periodo) {
            btn.style.background = '#0ea5e9';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'white';
            btn.style.color = '#0369a1';
        }
    });

    // Actualizar KPIs según período
    actualizarKPIsPorPeriodo(periodo);
}

/**
 * Actualiza KPIs filtrados por período
 */
async function actualizarKPIsPorPeriodo(periodo) {
    try {
        // Obtener ventas de la API (datos frescos)
        const ventas = await window.api.getSales();
        window.ventas = ventas; // Actualizar global

        // Filtrar por período
        let ventasFiltradas = ventas;
        if (typeof filtrarPorPeriodo === 'function') {
            ventasFiltradas = filtrarPorPeriodo(ventas, 'fecha', periodo);
        }

        const totalVentas = ventasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

        const kpiIngresos = document.getElementById('kpi-ingresos');
        if (kpiIngresos) {
            kpiIngresos.textContent = totalVentas.toFixed(0) + '€';
        }

        // Actualizar comparativa con período anterior (solo para semana)
        if (periodo === 'semana' && typeof compararConSemanaAnterior === 'function') {
            const comparativa = compararConSemanaAnterior(ventas, 'fecha', 'total');
            const trendEl = document.getElementById('kpi-ingresos-trend');
            if (trendEl) {
                const signo = comparativa.tendencia === 'up' ? '+' : '';
                trendEl.textContent = `${signo}${comparativa.porcentaje}% vs anterior`;
                const parentEl = trendEl.parentElement;
                if (parentEl) {
                    parentEl.className = `kpi-trend ${comparativa.tendencia === 'up' ? 'positive' : 'negative'}`;
                }
            }
        }

    } catch (error) {
        console.error('Error actualizando KPIs por período:', error);
    }
}

/**
 * Actualiza todos los KPIs del dashboard
 */
export async function actualizarKPIs() {
    // Inicializar banner de fecha actual
    inicializarFechaActual();

    try {
        // 1. INGRESOS TOTALES (usa período actual)
        await actualizarKPIsPorPeriodo(periodoVistaActual);

        // 2. PEDIDOS ACTIVOS
        const pedidos = window.pedidos || [];
        const pedidosActivos = pedidos.filter(p => p.estado === 'pendiente').length;
        const pedidosEl = document.getElementById('kpi-pedidos');
        if (pedidosEl) pedidosEl.textContent = pedidosActivos;

        // 3. STOCK BAJO
        const ingredientes = window.ingredientes || [];
        const stockBajo = ingredientes.filter(ing => {
            const stock = parseFloat(ing.stock_actual) || parseFloat(ing.stockActual) || 0;
            const minimo = parseFloat(ing.stock_minimo) || parseFloat(ing.stockMinimo) || 0;
            return minimo > 0 && stock <= minimo;
        }).length;
        const stockEl = document.getElementById('kpi-stock');
        if (stockEl) stockEl.textContent = stockBajo;

        const stockMsgEl = document.getElementById('kpi-stock-msg');
        if (stockMsgEl) stockMsgEl.textContent = stockBajo > 0 ? 'Requieren atención' : 'Todo OK';

        // 4. MARGEN PROMEDIO
        const recetas = window.recetas || [];
        const recetasConMargen = recetas.filter(r => r.precio_venta > 0);
        if (recetasConMargen.length > 0) {
            // ⚡ OPTIMIZACIÓN: Usar función memoizada para calcular costes
            const calcularCoste = window.Performance?.calcularCosteRecetaMemoizado || window.calcularCosteRecetaCompleto;

            const margenTotal = recetasConMargen.reduce((sum, rec) => {
                const coste = typeof calcularCoste === 'function' ? calcularCoste(rec) : 0;
                const margen = rec.precio_venta > 0 ? ((rec.precio_venta - coste) / rec.precio_venta * 100) : 0;
                return sum + margen;
            }, 0);
            const margenPromedio = margenTotal / recetasConMargen.length;
            const margenEl = document.getElementById('kpi-margen');
            if (margenEl) margenEl.textContent = Math.round(margenPromedio) + '%';
        }

    } catch (error) {
        console.error('Error actualizando KPIs:', error);
    }
}

// Exponer funciones en window para acceso desde onclick en HTML
if (typeof window !== 'undefined') {
    window.inicializarFechaActual = inicializarFechaActual;
    window.cambiarPeriodoVista = cambiarPeriodoVista;
    window.actualizarKPIsPorPeriodo = actualizarKPIsPorPeriodo;
}

