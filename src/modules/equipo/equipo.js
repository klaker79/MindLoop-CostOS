/**
 * Módulo de Equipo (Team Management) - MindLoop CostOS
 * Gestión de usuarios del restaurante
 * 
 * SEGURIDAD: Usa escapeHTML de helpers.js para prevenir XSS
 */

import { getApiUrl } from '../../config/app-config.js';
import { escapeHTML } from '../../utils/helpers.js';
import { sanitizeHTML } from '../../utils/sanitize.js';

const API_BASE = getApiUrl();

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
    };
}


/**
 * Carga y muestra los datos del restaurante en la sección Configuración
 */
function cargarDatosRestaurante() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const nombreEl = document.getElementById('config-restaurante-nombre');
    const idEl = document.getElementById('config-restaurante-id');

    if (nombreEl) nombreEl.textContent = user.restaurante || user.nombre || 'Sin nombre';
    if (idEl) idEl.textContent = user.restauranteId || '—';
}

/**
 * Renderiza la lista de miembros del equipo
 */
export async function renderizarEquipo() {
    // Cargar datos del restaurante
    cargarDatosRestaurante();

    const container = document.getElementById('lista-equipo');
    if (!container) return;

    try {
        const res = await fetch(API_BASE + '/team', { headers: getAuthHeaders() });
        const team = await res.json();

        if (!Array.isArray(team) || team.length === 0) {
            container.innerHTML =
                '<p style="text-align: center; color: #6b7280; padding: 40px;">No hay miembros en el equipo.</p>';
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = user.rol === 'admin';

        // SEGURIDAD: Sanitizar todos los datos de usuario antes de renderizar
        container.innerHTML = team
            .map(
                (m) => {
                    const nombreSafe = escapeHTML(m.nombre || '');
                    const emailSafe = escapeHTML(m.email || '');
                    const rolSafe = escapeHTML(m.rol || 'usuario');
                    const memberId = parseInt(m.id, 10);

                    return `
      <div class="equipo-card" style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div>
          <strong style="font-size: 16px;">${nombreSafe}</strong>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0 0;">${emailSafe}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="background: ${rolSafe === 'admin' ? '#667eea' : '#10b981'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase;">${rolSafe}</span>
          ${isAdmin && memberId !== user.id
                            ? `<button onclick="window.eliminarUsuarioEquipo(${memberId})" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">🗑️</button>`
                            : ''
                        }
        </div>
      </div>
    `;
                }
            )
            .join('');
    } catch (error) {
        console.error('Error cargando equipo:', error);
        container.innerHTML =
            '<p style="text-align: center; color: #ef4444;">Error al cargar el equipo</p>';
    }
}

/**
 * Muestra modal para invitar usuario
 */
export function mostrarModalInvitar() {
    const modal = document.getElementById('modal-invitar-equipo');
    if (modal) modal.classList.add('active');
}

/**
 * Cierra modal de invitación
 */
export function cerrarModalInvitar() {
    const modal = document.getElementById('modal-invitar');
    if (modal) modal.style.display = 'none';
}

/**
 * Invita un nuevo usuario al equipo
 */
export async function invitarUsuarioEquipo() {
    const nombre = document.getElementById('team-nombre')?.value;
    const email = document.getElementById('team-email')?.value;
    const password = document.getElementById('team-password')?.value;
    const rol = document.getElementById('team-rol')?.value || 'usuario';

    if (!nombre || !email || !password) {
        window.showToast?.('Completa todos los campos', 'error');
        return;
    }

    try {
        const res = await fetch(API_BASE + '/team/invite', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ nombre, email, password, rol }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Error al invitar usuario');
        }

        window.showToast?.('Usuario invitado correctamente', 'success');
        cerrarModalInvitar();
        renderizarEquipo();

        // Limpiar formulario
        const form = document.getElementById('form-invitar');
        if (form) form.reset();
    } catch (error) {
        window.showToast?.(error.message, 'error');
    }
}

/**
 * Elimina un usuario del equipo
 */
export async function eliminarUsuarioEquipo(id) {
    if (!confirm('¿Eliminar este usuario del equipo?')) return;

    try {
        const res = await fetch(API_BASE + `/team/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al eliminar');
        }

        window.showToast?.('Usuario eliminado', 'success');
        renderizarEquipo();
    } catch (error) {
        window.showToast?.(error.message, 'error');
    }
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.renderizarEquipo = renderizarEquipo;
    window.mostrarModalInvitar = mostrarModalInvitar;
    window.cerrarModalInvitar = cerrarModalInvitar;
    window.invitarUsuarioEquipo = invitarUsuarioEquipo;
    window.eliminarUsuarioEquipo = eliminarUsuarioEquipo;
}
