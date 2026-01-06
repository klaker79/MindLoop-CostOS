/**
 * Módulo de Gestión de Proveedores por Ingrediente
 * Permite asociar múltiples proveedores a un ingrediente, cada uno con su precio
 */

import { showToast } from '../../ui/toast.js';

// Variable para tracking del ingrediente actual
let ingredienteActualId = null;

/**
 * Abre el modal de gestión de proveedores para un ingrediente
 * @param {number} ingredienteId - ID del ingrediente
 */
export async function gestionarProveedoresIngrediente(ingredienteId) {
    ingredienteActualId = ingredienteId;

    // Obtener datos del ingrediente
    const ingrediente = window.ingredientes?.find(i => i.id === ingredienteId);
    if (!ingrediente) {
        showToast('Ingrediente no encontrado', 'error');
        return;
    }

    // Actualizar título del modal
    const modalTitulo = document.getElementById('modal-proveedores-titulo');
    if (modalTitulo) {
        modalTitulo.textContent = `Proveedores de "${ingrediente.nombre}"`;
    }

    // Cargar proveedores asociados
    await cargarProveedoresIngrediente(ingredienteId);

    // Mostrar modal
    const modal = document.getElementById('modal-proveedores-ingrediente');
    if (modal) {
        modal.classList.add('active');
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
        const response = await window.API.fetch(`/api/ingredients/${ingredienteId}/suppliers`);
        const proveedoresAsociados = Array.isArray(response) ? response : [];

        // Renderizar lista
        renderizarProveedoresAsociados(proveedoresAsociados);

        // Renderizar select de proveedores disponibles para agregar
        renderizarSelectProveedoresDisponibles(proveedoresAsociados);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error cargando proveedores del ingrediente:', error);
        showToast('Error cargando proveedores', 'error');
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
                <p>No hay proveedores asociados</p>
                <p style="font-size: 14px;">Agrega un proveedor usando el selector de abajo</p>
            </div>
        `;
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

    proveedoresAsociados.forEach(pa => {
        const esPrincipal = pa.es_proveedor_principal;
        const badgePrincipal = esPrincipal
            ? '<span style="background: #10B981; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">⭐ PRINCIPAL</span>'
            : '<button class="btn-sm" onclick="window.marcarProveedorPrincipal(' +
              ingredienteActualId +
              ', ' +
              pa.proveedor_id +
              ')" style="font-size: 11px; padding: 4px 8px;">Marcar como principal</button>';

        html += `
            <div style="border: 2px solid ${esPrincipal ? '#10B981' : '#E2E8F0'}; border-radius: 12px; padding: 16px; background: ${esPrincipal ? '#F0FDF4' : 'white'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <h4 style="margin: 0; color: #1E293B; font-size: 16px;">${escapeHTML(pa.proveedor_nombre)}</h4>
                        ${pa.proveedor_contacto ? '<p style="margin: 4px 0; font-size: 13px; color: #64748B;">👤 ' + escapeHTML(pa.proveedor_contacto) + '</p>' : ''}
                        ${pa.proveedor_telefono ? '<p style="margin: 4px 0; font-size: 13px; color: #64748B;">📞 ' + escapeHTML(pa.proveedor_telefono) + '</p>' : ''}
                        ${pa.proveedor_email ? '<p style="margin: 4px 0; font-size: 13px; color: #64748B;">✉️ ' + escapeHTML(pa.proveedor_email) + '</p>' : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 24px; font-weight: bold; color: #1E293B; margin-bottom: 4px;">
                            ${parseFloat(pa.precio).toFixed(2)} €
                        </div>
                        ${badgePrincipal}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-sm" onclick="window.editarPrecioProveedor(${ingredienteActualId}, ${pa.proveedor_id}, ${pa.precio})" style="background: #3B82F6; color: white;">
                        ✏️ Editar precio
                    </button>
                    <button class="btn-sm" onclick="window.eliminarProveedorIngrediente(${ingredienteActualId}, ${pa.proveedor_id})" style="background: #EF4444; color: white;">
                        🗑️ Eliminar
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
        select.innerHTML = '<option value="">No hay más proveedores disponibles</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
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
        showToast('Selecciona un proveedor', 'warning');
        return;
    }

    if (!precio || parseFloat(precio) <= 0) {
        showToast('Ingresa un precio válido', 'warning');
        return;
    }

    try {
        window.showLoading?.();

        await window.API.fetch(`/api/ingredients/${ingredienteActualId}/suppliers`, {
            method: 'POST',
            body: JSON.stringify({
                proveedor_id: parseInt(proveedorId),
                precio: parseFloat(precio),
                es_proveedor_principal: false,
            }),
        });

        showToast('Proveedor agregado exitosamente', 'success');

        // Limpiar inputs
        document.getElementById('select-proveedor-nuevo').value = '';
        document.getElementById('input-precio-nuevo').value = '';

        // Recargar lista
        await cargarProveedoresIngrediente(ingredienteActualId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error agregando proveedor:', error);
        showToast('Error agregando proveedor: ' + (error.message || 'Error desconocido'), 'error');
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
            `/api/ingredients/${ingredienteId}/suppliers`
        );
        const proveedorActual = proveedoresActuales.find(p => p.proveedor_id === proveedorId);

        if (!proveedorActual) {
            throw new Error('Proveedor no encontrado');
        }

        await window.API.fetch(`/api/ingredients/${ingredienteId}/suppliers/${proveedorId}`, {
            method: 'PUT',
            body: JSON.stringify({
                precio: proveedorActual.precio,
                es_proveedor_principal: true,
            }),
        });

        showToast('Proveedor marcado como principal', 'success');

        // Recargar lista
        await cargarProveedoresIngrediente(ingredienteId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error marcando proveedor como principal:', error);
        showToast('Error actualizando proveedor', 'error');
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
        showToast('Precio inválido', 'error');
        return;
    }

    try {
        window.showLoading?.();

        // Obtener es_proveedor_principal actual
        const proveedoresActuales = await window.API.fetch(
            `/api/ingredients/${ingredienteId}/suppliers`
        );
        const proveedorActual = proveedoresActuales.find(p => p.proveedor_id === proveedorId);

        await window.API.fetch(`/api/ingredients/${ingredienteId}/suppliers/${proveedorId}`, {
            method: 'PUT',
            body: JSON.stringify({
                precio: parseFloat(nuevoPrecio),
                es_proveedor_principal: proveedorActual?.es_proveedor_principal || false,
            }),
        });

        showToast('Precio actualizado', 'success');

        // Recargar lista
        await cargarProveedoresIngrediente(ingredienteId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error actualizando precio:', error);
        showToast('Error actualizando precio', 'error');
    }
}

/**
 * Elimina un proveedor del ingrediente
 * @param {number} ingredienteId - ID del ingrediente
 * @param {number} proveedorId - ID del proveedor
 */
export async function eliminarProveedorIngrediente(ingredienteId, proveedorId) {
    if (!confirm('¿Eliminar este proveedor del ingrediente?')) return;

    try {
        window.showLoading?.();

        await window.API.fetch(`/api/ingredients/${ingredienteId}/suppliers/${proveedorId}`, {
            method: 'DELETE',
        });

        showToast('Proveedor eliminado', 'success');

        // Recargar lista
        await cargarProveedoresIngrediente(ingredienteId);

        window.hideLoading?.();
    } catch (error) {
        window.hideLoading?.();
        console.error('Error eliminando proveedor:', error);
        showToast('Error eliminando proveedor', 'error');
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
function escapeHTML(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
