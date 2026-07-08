/**
 * Módulo de Gestión de Proveedores por Ingrediente
 * Permite asociar múltiples proveedores a un ingrediente, cada uno con su precio
 */

import { showToast } from '../../ui/toast.js';
import { escapeHTML, cm } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

// Variable para tracking del ingrediente actual
let ingredienteActualId = null;
// Unidad base del ingrediente abierto (ej: "Docena", "kg"). Se usa para etiquetar
// que TODOS los precios del modal son €/unidad-base y evitar comparar peras con manzanas.
let unidadBaseActual = '';

/**
 * Abre el modal de gestión de proveedores para un ingrediente
 * @param {number} ingredienteId - ID del ingrediente
 */
export async function gestionarProveedoresIngrediente(ingredienteId) {
    ingredienteActualId = ingredienteId;

    // Obtener datos del ingrediente
    const ingrediente = window.ingredientes?.find(i => i.id === ingredienteId);
    if (!ingrediente) {
        showToast(t('ingredientes:suppliers_not_found'), 'error');
        return;
    }

    // Unidad base del ingrediente: todos los precios del modal se expresan en €/esta unidad.
    unidadBaseActual = ingrediente.unidad || '';

    // Actualizar título del modal
    const modalTitulo = document.getElementById('modal-proveedores-titulo');
    if (modalTitulo) {
        modalTitulo.textContent = t('ingredientes:suppliers_modal_title', { name: ingrediente.nombre });
    }

    // Etiquetar los campos con la unidad base y limpiar el bloque de formato.
    resetFormularioNuevoProveedor();

    // Cargar proveedores asociados
    await cargarProveedoresIngrediente(ingredienteId);

    // Mostrar modal
    const modal = document.getElementById('modal-proveedores-ingrediente');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Devuelve el sufijo de unidad para mostrar junto a un precio (ej: "/docena").
 * Si no hay unidad conocida, cae a "/ud" genérico.
 */
function sufijoUnidad() {
    const u = (unidadBaseActual || '').trim();
    return u ? `/${u}` : `/${t('ingredientes:suppliers_unit_fallback')}`;
}

/**
 * Limpia el formulario de "Agregar proveedor" y refresca las etiquetas de unidad.
 * Se llama al abrir el modal y tras agregar un proveedor.
 */
function resetFormularioNuevoProveedor() {
    const u = (unidadBaseActual || '').trim();
    const hintPrecio = document.getElementById('ml-precio-unidad-hint');
    if (hintPrecio) hintPrecio.textContent = u ? `(€ ${sufijoUnidad()})` : '';
    const hintQty = document.getElementById('ml-formato-qty-unidad');
    if (hintQty) hintQty.textContent = u ? `(${u})` : '';

    ['input-precio-nuevo', 'input-formato-nuevo', 'input-cantidad-formato-nuevo', 'input-precio-formato-nuevo']
        .forEach(idInput => {
            const el = document.getElementById(idInput);
            if (el) el.value = '';
        });
    const details = document.getElementById('ml-formato-proveedor-details');
    if (details) details.open = false;
    const preview = document.getElementById('ml-formato-preview');
    if (preview) preview.textContent = '';
}

/**
 * Calcula en vivo el precio €/unidad-base derivado del formato (precio_formato / cantidad)
 * y lo muestra bajo los inputs. NO envía nada; solo feedback visual.
 */
export function mlPreviewPrecioProveedor() {
    const cant = parseFloat(document.getElementById('input-cantidad-formato-nuevo')?.value);
    const pf = parseFloat(document.getElementById('input-precio-formato-nuevo')?.value);
    const preview = document.getElementById('ml-formato-preview');
    if (!preview) return;

    if (!isNaN(cant) && cant > 0 && !isNaN(pf) && pf >= 0) {
        const derivado = pf / cant;
        preview.textContent = `= ${cm(derivado)} ${sufijoUnidad()}`;
    } else {
        preview.textContent = '';
    }
}

/**
 * Carga y renderiza los proveedores asociados a un ingrediente
 * @param {number} ingredienteId - ID del ingrediente
 */
async function cargarProveedoresIngrediente(ingredienteId) {
    try {
        window.showLoading?.();

        // Obtener proveedores asociados del backend
        const response = await window.API.fetch(`/ingredients/${ingredienteId}/suppliers`);
        const proveedoresAsociados = Array.isArray(response) ? response : [];

        // Renderizar lista
        renderizarProveedoresAsociados(proveedoresAsociados);

        // Renderizar select de proveedores disponibles para agregar
        renderizarSelectProveedoresDisponibles(proveedoresAsociados);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error cargando proveedores del ingrediente:', error);
        showToast(t('ingredientes:suppliers_error_loading'), 'error');
    }
}

/**
 * Renderiza la lista de proveedores asociados
 * @param {Array} proveedoresAsociados - Lista de proveedores asociados
 */
function renderizarProveedoresAsociados(proveedoresAsociados) {
    const container = document.getElementById('lista-proveedores-asociados');
    if (!container) return;

    if (proveedoresAsociados.length === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #94A3B8;">
                <div style="font-size: 48px; margin-bottom: 16px;">🏢</div>
                <p>${t('ingredientes:suppliers_none_associated')}</p>
                <p style="font-size: 14px;">${t('ingredientes:suppliers_add_hint')}</p>
            </div>
        `;
        return;
    }

    // 📊 Calcular análisis de precios
    const precios = proveedoresAsociados.map(pa => ({
        nombre: pa.proveedor_nombre,
        precio: parseFloat(pa.precio),
        esPrincipal: pa.es_proveedor_principal
    }));

    const precioMin = Math.min(...precios.map(p => p.precio));
    const precioMax = Math.max(...precios.map(p => p.precio));
    const precioMedio = precios.reduce((sum, p) => sum + p.precio, 0) / precios.length;
    const mejorProveedor = precios.find(p => p.precio === precioMin);
    const peorProveedor = precios.find(p => p.precio === precioMax);
    const ahorroPotencial = precioMax - precioMin;
    const hayDiferencia = precios.length > 1 && ahorroPotencial > 0.01;

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    // 📊 Sección de análisis de precios (solo si hay más de 1 proveedor)
    if (hayDiferencia) {
        html += `
            <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border: 2px solid #6366F1; border-radius: 12px; padding: 16px; margin-bottom: 8px;">
                <h4 style="margin: 0 0 12px 0; color: #4338CA; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    📊 ${t('ingredientes:suppliers_analysis_title')}
                </h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                    <div style="background: #DCFCE7; padding: 12px; border-radius: 8px; border: 1px solid #22C55E;">
                        <div style="font-size: 11px; color: #166534; text-transform: uppercase; font-weight: 600;">💰 ${t('ingredientes:suppliers_best_price')}</div>
                        <div style="font-size: 20px; font-weight: bold; color: #059669;">${cm(precioMin)}</div>
                        <div style="font-size: 12px; color: #166534;">${escapeHTML(mejorProveedor.nombre)}</div>
                    </div>
                    <div style="background: #F1F5F9; padding: 12px; border-radius: 8px;">
                        <div style="font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600;">📈 ${t('ingredientes:suppliers_avg_price')}</div>
                        <div style="font-size: 20px; font-weight: bold; color: #475569;">${cm(precioMedio)}</div>
                        <div style="font-size: 12px; color: #64748B;">${precios.length} proveedores</div>
                    </div>
                    <div style="background: #FEF2F2; padding: 12px; border-radius: 8px; border: 1px solid #EF4444;">
                        <div style="font-size: 11px; color: #991B1B; text-transform: uppercase; font-weight: 600;">⚠️ ${t('ingredientes:suppliers_most_expensive')}</div>
                        <div style="font-size: 20px; font-weight: bold; color: #DC2626;">${cm(precioMax)}</div>
                        <div style="font-size: 12px; color: #991B1B;">${escapeHTML(peorProveedor.nombre)}</div>
                    </div>
                </div>
                <div style="margin-top: 12px; padding: 10px; background: #FEF3C7; border-radius: 8px; text-align: center;">
                    <span style="font-size: 13px; color: #92400E;">
                        💡 <strong>Ahorro potencial:</strong> ${cm(ahorroPotencial)}${escapeHTML(sufijoUnidad())} comprando a ${escapeHTML(mejorProveedor.nombre)}
                    </span>
                </div>
            </div>
        `;
    }

    // Lista de proveedores
    proveedoresAsociados.forEach(pa => {
        const esPrincipal = pa.es_proveedor_principal;
        const esMejorPrecio = parseFloat(pa.precio) === precioMin && hayDiferencia;
        const badgePrincipal = esPrincipal
            ? '<span style="background: #10B981; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">⭐ PRINCIPAL</span>'
            : `<button class="btn-sm" onclick="window.marcarProveedorPrincipal(${ingredienteActualId}, ${pa.proveedor_id})" style="font-size: 11px; padding: 4px 8px;">${t('ingredientes:suppliers_mark_main')}</button>`;

        const badgeMejorPrecio = esMejorPrecio
            ? '<span style="background: #22C55E; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; margin-left: 6px;">💰 MEJOR PRECIO</span>'
            : '';

        // 📦 Pista de formato: solo se muestra si es COHERENTE con el precio canónico
        // (precio_formato / cantidad ≈ precio). Así, si el precio se editó a mano después,
        // no enseñamos un formato que ya no cuadra.
        let hintFormato = '';
        const cantF = parseFloat(pa.cantidad_por_formato);
        const pF = parseFloat(pa.precio_formato);
        if (pa.formato && !isNaN(cantF) && cantF > 0 && !isNaN(pF) &&
            Math.abs((pF / cantF) - parseFloat(pa.precio)) < 0.01) {
            hintFormato = `<p style="margin: 4px 0; font-size: 12px; color: #6366F1;">📦 ${escapeHTML(pa.formato)} · ${cantF} ${escapeHTML(unidadBaseActual)} · ${cm(pF)}</p>`;
        }

        html += `
            <div style="border: 2px solid ${esPrincipal ? '#10B981' : esMejorPrecio ? '#22C55E' : '#E2E8F0'}; border-radius: 12px; padding: 16px; background: ${esPrincipal ? '#F0FDF4' : 'white'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <h4 style="margin: 0; color: #1E293B; font-size: 16px;">${escapeHTML(pa.proveedor_nombre)}${badgeMejorPrecio}</h4>
                        ${hintFormato}
                        ${pa.proveedor_contacto ? '<p style="margin: 4px 0; font-size: 13px; color: #64748B;">👤 ' + escapeHTML(pa.proveedor_contacto) + '</p>' : ''}
                        ${pa.proveedor_telefono ? '<p style="margin: 4px 0; font-size: 13px; color: #64748B;">📞 ' + escapeHTML(pa.proveedor_telefono) + '</p>' : ''}
                        ${pa.proveedor_email ? '<p style="margin: 4px 0; font-size: 13px; color: #64748B;">✉️ ' + escapeHTML(pa.proveedor_email) + '</p>' : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: bold; color: ${esMejorPrecio ? '#059669' : '#1E293B'}; margin-bottom: 4px;">
                            ${cm(parseFloat(pa.precio))} <span style="font-size: 13px; font-weight: 400; color: #94A3B8;">${escapeHTML(sufijoUnidad())}</span>
                        </div>
                        ${badgePrincipal}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-sm" onclick="window.editarPrecioProveedor(${ingredienteActualId}, ${pa.proveedor_id}, ${pa.precio})" style="background: #3B82F6; color: white;">
                        ✏️ ${t('ingredientes:suppliers_edit_price')}
                    </button>
                    <button class="btn-sm" onclick="window.eliminarProveedorIngrediente(${ingredienteActualId}, ${pa.proveedor_id})" style="background: #EF4444; color: white;">
                        🗑️ ${t('ingredientes:suppliers_delete')}
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Renderiza el select de proveedores disponibles para agregar
 * @param {Array} proveedoresAsociados - Lista de proveedores ya asociados
 */
function renderizarSelectProveedoresDisponibles(proveedoresAsociados) {
    const select = document.getElementById('select-proveedor-nuevo');
    if (!select) return;

    const idsAsociados = proveedoresAsociados.map(pa => pa.proveedor_id);
    const proveedoresDisponibles = (window.proveedores || []).filter(
        p => !idsAsociados.includes(p.id)
    );

    if (proveedoresDisponibles.length === 0) {
        select.innerHTML = `<option value="">${t('ingredientes:suppliers_none_available')}</option>`;
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = `<option value="">${t('ingredientes:suppliers_select_placeholder')}</option>`;
    proveedoresDisponibles.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`;
    });
}

/**
 * Agrega un nuevo proveedor al ingrediente
 */
export async function agregarProveedorIngrediente() {
    const proveedorId = document.getElementById('select-proveedor-nuevo')?.value;
    const precio = document.getElementById('input-precio-nuevo')?.value;

    if (!proveedorId) {
        showToast(t('ingredientes:suppliers_select_warning'), 'warning');
        return;
    }

    // ¿Usó el bloque de formato de compra? (caja/bolsa → deriva el €/unidad-base)
    const formato = document.getElementById('input-formato-nuevo')?.value?.trim();
    const cantidadFormatoRaw = document.getElementById('input-cantidad-formato-nuevo')?.value;
    const precioFormatoRaw = document.getElementById('input-precio-formato-nuevo')?.value;
    const intentaFormato = !!(formato || cantidadFormatoRaw || precioFormatoRaw);

    let body;
    if (intentaFormato) {
        const cant = parseFloat(cantidadFormatoRaw);
        const pf = parseFloat(precioFormatoRaw);
        // Si empezó a rellenar el formato, exige los tres campos válidos.
        if (!formato || isNaN(cant) || cant <= 0 || isNaN(pf) || pf < 0) {
            showToast(t('ingredientes:suppliers_format_incomplete'), 'warning');
            return;
        }
        body = {
            proveedor_id: parseInt(proveedorId),
            formato,
            cantidad_por_formato: cant,
            precio_formato: pf,
            es_proveedor_principal: false,
        };
    } else {
        if (!precio || parseFloat(precio) <= 0) {
            showToast(t('ingredientes:suppliers_price_warning'), 'warning');
            return;
        }
        body = {
            proveedor_id: parseInt(proveedorId),
            precio: parseFloat(precio),
            es_proveedor_principal: false,
        };
    }

    try {
        window.showLoading?.();

        await window.API.fetch(`/ingredients/${ingredienteActualId}/suppliers`, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        showToast(t('ingredientes:suppliers_added'), 'success');

        // Limpiar formulario (precio + bloque de formato) y select
        const sel = document.getElementById('select-proveedor-nuevo');
        if (sel) sel.value = '';
        resetFormularioNuevoProveedor();

        // Recargar lista
        await cargarProveedoresIngrediente(ingredienteActualId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error agregando proveedor:', error);
        showToast(t('ingredientes:suppliers_error_adding', { message: error.message }), 'error');
    }
}

/**
 * Marca un proveedor como principal
 * @param {number} ingredienteId - ID del ingrediente
 * @param {number} proveedorId - ID del proveedor
 */
export async function marcarProveedorPrincipal(ingredienteId, proveedorId) {
    try {
        window.showLoading?.();

        // Obtener precio actual del proveedor
        const proveedoresActuales = await window.API.fetch(
            `/ingredients/${ingredienteId}/suppliers`
        );
        const proveedorActual = proveedoresActuales.find(p => p.proveedor_id === proveedorId);

        if (!proveedorActual) {
            throw new Error('Proveedor no encontrado');
        }

        const resp = await window.API.fetch(`/ingredients/${ingredienteId}/suppliers/${proveedorId}`, {
            method: 'PUT',
            body: JSON.stringify({
                precio: proveedorActual.precio,
                es_proveedor_principal: true,
            }),
        });

        if (resp?.precio_sync_omitido) {
            // El guard ±70% frenó el volcado a la ficha: avisar para que Iker/cocina revise.
            showToast(t('ingredientes:suppliers_sync_skipped'), 'warning');
        } else if (resp?.formato_propagado) {
            // El formato del proveedor principal se copió al ingrediente → ya aplica a pedidos/inventario.
            showToast(t('ingredientes:suppliers_format_propagated'), 'success');
        } else {
            showToast(t('ingredientes:suppliers_marked_main'), 'success');
        }

        // Recargar lista + refrescar ingredientes globales (el formato/precio del ingrediente
        // puede haber cambiado → pedidos e inventario deben verlo al momento).
        await cargarProveedoresIngrediente(ingredienteId);
        await refrescarIngredientesGlobal();

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error marcando proveedor como principal:', error);
        showToast(t('ingredientes:suppliers_error_updating'), 'error');
    }
}

/**
 * Refresca window.ingredientes desde el backend tras propagar formato/precio del proveedor
 * principal, para que el resto de pestañas (pedidos, inventario) usen el dato actualizado.
 * Silencioso: si falla, no bloquea el flujo del modal.
 */
async function refrescarIngredientesGlobal() {
    try {
        if (window.api?.getIngredientes) {
            window.ingredientes = await window.api.getIngredientes();
        }
    } catch (e) {
        console.warn('No se pudo refrescar ingredientes tras cambio de proveedor:', e?.message);
    }
}

/**
 * Edita el precio de un proveedor
 * @param {number} ingredienteId - ID del ingrediente
 * @param {number} proveedorId - ID del proveedor
 * @param {number} precioActual - Precio actual
 */
export async function editarPrecioProveedor(ingredienteId, proveedorId, precioActual) {
    const nuevoPrecio = prompt('Nuevo precio:', precioActual);

    if (nuevoPrecio === null) return; // Cancelado

    if (!nuevoPrecio || parseFloat(nuevoPrecio) <= 0) {
        showToast(t('ingredientes:suppliers_invalid_price'), 'error');
        return;
    }

    try {
        window.showLoading?.();

        // Obtener es_proveedor_principal actual
        const proveedoresActuales = await window.API.fetch(
            `/ingredients/${ingredienteId}/suppliers`
        );
        const proveedorActual = proveedoresActuales.find(p => p.proveedor_id === proveedorId);

        const resp = await window.API.fetch(`/ingredients/${ingredienteId}/suppliers/${proveedorId}`, {
            method: 'PUT',
            body: JSON.stringify({
                precio: parseFloat(nuevoPrecio),
                es_proveedor_principal: proveedorActual?.es_proveedor_principal || false,
            }),
        });

        if (resp?.precio_sync_omitido) {
            showToast(t('ingredientes:suppliers_sync_skipped'), 'warning');
        } else if (resp?.formato_propagado) {
            showToast(t('ingredientes:suppliers_format_propagated'), 'success');
        } else {
            showToast(t('ingredientes:suppliers_price_updated'), 'success');
        }

        // Recargar lista + refrescar ingredientes globales
        await cargarProveedoresIngrediente(ingredienteId);
        await refrescarIngredientesGlobal();

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error actualizando precio:', error);
        showToast(t('ingredientes:suppliers_error_updating_price'), 'error');
    }
}

/**
 * Elimina un proveedor del ingrediente
 * @param {number} ingredienteId - ID del ingrediente
 * @param {number} proveedorId - ID del proveedor
 */
export async function eliminarProveedorIngrediente(ingredienteId, proveedorId) {
    if (!confirm(t('ingredientes:suppliers_confirm_delete'))) return;

    try {
        window.showLoading?.();

        await window.API.fetch(`/ingredients/${ingredienteId}/suppliers/${proveedorId}`, {
            method: 'DELETE',
        });

        showToast(t('ingredientes:suppliers_deleted'), 'success');

        // Recargar lista
        await cargarProveedoresIngrediente(ingredienteId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error eliminando proveedor:', error);
        showToast(t('ingredientes:suppliers_error_deleting'), 'error');
    }
}

/**
 * Cierra el modal de proveedores
 */
export function cerrarModalProveedoresIngrediente() {
    const modal = document.getElementById('modal-proveedores-ingrediente');
    if (modal) {
        modal.classList.remove('active');
    }

    ingredienteActualId = null;
}

/**
 * Escapa HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
