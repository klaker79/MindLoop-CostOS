/**
 * ============================================
 * transferencias-ui.js
 * ============================================
 * UI para transferencias inter-restaurante.
 * Se muestra en la pestaña Pedidos para usuarios con rol owner/admin.
 */

import {
    crearTransferencia,
    getTransferenciasEntrantes,
    getTransferenciasSalientes,
    aprobarTransferencia,
    rechazarTransferencia,
    getTransferenciasPendientesCount,
    getOwnerRestaurants
} from './transferencias-crud.js';
import { apiClient } from '../../api/client.js';
import { escapeHTML, cm } from '../../utils/helpers.js';

let ownerRestaurants = [];
let ingredientesCache = [];

/**
 * Check for pending incoming transfers and show badge.
 * Also checks if user is owner to show the transfer button.
 */
export async function checkTransferenciasPendientes() {
    try {
        // Check if user has owner access (can see multiple restaurants)
        const ownerData = await getOwnerRestaurants();
        if (ownerData?.restaurants?.length > 0) {
            ownerRestaurants = ownerData.restaurants;
            // Store current restaurant ID for later use
            const token = window.authToken;
            if (token) {
                try {
                    const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                    window.currentRestauranteId = payload.restauranteId;
                } catch { /* ignore */ }
            }
            // Show transfer button
            const btn = document.getElementById('btn-transferencia');
            if (btn && ownerRestaurants.length > 1) btn.style.display = '';
        }

        const data = await getTransferenciasPendientesCount();
        const count = data?.count || 0;
        actualizarBadgeTransferencias(count);
        if (count > 0) {
            renderizarTransferenciasEntrantes();
        }
    } catch {
        // Silent — user may not have access to transfers
    }
}

/**
 * Badge on Pedidos tab for incoming transfers
 */
function actualizarBadgeTransferencias(count) {
    let badge = document.getElementById('badge-transferencias');
    const tabBtn = document.getElementById('tab-btn-pedidos');
    if (!tabBtn) return;

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'badge-transferencias';
            badge.style.cssText = 'background: #f59e0b; color: white; border-radius: 50%; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px; position: relative; top: -2px;';
            tabBtn.appendChild(badge);
        }
        badge.textContent = count;
    } else if (badge) {
        badge.remove();
    }
}

/**
 * Render incoming transfers panel (shown to destination restaurant)
 */
export async function renderizarTransferenciasEntrantes() {
    const container = document.getElementById('transferencias-panel');
    if (!container) return;

    try {
        const transferencias = await getTransferenciasEntrantes();
        if (!transferencias || transferencias.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 28px;">📦</span>
                    <div>
                        <h3 style="margin: 0; color: #92400e; font-size: 18px;">${transferencias.length} transferencia${transferencias.length > 1 ? 's' : ''} pendiente${transferencias.length > 1 ? 's' : ''}</h3>
                        <p style="margin: 0; color: #a16207; font-size: 13px;">Otro restaurante quiere enviarte productos</p>
                    </div>
                </div>
                ${transferencias.map(t => `
                    <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #fbbf24;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b; font-size: 16px;">${escapeHTML(t.ingrediente_nombre)}</div>
                                <div style="color: #64748b; font-size: 13px; margin-top: 4px;">
                                    De: <strong>${escapeHTML(t.origen_nombre)}</strong> &middot;
                                    Cantidad: <strong>${parseFloat(t.cantidad)}</strong> &middot;
                                    Precio unit: <strong>${cm(parseFloat(t.precio_unitario))}</strong> &middot;
                                    Total: <strong>${cm((parseFloat(t.cantidad) * parseFloat(t.precio_unitario)))}</strong>
                                </div>
                                ${t.notas ? `<div style="color: #94a3b8; font-size: 12px; margin-top: 4px; font-style: italic;">${escapeHTML(t.notas)}</div>` : ''}
                                <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Solicitado por: ${escapeHTML(t.solicitado_por_nombre || 'Desconocido')} &middot; ${new Date(t.created_at).toLocaleDateString('es-ES')}</div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="window.aprobarTransferenciaPendiente(${t.id})"
                                    style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                                    ✅ Aprobar
                                </button>
                                <button onclick="window.rechazarTransferenciaPendiente(${t.id})"
                                    style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
                                    ❌ Rechazar
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch {
        container.style.display = 'none';
    }
}

/**
 * Approve a pending incoming transfer
 */
export async function aprobarTransferenciaPendiente(id) {
    if (!confirm('¿Aprobar esta transferencia? Se añadirá el stock a tu restaurante.')) return;
    try {
        await aprobarTransferencia(id);
        window.showToast?.('Transferencia aprobada. Stock actualizado.', 'success');
        renderizarTransferenciasEntrantes();
        checkTransferenciasPendientes();
    } catch (err) {
        window.showToast?.(err.message || 'Error aprobando transferencia', 'error');
    }
}

/**
 * Reject a pending incoming transfer
 */
export async function rechazarTransferenciaPendiente(id) {
    if (!confirm('¿Rechazar esta transferencia?')) return;
    try {
        await rechazarTransferencia(id);
        window.showToast?.('Transferencia rechazada', 'info');
        renderizarTransferenciasEntrantes();
        checkTransferenciasPendientes();
    } catch (err) {
        window.showToast?.(err.message || 'Error rechazando transferencia', 'error');
    }
}

/**
 * Open the modal to create a new transfer
 */
export async function abrirModalTransferencia() {
    // Load owner restaurants and ingredients if not cached
    try {
        if (ownerRestaurants.length === 0) {
            const data = await getOwnerRestaurants();
            ownerRestaurants = data?.restaurants || [];
        }
        if (ingredientesCache.length === 0) {
            ingredientesCache = await apiClient.get('/ingredients');
        }
    } catch {
        window.showToast?.('Error cargando datos para transferencia', 'error');
        return;
    }

    // Filter out current restaurant from destinations
    const currentRestId = window.currentRestauranteId || null;
    const destinos = ownerRestaurants.filter(r => r.id !== currentRestId);

    if (destinos.length === 0) {
        window.showToast?.('No tienes otros restaurantes para transferir', 'warning');
        return;
    }

    const ingredientesConStock = ingredientesCache.filter(i => parseFloat(i.stock_actual) > 0);

    // Create modal
    let modal = document.getElementById('modal-transferencia');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modal-transferencia';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; padding: 28px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.25);">
            <h3 style="margin: 0 0 20px; color: #1e293b; font-size: 20px;">📦 Nueva Transferencia</h3>

            <div style="margin-bottom: 16px;">
                <label style="font-weight: 600; color: #374151; font-size: 13px; display: block; margin-bottom: 6px;">Restaurante destino</label>
                <select id="transfer-destino" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px;">
                    ${destinos.map(r => `<option value="${r.id}">${escapeHTML(r.nombre)}</option>`).join('')}
                </select>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="font-weight: 600; color: #374151; font-size: 13px; display: block; margin-bottom: 6px;">Ingrediente</label>
                <select id="transfer-ingrediente" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px;">
                    ${ingredientesConStock.map(i => `<option value="${i.id}" data-stock="${i.stock_actual}" data-unidad="${i.unidad || 'ud'}">${escapeHTML(i.nombre)} (stock: ${parseFloat(i.stock_actual).toFixed(1)} ${i.unidad || 'ud'})</option>`).join('')}
                </select>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="font-weight: 600; color: #374151; font-size: 13px; display: block; margin-bottom: 6px;">Cantidad</label>
                <input type="number" id="transfer-cantidad" step="0.1" min="0.1" placeholder="Cantidad a transferir"
                    style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 20px;">
                <label style="font-weight: 600; color: #374151; font-size: 13px; display: block; margin-bottom: 6px;">Notas (opcional)</label>
                <input type="text" id="transfer-notas" placeholder="Motivo de la transferencia..."
                    style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; box-sizing: border-box;" />
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="document.getElementById('modal-transferencia').remove()"
                    style="padding: 10px 20px; border: 2px solid #e5e7eb; background: white; border-radius: 10px; font-weight: 600; cursor: pointer; color: #64748b;">
                    Cancelar
                </button>
                <button onclick="window.enviarTransferencia()"
                    style="padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px;">
                    📦 Enviar Transferencia
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

/**
 * Submit the transfer from the modal form
 */
export async function enviarTransferencia() {
    const destino = document.getElementById('transfer-destino')?.value;
    const ingrediente = document.getElementById('transfer-ingrediente')?.value;
    const cantidad = document.getElementById('transfer-cantidad')?.value;
    const notas = document.getElementById('transfer-notas')?.value;

    if (!destino || !ingrediente || !cantidad || parseFloat(cantidad) <= 0) {
        window.showToast?.('Completa todos los campos', 'warning');
        return;
    }

    try {
        const result = await crearTransferencia({
            destino_restaurante_id: parseInt(destino),
            ingrediente_id: parseInt(ingrediente),
            cantidad: parseFloat(cantidad),
            notas: notas || undefined
        });

        document.getElementById('modal-transferencia')?.remove();

        if (result?.success) {
            const matchInfo = result.ingrediente_destino_match
                ? `(match: ${result.ingrediente_destino_match})`
                : '(sin match automático en destino)';
            window.showToast?.(`Transferencia enviada a ${result.destino_nombre || 'destino'} ${matchInfo}`, 'success');
        }
    } catch (err) {
        window.showToast?.(err.message || 'Error creando transferencia', 'error');
    }
}
