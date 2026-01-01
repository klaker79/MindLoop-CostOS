/**
 * Pedidos CRUD Module
 * Funciones de crear, editar, eliminar y recibir pedidos
 */

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
    const input = item.querySelector('input[type="number"]');
    if (select && select.value && input && input.value) {
      const ingId = parseInt(select.value);
      const ing = window.ingredientes.find(i => i.id === ingId);
      ingredientesPedido.push({
        ingredienteId: ingId,
        ingrediente_id: ingId,
        cantidad: parseFloat(input.value),
        precio_unitario: ing ? parseFloat(ing.precio || 0) : 0,
        precio: ing ? parseFloat(ing.precio || 0) : 0,
      });
    }
  });

  if (ingredientesPedido.length === 0) {
    window.showToast('Selecciona al menos un ingrediente', 'warning');
    return;
  }

  const pedido = {
    proveedorId: parseInt(document.getElementById('ped-proveedor').value),
    proveedor_id: parseInt(document.getElementById('ped-proveedor').value),
    fecha: new Date().toISOString(),
    estado: 'pendiente',
    ingredientes: ingredientesPedido,
    total: window.calcularTotalPedido(),
  };

  window.showLoading();

  try {
    await window.api.createPedido(pedido);
    // Recargar pedidos
    window.pedidos = await window.api.getPedidos();
    window.renderizarPedidos();
    window.hideLoading();
    window.showToast('Pedido creado', 'success');
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
  const ped = window.pedidos.find(p => p.id === id);
  if (!ped) return;

  if (!confirm(`¿Eliminar el pedido #${id}?`)) return;

  window.showLoading();

  try {
    await window.api.deletePedido(id);
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

/**
 * Marca un pedido como recibido (abre modal)
 * @param {number} id - ID del pedido
 */
export function marcarPedidoRecibido(id) {
  window.pedidoRecibiendoId = id;
  const ped = window.pedidos.find(p => p.id === id);
  if (!ped) return;

  const prov = window.proveedores.find(
    p => p.id === ped.proveedorId || p.id === ped.proveedor_id
  );

  // Llenar info del modal
  const provSpan = document.getElementById('modal-rec-proveedor');
  if (provSpan) provSpan.textContent = prov ? prov.nombre : 'Sin proveedor';

  const fechaSpan = document.getElementById('modal-rec-fecha');
  if (fechaSpan) fechaSpan.textContent = new Date(ped.fecha).toLocaleDateString('es-ES');

  const totalSpan = document.getElementById('modal-rec-total-original');
  if (totalSpan) totalSpan.textContent = parseFloat(ped.total || 0).toFixed(2) + ' €';

  // Inicializar items de recepción con estado
  if (!ped.itemsRecepcion) {
    ped.itemsRecepcion = (ped.ingredientes || []).map(item => {
      const precio = parseFloat(item.precio_unitario || item.precio || 0);
      return {
        ...item,
        ingredienteId: item.ingredienteId || item.ingrediente_id,
        precioUnitario: precio,
        cantidadRecibida: parseFloat(item.cantidad || 0),
        precioReal: precio,
        estado: 'consolidado'
      };
    });
  }

  renderItemsRecepcionModal(ped);

  // Mostrar modal
  const modal = document.getElementById('modal-recibir-pedido');
  if (modal) modal.classList.add('active');
}

/**
 * Renderiza los items del modal de recepción con cálculo de varianza
 * ⚡ OPTIMIZACIÓN: Pre-build Map de ingredientes
 */
function renderItemsRecepcionModal(ped) {
  const tbody = document.getElementById('modal-rec-items');
  if (!tbody) return;

  // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez, no .find() O(n) por cada item
  const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

  let html = '';
  let totalOriginal = 0;
  let totalRecibido = 0;

  ped.itemsRecepcion.forEach((item, idx) => {
    const ingId = item.ingredienteId || item.ingrediente_id;
    const ing = ingMap.get(ingId);
    const nombre = ing ? ing.nombre : 'Ingrediente';
    const unidad = ing ? ing.unidad : '';

    const cantPedida = parseFloat(item.cantidad || 0);
    const cantRecibida = parseFloat(item.cantidadRecibida || 0);
    const precioPed = parseFloat(item.precioUnitario || 0);
    const precioReal = parseFloat(item.precioReal || 0);

    const subtotalOriginal = cantPedida * precioPed;
    const subtotalRecibido = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

    totalOriginal += subtotalOriginal;
    totalRecibido += subtotalRecibido;

    html += `
          <tr>
            <td>${nombre}</td>
            <td>${cantPedida} ${unidad}</td>
            <td>
              ${item.estado === 'no-entregado'
        ? '<span style="color:#999;">-</span>'
        : `<input type="number" step="0.01" min="0" value="${cantRecibida}" 
                    style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                    oninput="window.actualizarItemRecepcion(${idx}, 'cantidad', this.value)">`
      }
            </td>
            <td>${precioPed.toFixed(2)}€</td>
            <td>
              ${item.estado === 'no-entregado'
        ? '<span style="color:#999;">-</span>'
        : `<input type="number" step="0.01" min="0" value="${precioReal}" 
                    style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                    oninput="window.actualizarItemRecepcion(${idx}, 'precio', this.value)">`
      }
            </td>
            <td><strong id="subtotal-item-${idx}">${subtotalRecibido.toFixed(2)}€</strong></td>
            <td>
              <select onchange="window.cambiarEstadoItem(${idx}, this.value)" 
                style="padding:5px;border:1px solid #ddd;border-radius:4px;">
                <option value="consolidado" ${item.estado === 'consolidado' ? 'selected' : ''}>✅ OK</option>
                <option value="varianza" ${item.estado === 'varianza' ? 'selected' : ''}>⚠️ Varianza</option>
                <option value="no-entregado" ${item.estado === 'no-entregado' ? 'selected' : ''}>❌ No entreg.</option>
              </select>
            </td>
          </tr>
        `;
  });

  tbody.innerHTML = html;

  // Actualizar resúmenes
  const varianza = totalRecibido - totalOriginal;

  const resumenOrig = document.getElementById('modal-rec-resumen-original');
  if (resumenOrig) resumenOrig.textContent = totalOriginal.toFixed(2) + ' €';

  const resumenRec = document.getElementById('modal-rec-resumen-recibido');
  if (resumenRec) resumenRec.textContent = totalRecibido.toFixed(2) + ' €';

  const resumenVar = document.getElementById('modal-rec-resumen-varianza');
  if (resumenVar) {
    resumenVar.textContent = (varianza >= 0 ? '+' : '') + varianza.toFixed(2) + ' €';
    resumenVar.style.color = varianza > 0 ? '#ef4444' : varianza < 0 ? '#10b981' : '#666';
  }
}

/**
 * Actualiza un item de recepción y recalcula totales SIN perder el foco
 */
export function actualizarItemRecepcion(idx, tipo, valor) {
  const ped = window.pedidos.find(p => p.id === window.pedidoRecibiendoId);
  if (!ped || !ped.itemsRecepcion) return;

  const item = ped.itemsRecepcion[idx];
  if (!item) return;

  if (tipo === 'cantidad') {
    item.cantidadRecibida = parseFloat(valor) || 0;
    // Auto-detectar varianza
    if (Math.abs(item.cantidadRecibida - item.cantidad) > 0.01) {
      item.estado = 'varianza';
    }
  } else if (tipo === 'precio') {
    item.precioReal = parseFloat(valor) || 0;
    // Auto-detectar varianza
    if (Math.abs(item.precioReal - item.precioUnitario) > 0.01) {
      item.estado = 'varianza';
    }
  }

  // Solo actualizar los totales, NO re-renderizar toda la tabla
  actualizarTotalesRecepcion(ped, idx);
}

/**
 * Actualiza solo los totales y el subtotal de una fila específica (sin perder foco)
 */
function actualizarTotalesRecepcion(ped, idxActualizado) {
  let totalOriginal = 0;
  let totalRecibido = 0;

  ped.itemsRecepcion.forEach((item, idx) => {
    const cantPedida = parseFloat(item.cantidad || 0);
    const cantRecibida = parseFloat(item.cantidadRecibida || 0);
    const precioPed = parseFloat(item.precioUnitario || 0);
    const precioReal = parseFloat(item.precioReal || 0);

    const subtotalOriginal = cantPedida * precioPed;
    const subtotalRecibido = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

    totalOriginal += subtotalOriginal;
    totalRecibido += subtotalRecibido;

    // Actualizar subtotal de la fila modificada
    if (idx === idxActualizado) {
      const subtotalEl = document.getElementById(`subtotal-item-${idx}`);
      if (subtotalEl) {
        subtotalEl.textContent = subtotalRecibido.toFixed(2) + '€';
      }
    }
  });

  // Actualizar resúmenes
  const varianza = totalRecibido - totalOriginal;

  const resumenOrig = document.getElementById('modal-rec-resumen-original');
  if (resumenOrig) resumenOrig.textContent = totalOriginal.toFixed(2) + ' €';

  const resumenRec = document.getElementById('modal-rec-resumen-recibido');
  if (resumenRec) resumenRec.textContent = totalRecibido.toFixed(2) + ' €';

  const resumenVar = document.getElementById('modal-rec-resumen-varianza');
  if (resumenVar) {
    resumenVar.textContent = (varianza >= 0 ? '+' : '') + varianza.toFixed(2) + ' €';
    resumenVar.style.color = varianza > 0 ? '#ef4444' : varianza < 0 ? '#10b981' : '#666';
  }
}

/**
 * Cambia el estado de un item de recepción
 */
export function cambiarEstadoItem(idx, estado) {
  const ped = window.pedidos.find(p => p.id === window.pedidoRecibiendoId);
  if (!ped || !ped.itemsRecepcion) return;

  ped.itemsRecepcion[idx].estado = estado;
  renderItemsRecepcionModal(ped);
}

/**
 * Cierra el modal de recibir pedido
 */
export function cerrarModalRecibirPedido() {
  const modal = document.getElementById('modal-recibir-pedido');
  if (modal) modal.classList.remove('active');
  window.pedidoRecibiendoId = null;
}

/**
 * Confirma la recepción del pedido (actualiza stock Y PRECIO MEDIO PONDERADO)
 * 💰 CORREGIDO: Ahora calcula media ponderada de precios
 */
export async function confirmarRecepcionPedido() {
  if (window.pedidoRecibiendoId === null) return;

  const ped = window.pedidos.find(p => p.id === window.pedidoRecibiendoId);
  if (!ped || !ped.itemsRecepcion) return;

  window.showLoading();

  try {
    let totalRecibido = 0;

    // Preparar ingredientes con precioReal actualizado
    const ingredientesActualizados = ped.itemsRecepcion.map(item => {
      const cantRecibida = item.estado === 'no-entregado' ? 0 : parseFloat(item.cantidadRecibida || 0);
      const precioReal = parseFloat(item.precioReal || item.precioUnitario || 0);

      if (item.estado !== 'no-entregado') {
        totalRecibido += cantRecibida * precioReal;
      }

      return {
        ingredienteId: item.ingredienteId,
        ingrediente_id: item.ingredienteId,
        cantidad: parseFloat(item.cantidad || 0),
        cantidadRecibida: cantRecibida,
        precioUnitario: parseFloat(item.precioUnitario || 0),
        precioReal: precioReal,
        precio_unitario: parseFloat(item.precioUnitario || 0),
        estado: item.estado || 'consolidado'
      };
    });

    // Actualizar stock Y PRECIO de cada ingrediente recibido
    for (const item of ingredientesActualizados) {
      if (item.estado === 'no-entregado') continue;

      const ing = window.ingredientes.find(i => i.id === item.ingredienteId);
      if (ing) {
        const stockAnterior = parseFloat(ing.stockActual || ing.stock_actual || 0);
        const precioAnterior = parseFloat(ing.precio || 0);
        const cantidadRecibida = item.cantidadRecibida;
        const precioNuevo = item.precioReal;

        // 💰 CÁLCULO DE MEDIA PONDERADA DE PRECIOS
        // Fórmula: (stock_anterior × precio_anterior + cantidad_nueva × precio_nuevo) / (stock_anterior + cantidad_nueva)
        let precioMedioPonderado;
        if (stockAnterior + cantidadRecibida > 0) {
          precioMedioPonderado =
            (stockAnterior * precioAnterior + cantidadRecibida * precioNuevo) /
            (stockAnterior + cantidadRecibida);
        } else {
          precioMedioPonderado = precioNuevo; // Si no hay stock, usar precio nuevo
        }

        const nuevoStock = stockAnterior + cantidadRecibida;

        console.log(`📦 ${ing.nombre}: Stock ${stockAnterior} → ${nuevoStock}, Precio ${precioAnterior.toFixed(2)}€ → ${precioMedioPonderado.toFixed(2)}€ (media ponderada)`);

        await window.api.updateIngrediente(item.ingredienteId, {
          ...ing,
          stockActual: nuevoStock,
          stock_actual: nuevoStock,
          precio: precioMedioPonderado  // ← AHORA SÍ ACTUALIZA EL PRECIO
        });
      }
    }

    // Marcar pedido como recibido CON LOS PRECIOS REALES
    await window.api.updatePedido(window.pedidoRecibiendoId, {
      ...ped,
      estado: 'recibido',
      ingredientes: ingredientesActualizados, // ← IMPORTANTE: Esto guarda precioReal
      fecha_recepcion: new Date().toISOString(),
      total_recibido: totalRecibido,
      totalRecibido: totalRecibido
    });

    await window.cargarDatos();
    window.renderizarPedidos();
    window.renderizarIngredientes();
    window.renderizarInventario?.();
    window.hideLoading();
    cerrarModalRecibirPedido();
    window.showToast('✅ Pedido recibido: stock y precio medio actualizado', 'success');
  } catch (error) {
    window.hideLoading();
    console.error('Error:', error);
    window.showToast('Error recibiendo pedido: ' + error.message, 'error');
  }
}

/**
 * Muestra detalles de un pedido en modal
 * @param {number} pedidoId - ID del pedido
 */
export function verDetallesPedido(pedidoId) {
  window.pedidoViendoId = pedidoId;
  const ped = window.pedidos.find(p => p.id === pedidoId);
  if (!ped) return;

  const prov = window.proveedores.find(
    p => p.id === ped.proveedorId || p.id === ped.proveedor_id
  );
  const provNombre = prov ? prov.nombre : 'Sin proveedor';
  const fechaFormateada = new Date(ped.fecha).toLocaleDateString('es-ES');
  const estadoClass = ped.estado === 'recibido' ? '#10B981' : '#F59E0B';
  const estadoText = ped.estado === 'recibido' ? 'Recibido' : 'Pendiente';
  const esRecibido = ped.estado === 'recibido';

  let ingredientesHtml = '';
  let totalOriginal = 0;
  let totalRecibido = 0;

  // Determinar si usar itemsRecepcion (con varianza) o ingredientes básicos
  const items = ped.itemsRecepcion || ped.ingredientes || [];

  if (items.length > 0) {
    items.forEach(item => {
      const ingId = item.ingredienteId || item.ingrediente_id;
      const ing = window.ingredientes.find(i => i.id === ingId);
      const nombreIng = ing ? ing.nombre : 'Ingrediente';
      const unidadIng = ing ? ing.unidad : '';

      // Cantidades
      const cantPedida = parseFloat(item.cantidad || 0);
      const cantRecibida = parseFloat(item.cantidadRecibida || item.cantidad || 0);
      const varianzaCant = cantRecibida - cantPedida;

      // Precios
      const precioOriginal = parseFloat(
        item.precioUnitario || item.precio_unitario || item.precio || 0
      );
      const precioReal = parseFloat(item.precioReal || precioOriginal);
      const varianzaPrecio = precioReal - precioOriginal;

      // Subtotales
      const subtotalOriginal = cantPedida * precioOriginal;
      const subtotalReal = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

      totalOriginal += subtotalOriginal;
      totalRecibido += subtotalReal;

      // Estado del ítem
      const itemEstado = item.estado || 'consolidado';
      let estadoBadge = '';
      if (esRecibido) {
        if (itemEstado === 'no-entregado') {
          estadoBadge =
            '<span style="background:#EF4444;color:white;padding:2px 8px;border-radius:10px;font-size:11px;">No entregado</span>';
        } else if (Math.abs(varianzaCant) > 0.01 || Math.abs(varianzaPrecio) > 0.01) {
          estadoBadge =
            '<span style="background:#F59E0B;color:white;padding:2px 8px;border-radius:10px;font-size:11px;">Varianza</span>';
        } else {
          estadoBadge =
            '<span style="background:#10B981;color:white;padding:2px 8px;border-radius:10px;font-size:11px;">OK</span>';
        }
      }

      ingredientesHtml += `
              <tr style="border-bottom: 1px solid #F1F5F9;">
                <td style="padding: 12px;"><strong>${nombreIng}</strong></td>
                <td style="padding: 12px; text-align: center;">
                  ${cantPedida.toFixed(2)} ${unidadIng}
                  ${esRecibido && Math.abs(varianzaCant) > 0.01 ? `<br><small style="color:${varianzaCant > 0 ? '#10B981' : '#EF4444'};">→ ${cantRecibida.toFixed(2)} (${varianzaCant > 0 ? '+' : ''}${varianzaCant.toFixed(2)})</small>` : ''}
                </td>
                <td style="padding: 12px; text-align: right;">
                  ${precioOriginal.toFixed(2)} €
                  ${esRecibido && Math.abs(varianzaPrecio) > 0.01 ? `<br><small style="color:${varianzaPrecio > 0 ? '#EF4444' : '#10B981'};">→ ${precioReal.toFixed(2)} € (${varianzaPrecio > 0 ? '+' : ''}${varianzaPrecio.toFixed(2)})</small>` : ''}
                </td>
                <td style="padding: 12px; text-align: right;">
                  ${esRecibido && subtotalReal !== subtotalOriginal ? `<small style="text-decoration:line-through;color:#999;">${subtotalOriginal.toFixed(2)} €</small><br>` : ''}
                  <strong>${(esRecibido ? subtotalReal : subtotalOriginal).toFixed(2)} €</strong>
                </td>
                ${esRecibido ? `<td style="padding: 12px; text-align: center;">${estadoBadge}</td>` : ''}
              </tr>
            `;
    });
  } else {
    ingredientesHtml = `<tr><td colspan="${esRecibido ? 5 : 4}" style="padding: 40px; text-align: center; color: #94A3B8;">No hay ingredientes</td></tr>`;
  }

  // Calcular varianza total
  const varianzaTotal = totalRecibido - totalOriginal;
  const varianzaColor = varianzaTotal > 0 ? '#EF4444' : varianzaTotal < 0 ? '#10B981' : '#666';

  const html = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #1E293B;">Pedido #${ped.id}</h2>
          <p style="margin: 5px 0 0; color: #64748B;">${provNombre}</p>
        </div>
        <div style="text-align: right;">
          <span style="background: ${estadoClass}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${estadoText}</span>
          <p style="margin: 10px 0 0; color: #64748B; font-size: 14px;">${fechaFormateada}</p>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background: #F8FAFC;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #64748B;">Ingrediente</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">Cantidad</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #64748B;">Precio</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #64748B;">Subtotal</th>
            ${esRecibido ? '<th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">Estado</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${ingredientesHtml}
        </tbody>
      </table>
      
      ${esRecibido
      ? `
      <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
        <div style="padding: 15px; background: #F8FAFC; border-radius: 12px; text-align: center;">
          <div style="color: #64748B; font-size: 12px;">Total Original</div>
          <div style="font-size: 20px; font-weight: bold; color: #1E293B;">${totalOriginal.toFixed(2)} €</div>
        </div>
        <div style="padding: 15px; background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; text-align: center;">
          <div style="color: #64748B; font-size: 12px;">Total Recibido</div>
          <div style="font-size: 20px; font-weight: bold; color: #059669;">${totalRecibido.toFixed(2)} €</div>
        </div>
        <div style="padding: 15px; background: ${Math.abs(varianzaTotal) > 0.01 ? '#FEF3C7' : '#F8FAFC'}; border-radius: 12px; text-align: center;">
          <div style="color: #64748B; font-size: 12px;">Varianza</div>
          <div style="font-size: 20px; font-weight: bold; color: ${varianzaColor};">${varianzaTotal > 0 ? '+' : ''}${varianzaTotal.toFixed(2)} €</div>
        </div>
      </div>
      `
      : `
      <div style="margin-top: 20px; padding: 20px; background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; text-align: right;">
        <strong style="color: #666;">Total del Pedido:</strong><br>
        <span style="font-size: 28px; font-weight: bold; color: #059669;">${parseFloat(ped.total || totalOriginal || 0).toFixed(2)} €</span>
      </div>
      `
    }
    `;

  const contenedor = document.getElementById('modal-ver-pedido-contenido');
  if (contenedor) contenedor.innerHTML = html;

  const modal = document.getElementById('modal-ver-pedido');
  if (modal) modal.classList.add('active');
}

/**
 * Cierra el modal de ver pedido
 */
export function cerrarModalVerPedido() {
  document.getElementById('modal-ver-pedido').classList.remove('active');
  window.pedidoViendoId = null;
}

/**
 * Descarga PDF del pedido actual
 */
export function descargarPedidoPDF() {
  if (window.pedidoViendoId === null) return;

  const pedido = window.pedidos.find(p => p.id === window.pedidoViendoId);
  if (!pedido) return;

  const provId = pedido.proveedorId || pedido.proveedor_id;
  const prov = window.proveedores.find(p => p.id === provId);
  const provNombre = prov ? prov.nombre : 'Sin proveedor';
  const provDir = prov?.direccion || '';
  const provTel = prov?.telefono || '';
  const provEmail = prov?.email || '';

  const esRecibido = pedido.estado === 'recibido';
  const items = pedido.itemsRecepcion || pedido.ingredientes || [];

  let totalOriginal = 0;
  let totalRecibido = 0;
  let ingredientesHtml = '';

  items.forEach(item => {
    const ingId = item.ingredienteId || item.ingrediente_id;
    const ing = window.ingredientes.find(i => i.id === ingId);
    const nombre = ing ? ing.nombre : 'Ingrediente';
    const unidad = ing ? ing.unidad : '';

    const cantPedida = parseFloat(item.cantidad || 0);
    const cantRecibida = parseFloat(item.cantidadRecibida || cantPedida);
    const precioOrig = parseFloat(
      item.precioUnitario || item.precio_unitario || item.precio || 0
    );
    const precioReal = parseFloat(item.precioReal || precioOrig);

    const subtotalOrig = cantPedida * precioOrig;
    const subtotalReal = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

    totalOriginal += subtotalOrig;
    totalRecibido += subtotalReal;

    // Determinar estado
    let estadoTxt = '';
    if (esRecibido) {
      if (item.estado === 'no-entregado') {
        estadoTxt = '❌ No entregado';
      } else if (
        Math.abs(cantRecibida - cantPedida) > 0.01 ||
        Math.abs(precioReal - precioOrig) > 0.01
      ) {
        estadoTxt = '⚠️ Varianza';
      } else {
        estadoTxt = '✅ OK';
      }
    }

    ingredientesHtml += `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${nombre}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${cantPedida.toFixed(2)} ${unidad}</td>
            ${esRecibido ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${cantRecibida !== cantPedida ? '#dc2626' : '#059669'};">${cantRecibida.toFixed(2)} ${unidad}</td>` : ''}
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${precioOrig.toFixed(2)} €</td>
            ${esRecibido ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${precioReal !== precioOrig ? '#dc2626' : '#059669'};">${precioReal.toFixed(2)} €</td>` : ''}
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${(esRecibido ? subtotalReal : subtotalOrig).toFixed(2)} €</td>
            ${esRecibido ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${estadoTxt}</td>` : ''}
          </tr>
        `;
  });

  const varianza = totalRecibido - totalOriginal;
  const varianzaColor = varianza > 0 ? '#dc2626' : varianza < 0 ? '#059669' : '#374151';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido #${pedido.id} - ${provNombre}</title>
      <style>
        @page { margin: 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #7c3aed; }
        .doc-info { text-align: right; }
        .doc-number { font-size: 24px; font-weight: bold; color: #1f2937; }
        .badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .badge-recibido { background: #dcfce7; color: #166534; }
        .badge-pendiente { background: #fef3c7; color: #92400e; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
        .info-box h3 { margin: 0 0 15px 0; color: #7c3aed; font-size: 14px; text-transform: uppercase; }
        .info-box p { margin: 5px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #7c3aed; color: white; padding: 12px 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
        .totals { display: grid; grid-template-columns: repeat(${esRecibido ? 3 : 1}, 1fr); gap: 20px; margin-top: 30px; }
        .total-box { padding: 20px; border-radius: 8px; text-align: center; }
        .total-box.original { background: #f1f5f9; }
        .total-box.recibido { background: #dcfce7; border: 2px solid #22c55e; }
        .total-box.varianza { background: #fef3c7; }
        .total-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
        .total-value { font-size: 24px; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">${window.getRestaurantName ? window.getRestaurantName() : 'MindLoop CostOS'}</div>
          <p style="margin: 5px 0; color: #6b7280;">Sistema de Gestión de Costos</p>
        </div>
        <div class="doc-info">
          <div class="doc-number">PEDIDO #${pedido.id}</div>
          <p style="margin: 10px 0;"><span class="badge ${esRecibido ? 'badge-recibido' : 'badge-pendiente'}">${esRecibido ? 'RECIBIDO' : 'PENDIENTE'}</span></p>
          <p style="color: #6b7280;">${new Date(pedido.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-box">
          <h3>📦 Proveedor</h3>
          <p><strong>${provNombre}</strong></p>
          ${provDir ? `<p>${provDir}</p>` : ''}
          ${provTel ? `<p>📞 ${provTel}</p>` : ''}
          ${provEmail ? `<p>✉️ ${provEmail}</p>` : ''}
        </div>
        <div class="info-box">
          <h3>📋 Detalles del Pedido</h3>
          <p><strong>Fecha pedido:</strong> ${new Date(pedido.fecha).toLocaleDateString('es-ES')}</p>
          ${pedido.fecha_recepcion ? `<p><strong>Fecha recepción:</strong> ${new Date(pedido.fecha_recepcion).toLocaleDateString('es-ES')}</p>` : ''}
          <p><strong>Total ítems:</strong> ${items.length}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Ingrediente</th>
            <th style="text-align: center;">Cant. Pedida</th>
            ${esRecibido ? '<th style="text-align: center;">Cant. Recibida</th>' : ''}
            <th style="text-align: right;">Precio Orig.</th>
            ${esRecibido ? '<th style="text-align: right;">Precio Real</th>' : ''}
            <th style="text-align: right;">Subtotal</th>
            ${esRecibido ? '<th style="text-align: center;">Estado</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${ingredientesHtml}
        </tbody>
      </table>
      
      <div class="totals">
        ${esRecibido
      ? `
        <div class="total-box original">
          <div class="total-label">Total Original</div>
          <div class="total-value" style="color: #374151;">${totalOriginal.toFixed(2)} €</div>
        </div>
        <div class="total-box recibido">
          <div class="total-label">Total Recibido</div>
          <div class="total-value" style="color: #059669;">${totalRecibido.toFixed(2)} €</div>
        </div>
        <div class="total-box varianza">
          <div class="total-label">Varianza</div>
          <div class="total-value" style="color: ${varianzaColor};">${varianza > 0 ? '+' : ''}${varianza.toFixed(2)} €</div>
        </div>
        `
      : `
        <div class="total-box recibido">
          <div class="total-label">Total del Pedido</div>
          <div class="total-value" style="color: #059669;">${parseFloat(pedido.total || totalOriginal).toFixed(2)} €</div>
        </div>
        `
    }
      </div>
      
      <div class="footer">
        Documento generado el ${new Date().toLocaleString('es-ES')} • ${window.getRestaurantName ? window.getRestaurantName() : 'MindLoop CostOS'}
      </div>
    </body>
    </html>
    `;

  const ventana = window.open('', '', 'width=900,height=700');
  ventana.document.write(html);
  ventana.document.close();
  ventana.print();
}
