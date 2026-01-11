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
        familia: getInputValue('ing-familia') || 'alimento',
        stockActual: parseFloat(getInputValue('ing-stockActual')) || 0,
        stockMinimo: parseFloat(getInputValue('ing-stockMinimo')) || 0,
        formato_compra: getInputValue('ing-formato-compra') || null,
        cantidad_por_formato: parseFloat(getInputValue('ing-cantidad-formato')) || null,
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

        // Sync bidireccional: Actualizar relación ingrediente-proveedor
        const nuevoProveedorId = ingrediente.proveedorId ? parseInt(ingrediente.proveedorId) : null;

        // Si estamos editando, buscar el ingrediente anterior para ver si tenía otro proveedor
        if (editandoId !== null) {
            const ingredienteAnterior = (window.ingredientes || []).find(i => i.id === editandoId);
            const proveedorAnteriorId = ingredienteAnterior?.proveedor_id || ingredienteAnterior?.proveedorId;

            // Si cambió de proveedor, quitar del anterior
            if (proveedorAnteriorId && proveedorAnteriorId !== nuevoProveedorId) {
                const proveedorAnterior = (window.proveedores || []).find(p => p.id === proveedorAnteriorId);
                if (proveedorAnterior && proveedorAnterior.ingredientes) {
                    const nuevaLista = proveedorAnterior.ingredientes.filter(id => id !== editandoId);
                    if (nuevaLista.length !== proveedorAnterior.ingredientes.length) {
                        await window.api.updateProveedor(proveedorAnterior.id, {
                            ...proveedorAnterior,
                            ingredientes: nuevaLista,
                        });
                    }
                }
            }
        }

        // Si se seleccionó un nuevo proveedor, añadir ingrediente a su lista
        if (nuevoProveedorId) {
            const proveedor = (window.proveedores || []).find(p => p.id === nuevoProveedorId);
            if (proveedor) {
                const ingredientesDelProveedor = proveedor.ingredientes || [];
                if (!ingredientesDelProveedor.includes(ingredienteId)) {
                    ingredientesDelProveedor.push(ingredienteId);
                    await window.api.updateProveedor(proveedor.id, {
                        ...proveedor,
                        ingredientes: ingredientesDelProveedor,
                    });
                }
            }
        }

        // 🆕 Auto-asociar proveedor con precio (no bloqueante)
        if (nuevoProveedorId && ingrediente.precio > 0) {
            const idIngrediente = ingredienteId;
            const idProveedor = parseInt(nuevoProveedorId);
            const precioProveedor = parseFloat(ingrediente.precio);

            setTimeout(async () => {
                try {
                    const proveedoresAsociados = await window.API.fetch(`/api/ingredients/${idIngrediente}/suppliers`) || [];
                    const yaAsociado = Array.isArray(proveedoresAsociados) && proveedoresAsociados.some(p => p.proveedor_id === idProveedor);

                    if (!yaAsociado) {
                        await window.API.fetch(`/api/ingredients/${idIngrediente}/suppliers`, {
                            method: 'POST',
                            body: JSON.stringify({
                                proveedor_id: idProveedor,
                                precio: precioProveedor,
                                es_proveedor_principal: true,
                            }),
                        });
                        console.log(`✅ Proveedor ${idProveedor} asociado al ingrediente ${idIngrediente}`);
                    }
                } catch (err) {
                    console.warn('Auto-asociar proveedor (no crítico):', err?.message);
                }
            }, 100);
        }

        // Recargar proveedores para tener datos actualizados
        window.proveedores = await window.api.getProveedores();

        // ⚡ OPTIMIZACIÓN: Actualización optimista - Recargamos ingredientes e inventario completo
        window.ingredientes = await window.api.getIngredientes();
        // FIX: Sincronizar inventarioCompleto para evitar precios desactualizados en UI
        if (window.api.getInventoryComplete) {
            window.inventarioCompleto = await window.api.getInventoryComplete();
        }

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
        if (typeof window.actualizarDashboardExpandido === 'function')
            window.actualizarDashboardExpandido();

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

    // Primero actualizar estado de edición
    window.editandoIngredienteId = id;
    setEditandoIngredienteId(id);

    const titleEl = getElement('form-title-ingrediente');
    if (titleEl) titleEl.textContent = 'Editar Ingrediente';

    const btnEl = getElement('btn-text-ingrediente');
    if (btnEl) btnEl.textContent = 'Guardar';

    // Mostrar formulario PRIMERO (esto actualiza el select de proveedores)
    window.mostrarFormularioIngrediente();

    // AHORA rellenar los campos (después de que el select tenga las opciones)
    const nombreEl = getElement('ing-nombre');
    if (nombreEl) nombreEl.value = ing.nombre;

    // Establecer proveedor DESPUÉS de que el select esté poblado
    const provEl = getElement('ing-proveedor-select');
    if (provEl) {
        const provId = ing.proveedor_id || ing.proveedorId || '';
        provEl.value = provId;
        // Si no se seleccionó correctamente, intentar con timeout
        if (provId && provEl.value !== String(provId)) {
            setTimeout(() => {
                provEl.value = provId;
            }, 50);
        }
    }

    const precioEl = getElement('ing-precio');
    if (precioEl) precioEl.value = ing.precio || '';

    const unidadEl = getElement('ing-unidad');
    if (unidadEl) unidadEl.value = ing.unidad;

    const stockEl = getElement('ing-stockActual');
    if (stockEl) stockEl.value = ing.stockActual || '';

    const minEl = getElement('ing-stockMinimo');
    if (minEl) minEl.value = ing.stockMinimo || '';

    // Cargar familia
    const familiaEl = getElement('ing-familia');
    if (familiaEl) familiaEl.value = ing.familia || 'alimento';

    // Cargar formato de compra
    const formatoEl = getElement('ing-formato-compra');
    if (formatoEl) formatoEl.value = ing.formato_compra || '';

    const cantFormatoEl = getElement('ing-cantidad-formato');
    if (cantFormatoEl) cantFormatoEl.value = ing.cantidad_por_formato || '';
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
            if (typeof window.actualizarDashboardExpandido === 'function')
                window.actualizarDashboardExpandido();

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

/**
 * Toggle activo/inactivo ingrediente
 * En lugar de eliminar, desactiva el ingrediente para preservar historial
 */
export async function toggleIngredienteActivo(id, activo) {
    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        const result = await window.API.toggleIngredientActive(id, activo);

        if (!result || result.error) {
            throw new Error(result?.error || 'Error al cambiar estado');
        }

        // Actualizar en array local
        const ing = (window.ingredientes || []).find(i => i.id === id);
        if (ing) {
            ing.activo = activo;
        }

        // Re-renderizar
        window.renderizarIngredientes?.();

        if (typeof window.hideLoading === 'function') window.hideLoading();
        showToast(activo ? 'Ingrediente activado' : 'Ingrediente desactivado', 'success');
    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error toggle activo:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// Exponer globalmente
window.toggleIngredienteActivo = toggleIngredienteActivo;
