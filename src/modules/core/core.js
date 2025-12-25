/**
 * Módulo Core - MindLoop CostOS
 * Funciones centrales de la aplicación: carga de datos, navegación por tabs
 */

const API_BASE = 'https://lacaleta-api.mindloop.cloud/api';

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
        const [ingredientes, recetas, proveedores, pedidos] = await Promise.all([
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
        ]);

        window.ingredientes = Array.isArray(ingredientes) ? ingredientes : [];
        window.recetas = Array.isArray(recetas) ? recetas : [];
        window.proveedores = Array.isArray(proveedores) ? proveedores : [];
        window.pedidos = Array.isArray(pedidos) ? pedidos : [];

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
    // Desactivar todas las tabs
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document
        .querySelectorAll('.tab-content')
        .forEach((c) => c.classList.remove('active'));

    // Activar tab seleccionada
    const tabBtn = document.getElementById('tab-btn-' + tab);
    const tabContent = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');

    // Acciones específicas por tab
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
