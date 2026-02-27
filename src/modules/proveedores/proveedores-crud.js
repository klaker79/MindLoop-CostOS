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

    const checks = document.querySelectorAll(
        '#lista-ingredientes-proveedor input[type="checkbox"]:checked'
    );
    const ingredientesIds = Array.from(checks).map(cb => parseInt(cb.value));

    const proveedor = {
        nombre: document.getElementById('prov-nombre').value,
        contacto: document.getElementById('prov-contacto').value || '',
        telefono: document.getElementById('prov-telefono').value || '',
        email: document.getElementById('prov-email').value || '',
        direccion: document.getElementById('prov-direccion').value || '',
        notas: document.getElementById('prov-notas').value || '',
        ingredientes: ingredientesIds,
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

        // Sync bidireccional: Actualizar proveedor_id en cada ingrediente
        // 1. Para ingredientes marcados: asignar este proveedor
        // 2. Para ingredientes desmarcados que antes tenían este proveedor: quitar

        const proveedorAnterior = window.editandoProveedorId
            ? (window.proveedores || []).find(p => p.id === window.editandoProveedorId)
            : null;
        const ingredientesAnteriores = proveedorAnterior?.ingredientes || [];

        // Ingredientes que se añadieron (marcar con este proveedor)
        const ingredientesNuevos = ingredientesIds.filter(id => !ingredientesAnteriores.includes(id));
        for (const ingId of ingredientesNuevos) {
            const ing = (window.ingredientes || []).find(i => i.id === ingId);
            if (ing) {
                // 🔒 FIX v2: Solo enviar proveedor_id, NO tocar stock_actual
                await window.api.updateIngrediente(ingId, {
                    proveedor_id: proveedorId
                });
            }
        }

        // Ingredientes que se quitaron (limpiar proveedor_id)
        const ingredientesQuitados = ingredientesAnteriores.filter(id => !ingredientesIds.includes(id));
        for (const ingId of ingredientesQuitados) {
            const ing = (window.ingredientes || []).find(i => i.id === ingId);
            if (ing && (ing.proveedor_id === proveedorId || ing.proveedorId === proveedorId)) {
                // 🔒 FIX v2: Solo limpiar proveedor_id, NO tocar stock_actual
                await window.api.updateIngrediente(ingId, {
                    proveedor_id: null
                });
            }
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
