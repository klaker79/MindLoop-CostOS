/**
 * Módulo Core - MindLoop CostOS
 * Funciones centrales de la aplicación: carga de datos, navegación por tabs
 */

import { getApiUrl } from '../../config/app-config.js';
// 🆕 Zustand stores for state management
import ingredientStore from '../../stores/ingredientStore.js';
import { initializeStores } from '../../stores/index.js';
import { t } from '@/i18n/index.js';
import { renderPersonalExtra } from '../balance/personal-extra.js';

const API_BASE = getApiUrl();

function getAuthHeaders() {
    // 🔒 SECURITY: Dual-mode auth — cookie + in-memory Bearer (NOT localStorage)
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.authToken : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// 🔧 FIX: Lock para prevenir llamadas concurrentes a cargarDatos()
// Esto evita condiciones de carrera cuando múltiples operaciones
// intentan recargar datos simultáneamente
let _cargarDatosLock = false;
let _cargarDatosPromise = null;

/**
 * Carga todos los datos iniciales de la API
 * ⚡ OPTIMIZADO: Carga paralela con Promise.all()
 * 🔧 FIX: Con lock para prevenir llamadas concurrentes
 */
export async function cargarDatos() {
    // 🔧 FIX: Si ya hay una carga en progreso, esperar a que termine
    if (_cargarDatosLock && _cargarDatosPromise) {
        console.log('⏳ cargarDatos() ya en progreso, esperando...');
        return _cargarDatosPromise;
    }

    _cargarDatosLock = true;
    _cargarDatosPromise = _cargarDatosInternal();

    try {
        await _cargarDatosPromise;
    } finally {
        _cargarDatosLock = false;
        _cargarDatosPromise = null;
    }
}

/**
 * Implementación interna de cargarDatos (sin lock)
 */
async function _cargarDatosInternal() {
    try {
        console.log('🛰️ Cargando datos desde API...');
        const fetchOptions = { credentials: 'include', headers: getAuthHeaders() };

        const [ingredientes, recetas, proveedores, pedidos, inventario, ingredientesProveedores, recetasVariantes] = await Promise.all([
            fetch(API_BASE + '/ingredients', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /ingredients failed, keeping existing data'), window.ingredientes || [])
            ).catch(() => (console.warn('⚠️ /ingredients network error'), window.ingredientes || [])),
            fetch(API_BASE + '/recipes', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /recipes failed, keeping existing data'), window.recetas || [])
            ).catch(() => (console.warn('⚠️ /recipes network error'), window.recetas || [])),
            fetch(API_BASE + '/suppliers', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /suppliers failed, keeping existing data'), window.proveedores || [])
            ).catch(() => (console.warn('⚠️ /suppliers network error'), window.proveedores || [])),
            fetch(API_BASE + '/orders', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /orders failed, keeping existing data'), window.pedidos || [])
            ).catch(() => (console.warn('⚠️ /orders network error'), window.pedidos || [])),
            fetch(API_BASE + '/inventory/complete', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /inventory failed, keeping existing data'), window.inventarioCompleto || [])
            ).catch(() => (console.warn('⚠️ /inventory network error'), window.inventarioCompleto || [])),
            fetch(API_BASE + '/ingredients-suppliers', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /ingredients-suppliers failed, keeping existing data'), window.ingredientesProveedores || [])
            ).catch(() => (console.warn('⚠️ /ingredients-suppliers network error'), window.ingredientesProveedores || [])),
            fetch(API_BASE + '/recipes-variants', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /recipes-variants failed, keeping existing data'), window.recetasVariantes || [])
            ).catch(() => (console.warn('⚠️ /recipes-variants network error'), window.recetasVariantes || [])),
        ]);

        window.ingredientes = Array.isArray(ingredientes) ? ingredientes : [];
        window.recetas = Array.isArray(recetas) ? recetas : [];
        window.proveedores = Array.isArray(proveedores) ? proveedores : [];
        window.pedidos = Array.isArray(pedidos) ? pedidos : [];

        // 💰 Inventario con precio_medio para cálculo de costes de recetas
        window.inventarioCompleto = Array.isArray(inventario) ? inventario : [];

        // 💰 Precios por proveedor (para calcular pedidos con precio correcto)
        window.ingredientesProveedores = Array.isArray(ingredientesProveedores) ? ingredientesProveedores : [];

        // 🍷 Variantes de recetas (botella/copa)
        window.recetasVariantes = Array.isArray(recetasVariantes) ? recetasVariantes : [];

        // 🍽️ Opt-in "Comida de Personal" (por restaurante, apagado por defecto).
        // No bloquea la carga principal: aplica el gating (casilla + pestaña) en cuanto llega.
        fetch(API_BASE + '/restaurant/comida-personal', fetchOptions)
            .then((r) => (r.ok ? r.json() : { activa: false }))
            .then((d) => { window.comidaPersonalActiva = d?.activa === true; })
            .catch(() => { window.comidaPersonalActiva = false; })
            .finally(() => window.aplicarGatingComidaPersonal?.());

        // ⚡ Actualizar mapas de búsqueda optimizados
        if (window.dataMaps?.update) {
            window.dataMaps.update();
        }

        // 🆕 Sync to Zustand stores (gradual migration)
        try {
            ingredientStore.getState().setIngredients(window.ingredientes);
        } catch (e) {
            console.warn('⚠️ Zustand sync failed (non-critical):', e.message);
        }

        console.log('✅ Datos cargados:', {
            ingredientes: window.ingredientes.length,
            recetas: window.recetas.length,
            proveedores: window.proveedores.length,
            pedidos: window.pedidos.length,
            variantes: window.recetasVariantes.length
        });

        // 🔄 Notificar al dashboard para que recalcule KPIs con datos frescos
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        window.showToast?.(t('common:toast_error_api'), 'error');
    }
}

/**
 * Cambia la pestaña activa
 */
export function cambiarTab(tab) {
    // 📱 Móvil: cerrar el sidebar off-canvas al navegar. Sin esto el menú se
    // queda abierto tapando el contenido tras tocar una pestaña (en desktop la
    // clase 'open' no existe → no-op).
    document.getElementById('sidebar')?.classList.remove('open');

    // Desactivar todas las tabs (legacy horizontal tabs)
    document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));

    // Ocultar ALL tab-content
    document.querySelectorAll('.tab-content').forEach((c) => {
        c.classList.remove('active');
        c.style.display = 'none';
    });

    // Activar tab seleccionada
    const tabBtn = document.getElementById('tab-btn-' + tab);
    const tabContent = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) {
        tabContent.classList.add('active');
        tabContent.style.display = 'block';
    }

    // 🔧 FIX: Hide dashboard sections when switching away from the default view
    // Three sections sit above .main-card and fill the viewport (~800px total):
    // 1. #fecha-actual-banner (date bar)
    // 2. KPI row (div containing .kpi-mini cards)
    // 3. #dashboard-premium (expanded dashboard grid)
    // En escritorio, la pestaña 'ingredientes' es el "home" y lleva el dashboard
    // encima (legacy). En MÓVIL, "Panel" e "Ingredientes" son entradas distintas a
    // la MISMA pestaña: el dashboard solo debe salir si el cliente entró por "Panel"
    // (window.__mlShowPanel), no al abrir "Ingredientes" desde el menú.
    const isMobile = typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 768px)').matches;
    const showDashboard = (tab === 'ingredientes') && (!isMobile || window.__mlShowPanel === true);
    window.__mlShowPanel = false;   // se consume una sola vez
    const dashboard = document.getElementById('dashboard-premium');
    const dateBanner = document.getElementById('fecha-actual-banner');
    // KPI row is the parent of .kpi-mini elements
    const kpiMini = document.querySelector('.kpi-mini');
    const kpiRow = kpiMini?.parentElement;

    if (showDashboard) {
        if (dashboard) dashboard.style.display = '';
        if (dateBanner) dateBanner.style.display = '';
        if (kpiRow) kpiRow.style.display = 'flex';
    } else {
        if (dashboard) dashboard.style.display = 'none';
        if (dateBanner) dateBanner.style.display = 'none';
        if (kpiRow) kpiRow.style.display = 'none';
    }

    // Scroll main content area to top so tab content is visible
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    // ✨ Actualizar sidebar nav-items
    document.querySelectorAll('.sidebar .nav-item').forEach((item) => {
        item.classList.remove('active');
        if (item.dataset.tab === tab) {
            item.classList.add('active');
        }
    });
    switch (tab) {
        case 'ingredientes':
            window.renderizarIngredientes?.();
            break;
        case 'recetas':
            window.renderizarRecetas?.();
            break;
        case 'proveedores':
            window.renderizarProveedores?.();
            break;
        case 'pedidos':
            window.renderizarPedidos?.();
            break;
        case 'comida-personal':
            window.renderizarComidaPersonal?.();
            break;
        case 'ventas':
            window.renderizarVentas?.();
            break;
        case 'inventario':
            window.renderizarInventario?.();
            break;
        case 'busqueda':
            window.renderizarBusqueda?.();
            break;
        case 'diario':
            window.cargarValoresGastosFijos?.();
            {
                const contExtra = document.getElementById('personal-extra-list');
                if (contExtra) renderPersonalExtra(contExtra);
            }
            break;
        case 'analisis':
            window.renderizarAnalisis?.();
            break;
        case 'horarios':
            window.initHorarios?.();
            break;
        case 'inteligencia':
            window.renderizarInteligencia?.();
            break;
        case 'configuracion':
            window.renderizarEquipo?.();
            window.loadSubscriptionStatus?.();
            break;
    }

    // Onboarding spotlight: tras cambiar de tab, re-abrir el modal si aún
    // hay pasos pendientes. Delay para que la pestaña destino se haya
    // renderizado y el modal sepa "ya estás en el paso pendiente".
    // El propio componente respeta cooldown post-cierre para no parpadear.
    setTimeout(() => window.refreshOnboardingSpotlight?.(), 350);
}

/**
 * Inicializa la aplicación después del login
 */
export async function init() {
    await cargarDatos();

    // Renderizar datos iniciales (solo lo visible en el dashboard)
    // Las demás pestañas se renderizan bajo demanda en cambiarTab()
    window.renderizarIngredientes?.();
    window.renderizarRecetas?.();
    window.renderizarProveedores?.();
    window.actualizarKPIs?.();

    // Inicializar fecha
    window.inicializarFechaActual?.();

    // Dashboard expandido (Stock Bajo, Top Recetas, etc.)
    window.actualizarDashboardExpandido?.();

    // Cargar estado de suscripción (banner de trial)
    window.loadSubscriptionStatus?.();

    // Portada móvil: rellenar "qué me falta" + "volver a pedir" con los datos ya cargados.
    window.renderMobileHome?.();
}

/**
 * Inicializa el banner de fecha actual
 */
export function inicializarFechaActual() {
    const fechaTexto = document.getElementById('fecha-hoy-texto');
    const periodoInfo = document.getElementById('periodo-info');

    if (fechaTexto && typeof window.getFechaHoyFormateada === 'function') {
        const fechaFormateada = window.getFechaHoyFormateada();
        fechaTexto.textContent =
            fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
    }

    if (periodoInfo && typeof window.getPeriodoActual === 'function') {
        const periodo = window.getPeriodoActual();
        const weekLabel = t('dashboard:period_week') || 'Semana';
        periodoInfo.textContent = `${weekLabel} ${periodo.semana} · ${periodo.mesNombre.charAt(0).toUpperCase() + periodo.mesNombre.slice(1)} ${periodo.año}`;
    }
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.cargarDatos = cargarDatos;
    window.cambiarTab = cambiarTab;
    window.init = init;
    window.inicializarFechaActual = inicializarFechaActual;
}

// Re-compute date when language changes
window.addEventListener('languageChanged', () => {
    inicializarFechaActual();
});
