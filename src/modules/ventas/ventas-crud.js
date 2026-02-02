/**
 * Ventas CRUD Module
 * Funciones de eliminar ventas
 */

// 🆕 Zustand store para gestión de estado
import saleStore from '../../stores/saleStore.js';

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

