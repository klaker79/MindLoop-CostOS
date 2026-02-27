/**
 * Módulo de Gestión de Variantes de Receta
 * Permite asociar múltiples formatos de venta a una receta (ej: botella, copa)
 */

import { showToast } from '../../ui/toast.js';
import { escapeHTML } from '../../utils/helpers.js';
import { getApiUrl } from '../../config/app-config.js';
import { t } from '@/i18n/index.js';

const API_BASE = getApiUrl();

function _fetchOptions(method = 'GET', body = null) {
    // 🔒 SECURITY: Dual-mode auth — cookie + in-memory Bearer (NOT localStorage)
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.authToken : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = {
        method,
        credentials: 'include',
        headers
    };
    if (body) opts.body = JSON.stringify(body);
    return opts;
}

// Variable para tracking de la receta actual
let recetaActualId = null;

/**
 * Abre el modal de gestión de variantes para una receta
 * @param {number} recetaId - ID de la receta
 */
export async function gestionarVariantesReceta(recetaId) {
    recetaActualId = recetaId;

    // Obtener datos de la receta
    const receta = window.recetas?.find(r => r.id === recetaId);
    if (!receta) {
        showToast(t('recetas:variants_not_found'), 'error');
        return;
    }

    // Actualizar título del modal
    const modalTitulo = document.getElementById('modal-variantes-titulo');
    if (modalTitulo) {
        modalTitulo.textContent = t('recetas:variants_modal_title', { name: receta.nombre });
    }

    // Cargar variantes
    await cargarVariantesReceta(recetaId);

    // Mostrar modal
    const modal = document.getElementById('modal-variantes-receta');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Carga y renderiza las variantes de una receta
 */
async function cargarVariantesReceta(recetaId) {
    try {
        window.showLoading?.();

        const res = await fetch(`${API_BASE}/recipes/${recetaId}/variants`, _fetchOptions());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const response = await res.json();
        const variantes = Array.isArray(response) ? response : [];

        renderizarVariantes(variantes);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error cargando variantes:', error);
        showToast(t('recetas:variants_error_loading'), 'error');
    }
}

/**
 * Renderiza la lista de variantes con KPIs
 */
function renderizarVariantes(variantes) {
    const container = document.getElementById('lista-variantes');
    if (!container) return;

    if (variantes.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #94A3B8;">
                <div style="font-size: 48px; margin-bottom: 16px;">🍷</div>
                <p>${t('recetas:variants_empty')}</p>
                <p style="font-size: 14px;">${t('recetas:variants_factor_hint')}</p>
            </div>
        `;
        return;
    }

    // Obtener coste base de la receta para calcular KPIs
    const receta = window.recetas?.find(r => r.id === recetaActualId);
    const porciones = parseInt(receta?.porciones) || 1;

    // Calcular coste real sumando ingredientes (igual que el escandallo)
    let costeLote = 0;
    if (receta && receta.ingredientes && Array.isArray(receta.ingredientes)) {
        // Crear map de inventario para precio_medio
        const inventarioMap = new Map((window.inventarioCompleto || []).map(inv => [inv.ingrediente_id, inv]));

        receta.ingredientes.forEach(item => {
            const cantidad = parseFloat(item.cantidad) || 0;

            // Buscar el ingrediente para obtener precio unitario
            const ingrediente = window.ingredientes?.find(i => i.id === item.ingredienteId);
            if (ingrediente) {
                // 🔧 FIX: Priorizar precio_medio del inventario (WAP)
                const invItem = inventarioMap.get(item.ingredienteId);
                let precioUnitario = 0;
                if (invItem?.precio_medio) {
                    precioUnitario = parseFloat(invItem.precio_medio);
                } else {
                    const precioFormato = parseFloat(ingrediente.precio) || 0;
                    const cantidadFormato = parseFloat(ingrediente.cantidad_por_formato) || 1;
                    precioUnitario = precioFormato / cantidadFormato;
                }
                costeLote += cantidad * precioUnitario;
            }
        });
    }

    // 🔧 FIX: Dividir por porciones para obtener coste por porción
    let costeBase = costeLote / porciones;

    // Fallback al campo coste si existe
    if (costeBase === 0 && receta?.coste) {
        costeBase = parseFloat(receta.coste) / porciones;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    variantes.forEach(v => {
        const precioVenta = parseFloat(v.precio_venta);
        const factor = parseFloat(v.factor) || 1;

        // Calcular coste proporcional según el factor
        const costeVariante = costeBase * factor;
        const margen = precioVenta - costeVariante;
        const foodCost = precioVenta > 0 ? (costeVariante / precioVenta) * 100 : 0;

        // Color del food cost según umbrales de vinos
        let fcColor = '#10B981'; // Verde
        let fcEmoji = '🟢';
        if (foodCost > 50) {
            fcColor = '#EF4444'; // Rojo
            fcEmoji = '🔴';
        } else if (foodCost > 40) {
            fcColor = '#F59E0B'; // Amarillo
            fcEmoji = '🟡';
        }

        html += `
            <div style="border: 2px solid #E2E8F0; border-radius: 12px; padding: 16px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: #1E293B; font-size: 16px;">${escapeHTML(v.nombre)}</h4>
                        <p style="margin: 4px 0; font-size: 13px; color: #64748B;">
                            ${t('recetas:variants_factor')}: ${v.factor}x ${v.codigo ? `| ${t('recetas:variants_code')}: ` + escapeHTML(v.codigo) : ''}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: bold; color: #10B981;">
                            ${precioVenta.toFixed(2)} €
                        </div>
                    </div>
                </div>
                
                <!-- KPIs -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
                    <div style="text-align: center; padding: 8px; background: #FEE2E2; border-radius: 8px;">
                        <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_cost')}</div>
                        <div style="font-size: 14px; font-weight: 600; color: #EF4444;">${costeVariante.toFixed(2)}€</div>
                    </div>
                    <div style="text-align: center; padding: 8px; background: #D1FAE5; border-radius: 8px;">
                        <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_margin')}</div>
                        <div style="font-size: 14px; font-weight: 600; color: #10B981;">${margen.toFixed(2)}€</div>
                    </div>
                    <div style="text-align: center; padding: 8px; background: #FEF3C7; border-radius: 8px;">
                        <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_food_cost')}</div>
                        <div style="font-size: 14px; font-weight: 600; color: ${fcColor};">${fcEmoji} ${foodCost.toFixed(1)}%</div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;">
                    <button class="btn-sm" onclick="window.editarVariante(${recetaActualId}, ${v.id}, '${escapeHTML(v.nombre)}', ${v.precio_venta}, ${v.factor}, '${escapeHTML(v.codigo || '')}')" style="background: #3B82F6; color: white;">
                        ✏️ ${t('ingredientes:btn_edit_title')}
                    </button>
                    <button class="btn-sm" onclick="window.eliminarVariante(${recetaActualId}, ${v.id})" style="background: #EF4444; color: white;">
                        🗑️ ${t('ingredientes:btn_delete_title')}
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Agrega una nueva variante
 */
export async function agregarVarianteReceta() {
    const nombre = document.getElementById('input-variante-nombre')?.value;
    const precio = document.getElementById('input-variante-precio')?.value;
    const factor = document.getElementById('input-variante-factor')?.value || 1;
    const codigo = document.getElementById('input-variante-codigo')?.value || null;

    if (!nombre) {
        showToast(t('recetas:variants_add_hint'), 'warning');
        return;
    }

    if (!precio || parseFloat(precio) <= 0) {
        showToast(t('recetas:variants_price_invalid'), 'warning');
        return;
    }

    try {
        window.showLoading?.();

        const resAdd = await fetch(`${API_BASE}/recipes/${recetaActualId}/variants`, _fetchOptions('POST', {
            nombre: nombre,
            precio_venta: parseFloat(precio),
            factor: parseFloat(factor),
            codigo: codigo || null,
        }));
        if (!resAdd.ok) throw new Error(`HTTP ${resAdd.status}`);

        showToast(t('recetas:variants_added'), 'success');

        // Limpiar inputs
        document.getElementById('input-variante-nombre').value = '';
        document.getElementById('input-variante-precio').value = '';
        document.getElementById('input-variante-factor').value = '1';
        document.getElementById('input-variante-codigo').value = '';

        // Recargar lista
        await cargarVariantesReceta(recetaActualId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error agregando variante:', error);
        showToast(t('recetas:variants_error_adding'), 'error');
    }
}

/**
 * Edita una variante - ahora con código TPV
 */
export async function editarVariante(recetaId, varianteId, nombreActual, precioActual, factorActual, codigoActual = '') {
    // Mostrar modal de edición con todos los campos
    const modal = document.createElement('div');
    modal.id = 'modal-editar-variante';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h3 style="margin-bottom: 20px;">✏️ ${t('recetas:variants_edit_title')}: ${escapeHTML(nombreActual)}</h3>
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">${t('recetas:variants_price')}</label>
                    <input type="number" id="edit-variante-precio" value="${precioActual}" step="0.01"
                           style="width: 100%; padding: 10px; border: 1px solid #E2E8F0; border-radius: 8px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">${t('recetas:variants_code')}</label>
                    <input type="text" id="edit-variante-codigo" value="${codigoActual}" placeholder="${t('recetas:variants_code_placeholder')}"
                           style="width: 100%; padding: 10px; border: 1px solid #E2E8F0; border-radius: 8px;">
                    <small style="color: #64748B;">${t('recetas:variants_code_hint')}</small>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 12px;">
                    <button onclick="document.getElementById('modal-editar-variante').remove()"
                            style="padding: 10px 20px; border-radius: 8px; border: 1px solid #E2E8F0; background: white;">
                        ${t('common:btn_cancel')}
                    </button>
                    <button id="btn-guardar-variante" style="padding: 10px 20px; border-radius: 8px; border: none; background: #10B981; color: white; font-weight: 600;">
                        💾 ${t('common:btn_save')}
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Handler para guardar
    document.getElementById('btn-guardar-variante').onclick = async () => {
        const nuevoPrecio = document.getElementById('edit-variante-precio').value;
        const nuevoCodigo = document.getElementById('edit-variante-codigo').value;

        if (!nuevoPrecio || parseFloat(nuevoPrecio) <= 0) {
            showToast(t('recetas:variants_price_invalid_edit'), 'error');
            return;
        }

        try {
            window.showLoading?.();

            const resEdit = await fetch(`${API_BASE}/recipes/${recetaId}/variants/${varianteId}`, _fetchOptions('PUT', {
                precio_venta: parseFloat(nuevoPrecio),
                codigo: nuevoCodigo || null,
            }));
            if (!resEdit.ok) throw new Error(`HTTP ${resEdit.status}`);

            showToast(t('recetas:variants_updated'), 'success');
            modal.remove();
            await cargarVariantesReceta(recetaId);

            window.hideLoading?.();
        } catch (error) {
            window.hideLoading?.();
            console.error('Error actualizando variante:', error);
            showToast(t('recetas:variants_error_updating'), 'error');
        }
    };
}

/**
 * Elimina una variante
 */
export async function eliminarVariante(recetaId, varianteId) {
    if (!confirm(t('recetas:variants_confirm_delete'))) return;

    try {
        window.showLoading?.();

        const resDel = await fetch(`${API_BASE}/recipes/${recetaId}/variants/${varianteId}`, _fetchOptions('DELETE'));
        if (!resDel.ok) throw new Error(`HTTP ${resDel.status}`);

        showToast(t('recetas:variants_deleted'), 'success');
        await cargarVariantesReceta(recetaId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error eliminando variante:', error);
        showToast(t('recetas:variants_error_deleting'), 'error');
    }
}

/**
 * Cierra el modal
 */
export function cerrarModalVariantes() {
    const modal = document.getElementById('modal-variantes-receta');
    if (modal) {
        modal.classList.remove('active');
    }
    recetaActualId = null;
}

/**
 * Escapa HTML
 */

// Exponer funciones globalmente
window.gestionarVariantesReceta = gestionarVariantesReceta;
window.agregarVarianteReceta = agregarVarianteReceta;
window.editarVariante = editarVariante;
window.eliminarVariante = eliminarVariante;
window.cerrarModalVariantes = cerrarModalVariantes;
