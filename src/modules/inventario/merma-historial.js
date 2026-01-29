/**
 * Módulo de historial de mermas
 * Extraído de main.js
 * @module modules/inventario/merma-historial
 */

import { escapeHTML } from '../../utils/sanitize.js';
import { formatCurrency, formatDate } from '../../utils/helpers.js';

/**
 * Carga y renderiza el historial de mermas
 * @param {number} mes - Mes (1-12)
 * @param {number} ano - Año
 */
export async function cargarHistorialMermas(mes, ano) {
    const API = window.API;
    if (!API?.getMermas) {
        console.error('API.getMermas no disponible');
        return;
    }

    try {
        const mermas = await API.getMermas(mes, ano);
        renderizarHistorialMermas(mermas);
    } catch (error) {
        console.error('Error cargando historial de mermas:', error);
    }
}

/**
 * Renderiza la tabla de historial de mermas
 * @param {Array} mermas - Lista de mermas
 */
export function renderizarHistorialMermas(mermas) {
    const tbody = document.querySelector('#tabla-historial-mermas tbody');
    if (!tbody) return;

    if (!mermas || mermas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">
                    No hay registros de merma para este período
                </td>
            </tr>
        `;
        return;
    }

    const rows = mermas.map(m => {
        const ingredienteNombre = escapeHTML(m.ingrediente_nombre || 'N/A');
        const motivo = escapeHTML(m.motivo || 'Sin especificar');
        const notas = escapeHTML(m.notas || '-');

        return `
            <tr data-merma-id="${m.id}">
                <td>${ingredienteNombre}</td>
                <td>${formatDate(m.fecha)}</td>
                <td>${m.cantidad?.toFixed(2) || '0.00'} ${escapeHTML(m.unidad || 'kg')}</td>
                <td>${motivo}</td>
                <td>${formatCurrency(m.coste || 0)}</td>
                <td>${notas}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

/**
 * Calcula el total de mermas de un período
 * @param {Array} mermas
 * @returns {Object} Totales
 */
export function calcularTotalesMermas(mermas) {
    if (!mermas || mermas.length === 0) {
        return { cantidad: 0, coste: 0, registros: 0 };
    }

    return mermas.reduce((acc, m) => ({
        cantidad: acc.cantidad + (m.cantidad || 0),
        coste: acc.coste + (m.coste || 0),
        registros: acc.registros + 1
    }), { cantidad: 0, coste: 0, registros: 0 });
}

// Exponer globalmente para compatibilidad legacy
if (typeof window !== 'undefined') {
    window.cargarHistorialMermas = cargarHistorialMermas;
}

export default {
    cargarHistorialMermas,
    renderizarHistorialMermas,
    calcularTotalesMermas
};
