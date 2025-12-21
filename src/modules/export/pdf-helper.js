/**
 * Helper para descargar PDF de receta
 * Wrapper que encuentra la receta y llama al generador PDF
 */
export function descargarPDFReceta(recetaId) {
    const receta = window.recetas.find(r => r.id === recetaId);
    if (!receta) {
        window.showToast('Receta no encontrada', 'error');
        return;
    }

    // Llamar al generador PDF
    if (typeof window.generarPDFReceta === 'function') {
        window.generarPDFReceta(receta, window.ingredientes);
        window.showToast('PDF generado correctamente', 'success');
    } else {
        console.error('generarPDFReceta no está disponible');
        window.showToast('Error: Módulo PDF no cargado', 'error');
    }
}

// Exponer globalmente
window.descargarPDFReceta = descargarPDFReceta;
