/**
 * Ventas CRUD Module
 * Funciones de eliminar ventas
 */

// 🆕 Zustand store para gestión de estado
import saleStore from '../../stores/saleStore.js';
import { t } from '@/i18n/index.js';

/**
 * Registra una nueva venta desde el formulario
 */
export async function guardarVenta() {
    const recetaId = document.getElementById('venta-receta')?.value;
    const cantidad = parseInt(document.getElementById('venta-cantidad')?.value);

    // Capturar variante seleccionada (copa/botella)
    const varianteSelect = document.getElementById('venta-variante');
    const varianteId = varianteSelect?.value ? parseInt(varianteSelect.value) : null;
    const varianteData = varianteSelect?.selectedOptions?.[0];
    const precioVariante = varianteData?.dataset?.precio ? parseFloat(varianteData.dataset.precio) : null;

    if (!recetaId) {
        window.showToast?.(t('ventas:error_select_dish', 'Selecciona un plato'), 'error');
        return;
    }
    if (!cantidad || cantidad <= 0) {
        window.showToast?.(t('ventas:error_quantity', 'La cantidad debe ser mayor que 0'), 'error');
        return;
    }

    // 🔒 Si la receta tiene variantes (container visible), exigir selección.
    // Guard-rail redundante con el auto-seleccionado en ventas-ui.js — si el
    // usuario borra la selección manualmente, aquí lo atrapamos antes del POST.
    const varianteContainer = document.getElementById('venta-variante-container');
    if (varianteContainer && varianteContainer.style.display !== 'none' && !varianteId) {
        window.showToast?.(
            t('ventas:error_select_variant', 'Esta receta tiene variantes. Selecciona una (ej: copa / botella).'),
            'error'
        );
        return;
    }

    // Anti-doble-click
    const form = document.getElementById('form-venta');
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn?.disabled) return;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳...';
    }

    try {
        const store = saleStore.getState();
        const result = await store.createSale({ recetaId, cantidad, varianteId, precioVariante });
        if (!result.success) throw new Error(result.error || 'Error al registrar venta');

        // Invalidar caché y refrescar UI
        window._ventasCache = null;
        await window.renderizarVentas?.();
        window.actualizarKPIs?.();
        form?.reset();
        window.showToast?.(t('ventas:toast_registered', 'Venta registrada correctamente'), 'success');
    } catch (error) {
        console.error('Error registrando venta:', error);
        window.showToast?.(t('ventas:toast_error_registering', { message: error.message }), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || '✅ Registrar';
        }
    }
}

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
