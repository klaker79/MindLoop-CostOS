/**
 * ============================================
 * transferencias-crud.js
 * ============================================
 * API calls para transferencias inter-restaurante
 */

import { apiClient } from '../../api/client.js';

export async function crearTransferencia(data) {
    return apiClient.post('/transfers', data);
}

export async function getTransferenciasEntrantes() {
    return apiClient.get('/transfers/incoming');
}

export async function getTransferenciasSalientes() {
    return apiClient.get('/transfers/outgoing');
}

export async function getHistorialTransferencias() {
    return apiClient.get('/transfers/history');
}

export async function aprobarTransferencia(id) {
    return apiClient.post(`/transfers/${id}/approve`);
}

export async function rechazarTransferencia(id) {
    return apiClient.post(`/transfers/${id}/reject`);
}

export async function getTransferenciasPendientesCount() {
    return apiClient.get('/transfers/pending-count');
}

export async function getOwnerRestaurants() {
    return apiClient.get('/owner/restaurants');
}
