/**
 * Ventas CRUD Module
 * Funciones CRUD para ventas
 */

// 🆕 Zustand store para gestión de estado
import saleStore from '../../stores/saleStore.js';

/**
 * Registra una nueva venta desde el formulario
 */
export async function guardarVenta() {
    const recetaId = document.getElementById('venta-receta')?.value;
    const cantidad = parseInt(document.getElementById('venta-cantidad')?.value) || 1;
    const varianteId = document.getElementById('venta-variante')?.value || null;

    if (!recetaId) {
        window.showToast('Selecciona un plato', 'error');
        return;
    }

    // Obtener precio de la receta
    const receta = (window.recetas || []).find(r => r.id === parseInt(recetaId));
    if (!receta) {
        window.showToast('Receta no encontrada', 'error');
        return;
    }

    const precioUnitario = parseFloat(receta.precio_venta) || 0;
    const total = precioUnitario * cantidad;

    window.showLoading();

    try {
        const store = saleStore.getState();
        const result = await store.createSale({
            receta_id: parseInt(recetaId),
            fecha: new Date().toISOString().split('T')[0],
            cantidad,
            precio_unitario: precioUnitario,
            total,
            variante_id: varianteId ? parseInt(varianteId) : null
        });

        if (!result.success) throw new Error(result.error || 'Error registrando venta');

        // Limpiar formulario
        document.getElementById('venta-cantidad').value = '1';

        await window.renderizarVentas();
        window.hideLoading();
        window.showToast(`Venta registrada: ${cantidad}x ${receta.nombre}`, 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error registrando venta: ' + error.message, 'error');
    }
}

/**
 * Elimina una venta
 */
export async function eliminarVenta(id) {
    if (!confirm('¿Eliminar esta venta?')) return;

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = saleStore.getState();
        const result = await store.deleteSale(id);
        if (!result.success) throw new Error(result.error || 'Error eliminando venta');

        await window.renderizarVentas();
        window.hideLoading();
        window.showToast('Venta eliminada', 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error eliminando venta: ' + error.message, 'error');
    }
}

/**
 * Registra una nueva venta desde el formulario
 */
export async function guardarVenta() {
    const recetaSelect = document.getElementById('venta-receta');
    const cantidadInput = document.getElementById('venta-cantidad');

    if (!recetaSelect || !cantidadInput) {
        console.error('❌ Elementos del formulario no encontrados');
        window.showToast?.('Error: formulario no encontrado', 'error');
        return;
    }

    const recetaId = parseInt(recetaSelect.value);
    const cantidad = parseInt(cantidadInput.value) || 1;

    if (!recetaId || isNaN(recetaId)) {
        window.showToast?.('Selecciona un plato', 'warning');
        return;
    }

    window.showLoading?.();

    try {
        const store = saleStore.getState();
        const result = await store.createSale({
            recetaId: recetaId,
            cantidad: cantidad
        });

        if (!result.success) {
            throw new Error(result.error || 'Error registrando venta');
        }

        // Limpiar formulario
        recetaSelect.value = '';
        cantidadInput.value = '1';

        // Actualizar lista de ventas
        await window.renderizarVentas?.();

        window.hideLoading?.();
        window.showToast?.('✅ Venta registrada', 'success');
    } catch (error) {
        window.hideLoading?.();
        console.error('Error registrando venta:', error);
        window.showToast?.('Error: ' + error.message, 'error');
    }
}

