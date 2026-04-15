/**
 * Módulo de edición de pedidos pendientes.
 *
 * Permite modificar items (cantidad/precio), añadir nuevos y eliminar
 * de un pedido que aún no ha sido recibido (estado='pendiente').
 *
 * Si el pedido ya está recibido, no se puede editar desde aquí.
 */

import { escapeHTML } from '../../utils/helpers.js';

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
    let items = [];
    try {
        items = typeof pedido.ingredientes === 'string'
            ? JSON.parse(pedido.ingredientes)
            : (pedido.ingredientes || []);
    } catch (_e) {
        items = [];
    }

    // Normalizar claves para trabajar uniformemente
    items = items.map(it => ({
        ingredienteId: it.ingredienteId || it.ingrediente_id,
        cantidad: parseFloat(it.cantidad) || 0,
        precio_unitario: parseFloat(it.precio_unitario || it.precioUnitario || it.precio || 0)
    }));

    // Estado temporal del modal
    window._editandoPedido = { id, proveedor_id: pedido.proveedor_id, items };

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

    const ingredientesDisponibles = [...(window.ingredientes || [])]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    const ingMap = new Map(ingredientesDisponibles.map(i => [i.id, i]));

    const itemsHtml = state.items.map((it, idx) => {
        const ing = ingMap.get(it.ingredienteId);
        const nombre = ing ? ing.nombre : `Ingrediente #${it.ingredienteId}`;
        const unidad = ing?.unidad || 'ud';
        const subtotal = (it.cantidad * it.precio_unitario).toFixed(2);
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
                    <small style="color: #64748b;">€</small>
                </td>
                <td style="padding: 8px; text-align: right; font-weight: 600;">${subtotal}€</td>
                <td style="padding: 8px;">
                    <button type="button" onclick="window.eliminarItemEdicion(${idx})"
                        style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer;">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    const totalPedido = state.items.reduce((sum, it) => sum + (it.cantidad * it.precio_unitario), 0);

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
                        <th style="text-align: right; padding: 10px; border-bottom: 2px solid #cbd5e1;">Subtotal</th>
                        <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;"></th>
                    </tr>
                </thead>
                <tbody>${itemsHtml || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #94a3b8;">Sin ingredientes</td></tr>'}</tbody>
                <tfoot>
                    <tr style="background: #f8fafc;">
                        <td colspan="3" style="padding: 10px; text-align: right; font-weight: 700;">TOTAL:</td>
                        <td style="padding: 10px; text-align: right; font-weight: 700; color: #059669; font-size: 16px;">${totalPedido.toFixed(2)}€</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <div style="background: #f0f9ff; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 10px 0;">➕ Añadir ingrediente</h4>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <select id="select-nuevo-ing-edit" style="flex: 1; min-width: 200px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                        <option value="">— Selecciona ingrediente —</option>
                        ${ingredientesDisponibles.map(ing => `<option value="${ing.id}">${escapeHTML(ing.nombre)} (${parseFloat(ing.precio || 0).toFixed(2)}€/${escapeHTML(ing.unidad || 'ud')})</option>`).join('')}
                    </select>
                    <input type="number" step="0.01" min="0" id="input-nueva-cant-edit" placeholder="Cantidad"
                        style="width: 100px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    <input type="number" step="0.01" min="0" id="input-nuevo-precio-edit" placeholder="Precio unit."
                        style="width: 110px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    <button type="button" onclick="window.agregarItemEdicion()"
                        style="background: #10b981; color: white; border: none; border-radius: 6px; padding: 8px 16px; font-weight: 600; cursor: pointer;">Añadir</button>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" onclick="window.cerrarModalEditarPedido()"
                    style="background: #e5e7eb; color: #374151; border: none; border-radius: 6px; padding: 10px 20px; cursor: pointer;">Cancelar</button>
                <button type="button" onclick="window.guardarEdicionPedido()"
                    style="background: #2563eb; color: white; border: none; border-radius: 6px; padding: 10px 20px; font-weight: 600; cursor: pointer;">💾 Guardar cambios</button>
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

export function agregarItemEdicion() {
    const state = window._editandoPedido;
    if (!state) return;

    const ingId = parseInt(document.getElementById('select-nuevo-ing-edit')?.value);
    const cantidad = parseFloat(document.getElementById('input-nueva-cant-edit')?.value);
    const precio = parseFloat(document.getElementById('input-nuevo-precio-edit')?.value);

    if (!ingId || !cantidad || cantidad <= 0) {
        window.showToast?.('Selecciona ingrediente y cantidad válida', 'warning');
        return;
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
        if (!confirm('El pedido no tiene ingredientes. ¿Guardar igual?')) return;
    }

    const total = state.items.reduce((sum, it) => sum + (it.cantidad * it.precio_unitario), 0);

    const ingredientesPayload = state.items.map(it => ({
        ingredienteId: it.ingredienteId,
        ingrediente_id: it.ingredienteId,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        precioUnitario: it.precio_unitario,
        precio: it.precio_unitario
    }));

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
    window.cerrarModalEditarPedido = cerrarModalEditarPedido;
    window.guardarEdicionPedido = guardarEdicionPedido;
}
