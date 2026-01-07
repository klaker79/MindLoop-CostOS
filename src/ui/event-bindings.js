/**
 * Event Bindings Module
 * Centralizes all DOM event handlers using data-action attributes
 * Eliminates all inline onclick/onchange/onsubmit
 *
 * @module ui/event-bindings
 */

/**
 * Action handlers map
 * Maps data-action values to their handler functions
 */
const actionHandlers = {
    // Auth
    'mostrar-registro': () => window.mostrarRegistro?.(),
    logout: () => window.logout?.(),

    // Theme Toggle
    'toggle-theme': () => toggleTheme(),

    // Ingredientes
    'mostrar-form-ingrediente': () => {
        // 🔧 FIX CRÍTICO: Resetear IDs antes de mostrar formulario para crear nuevo ingrediente
        // Si no se resetea, el formulario queda en modo "editar" con el ID del ingrediente anterior
        window.editandoIngredienteId = null;
        window.mostrarFormularioIngrediente?.();
    },
    'cerrar-form-ingrediente': () => window.cerrarFormularioIngrediente?.(),
    'importar-ingredientes': () => window.mostrarModalImportarIngredientes?.(),
    'exportar-ingredientes': () => window.exportarIngredientes?.(),
    'cancelar-importar-ingredientes': () => window.cancelarImportarIngredientes?.(),
    'confirmar-importar-ingredientes': () => window.confirmarImportarIngredientes?.(),
    'cerrar-modal-importar-ingredientes': () => closeModal('modal-importar-ingredientes'),

    // Recetas
    'mostrar-form-receta': () => window.mostrarFormularioReceta?.(),
    'cerrar-form-receta': () => window.cerrarFormularioReceta?.(),
    'importar-recetas': () => window.mostrarModalImportarRecetas?.(),
    'exportar-recetas': () => window.exportarRecetas?.(),
    'agregar-ingrediente-receta': () => window.agregarIngredienteReceta?.(),
    'cancelar-importar-recetas': () => window.cancelarImportarRecetas?.(),
    'confirmar-importar-recetas': () => window.confirmarImportarRecetas?.(),
    'cerrar-modal-importar-recetas': () => closeModal('modal-importar-recetas'),

    // Proveedores
    'mostrar-form-proveedor': () => window.mostrarFormularioProveedor?.(),
    'cerrar-form-proveedor': () => window.cerrarFormularioProveedor?.(),
    'cerrar-modal-proveedor': () => window.cerrarModalVerProveedor?.(),

    // Pedidos
    'mostrar-form-pedido': () => window.mostrarFormularioPedido?.(),
    'cerrar-form-pedido': () => window.cerrarFormularioPedido?.(),
    'agregar-linea-pedido': () => window.agregarLineaPedido?.(),
    'agregar-ingrediente-pedido': () => window.agregarIngredientePedido?.(),
    'importar-pedidos': () => window.mostrarModalImportarPedidos?.(),
    'cancelar-importar-pedidos': () => window.cancelarImportarPedidos?.(),
    'confirmar-importar-pedidos': () => window.confirmarImportarPedidos?.(),
    'cerrar-modal-importar-pedidos': () => closeModal('modal-importar-pedidos'),
    'cerrar-modal-pedido': () => window.cerrarModalVerPedido?.(),
    'descargar-pedido-pdf': () => window.descargarPedidoPDF?.(),
    'cerrar-modal-recibir-pedido': () => window.cerrarModalRecibirPedido?.(),
    'confirmar-recepcion-pedido': () => window.confirmarRecepcionPedido?.(),

    // Ventas
    'importar-ventas': () => window.mostrarModalImportarVentas?.(),
    'exportar-ventas': () => window.exportarVentas?.(),
    'filtrar-ventas': () => window.renderizarVentas?.(),
    'limpiar-filtros-ventas': () => {
        document.getElementById('ventas-fecha-desde').value = '';
        document.getElementById('ventas-fecha-hasta').value = '';
        window.renderizarVentas?.();
    },
    'cancelar-importar-ventas': () => window.cancelarImportarVentas?.(),
    'confirmar-importar-ventas': () => window.confirmarImportarVentas?.(),
    'cerrar-modal-importar-ventas': () => closeModal('modal-importar-ventas'),

    // Inventario
    'mostrar-modal-inventario-masivo': () => window.mostrarModalInventarioMasivo?.(),
    'guardar-cambios-stock': () => window.guardarCambiosStock?.(),
    'descargar-plantilla-stock': () => window.descargarPlantillaStock?.(),
    'cancelar-inventario-masivo': () => window.cancelarInventarioMasivo?.(),
    'confirmar-inventario-masivo': () => window.confirmarInventarioMasivo?.(),
    'cerrar-modal-inventario-masivo': () => closeModal('modal-inventario-masivo'),

    // Diario
    'cargar-resumen-mensual': () => window.cargarResumenMensual?.(),
    'exportar-diario-excel': () => window.exportarDiarioExcel?.(),

    // Producción
    'cerrar-modal-producir': () => window.cerrarModalProducir?.(),
    'confirmar-produccion': () => window.confirmarProduccion?.(),

    // Mermas
    'confirmar-mermas': () => window.confirmarMermasFinal?.(),
    'cerrar-modal-mermas': () => closeModal('modal-confirmar-mermas'),

    // Merma Rápida
    'mostrar-modal-merma-rapida': () => window.mostrarModalMermaRapida?.(),
    'cerrar-modal-merma-rapida': () => closeModal('modal-merma-rapida'),
    'confirmar-merma-rapida': () => window.confirmarMermaRapida?.(),

    // Evolución de Precios
    'cerrar-modal-evolucion-precio': () => closeModal('modal-evolucion-precio'),

    // Horarios
    'nuevo-empleado': () => window.nuevoEmpleado?.(),
    'cerrar-modal-empleado': () => window.cerrarModalEmpleado?.(),
    'guardar-empleado': () => window.guardarEmpleado?.(),
    'semana-anterior': () => window.semanaAnterior?.(),
    'semana-siguiente': () => window.semanaSiguiente?.(),
    'copiar-semana': () => window.copiarSemana?.(),
    'generar-horario-ia': () => window.generarHorarioIA?.(),

    // Configuración
    'abrir-manual-formulas': () => window.abrirManualFormulas?.(),
    'mostrar-modal-invitar': () => window.mostrarModalInvitar?.(),
    'invitar-usuario-equipo': () => window.invitarUsuarioEquipo?.(),
    'cerrar-modal-invitar': () => closeModal('modal-invitar-equipo'),
    'cerrar-form-gasto-fijo': () => window.cerrarFormularioGastoFijo?.(),

    // Confirmación modal
    'cancelar-confirmacion': () => window.cerrarConfirmacion?.(),

    // Toggle expand (BCG cards)
    'toggle-expand': e => {
        const expandable = e.target.closest('[data-action="toggle-expand"]');
        if (expandable) expandable.classList.toggle('expanded');
    },
};

/**
 * Close modal by ID
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

/**
 * Initialize all event bindings
 */
export function initEventBindings() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAllEvents);
    } else {
        bindAllEvents();
    }
}

function bindAllEvents() {
    // Main delegated click handler for data-action
    document.addEventListener('click', handleActionClick);

    // Tab navigation with data-tab
    document.addEventListener('click', handleTabClick);

    // Periodo buttons
    document.addEventListener('click', handlePeriodoClick);

    // Vista diario buttons
    document.addEventListener('click', handleVistaDiarioClick);

    // Form submissions
    bindFormSubmits();

    // Input changes
    bindInputChanges();
}

/**
 * Main click handler for data-action attributes
 */
function handleActionClick(e) {
    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const handler = actionHandlers[action];

    if (handler) {
        e.preventDefault();
        handler(e);
    }
}

/**
 * Tab navigation handler
 */
function handleTabClick(e) {
    const tabElement = e.target.closest('[data-tab]');
    if (!tabElement) return;

    const tabName = tabElement.dataset.tab;
    window.cambiarTab?.(tabName);
}

/**
 * Periodo button handler
 */
function handlePeriodoClick(e) {
    const periodoElement = e.target.closest('[data-periodo]');
    if (!periodoElement || periodoElement.dataset.action) return;

    const periodo = periodoElement.dataset.periodo;
    window.cambiarPeriodoVista?.(periodo);
}

/**
 * Vista diario handler
 */
function handleVistaDiarioClick(e) {
    const vistaElement = e.target.closest('[data-vista]');
    if (!vistaElement) return;

    const vista = vistaElement.dataset.vista;
    window.cambiarVistaDiario?.(vista);
}

/**
 * Bind form submissions
 */
function bindFormSubmits() {
    const forms = [
        { id: 'form-ingrediente', handler: () => window.guardarIngrediente?.() },
        { id: 'form-receta', handler: () => window.guardarReceta?.() },
        { id: 'form-proveedor', handler: () => window.guardarProveedor?.() },
        { id: 'login-form', handler: () => window.login?.() },
    ];

    forms.forEach(({ id, handler }) => {
        const form = document.getElementById(id);
        if (form) {
            form.addEventListener('submit', e => {
                e.preventDefault();
                handler();
            });
        }
    });
}

/**
 * Bind input change events
 */
function bindInputChanges() {
    const precioVenta = document.getElementById('rec-precio_venta');
    if (precioVenta) {
        precioVenta.addEventListener('change', () => window.calcularCosteReceta?.());
        precioVenta.addEventListener('input', () => window.calcularCosteReceta?.());
    }
}

/**
 * Toggle dark/light theme
 */
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('costos_theme', newTheme);

    // Update icon
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
}

/**
 * Initialize theme from localStorage
 */
function initTheme() {
    const savedTheme = localStorage.getItem('costos_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// Initialize theme on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
