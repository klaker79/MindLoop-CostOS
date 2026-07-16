/**
 * Recibir albarán por foto (Pieza B) — CosteOS móvil.
 *
 * Flujo: botón "Recibir albarán" → cámara nativa del móvil → foto → se reescala y
 * se manda a POST /parse-albaran (Claude Vision, ya activo en staging) → se muestra
 * lo que la IA ha leído. La reconciliación contra el pedido (pre-rellenar el modal
 * de recepción) llega en la Pieza B.2.
 *
 * Solo staging (OCR_ENABLED). En prod el backend devuelve 410 (backstop) → aquí se
 * avisa con un toast, no se rompe nada.
 */

// Reescala la imagen a máx `maxLado` px (lado mayor) y devuelve JPEG base64 (sin el
// prefijo data:). Mantiene la legibilidad para OCR y evita subir 10 MB desde el móvil.
// Usa createImageBitmap para decodificar el fichero directo a bitmap: sin <img> ni
// blob URL, y con `imageOrientation: 'from-image'` endereza la foto girada del móvil.
async function imagenAJpegBase64(file, maxLado = 1600, calidad = 0.85) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
        const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * escala);
        const h = Math.round(bitmap.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', calidad);
        return dataUrl.split(',')[1];
    } finally {
        bitmap.close();
    }
}

async function procesarFotoAlbaran(file) {
    if (!file) return;
    const toast = (m, t) => window.showToast?.(m, t);
    try {
        window.showLoading?.();
        toast('Leyendo el albarán con IA…', 'info');
        const imageBase64 = await imagenAJpegBase64(file);

        const r = await window.API.fetch('/parse-albaran', {
            method: 'POST',
            body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg', filename: file.name || 'albaran.jpg' }),
        });

        window.hideLoading?.();

        if (!r || r.success !== true) {
            toast('No pude leer el albarán. Prueba con mejor luz o mételo a mano.', 'warning');
            return;
        }
        if (r.duplicateWarning) {
            toast('Este albarán ya se había escaneado.', 'warning');
            return;
        }
        const prov = r.proveedor ? ` de ${r.proveedor}` : '';
        toast(`📸 Albarán${prov} leído: ${r.matched}/${r.totalItems} líneas reconocidas · ${r.totalImporte} €. (Reconciliación con el pedido: siguiente paso.)`, 'success');
    } catch (e) {
        window.hideLoading?.();
        // El backstop de prod devuelve 410; cualquier fallo aquí no rompe la app.
        toast('No se pudo procesar el albarán: ' + (e?.message || 'error'), 'error');
    }
}

/** Abre la cámara nativa del móvil (o selector de archivo) para el albarán. */
function iniciarRecepcionFoto() {
    let input = document.getElementById('ml-albaran-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';   // cámara trasera del móvil
        input.id = 'ml-albaran-input';
        input.style.display = 'none';
        input.addEventListener('change', (ev) => {
            const file = ev.target.files && ev.target.files[0];
            ev.target.value = '';           // permite re-elegir la misma foto
            procesarFotoAlbaran(file);
        });
        document.body.appendChild(input);
    }
    input.click();
}

export function initMobileAlbaran() {
    // Sustituye el placeholder de la Pieza A por la cámara real.
    window.mlRecibirAlbaran = iniciarRecepcionFoto;
}
