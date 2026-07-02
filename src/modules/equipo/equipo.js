/**
 * Módulo de Equipo (Team Management) - MindLoop CostOS
 * Gestión de usuarios del restaurante
 * 
 * SEGURIDAD: Usa escapeHTML de helpers.js para prevenir XSS
 */

import { getApiUrl } from '../../config/app-config.js';
import { escapeHTML } from '../../utils/helpers.js';
import { sanitizeHTML } from '../../utils/sanitize.js';
import { t } from '@/i18n/index.js';

const API_BASE = getApiUrl();

function getAuthHeaders() {
    // 🔒 SECURITY: Dual-mode auth — cookie + in-memory Bearer (NOT localStorage)
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.authToken : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
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
/**
 * Renderiza el interruptor opt-in de "Comida de Personal".
 * Apagado por defecto. Solo un admin puede cambiarlo. Cuando se activa, aparece
 * la casilla 🍽️ en los pedidos y la pestaña "Comida Personal" en el menú.
 */
export async function renderizarConfigComidaPersonal() {
    const container = document.getElementById('config-comida-personal');
    if (!container) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.rol === 'admin';

    let activa = window.comidaPersonalActiva === true;
    try {
        const res = await fetch(API_BASE + '/restaurant/comida-personal', { headers: getAuthHeaders() });
        if (res.ok) {
            const data = await res.json();
            activa = data?.activa === true;
            window.comidaPersonalActiva = activa;
            window.aplicarGatingComidaPersonal?.();
        }
    } catch (error) {
        console.error('Error cargando config comida personal:', error);
    }

    const desc = escapeHTML(t('comida_personal:settings_desc'));
    const estado = activa
        ? escapeHTML(t('comida_personal:settings_on'))
        : escapeHTML(t('comida_personal:settings_off'));

    const toggle = isAdmin
        ? `<label style="position:relative; display:inline-flex; align-items:center; cursor:pointer; gap:12px;">
             <input type="checkbox" id="toggle-comida-personal" ${activa ? 'checked' : ''}
               onchange="window.toggleComidaPersonal(this.checked)"
               style="width:46px; height:26px; -webkit-appearance:none; appearance:none; background:${activa ? '#7c3aed' : '#cbd5e1'}; border-radius:14px; position:relative; outline:none; cursor:pointer; transition:background .2s;">
             <span id="toggle-comida-personal-estado" style="font-size:14px; font-weight:600; color:${activa ? '#7c3aed' : '#64748b'};">${estado}</span>
           </label>
           <style>#toggle-comida-personal::before{content:'';position:absolute;top:3px;left:${activa ? '23px' : '3px'};width:20px;height:20px;background:#fff;border-radius:50%;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.3);}</style>`
        : `<span style="font-size:14px; font-weight:600; color:${activa ? '#7c3aed' : '#64748b'};">${estado}</span>
           <p style="color:#94a3b8; font-size:12px; margin:6px 0 0 0;">${escapeHTML(t('comida_personal:settings_admin_only'))}</p>`;

    container.innerHTML = `
      <p style="color:#64748b; font-size:14px; margin:0 0 14px 0;">${desc}</p>
      ${toggle}`;
}

/**
 * Cambia el opt-in de comida de personal (solo admin). Persiste en backend y
 * aplica el gating (casilla + pestaña) al instante.
 */
export async function toggleComidaPersonal(activar) {
    try {
        const res = await fetch(API_BASE + '/restaurant/comida-personal', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ activa: activar === true }),
        });
        if (!res.ok) throw new Error('save failed');
        const data = await res.json();
        window.comidaPersonalActiva = data?.activa === true;
        window.aplicarGatingComidaPersonal?.();
        window.showToast?.(
            window.comidaPersonalActiva
                ? t('comida_personal:settings_toast_on')
                : t('comida_personal:settings_toast_off'),
            'success'
        );
    } catch (error) {
        window.showToast?.(t('common:toast_error_api'), 'error');
    }
    // Re-render para reflejar el estado real devuelto por el backend.
    renderizarConfigComidaPersonal();
}

export async function renderizarEquipo() {
    // Cargar datos del restaurante
    cargarDatosRestaurante();
    renderizarConfigComidaPersonal();

    const container = document.getElementById('lista-equipo');
    if (!container) return;

    try {
        const res = await fetch(API_BASE + '/team', { headers: getAuthHeaders() });
        const team = await res.json();

        if (!Array.isArray(team) || team.length === 0) {
            container.innerHTML =
                `<p style="text-align: center; color: #6b7280; padding: 40px;">${t('equipo:empty_no_members')}</p>`;
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
    // Id real: modal-invitar-equipo; se abre con classList.add('active') en
    // mostrarModalInvitar(), así que se cierra quitando esa misma clase
    // (bug auditoría 2026-07-02: apuntaba a 'modal-invitar' + display:none → no-op).
    const modal = document.getElementById('modal-invitar-equipo');
    if (modal) modal.classList.remove('active');
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
        window.showToast?.(t('auth:error_fill_all_fields'), 'error');
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
            throw new Error(data.error || t('equipo:toast_error_inviting', { message: '' }));
        }

        window.showToast?.(t('equipo:toast_invited'), 'success');
        cerrarModalInvitar();
        renderizarEquipo();

        // Limpiar campos (no hay <form> envolvente en el modal, se limpian a mano)
        ['team-nombre', 'team-email', 'team-password'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    } catch (error) {
        window.showToast?.(error.message, 'error');
    }
}

/**
 * Elimina un usuario del equipo
 */
export async function eliminarUsuarioEquipo(id) {
    if (!confirm(t('equipo:confirm_remove'))) return;

    try {
        const res = await fetch(API_BASE + `/team/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al eliminar');
        }

        window.showToast?.(t('equipo:toast_removed'), 'success');
        renderizarEquipo();
    } catch (error) {
        window.showToast?.(error.message, 'error');
    }
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.renderizarEquipo = renderizarEquipo;
    window.renderizarConfigComidaPersonal = renderizarConfigComidaPersonal;
    window.toggleComidaPersonal = toggleComidaPersonal;
    window.mostrarModalInvitar = mostrarModalInvitar;
    window.cerrarModalInvitar = cerrarModalInvitar;
    window.invitarUsuarioEquipo = invitarUsuarioEquipo;
    window.eliminarUsuarioEquipo = eliminarUsuarioEquipo;
}
