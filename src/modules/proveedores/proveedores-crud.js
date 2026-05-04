/**
 * Proveedores CRUD Module
 * Funciones de crear, editar y eliminar proveedores
 */

import { t } from '@/i18n/index.js';
// 🆕 Zustand store para gestión de estado
import supplierStore from '../../stores/supplierStore.js';
// 🆕 Validación centralizada
import { validateProveedor, showValidationErrors } from '../../utils/validation.js';

/**
 * Guarda un proveedor (nuevo o editado)
 */
export async function guardarProveedor(event) {
    event.preventDefault();

    // La relación ingrediente↔proveedor se gestiona desde la pestaña Ingredientes
    // (refactor 2026-05-04). Aquí solo guardamos los datos básicos del proveedor.
    const proveedor = {
        nombre: document.getElementById('prov-nombre').value,
        contacto: document.getElementById('prov-contacto').value || '',
        telefono: document.getElementById('prov-telefono').value || '',
        email: document.getElementById('prov-email').value || '',
        direccion: document.getElementById('prov-direccion').value || '',
        notas: document.getElementById('prov-notas').value || '',
    };

    // 🆕 Validación centralizada
    const validation = validateProveedor(proveedor);
    if (!validation.valid) {
        showValidationErrors(validation.errors);
        return;
    }

    window.showLoading();

    try {
        let proveedorId = window.editandoProveedorId;

        // 🆕 Usar Zustand store en lugar de window.api
        const store = supplierStore.getState();

        if (proveedorId !== null) {
            const result = await store.updateSupplier(proveedorId, proveedor);
            if (!result.success) throw new Error(result.error || t('proveedores:toast_error_saving', { message: 'update failed' }));
        } else {
            const result = await store.createSupplier(proveedor);
            if (!result.success) throw new Error(result.error || t('proveedores:toast_error_saving', { message: 'create failed' }));
            proveedorId = result.data.id;
        }

        await window.cargarDatos();
        window.renderizarProveedores();
        window.hideLoading();
        window.showToast(
            window.editandoProveedorId ? t('proveedores:toast_updated') : t('proveedores:toast_created'),
            'success'
        );
        window.cerrarFormularioProveedor();
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast(t('proveedores:toast_error_saving', { message: error.message }), 'error');
    }
}

/**
 * Edita un proveedor existente
 */
export function editarProveedor(id) {
    const prov = (window.proveedores || []).find(p => p.id === id);
    if (!prov) return;

    // Rellenar todos los campos del formulario con los datos existentes
    document.getElementById('prov-nombre').value = prov.nombre || '';
    document.getElementById('prov-contacto').value = prov.contacto || '';
    document.getElementById('prov-telefono').value = prov.telefono || '';
    document.getElementById('prov-email').value = prov.email || '';
    document.getElementById('prov-direccion').value = prov.direccion || '';
    document.getElementById('prov-notas').value = prov.notas || '';

    window.cargarIngredientesProveedor(prov.ingredientes || []);

    window.editandoProveedorId = id;
    document.getElementById('form-title-proveedor').textContent = t('proveedores:form_title_edit');
    document.getElementById('btn-text-proveedor').textContent = t('proveedores:btn_save');
    window.mostrarFormularioProveedor();
}

/**
 * Elimina un proveedor
 */
export async function eliminarProveedor(id) {
    const prov = (window.proveedores || []).find(p => p.id === id);
    if (!prov) return;

    if (!confirm(t('proveedores:confirm_delete', { name: prov.nombre }))) return;

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = supplierStore.getState();
        const result = await store.deleteSupplier(id);
        if (!result.success) throw new Error(result.error || t('proveedores:toast_error_deleting', { message: '' }));

        await window.cargarDatos();
        window.renderizarProveedores();
        window.hideLoading();
        window.showToast(t('proveedores:toast_deleted'), 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast(t('proveedores:toast_error_deleting', { message: error.message }), 'error');
    }
}
