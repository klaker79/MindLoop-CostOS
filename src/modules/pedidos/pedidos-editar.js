/**
 * Módulo de edición de pedidos pendientes.
 *
 * Permite modificar items (cantidad/precio), añadir nuevos y eliminar
 * de un pedido que aún no ha sido recibido (estado='pendiente').
 *
 * Si el pedido ya está recibido, no se puede editar desde aquí.
 */

import { escapeHTML, cm, formatQuantity } from '../../utils/helpers.js';
import { validarDesvioPrecio } from '../../utils/precio-validator.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { formatoDesdeBase } from './formato-utils.js';
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
                precio_unitario: parseFloat(it.precio_unitario || it.precioUnitario || it.precio || 0),
                // 🍽️ preservar la marca de comida personal al editar (si no, se
                // perdería al guardar y la línea volvería a contar en food cost).
                personal: it.personal === true
            });
        }
    });

    // 🍽️ Fusionar el reparto en UNA sola fila: un pedido dividido se guarda como
    // dos líneas (producción + personal) del mismo ingrediente. Para editarlo, se
    // muestran como una fila con la cantidad TOTAL y la cantidad personal en su
    // casilla. Al guardar, guardarEdicionPedido vuelve a partirla en dos líneas.
    const mergedItems = [];
    items.filter(it => !it.personal).forEach(it => mergedItems.push({ ...it, personalQty: null }));
    items.filter(it => it.personal).forEach(it => {
        const prod = mergedItems.find(m => !m.personal
            && m.ingredienteId === it.ingredienteId
            && m.precio_unitario === it.precio_unitario);
        if (prod) {
            // Hay parte de producción → fila única con reparto parcial.
            prod.personal = true;
            prod.personalQty = it.cantidad;
            prod.cantidad = Math.round((prod.cantidad + it.cantidad) * 10000) / 10000;
        } else {
            // Línea totalmente personal (sin parte de producción): casilla marcada,
            // sin reparto (toda la línea es personal).
            mergedItems.push({ ...it, personalQty: null });
        }
    });

    // IVA habitual del proveedor — display visual para cuadrar contra albarán.
    // No se persiste en BD (igual que en Nuevo Pedido y Recepción).
    const prov = (window.proveedores || []).find(p => p.id === pedido.proveedor_id);
    const ivaInicial = (prov && prov.iva_pct !== null && prov.iva_pct !== undefined) ? prov.iva_pct : 0;

    // Estado temporal del modal
    window._editandoPedido = {
        id,
        proveedor_id: pedido.proveedor_id,
        items: mergedItems,
        ajusteImporte,
        ajusteDescripcion,
        ivaPct: ivaInicial
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
    const moneda = window.currentUser?.moneda || '€';

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
        const aviso = validarDesvioPrecio(ing, it.cantidad, subtotal);
        const avisoRow = aviso
            ? `<tr><td colspan="5" style="padding: 6px 8px;"><div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:6px 10px;color:#92400e;font-size:12px;font-weight:600;">${escapeHTML(aviso.mensaje)}</div></td></tr>`
            : '';

        // 📦 Mostrar la línea en el FORMATO de compra (bote, caja…) como en Nuevo
        // Pedido, no en unidad base. El dato sigue guardándose en base (food cost
        // intacto); aquí sólo se traduce para mostrar/editar. cpf>1 = hay formato.
        const cpfRaw = parseFloat(ing?.cantidad_por_formato);
        const cpf = cpfRaw > 1 ? cpfRaw : 1;
        const formatoNombre = ing?.formato_compra;
        const usaFormato = cpf > 1 && !!formatoNombre;
        const fmt = usaFormato ? formatoDesdeBase(it.cantidad, it.precio_unitario, cpf) : null;
        const cantShown = usaFormato ? fmt.cantidad : it.cantidad;
        const precioShown = usaFormato ? fmt.precio : it.precio_unitario;
        const cantOnchange = usaFormato
            ? `window.actualizarItemEdicionFmt(${idx}, 'cantidad', this.value, ${cpf})`
            : `window.actualizarItemEdicion(${idx}, 'cantidad', this.value)`;
        const precioOnchange = usaFormato
            ? `window.actualizarItemEdicionFmt(${idx}, 'precio_unitario', this.value, ${cpf})`
            : `window.actualizarItemEdicion(${idx}, 'precio_unitario', this.value)`;
        const personalQtyShown = usaFormato
            ? (it.personalQty !== null && it.personalQty !== undefined ? formatoDesdeBase(it.personalQty, 0, cpf).cantidad : '')
            : (it.personalQty ?? '');
        const personalQtyOnchange = usaFormato
            ? `window.setPersonalQtyEdicionFmt(${idx}, this.value, ${cpf})`
            : `window.setPersonalQtyEdicion(${idx}, this.value)`;
        return `
            <tr data-idx="${idx}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px;"><strong>${escapeHTML(nombre)}</strong></td>
                <td style="padding: 8px;">
                    <input type="number" step="0.01" min="0" value="${cantShown}"
                        onchange="${cantOnchange}"
                        style="width: 80px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                    <small style="color: #64748b;">${escapeHTML(usaFormato ? formatoNombre : unidad)}</small>
                    ${usaFormato ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;">= ${escapeHTML(formatQuantity(it.cantidad))} ${escapeHTML(unidad)}</div>` : ''}
                </td>
                <td style="padding: 8px;">
                    <input type="number" step="0.01" min="0" value="${precioShown.toFixed(2)}"
                        onchange="${precioOnchange}"
                        style="width: 90px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                    ${usaFormato ? `<small style="color:#64748b;white-space:nowrap;">${escapeHTML(moneda)}/${escapeHTML(formatoNombre)}</small>` : ''}
                </td>
                <td style="padding: 8px; text-align: right; font-weight: 600;">${cm(subtotal)}</td>
                <td style="padding: 8px; white-space: nowrap;">
                    ${(window.comidaPersonalActiva === true || it.personal) ? `
                    <label title="${escapeHTML(t('pedidos:personal_tooltip'))}" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:#64748b;margin-right:8px;">
                        <input type="checkbox" ${it.personal ? 'checked' : ''} onchange="window.togglePersonalEdicion(${idx}, this.checked); const q=this.closest('tr').querySelector('.personal-qty-edit'); if(q){ q.style.display=this.checked?'inline-block':'none'; if(!this.checked) q.value=''; }" style="cursor:pointer;accent-color:#8b5cf6;width:15px;height:15px;">
                        🍽️ ${escapeHTML(t('pedidos:personal_label'))}
                    </label>
                    <input type="number" step="0.01" min="0" class="personal-qty-edit" value="${personalQtyShown}" onchange="${personalQtyOnchange}" title="${escapeHTML(t('pedidos:personal_qty_tooltip'))}" placeholder="${escapeHTML(t('pedidos:personal_qty_ph'))}" style="display:${it.personal ? 'inline-block' : 'none'};width:58px;padding:4px;border:1px solid #8b5cf6;border-radius:4px;text-align:center;margin-right:8px;">` : ''}
                    <button type="button" onclick="window.eliminarItemEdicion(${idx})"
                        style="background: #ef4444; color: white; border: none; border-radius: 6px; padding: 6px 10px; cursor: pointer;">🗑️</button>
                </td>
            </tr>
            ${avisoRow}
        `;
    }).join('');

    const subtotalItems = state.items.reduce((sum, it) => sum + (it.cantidad * it.precio_unitario), 0);
    const ajuste = parseFloat(state.ajusteImporte) || 0;
    const totalPedido = subtotalItems + ajuste;
    const ivaPct = Math.min(100, Math.max(0, parseFloat(state.ivaPct) || 0));
    const ivaImporte = totalPedido * (ivaPct / 100);
    const totalConIva = totalPedido + ivaImporte;

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
                    ${ivaPct > 0 ? `<tr style="background: #ecfdf5;">
                        <td colspan="3" style="padding: 10px; text-align: right; font-weight: 600; color: #047857;">+ IVA (${ivaPct}%):</td>
                        <td style="padding: 10px; text-align: right; font-weight: 600; color: #047857;">${cm(ivaImporte)}</td>
                        <td></td>
                    </tr>
                    <tr style="background: #d1fae5;">
                        <td colspan="3" style="padding: 10px; text-align: right; font-weight: 700; color: #065f46;">Total con IVA:</td>
                        <td style="padding: 10px; text-align: right; font-weight: 700; color: #065f46; font-size: 17px;">${cm(totalConIva)}</td>
                        <td></td>
                    </tr>` : ''}
                </tfoot>
            </table>

            <div style="background: #ecfdf5; padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #86efac;">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <label style="font-size: 12px; font-weight: 600; color: #047857;">IVA del albarán (%)</label>
                    <input type="number" step="0.5" min="0" max="100" value="${ivaPct}"
                        onchange="window.actualizarIvaPedidoEdicion(this.value)"
                        style="width: 80px; padding: 8px; border: 2px solid #86efac; border-radius: 6px; text-align: center; font-weight: 600;" />
                    <small style="color: #047857; font-size: 12px;">Autorrellena del proveedor — solo display para cuadrar con el papel del albarán.</small>
                </div>
            </div>

            <div style="background: #f0f9ff; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 10px 0;">➕ ${t('pedidos:edit_add_ingredient')}${nombreProveedor ? ` <small style="color: #64748b; font-weight: 400;">${t('pedidos:edit_add_ingredient_from', { supplier: escapeHTML(nombreProveedor) })}</small>` : ''}</h4>
                ${ingredientesDisponibles.length === 0 ? '<p style="color: #dc2626; margin: 0 0 8px 0;">⚠️ Este proveedor no tiene ingredientes asociados</p>' : ''}
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <select id="select-nuevo-ing-edit" onchange="window.autocompletarPrecioEdicion(this)" style="flex: 1; min-width: 200px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px;">
                        <option value="">— ${t('pedidos:edit_select_ingredient')} —</option>
                        ${(() => {
                            const invMap = new Map((window.inventarioCompleto || []).map(i => [i.id, i]));
                            return ingredientesDisponibles.map(ing => {
                                // Precio unitario canónico (precio_medio_compra > precio_medio > precio/cpf)
                                const precioUnitOpt = getIngredientUnitPrice(invMap.get(ing.id), ing);
                                return `<option value="${ing.id}" data-precio="${precioUnitOpt.toFixed(4)}">${escapeHTML(ing.nombre)} (${cm(precioUnitOpt)}/${escapeHTML(ing.unidad || 'ud')})</option>`;
                            }).join('');
                        })()}
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

// 📦 Igual que actualizarItemEdicion pero el valor viene en unidades de FORMATO
// (botes, cajas…). Se convierte a unidad BASE antes de guardar en el estado, que
// SIEMPRE está en base — así el subtotal, el reparto personal y el guardado no
// cambian. cantidad: formato × cpf. precio: €/formato ÷ cpf.
export function actualizarItemEdicionFmt(idx, campo, valor, cpf) {
    const state = window._editandoPedido;
    if (!state || !state.items[idx]) return;
    const k = parseFloat(cpf) > 1 ? parseFloat(cpf) : 1;
    const num = parseFloat(valor) || 0;
    if (campo === 'cantidad') {
        state.items[idx].cantidad = num * k;
    } else if (campo === 'precio_unitario') {
        state.items[idx].precio_unitario = num / k;
    }
    renderizarModalEditarPedido();
}

// 🍽️ Toggle de "comida personal" por línea. Handler aparte de
// actualizarItemEdicion porque aquel coacciona el valor a número (rompería el booleano).
export function togglePersonalEdicion(idx, checked) {
    const state = window._editandoPedido;
    if (!state || !state.items[idx]) return;
    state.items[idx].personal = !!checked;
    if (!checked) state.items[idx].personalQty = null; // al desmarcar, limpiar reparto
    // NO re-render: el input de cantidad se muestra/oculta inline en el onchange
    // del checkbox (evita el parpadeo del modal al re-pintar todo el innerHTML).
}

// 🍽️ Cantidad para personal (reparto de la línea). Vacío/0 = toda la línea es personal.
// No re-renderiza (no cambia el subtotal de la línea), para no perder el foco al teclear.
export function setPersonalQtyEdicion(idx, valor) {
    const state = window._editandoPedido;
    if (!state || !state.items[idx]) return;
    const q = parseFloat(valor);
    state.items[idx].personalQty = (Number.isFinite(q) && q > 0) ? q : null;
}

// 📦 Igual que setPersonalQtyEdicion pero el valor viene en FORMATO → se guarda
// en base (× cpf) para ser coherente con state.items[].cantidad (siempre base).
export function setPersonalQtyEdicionFmt(idx, valor, cpf) {
    const state = window._editandoPedido;
    if (!state || !state.items[idx]) return;
    const k = parseFloat(cpf) > 1 ? parseFloat(cpf) : 1;
    const q = parseFloat(valor);
    state.items[idx].personalQty = (Number.isFinite(q) && q > 0) ? q * k : null;
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

export function actualizarIvaPedidoEdicion(valor) {
    const state = window._editandoPedido;
    if (!state) return;
    const n = parseFloat(valor);
    state.ivaPct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
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

    // Fallback: si el usuario no rellenó el precio, usar el precio unitario canónico
    // (precio_medio_compra > precio_medio > precio/cpf) del ingrediente.
    if (!precio || precio <= 0) {
        const ing = (window.ingredientes || []).find(i => i.id === ingId);
        if (ing) {
            const invItem = (window.inventarioCompleto || []).find(i => i.id === ingId);
            precio = getIngredientUnitPrice(invItem, ing);
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

    // 🍽️ Reparto: si una línea personal tiene personalQty parcial (0 < q < cantidad),
    // se parte en DOS líneas (producción + personal). Así el dato sigue siendo líneas
    // binarias (limpio) y el aislamiento ya probado se aplica igual.
    const ingredientesPayload = [];
    state.items.forEach(it => {
        const base = {
            ingredienteId: it.ingredienteId,
            ingrediente_id: it.ingredienteId,
            precio_unitario: it.precio_unitario,
            precioUnitario: it.precio_unitario,
            precio: it.precio_unitario
        };
        const pq = parseFloat(it.personalQty);
        if (it.personal === true && Number.isFinite(pq) && pq > 0 && pq < it.cantidad) {
            ingredientesPayload.push({ ...base, personal: false, cantidad: Math.round((it.cantidad - pq) * 10000) / 10000 });
            ingredientesPayload.push({ ...base, personal: true, cantidad: pq });
        } else {
            ingredientesPayload.push({ ...base, personal: it.personal === true, cantidad: it.cantidad });
        }
    });

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
    window.actualizarItemEdicionFmt = actualizarItemEdicionFmt;
    window.togglePersonalEdicion = togglePersonalEdicion;
    window.setPersonalQtyEdicion = setPersonalQtyEdicion;
    window.setPersonalQtyEdicionFmt = setPersonalQtyEdicionFmt;
    window.eliminarItemEdicion = eliminarItemEdicion;
    window.agregarItemEdicion = agregarItemEdicion;
    window.autocompletarPrecioEdicion = autocompletarPrecioEdicion;
    window.actualizarAjustePedido = actualizarAjustePedido;
    window.actualizarIvaPedidoEdicion = actualizarIvaPedidoEdicion;
    window.cerrarModalEditarPedido = cerrarModalEditarPedido;
    window.guardarEdicionPedido = guardarEdicionPedido;
}
