import { t } from '@/i18n/index.js';

/**
 * Helper para descargar PDF de receta
 * Wrapper que encuentra la receta y llama al generador PDF
 */
export function descargarPDFReceta(recetaId) {
    const receta = window.recetas.find(r => r.id === recetaId);
    if (!receta) {
        window.showToast(t('export:toast_recipe_not_found'), 'error');
        return;
    }

    // Llamar al generador PDF
    if (typeof window.generarPDFReceta === 'function') {
        window.generarPDFReceta(receta, window.ingredientes);
        window.showToast(t('export:toast_pdf_generated'), 'success');
    } else {
        console.error('generarPDFReceta no está disponible');
        window.showToast(t('export:toast_pdf_error'), 'error');
    }
}

// Exponer globalmente
window.descargarPDFReceta = descargarPDFReceta;
