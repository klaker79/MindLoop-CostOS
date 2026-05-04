/**
 * Pedidos CRUD Module
 * Funciones de crear y eliminar pedidos
 *
 * Las demás funciones han sido extraídas a módulos especializados:
 * - pedidos-recepcion.js: Flujo de recepción con varianza
 * - pedidos-detalles.js: Ver detalles en modal
 * - pedidos-export.js: PDF y WhatsApp
 */

import { t } from '@/i18n/index.js';
import { cm } from '../../utils/helpers.js';

// Guard anti-doble-click: evita que guardarPedido se ejecute dos veces seguidas.
// Se resetea siempre en el finally para no dejar bloqueado el botón.
let isCreatingOrder = false;

// Re-exportar funciones de los módulos especializados
export {
  marcarPedidoRecibido,
  actualizarItemRecepcion,
  actualizarPrecioIngredienteRecepcion,
  cambiarEstadoItem,
  cerrarModalRecibirPedido,
  confirmarRecepcionPedido
} from './pedidos-recepcion.js';

export {
  verDetallesPedido,
  cerrarModalVerPedido
} from './pedidos-detalles.js';

export {
  descargarPedidoPDF,
  enviarPedidoWhatsApp
} from './pedidos-export.js';

/**
 * Guarda un nuevo pedido
 * @param {Event} event - Evento del formulario
 */
export async function guardarPedido(event) {
  event.preventDefault();

  // Bloqueo anti-doble-click: si ya hay una creación en curso, ignorar.
  if (isCreatingOrder) {
    console.warn('Creación de pedido ya en curso, ignorando doble click');
    return;
  }

  // Recoger ingredientes de las filas select+input
  const items = document.querySelectorAll('#lista-ingredientes-pedido .ingrediente-item');
  const ingredientesPedido = [];

  items.forEach(item => {
    const select = item.querySelector('select');
    const cantidadInput = item.querySelector('.cantidad-input');
    const precioInput = item.querySelector('.precio-input');
    const formatoSelect = item.querySelector('select[id$="-formato-select"]');

    if (select && select.value && cantidadInput && cantidadInput.value) {
      const ingId = parseInt(select.value);
      // 🔒 FIX: Proteger acceso a array global que puede no estar cargado
      const ing = (window.ingredientes || []).find(i => i.id === ingId);
      const cantidadValue = parseFloat(cantidadInput.value);

      // 💰 Precio: usar el del input si está relleno, sino el del ingrediente
      const precioManual = precioInput ? parseFloat(precioInput.value) : 0;
      const precioIngrediente = ing ? parseFloat(ing.precio || 0) : 0;
      const precioFinal = precioManual > 0 ? precioManual : precioIngrediente;

      // 🆕 Obtener multiplicador del formato de compra
      let multiplicador = 1;
      let formatoMult = 1;
      let formatoUsado = null;
      let usandoFormato = false;
      if (formatoSelect && formatoSelect.parentElement?.style.display !== 'none') {
        const selectedFormatoOption = formatoSelect.options[formatoSelect.selectedIndex];
        multiplicador = parseFloat(selectedFormatoOption?.dataset?.multiplicador) || 1;
        formatoMult = parseFloat(selectedFormatoOption?.dataset?.formatoMult) || 1;
        formatoUsado = formatoSelect.value;
        // FIX: formatoMult puede ser < 1 (ej: 0.5 kg por bote), no solo > 1
        usandoFormato = formatoUsado === 'formato' && formatoMult && formatoMult !== 1;
      }

      // Cantidad real en unidad base para stock
      const cantidadReal = usandoFormato ? cantidadValue * formatoMult : cantidadValue;

      // 💰 El precio del ingrediente YA está en unidad base (€/botella, €/kg)
      // NO hay que dividir, el precio ya es el correcto
      const precioUnitarioBase = precioFinal;

      ingredientesPedido.push({
        ingredienteId: ingId,
        ingrediente_id: ingId,
        cantidad: cantidadReal,
        cantidadOriginal: cantidadValue,
        cantidadFormatos: usandoFormato ? cantidadValue : null,
        formatoUsado: formatoUsado,
        multiplicador: formatoMult,
        precio_unitario: precioUnitarioBase,
        precio: precioUnitarioBase,
        precioFormato: usandoFormato ? precioFinal * formatoMult : null,
      });
    }
  });


  const proveedorId = parseInt(document.getElementById('ped-proveedor').value);
  const proveedor = (window.proveedores || []).find(p => p.id === proveedorId);
  // Detectar "compra mercado" (mercadillo / plaza de abastos / mercado central)
  // por palabra completa, NO por subcadena. El .includes('mercado') daba falsos
  // positivos con "Mercadona", "Supermercado", "Hipermercado" — todos esos son
  // distribuidores formales, no compras de mercado físico.
  const esCompraMercado = proveedor && /\bmercado\b/i.test(proveedor.nombre);

  let pedido;

  // Datos del puesto del mercado (si aplica)
  const puestoMercado = document.getElementById('ped-mercado-puesto')?.value?.trim() || '';

  if (esCompraMercado) {
    // ========== COMPRA MERCADO (con ingredientes + actualización de stock inmediata) ==========
    if (ingredientesPedido.length === 0) {
      window.showToast(t('pedidos:select_ingredient'), 'warning');
      return;
    }

    pedido = {
      proveedorId: proveedorId,
      proveedor_id: proveedorId,
      fecha: document.getElementById('ped-fecha')?.value || new Date().toISOString().split('T')[0],
      estado: 'recibido', // Se marca directamente como recibido
      ingredientes: ingredientesPedido,
      total: window.calcularTotalPedido(),
      es_compra_mercado: true,
      detalle_mercado: puestoMercado,
    };
  } else {
    // ========== PEDIDO NORMAL → AÑADIR AL CARRITO ==========
    if (ingredientesPedido.length === 0) {
      window.showToast(t('pedidos:select_ingredient'), 'warning');
      return;
    }

    // 🛒 NUEVO: Añadir ingredientes al carrito en lugar de crear pedido directamente
    ingredientesPedido.forEach(item => {
      const ing = (window.ingredientes || []).find(i => i.id === item.ingredienteId);
      if (ing && typeof window.agregarAlCarrito === 'function') {
        // 🆕 Pasar precio y flag de si es unitario (compra por botella vs caja)
        const esUnidadSuelta = item.formatoUsado === 'unidad';
        window.agregarAlCarrito(
          item.ingredienteId,
          item.cantidad,
          proveedorId,
          item.precio_unitario,  // Precio (unitario si es botella, formato si es caja)
          esUnidadSuelta         // true = compra por botella, false = compra por caja
        );
      }
    });

    // Cerrar formulario y mostrar el carrito
    window.cerrarFormularioPedido();
    window.showToast(`🛒 ${t('pedidos:items_added_to_cart', { count: ingredientesPedido.length })}`, 'success');

    // Abrir el carrito automáticamente
    if (typeof window.abrirCarrito === 'function') {
      setTimeout(() => window.abrirCarrito(), 300);
    }
    return; // No continuar con la creación directa
  }

  isCreatingOrder = true;
  window.showLoading();

  try {
    // Guardar pedido usando window.api (más fiable que apiClient bundled)
    console.log('📝 Creando pedido con fecha:', pedido.fecha, '| ped-fecha value:', document.getElementById('ped-fecha')?.value);
    await window.api.createPedido(pedido);

    // 🏪 Para compras del mercado: actualizar stock inmediatamente con ajuste atómico
    if (esCompraMercado) {
      // 🔒 FIX v2: Usar ajuste atómico de stock (delta) en vez de valor absoluto
      const stockAdjustments = ingredientesPedido
        .filter(item => parseFloat(item.cantidad || 0) > 0)
        .map(item => ({
          id: item.ingredienteId,
          delta: parseFloat(item.cantidad)
        }));

      if (stockAdjustments.length > 0) {
        try {
          const result = await window.api.bulkAdjustStock(stockAdjustments, 'compra_mercado');
          console.log('🏪 Stock ajustado atómicamente:', result);

          if (result.errors && result.errors.length > 0) {
            console.error('⚠️ Errores en ajuste:', result.errors);
          }
        } catch (bulkErr) {
          console.error('❌ Error bulk adjust:', bulkErr);
          // Fallback uno por uno
          for (const adj of stockAdjustments) {
            try {
              await window.api.adjustStock(adj.id, adj.delta, 'compra_mercado');
            } catch (e) {
              console.error(`❌ Error ajustando stock ID ${adj.id}:`, e);
            }
          }
        }
      }

      // El precio del ingrediente lo recalcula el backend (recalcularPrecioPonderado
      // en businessHelpers.js) usando la media ponderada de TODO el histórico de
      // precios_compra_diarios. El cálculo aproximado que hacíamos aquí (basado solo
      // en stock_actual × precio_anterior + nueva compra) sobrescribía al backend con
      // un valor menos preciso. Ver bug 2026-05-02 (AMEIXAS: precio quedaba en 22€
      // cuando la ponderada real era 23,13€).

      // Recargar para reflejar cambios (precio actualizado por el backend, stock por bulkAdjustStock)
      window.ingredientes = await window.api.getIngredientes();
      window.renderizarIngredientes?.();
      window.renderizarInventario?.();

      // ℹ️ Diario (precios_compra_diarios) se registra automáticamente en el backend
      // al crear el pedido con estado='recibido' (POST /api/orders)
      // NO llamar a /daily/purchases/bulk aquí para evitar doble registro
    }

    // Recargar pedidos
    window.pedidos = await window.api.getPedidos();
    window.renderizarPedidos();
    window.hideLoading();
    window.showToast(esCompraMercado ? t('pedidos:market_purchase_success') : t('pedidos:order_created'), 'success');
    window.cerrarFormularioPedido();
  } catch (error) {
    window.hideLoading();
    console.error('Error:', error);
    window.showToast(t('pedidos:toast_error_saving', { message: error.message }), 'error');
  } finally {
    isCreatingOrder = false;
  }
}

/**
 * Elimina un pedido
 * @param {number} id - ID del pedido
 */
export async function eliminarPedido(id) {
  const ped = (window.pedidos || []).find(p => p.id === id);
  if (!ped) return;

  if (!confirm(t('pedidos:confirm_delete', { id }))) return;

  window.showLoading();

  try {
    await window.api.deletePedido(id);

    // ℹ️ El backend DELETE /orders/:id ya revierte el Diario automáticamente
    // (resta cantidades por ingrediente). No es necesario borrar desde el frontend.

    await window.cargarDatos();
    window.renderizarPedidos();
    window.hideLoading();
    window.showToast(t('pedidos:toast_deleted'), 'success');
  } catch (error) {
    window.hideLoading();
    console.error('Error:', error);
    window.showToast(t('pedidos:toast_error_deleting', { message: error.message }), 'error');
  }
}

/**
 * Repite un pedido recibido: crea uno nuevo pendiente con los mismos ingredientes y proveedor.
 * El usuario puede ajustar cantidades antes de confirmar.
 * @param {number} id - ID del pedido a repetir
 */
export async function repetirPedido(id) {
  const ped = (window.pedidos || []).find(p => p.id === id);
  if (!ped) return;

  const prov = (window.proveedores || []).find(p => p.id === (ped.proveedorId || ped.proveedor_id));
  const provNombre = prov ? prov.nombre : 'Unknown';

  const itemCount = (ped.ingredientes || []).filter(i => i.tipo !== 'ajuste').length;
  if (!confirm(t('pedidos:repeat_confirm', { supplier: provNombre, count: itemCount }))) return;

  window.showLoading();

  try {
    // Copy ingredients from original order, resetting reception-specific fields
    const ingredientesCopia = (ped.ingredientes || [])
      .filter(item => item.tipo !== 'ajuste') // Skip manual adjustments
      .map(item => ({
        ingredienteId: item.ingredienteId || item.ingrediente_id,
        ingrediente_id: item.ingredienteId || item.ingrediente_id,
        cantidad: parseFloat(item.cantidadRecibida || item.cantidad || 0),
        precio_unitario: parseFloat(item.precioReal || item.precioUnitario || item.precio_unitario || 0),
        precioUnitario: parseFloat(item.precioReal || item.precioUnitario || item.precio_unitario || 0),
      }));

    const total = ingredientesCopia.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

    const result = await window.api.createPedido({
      proveedor_id: ped.proveedorId || ped.proveedor_id,
      fecha: new Date().toISOString().split('T')[0],
      ingredientes: ingredientesCopia,
      total,
      estado: 'pendiente',
    });

    if (result.id) {
      await window.cargarDatos();
      window.renderizarPedidos();
      window.hideLoading();
      window.showToast(t('pedidos:repeat_success', { supplier: provNombre }), 'success');
    } else {
      throw new Error(result.error || 'Failed to create order');
    }
  } catch (error) {
    window.hideLoading();
    console.error('Error repeating order:', error);
    window.showToast(`Error: ${error.message}`, 'error');
  }
}
