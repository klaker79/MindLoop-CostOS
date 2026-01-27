/**
 * Módulo de Horarios - MindLoop Staff Scheduler
 * Gestión inteligente de horarios y plantilla
 */

import { showToast } from '../../ui/toast.js';
import { getApiUrl } from '../../config/app-config.js';

/**
 * 🔒 Safe JSON parse para evitar crashes con JSON malformado
 */
function safeJSONParse(str, fallback = []) {
    if (!str || str === 'null' || str === 'undefined') return fallback;
    if (typeof str !== 'string') return str;
    try {
        return JSON.parse(str);
    } catch (e) {
        console.warn('⚠️ JSON parse fallido:', e.message);
        return fallback;
    }
}

// Estado global
let empleados = [];
let horarios = [];
let semanaActual = new Date();
let empleadoEditando = null;
let filtroDepartamento = 'todos'; // 'todos', 'cocina', 'sala'

// API Base URL
const API_BASE = getApiUrl();

/**
 * Inicializa el módulo de horarios
 */
export async function initHorarios() {
    console.log('🚀 Inicializando módulo de horarios...');

    // Cargar empleados
    await cargarEmpleados();

    // Cargar horarios de la semana actual
    await cargarHorariosSemana();

    // Renderizar
    renderizarEmpleados();
    renderizarGridHorarios();
    actualizarTextoSemana();

    console.log('✅ Módulo de horarios iniciado');
}

/**
 * Carga empleados desde la API
 */
async function cargarEmpleados() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/empleados`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error cargando empleados');

        empleados = await response.json();
        // Exponer a window para que dashboard pueda acceder
        window.empleados = empleados;
        console.log(`📋 Empleados cargados: ${empleados.length}`);
    } catch (error) {
        console.error('❌ Error cargando empleados:', error);
        showToast('Error cargando empleados: ' + error.message, 'error');
        empleados = [];
        window.empleados = [];
    }
}

/**
 * Carga horarios de una semana
 */
async function cargarHorariosSemana() {
    try {
        const { inicio, fin } = obtenerRangoSemana(semanaActual);
        const desde = formatearFecha(inicio);
        const hasta = formatearFecha(fin);

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/horarios?desde=${desde}&hasta=${hasta}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error cargando horarios');

        horarios = await response.json();
        // Exponer a window para que dashboard pueda acceder
        window.horarios = horarios;
        console.log(`📅 Horarios cargados: ${horarios.length}`);
    } catch (error) {
        console.error('❌ Error cargando horarios:', error);
        showToast('Error cargando horarios: ' + error.message, 'error');
        horarios = [];
        window.horarios = [];
    }
}

/**
 * Renderiza la lista de empleados
 */
function renderizarEmpleados() {
    const container = document.getElementById('lista-empleados');
    if (!container) return;

    if (empleados.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8;">
                <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                <p style="font-size: 16px;">No hay empleados todavía</p>
                <p style="font-size: 14px; color: #cbd5e1;">Añade tu primer empleado para empezar</p>
            </div>
        `;
        return;
    }

    let html = '<div style="display: grid; gap: 12px;">';

    // Filtrar empleados por departamento (nombres hardcodeados)
    const COCINA = ['IKER', 'LAURA', 'FRAN', 'LOLA', 'BEA'];
    const SALA = ['PEROL', 'JUAN', 'LORENA', 'MANU', 'GUILLERMO', 'GUILLE'];

    const empleadosFiltrados = empleados.filter(emp => {
        if (filtroDepartamento === 'todos') return true;
        const nombre = (emp.nombre || '').toUpperCase();
        if (filtroDepartamento === 'cocina') {
            return COCINA.includes(nombre);
        }
        if (filtroDepartamento === 'sala') {
            return SALA.includes(nombre);
        }
        return true;
    });

    empleadosFiltrados.forEach(emp => {
        const horasSemanales = calcularHorasSemanales(emp.id);
        const colorBorde = emp.color || '#667eea';

        html += `
            <div style="background: white; border-left: 4px solid ${colorBorde}; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: all 0.2s; cursor: pointer; display: grid; grid-template-columns: auto 1fr auto auto; gap: 16px; align-items: center;"
                onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)';"
                onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)';">

                <!-- Avatar con color -->
                <div style="width: 48px; height: 48px; border-radius: 50%; background: ${colorBorde}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 18px;">
                    ${emp.nombre.charAt(0).toUpperCase()}
                </div>

                <!-- Info -->
                <div>
                    <div style="font-weight: 700; font-size: 16px; color: #1e293b; margin-bottom: 4px;">
                        ${emp.nombre}
                    </div>
                    <div style="font-size: 13px; color: #64748b; display: flex; gap: 12px; flex-wrap: wrap;">
                        <span>${obtenerEmojiPuesto(emp.puesto)} ${emp.puesto}</span>
                        <span>⏱️ ${horasSemanales}h/${emp.horas_contrato || 40}h</span>
                    </div>
                </div>

                <!-- Días libres de esta semana -->
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${renderizarDiasLibresSemana(emp.id)}
                </div>

                <!-- Botones -->
                <div style="display: flex; gap: 8px;">
                    <button class="icon-btn" onclick="window.editarEmpleado(${emp.id})" title="Editar"
                        style="width: 36px; height: 36px; border-radius: 8px; border: 2px solid #e2e8f0; background: white; color: #667eea; font-size: 16px; cursor: pointer; transition: all 0.2s;"
                        onmouseenter="this.style.background='#667eea'; this.style.color='white';"
                        onmouseleave="this.style.background='white'; this.style.color='#667eea';">
                        ✏️
                    </button>
                    <button class="icon-btn" onclick="window.eliminarEmpleado(${emp.id})" title="Eliminar"
                        style="width: 36px; height: 36px; border-radius: 8px; border: 2px solid #e2e8f0; background: white; color: #ef4444; font-size: 16px; cursor: pointer; transition: all 0.2s;"
                        onmouseenter="this.style.background='#ef4444'; this.style.color='white';"
                        onmouseleave="this.style.background='white'; this.style.color='#ef4444';">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Renderiza días libres como badges
 */
function renderizarDiasLibres(diasLibres) {
    if (!diasLibres || diasLibres.length === 0) return '<span style="font-size: 12px; color: #cbd5e1;">Sin días libres</span>';

    const dias = typeof diasLibres === 'string' ? safeJSONParse(diasLibres, []) : diasLibres;
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return dias.map(d => {
        return `<span style="background: #f1f5f9; color: #64748b; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${nombresDias[d]}</span>`;
    }).join('');
}

/**
 * Renderiza días libres de la semana actual (basado en el grid, no en días fijos)
 */
function renderizarDiasLibresSemana(empleadoId) {
    const { inicio } = obtenerRangoSemana(semanaActual);
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const diasLibres = [];

    // Solo Lunes a Sábado (6 días, sin domingo)
    for (let i = 0; i < 6; i++) {
        const fecha = new Date(inicio);
        fecha.setDate(fecha.getDate() + i);
        const fechaStr = formatearFecha(fecha);
        const turno = horarios.find(h => {
            const fechaH = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha;
            return h.empleado_id === empleadoId && fechaH === fechaStr;
        });

        // Si no tiene turno este día, es día libre
        if (!turno) {
            diasLibres.push(nombresDias[fecha.getDay()]);
        }
    }

    if (diasLibres.length === 0) {
        return '<span style="font-size: 12px; color: #cbd5e1;">Sin días libres</span>';
    }

    return diasLibres.map(d => {
        return `<span style="background: #fef2f2; color: #ef4444; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${d}</span>`;
    }).join('');
}

/**
 * Calcula las horas trabajadas en la semana por un empleado
 */
function calcularHorasSemanales(empleadoId) {
    const turnosEmpleado = horarios.filter(h => h.empleado_id === empleadoId);
    let totalHoras = 0;

    turnosEmpleado.forEach(turno => {
        if (turno.hora_inicio && turno.hora_fin) {
            const [hIni, mIni] = turno.hora_inicio.split(':').map(Number);
            const [hFin, mFin] = turno.hora_fin.split(':').map(Number);
            const minutos = (hFin * 60 + mFin) - (hIni * 60 + mIni);
            totalHoras += minutos / 60;
        }
    });

    return totalHoras.toFixed(1);
}

/**
 * Renderiza el grid de horarios
 */
function renderizarGridHorarios() {
    const container = document.getElementById('grid-horarios');
    if (!container) return;

    if (empleados.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #94a3b8;">
                <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
                <p style="font-size: 16px;">Añade empleados para ver el horario</p>
            </div>
        `;
        return;
    }

    const { inicio } = obtenerRangoSemana(semanaActual);
    const dias = [];
    // Solo Lunes a Sábado (6 días, sin domingo)
    for (let i = 0; i < 6; i++) {
        const fecha = new Date(inicio);
        fecha.setDate(fecha.getDate() + i);
        dias.push(fecha);
    }

    // Pestañas de filtro por departamento
    let html = `
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button onclick="window.filtrarDepartamento('todos')" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${filtroDepartamento === 'todos' ? 'background: #667eea; color: white; border: none;' : 'background: white; color: #64748b; border: 2px solid #e2e8f0;'}">
                👥 TODOS
            </button>
            <button onclick="window.filtrarDepartamento('cocina')" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${filtroDepartamento === 'cocina' ? 'background: #f97316; color: white; border: none;' : 'background: white; color: #64748b; border: 2px solid #e2e8f0;'}">
                🍳 COCINA
            </button>
            <button onclick="window.filtrarDepartamento('sala')" style="padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${filtroDepartamento === 'sala' ? 'background: #22c55e; color: white; border: none;' : 'background: white; color: #64748b; border: 2px solid #e2e8f0;'}">
                🍽️ SALA
            </button>
        </div>
    `;

    // Crear tabla
    html += '<table style="width: 100%; border-collapse: separate; border-spacing: 0;">';

    // Header con días
    html += '<thead><tr style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">';
    html += '<th style="padding: 16px; text-align: left; font-weight: 700; color: #1e293b; border-bottom: 2px solid #e2e8f0; position: sticky; left: 0; background: #f8fafc; z-index: 2; min-width: 180px;">Empleado</th>';

    dias.forEach(dia => {
        const nombreDia = dia.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
        const numeroDia = dia.getDate();
        const esHoy = esHoyFecha(dia);

        html += `
            <th style="padding: 16px; text-align: center; font-weight: 700; color: ${esHoy ? '#667eea' : '#1e293b'}; border-bottom: 2px solid ${esHoy ? '#667eea' : '#e2e8f0'}; min-width: 140px;">
                <div style="font-size: 12px; color: ${esHoy ? '#667eea' : '#64748b'};">${nombreDia}</div>
                <div style="font-size: 18px; margin-top: 4px;">${numeroDia}</div>
            </th>
        `;
    });

    html += '</tr></thead><tbody>';

    // Filtrar empleados por departamento (nombres hardcodeados)
    const COCINA = ['IKER', 'LAURA', 'FRAN', 'LOLA', 'BEA'];
    const SALA = ['PEROL', 'JUAN', 'LORENA', 'MANU', 'GUILLERMO', 'GUILLE'];

    const empleadosFiltrados = empleados.filter(emp => {
        if (filtroDepartamento === 'todos') return true;
        const nombre = (emp.nombre || '').toUpperCase();
        if (filtroDepartamento === 'cocina') {
            return COCINA.includes(nombre);
        }
        if (filtroDepartamento === 'sala') {
            return SALA.includes(nombre);
        }
        return true;
    });

    // Filas de empleados
    empleadosFiltrados.forEach((emp, index) => {
        const bgColor = index % 2 === 0 ? 'white' : '#fafbfc';
        html += `<tr style="background: ${bgColor}; transition: all 0.2s;" onmouseenter="this.style.background='#f8fafc';" onmouseleave="this.style.background='${bgColor}';">`;

        // Celda empleado
        html += `
            <td style="padding: 12px 16px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9; position: sticky; left: 0; background: ${bgColor}; z-index: 1;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${emp.color || '#667eea'}; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 700;">
                        ${emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <span>${emp.nombre}</span>
                </div>
            </td>
        `;

        // Celdas de turnos
        dias.forEach(dia => {
            const fechaStr = formatearFecha(dia);
            // Normalizar la fecha del horario al comparar (puede venir como ISO con T)
            const turno = horarios.find(h => {
                const fechaH = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha;
                return h.empleado_id === emp.id && fechaH === fechaStr;
            });
            const esDiaLibre = esDiaLibreFijo(emp.dias_libres_fijos, dia.getDay());
            const esHoy = esHoyFecha(dia);

            html += `<td style="padding: 8px; text-align: center; border-bottom: 1px solid #f1f5f9; ${esHoy ? 'background: #f0f4ff;' : ''}">`;

            if (esDiaLibre) {
                // Día libre fijo del empleado - NO se puede cambiar
                html += '<div style="padding: 16px 12px; background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; color: #ef4444; font-size: 14px; font-weight: 700; cursor: not-allowed;">LIBRE</div>';
            } else if (turno) {
                // TRABAJA - mostrar A CURRAR (verde) - clic para quitar
                html += `
                    <div onclick="window.toggleTurno(${emp.id}, '${fechaStr}')" style="padding: 16px 12px; background: #dcfce7; border: 2px solid #86efac; border-radius: 8px; cursor: pointer; transition: all 0.2s; color: #166534; font-size: 13px; font-weight: 700;" onmouseenter="this.style.transform='scale(1.05)'; this.style.background='#bbf7d0';" onmouseleave="this.style.transform='scale(1)'; this.style.background='#dcfce7';">
                        💪 A CURRAR
                    </div>
                `;
            } else {
                // NO TRABAJA - mostrar LIBRE (rojo claro) - clic para añadir
                html += `<div onclick="window.toggleTurno(${emp.id}, '${fechaStr}')" style="padding: 16px 12px; background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 8px; cursor: pointer; transition: all 0.2s; color: #ef4444; font-size: 13px; font-weight: 700;" onmouseenter="this.style.borderColor='#f87171'; this.style.background='#fee2e2';" onmouseleave="this.style.borderColor='#fca5a5'; this.style.background='#fef2f2';">LIBRE</div>`;
            }

            html += '</td>';
        });

        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Muestra modal para nuevo empleado
 */
window.nuevoEmpleado = function () {
    empleadoEditando = null;

    // Resetear formulario
    document.getElementById('empleado-nombre').value = '';
    document.getElementById('empleado-color').value = generarColorAleatorio();
    document.getElementById('empleado-puesto').value = 'cocina';
    document.getElementById('empleado-horas-contrato').value = '40';

    // Desmarcar checkboxes
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(dia => {
        const checkbox = document.getElementById(`libre-${dia}`);
        if (checkbox) checkbox.checked = false;
    });

    // Cambiar título
    document.getElementById('modal-empleado-titulo').innerHTML = '<span style="font-size: 28px;">👤</span> Nuevo Empleado';
    document.getElementById('btn-guardar-empleado-text').textContent = 'Guardar';

    // Mostrar modal centrado
    const modal = document.getElementById('modal-empleado');
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.style.zIndex = '10000';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

};

/**
 * Edita un empleado
 */
window.editarEmpleado = async function (id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;

    empleadoEditando = emp;

    // Rellenar formulario
    document.getElementById('empleado-nombre').value = emp.nombre;
    document.getElementById('empleado-color').value = emp.color || '#667eea';
    document.getElementById('empleado-puesto').value = emp.puesto || 'cocina';
    document.getElementById('empleado-horas-contrato').value = emp.horas_contrato || '40';

    // Marcar días libres
    const diasLibres = typeof emp.dias_libres_fijos === 'string' ? safeJSONParse(emp.dias_libres_fijos, []) : (emp.dias_libres_fijos || []);
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(dia => {
        const checkbox = document.getElementById(`libre-${dia}`);
        if (checkbox) {
            checkbox.checked = diasLibres.includes(parseInt(checkbox.value));
        }
    });

    // Cambiar título
    document.getElementById('modal-empleado-titulo').innerHTML = '<span style="font-size: 28px;">✏️</span> Editar Empleado';
    document.getElementById('btn-guardar-empleado-text').textContent = 'Actualizar';

    // Mostrar modal centrado
    const modal = document.getElementById('modal-empleado');
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.style.zIndex = '10000';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

};

/**
 * Guarda empleado (crear o actualizar)
 */
window.guardarEmpleado = async function () {
    const nombre = document.getElementById('empleado-nombre').value.trim();
    const color = document.getElementById('empleado-color').value;
    const puesto = document.getElementById('empleado-puesto').value;
    const horasContrato = parseInt(document.getElementById('empleado-horas-contrato').value) || 40;

    // Validar
    if (!nombre) {
        showToast('El nombre es obligatorio', 'error');
        return;
    }

    // Obtener días libres seleccionados
    const diasLibres = [];
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(dia => {
        const checkbox = document.getElementById(`libre-${dia}`);
        if (checkbox && checkbox.checked) {
            diasLibres.push(parseInt(checkbox.value));
        }
    });

    const empleado = {
        nombre,
        color,
        puesto,
        horas_contrato: horasContrato,
        dias_libres_fijos: JSON.stringify(diasLibres),
        activo: true
    };

    try {
        const token = localStorage.getItem('token');
        let response;

        if (empleadoEditando) {
            // Actualizar
            response = await fetch(`${API_BASE}/empleados/${empleadoEditando.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(empleado)
            });
        } else {
            // Crear
            response = await fetch(`${API_BASE}/empleados`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(empleado)
            });
        }

        if (!response.ok) throw new Error('Error guardando empleado');

        showToast(empleadoEditando ? 'Empleado actualizado' : 'Empleado creado', 'success');

        // Recargar y cerrar
        await cargarEmpleados();
        renderizarEmpleados();
        renderizarGridHorarios();
        cerrarModalEmpleado();

    } catch (error) {
        console.error('Error guardando empleado:', error);
        showToast('Error guardando empleado: ' + error.message, 'error');
    }
};

/**
 * Elimina un empleado
 */
window.eliminarEmpleado = async function (id) {
    if (!confirm('¿Eliminar este empleado?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/empleados/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error eliminando empleado');

        showToast('Empleado eliminado', 'success');

        await cargarEmpleados();
        renderizarEmpleados();
        renderizarGridHorarios();

    } catch (error) {
        console.error('Error eliminando empleado:', error);
        showToast('Error eliminando empleado: ' + error.message, 'error');
    }
};

/**
 * Cierra modal empleado
 */
window.cerrarModalEmpleado = function () {
    document.getElementById('modal-empleado').classList.remove('active');
    document.getElementById('modal-empleado').style.display = 'none';
    empleadoEditando = null;
};

/**
 * Toggle turno (asignar/quitar)
 */
window.toggleTurno = async function (empleadoId, fecha) {
    const emp = empleados.find(e => e.id === empleadoId);
    if (!emp) return;

    // Verificar si es día libre fijo
    const fechaObj = new Date(fecha + 'T00:00:00');
    if (esDiaLibreFijo(emp.dias_libres_fijos, fechaObj.getDay())) {
        showToast('Este es un día libre fijo del empleado', 'warning');
        return;
    }

    // Buscar turno existente (normalizar fecha ISO)
    const turnoExistente = horarios.find(h => {
        const fechaH = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha;
        return h.empleado_id === empleadoId && fechaH === fecha;
    });

    if (turnoExistente) {
        // Quitar turno
        await quitarTurno(empleadoId, fecha);
    } else {
        // Asignar turno (popup para elegir horario)
        await asignarTurno(empleadoId, fecha);
    }
};

/**
 * Asigna un turno
 */
async function asignarTurno(empleadoId, fecha) {
    // TODO: Mostrar popup para elegir turno (mañana/tarde/noche) y horarios
    // Por ahora asignamos turno de mañana por defecto
    const turno = {
        empleado_id: empleadoId,
        fecha,
        turno: 'mañana',
        hora_inicio: '09:00',
        hora_fin: '17:00',
        es_extra: false
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/horarios`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(turno)
        });

        if (!response.ok) throw new Error('Error asignando turno');

        await cargarHorariosSemana();
        renderizarGridHorarios();

    } catch (error) {
        console.error('Error asignando turno:', error);
        showToast('Error asignando turno: ' + error.message, 'error');
    }
}

/**
 * Quita un turno
 */
async function quitarTurno(empleadoId, fecha) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/horarios/empleado/${empleadoId}/fecha/${fecha}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error quitando turno');

        await cargarHorariosSemana();
        renderizarGridHorarios();

    } catch (error) {
        console.error('Error quitando turno:', error);
        showToast('Error quitando turno: ' + error.message, 'error');
    }
}

/**
 * Navegar a semana anterior
 */
window.semanaAnterior = function () {
    semanaActual.setDate(semanaActual.getDate() - 7);
    cargarHorariosSemana().then(() => {
        renderizarGridHorarios();
        actualizarTextoSemana();
    });
};

/**
 * Navegar a semana siguiente
 */
window.semanaSiguiente = function () {
    semanaActual.setDate(semanaActual.getDate() + 7);
    cargarHorariosSemana().then(() => {
        renderizarGridHorarios();
        actualizarTextoSemana();
    });
};

/**
 * Filtrar por departamento (TODOS/COCINA/SALA)
 */
window.filtrarDepartamento = function (departamento) {
    filtroDepartamento = departamento;
    renderizarGridHorarios();
    renderizarEmpleados();
};

/**
 * Borrar TODOS los horarios (limpieza masiva)
 */
window.borrarTodosHorarios = async function () {
    if (!confirm('⚠️ ¿BORRAR TODOS LOS HORARIOS?\n\nEsto eliminará TODOS los turnos de TODAS las semanas.\nLos empleados se mantienen.\n\n¿Continuar?')) return;
    if (!confirm('🔴 CONFIRMACIÓN FINAL\n\n¿Estás SEGURO de borrar todos los horarios?')) return;

    try {
        showToast('🗑️ Borrando todos los horarios...', 'info');

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/horarios/all`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error al borrar horarios');

        const result = await response.json();
        showToast(`✅ ${result.deleted || 0} horarios eliminados`, 'success');

        await cargarHorariosSemana();
        renderizarGridHorarios();
        renderizarEmpleados();

    } catch (error) {
        console.error('Error borrando horarios:', error);
        showToast('Error borrando horarios: ' + error.message, 'error');
    }
};

/**
 * Copiar semana anterior
 */
window.copiarSemana = async function () {
    if (!confirm('¿Copiar los turnos de la semana anterior a esta semana?\n\nEsto añadirá los turnos de la semana pasada a esta semana.')) return;

    try {
        showToast('📋 Copiando turnos...', 'info');

        const token = localStorage.getItem('token');

        // Obtener semana anterior
        const semanaAnterior = new Date(semanaActual);
        semanaAnterior.setDate(semanaAnterior.getDate() - 7);
        const { inicio: inicioAnterior, fin: finAnterior } = obtenerRangoSemana(semanaAnterior);

        // Cargar horarios de la semana anterior
        const desde = formatearFecha(inicioAnterior);
        const hasta = formatearFecha(finAnterior);

        const response = await fetch(`${API_BASE}/horarios?desde=${desde}&hasta=${hasta}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error cargando semana anterior');

        const horariosAnteriores = await response.json();

        if (horariosAnteriores.length === 0) {
            showToast('⚠️ No hay turnos en la semana anterior para copiar', 'warning');
            return;
        }

        // Copiar cada turno a la semana actual (sumar 7 días)
        let copiados = 0;
        for (const horario of horariosAnteriores) {
            const fechaOriginal = new Date(horario.fecha);
            fechaOriginal.setDate(fechaOriginal.getDate() + 7);
            const nuevaFecha = formatearFecha(fechaOriginal);

            const nuevoTurno = {
                empleado_id: horario.empleado_id,
                fecha: nuevaFecha,
                turno: horario.turno || 'mañana',
                hora_inicio: horario.hora_inicio || '10:00',
                hora_fin: horario.hora_fin || '18:00',
                es_extra: horario.es_extra || false
            };

            try {
                const resp = await fetch(`${API_BASE}/horarios`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(nuevoTurno)
                });
                if (resp.ok) copiados++;
            } catch (e) {
                // Ignorar duplicados
            }
        }

        showToast(`✅ ${copiados} turnos copiados`, 'success');

        await cargarHorariosSemana();
        renderizarGridHorarios();
        renderizarEmpleados();

    } catch (error) {
        console.error('Error copiando semana:', error);
        showToast('Error copiando semana: ' + error.message, 'error');
    }
};

/**
 * Generador de horarios con IA
 */
window.generarHorarioIA = async function () {
    if (empleados.length === 0) {
        showToast('Añade empleados primero', 'warning');
        return;
    }

    const accion = confirm('¿Generar horario automático con IA?\n\n✅ Aceptar = BORRAR semana actual y generar desde cero\n\nReglas aplicadas:\n- Bea: Mié+Jue libres\n- Fran/Lola: Sab+Dom libres\n- Laura: Lun+Mar libres\n- Iker: Dom + 2 días entre semana\n- Javi: Solo sábados\n- Fran: 11:30-19:30\n- Resto: 10:00-18:00');

    if (!accion) return;

    showToast('🗑️ Borrando turnos existentes...', 'info');

    try {
        const { inicio, fin } = obtenerRangoSemana(semanaActual);
        const token = localStorage.getItem('token');

        // PASO 1: Borrar todos los turnos de la semana actual
        for (const horario of horarios) {
            try {
                const fechaH = horario.fecha.includes('T') ? horario.fecha.split('T')[0] : horario.fecha;
                await fetch(`${API_BASE}/horarios/empleado/${horario.empleado_id}/fecha/${fechaH}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (e) {
                // Ignorar errores individuales
            }
        }

        showToast('⚡ Generando horario inteligente...', 'info');

        // PASO 2: Generar nuevos turnos (pasando array vacío porque borramos todo)
        const turnosNuevos = await generarHorarioInteligente(empleados, inicio, fin, []);

        if (turnosNuevos.length === 0) {
            showToast('⚠️ No se generaron turnos', 'warning');
            await cargarHorariosSemana();
            renderizarGridHorarios();
            return;
        }

        // PASO 3: Guardar todos los turnos nuevos
        let turnosCreados = 0;

        for (const turno of turnosNuevos) {
            try {
                const response = await fetch(`${API_BASE}/horarios`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(turno)
                });
                if (response.ok) turnosCreados++;
            } catch (e) {
                // Ignorar duplicados
            }
        }

        showToast(`✅ ${turnosCreados} turnos generados`, 'success');

        await cargarHorariosSemana();
        renderizarGridHorarios();
        renderizarEmpleados();

    } catch (error) {
        console.error('Error generando horario:', error);
        showToast('Error generando horario: ' + error.message, 'error');
    }
};

/**
 * Algoritmo de generación inteligente de horarios
 * Reglas:
 * 1. Respeta turnos ya asignados manualmente
 * 2. Respeta días libres fijos de cada empleado
 * 3. Cada empleado tiene 2 días libres consecutivos por semana
 * 4. Domingos: rotación (no todos, alternando semanas)
 * 5. Turno estándar: mañana (09:00-17:00) 
 */
async function generarHorarioInteligente(empleados, fechaInicio, fechaFin, horariosExistentes) {
    const turnosNuevos = [];

    // Obtener días de la semana
    const dias = [];
    const fecha = new Date(fechaInicio);
    while (fecha <= fechaFin) {
        dias.push({
            fecha: new Date(fecha),
            fechaStr: formatearFecha(fecha),
            diaSemana: fecha.getDay() // 0=Dom, 1=Lun...6=Sab
        });
        fecha.setDate(fecha.getDate() + 1);
    }

    // Para cada empleado
    empleados.forEach((emp, empIndex) => {
        console.log(`🤖 Procesando empleado: ${emp.nombre} (id: ${emp.id})`);

        // Obtener días libres fijos del empleado
        const diasLibresFijos = typeof emp.dias_libres_fijos === 'string'
            ? safeJSONParse(emp.dias_libres_fijos, [])
            : (emp.dias_libres_fijos || []);

        console.log(`   Días libres fijos: ${JSON.stringify(diasLibresFijos)}`);

        // Contar turnos que ya tiene esta semana
        const turnosExistentes = horariosExistentes.filter(h => h.empleado_id === emp.id);
        // Normalizar fechas: quitar hora si viene en formato ISO
        const diasConTurno = turnosExistentes.map(t => {
            const fecha = t.fecha;
            // Si viene como '2026-01-05T00:00:00.000Z', extraer solo la fecha
            return fecha.includes('T') ? fecha.split('T')[0] : fecha;
        });

        console.log(`   Turnos existentes: ${diasConTurno.length} días`, diasConTurno);

        // ============================================
        // REGLAS DE NEGOCIO POR EMPLEADO
        // Reglas preferidas (flexibles, basadas en patrones reales)
        // ============================================
        const nombreLower = emp.nombre.toLowerCase();
        let diasLibresPreferidos = [];
        let soloSabados = false;
        let siempreLibraDomingo = false;
        let libraSabadoDomingo = false;

        // Calcular número de semana para rotación de domingos
        const semanaN = Math.floor(fechaInicio.getTime() / (7 * 24 * 60 * 60 * 1000));
        // Rotación de domingos: alternamos por empleado + semana
        const trabajaDomingoEstaSemana = (empIndex + semanaN) % 2 === 0;

        // JAVI: Solo viene sábados
        if (nombreLower.includes('javi')) {
            soloSabados = true;
            diasLibresPreferidos = [0, 1, 2, 3, 4, 5]; // Todo menos sábado (6)
        }
        // IKER: Siempre libra domingo + 2 días entre semana (rotativos)
        else if (nombreLower.includes('iker')) {
            siempreLibraDomingo = true;
            const diasEntreSemana = [[1, 2], [2, 3], [3, 4], [4, 5]];
            const pareja = diasEntreSemana[semanaN % diasEntreSemana.length];
            diasLibresPreferidos = [0, ...pareja]; // Domingo + 2 días entre semana
        }
        // FRAN: SIEMPRE libra Sab+Dom
        else if (nombreLower.includes('fran')) {
            libraSabadoDomingo = true;
            diasLibresPreferidos = [0, 6]; // Dom, Sab
        }
        // LOLA: SIEMPRE libra Sab+Dom
        else if (nombreLower.includes('lola')) {
            libraSabadoDomingo = true;
            diasLibresPreferidos = [0, 6]; // Dom, Sab
        }
        // BEA: Libra Mié+Jue + rotación domingos
        else if (nombreLower.includes('bea')) {
            diasLibresPreferidos = [3, 4]; // Mié, Jue
            // Domingos: trabaja uno sí, uno no
            if (!trabajaDomingoEstaSemana) {
                diasLibresPreferidos.push(0); // Este domingo libra
            }
        }
        // LAURA: Libra Lun+Mar + rotación domingos
        else if (nombreLower.includes('laura')) {
            diasLibresPreferidos = [1, 2]; // Lun, Mar
            // Domingos: trabaja uno sí, uno no
            if (!trabajaDomingoEstaSemana) {
                diasLibresPreferidos.push(0); // Este domingo libra
            }
        }
        // Otros: usar días libres fijos si los tiene, o rotar
        else {
            if (diasLibresFijos.length >= 2) {
                diasLibresPreferidos = [...diasLibresFijos];
            } else {
                // Rotación por índice
                const patrones = [[1, 2], [2, 3], [3, 4], [4, 5]];
                diasLibresPreferidos = patrones[empIndex % patrones.length];
            }
            // Domingos: trabaja uno sí, uno no
            if (!trabajaDomingoEstaSemana) {
                diasLibresPreferidos.push(0);
            }
        }

        console.log(`   Días libres preferidos: ${diasLibresPreferidos} (0=Dom, 1=Lun...6=Sab)`);
        console.log(`   Trabaja domingo esta semana: ${trabajaDomingoEstaSemana}`);

        // Asignar turnos a días disponibles
        dias.forEach(dia => {
            // Verificar si ya tiene turno este día
            if (diasConTurno.includes(dia.fechaStr)) return;

            // JAVI: Solo viene sábados
            if (soloSabados && dia.diaSemana !== 6) return;

            // Verificar si es día libre fijo (de la ficha del empleado)
            if (diasLibresFijos.includes(dia.diaSemana)) return;

            // Aplicar días libres preferidos
            if (diasLibresPreferidos.includes(dia.diaSemana)) return;

            // Horario según empleado
            let horaInicio = '10:00';
            let horaFin = '18:00';

            // FRAN: Entra a las 11:30
            if (nombreLower.includes('fran')) {
                horaInicio = '11:30';
                horaFin = '19:30';
            }

            // Añadir turno
            turnosNuevos.push({
                empleado_id: emp.id,
                fecha: dia.fechaStr,
                turno: 'mañana',
                hora_inicio: horaInicio,
                hora_fin: horaFin,
                es_extra: false
            });
        });
    });

    console.log(`🤖 Total turnos a generar: ${turnosNuevos.length}`);
    return turnosNuevos;
}


/**
 * Actualiza texto de la semana actual
 */
function actualizarTextoSemana() {
    const { inicio, fin } = obtenerRangoSemana(semanaActual);
    const textoSemana = `${inicio.getDate()}/${inicio.getMonth() + 1} - ${fin.getDate()}/${fin.getMonth() + 1}/${fin.getFullYear()}`;

    const el = document.getElementById('semana-actual');
    if (el) el.textContent = textoSemana;
}

/**
 * Obtiene el rango de fechas de una semana (lunes a domingo)
 */
function obtenerRangoSemana(fecha) {
    const d = new Date(fecha);
    const dia = d.getDay();
    const diff = d.getDate() - dia + (dia === 0 ? -6 : 1); // Ajustar para que empiece en lunes

    const inicio = new Date(d.setDate(diff));
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);

    return { inicio, fin };
}

/**
 * Formatea fecha como YYYY-MM-DD
 */
function formatearFecha(fecha) {
    const d = new Date(fecha);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Verifica si es un día libre fijo
 */
function esDiaLibreFijo(diasLibres, diaSemana) {
    if (!diasLibres || diasLibres.length === 0) return false;
    const dias = typeof diasLibres === 'string' ? safeJSONParse(diasLibres, []) : diasLibres;
    return dias.includes(diaSemana);
}

/**
 * Verifica si es hoy
 */
function esHoyFecha(fecha) {
    const hoy = new Date();
    return fecha.getDate() === hoy.getDate() &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getFullYear() === hoy.getFullYear();
}

/**
 * Genera color aleatorio
 */
function generarColorAleatorio() {
    const colores = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57', '#48dbfb'];
    return colores[Math.floor(Math.random() * colores.length)];
}

/**
 * Obtiene emoji según puesto
 */
function obtenerEmojiPuesto(puesto) {
    const emojis = {
        'cocina': '👨‍🍳',
        'sala': '🍽️'
    };
    return emojis[puesto?.toLowerCase()] || '👤';
}

/**
 * Descarga el horario mensual como documento HTML/PDF
 */
window.descargarHorarioMensual = async function () {
    showToast('📥 Generando documento...', 'info');

    try {
        const token = localStorage.getItem('token');

        // Obtener el mes actual basado en semanaActual
        const mesActual = semanaActual.getMonth();
        const anioActual = semanaActual.getFullYear();

        // Primer día del mes
        const primerDia = new Date(anioActual, mesActual, 1);
        // Último día del mes
        const ultimoDia = new Date(anioActual, mesActual + 1, 0);

        // Cargar horarios del mes completo
        const desde = formatearFecha(primerDia);
        const hasta = formatearFecha(ultimoDia);

        const response = await fetch(`${API_BASE}/horarios?desde=${desde}&hasta=${hasta}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error cargando horarios del mes');

        const horariosMes = await response.json();

        // Nombres de meses en español
        const nombresMeses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

        // Colores por empleado
        const coloresEmpleados = {
            'bea': '#FFD700',      // Naranja/Amarillo
            'iker': '#87CEEB',     // Azul claro
            'fran': '#FF6B6B',     // Rojo
            'lola': '#FF69B4',     // Rosa
            'laura': '#FFEB3B',    // Amarillo
            'javi': '#B0B0B0'      // Gris
        };

        // Generar semanas del mes
        const semanas = [];
        let fechaInicio = new Date(primerDia);

        // Ajustar al lunes anterior si el mes no empieza en lunes
        while (fechaInicio.getDay() !== 1) {
            fechaInicio.setDate(fechaInicio.getDate() - 1);
        }

        while (fechaInicio <= ultimoDia || fechaInicio.getMonth() === mesActual) {
            const semana = [];
            for (let i = 0; i < 6; i++) { // Lunes a Sábado (sin domingo en el formato original)
                semana.push(new Date(fechaInicio));
                fechaInicio.setDate(fechaInicio.getDate() + 1);
            }
            // Saltar domingo
            fechaInicio.setDate(fechaInicio.getDate() + 1);
            semanas.push(semana);

            if (fechaInicio > ultimoDia && fechaInicio.getMonth() !== mesActual) break;
            if (semanas.length > 5) break; // Máximo 5 semanas
        }

        // Generar HTML del documento - DISEÑO PREMIUM
        const restaurantName = localStorage.getItem('restaurant_name') || 'LA NAVE 5';
        const restaurantLogo = 'https://em-content.zobj.net/source/apple/391/anchor_2693.png'; // Emoji ancla

        let html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horario ${nombresMeses[mesActual]} ${anioActual} - ${restaurantName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            padding: 40px 20px;
            color: #1e293b;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        /* HEADER PREMIUM */
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 24px;
            padding: 40px;
            margin-bottom: 40px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 400px;
            height: 400px;
            background: rgba(255,255,255,0.1);
            border-radius: 50%;
        }
        
        .header::after {
            content: '';
            position: absolute;
            bottom: -60%;
            left: 10%;
            width: 300px;
            height: 300px;
            background: rgba(255,255,255,0.05);
            border-radius: 50%;
        }
        
        .header-content {
            display: flex;
            align-items: center;
            gap: 24px;
            z-index: 1;
        }
        
        .logo {
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.3);
        }
        
        .header-text {
            color: white;
        }
        
        .header-text h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
        }
        
        .header-text .subtitle {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 500;
        }
        
        .header-text .month-year {
            font-size: 24px;
            font-weight: 700;
            margin-top: 8px;
            background: rgba(255,255,255,0.2);
            padding: 8px 20px;
            border-radius: 25px;
            display: inline-block;
        }
        
        .header-badge {
            background: white;
            color: #667eea;
            padding: 12px 24px;
            border-radius: 15px;
            font-weight: 700;
            font-size: 14px;
            z-index: 1;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        /* SEMANAS */
        .semana {
            background: white;
            border-radius: 20px;
            margin-bottom: 30px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        .semana-header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 16px 24px;
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .semana-header span {
            font-size: 22px;
        }
        
        table { 
            width: 100%; 
            border-collapse: collapse;
        }
        
        th { 
            background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 16px 12px;
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        td { 
            padding: 12px 8px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
            min-height: 60px;
        }
        
        tr:last-child td {
            border-bottom: none;
        }
        
        .empleado { 
            padding: 8px 14px;
            margin: 4px 2px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 13px;
            display: inline-block;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid rgba(0,0,0,0.2);
        }
        
        /* FOOTER */
        .footer {
            text-align: center;
            margin-top: 40px;
            color: rgba(255,255,255,0.6);
            font-size: 12px;
        }
        
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        
        /* PRINT STYLES */
        @media print { 
            body { 
                background: white;
                padding: 0;
            }
            .header {
                margin-bottom: 20px;
            }
            .semana { 
                page-break-inside: avoid;
                box-shadow: none;
                border: 1px solid #e2e8f0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="header-content">
                <div class="logo">⚓</div>
                <div class="header-text">
                    <h1>${restaurantName}</h1>
                    <div class="subtitle">📅 Planificación de Personal</div>
                    <div class="month-year">${nombresMeses[mesActual]} ${anioActual}</div>
                </div>
            </div>
            <div class="header-badge">
                📊 HORARIO MENSUAL
            </div>
        </header>
`;

        // Generar cada semana
        semanas.forEach((semana, idx) => {
            const primerDiaSemana = semana[0].getDate().toString().padStart(2, '0');
            const ultimoDiaSemana = semana[5].getDate().toString().padStart(2, '0');

            html += `
        <div class="semana">
            <div class="semana-header">
                <span>📅</span> Semana ${idx + 1}: ${primerDiaSemana} - ${ultimoDiaSemana} de ${nombresMeses[mesActual]}
            </div>
            <table>
                <tr>
                    <th>Lunes</th>
                    <th>Martes</th>
                    <th>Miércoles</th>
                    <th>Jueves</th>
                    <th>Viernes</th>
                    <th>Sábado</th>
                </tr>
                <tr>
`;

            // Para cada día de la semana
            semana.forEach(dia => {
                const fechaStr = formatearFecha(dia);
                html += '<td>';

                // Buscar qué empleados trabajan este día
                empleados.forEach(emp => {
                    const turno = horariosMes.find(h => {
                        const fechaH = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha;
                        return h.empleado_id === emp.id && fechaH === fechaStr;
                    });

                    if (turno) {
                        const nombreLower = emp.nombre.toLowerCase();
                        let color = emp.color || '#667eea';

                        // Usar colores específicos si coinciden
                        for (const [nombre, c] of Object.entries(coloresEmpleados)) {
                            if (nombreLower.includes(nombre)) {
                                color = c;
                                break;
                            }
                        }

                        html += `<div class="empleado" style="background: ${color};">${emp.nombre}</div>`;
                    }
                });

                html += '</td>';
            });

            html += `
                </tr>
            </table>
        </div>
`;
        });

        html += `
        <footer class="footer">
            <p>Generado con ❤️ por <strong>MindLoop CostOS</strong></p>
            <p style="margin-top: 8px; opacity: 0.7;">© ${anioActual} ${restaurantName} • Todos los derechos reservados</p>
        </footer>
    </div>
</body>
</html>
`;

        // Crear y descargar el archivo
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Horario_${nombresMeses[mesActual]}_${anioActual}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ Horario descargado', 'success');

    } catch (error) {
        console.error('Error descargando horario:', error);
        showToast('Error descargando horario: ' + error.message, 'error');
    }
};

// Exponer funciones globalmente
window.initHorarios = initHorarios;
