/**
 * ============================================
 * compras-pendientes-ui.js
 * ============================================
 * Panel de revisión de compras pendientes (importadas por n8n)
 * Se muestra en la pestaña Pedidos con notificación de badge
 */

import { fetchComprasPendientes, aprobarItem, aprobarBatch, editarItemPendiente, rechazarItem } from './compras-pendientes-crud.js';
import { apiClient } from '../../api/client.js';

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

            html += `
            <div class="pending-batch" data-batch-id="${batchId}" style="
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border: 2px solid #f59e0b;
                border-radius: 16px;
                padding: 20px;
                margin-bottom: 16px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: white;">📋</div>
                        <div>
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #92400e;">Albarán del ${fecha}</h3>
                            <p style="margin: 2px 0 0; font-size: 13px; color: #b45309;">${totalItems} productos${sinMatch > 0 ? ` · <span style="color: #dc2626; font-weight: 600;">${sinMatch} sin asignar</span>` : ''}</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${sinMatch === 0 ? `
                        <button onclick="window.aprobarBatchPendiente('${batchId}')" style="
                            padding: 10px 20px; border: none; border-radius: 10px;
                            background: linear-gradient(135deg, #22c55e, #16a34a);
                            color: white; font-weight: 700; font-size: 14px; cursor: pointer;
                            box-shadow: 0 4px 12px rgba(34,197,94,0.3);
                        ">✅ Aprobar Todo</button>` : `
                        <button disabled style="
                            padding: 10px 20px; border: none; border-radius: 10px;
                            background: #d1d5db; color: #6b7280; font-weight: 600; font-size: 13px; cursor: not-allowed;
                        ">⚠️ Asigna ingredientes primero</button>`}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">`;

            for (const item of items) {
                const matchClass = item.ingrediente_id
                    ? (item.ingrediente_nombre_db?.toLowerCase().includes(item.ingrediente_nombre?.toLowerCase()?.substring(0, 8)) ? 'match-exact' : 'match-partial')
                    : 'match-none';
                const matchIcon = matchClass === 'match-exact' ? '🟢' : matchClass === 'match-partial' ? '🟡' : '🔴';
                const matchLabel = item.ingrediente_nombre_db || 'Sin asignar';

                html += `
                    <div class="pending-item" data-item-id="${item.id}" style="
                        background: white; border-radius: 12px; padding: 14px 16px;
                        display: grid; grid-template-columns: 1fr auto auto auto auto; gap: 12px; align-items: center;
                        border: 1px solid ${matchClass === 'match-none' ? '#fca5a5' : '#e5e7eb'};
                    ">
                        <div>
                            <div style="font-size: 13px; color: #6b7280; margin-bottom: 2px;">📄 ${item.ingrediente_nombre}</div>
                            <div style="font-size: 14px; font-weight: 600; color: ${matchClass === 'match-none' ? '#dc2626' : '#1e293b'};">
                                ${matchIcon} ${matchLabel}
                                ${matchClass !== 'match-exact' ? `
                                <select onchange="window.cambiarIngredientePendiente(${item.id}, this.value)" style="
                                    margin-left: 8px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; max-width: 180px;
                                ">
                                    <option value="">Seleccionar...</option>
                                    ${[...ingredientesCache].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(ing => `<option value="${ing.id}" ${ing.id === item.ingrediente_id ? 'selected' : ''}>${ing.nombre}</option>`).join('')}
                                </select>` : ''}
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">Cantidad</div>
                            <input type="number" step="0.1" min="0" value="${parseFloat(item.cantidad).toFixed(1)}"
                                onchange="window.editarCampoPendiente(${item.id}, 'cantidad', this.value, this)"
                                style="width: 60px; text-align: center; font-weight: 700; color: #1e293b; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; font-size: 14px; background: #f9fafb;" />
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">Precio</div>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                                <input type="number" step="0.01" min="0" value="${parseFloat(item.precio).toFixed(2)}"
                                    onchange="window.editarCampoPendiente(${item.id}, 'precio', this.value, this)"
                                    style="width: 70px; text-align: center; font-weight: 700; color: #1e293b; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; font-size: 14px; background: #f9fafb;" />
                                <span style="font-weight: 700; color: #1e293b;">€</span>
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #9ca3af;">Total</div>
                            <div data-total style="font-weight: 700; color: #059669;">${(item.precio * item.cantidad).toFixed(2)}€</div>
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
                        ${pendientes.length} compra${pendientes.length !== 1 ? 's' : ''} pendiente${pendientes.length !== 1 ? 's' : ''} de revisión
                    </h3>
                    <p style="margin: 2px 0 0; font-size: 13px; color: #b45309;">
                        Importadas automáticamente desde albarán. Revisa y aprueba antes de registrar.
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
        window.showToast?.('Aprobando compra...', 'info');
        await aprobarItem(id);
        window.showToast?.('✅ Compra aprobada y registrada', 'success');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error aprobando item:', err);
        window.showToast?.('Error al aprobar: ' + err.message, 'error');
    }
}

/**
 * Aprobar todos los items de un batch
 */
export async function aprobarBatchPendiente(batchId) {
    try {
        window.showToast?.('Aprobando albarán completo...', 'info');
        const result = await aprobarBatch(batchId);
        window.showToast?.(`✅ ${result.aprobados} compras aprobadas${result.omitidos ? `, ${result.omitidos} omitidas` : ''}`, 'success');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error aprobando batch:', err);
        window.showToast?.('Error al aprobar: ' + err.message, 'error');
    }
}

/**
 * Cambiar ingrediente asignado a un item pendiente
 */
export async function cambiarIngredientePendiente(id, ingredienteId) {
    try {
        if (!ingredienteId) return;
        await editarItemPendiente(id, { ingrediente_id: parseInt(ingredienteId) });
        window.showToast?.('Ingrediente asignado correctamente', 'success');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error editando item:', err);
        window.showToast?.('Error al editar: ' + err.message, 'error');
    }
}

/**
 * Rechazar un item pendiente
 */
export async function rechazarItemPendiente(id) {
    if (!confirm('¿Rechazar esta compra? No se registrará en el diario.')) return;
    try {
        await rechazarItem(id);
        window.showToast?.('Compra rechazada', 'info');
        await renderizarComprasPendientes();
    } catch (err) {
        console.error('Error rechazando item:', err);
        window.showToast?.('Error al rechazar: ' + err.message, 'error');
    }
}

/**
 * Editar campo individual (precio o cantidad) de un item pendiente
 */
export async function editarCampoPendiente(id, campo, valor, inputEl) {
    try {
        const numVal = parseFloat(valor);
        if (isNaN(numVal) || numVal < 0) {
            window.showToast?.('Valor no válido', 'error');
            return;
        }
        await editarItemPendiente(id, { [campo]: numVal });
        // Actualizar el total inline sin recargar todo el panel
        const itemDiv = inputEl?.closest('.pending-item');
        if (itemDiv) {
            const inputs = itemDiv.querySelectorAll('input[type=number]');
            const cant = parseFloat(inputs[0]?.value || 0);
            const precio = parseFloat(inputs[1]?.value || 0);
            const totalDiv = itemDiv.querySelector('[data-total]');
            if (totalDiv) totalDiv.textContent = (cant * precio).toFixed(2) + '€';
        }
        inputEl.style.borderColor = '#22c55e';
        setTimeout(() => { if (inputEl) inputEl.style.borderColor = '#e5e7eb'; }, 1500);
    } catch (err) {
        console.error('Error editando campo:', err);
        window.showToast?.('Error al guardar: ' + err.message, 'error');
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
