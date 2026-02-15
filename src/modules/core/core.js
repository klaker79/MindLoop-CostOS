/**
 * Módulo Core - MindLoop CostOS
 * Funciones centrales de la aplicación: carga de datos, navegación por tabs
 */

import { getApiUrl } from '../../config/app-config.js';
// 🆕 Zustand stores for state management
import ingredientStore from '../../stores/ingredientStore.js';
import { initializeStores } from '../../stores/index.js';

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
            ),
            fetch(API_BASE + '/recipes', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /recipes failed, keeping existing data'), window.recetas || [])
            ),
            fetch(API_BASE + '/suppliers', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /suppliers failed, keeping existing data'), window.proveedores || [])
            ),
            fetch(API_BASE + '/orders', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /orders failed, keeping existing data'), window.pedidos || [])
            ),
            fetch(API_BASE + '/inventory/complete', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /inventory failed, keeping existing data'), window.inventarioCompleto || [])
            ),
            // 💰 Cargar precios de cada proveedor por ingrediente
            fetch(API_BASE + '/ingredients-suppliers', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /ingredients-suppliers failed, keeping existing data'), window.ingredientesProveedores || [])
            ),
            // 🍷 Cargar variantes de recetas (botella/copa)
            fetch(API_BASE + '/recipes-variants', fetchOptions).then((r) =>
                r.ok ? r.json() : (console.warn('⚠️ /recipes-variants failed, keeping existing data'), window.recetasVariantes || [])
            ),
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
        window.showToast?.('Error conectando con la API', 'error');
    }
}

/**
 * Cambia la pestaña activa
 */
export function cambiarTab(tab) {
    // Desactivar todas las tabs (legacy horizontal tabs)
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document
        .querySelectorAll('.tab-content')
        .forEach((c) => c.classList.remove('active'));

    // Activar tab seleccionada (legacy)
    const tabBtn = document.getElementById('tab-btn-' + tab);
    const tabContent = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');

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
            window.renderizarComprasPendientes?.();
            break;
        case 'ventas':
            window.renderizarVentas?.();
            break;
        case 'inventario':
            window.renderizarInventario?.();
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
            break;
    }
}

/**
 * Inicializa la aplicación después del login
 */
export async function init() {
    await cargarDatos();

    // Renderizar datos iniciales
    window.renderizarIngredientes?.();
    window.renderizarRecetas?.();
    window.renderizarProveedores?.();
    window.renderizarPedidos?.();
    window.renderizarVentas?.();
    window.actualizarKPIs?.();

    // Inicializar fecha
    window.inicializarFechaActual?.();

    // Dashboard expandido (Stock Bajo, Top Recetas, etc.)
    window.actualizarDashboardExpandido?.();
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
        periodoInfo.textContent = `Semana ${periodo.semana} · ${periodo.mesNombre.charAt(0).toUpperCase() + periodo.mesNombre.slice(1)} ${periodo.año}`;
    }
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.cargarDatos = cargarDatos;
    window.cambiarTab = cambiarTab;
    window.init = init;
    window.inicializarFechaActual = inicializarFechaActual;
}
