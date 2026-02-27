/**
 * Ventas CRUD Module
 * Funciones de eliminar ventas
 */

// 🆕 Zustand store para gestión de estado
import saleStore from '../../stores/saleStore.js';
import { t } from '@/i18n/index.js';

/**
 * Elimina una venta
 */
export async function eliminarVenta(id) {
    if (!confirm(t('ventas:confirm_delete'))) return;

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = saleStore.getState();
        const result = await store.deleteSale(id);
        if (!result.success) throw new Error(result.error || t('ventas:toast_error_deleting', { message: '' }));

        // ⚡ Invalidar caché para forzar reload con datos frescos
        window._ventasCache = null;
        await window.renderizarVentas();
        window.hideLoading();
        window.showToast(t('ventas:toast_deleted'), 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast(t('ventas:toast_error_deleting', { message: error.message }), 'error');
    }
}
