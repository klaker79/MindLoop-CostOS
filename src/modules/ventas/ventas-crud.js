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
