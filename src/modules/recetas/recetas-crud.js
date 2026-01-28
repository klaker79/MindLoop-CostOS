/**
 * Recetas CRUD Module
 * Funciones de creación, edición y eliminación de recetas
 */

// 🆕 Zustand store para gestión de estado
import recipeStore from '../../stores/recipeStore.js';

/**
 * Guarda una receta (nueva o editada)
 * @param {Event} event - Evento del formulario
 */
export async function guardarReceta(event) {
    event.preventDefault();

    const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
    const ingredientesReceta = [];

    items.forEach(item => {
        const select = item.querySelector('select');
        const input = item.querySelector('input');
        if (select.value && input.value) {
            // 🧪 Detectar si es receta base (valor empieza con "rec_")
            if (select.value.startsWith('rec_')) {
                const recetaId = parseInt(select.value.replace('rec_', ''));
                ingredientesReceta.push({
                    // Guardar con ID offset (100000+) para identificar como receta base
                    // El backend acepta IDs positivos, y al cargar detectamos que es receta base
                    ingredienteId: 100000 + recetaId,
                    cantidad: parseFloat(input.value),
                });
            } else {
                ingredientesReceta.push({
                    ingredienteId: parseInt(select.value),
                    cantidad: parseFloat(input.value),
                });
            }
        }
    });

    if (ingredientesReceta.length === 0) {
        window.showToast('Añade ingredientes a la receta', 'warning');
        return;
    }

    const receta = {
        nombre: document.getElementById('rec-nombre').value,
        codigo: document.getElementById('rec-codigo').value,
        categoria: document.getElementById('rec-categoria').value,
        precio_venta: parseFloat(document.getElementById('rec-precio_venta').value) || 0,
        porciones: parseInt(document.getElementById('rec-porciones').value) || 1,
        ingredientes: ingredientesReceta,
    };

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = recipeStore.getState();

        if (window.editandoRecetaId !== null) {
            const result = await store.updateRecipe(window.editandoRecetaId, receta);
            if (!result.success) throw new Error(result.error || 'Error actualizando receta');
        } else {
            const result = await store.createRecipe(receta);
            if (!result.success) throw new Error(result.error || 'Error creando receta');
        }

        // El store ya sincroniza window.recetas, pero recargamos datos completos
        await window.cargarDatos();
        window.renderizarRecetas();
        window.hideLoading();
        window.showToast(
            window.editandoRecetaId ? 'Receta actualizada' : 'Receta creada',
            'success'
        );
        window.cerrarFormularioReceta();
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error guardando receta: ' + error.message, 'error');
    }
}

/**
 * Edita una receta existente
 * @param {number} id - ID de la receta
 */
export function editarReceta(id) {
    const rec = (window.recetas || []).find(r => r.id === id);
    if (!rec) return;

    document.getElementById('rec-nombre').value = rec.nombre;
    document.getElementById('rec-codigo').value = rec.codigo || '';
    document.getElementById('rec-categoria').value = rec.categoria;
    document.getElementById('rec-precio_venta').value = rec.precio_venta;
    document.getElementById('rec-porciones').value = rec.porciones;

    document.getElementById('lista-ingredientes-receta').innerHTML = '';
    rec.ingredientes.forEach(item => {
        window.agregarIngredienteReceta();
        const lastItem = document.querySelector(
            '#lista-ingredientes-receta .ingrediente-item:last-child'
        );
        const selectEl = lastItem.querySelector('select');

        // 🧪 Detectar si es receta base (ingredienteId > 100000)
        if (item.ingredienteId > 100000) {
            const recetaId = item.ingredienteId - 100000;
            selectEl.value = `rec_${recetaId}`;
        } else {
            selectEl.value = item.ingredienteId;
        }
        lastItem.querySelector('input').value = item.cantidad;
    });

    window.calcularCosteReceta();
    window.editandoRecetaId = id;
    document.getElementById('form-title-receta').textContent = 'Editar';
    document.getElementById('btn-text-receta').textContent = 'Guardar';
    window.mostrarFormularioReceta();
}

/**
 * Elimina una receta
 * @param {number} id - ID de la receta
 */
export async function eliminarReceta(id) {
    const rec = (window.recetas || []).find(r => r.id === id);
    if (!rec) return;

    if (!confirm(`¿Eliminar la receta "${rec.nombre}"?`)) return;

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = recipeStore.getState();
        const result = await store.deleteRecipe(id);
        if (!result.success) throw new Error(result.error || 'Error eliminando receta');

        // El store ya sincroniza window.recetas
        await window.cargarDatos();
        window.renderizarRecetas();
        window.hideLoading();
        window.showToast('Receta eliminada', 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error eliminando receta: ' + error.message, 'error');
    }
}

/**
 * Calcula el coste completo de una receta
 * 💰 ACTUALIZADO: Usa precio_medio del inventario (basado en compras)
 * @param {Object} receta - Objeto receta
 * @returns {number} Coste total
 */
// ⚡ CACHE: Maps para búsquedas O(1) - se invalidan cuando cambia la referencia del array
let _invMapCache = null;
let _ingMapCache = null;
let _lastInvRef = null;
let _lastIngRef = null;

function getInvMap() {
    const inv = window.inventarioCompleto || [];
    // Invalidar cache cuando cambia la referencia del array (después de cargarDatos)
    if (!_invMapCache || inv !== _lastInvRef) {
        _invMapCache = new Map(inv.map(i => [i.id, i]));
        _lastInvRef = inv;
    }
    return _invMapCache;
}

function getIngMap() {
    const ing = window.ingredientes || [];
    // Invalidar cache cuando cambia la referencia del array (después de cargarDatos)
    if (!_ingMapCache || ing !== _lastIngRef) {
        _ingMapCache = new Map(ing.map(i => [i.id, i]));
        _lastIngRef = ing;
    }
    return _ingMapCache;
}

export function calcularCosteRecetaCompleto(receta) {
    if (!receta || !receta.ingredientes) return 0;

    // ⚡ OPTIMIZACIÓN: Usar Maps O(1) en lugar de .find() O(n)
    const invMap = getInvMap();
    const ingMap = getIngMap();
    const recetas = window.recetas || [];
    const recetasMap = new Map(recetas.map(r => [r.id, r]));

    const costeTotalLote = receta.ingredientes.reduce((total, item) => {
        // 🧪 Detectar si es receta base (ingredienteId > 100000)
        if (item.ingredienteId > 100000) {
            const recetaId = item.ingredienteId - 100000;
            const recetaBase = recetasMap.get(recetaId);
            if (recetaBase) {
                // Calcular coste recursivamente (evitar recursión infinita)
                const costeRecetaBase = calcularCosteRecetaCompleto(recetaBase);
                return total + costeRecetaBase * item.cantidad;
            }
            return total;
        }

        // Ingrediente normal
        const invItem = invMap.get(item.ingredienteId);
        const ing = ingMap.get(item.ingredienteId);

        // 💰 CORREGIDO: Precio unitario = precio_medio del inventario, o precio/cantidad_por_formato
        let precio = 0;
        if (invItem?.precio_medio) {
            precio = parseFloat(invItem.precio_medio);
        } else if (ing?.precio) {
            const precioFormato = parseFloat(ing.precio);
            const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;
            precio = precioFormato / cantidadPorFormato;
        }

        return total + precio * item.cantidad;
    }, 0);

    // 🔧 FIX: Dividir por porciones para obtener coste POR PORCIÓN
    const porciones = parseInt(receta.porciones) || 1;
    const costePorPorcion = costeTotalLote / porciones;

    // Redondear a 2 decimales para evitar errores de precisión
    return parseFloat(costePorPorcion.toFixed(2));
}

/**
 * Abre modal para producir platos
 * @param {number} id - ID de la receta
 */
export function abrirModalProducir(id) {
    window.recetaProduciendo = id;
    const rec = (window.recetas || []).find(r => r.id === id);
    document.getElementById('modal-plato-nombre').textContent = rec.nombre;
    document.getElementById('modal-cantidad').value = 1;
    window.actualizarDetalleDescuento();
    document.getElementById('modal-producir').classList.add('active');
}

/**
 * Cierra modal de producir
 */
export function cerrarModalProducir() {
    document.getElementById('modal-producir').classList.remove('active');
    window.recetaProduciendo = null;
}

/**
 * Actualiza detalle de descuento de stock
 * ⚡ OPTIMIZACIÓN: Pre-build Map de ingredientes
 */
export function actualizarDetalleDescuento() {
    if (window.recetaProduciendo === null) return;
    const cant = parseInt(document.getElementById('modal-cantidad').value) || 1;
    const rec = (window.recetas || []).find(r => r.id === window.recetaProduciendo);

    // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    let html = '<ul style="margin:0;padding-left:20px;">';
    rec.ingredientes.forEach(item => {
        const ing = ingMap.get(item.ingredienteId);
        if (ing) html += `<li>${ing.nombre}: -${item.cantidad * cant} ${ing.unidad}</li>`;
    });
    html += '</ul>';
    document.getElementById('modal-descuento-detalle').innerHTML = html;
}

/**
 * Confirma y ejecuta la producción de platos (descuenta stock)
 * ⚡ OPTIMIZACIÓN: Pre-build Map de ingredientes para evitar múltiples .find()
 */
export async function confirmarProduccion() {
    if (window.recetaProduciendo === null) return;
    const cant = parseInt(document.getElementById('modal-cantidad').value) || 1;
    const rec = (window.recetas || []).find(r => r.id === window.recetaProduciendo);

    // ⚡ OPTIMIZACIÓN: Crear Map una vez para ambos loops (validación + actualización)
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    let falta = false;
    let msg = 'Stock insuficiente:\n';
    rec.ingredientes.forEach(item => {
        const ing = ingMap.get(item.ingredienteId);
        if (ing) {
            const necesario = item.cantidad * cant;
            const stockIng = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0);
            if (stockIng < necesario) {
                falta = true;
                msg += `- ${ing.nombre}: necesitas ${necesario}, tienes ${stockIng}\n`;
            }
        }
    });

    if (falta) {
        alert(msg);
        return;
    }

    window.showLoading();

    try {
        // 🔒 FIX CRÍTICO: Procesamiento SECUENCIAL con tracking de cambios
        // Promise.all puede dejar datos inconsistentes si falla a mitad
        // Ahora procesamos uno por uno y trackeamos qué se actualizó
        const actualizacionesExitosas = [];
        const actualizacionesFallidas = [];

        for (const item of rec.ingredientes) {
            const ing = ingMap.get(item.ingredienteId);
            if (!ing) continue;

            const stockAnterior = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0);
            const cantidadDescontar = item.cantidad * cant;
            const nuevoStock = Math.max(0, stockAnterior - cantidadDescontar);

            try {
                await window.api.updateIngrediente(ing.id, {
                    nombre: ing.nombre,
                    unidad: ing.unidad,
                    precio: ing.precio,
                    proveedor_id: ing.proveedor_id || ing.proveedorId,
                    familia: ing.familia,
                    formato_compra: ing.formato_compra,
                    cantidad_por_formato: ing.cantidad_por_formato,
                    stock_minimo: ing.stock_minimo ?? ing.stockMinimo,
                    stock_actual: nuevoStock,
                });

                // Trackear éxito para posible rollback
                actualizacionesExitosas.push({
                    id: ing.id,
                    nombre: ing.nombre,
                    stockAnterior,
                    stockNuevo: nuevoStock,
                    cantidadDescontada: cantidadDescontar
                });

                console.log(`✅ ${ing.nombre}: ${stockAnterior} → ${nuevoStock}`);

            } catch (itemError) {
                actualizacionesFallidas.push({
                    id: ing.id,
                    nombre: ing.nombre,
                    error: itemError.message
                });
                console.error(`❌ Error actualizando ${ing.nombre}:`, itemError);
            }
        }

        // Si hubo fallos parciales, notificar al usuario con detalle
        if (actualizacionesFallidas.length > 0) {
            const exitosos = actualizacionesExitosas.map(a => a.nombre).join(', ');
            const fallidos = actualizacionesFallidas.map(a => `${a.nombre}: ${a.error}`).join('\n');

            window.hideLoading();

            // Log para auditoría
            console.error('⚠️ PRODUCCIÓN PARCIAL:', {
                receta: rec.nombre,
                cantidad: cant,
                exitosos: actualizacionesExitosas,
                fallidos: actualizacionesFallidas,
                fecha: new Date().toISOString()
            });

            alert(
                `⚠️ ATENCIÓN: Producción parcialmente completada\n\n` +
                `✅ Stock actualizado: ${exitosos || 'ninguno'}\n\n` +
                `❌ Falló actualizar:\n${fallidos}\n\n` +
                `Por favor, verifica el inventario manualmente.`
            );

            // Aún así recargar datos para mostrar estado actual
            await window.cargarDatos();
            window.renderizarIngredientes();
            return;
        }

        await window.cargarDatos();
        window.renderizarIngredientes();
        window.hideLoading();
        cerrarModalProducir();
        window.showToast(`Producidas ${cant} unidades de ${rec.nombre}`, 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error actualizando stock: ' + error.message, 'error');
    }
}
