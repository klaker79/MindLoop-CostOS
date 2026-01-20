/**
 * Módulo Core - MindLoop CostOS
 * Funciones centrales de la aplicación: carga de datos, navegación por tabs
 */

import { getApiUrl } from '../../config/app-config.js';

const API_BASE = getApiUrl();

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
    };
}

/**
 * Carga todos los datos iniciales de la API
 * ⚡ OPTIMIZADO: Carga paralela con Promise.all()
 */
export async function cargarDatos() {
    try {
        const [ingredientes, recetas, proveedores, pedidos, inventario, ingredientesProveedores] = await Promise.all([
            fetch(API_BASE + '/ingredients', { headers: getAuthHeaders() }).then((r) =>
                r.json()
            ),
            fetch(API_BASE + '/recipes', { headers: getAuthHeaders() }).then((r) =>
                r.json()
            ),
            fetch(API_BASE + '/suppliers', { headers: getAuthHeaders() }).then((r) =>
                r.json()
            ),
            fetch(API_BASE + '/orders', { headers: getAuthHeaders() }).then((r) =>
                r.json()
            ),
            fetch(API_BASE + '/inventory/complete', { headers: getAuthHeaders() }).then((r) =>
                r.ok ? r.json() : []
            ),
            // 💰 Cargar precios de cada proveedor por ingrediente
            fetch(API_BASE + '/ingredients-suppliers', { headers: getAuthHeaders() }).then((r) =>
                r.ok ? r.json() : []
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

        // ⚡ Actualizar mapas de búsqueda optimizados
        if (window.dataMaps?.update) {
            window.dataMaps.update();
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
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
