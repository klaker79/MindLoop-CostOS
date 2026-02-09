/**
 * ============================================
 * compras-pendientes-crud.js
 * ============================================
 * API calls para la cola de revisión de compras
 */

import { apiClient } from '../../api/client.js';

/**
 * Obtener compras pendientes de revisión
 */
export async function fetchComprasPendientes(estado = 'pendiente') {
    return apiClient.get(`/purchases/pending?estado=${estado}`);
}

/**
 * Aprobar un item individual
 */
export async function aprobarItem(id) {
    return apiClient.post(`/purchases/pending/${id}/approve`);
}

/**
 * Aprobar todos los items de un batch (albarán)
 */
export async function aprobarBatch(batchId) {
    return apiClient.post('/purchases/pending/approve-batch', { batchId });
}

/**
 * Editar un item pendiente (cambiar ingrediente, precio, cantidad)
 */
export async function editarItemPendiente(id, data) {
    return apiClient.put(`/purchases/pending/${id}`, data);
}

/**
 * Rechazar/eliminar un item pendiente
 */
export async function rechazarItem(id) {
    return apiClient.delete(`/purchases/pending/${id}`);
}
