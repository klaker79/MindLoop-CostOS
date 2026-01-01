/**
 * Recetas CRUD Module
 * Funciones de creación, edición y eliminación de recetas
 */

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
            ingredientesReceta.push({
                ingredienteId: parseInt(select.value),
                cantidad: parseFloat(input.value),
            });
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
        if (window.editandoRecetaId !== null) {
            await window.api.updateReceta(window.editandoRecetaId, receta);
        } else {
            await window.api.createReceta(receta);
        }
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
    const rec = window.recetas.find(r => r.id === id);
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
        lastItem.querySelector('select').value = item.ingredienteId;
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
    const rec = window.recetas.find(r => r.id === id);
    if (!rec) return;

    if (!confirm(`¿Eliminar la receta "${rec.nombre}"?`)) return;

    window.showLoading();

    try {
        await window.api.deleteReceta(id);
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
// ⚡ CACHE: Maps para búsquedas O(1) - se actualizan cuando cambian los datos
let _invMapCache = null;
let _ingMapCache = null;
let _lastInvLength = 0;
let _lastIngLength = 0;

function getInvMap() {
    const inv = window.inventarioCompleto || [];
    if (!_invMapCache || inv.length !== _lastInvLength) {
        _invMapCache = new Map(inv.map(i => [i.id, i]));
        _lastInvLength = inv.length;
    }
    return _invMapCache;
}

function getIngMap() {
    const ing = window.ingredientes || [];
    if (!_ingMapCache || ing.length !== _lastIngLength) {
        _ingMapCache = new Map(ing.map(i => [i.id, i]));
        _lastIngLength = ing.length;
    }
    return _ingMapCache;
}

export function calcularCosteRecetaCompleto(receta) {
    if (!receta || !receta.ingredientes) return 0;

    // ⚡ OPTIMIZACIÓN: Usar Maps O(1) en lugar de .find() O(n)
    const invMap = getInvMap();
    const ingMap = getIngMap();

    return receta.ingredientes.reduce((total, item) => {
        const invItem = invMap.get(item.ingredienteId);
        const ing = ingMap.get(item.ingredienteId);

        const precio = invItem?.precio_medio
            ? parseFloat(invItem.precio_medio)
            : (ing?.precio ? parseFloat(ing.precio) : 0);

        return total + precio * item.cantidad;
    }, 0);
}

/**
 * Abre modal para producir platos
 * @param {number} id - ID de la receta
 */
export function abrirModalProducir(id) {
    window.recetaProduciendo = id;
    const rec = window.recetas.find(r => r.id === id);
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
    const rec = window.recetas.find(r => r.id === window.recetaProduciendo);

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
    const rec = window.recetas.find(r => r.id === window.recetaProduciendo);

    // ⚡ OPTIMIZACIÓN: Crear Map una vez para ambos loops (validación + actualización)
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    let falta = false;
    let msg = 'Stock insuficiente:\n';
    rec.ingredientes.forEach(item => {
        const ing = ingMap.get(item.ingredienteId);
        if (ing) {
            const necesario = item.cantidad * cant;
            if (ing.stockActual < necesario) {
                falta = true;
                msg += `- ${ing.nombre}: necesitas ${necesario}, tienes ${ing.stockActual}\n`;
            }
        }
    });

    if (falta) {
        alert(msg);
        return;
    }

    window.showLoading();

    try {
        // ⚡ OPTIMIZACIÓN: Llamadas API en paralelo con Promise.all
        const updatePromises = rec.ingredientes.map(item => {
            const ing = ingMap.get(item.ingredienteId);
            if (ing) {
                const nuevoStock = Math.max(0, ing.stockActual - item.cantidad * cant);
                return window.api.updateIngrediente(ing.id, {
                    ...ing,
                    stockActual: nuevoStock,
                });
            }
            return Promise.resolve();
        });
        await Promise.all(updatePromises);

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
