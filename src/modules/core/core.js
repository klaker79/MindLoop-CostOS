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

// Fetch wrapper with credentials for httpOnly cookies
function fetchWithAuth(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'include', // Required for httpOnly cookies
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    });
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
        console.log('📡 Cargando datos desde API...');
        const [ingredientes, recetas, proveedores, pedidos, inventario, ingredientesProveedores] = await Promise.all([
            fetchWithAuth(API_BASE + '/ingredients').then((r) =>
                r.ok ? r.json() : []
            ),
            fetchWithAuth(API_BASE + '/recipes').then((r) =>
                r.ok ? r.json() : []
            ),
            fetchWithAuth(API_BASE + '/suppliers').then((r) =>
                r.ok ? r.json() : []
            ),
            fetchWithAuth(API_BASE + '/orders').then((r) =>
                r.ok ? r.json() : []
            ),
            fetchWithAuth(API_BASE + '/inventory/complete').then((r) =>
                r.ok ? r.json() : []
            ),
            // 💰 Cargar precios de cada proveedor por ingrediente
            fetchWithAuth(API_BASE + '/ingredients-suppliers').then((r) =>
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

        console.log('✅ Datos cargados:', {
            ingredientes: window.ingredientes.length,
            recetas: window.recetas.length,
            proveedores: window.proveedores.length,
            pedidos: window.pedidos.length
        });
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

    console.log('🎨 Iniciando renderizado...');

    // Renderizar datos iniciales con error handling
    const renderFunctions = [
        ['renderizarIngredientes', window.renderizarIngredientes],
        ['renderizarRecetas', window.renderizarRecetas],
        ['renderizarProveedores', window.renderizarProveedores],
        ['renderizarPedidos', window.renderizarPedidos],
        ['renderizarVentas', window.renderizarVentas],
    ];

    for (const [name, fn] of renderFunctions) {
        try {
            if (typeof fn === 'function') {
                fn();
                console.log(`✅ ${name} OK`);
            } else {
                console.warn(`⚠️ ${name} no disponible`);
            }
        } catch (e) {
            console.error(`❌ Error ${name}:`, e);
        }
    }

    // KPIs y Dashboard (async)
    try {
        if (typeof window.actualizarKPIs === 'function') {
            await window.actualizarKPIs();
            console.log('✅ actualizarKPIs OK');
        }
    } catch (e) { console.error('❌ Error actualizarKPIs:', e); }

    try {
        if (typeof window.actualizarDashboardExpandido === 'function') {
            await window.actualizarDashboardExpandido();
            console.log('✅ actualizarDashboardExpandido OK');
        }
    } catch (e) { console.error('❌ Error actualizarDashboardExpandido:', e); }

    // Inicializar fecha
    try {
        if (typeof window.inicializarFechaActual === 'function') {
            window.inicializarFechaActual();
        }
    } catch (e) { console.error('❌ Error inicializarFechaActual:', e); }

    console.log('🏁 Init completado');
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
