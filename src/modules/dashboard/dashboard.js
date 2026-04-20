/**
 * Dashboard Module
 * Actualización de KPIs del dashboard con soporte de calendario
 */

// KPI Dashboard v2 - Clean Architecture
import { loadKPIDashboard } from '../../components/domain/KPIDashboard.js';
import { renderQuickActions } from '../../components/domain/QuickActions.js';
import { renderOnboardingBanner } from '../../components/domain/OnboardingBanner.js';

import { showSkeletonIn, isDataLoaded } from './_shared.js';
import { inicializarFechaActual } from './kpis/fecha-actual.js';
import { renderKpiPedidos } from './kpis/pedidos.js';
import { renderKpiStockBajo } from './kpis/stock-bajo.js';
import { renderKpiValorStock } from './kpis/valor-stock.js';
import { renderKpiCambiosPrecio } from './kpis/cambios-precio.js';
import { renderKpiPersonalHoy } from './kpis/personal-hoy.js';
import { renderSparklines } from './kpis/sparklines.js';
import { renderForecast } from './kpis/forecast.js';
import { actualizarMargenReal } from './kpis/food-cost.js';
import { actualizarKPIsPorPeriodo } from './kpis/ingresos.js';
export { inicializarFechaActual };

// Variable para recordar el período actual (default: semana)
let periodoVistaActual = 'semana';

/**
 * Inicializa el banner de fecha actual en el dashboard
 */
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
    actualizarMargenReal(periodo);
}

/**
 * Actualiza todos los KPIs del dashboard
 */
export async function actualizarKPIs() {
    // 💀 Si no hay datos aún, mostrar skeletons y salir
    if (!isDataLoaded()) {
        showSkeletonIn(document.getElementById('kpi-ingresos'));
        showSkeletonIn(document.getElementById('kpi-pedidos'));
        showSkeletonIn(document.getElementById('kpi-stock'));
        showSkeletonIn(document.getElementById('kpi-margen'));
        showSkeletonIn(document.getElementById('ventas-hoy'));
        showSkeletonIn(document.getElementById('ingresos-hoy'));
        showSkeletonIn(document.getElementById('plato-estrella-hoy'));
        showSkeletonIn(document.getElementById('alertas-stock-lista'), 'rows');
        showSkeletonIn(document.getElementById('personal-hoy-lista'), 'rows');
        showSkeletonIn(document.getElementById('lista-cambios-precio'), 'rows');
        console.log('💀 Skeleton loading: esperando datos...');
        return;
    }

    // Crear contenedor de acciones rápidas
    try {
        let actionsContainer = document.getElementById('quick-actions-container');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = 'quick-actions-container';

            const mainContent = document.querySelector('.dashboard-content') ||
                document.querySelector('#dashboard') ||
                document.querySelector('main');
            if (mainContent) {
                mainContent.insertBefore(actionsContainer, mainContent.firstChild);
            }
        }

        renderQuickActions(actionsContainer);
    } catch (e) {
        console.log('QuickActions no disponible:', e.message);
    }

    // Onboarding banner para restaurantes nuevos
    try {
        const dashboardContent = document.querySelector('.dashboard-content') ||
            document.querySelector('#dashboard') ||
            document.querySelector('.main-content') ||
            document.querySelector('main');
        if (dashboardContent) {
            renderOnboardingBanner(dashboardContent);
        }
    } catch (e) {
        console.log('Onboarding banner no disponible:', e.message);
    }

    // Inicializar banner de fecha actual
    inicializarFechaActual();

    // 🔧 DESACTIVADO: KPI Dashboard v2 - Widget duplicado, usuario pidió eliminarlo
    // Este bloque creaba un widget blanco con Ingresos/Coste/Beneficio/Margen/Food Cost/Ventas
    // que aparecía encima del Dashboard "Hoy" existente.
    // Si en el futuro se quiere reactivar, descomentar el bloque siguiente:
    /*
    try {
        let kpiContainer = document.getElementById('kpi-dashboard-container');
        if (!kpiContainer) {
            kpiContainer = document.createElement('div');
            kpiContainer.id = 'kpi-dashboard-container';
            kpiContainer.className = 'kpi-dashboard-wrapper';

            const mainContent = document.querySelector('.dashboard-content') ||
                document.querySelector('#dashboard') ||
                document.querySelector('.main-content') ||
                document.querySelector('main');
            if (mainContent) {
                mainContent.insertBefore(kpiContainer, mainContent.firstChild);
            }
        }

        if (window.API?.getDailyKPIs) {
            loadKPIDashboard(kpiContainer);
        }
    } catch (e) {
        console.log('KPI Dashboard v2 no disponible:', e.message);
    }
    */

    try {
        // 1. INGRESOS TOTALES (usa período actual)
        await actualizarKPIsPorPeriodo(periodoVistaActual);

        // 2. PEDIDOS del periodo + badge pendientes
        renderKpiPedidos(periodoVistaActual);

        // 3. STOCK BAJO (cuenta items a cero OR <= stock_minimo)
        const stockBajo = renderKpiStockBajo();

        // 4. MARGEN REAL / FOOD COST (basado en ventas_diarias_resumen)
        await actualizarMargenReal(periodoVistaActual);

        // 5. VALOR STOCK TOTAL (valor_stock precalculado por backend)
        renderKpiValorStock();

        // 6. CAMBIOS DE PRECIO (últimos pedidos)
        renderKpiCambiosPrecio();

        // 7. PERSONAL HOY (trabajan / libran)
        await renderKpiPersonalHoy();

        // Actualizar contador de stock bajo
        const stockCountEl = document.getElementById('kpi-stock-count');
        if (stockCountEl) {
            stockCountEl.textContent = stockBajo;
        }

        // Render sparklines
        renderSparklines();

        // Render forecast (total + confianza + comparativa + chart + tabs)
        renderForecast();

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

// Escuchar evento de refresh del dashboard
window.addEventListener('dashboard:refresh', () => {
    // Recargar KPIs y gráficos
    const kpiContainer = document.getElementById('kpi-dashboard-container');
    const chartsContainer = document.getElementById('kpi-charts-container');

    if (kpiContainer && typeof loadKPIDashboard === 'function') {
        loadKPIDashboard(kpiContainer);
    }
    if (chartsContainer && typeof window.renderKPICharts === 'function') {
        window.renderKPICharts(chartsContainer);
    }

    // También actualizar los KPIs básicos
    actualizarKPIs();

    // Actualizar widgets expandidos (Stock Bajo lista, Top Recetas, etc.)
    window.actualizarDashboardExpandido?.();
});
