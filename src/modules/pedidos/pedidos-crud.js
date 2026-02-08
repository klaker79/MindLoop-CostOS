/**
 * Pedidos CRUD Module
 * Funciones de crear y eliminar pedidos
 * 
 * Las demás funciones han sido extraídas a módulos especializados:
 * - pedidos-recepcion.js: Flujo de recepción con varianza
 * - pedidos-detalles.js: Ver detalles en modal
 * - pedidos-export.js: PDF y WhatsApp
 */



// Re-exportar funciones de los módulos especializados
export {
  marcarPedidoRecibido,
  actualizarItemRecepcion,
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
  const esCompraMercado = proveedor && proveedor.nombre.toLowerCase().includes('mercado');

  let pedido;

  // Datos del puesto del mercado (si aplica)
  const puestoMercado = document.getElementById('ped-mercado-puesto')?.value?.trim() || '';

  if (esCompraMercado) {
    // ========== COMPRA MERCADO (con ingredientes + actualización de stock inmediata) ==========
    if (ingredientesPedido.length === 0) {
      window.showToast('Selecciona al menos un ingrediente', 'warning');
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
      window.showToast('Selecciona al menos un ingrediente', 'warning');
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
    window.showToast(`🛒 ${ingredientesPedido.length} ingrediente(s) añadidos al carrito`, 'success');

    // Abrir el carrito automáticamente
    if (typeof window.abrirCarrito === 'function') {
      setTimeout(() => window.abrirCarrito(), 300);
    }
    return; // No continuar con la creación directa
  }

  window.showLoading();

  try {
    // Guardar pedido usando window.api (más fiable que apiClient bundled)
    console.log('📝 Creando pedido con fecha:', pedido.fecha, '| ped-fecha value:', document.getElementById('ped-fecha')?.value);
    await window.api.createPedido(pedido);

    // 🏪 Para compras del mercado: actualizar stock inmediatamente
    if (esCompraMercado) {
      for (const item of ingredientesPedido) {
        const ing = (window.ingredientes || []).find(i => i.id === item.ingredienteId);
        if (ing) {
          // 🔒 FIX: Usar stock_actual primero (snake_case del backend)
          const stockAnterior = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0);
          const precioAnterior = parseFloat(ing.precio || 0);
          const cantidadRecibida = parseFloat(item.cantidad || 0);
          const precioNuevo = parseFloat(item.precio_unitario || item.precio || 0);

          // Cálculo de media ponderada de precios
          let precioMedioPonderado;
          if (stockAnterior + cantidadRecibida > 0) {
            precioMedioPonderado =
              (stockAnterior * precioAnterior + cantidadRecibida * precioNuevo) /
              (stockAnterior + cantidadRecibida);
          } else {
            precioMedioPonderado = precioNuevo;
          }

          const nuevoStock = stockAnterior + cantidadRecibida;

          console.log(`🏪 Mercado - ${ing.nombre}: Stock ${stockAnterior} → ${nuevoStock}, Precio ${precioAnterior.toFixed(2)}€ → ${precioMedioPonderado.toFixed(2)}€`);

          // 🔒 FIX CRÍTICO: No hacer spread de ...ing
          // El spread incluía stockActual que podía sobrescribir stock_actual en backend
          await window.api.updateIngrediente(item.ingredienteId, {
            nombre: ing.nombre,
            unidad: ing.unidad,
            proveedor_id: ing.proveedor_id || ing.proveedorId,
            familia: ing.familia,
            formato_compra: ing.formato_compra,
            cantidad_por_formato: ing.cantidad_por_formato,
            stock_minimo: ing.stock_minimo ?? ing.stockMinimo,
            stock_actual: nuevoStock,
            precio: precioMedioPonderado
          });
        }
      }
      // Recargar ingredientes para reflejar cambios
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
    window.showToast(esCompraMercado ? '🏪 Compra del mercado registrada (stock actualizado)' : 'Pedido creado', 'success');
    window.cerrarFormularioPedido();
  } catch (error) {
    window.hideLoading();
    console.error('Error:', error);
    window.showToast('Error guardando pedido: ' + error.message, 'error');
  }
}

/**
 * Elimina un pedido
 * @param {number} id - ID del pedido
 */
export async function eliminarPedido(id) {
  const ped = (window.pedidos || []).find(p => p.id === id);
  if (!ped) return;

  if (!confirm(`¿Eliminar el pedido #${id}?`)) return;

  window.showLoading();

  try {
    await window.api.deletePedido(id);

    // ℹ️ El backend DELETE /orders/:id ya revierte el Diario automáticamente
    // (resta cantidades por ingrediente). No es necesario borrar desde el frontend.

    await window.cargarDatos();
    window.renderizarPedidos();
    window.hideLoading();
    window.showToast('Pedido eliminado', 'success');
  } catch (error) {
    window.hideLoading();
    console.error('Error:', error);
    window.showToast('Error eliminando pedido: ' + error.message, 'error');
  }
}
