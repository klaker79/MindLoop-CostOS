/**
 * KPI — Personal Hoy.
 *
 * Carga empleados activos + horarios del día. Marca como "trabajan" los
 * empleados con turno registrado hoy; el resto como "libran".
 * Usa /empleados (filtra por activo=true en backend) y /horarios?desde=hoy&hasta=hoy.
 * Actualiza #personal-hoy-lista.
 */

import { escapeHTML } from '../../../utils/helpers.js';
import { apiClient } from '../../../api/client.js';
import { t } from '@/i18n/index.js';

export async function renderKpiPersonalHoy() {
    const personalHoyEl = document.getElementById('personal-hoy-lista');
    if (!personalHoyEl) return;

    try {
        const hoy = new Date();
        const hoyStr = hoy.toISOString().split('T')[0];

        let empleados = window.empleados || [];
        let horariosHoy = [];

        try {
            if (empleados.length === 0) {
                // Fetch empleados y horarios en paralelo (no hay dependencia)
                const [empResult, horResult] = await Promise.all([
                    apiClient.get('/empleados'),
                    apiClient.get(`/horarios?desde=${hoyStr}&hasta=${hoyStr}`)
                ]);
                empleados = empResult;
                window.empleados = empleados;
                horariosHoy = horResult;
            } else {
                horariosHoy = await apiClient.get(`/horarios?desde=${hoyStr}&hasta=${hoyStr}`);
            }
            // eslint-disable-next-line no-console
            console.log(`📅 Horarios de hoy (${hoyStr}): ${horariosHoy.length}`);
        } catch (e) {
            console.warn('No se pudieron cargar empleados/horarios:', e);
        }

        if (empleados.length === 0) {
            personalHoyEl.innerHTML = `
                <div style="display: flex; gap: 12px;">
                    <div style="flex: 1; text-align: center; padding: 12px; background: linear-gradient(135deg, #F0FDF4, #DCFCE7); border-radius: 10px;">
                        <div style="font-size: 22px; font-weight: 800; color: #10B981;">-</div>
                        <div style="font-size: 11px; color: #059669; font-weight: 600;">${t('dashboard:staff_working')}</div>
                    </div>
                    <div style="flex: 1; text-align: center; padding: 12px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 10px;">
                        <div style="font-size: 22px; font-weight: 800; color: #D97706;">-</div>
                        <div style="font-size: 11px; color: #B45309; font-weight: 600;">${t('dashboard:staff_off')}</div>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 10px; font-size: 11px; color: #94a3b8;">
                    <a href="#" data-tab="horarios" style="color: #8B5CF6; text-decoration: none;">${t('dashboard:link_staff_management')}</a>
                </div>
            `;
            return;
        }

        const empleadosConTurno = new Set(horariosHoy.map(h => h.empleado_id));
        const trabajanHoy = [];
        const libranHoy = [];
        empleados.forEach(emp => {
            if (empleadosConTurno.has(emp.id)) trabajanHoy.push(emp.nombre);
            else libranHoy.push(emp.nombre);
        });

        personalHoyEl.innerHTML = `
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <div style="flex: 1; text-align: center; padding: 8px; background: linear-gradient(135deg, #F0FDF4, #DCFCE7); border-radius: 8px;">
                    <div style="font-size: 20px; font-weight: 800; color: #10B981;">💪 ${trabajanHoy.length}</div>
                    <div style="font-size: 10px; color: #059669; font-weight: 600;">${t('dashboard:staff_working')}</div>
                </div>
                <div style="flex: 1; text-align: center; padding: 8px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 8px;">
                    <div style="font-size: 20px; font-weight: 800; color: #D97706;">🏖️ ${libranHoy.length}</div>
                    <div style="font-size: 10px; color: #B45309; font-weight: 600;">${t('dashboard:staff_off')}</div>
                </div>
            </div>
            <div style="font-size: 11px; max-height: 60px; overflow-y: auto;">
                ${trabajanHoy.length > 0 ? `<div style="color: #059669; margin-bottom: 4px;"><b>${t('dashboard:staff_working')}:</b> ${escapeHTML(trabajanHoy.join(', '))}</div>` : ''}
                ${libranHoy.length > 0 ? `<div style="color: #B45309;"><b>${t('dashboard:staff_off')}:</b> ${escapeHTML(libranHoy.join(', '))}</div>` : ''}
            </div>
        `;
    } catch (e) {
        console.error('Error mostrando personal hoy:', e);
    }
}
