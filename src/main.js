/**
 * main.js - Punto de entrada de la aplicación
 * Carga todos los módulos necesarios
 */

// Importar utilidades
import { showToast } from './ui/toast.js';
import * as DOM from './utils/dom-helpers.js';

// Importar módulo de ingredientes
import * as IngredientesUI from './modules/ingredientes/ingredientes-ui.js';
import * as IngredientesCRUD from './modules/ingredientes/ingredientes-crud.js';

// Importar módulo de recetas
import * as RecetasUI from './modules/recetas/recetas-ui.js';
import * as RecetasCRUD from './modules/recetas/recetas-crud.js';

// Importar módulo de pedidos
import * as PedidosUI from './modules/pedidos/pedidos-ui.js';
import * as PedidosCRUD from './modules/pedidos/pedidos-crud.js';

// Importar módulo de proveedores
import * as ProveedoresUI from './modules/proveedores/proveedores-ui.js';
import * as ProveedoresCRUD from './modules/proveedores/proveedores-crud.js';

// Importar módulo de ventas
import * as VentasUI from './modules/ventas/ventas-ui.js';
import * as VentasCRUD from './modules/ventas/ventas-crud.js';

// Importar módulo de dashboard
import * as Dashboard from './modules/dashboard/dashboard.js';

// Hacer disponibles globalmente para compatibilidad con código existente
window.showToast = showToast;
window.DOM = DOM;

// Exponer funciones DOM individuales en window para compatibilidad
Object.assign(window, DOM);

// Exponer módulo de ingredientes globalmente
window.renderizarIngredientes = IngredientesUI.renderizarIngredientes;
window.mostrarFormularioIngrediente = IngredientesUI.mostrarFormularioIngrediente;
window.cerrarFormularioIngrediente = IngredientesUI.cerrarFormularioIngrediente;
window.exportarIngredientes = IngredientesUI.exportarIngredientes;

window.guardarIngrediente = IngredientesCRUD.guardarIngrediente;
window.editarIngrediente = IngredientesCRUD.editarIngrediente;
window.eliminarIngrediente = IngredientesCRUD.eliminarIngrediente;

// Exponer módulo de recetas globalmente
window.renderizarRecetas = RecetasUI.renderizarRecetas;
window.mostrarFormularioReceta = RecetasUI.mostrarFormularioReceta;
window.cerrarFormularioReceta = RecetasUI.cerrarFormularioReceta;
window.agregarIngredienteReceta = RecetasUI.agregarIngredienteReceta;
window.calcularCosteReceta = RecetasUI.calcularCosteReceta;
window.exportarRecetas = RecetasUI.exportarRecetas;

window.guardarReceta = RecetasCRUD.guardarReceta;
window.editarReceta = RecetasCRUD.editarReceta;
window.eliminarReceta = RecetasCRUD.eliminarReceta;
window.calcularCosteRecetaCompleto = RecetasCRUD.calcularCosteRecetaCompleto;
window.abrirModalProducir = RecetasCRUD.abrirModalProducir;
window.cerrarModalProducir = RecetasCRUD.cerrarModalProducir;
window.actualizarDetalleDescuento = RecetasCRUD.actualizarDetalleDescuento;
window.confirmarProduccion = RecetasCRUD.confirmarProduccion;

// Exponer módulo de pedidos globalmente
window.renderizarPedidos = PedidosUI.renderizarPedidos;
window.mostrarFormularioPedido = PedidosUI.mostrarFormularioPedido;
window.cerrarFormularioPedido = PedidosUI.cerrarFormularioPedido;
window.cargarIngredientesPedido = PedidosUI.cargarIngredientesPedido;
window.agregarIngredientePedido = PedidosUI.agregarIngredientePedido;
window.calcularTotalPedido = PedidosUI.calcularTotalPedido;
window.exportarPedidos = PedidosUI.exportarPedidos;

window.guardarPedido = PedidosCRUD.guardarPedido;
window.eliminarPedido = PedidosCRUD.eliminarPedido;
window.marcarPedidoRecibido = PedidosCRUD.marcarPedidoRecibido;
window.cerrarModalRecibirPedido = PedidosCRUD.cerrarModalRecibirPedido;
window.confirmarRecepcionPedido = PedidosCRUD.confirmarRecepcionPedido;
window.verDetallesPedido = PedidosCRUD.verDetallesPedido;
window.cerrarModalVerPedido = PedidosCRUD.cerrarModalVerPedido;
window.descargarPedidoPDF = PedidosCRUD.descargarPedidoPDF;

// Variables globales para tracking
window.editandoIngredienteId = null;
window.editandoRecetaId = null;
window.editandoPedidoId = null;
window.editandoProveedorId = null;

console.log('✅ Módulos cargados correctamente');
console.log('✅ Módulo Ingredientes integrado');
console.log('✅ Módulo Recetas integrado');
console.log('✅ Módulo Pedidos integrado');
console.log('✅ Módulo Proveedores integrado');

// Exponer módulo de proveedores globalmente
window.renderizarProveedores = ProveedoresUI.renderizarProveedores;
window.mostrarFormularioProveedor = ProveedoresUI.mostrarFormularioProveedor;
window.cerrarFormularioProveedor = ProveedoresUI.cerrarFormularioProveedor;
window.cargarIngredientesProveedor = ProveedoresUI.cargarIngredientesProveedor;
window.filtrarIngredientesProveedor = ProveedoresUI.filtrarIngredientesProveedor;
window.verProveedorDetalles = ProveedoresUI.verProveedorDetalles;
window.cerrarModalVerProveedor = ProveedoresUI.cerrarModalVerProveedor;

window.guardarProveedor = ProveedoresCRUD.guardarProveedor;
window.editarProveedor = ProveedoresCRUD.editarProveedor;
window.eliminarProveedor = ProveedoresCRUD.eliminarProveedor;

// Exponer módulo de ventas globalmente
window.renderizarVentas = VentasUI.renderizarVentas;
window.exportarVentas = VentasUI.exportarVentas;

window.eliminarVenta = VentasCRUD.eliminarVenta;
console.log('✅ Módulo Ventas integrado');

// Exponer módulo de dashboard globalmente
window.actualizarKPIs = Dashboard.actualizarKPIs;
console.log('✅ Módulo Dashboard integrado');
