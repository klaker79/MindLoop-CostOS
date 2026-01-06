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
// VENDORS - Bibliotecas externas (npm, no CDN)
// ============================================
import './vendors.js';

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
window.verEvolucionPrecio = verEvolucionPrecio;

// Sales Forecast (predicción)
import { calcularForecast, renderForecastChart } from './modules/analytics/forecast.js';
window.calcularForecast = calcularForecast;
window.renderForecastChart = renderForecastChart;

// Onboarding Tour (guía para nuevos usuarios)
import { initOnboarding } from './modules/ui/onboarding.js';
// Initialize after data loads
setTimeout(() => initOnboarding(), 3000);

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

// UI
window.renderizarIngredientes = IngredientesUI.renderizarIngredientes;
window.mostrarFormularioIngrediente = IngredientesUI.mostrarFormularioIngrediente;
window.cerrarFormularioIngrediente = IngredientesUI.cerrarFormularioIngrediente;
window.exportarIngredientes = IngredientesUI.exportarIngredientes;

// CRUD
window.guardarIngrediente = IngredientesCRUD.guardarIngrediente;
window.editarIngrediente = IngredientesCRUD.editarIngrediente;
window.eliminarIngrediente = IngredientesCRUD.eliminarIngrediente;

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

// ============================================
// MÓDULO: VENTAS ⚙️ (Híbrido - ES6 tiene prioridad)
// ============================================
import * as VentasUI from './modules/ventas/ventas-ui.js';
import * as VentasCRUD from './modules/ventas/ventas-crud.js';

// UI
window.renderizarVentas = VentasUI.renderizarVentas;
window.exportarVentas = VentasUI.exportarVentas;

// CRUD
window.eliminarVenta = VentasCRUD.eliminarVenta;

// ============================================
// MÓDULO: DASHBOARD ⚙️ (Híbrido - ES6 tiene prioridad)
// ============================================
import * as Dashboard from './modules/dashboard/dashboard.js';

window.actualizarKPIs = Dashboard.actualizarKPIs;

// ============================================
// MÓDULO: MERMA RÁPIDA 🗑️
// ============================================
import * as MermaRapida from './modules/inventario/merma-rapida.js';

window.mostrarModalMermaRapida = MermaRapida.mostrarModalMermaRapida;
window.confirmarMermaRapida = MermaRapida.confirmarMermaRapida;

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
window.logout = Auth.logout;

// Inicializar formulario de login
Auth.initLoginForm();

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
