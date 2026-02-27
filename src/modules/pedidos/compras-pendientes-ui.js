/**
 * ============================================
 * compras-pendientes-ui.js
 * ============================================
 * Panel de revisión de compras pendientes (importadas por n8n)
 * Se muestra en la pestaña Pedidos con notificación de badge
 */

import { fetchComprasPendientes, aprobarItem, aprobarBatch, editarItemPendiente, rechazarItem, cambiarFormato } from './compras-pendientes-crud.js';
import { apiClient } from '../../api/client.js';
import { t } from '@/i18n/index.js';

let ingredientesCache = [];

/**
 * Cargar ingredientes para el selector de edición
 */
async function cargarIngredientesParaSelector() {
    if (ingredientesCache.length > 0) return;
    try {
        ingredientesCache = await apiClient.get('/ingredients');
    } catch (e) {
        console.error('Error cargando ingredientes para selector:', e);
    }
}

/**
 * Agrupar items por batch_id
 */
function agruparPorBatch(items) {
    const batches = new Map();
    for (const item of items) {
        if (!batches.has(item.batch_id)) {
            batches.set(item.batch_id, []);
        }
        batches.get(item.batch_id).push(item);
    }
    return batches;
}

/**
 * Renderizar badge de notificación en el tab de Pedidos
 */
export function actualizarBadgePendientes(count) {
    let badge = document.getElementById('badge-pendientes');
    const tabBtn = document.getElementById('tab-btn-pedidos');

    if (!tabBtn) return;

    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'badge-pendientes';
        badge.style.cssText = 'background: #ef4444; color: white; font-size: 10px; padding: 2px 7px; border-radius: 10px; position: absolute; top: -6px; right: -6px; font-weight: 700; min-width: 16px; text-align: center;';
        tabBtn.style.position = 'relative';
        tabBtn.appendChild(badge);
    }

    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Cargar y renderizar el panel de compras pendientes
 */
export async function renderizarComprasPendientes() {
    const container = document.getElementById('compras-pendientes-panel');
    if (!container) return;

    try {
        const pendientes = await fetchComprasPendientes();
        actualizarBadgePendientes(pendientes.length);

        if (!pendientes || pendientes.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        await cargarIngredientesParaSelector();

        const batches = agruparPorBatch(pendientes);
        let html = '';

        for (const [batchId, items] of batches) {
            const fecha = items[0]?.fecha ? new Date(items[0].fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
            const totalItems = items.length;
            const sinMatch = items.filter(i => !i.ingrediente_id).length;

            // 🔒 Detección de duplicado a nivel de albarán completo
            const pedidoDup = items.find(i => i.pedido_duplicado_id);
            const esBatchDuplicado = !!pedidoDup;
            const fechaPedidoDup = pedidoDup?.pedido_duplicado_fecha ? new Date(pedidoDup.pedido_duplicado_fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            const totalPedidoDup = pedidoDup?.pedido_duplicado_total ? parseFloat(pedidoDup.pedido_duplicado_total).toFixed(2) : '';
            const estadoPedidoDup = pedidoDup?.pedido_duplicado_estado || '';

            html += `
            <div class="pending-batch" data-batch-id="${batchId}" style="
                background: linear-gradient(135deg, ${esBatchDuplicado ? '#fef2f2 0%, #fee2e2 100%' : '#fef3c7 0%, #fde68a 100%'});
                border: 2px solid ${esBatchDuplicado ? '#ef4444' : '#f59e0b'};
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 16px;
            ">
                ${esBatchDuplicado ? `
                <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">⚠️</span>
                    <div>
                        <div style="font-size: 13px; font-weight: 700; color: #dc2626;">${t('pedidos:pending_possible_duplicate')} — ${estadoPedidoDup === 'ya aprobado' ? t('pedidos:pending_dup_already_approved') : estadoPedidoDup === 'pendiente en otro albarán' ? t('pedidos:pending_dup_pending_other') : t('pedidos:pending_dup_manual_exists')}</div>
                        <div style="font-size: 12px; color: #b91c1c;">${fechaPedidoDup}${totalPedidoDup ? ` · ${totalPedidoDup}€` : ''} · ${t('pedidos:pending_status')}: ${estadoPedidoDup}</div>
                    </div>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, ${esBatchDuplicado ? '#ef4444, #dc2626' : '#f59e0b, #d97706'}); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: white;">${esBatchDuplicado ? '⚠️' : '📋'}</div>
                        <div>
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: ${esBatchDuplicado ? '#991b1b' : '#92400e'};">${t('pedidos:pending_delivery_note_from', { date: fecha })}</h3>
                            <p style="margin: 2px 0 0; font-size: 13px; color: ${esBatchDuplicado ? '#b91c1c' : '#b45309'};">${t('pedidos:pending_products_count', { count: totalItems })}${sinMatch > 0 ? ` · <span style="color: #dc2626; font-weight: 600;">${t('pedidos:pending_unassigned', { count: sinMatch })}</span>` : ''}</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${esBatchDuplicado ? `
                        <button disabled style="
                            padding: 10px 20px; border: none; border-radius: 10px;
                            background: #fca5a5; color: #991b1b; font-weight: 600; font-size: 13px; cursor: not-allowed;
                        ">⚠️ ${t('pedidos:pending_review_duplicate')}</button>` :
                    sinMatch === 0 ? `
                        <button onclick="window.aprobarBatchPendiente('${batchId}')" style="
                            padding: 10px 20px; border: none; border-radius: 10px;
                            background: linear-gradient(135deg, #22c55e, #16a34a);
                            color: white; font-weight: 700; font-size: 14px; cursor: pointer;
                            box-shadow: 0 4px 12px rgba(34,197,94,0.3);
                        ">✅ ${t('pedidos:pending_approve_all')}</button>` : `
                        <button disabled style="
                            padding: 10px 20px; border: none; border-radius: 10px;
                            background: #d1d5db; color: #6b7280; font-weight: 600; font-size: 13px; cursor: not-allowed;
                        ">⚠️ ${t('pedidos:pending_assign_first')}</button>`}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">`;

            for (const item of items) {
                const matchClass = item.ingrediente_id
                    ? (item.ingrediente_nombre_db?.toLowerCase().includes(item.ingrediente_nombre?.toLowerCase()?.substring(0, 8)) ? 'match-exact' : 'match-partial')
                    : 'match-none';
                const matchIcon = matchClass === 'match-exact' ? '🟢' : matchClass === 'match-partial' ? '🟡' : '🔴';
                const matchLabel = item.ingrediente_nombre_db || t('pedidos:pending_not_assigned');
                const esDuplicado = !!item.compra_diaria_existente;
                const borderColor = matchClass === 'match-none' ? '#fca5a5' : esDuplicado ? '#f59e0b' : '#e5e7eb';

                html += `
                    <div class="pending-item" data-item-id="${item.id}" style="
                        background: ${esDuplicado ? '#fffbeb' : 'white'}; border-radius: 12px; padding: 14px 16px;
                        display: grid; grid-template-columns: 1fr auto auto auto auto auto auto auto; gap: 12px; align-items: center;
                        border: 2px solid ${borderColor};
                    ">
                        <div>
                            <div style="font-size: 13px; color: #6b7280; margin-bottom: 2px;">📄 ${item.ingrediente_nombre}</div>
                            ${esDuplicado ? `<div style="font-size: 11px; color: #d97706; background: #fef3c7; padding: 3px 8px; border-radius: 6px; margin-bottom: 4px; font-weight: 600;">⚠️ ${t('pedidos:pending_possible_duplicate')} — ${t('pedidos:pending_already_registered', { qty: parseFloat(item.cantidad_ya_registrada || 0).toFixed(1), price: parseFloat(item.precio_ya_registrado || 0).toFixed(2) })}</div>` : ''}
                            <div style="font-size: 14px; font-weight: 600; color: ${matchClass === 'match-none' ? '#dc2626' : '#1e293b'};">
                                ${matchIcon} ${matchLabel}
                                ${matchClass !== 'match-exact' ? `
                                <select onchange="window.cambiarIngredientePendiente(${item.id}, this.value)" style="
                                    margin-left: 8px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; max-width: 180px;
                                ">
                                    <option value="">${t('pedidos:form_select_supplier')}</option>
                                    ${[...ingredientesCache].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(ing => `<option value="${ing.id}" ${ing.id === item.ingrediente_id ? 'selected' : ''}>${ing.nombre}</option>`).join('')}
                                </select>` : ''}
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">${t('pedidos:pending_col_date')}</div>
                            <input type="date" value="${item.fecha ? item.fecha.substring(0, 10) : ''}"
                                onchange="window.editarCampoPendiente(${item.id}, 'fecha', this.value, this)"
                                style="width: 120px; text-align: center; font-weight: 600; color: #1e293b; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; font-size: 13px; background: #f9fafb;" />
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">${t('pedidos:pending_col_quantity')}</div>
                            <input type="number" step="0.1" min="0" value="${parseFloat(item.cantidad).toFixed(1)}"
                                onchange="window.editarCampoPendiente(${item.id}, 'cantidad', this.value, this)"
                                style="width: 60px; text-align: center; font-weight: 700; color: #1e293b; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; font-size: 14px; background: #f9fafb;" />
                        </div>
                        ${item.ingrediente_id && item.ingrediente_formato_compra && parseFloat(item.ingrediente_cantidad_por_formato || 0) > 1 ? `
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">${t('pedidos:pending_col_format')}</div>
                            <select onchange="window.cambiarFormatoPendiente(${item.id}, this.value, this)" style="
                                padding: 4px 6px; border: 1px solid #a78bfa; border-radius: 6px; font-size: 11px;
                                background: #f5f3ff; color: #5b21b6; font-weight: 600; max-width: 120px;
                            ">
                                <option value="1" ${parseFloat(item.formato_override || 1) === 1 ? 'selected' : ''}>${item.unidad || 'ud'} (×1)</option>
                                <option value="${item.ingrediente_cantidad_por_formato}" ${parseFloat(item.formato_override || 1) > 1 ? 'selected' : ''}>${item.ingrediente_formato_compra} (×${parseFloat(item.ingrediente_cantidad_por_formato)})</option>
                            </select>
                            <div style="font-size: 10px; color: #7c3aed; margin-top: 2px; font-weight: 600;">
                                Stock: +${(parseFloat(item.cantidad) * parseFloat(item.formato_override || 1)).toFixed(1)} ${item.unidad || 'ud'}
                            </div>
                        </div>` : ''}
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">${t('pedidos:pending_col_price')}</div>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                                <input type="number" step="0.01" min="0" value="${parseFloat(item.precio).toFixed(2)}"
                                    onchange="window.editarCampoPendiente(${item.id}, 'precio', this.value, this)"
                                    style="width: 70px; text-align: center; font-weight: 700; color: #1e293b; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; font-size: 14px; background: #f9fafb;" />
                                <span style="font-weight: 700; color: #1e293b;">€</span>
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">Total</div>

                            <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                                <input type="number" step="0.01" min="0" value="${(item.precio * item.cantidad).toFixed(2)}"
                                    onchange="window.editarTotalPendiente(${item.id}, this.value, this)"
                                    data-total
                                    style="width: 75px; text-align: center; font-weight: 700; color: #059669; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; font-size: 14px; background: #f0fdf4;" />
                                <span style="font-weight: 700; color: #059669;">€</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            ${item.ingrediente_id ? `
                            <button onclick="window.aprobarItemPendiente(${item.id})" title="Aprobar" style="
                                width: 36px; height: 36px; border: none; border-radius: 8px;
                                background: #dcfce7; color: #16a34a; font-size: 16px; cursor: pointer;
                            ">✅</button>` : ''}
                            <button onclick="window.rechazarItemPendiente(${item.id})" title="Rechazar" style="
                                width: 36px; height: 36px; border: none; border-radius: 8px;
                                background: #fee2e2; color: #dc2626; font-size: 16px; cursor: pointer;
                            ">❌</button>
                        </div>
                    </div>`;
            }

            html += `</div></div>`;
        }

        container.innerHTML = `
            <div style="
                display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
                padding: 16px 20px; background: linear-gradient(135deg, #fef3c7, #fde68a);
                border-radius: 12px; border: 2px solid #f59e0b;
            ">
                <span style="font-size: 28px;">🔔</span>
                <div>
                    <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: #92400e;">
                        ${t('pedidos:pending_review_title', { count: pendientes.length })}
                    </h3>
                    <p style="margin: 2px 0 0; font-size: 13px; color: #b45309;">
                        ${t('pedidos:pending_review_subtitle')}
                    </p>
                </div>
            </div>
            ${html}
        `;
    } catch (err) {
        console.error('Error cargando compras pendientes:', err);
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

/**
 * Aprobar un item individual
 */
export async function aprobarItemPendiente(id) {
    try {
        window.showToast?.(t('pedidos:pending_approving'), 'info');
        await aprobarItem(id);
        window.showToast?.(t('pedidos:pending_approved'), 'success');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error aprobando item:', err);
        window.showToast?.(t('pedidos:pending_error_approving', { message: err.message }), 'error');
    }
}

/**
 * Aprobar todos los items de un batch
 */
export async function aprobarBatchPendiente(batchId) {
    try {
        window.showToast?.(t('pedidos:pending_batch_approving'), 'info');
        const result = await aprobarBatch(batchId);
        window.showToast?.(result.omitidos
            ? t('pedidos:pending_batch_approved_with_skipped', { approved: result.aprobados, skipped: result.omitidos })
            : t('pedidos:pending_batch_approved', { approved: result.aprobados }), 'success');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error aprobando batch:', err);
        window.showToast?.(t('pedidos:pending_error_approving', { message: err.message }), 'error');
    }
}

/**
 * Cambiar ingrediente asignado a un item pendiente
 */
export async function cambiarIngredientePendiente(id, ingredienteId) {
    try {
        if (!ingredienteId) return;
        await editarItemPendiente(id, { ingrediente_id: parseInt(ingredienteId) });
        window.showToast?.(t('pedidos:pending_ingredient_assigned'), 'success');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error editando item:', err);
        window.showToast?.(t('pedidos:pending_error_editing', { message: err.message }), 'error');
    }
}

/**
 * Cambiar formato de compra (override para conversión de stock)
 */
export async function cambiarFormatoPendiente(id, formatoOverride, selectEl) {
    try {
        await cambiarFormato(id, parseFloat(formatoOverride));
        const itemEl = selectEl?.closest('.pending-item');
        if (itemEl) {
            const cantidadInput = itemEl.querySelector('input[type="number"]');
            const cantidad = parseFloat(cantidadInput?.value || 0);
            const previewEl = selectEl.parentElement.querySelector('div:last-child');
            if (previewEl) {
                previewEl.textContent = `Stock: +${(cantidad * parseFloat(formatoOverride)).toFixed(1)}`;
            }
        }
        window.showToast?.(t('pedidos:pending_format_updated', { format: formatoOverride }), 'success');
    } catch (err) {
        console.error('Error cambiando formato:', err);
        window.showToast?.(t('pedidos:pending_error_format', { message: err.message }), 'error');
    }
}

/**
 * Rechazar un item pendiente
 */
export async function rechazarItemPendiente(id) {
    if (!confirm(t('pedidos:pending_confirm_reject'))) return;
    try {
        await rechazarItem(id);
        window.showToast?.(t('pedidos:pending_rejected'), 'info');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error rechazando item:', err);
        window.showToast?.(t('pedidos:pending_error_rejecting', { message: err.message }), 'error');
    }
}

/**
 * Editar campo individual (precio, cantidad, o fecha) de un item pendiente
 */
export async function editarCampoPendiente(id, campo, valor, inputEl) {
    try {
        let valorFinal;
        if (campo === 'fecha') {
            if (!valor) { window.showToast?.(t('pedidos:pending_invalid_date'), 'error'); return; }
            valorFinal = valor; // string YYYY-MM-DD
        } else {
            valorFinal = parseFloat(valor);
            if (isNaN(valorFinal) || valorFinal < 0) {
                window.showToast?.(t('pedidos:pending_invalid_value'), 'error');
                return;
            }
        }
        await editarItemPendiente(id, { [campo]: valorFinal });
        // Actualizar el total inline sin recargar todo el panel (solo para campos numéricos)
        if (campo !== 'fecha') {
            const itemDiv = inputEl?.closest('.pending-item');
            if (itemDiv) {
                const inputs = itemDiv.querySelectorAll('input[type=number]');
                const cant = parseFloat(inputs[0]?.value || 0);
                const precio = parseFloat(inputs[1]?.value || 0);
                const totalInput = itemDiv.querySelector('[data-total]');
                if (totalInput) totalInput.value = (cant * precio).toFixed(2);
            }
        }
        inputEl.style.borderColor = '#22c55e';
        setTimeout(() => { if (inputEl) inputEl.style.borderColor = '#e5e7eb'; }, 1500);
    } catch (err) {
        console.error('Error editando campo:', err);
        window.showToast?.(t('pedidos:pending_error_saving', { message: err.message }), 'error');
        inputEl.style.borderColor = '#ef4444';
    }
}

/**
 * Editar total directamente — recalcula precio unitario (total ÷ cantidad)
 */
export async function editarTotalPendiente(id, totalStr, inputEl) {
    try {
        const total = parseFloat(totalStr);
        if (isNaN(total) || total < 0) {
            window.showToast?.(t('pedidos:pending_invalid_value'), 'error');
            return;
        }
        const itemDiv = inputEl?.closest('.pending-item');
        const cantInput = itemDiv?.querySelectorAll('input[type=number]')?.[0];
        const cant = parseFloat(cantInput?.value || 1);
        const nuevoPrecio = cant > 0 ? +(total / cant).toFixed(4) : 0;

        await editarItemPendiente(id, { precio: nuevoPrecio });

        const precioInput = itemDiv?.querySelectorAll('input[type=number]')?.[1];
        if (precioInput) precioInput.value = nuevoPrecio.toFixed(2);

        inputEl.style.borderColor = '#22c55e';
        setTimeout(() => { if (inputEl) inputEl.style.borderColor = '#e5e7eb'; }, 1500);
    } catch (err) {
        console.error('Error editando total:', err);
        window.showToast?.(t('pedidos:pending_error_saving', { message: err.message }), 'error');
        inputEl.style.borderColor = '#ef4444';
    }
}

/**
 * Verificar si hay pendientes (para badge en dashboard/pedidos)
 */
export async function checkPendientes() {
    try {
        const pendientes = await fetchComprasPendientes();
        actualizarBadgePendientes(pendientes?.length || 0);
        return pendientes?.length || 0;
    } catch (e) {
        return 0;
    }
}
