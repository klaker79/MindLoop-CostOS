/**
 * Smart Order Module
 * Suggests orders based on low stock ingredients, grouped by supplier.
 * User reviews and edits before creating actual pending orders.
 */

import { t } from '@/i18n/index.js';
import { escapeHTML, cm } from '../../utils/helpers.js';

// Guard anti-doble-click: evita que confirmarSmartOrder cree pedidos duplicados
// si el usuario pulsa dos veces seguidas el botón de Smart Order.
let isConfirmingSmartOrder = false;

/**
 * Opens the Smart Order modal with suggested orders based on low stock.
 */
export function abrirSmartOrder() {
    const ingredientes = window.ingredientes || [];
    const proveedores = window.proveedores || [];

    // Find ingredients below minimum stock (same logic as dashboard Low Stock)
    const lowStock = ingredientes.filter(ing => {
        if (ing.stock_actual === null || ing.stock_actual === undefined) return false;
        const stock = parseFloat(ing.stock_actual) || 0;
        const minimo = parseFloat(ing.stock_minimo) || 0;
        return stock === 0 || (minimo > 0 && stock <= minimo);
    });

    if (lowStock.length === 0) {
        window.showToast(t('pedidos:smart_no_low_stock') || 'All ingredients above minimum stock — no orders needed', 'info');
        return;
    }

    // Group by supplier
    const provMap = new Map(proveedores.map(p => [p.id, p]));
    const groups = new Map(); // provId → { proveedor, items: [...] }

    for (const ing of lowStock) {
        const provId = ing.proveedor_id || 0;
        const prov = provMap.get(provId);

        if (!groups.has(provId)) {
            groups.set(provId, {
                proveedor: prov || { id: 0, nombre: t('pedidos:detail_no_supplier') || 'No supplier' },
                items: []
            });
        }

        const stock = parseFloat(ing.stock_actual) || 0;
        const minimo = parseFloat(ing.stock_minimo) || 0;
        const cpf = parseFloat(ing.cantidad_por_formato) || 1;
        // Suggest: enough to reach 2× minimum
        const deficit = Math.max(0, (minimo * 2) - stock);
        // Round up to full format units if buying by format
        const suggestedQty = cpf > 1 ? Math.ceil(deficit / cpf) : parseFloat(deficit.toFixed(2));

        groups.get(provId).items.push({
            id: ing.id,
            nombre: ing.nombre,
            unidad: ing.unidad || 'kg',
            stock,
            minimo,
            deficit,
            suggestedQty,
            cpf,
            formato: ing.formato_compra || '',
            precio: parseFloat(ing.precio) || 0,
            checked: true
        });
    }

    // Build modal
    let modal = document.getElementById('modal-smart-order');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'modal-smart-order';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h3 style="margin: 0;">🧠 Smart Order</h3>
                    <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">
                        ${lowStock.length} ${t('pedidos:smart_items_low') || 'ingredients below minimum stock'} · ${groups.size} ${t('pedidos:smart_suppliers') || 'suppliers'}
                    </p>
                </div>
                <button onclick="document.getElementById('modal-smart-order').classList.remove('active')"
                    style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
            </div>

            <div id="smart-order-content">
                ${renderSmartOrderGroups(groups)}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 2px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">
                    ⚠️ ${t('pedidos:smart_review_hint') || 'Review quantities before creating orders. You can edit or remove items.'}
                </p>
                <div style="display: flex; gap: 10px;">
                    <button onclick="document.getElementById('modal-smart-order').classList.remove('active')"
                        class="btn btn-secondary">${t('pedidos:edit_btn_cancel') || 'Cancel'}</button>
                    <button onclick="window.confirmarSmartOrder()"
                        class="btn btn-primary" style="background: linear-gradient(135deg, #10b981, #059669);">
                        📦 ${t('pedidos:smart_create_orders') || 'Create Orders'}
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    // Store groups for confirmation
    window._smartOrderGroups = groups;
    setTimeout(() => modal.classList.add('active'), 10);
}

function renderSmartOrderGroups(groups) {
    let html = '';
    for (const [provId, group] of groups) {
        const provNombre = escapeHTML(group.proveedor.nombre);
        const itemCount = group.items.filter(i => i.checked).length;

        html += `
        <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #0369a1;">📦 ${provNombre}</strong>
                    <span style="color: #64748b; font-size: 12px; margin-left: 8px;">${itemCount} items</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; font-size: 12px; color: #64748b; text-transform: uppercase;">
                        <th style="padding: 8px; text-align: center; width: 40px;">✓</th>
                        <th style="padding: 8px; text-align: left;">${t('pedidos:col_ingredient') || 'Ingredient'}</th>
                        <th style="padding: 8px; text-align: center;">${t('pedidos:smart_col_stock') || 'Stock'}</th>
                        <th style="padding: 8px; text-align: center;">${t('pedidos:smart_col_min') || 'Min'}</th>
                        <th style="padding: 8px; text-align: center;">${t('pedidos:smart_col_order') || 'Order Qty'}</th>
                        <th style="padding: 8px; text-align: right;">${t('pedidos:smart_col_est_cost') || 'Est. Cost'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${group.items.map((item, idx) => {
                        const unitPrice = item.cpf > 1 ? item.precio : item.precio;
                        const estCost = item.suggestedQty * unitPrice;
                        const stockColor = item.stock <= 0 ? '#dc2626' : item.stock <= item.minimo * 0.5 ? '#f59e0b' : '#64748b';
                        return `
                        <tr style="border-top: 1px solid #f1f5f9;" id="smart-row-${provId}-${idx}">
                            <td style="padding: 8px; text-align: center;">
                                <input type="checkbox" checked
                                    onchange="window.toggleSmartItem(${provId}, ${idx}, this.checked)"
                                    style="width: 18px; height: 18px; cursor: pointer;">
                            </td>
                            <td style="padding: 8px;">
                                <strong style="font-size: 13px;">${escapeHTML(item.nombre)}</strong>
                                ${item.formato ? `<br><small style="color: #94a3b8;">${escapeHTML(item.formato)} ×${item.cpf}</small>` : ''}
                            </td>
                            <td style="padding: 8px; text-align: center;">
                                <span style="color: ${stockColor}; font-weight: 600;">${item.stock}</span>
                                <small style="color: #94a3b8;"> ${escapeHTML(item.unidad)}</small>
                            </td>
                            <td style="padding: 8px; text-align: center; color: #64748b;">${item.minimo}</td>
                            <td style="padding: 8px; text-align: center;">
                                <input type="number" step="0.01" min="0" value="${item.suggestedQty}"
                                    onchange="window.updateSmartQty(${provId}, ${idx}, this.value)"
                                    style="width: 80px; padding: 6px; border: 2px solid #10b981; border-radius: 6px; text-align: center; font-weight: 600;">
                                ${item.formato ? `<small style="color: #94a3b8;"> ${escapeHTML(item.formato)}${item.suggestedQty !== 1 ? 's' : ''}</small>` : `<small style="color: #94a3b8;"> ${escapeHTML(item.unidad)}</small>`}
                            </td>
                            <td style="padding: 8px; text-align: right; color: #374151; font-weight: 500;">
                                <span id="smart-cost-${provId}-${idx}">${cm(estCost)}</span>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    }
    return html;
}

/**
 * Toggle an item on/off in Smart Order
 */
export function toggleSmartItem(provId, idx, checked) {
    const groups = window._smartOrderGroups;
    if (!groups) return;
    const group = groups.get(provId);
    if (!group || !group.items[idx]) return;
    group.items[idx].checked = checked;
    const row = document.getElementById(`smart-row-${provId}-${idx}`);
    if (row) row.style.opacity = checked ? '1' : '0.4';
}

/**
 * Update suggested quantity for an item
 */
export function updateSmartQty(provId, idx, value) {
    const groups = window._smartOrderGroups;
    if (!groups) return;
    const group = groups.get(provId);
    if (!group || !group.items[idx]) return;
    const item = group.items[idx];
    item.suggestedQty = parseFloat(value) || 0;
    const estCost = item.suggestedQty * item.precio;
    const costEl = document.getElementById(`smart-cost-${provId}-${idx}`);
    if (costEl) costEl.textContent = cm(estCost);
}

/**
 * Create actual pending orders from Smart Order selections
 */
export async function confirmarSmartOrder() {
    // Bloqueo anti-doble-click: si ya hay una confirmación en curso, ignorar.
    if (isConfirmingSmartOrder) {
        console.warn('Smart Order ya en curso, ignorando doble click');
        return;
    }

    const groups = window._smartOrderGroups;
    if (!groups) return;

    const ordersToCreate = [];
    for (const [provId, group] of groups) {
        const checkedItems = group.items.filter(i => i.checked && i.suggestedQty > 0);
        if (checkedItems.length === 0) continue;
        if (provId === 0) continue; // Skip items without supplier

        const ingredientes = checkedItems.map(item => ({
            ingredienteId: item.id,
            ingrediente_id: item.id,
            cantidad: item.suggestedQty * (item.cpf > 1 ? item.cpf : 1), // Convert format to base units
            precio_unitario: item.cpf > 1 ? item.precio / item.cpf : item.precio,
            precioUnitario: item.cpf > 1 ? item.precio / item.cpf : item.precio,
        }));

        const total = ingredientes.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

        ordersToCreate.push({
            proveedor_id: group.proveedor.id,
            proveedorNombre: group.proveedor.nombre,
            fecha: new Date().toISOString().split('T')[0],
            ingredientes,
            total,
            estado: 'pendiente',
        });
    }

    if (ordersToCreate.length === 0) {
        window.showToast(t('pedidos:smart_no_items_selected') || 'No items selected', 'warning');
        return;
    }

    if (!confirm(`${t('pedidos:smart_confirm') || 'Create'} ${ordersToCreate.length} ${t('pedidos:smart_pending_orders') || 'pending orders'}?\n\n${ordersToCreate.map(o => `• ${o.proveedorNombre}: ${o.ingredientes.length} items — ${cm(o.total)}`).join('\n')}`)) {
        return;
    }

    isConfirmingSmartOrder = true;
    window.showLoading();
    let created = 0;

    try {
        for (const order of ordersToCreate) {
            const result = await window.api.createPedido(order);
            if (result.id) created++;
        }

        document.getElementById('modal-smart-order')?.classList.remove('active');
        window._smartOrderGroups = null;

        await window.cargarDatos();
        window.renderizarPedidos();
        window.hideLoading();
        window.showToast(`${created} ${t('pedidos:smart_orders_created') || 'orders created'} — ${t('pedidos:smart_review_and_receive') || 'review and receive when ready'}`, 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Smart Order error:', error);
        window.showToast(`Error: ${error.message}`, 'error');
    } finally {
        isConfirmingSmartOrder = false;
    }
}
