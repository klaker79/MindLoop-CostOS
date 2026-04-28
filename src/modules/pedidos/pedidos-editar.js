/**
 * Módulo de edición de pedidos pendientes.
 *
 * Permite modificar items (cantidad/precio), añadir nuevos y eliminar
 * de un pedido que aún no ha sido recibido (estado='pendiente').
 *
 * Si el pedido ya está recibido, no se puede editar desde aquí.
 */

import { escapeHTML, cm } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

/**
 * Abre el modal de edición para un pedido pendiente.
 * @param {number} id - ID del pedido
 */
export function abrirModalEditarPedido(id) {
    const pedido = (window.pedidos || []).find(p => p.id === id);
    if (!pedido) {
        window.showToast?.('Pedido no encontrado', 'error');
        return;
    }
    if (pedido.estado !== 'pendiente') {
        window.showToast?.('Solo se pueden editar pedidos pendientes', 'warning');
        return;
    }

    // Parse ingredientes si vienen como string
    let raw = [];
    try {
        raw = typeof pedido.ingredientes === 'string'
            ? JSON.parse(pedido.ingredientes)
            : (pedido.ingredientes || []);
    } catch (_e) {
        raw = [];
    }

    // Separar items normales de ajustes (líneas con tipo='ajuste')
    const items = [];
    let ajusteImporte = 0;
    let ajusteDescripcion = '';
    raw.forEach(it => {
        if (it.tipo === 'ajuste') {
            ajusteImporte = parseFloat(it.importe) || 0;
            ajusteDescripcion = it.descripcion || '';
        } else {
            items.push({
                ingredienteId: it.ingredienteId || it.ingrediente_id,
                cantidad: parseFloat(it.cantidad) || 0,
                precio_unitario: parseFloat(it.precio_unitario || it.precioUnitario || it.precio || 0)
            });
        }
    });

    // Estado temporal del modal
    window._editandoPedido = {
        id,
        proveedor_id: pedido.proveedor_id,
        items,
        ajusteImporte,
        ajusteDescripcion
    };

    renderizarModalEditarPedido();
}

function renderizarModalEditarPedido() {
    const state = window._editandoPedido;
    if (!state) return;

    let modal = document.getElementById('modal-editar-pedido');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-editar-pedido';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    // Mapa completo para resolver nombres de items existentes (aunque sean de otro proveedor)
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    // Filtrar ingredientes disponibles: solo los que el proveedor del pedido suministra
    // Fuentes:
    //   1. ingredientes.proveedor_id (proveedor principal)
    //   2. ingredientes_proveedores (relación N:M, proveedores adicionales)
    const proveedorIdPedido = state.proveedor_id;
    const ingredientesDisponibles = (() => {
        if (!proveedorIdPedido) {
            // Sin proveedor: mostrar todos como fallback
            return [...(window.ingredientes || [])];
        }
        // Set de IDs de ingredientes que este proveedor suministra
        const idsDelProveedor = new Set();
        (window.ingredientes || []).forEach(i => {
            if (i.proveedor_id === proveedorIdPedido) idsDelProveedor.add(i.id);
        });
        (window.ingredientesProveedores || []).forEach(rel => {
            if (rel.proveedor_id === proveedorIdPedido) {
                idsDelProveedor.add(rel.ingrediente_id || rel.ingredienteId);
            }
        });
        return (window.ingredientes || []).filter(i => idsDelProveedor.has(i.id));
    })().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

    const nombreProveedor = proveedorIdPedido
        ? ((window.proveedores || []).find(p => p.id === proveedorIdPedido)?.nombre || 'desconocido')
        : null;

    const itemsHtml = state.items.map((it, idx) => {
        const ing = ingMap.get(it.ingredienteId);
        const nombre = ing ? ing.nombre : `Ingrediente #${it.ingredienteId}`;
        const unidad = ing?.unidad || 'ud';
        const subtotal = it.cantidad * it.precio_unitario;
        return `
            <tr data-idx="${idx}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px;"><strong>${escapeHTML(nombre)}</strong></td>
                <td style="padding: 8px;">
                    <input type="number" step="0.01" min="0" value="${it.cantidad}"
                        onchange="window.actualizarItemEdicion(${idx}, 'cantidad', this.value)"
                        style="width: 80px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                    <small style="color: #64748b;">${escapeHTML(unidad)}</small>
                </td>
                <td style="padding: 8px;">
                    <input type="number" step="0.01" min="0" value="${it.precio_unitario.toFixed(2)}"
                        onchange="window.actualizarItemEdicion(${idx}, 'precio_unitario', this.value)"
                        style="width: 90px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                </td>
                <td style="padding: 8px; text-align: right; font-weight: 600;">${cm(subtotal)}</td>
                <td style="padding: 8px;">
                    <button type="button" onclick="window.eliminarItemEdicion(${idx})"
                        style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    const subtotalItems = state.items.reduce((sum, it) => sum + (it.cantidad * it.precio_unitario), 0);
    const ajuste = parseFloat(state.ajusteImporte) || 0;
    const totalPedido = subtotalItems + ajuste;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0;">✏️ Editar Pedido #${state.id}</h3>
                <button onclick="window.cerrarModalEditarPedido()" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1;">Ingrediente</th>
                        <th style="text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1;">Cantidad</th>
                        <th style="text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1;">Precio Unit.</th>
                        <th style="text-align: right; padding: 10px; border-bottom: 2px solid #cbd5e1;">${t('pedidos:edit_subtotal')}</th>
                        <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;"></th>
                    </tr>
                </thead>
                <tbody>${itemsHtml || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8;">Sin ingredientes</td></tr>'}</tbody>
                <tfoot>
                    <tr style="background: #f8fafc;">
                        <td colspan="3" style="padding: 8px 10px; text-align: right; color: #64748b;">${t('pedidos:edit_subtotal_items')}</td>
                        <td style="padding: 8px 10px; text-align: right; color: #64748b;">${cm(subtotalItems)}</td>
                        <td></td>
                    </tr>
                    ${ajuste !== 0 ? `<tr style="background: #f8fafc;">
                        <td colspan="3" style="padding: 8px 10px; text-align: right; color: ${ajuste < 0 ? '#dc2626' : '#0891b2'};">Ajuste${state.ajusteDescripcion ? ` (${escapeHTML(state.ajusteDescripcion)})` : ''}:</td>
                        <td style="padding: 8px 10px; text-align: right; color: ${ajuste < 0 ? '#dc2626' : '#0891b2'};">${ajuste >= 0 ? '+' : ''}${cm(ajuste)}</td>
                        <td></td>
                    </tr>` : ''}
                    <tr style="background: #f1f5f9;">
                        <td colspan="3" style="padding: 10px; text-align: right; font-weight: 700;">${t('pedidos:edit_total')}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 700; color: #059669; font-size: 16px;">${cm(totalPedido)}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <div style="background: #f0f9ff; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 10px 0;">➕ ${t('pedidos:edit_add_ingredient')}${nombreProveedor ? ` <small style="color: #64748b; font-weight: 400;">${t('pedidos:edit_add_ingredient_from', { supplier: escapeHTML(nombreProveedor) })}</small>` : ''}</h4>
                ${ingredientesDisponibles.length === 0 ? '<p style="color: #dc2626; margin: 0 0 8px 0;">⚠️ Este proveedor no tiene ingredientes asociados</p>' : ''}
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <select id="select-nuevo-ing-edit" onchange="window.autocompletarPrecioEdicion(this)" style="flex: 1; min-width: 200px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                        <option value="">— ${t('pedidos:edit_select_ingredient')} —</option>
                        ${ingredientesDisponibles.map(ing => {
                            const cpfOpt = parseFloat(ing.cantidad_por_formato) || 1;
                            const precioUnitOpt = (parseFloat(ing.precio) || 0) / (cpfOpt || 1);
                            return `<option value="${ing.id}" data-precio="${precioUnitOpt.toFixed(4)}">${escapeHTML(ing.nombre)} (${cm(precioUnitOpt)}/${escapeHTML(ing.unidad || 'ud')})</option>`;
                        }).join('')}
                    </select>
                    <input type="number" step="0.01" min="0" id="input-nueva-cant-edit" placeholder="Cantidad"
                        style="width: 100px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    <input type="number" step="0.0001" min="0" id="input-nuevo-precio-edit" placeholder="Precio unit."
                        style="width: 110px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    <button type="button" onclick="window.agregarItemEdicion()"
                        style="background: #10b981; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer;">${t('pedidos:edit_btn_add')}</button>
                </div>
            </div>

            <div style="background: #fffbeb; padding: 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #fde68a;">
                <h4 style="margin: 0 0 10px 0;">💸 ${t('pedidos:edit_adjustment_title')} <small style="color: #92400e; font-weight: 400;">${t('pedidos:edit_adjustment_hint')}</small></h4>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <input type="number" step="0.01" id="input-ajuste-importe" placeholder="0.00 (negativo para descuento)"
                        value="${ajuste !== 0 ? ajuste.toFixed(2) : ''}"
                        onchange="window.actualizarAjustePedido('importe', this.value)"
                        style="width: 180px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    <span style="font-weight: 600;">${window.currentUser?.moneda || '€'}</span>
                    <input type="text" id="input-ajuste-descripcion" placeholder="${t('pedidos:edit_adjustment_placeholder')}"
                        value="${escapeHTML(state.ajusteDescripcion || '')}"
                        onchange="window.actualizarAjustePedido('descripcion', this.value)"
                        style="flex: 1; min-width: 220px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                </div>
                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 12px;">${t('pedidos:edit_adjustment_warning')}</p>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" onclick="window.cerrarModalEditarPedido()"
                    style="background: #e5e7eb; color: #374151; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer;">${t('pedidos:edit_btn_cancel')}</button>
                <button type="button" onclick="window.guardarEdicionPedido()"
                    style="background: #2563eb; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-weight: 600; cursor: pointer;">💾 ${t('pedidos:edit_btn_save')}</button>
            </div>
        </div>
    `;
    modal.classList.add('active');
}

export function actualizarItemEdicion(idx, campo, valor) {
    const state = window._editandoPedido;
    if (!state || !state.items[idx]) return;
    const num = parseFloat(valor) || 0;
    state.items[idx][campo] = num;
    renderizarModalEditarPedido();
}

export function eliminarItemEdicion(idx) {
    const state = window._editandoPedido;
    if (!state) return;
    state.items.splice(idx, 1);
    renderizarModalEditarPedido();
}

export function actualizarAjustePedido(campo, valor) {
    const state = window._editandoPedido;
    if (!state) return;
    if (campo === 'importe') {
        state.ajusteImporte = parseFloat(valor) || 0;
    } else if (campo === 'descripcion') {
        state.ajusteDescripcion = String(valor || '');
    }
    renderizarModalEditarPedido();
}

/**
 * Autocompleta el campo "Precio unit." del formulario "Añadir ingrediente"
 * cuando el usuario elige un ingrediente del select. Lee el precio unitario
 * desde el data-precio del <option> (ya calculado como precio/cpf en el render).
 * Si el usuario ya había escrito un precio manualmente, NO lo sobreescribe.
 */
export function autocompletarPrecioEdicion(select) {
    const opt = select?.selectedOptions?.[0];
    const precio = parseFloat(opt?.dataset?.precio);
    const input = document.getElementById('input-nuevo-precio-edit');
    if (!input || !(precio > 0)) return;
    const valorActual = parseFloat(input.value);
    if (!valorActual || valorActual <= 0) {
        input.value = precio.toFixed(4).replace(/\.?0+$/, '');
    }
}

export function agregarItemEdicion() {
    const state = window._editandoPedido;
    if (!state) return;

    const ingId = parseInt(document.getElementById('select-nuevo-ing-edit')?.value);
    const cantidad = parseFloat(document.getElementById('input-nueva-cant-edit')?.value);
    let precio = parseFloat(document.getElementById('input-nuevo-precio-edit')?.value);

    if (!ingId || !cantidad || cantidad <= 0) {
        window.showToast?.('Selecciona ingrediente y cantidad válida', 'warning');
        return;
    }

    // Fallback: si el usuario no rellenó el precio, usar precio/cpf del ingrediente.
    if (!precio || precio <= 0) {
        const ing = (window.ingredientes || []).find(i => i.id === ingId);
        if (ing) {
            const cpf = parseFloat(ing.cantidad_por_formato) || 1;
            precio = (parseFloat(ing.precio) || 0) / (cpf || 1);
        }
    }

    state.items.push({
        ingredienteId: ingId,
        cantidad,
        precio_unitario: precio || 0
    });
    renderizarModalEditarPedido();
}

export function cerrarModalEditarPedido() {
    const modal = document.getElementById('modal-editar-pedido');
    if (modal) modal.classList.remove('active');
    window._editandoPedido = null;
}

export async function guardarEdicionPedido() {
    const state = window._editandoPedido;
    if (!state) return;

    if (state.items.length === 0) {
        if (!confirm(t('pedidos:edit_confirm_empty'))) return;
    }

    const subtotalItems = state.items.reduce((sum, it) => sum + (it.cantidad * it.precio_unitario), 0);
    const ajuste = parseFloat(state.ajusteImporte) || 0;
    const total = subtotalItems + ajuste;

    const ingredientesPayload = state.items.map(it => ({
        ingredienteId: it.ingredienteId,
        ingrediente_id: it.ingredienteId,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        precioUnitario: it.precio_unitario,
        precio: it.precio_unitario
    }));

    // Si hay ajuste, añadirlo como item especial al final del array
    if (ajuste !== 0 || state.ajusteDescripcion) {
        ingredientesPayload.push({
            tipo: 'ajuste',
            importe: ajuste,
            descripcion: state.ajusteDescripcion || ''
        });
    }

    try {
        window.showLoading?.();
        // PUT al backend con estado 'pendiente' para que NO escriba en Diario
        await window.api.updatePedido(state.id, {
            estado: 'pendiente',
            ingredientes: ingredientesPayload,
            total
        });

        cerrarModalEditarPedido();
        await window.cargarDatos?.();
        window.renderizarPedidos?.();
        window.hideLoading?.();
        window.showToast?.('Pedido actualizado', 'success');
    } catch (err) {
        window.hideLoading?.();
        console.error('Error guardando edición:', err);
        window.showToast?.('Error al guardar: ' + err.message, 'error');
    }
}

// Exponer al window
if (typeof window !== 'undefined') {
    window.abrirModalEditarPedido = abrirModalEditarPedido;
    window.actualizarItemEdicion = actualizarItemEdicion;
    window.eliminarItemEdicion = eliminarItemEdicion;
    window.agregarItemEdicion = agregarItemEdicion;
    window.autocompletarPrecioEdicion = autocompletarPrecioEdicion;
    window.actualizarAjustePedido = actualizarAjustePedido;
    window.cerrarModalEditarPedido = cerrarModalEditarPedido;
    window.guardarEdicionPedido = guardarEdicionPedido;
}
