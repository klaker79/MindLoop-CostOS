/**
 * Módulo de Ingredientes - CRUD
 * Operaciones de crear, editar y eliminar ingredientes
 */

import { showToast } from '../../ui/toast.js';
import { getElement, getInputValue } from '../../utils/dom-helpers.js';
import { setEditandoIngredienteId } from './ingredientes-ui.js';
// 🆕 Zustand store para gestión de estado
import ingredientStore from '../../stores/ingredientStore.js';
// 🆕 Validación centralizada
import { validateIngrediente, showValidationErrors } from '../../utils/validation.js';

/**
 * Guarda un ingrediente (crear o actualizar)
 */
let _guardandoIngrediente = false; // 🔒 FIX: Prevenir doble submit
export async function guardarIngrediente(event) {
    event.preventDefault();

    // 🔒 FIX: Prevenir múltiples clicks
    if (_guardandoIngrediente) {
        console.warn('⚠️ Operación en curso, ignorando click duplicado');
        return;
    }
    _guardandoIngrediente = true;

    // 🔒 FIX CRÍTICO: Solo incluir stock si el campo tiene valor
    // Antes: stockActual: parseFloat(x) || 0 → convertía vacío a 0
    // Ahora: undefined si está vacío → backend preserva valor actual
    const stockActualValue = getInputValue('ing-stockActual');
    const stockMinimoValue = getInputValue('ing-stockMinimo');

    const ingrediente = {
        nombre: getInputValue('ing-nombre'),
        proveedorId: getInputValue('ing-proveedor-select') || null,
        precio: parseFloat(getInputValue('ing-precio')) || 0,
        unidad: getInputValue('ing-unidad'),
        familia: getInputValue('ing-familia') || 'alimento',
        rendimiento: parseFloat(getInputValue('ing-rendimiento')) || 100,
        // Solo enviar si tiene valor, undefined = backend preserva actual
        stock_actual: stockActualValue !== '' ? parseFloat(stockActualValue) : undefined,
        stock_minimo: stockMinimoValue !== '' ? parseFloat(stockMinimoValue) : undefined,
        formato_compra: getInputValue('ing-formato-compra') || null,
        // 🔒 FIX: Solo enviar cantidad_por_formato si el usuario la editó explícitamente
        // undefined = no cambiar, null = borrar intencionalmente
        cantidad_por_formato: getInputValue('ing-cantidad-formato')
            ? parseFloat(getInputValue('ing-cantidad-formato'))
            : undefined,
    };

    // 🆕 Validación centralizada (reemplaza validación manual)
    const validation = validateIngrediente(ingrediente);
    if (!validation.valid) {
        showValidationErrors(validation.errors);
        _guardandoIngrediente = false;
        return;
    }


    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        const editandoId = window.editandoIngredienteId;
        let ingredienteId;

        // 🔍 DEBUG: Ver qué se envía al backend
        console.log('📤 Guardando ingrediente:', JSON.stringify(ingrediente, null, 2));
        console.log('📤 Stock enviado:', ingrediente.stockActual, '(tipo:', typeof ingrediente.stockActual, ')');

        // 🆕 Usar Zustand store en lugar de window.api
        const store = ingredientStore.getState();

        if (editandoId !== null) {
            console.log('📤 Actualizando ID:', editandoId);
            const result = await store.updateIngredient(editandoId, ingrediente);
            if (!result.success) throw new Error(result.error || 'Error actualizando ingrediente');
            ingredienteId = editandoId;
        } else {
            const result = await store.createIngredient(ingrediente);
            if (!result.success) throw new Error(result.error || 'Error creando ingrediente');
            ingredienteId = result.data.id;
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

        // 🆕 Auto-asociar proveedor con precio
        // 🔧 FIX: Ejecutar de forma síncrona (await) en lugar de setTimeout
        // El setTimeout causaba condiciones de carrera con otras operaciones
        if (nuevoProveedorId && ingrediente.precio > 0) {
            const idIngrediente = ingredienteId;
            const idProveedor = parseInt(nuevoProveedorId);
            const precioProveedor = parseFloat(ingrediente.precio);

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
                // No bloqueante - solo warning si falla
                console.warn('Auto-asociar proveedor (no crítico):', err?.message);
            }
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
        window._forceRecalcStock = true; // Forzar recálculo porque cambió un ingrediente
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
    } finally {
        // 🔒 FIX: Siempre liberar el flag para permitir nuevos guardados
        _guardandoIngrediente = false;
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
    // 🔒 FIX CRÍTICO: Backend devuelve stock_actual, frontend usaba stockActual
    if (stockEl) stockEl.value = ing.stock_actual ?? ing.stockActual ?? '';

    const minEl = getElement('ing-stockMinimo');
    // 🔒 FIX: También usar ambos nombres para stock mínimo
    if (minEl) minEl.value = ing.stock_minimo ?? ing.stockMinimo ?? '';

    // Cargar familia
    const familiaEl = getElement('ing-familia');
    if (familiaEl) familiaEl.value = ing.familia || 'alimento';

    // Cargar rendimiento
    const rendimientoEl = getElement('ing-rendimiento');
    if (rendimientoEl) rendimientoEl.value = ing.rendimiento !== undefined && ing.rendimiento !== null ? ing.rendimiento : 100;

    // Cargar formato de compra
    const formatoEl = getElement('ing-formato-compra');
    if (formatoEl) formatoEl.value = ing.formato_compra || '';

    const cantFormatoEl = getElement('ing-cantidad-formato');
    // 🔒 FIX: Mostrar el valor aunque sea 0 (solo ocultar si es null/undefined)
    if (cantFormatoEl) cantFormatoEl.value = ing.cantidad_por_formato !== null && ing.cantidad_por_formato !== undefined
        ? ing.cantidad_por_formato
        : '';
}

/**
 * Elimina un ingrediente
 * 🔧 FIX: Añadido lock para prevenir múltiples eliminaciones por clicks rápidos
 */
let _eliminandoIngrediente = false;

export async function eliminarIngrediente(id) {
    // 🔧 FIX: Prevenir múltiples eliminaciones simultáneas
    if (_eliminandoIngrediente) {
        console.warn('⚠️ Eliminación ya en progreso, ignorando click adicional');
        return;
    }

    const confirmar = window.confirm('¿Eliminar este ingrediente?');
    if (!confirmar) return;

    _eliminandoIngrediente = true;

    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = ingredientStore.getState();
        const result = await store.deleteIngredient(id);
        if (!result.success) throw new Error(result.error || 'Error eliminando ingrediente');

        // El store ya actualiza window.ingredientes automáticamente

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
        window._forceRecalcStock = true; // Forzar recálculo porque se eliminó ingrediente
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
    } finally {
        // 🔧 FIX: Liberar lock después de completar (éxito o error)
        _eliminandoIngrediente = false;
    }
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
