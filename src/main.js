/**
 * ============================================
 * main.js - Punto de Entrada de MindLoop CostOS
 * ============================================
 *
 * Este archivo es el CONTROLADOR CENTRAL de la aplicación.
 *
 * ARQUITECTURA:
 * - Los módulos ES6 en src/modules/ contienen la lógica
 * - Este archivo expone las funciones en window.* para
 *   compatibilidad con los onclick en index.html
 * - Al cargarse DESPUÉS del código inline de index.html,
 *   las funciones aquí SOBRESCRIBEN las legacy
 *
 * MANTENIMIENTO:
 * - Para modificar funcionalidad, edita el módulo ES6
 * - No edites el código legacy en index.html
 * - Ver ARQUITECTURA.md para más detalles
 *
 * @author MindLoopIA
 * @version 2.0.0 (Arquitectura Modular)
 * @date 2025-12-21
 */

// ============================================
// 🔒 SECURITY: Restore auth token from sessionStorage
// Must happen BEFORE any module imports that make API calls
// sessionStorage survives page reload but clears on tab close
// ============================================
if (typeof window !== 'undefined' && !window.authToken) {
    const savedToken = sessionStorage.getItem('_at');
    if (savedToken) window.authToken = savedToken;
}

// 🔒 SECURITY: Global auth cleanup on session expiry
// Reset redirect flag on page load (fresh start)
window._authRedirecting = false;
window.addEventListener('auth:expired', () => {
    window.authToken = null;
    sessionStorage.removeItem('_at');
    localStorage.removeItem('user');
    if (window.stopTokenRefresh) window.stopTokenRefresh();
});

// ============================================
// VENDORS - Bibliotecas externas (npm, no CDN)
// ============================================
import './vendors.js';

// ============================================
// CSS DE COMPONENTES - Estilos para componentes Clean Architecture
// ============================================
import './styles/components/alert-panel.css';
import './styles/components/kpi-dashboard.css';
import './styles/components/cost-breakdown.css';
import './styles/components/quick-actions.css';

// ============================================
// CONFIGURACIÓN GLOBAL - Multi-tenant
// ⚡ Exponer ANTES de cualquier código legacy
// ============================================
import { appConfig, getApiUrl, getAuthUrl, getApiBaseUrl } from './config/app-config.js';

// Exponer para legacy files que no usan ES modules
window.API_CONFIG = appConfig.api;
window.getApiUrl = getApiUrl;
window.getAuthUrl = getAuthUrl;
window.getApiBaseUrl = getApiBaseUrl;

// ============================================
// API CLIENT - Cliente de API para backend
// ============================================
import './services/api.js';

// AlertPanel - Modal de gestión de alertas
import { loadAlertPanel } from './components/domain/AlertPanel.js';

// ============================================
// CORE - Funciones centrales (cargarDatos, cambiarTab, init)
// ============================================
import * as Core from './modules/core/core.js';

window.cargarDatos = Core.cargarDatos;
window.cambiarTab = Core.cambiarTab;
window.init = Core.init;
window.inicializarFechaActual = Core.inicializarFechaActual;

// ============================================
// UTILIDADES CORE
// ============================================
import { showToast } from './ui/toast.js';
import { initEventBindings } from './ui/event-bindings.js';
import * as DOM from './utils/dom-helpers.js';
import * as Helpers from './utils/helpers.js';
import * as Performance from './utils/performance.js';
import { initSearchOptimizations } from './utils/search-optimization.js';
// 🆕 Error handler global
import './utils/error-handler.js';
// 🔒 Sentry init centralizado (DSN sacado de index.html)
import { initSentry } from './utils/sentry.js';
initSentry();

window.showToast = showToast;
window.DOM = DOM;
Object.assign(window, DOM);

// Sistema de optimización y rendimiento
window.Performance = Performance;
window.dataMaps = Performance.dataMaps;

// Inicializar event bindings (reemplaza todos los onclick inline)
initEventBindings();

// Inicializar optimizaciones de búsqueda con debouncing
initSearchOptimizations();

// Inicializar búsqueda global (Cmd+K)
import { initGlobalSearch } from './modules/search/global-search.js';
// Wait for DOM and data to be ready
setTimeout(() => initGlobalSearch(), 2000);

// Evolución de precios de ingredientes
import { verEvolucionPrecio } from './modules/ingredientes/evolucion-precio.js';
import { setupYieldSlider } from './modules/ingredientes/ingredientes-ui.js';
window.verEvolucionPrecio = verEvolucionPrecio;
window.setupYieldSlider = setupYieldSlider;

// Sales Forecast (predicción)
import { calcularForecast, renderForecastChart } from './modules/analytics/forecast.js';
window.calcularForecast = calcularForecast;
window.renderForecastChart = renderForecastChart;



// Utilidades adicionales
window.showLoading = Helpers.showLoading;
window.hideLoading = Helpers.hideLoading;
window.exportarAExcel = Helpers.exportarAExcel;
window.formatCurrency = Helpers.formatCurrency;
window.formatDate = Helpers.formatDate;

// Funciones de calendario
window.getFechaHoy = Helpers.getFechaHoy;
window.getFechaHoyFormateada = Helpers.getFechaHoyFormateada;
window.getPeriodoActual = Helpers.getPeriodoActual;
window.getRangoFechas = Helpers.getRangoFechas;
window.filtrarPorPeriodo = Helpers.filtrarPorPeriodo;
window.compararConSemanaAnterior = Helpers.compararConSemanaAnterior;
window.calcularDiasDeStock = Helpers.calcularDiasDeStock;
window.proyeccionConsumo = Helpers.proyeccionConsumo;

// ============================================
// MÓDULO: INGREDIENTES ✅ (Legacy comentado)
// ============================================
import * as IngredientesUI from './modules/ingredientes/ingredientes-ui.js';
import * as IngredientesCRUD from './modules/ingredientes/ingredientes-crud.js';
import * as IngredientesProveedores from './modules/ingredientes/ingredientes-proveedores.js';

// UI
window.renderizarIngredientes = IngredientesUI.renderizarIngredientes;
window.mostrarFormularioIngrediente = IngredientesUI.mostrarFormularioIngrediente;
window.cerrarFormularioIngrediente = IngredientesUI.cerrarFormularioIngrediente;
window.exportarIngredientes = IngredientesUI.exportarIngredientes;

// CRUD
window.guardarIngrediente = IngredientesCRUD.guardarIngrediente;
window.editarIngrediente = IngredientesCRUD.editarIngrediente;
window.eliminarIngrediente = IngredientesCRUD.eliminarIngrediente;

// Proveedores por ingrediente
window.gestionarProveedoresIngrediente = IngredientesProveedores.gestionarProveedoresIngrediente;
window.agregarProveedorIngrediente = IngredientesProveedores.agregarProveedorIngrediente;
window.marcarProveedorPrincipal = IngredientesProveedores.marcarProveedorPrincipal;
window.editarPrecioProveedor = IngredientesProveedores.editarPrecioProveedor;
window.eliminarProveedorIngrediente = IngredientesProveedores.eliminarProveedorIngrediente;
window.cerrarModalProveedoresIngrediente = IngredientesProveedores.cerrarModalProveedoresIngrediente;

// ============================================
// MÓDULO: RECETAS ✅ (Legacy comentado)
// ============================================
import * as RecetasUI from './modules/recetas/recetas-ui.js';
import * as RecetasCRUD from './modules/recetas/recetas-crud.js';

// UI
window.renderizarRecetas = RecetasUI.renderizarRecetas;
window.mostrarFormularioReceta = RecetasUI.mostrarFormularioReceta;
window.cerrarFormularioReceta = RecetasUI.cerrarFormularioReceta;
window.agregarIngredienteReceta = RecetasUI.agregarIngredienteReceta;
window.calcularCosteReceta = RecetasUI.calcularCosteReceta;
window.exportarRecetas = RecetasUI.exportarRecetas;

// CRUD
window.guardarReceta = RecetasCRUD.guardarReceta;
window.editarReceta = RecetasCRUD.editarReceta;
window.eliminarReceta = RecetasCRUD.eliminarReceta;
window.calcularCosteRecetaCompleto = RecetasCRUD.calcularCosteRecetaCompleto;

// Producción
window.abrirModalProducir = RecetasCRUD.abrirModalProducir;
window.cerrarModalProducir = RecetasCRUD.cerrarModalProducir;
window.actualizarDetalleDescuento = RecetasCRUD.actualizarDetalleDescuento;
window.confirmarProduccion = RecetasCRUD.confirmarProduccion;

// Cost Tracker (seguimiento de costes)
import * as CostTracker from './modules/recetas/cost-tracker.js';
window.mostrarCostTracker = CostTracker.mostrarCostTracker;
window.cerrarCostTracker = CostTracker.cerrarCostTracker;

// Escandallo Visual + PDF Export
import * as Escandallo from './modules/recetas/escandallo.js';
window.verEscandallo = Escandallo.verEscandallo;
window.exportarPDFEscandallo = Escandallo.exportarPDFEscandallo;

// Dossier Técnico v2.4 (documentación profesional)
import { abrirDossier } from './modules/docs/dossier-v24.js';
window.abrirDossierV24 = abrirDossier;
window.abrirManualFormulas = abrirDossier; // Alias para compatibilidad

// Variantes de receta (botella/copa para vinos)
import * as RecetasVariantes from './modules/recetas/recetas-variantes.js';
window.gestionarVariantesReceta = RecetasVariantes.gestionarVariantesReceta;
window.agregarVarianteReceta = RecetasVariantes.agregarVarianteReceta;
window.editarVariante = RecetasVariantes.editarVariante;
window.eliminarVariante = RecetasVariantes.eliminarVariante;
window.cerrarModalVariantes = RecetasVariantes.cerrarModalVariantes;

// ============================================
// MÓDULO: PROVEEDORES ✅ (Legacy comentado)
// ============================================
import * as ProveedoresUI from './modules/proveedores/proveedores-ui.js';
import * as ProveedoresCRUD from './modules/proveedores/proveedores-crud.js';

// UI
window.renderizarProveedores = ProveedoresUI.renderizarProveedores;
window.mostrarFormularioProveedor = ProveedoresUI.mostrarFormularioProveedor;
window.cerrarFormularioProveedor = ProveedoresUI.cerrarFormularioProveedor;
window.cargarIngredientesProveedor = ProveedoresUI.cargarIngredientesProveedor;
window.filtrarIngredientesProveedor = ProveedoresUI.filtrarIngredientesProveedor;
window.verProveedorDetalles = ProveedoresUI.verProveedorDetalles;
window.cerrarModalVerProveedor = ProveedoresUI.cerrarModalVerProveedor;

// CRUD
window.guardarProveedor = ProveedoresCRUD.guardarProveedor;
window.editarProveedor = ProveedoresCRUD.editarProveedor;
window.eliminarProveedor = ProveedoresCRUD.eliminarProveedor;

// ============================================
// MÓDULO: PEDIDOS ✅ (Migrado completamente)
// ============================================
import * as PedidosUI from './modules/pedidos/pedidos-ui.js';
import * as PedidosCRUD from './modules/pedidos/pedidos-crud.js';
import './modules/pedidos/pedidos-cart.js'; // Carrito de pedidos - expone funciones en window

// UI
window.renderizarPedidos = PedidosUI.renderizarPedidos;
window.exportarPedidos = PedidosUI.exportarPedidos;
window.mostrarFormularioPedido = PedidosUI.mostrarFormularioPedido;
window.cerrarFormularioPedido = PedidosUI.cerrarFormularioPedido;
window.cargarIngredientesPedido = PedidosUI.cargarIngredientesPedido;
window.agregarIngredientePedido = PedidosUI.agregarIngredientePedido;
window.calcularTotalPedido = PedidosUI.calcularTotalPedido;

// CRUD - Todas las funciones
window.guardarPedido = PedidosCRUD.guardarPedido;
window.eliminarPedido = PedidosCRUD.eliminarPedido;
window.marcarPedidoRecibido = PedidosCRUD.marcarPedidoRecibido;
window.cerrarModalRecibirPedido = PedidosCRUD.cerrarModalRecibirPedido;
window.confirmarRecepcionPedido = PedidosCRUD.confirmarRecepcionPedido;
window.verDetallesPedido = PedidosCRUD.verDetallesPedido;
window.cerrarModalVerPedido = PedidosCRUD.cerrarModalVerPedido;
window.descargarPedidoPDF = PedidosCRUD.descargarPedidoPDF;
window.actualizarItemRecepcion = PedidosCRUD.actualizarItemRecepcion;
window.cambiarEstadoItem = PedidosCRUD.cambiarEstadoItem;

// Compras Pendientes (cola de revisión de albaranes importados)
import * as ComprasPendientesUI from './modules/pedidos/compras-pendientes-ui.js';

window.renderizarComprasPendientes = ComprasPendientesUI.renderizarComprasPendientes;
window.aprobarItemPendiente = ComprasPendientesUI.aprobarItemPendiente;
window.aprobarBatchPendiente = ComprasPendientesUI.aprobarBatchPendiente;
window.cambiarIngredientePendiente = ComprasPendientesUI.cambiarIngredientePendiente;
window.rechazarItemPendiente = ComprasPendientesUI.rechazarItemPendiente;
window.editarCampoPendiente = ComprasPendientesUI.editarCampoPendiente;
window.editarTotalPendiente = ComprasPendientesUI.editarTotalPendiente;
window.checkPendientes = ComprasPendientesUI.checkPendientes;

// Cargar pendientes al abrir pestaña Pedidos y al login
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => ComprasPendientesUI.checkPendientes(), 3000);
});

// ============================================
// MÓDULO: VENTAS ⚙️ (Híbrido - ES6 tiene prioridad)
// ============================================
import * as VentasUI from './modules/ventas/ventas-ui.js';
import * as VentasCRUD from './modules/ventas/ventas-crud.js';

// UI
window.renderizarVentas = VentasUI.renderizarVentas;
window.exportarVentas = VentasUI.exportarVentas;
window.cargarVariantesVenta = VentasUI.cargarVariantesVenta; // Selector de variantes en ventas

// CRUD
window.eliminarVenta = VentasCRUD.eliminarVenta;

// ============================================
// MÓDULO: DASHBOARD ⚙️ (Híbrido - ES6 tiene prioridad)
// ============================================
import * as Dashboard from './modules/dashboard/dashboard.js';

window.actualizarKPIs = Dashboard.actualizarKPIs;

// ============================================
// MÓDULO: BALANCE / P&L 💰
// ============================================
import * as Balance from './modules/balance/index.js';

window.renderizarBalance = Balance.renderizarBalance;
window.calcularPL = Balance.calcularPL;

// ============================================
// MÓDULO: SIMULADOR FINANCIERO 📊
// ============================================
import * as Simulador from './modules/simulador/index.js';

window.actualizarSimulador = Simulador.actualizarSimulador;

// ============================================
// MÓDULO: HORARIOS 👥 (MindLoop Staff Scheduler)
// ============================================
import * as Horarios from './modules/horarios/horarios.js';

window.initHorarios = Horarios.initHorarios;

// ============================================
// MÓDULO: MERMA RÁPIDA 🗑️
// ============================================
import * as MermaRapida from './modules/inventario/merma-rapida.js';

window.mostrarModalMermaRapida = MermaRapida.mostrarModalMermaRapida;
window.confirmarMermaRapida = MermaRapida.confirmarMermaRapida;
window.confirmarMermasMultiples = MermaRapida.confirmarMermasMultiples;
window.agregarLineaMerma = MermaRapida.agregarLineaMerma;
window.eliminarLineaMerma = MermaRapida.eliminarLineaMerma;
window.actualizarLineaMerma = MermaRapida.actualizarLineaMerma;
window.procesarFotoMerma = MermaRapida.procesarFotoMerma;
window.procesarFotoMermaInput = MermaRapida.procesarFotoMermaInput;

// Historial de Mermas
window.verHistorialMermas = function () {
    const modal = document.getElementById('modal-historial-mermas');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        // Seleccionar mes actual
        const mesActual = new Date().getMonth() + 1;
        const anoActual = new Date().getFullYear();
        document.getElementById('mermas-mes').value = mesActual;
        document.getElementById('mermas-ano').value = anoActual;
        window.cargarHistorialMermas();
    }
};

// 🔒 FIX SEGURIDAD: Función para sanitizar HTML y prevenir XSS
function escapeHTMLMain(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, char => map[char]);
}

// 🔒 FIX: Función para validar números y evitar NaN en UI
function safeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

window.cargarHistorialMermas = async function () {
    const mes = document.getElementById('mermas-mes')?.value;
    const ano = document.getElementById('mermas-ano')?.value;
    const tbody = document.getElementById('tabla-historial-mermas-body');

    console.log('📋 cargarHistorialMermas - mes:', mes, 'año:', ano);

    if (!tbody) {
        console.error('❌ tabla-historial-mermas-body no encontrado');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">Cargando...</td></tr>';

    try {
        console.log('📡 Llamando a API.getMermas...');
        const mermas = await window.API?.getMermas?.(mes, ano) || [];
        console.log('📥 Respuesta getMermas:', mermas, '(tipo:', typeof mermas, ', length:', mermas.length, ')');

        if (mermas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #94a3b8;">No hay mermas registradas en este período</td></tr>';
            document.getElementById('mermas-total-valor').textContent = '0.00€';
            document.getElementById('mermas-total-registros').textContent = '0';
            document.getElementById('mermas-motivo-principal').textContent = '-';
            return;
        }

        // Calcular totales
        let totalValor = 0;
        const motivosCont = {};

        let html = '';
        mermas.forEach(m => {
            // 🔒 FIX: Usar safeNumber para evitar NaN
            totalValor += safeNumber(m.valor_perdida, 0);
            const motivo = m.motivo || 'Otros';
            motivosCont[motivo] = (motivosCont[motivo] || 0) + 1;

            const fecha = m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES') : '-';
            const cantidad = Math.abs(safeNumber(m.cantidad, 0)).toFixed(2);
            const valor = safeNumber(m.valor_perdida, 0).toFixed(2);

            // 🔒 FIX SEGURIDAD: Sanitizar datos del servidor para prevenir XSS
            const ingredienteNombre = escapeHTMLMain(m.ingrediente_nombre || m.ingrediente_actual || 'N/A');
            const unidad = escapeHTMLMain(m.unidad || '');
            const motivoSafe = escapeHTMLMain(motivo);
            const nota = escapeHTMLMain(m.nota || '-');

            html += `<tr style="border-bottom: 1px solid #f1f5f9;" data-merma-id="${m.id}">
                <td style="padding: 10px;">${fecha}</td>
                <td style="padding: 10px;"><strong>${ingredienteNombre}</strong></td>
                <td style="padding: 10px;">${cantidad} ${unidad}</td>
                <td style="padding: 10px; color: #ef4444; font-weight: 600;">${valor}€</td>
                <td style="padding: 10px;"><span style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 12px;">${motivoSafe}</span></td>
                <td style="padding: 10px; color: #64748b; font-size: 12px;">${nota}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="window.eliminarMerma(${m.id})" 
                        style="background: #fee2e2; color: #dc2626; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px;"
                        title="Eliminar merma y restaurar stock">🗑️</button>
                </td>
            </tr>`;
        });

        tbody.innerHTML = html;

        // Actualizar resumen
        document.getElementById('mermas-total-valor').textContent = totalValor.toFixed(2) + '€';
        document.getElementById('mermas-total-registros').textContent = mermas.length;

        // Motivo principal
        let motivoPrincipal = '-';
        let maxCount = 0;
        for (const [motivo, count] of Object.entries(motivosCont)) {
            if (count > maxCount) {
                maxCount = count;
                motivoPrincipal = motivo;
            }
        }
        document.getElementById('mermas-motivo-principal').textContent = motivoPrincipal;

    } catch (error) {
        console.error('Error cargando mermas:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #ef4444;">Error al cargar datos</td></tr>';
    }
};

// Función para eliminar una merma individual (restaura stock)
window.eliminarMerma = async function (id) {
    if (!confirm('¿Eliminar esta merma? El stock del ingrediente se restaurará automáticamente.')) {
        return;
    }

    try {
        window.showLoading?.();
        const response = await window.API?.fetch(`/api/mermas/${id}`, { method: 'DELETE' });

        if (response?.success) {
            window.showToast?.('✅ Merma eliminada y stock restaurado', 'success');
            // Recargar historial y datos
            await window.cargarHistorialMermas();
            window.ingredientes = await window.api?.getIngredientes?.();
            window.renderizarIngredientes?.();
            window.renderizarInventario?.();
        } else {
            throw new Error(response?.error || 'Error desconocido');
        }
    } catch (error) {
        console.error('Error eliminando merma:', error);
        window.showToast?.('Error eliminando merma: ' + error.message, 'error');
    } finally {
        window.hideLoading?.();
    }
};

// ============================================
// MÓDULO: EXPORT PDF
// ============================================
import * as PDFGenerator from './modules/export/pdf-generator.js';
import { descargarPDFReceta } from './modules/export/pdf-helper.js';

window.generarPDFReceta = PDFGenerator.generarPDFReceta;
window.generarPDFIngredientes = PDFGenerator.generarPDFIngredientes;
window.descargarPDFReceta = descargarPDFReceta;

// ============================================
// VARIABLES GLOBALES DE ESTADO
// ============================================
window.editandoIngredienteId = null;
window.editandoRecetaId = null;
window.editandoPedidoId = null;
window.editandoProveedorId = null;

// ============================================
// MÓDULO: AUTENTICACIÓN ✅
// ============================================
import * as Auth from './modules/auth/auth.js';

window.checkAuth = Auth.checkAuth;
window.mostrarLogin = Auth.mostrarLogin;
window.mostrarRegistro = Auth.mostrarRegistro;
window.volverALogin = Auth.volverALogin;
window.logout = Auth.logout;

// Inicializar formularios de login y registro
Auth.initLoginForm();
Auth.initRegisterForm();

// ============================================
// MÓDULO: EQUIPO ✅
// ============================================
import * as Equipo from './modules/equipo/equipo.js';

window.renderizarEquipo = Equipo.renderizarEquipo;
window.mostrarModalInvitar = Equipo.mostrarModalInvitar;
window.cerrarModalInvitar = Equipo.cerrarModalInvitar;
window.invitarUsuarioEquipo = Equipo.invitarUsuarioEquipo;
window.eliminarUsuarioEquipo = Equipo.eliminarUsuarioEquipo;

// ============================================
// MÓDULO: CHAT IA 🤖
// ============================================
import { initChatWidget, clearChatHistory } from './modules/chat/chat-widget.js';

// Inicializar chat cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatWidget);
} else {
    setTimeout(initChatWidget, 1000); // Esperar a que cargue todo
}

window.clearChatHistory = clearChatHistory;

// ============================================
// MÓDULO: INTEGRACIONES 🔗
// ============================================
import { checkAllIntegrations, initIntegrations } from './modules/integrations/integrations-status.js';

window.checkAllIntegrations = checkAllIntegrations;
window.initIntegrations = initIntegrations;

// ============================================
// LOG DE INICIALIZACIÓN (solo en desarrollo)
// ============================================
if (import.meta.env?.DEV || window.location.hostname === 'localhost') {
    console.log('');
    console.log('🚀 MindLoop CostOS v2.0.0');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Módulo Ingredientes - ACTIVO');
    console.log('✅ Módulo Recetas - ACTIVO');
    console.log('✅ Módulo Proveedores - ACTIVO');
    console.log('✅ Módulo Pedidos - ACTIVO');
    console.log('✅ Módulo Ventas - ACTIVO');
    console.log('✅ Módulo Dashboard - ACTIVO');
    console.log('✅ Módulo Export PDF - ACTIVO');
    console.log('✅ Módulo Chat IA - ACTIVO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Todos los módulos cargados');
    console.log('');
}

// ============================================
// PWA - SERVICE WORKER REGISTRATION
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('✅ Service Worker registrado:', registration.scope);
            })
            .catch((error) => {
                console.warn('⚠️ Service Worker no registrado:', error);
            });
    });
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================
// Verificar autenticación y cargar datos al iniciar
(async () => {
    try {
        await Auth.checkAuth();
    } catch (e) {
        console.error('Error en inicialización:', e);
    }
})();

// ============================================
// ALERT BADGE - Sistema de notificación de alertas v2
// ============================================
async function updateAlertBadge() {
    try {
        if (!window.API?.getAlertStats) return;

        const stats = await window.API.getAlertStats();
        const badgeId = 'alert-badge-v2';
        let badge = document.getElementById(badgeId);

        const activeCount = stats?.data?.activeCount || 0;

        if (activeCount > 0) {
            if (!badge) {
                const alertBtn = document.createElement('button');
                alertBtn.id = badgeId;
                alertBtn.className = 'alert-badge';
                alertBtn.title = 'Ver alertas activas';
                alertBtn.innerHTML = `🔔 <span class="badge-count">${activeCount}</span>`;
                alertBtn.onclick = () => showAlertModal();

                // Insertar en header
                const header = document.querySelector('header') ||
                    document.querySelector('.header') ||
                    document.querySelector('.nav-header');
                if (header) header.appendChild(alertBtn);
            } else {
                badge.querySelector('.badge-count').textContent = activeCount;
                badge.style.display = 'flex';
            }
        } else if (badge) {
            badge.style.display = 'none';
        }
    } catch (e) {
        // Silenciosamente ignorar errores - alertas no críticas para UI
        console.log('Alertas no disponibles:', e.message);
    }
}

// 🔒 FIX BUG-6: Escape listener global (solo una vez, no dentro de showAlertModal)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAlertModal();
});

// Función para mostrar modal de alertas
function showAlertModal() {
    // Crear modal si no existe
    let modal = document.getElementById('alert-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'alert-modal';
        modal.className = 'alert-modal';
        modal.innerHTML = `
            <div class="alert-modal__content">
                <button class="alert-modal__close" onclick="window.closeAlertModal()">&times;</button>
                <div id="alert-panel-container"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // Cerrar al hacer clic fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeAlertModal();
        });
    }

    modal.style.display = 'flex';
    loadAlertPanel(document.getElementById('alert-panel-container'));
}

function closeAlertModal() {
    const modal = document.getElementById('alert-modal');
    if (modal) modal.style.display = 'none';
}

// 🔒 FIX BUG-2: Solo inicializar alertBadge si hay sesión activa
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // 🔒 SECURITY: httpOnly cookie can't be read by JS, use 'user' as session proxy
        if (localStorage.getItem('user')) {
            updateAlertBadge();
        }
    }, 3000);
});

// 🔒 FIX: Guard interval behind auth + prevent accumulation
if (window._alertBadgeInterval) {
    clearInterval(window._alertBadgeInterval);
}
window._alertBadgeInterval = setInterval(() => {
    // 🔒 SECURITY: httpOnly cookie can't be read by JS, use 'user' as session proxy
    if (localStorage.getItem('user')) {
        updateAlertBadge();
    }
}, 5 * 60 * 1000);

// Exponer para actualización manual
window.updateAlertBadge = updateAlertBadge;
window.showAlertModal = showAlertModal;
window.closeAlertModal = closeAlertModal;
