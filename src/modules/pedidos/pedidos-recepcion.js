/**
 * Pedidos Recepción Module
 * Flujo completo de recepción de pedidos con varianza de precio/cantidad
 * 
 * Funciones:
 * - marcarPedidoRecibido: Abre modal de recepción
 * - renderItemsRecepcionModal: Renderiza items con inputs
 * - actualizarItemRecepcion: Handler de inputs
 * - actualizarTotalesRecepcion: Recalcula totales
 * - cambiarEstadoItem: Cambia estado OK/varianza/no-entregado
 * - cerrarModalRecibirPedido: Cierra modal
 * - confirmarRecepcionPedido: Confirma y actualiza stock
 */

/**
 * Marca un pedido como recibido (abre modal)
 * @param {number} id - ID del pedido
 */
export function marcarPedidoRecibido(id) {
    window.pedidoRecibiendoId = id;
    const ped = (window.pedidos || []).find(p => p.id === id);
    if (!ped) return;

    const prov = (window.proveedores || []).find(
        p => p.id === ped.proveedorId || p.id === ped.proveedor_id
    );

    // Llenar info del modal
    const provSpan = document.getElementById('modal-rec-proveedor');
    if (provSpan) provSpan.textContent = prov ? prov.nombre : 'Sin proveedor';

    const fechaSpan = document.getElementById('modal-rec-fecha');
    if (fechaSpan) {
        const fechaStr = typeof ped.fecha === 'string' && ped.fecha.length === 10 ? ped.fecha + 'T12:00:00' : ped.fecha;
        fechaSpan.textContent = new Date(fechaStr).toLocaleDateString('es-ES');
    }

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
    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
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
    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
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

    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
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

        /**
         * ⚠️ CRITICAL - NO MODIFICAR ESTA SECCIÓN ⚠️
         * Solo se actualiza el STOCK, NUNCA el precio del ingrediente.
         * El backend calcula precio_medio correctamente desde los pedidos.
         * Modificar esto causará corrupción de datos de precio.
         *
         * 🔒 FIX v2: Usar ajuste atómico de stock (delta) en vez de valor absoluto
         * Esto evita que datos stale en window.ingredientes sobreescriban el stock real
         */
        // Preparar ajustes atómicos: solo enviar el delta (+cantidadRecibida)
        const adjustments = ingredientesActualizados
            .filter(item => item.estado !== 'no-entregado' && parseFloat(item.cantidadRecibida) > 0)
            .map(item => ({
                id: item.ingredienteId,
                delta: parseFloat(item.cantidadRecibida)
            }));

        const actualizacionesExitosas = [];
        const actualizacionesFallidas = [];

        if (adjustments.length > 0) {
            try {
                const result = await window.api.bulkAdjustStock(adjustments, 'recepcion_pedido');

                // Procesar resultados
                for (const r of (result.results || [])) {
                    actualizacionesExitosas.push({
                        id: r.id,
                        nombre: r.nombre,
                        stockNuevo: r.stock_actual,
                        cantidadRecibida: r.delta
                    });
                    console.log(`📦 ${r.nombre}: +${r.delta} → Stock = ${r.stock_actual}`);
                }
                for (const e of (result.errors || [])) {
                    actualizacionesFallidas.push({
                        id: e.id,
                        nombre: `ID ${e.id}`,
                        error: e.error
                    });
                    console.error(`❌ Error stock ID ${e.id}: ${e.error}`);
                }
            } catch (bulkError) {
                // Fallback: intentar uno por uno
                console.error('❌ Bulk adjust falló, intentando uno por uno:', bulkError);
                for (const adj of adjustments) {
                    try {
                        const r = await window.api.adjustStock(adj.id, adj.delta, 'recepcion_pedido');
                        actualizacionesExitosas.push({
                            id: r.id,
                            nombre: r.nombre,
                            stockNuevo: r.stock_actual,
                            cantidadRecibida: r.delta
                        });
                    } catch (itemError) {
                        actualizacionesFallidas.push({
                            id: adj.id,
                            nombre: `ID ${adj.id}`,
                            error: itemError.message
                        });
                    }
                }
            }
        }

        // 🔒 FIX: Si hubo fallos, NO marcar pedido como recibido para evitar duplicación
        if (actualizacionesFallidas.length > 0) {
            const exitosos = actualizacionesExitosas.map(a => a.nombre).join(', ');
            const fallidos = actualizacionesFallidas.map(a => `${a.nombre}: ${a.error}`).join('\n');

            // Log para auditoría
            console.error('⚠️ RECEPCIÓN PARCIAL:', {
                pedidoId: window.pedidoRecibiendoId,
                exitosos: actualizacionesExitosas,
                fallidos: actualizacionesFallidas,
                fecha: new Date().toISOString()
            });

            window.hideLoading();

            alert(
                `⚠️ ATENCIÓN: Recepción parcialmente completada\n\n` +
                `✅ Stock actualizado: ${exitosos || 'ninguno'}\n\n` +
                `❌ Falló actualizar:\n${fallidos}\n\n` +
                `⚠️ El pedido NO se marcó como recibido para evitar duplicación.\n` +
                `Soluciona los errores e intenta de nuevo.`
            );

            await window.cargarDatos();
            window.renderizarPedidos();
            window.renderizarIngredientes();
            return;
        }

        // Solo si TODOS los stocks se actualizaron, marcar pedido como recibido
        // 📅 FIX: Usar la fecha original del pedido para que el Diario registre en el día correcto
        const fechaOriginal = ped.fecha || new Date().toISOString();
        await window.api.updatePedido(window.pedidoRecibiendoId, {
            ...ped,
            estado: 'recibido',
            ingredientes: ingredientesActualizados, // ← IMPORTANTE: Esto guarda precioReal
            fecha_recepcion: fechaOriginal,
            total_recibido: totalRecibido,
            totalRecibido: totalRecibido
        });

        // ℹ️ Diario (precios_compra_diarios) se registra automáticamente en el backend
        // al actualizar el pedido a estado='recibido' (PUT /api/orders/:id)
        // NO llamar a /daily/purchases/bulk aquí para evitar doble registro

        await window.cargarDatos();
        window.renderizarPedidos();
        window.renderizarIngredientes();
        window.renderizarInventario?.();
        window.hideLoading();
        cerrarModalRecibirPedido();
        window.showToast('✅ Pedido recibido: stock actualizado y registrado en Diario', 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error recibiendo pedido: ' + error.message, 'error');
    }
}

// Exponer al window para compatibilidad con onclick en HTML
if (typeof window !== 'undefined') {
    window.marcarPedidoRecibido = marcarPedidoRecibido;
    window.actualizarItemRecepcion = actualizarItemRecepcion;
    window.cambiarEstadoItem = cambiarEstadoItem;
    window.cerrarModalRecibirPedido = cerrarModalRecibirPedido;
    window.confirmarRecepcionPedido = confirmarRecepcionPedido;
}
