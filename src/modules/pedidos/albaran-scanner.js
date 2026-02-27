/**
 * Albarán Scanner — Escaneo de albaranes con Claude Vision
 * Sube foto/PDF → backend extrae datos con IA → inserta en compras_pendientes
 */
import { t } from '@/i18n/index.js';
import { apiClient } from '../../api/client.js';

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function procesarFotoAlbaran(event) {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    await procesarImagenAlbaran(files[0]);
}

export async function procesarFotoAlbaranInput(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    await procesarImagenAlbaran(file);
    // Reset input para permitir subir el mismo archivo de nuevo
    event.target.value = '';
}

async function procesarImagenAlbaran(file) {
    if (!VALID_TYPES.includes(file.type)) {
        window.showToast?.(t('pedidos:scanner_unsupported_format'), 'warning');
        return;
    }

    if (file.size > MAX_SIZE) {
        window.showToast?.(t('pedidos:scanner_file_too_large'), 'warning');
        return;
    }

    // Mostrar loading
    const contentDiv = document.getElementById('albaran-dropzone-content');
    const loadingDiv = document.getElementById('albaran-dropzone-loading');
    const dropzone = document.getElementById('albaran-dropzone');
    if (contentDiv) contentDiv.style.display = 'none';
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (dropzone) dropzone.style.borderColor = '#3b82f6';

    try {
        const base64Full = await fileToBase64(file);
        const imageBase64 = base64Full.split(',')[1]; // Quitar "data:image/jpeg;base64,"

        const response = await apiClient.post('/parse-albaran', {
            imageBase64,
            mediaType: file.type,
            filename: file.name
        });

        if (!response.success) {
            window.showToast?.(t('pedidos:scanner_error_processing'), 'error');
            resetAlbaranDropzone();
            return;
        }

        const toastMsg = response.proveedor
            ? t('pedidos:scanner_items_detected', { total: response.totalItems, supplier: response.proveedor, matched: response.matched, unmatched: response.unmatched })
            : t('pedidos:scanner_items_detected_no_supplier', { total: response.totalItems, matched: response.matched, unmatched: response.unmatched });
        window.showToast?.(toastMsg, 'success');

        // Refrescar panel de compras pendientes (UI ya existente)
        await window.renderizarComprasPendientes?.();

    } catch (error) {
        console.error('Error procesando albarán:', error);
        window.showToast?.(t('pedidos:scanner_error_generic', { message: error.message || t('pedidos:scanner_error_processing') }), 'error');
    }

    resetAlbaranDropzone();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function resetAlbaranDropzone() {
    const contentDiv = document.getElementById('albaran-dropzone-content');
    const loadingDiv = document.getElementById('albaran-dropzone-loading');
    const dropzone = document.getElementById('albaran-dropzone');
    if (contentDiv) contentDiv.style.display = 'flex';
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (dropzone) {
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = '';
    }
}
