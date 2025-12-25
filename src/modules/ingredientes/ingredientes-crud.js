/**
 * Módulo de Ingredientes - CRUD
 * Operaciones de crear, editar y eliminar ingredientes
 */

import { showToast } from '../../ui/toast.js';
import { getElement, getInputValue } from '../../utils/dom-helpers.js';
import { setEditandoIngredienteId } from './ingredientes-ui.js';

/**
 * Guarda un ingrediente (crear o actualizar)
 */
export async function guardarIngrediente(event) {
    event.preventDefault();

    const ingrediente = {
        nombre: getInputValue('ing-nombre'),
        proveedorId: getInputValue('ing-proveedor-select') || null,
        precio: parseFloat(getInputValue('ing-precio')) || 0,
        unidad: getInputValue('ing-unidad'),
        stockActual: parseFloat(getInputValue('ing-stockActual')) || 0,
        stockMinimo: parseFloat(getInputValue('ing-stockMinimo')) || 0
    };

    // Validaciones
    if (!ingrediente.nombre || ingrediente.nombre.trim() === '') {
        showToast('El nombre es obligatorio', 'error');
        return;
    }
    if (ingrediente.precio < 0) {
        showToast('El precio no puede ser negativo', 'error');
        return;
    }
    if (ingrediente.stockActual < 0) {
        showToast('El stock no puede ser negativo', 'error');
        return;
    }
    if (ingrediente.stockMinimo < 0) {
        showToast('El stock mínimo no puede ser negativo', 'error');
        return;
    }

    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        const editandoId = window.editandoIngredienteId;
        let ingredienteId;

        if (editandoId !== null) {
            await window.api.updateIngrediente(editandoId, ingrediente);
            ingredienteId = editandoId;
        } else {
            const nuevoIng = await window.api.createIngrediente(ingrediente);
            ingredienteId = nuevoIng.id;
        }

        // Si se seleccionó un proveedor, añadir ingrediente a su lista
        if (ingrediente.proveedorId) {
            const proveedores = window.proveedores || [];
            const proveedor = proveedores.find(p => p.id === parseInt(ingrediente.proveedorId));
            if (proveedor) {
                const ingredientesDelProveedor = proveedor.ingredientes || [];
                if (!ingredientesDelProveedor.includes(ingredienteId)) {
                    ingredientesDelProveedor.push(ingredienteId);
                    await window.api.updateProveedor(proveedor.id, {
                        ...proveedor,
                        ingredientes: ingredientesDelProveedor
                    });
                }
            }
        }

        // ⚡ OPTIMIZACIÓN: Actualización optimista - Solo recargamos ingredientes, no todo
        window.ingredientes = await window.api.getIngredientes();

        // Actualizar maps de búsqueda
        if (window.dataMaps) {
            window.dataMaps.ingredientesMap = new Map(window.ingredientes.map(i => [i.id, i]));
        }

        // Invalidar cache de costes de recetas
        if (window.Performance?.invalidarCacheIngredientes) {
            window.Performance.invalidarCacheIngredientes();
        }

        window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();
        if (typeof window.actualizarDashboardExpandido === 'function') window.actualizarDashboardExpandido();

        if (typeof window.hideLoading === 'function') window.hideLoading();
        showToast(editandoId ? 'Ingrediente actualizado' : 'Ingrediente creado', 'success');
        window.cerrarFormularioIngrediente();
    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error:', error);
        showToast('Error guardando ingrediente: ' + error.message, 'error');
    }
}

/**
 * Edita un ingrediente cargando sus datos en el formulario
 */
export function editarIngrediente(id) {
    const ingredientes = window.ingredientes || [];
    const ing = ingredientes.find(i => i.id === id);
    if (!ing) return;

    // Actualizar select de proveedores (función de UI)
    if (typeof window.actualizarSelectProveedores === 'function') {
        window.actualizarSelectProveedores();
    }

    const nombreEl = getElement('ing-nombre');
    if (nombreEl) nombreEl.value = ing.nombre;

    const provEl = getElement('ing-proveedor-select');
    if (provEl) provEl.value = ing.proveedorId || '';

    const precioEl = getElement('ing-precio');
    if (precioEl) precioEl.value = ing.precio || '';

    const unidadEl = getElement('ing-unidad');
    if (unidadEl) unidadEl.value = ing.unidad;

    const stockEl = getElement('ing-stockActual');
    if (stockEl) stockEl.value = ing.stockActual || '';

    const minEl = getElement('ing-stockMinimo');
    if (minEl) minEl.value = ing.stockMinimo || '';

    // Actualizar estado de edición
    window.editandoIngredienteId = id;
    setEditandoIngredienteId(id);

    const titleEl = getElement('form-title-ingrediente');
    if (titleEl) titleEl.textContent = 'Editar Ingrediente';

    const btnEl = getElement('btn-text-ingrediente');
    if (btnEl) btnEl.textContent = 'Guardar';

    window.mostrarFormularioIngrediente();
}

/**
 * Elimina un ingrediente
 */
export async function eliminarIngrediente(id) {
    // Debug: eliminarIngrediente llamado con id

    // Usar setTimeout para que el confirm no sea bloqueado por Chrome
    setTimeout(async () => {
        const confirmar = window.confirm('¿Eliminar este ingrediente?');
        if (!confirmar) return;

        if (typeof window.showLoading === 'function') window.showLoading();

        try {
            await window.api.deleteIngrediente(id);

            // ⚡ OPTIMIZACIÓN: Actualización optimista - Filtrar del array local
            window.ingredientes = (window.ingredientes || []).filter(ing => ing.id !== id);

            // Actualizar maps de búsqueda
            if (window.dataMaps) {
                window.dataMaps.ingredientesMap.delete(id);
            }

            // Invalidar cache
            if (window.Performance?.invalidarCacheIngredientes) {
                window.Performance.invalidarCacheIngredientes();
            }

            window.renderizarIngredientes();
            if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
            if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();
            if (typeof window.actualizarDashboardExpandido === 'function') window.actualizarDashboardExpandido();

            if (typeof window.hideLoading === 'function') window.hideLoading();
            if (typeof showToast === 'function') {
                showToast('Ingrediente eliminado', 'success');
            } else if (typeof window.showToast === 'function') {
                window.showToast('Ingrediente eliminado', 'success');
            }
        } catch (error) {
            if (typeof window.hideLoading === 'function') window.hideLoading();
            console.error('Error eliminando ingrediente:', error);
            const toastFn = typeof showToast === 'function' ? showToast : window.showToast;
            if (typeof toastFn === 'function') {
                toastFn('Error eliminando ingrediente: ' + error.message, 'error');
            }
        }
    }, 10);
}
