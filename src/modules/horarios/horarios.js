/**
 * Módulo de Horarios - MindLoop Staff Scheduler
 * Gestión inteligente de horarios y plantilla
 */

import { showToast } from '../../ui/toast.js';
import { getApiUrl } from '../../config/app-config.js';

// Estado global
let empleados = [];
let horarios = [];
let semanaActual = new Date();
let empleadoEditando = null;

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
        console.log(`📋 Empleados cargados: ${empleados.length}`);
    } catch (error) {
        console.error('❌ Error cargando empleados:', error);
        showToast('Error cargando empleados: ' + error.message, 'error');
        empleados = [];
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
        console.log(`📅 Horarios cargados: ${horarios.length}`);
    } catch (error) {
        console.error('❌ Error cargando horarios:', error);
        showToast('Error cargando horarios: ' + error.message, 'error');
        horarios = [];
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

    empleados.forEach(emp => {
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
                        <span>💰 ${emp.coste_hora || 0}€/h</span>
                        <span>⏱️ ${horasSemanales}h/${emp.horas_contrato || 0}h</span>
                    </div>
                </div>

                <!-- Días libres -->
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${renderizarDiasLibres(emp.dias_libres_fijos)}
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

    const dias = typeof diasLibres === 'string' ? JSON.parse(diasLibres) : diasLibres;
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return dias.map(d => {
        return `<span style="background: #f1f5f9; color: #64748b; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">${nombresDias[d]}</span>`;
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
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(inicio);
        fecha.setDate(fecha.getDate() + i);
        dias.push(fecha);
    }

    // Crear tabla
    let html = '<table style="width: 100%; border-collapse: separate; border-spacing: 0;">';

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

    // Filas de empleados
    empleados.forEach((emp, index) => {
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
            const turno = horarios.find(h => h.empleado_id === emp.id && h.fecha === fechaStr);
            const esDiaLibre = esDiaLibreFijo(emp.dias_libres_fijos, dia.getDay());
            const esHoy = esHoyFecha(dia);

            html += `<td style="padding: 8px; text-align: center; border-bottom: 1px solid #f1f5f9; ${esHoy ? 'background: #f0f4ff;' : ''}" onclick="window.toggleTurno(${emp.id}, '${fechaStr}')">`;

            if (esDiaLibre) {
                html += '<div style="padding: 12px; background: #fef2f2; border: 2px dashed #fca5a5; border-radius: 8px; color: #ef4444; font-size: 12px; font-weight: 600; cursor: not-allowed;">LIBRE</div>';
            } else if (turno) {
                const colorFondo = turno.es_extra ? '#fef3c7' : '#dcfce7';
                const colorTexto = turno.es_extra ? '#92400e' : '#166534';
                const icono = turno.es_extra ? '⚡' : '✓';

                html += `
                    <div style="padding: 12px; background: ${colorFondo}; border: 2px solid ${colorTexto}20; border-radius: 8px; cursor: pointer; transition: all 0.2s;" onmouseenter="this.style.transform='scale(1.05)';" onmouseleave="this.style.transform='scale(1)';">
                        <div style="font-size: 16px; margin-bottom: 4px;">${icono}</div>
                        <div style="font-size: 13px; font-weight: 700; color: ${colorTexto};">
                            ${turno.hora_inicio || '09:00'} - ${turno.hora_fin || '17:00'}
                        </div>
                        <div style="font-size: 11px; color: ${colorTexto}; margin-top: 4px;">
                            ${turno.turno || 'Mañana'}
                        </div>
                    </div>
                `;
            } else {
                html += '<div style="padding: 20px; background: white; border: 2px dashed #e2e8f0; border-radius: 8px; cursor: pointer; transition: all 0.2s; color: #cbd5e1; font-size: 20px;" onmouseenter="this.style.borderColor=\'#667eea\'; this.style.background=\'#f8fafc\';" onmouseleave="this.style.borderColor=\'#e2e8f0\'; this.style.background=\'white\';">+</div>';
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
window.nuevoEmpleado = function() {
    empleadoEditando = null;

    // Resetear formulario
    document.getElementById('empleado-nombre').value = '';
    document.getElementById('empleado-color').value = generarColorAleatorio();
    document.getElementById('empleado-puesto').value = 'cocinero';
    document.getElementById('empleado-coste-hora').value = '';
    document.getElementById('empleado-horas-contrato').value = '40';

    // Desmarcar checkboxes
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(dia => {
        const checkbox = document.getElementById(`libre-${dia}`);
        if (checkbox) checkbox.checked = false;
    });

    // Cambiar título
    document.getElementById('modal-empleado-titulo').innerHTML = '<span style="font-size: 28px;">👤</span> Nuevo Empleado';
    document.getElementById('btn-guardar-empleado-text').textContent = 'Guardar';

    // Mostrar modal
    document.getElementById('modal-empleado').classList.add('active');
    document.getElementById('modal-empleado').style.display = 'flex';
};

/**
 * Edita un empleado
 */
window.editarEmpleado = async function(id) {
    const emp = empleados.find(e => e.id === id);
    if (!emp) return;

    empleadoEditando = emp;

    // Rellenar formulario
    document.getElementById('empleado-nombre').value = emp.nombre;
    document.getElementById('empleado-color').value = emp.color || '#667eea';
    document.getElementById('empleado-puesto').value = emp.puesto || 'cocinero';
    document.getElementById('empleado-coste-hora').value = emp.coste_hora || '';
    document.getElementById('empleado-horas-contrato').value = emp.horas_contrato || '40';

    // Marcar días libres
    const diasLibres = typeof emp.dias_libres_fijos === 'string' ? JSON.parse(emp.dias_libres_fijos) : (emp.dias_libres_fijos || []);
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(dia => {
        const checkbox = document.getElementById(`libre-${dia}`);
        if (checkbox) {
            checkbox.checked = diasLibres.includes(parseInt(checkbox.value));
        }
    });

    // Cambiar título
    document.getElementById('modal-empleado-titulo').innerHTML = '<span style="font-size: 28px;">✏️</span> Editar Empleado';
    document.getElementById('btn-guardar-empleado-text').textContent = 'Actualizar';

    // Mostrar modal
    document.getElementById('modal-empleado').classList.add('active');
    document.getElementById('modal-empleado').style.display = 'flex';
};

/**
 * Guarda empleado (crear o actualizar)
 */
window.guardarEmpleado = async function() {
    const nombre = document.getElementById('empleado-nombre').value.trim();
    const color = document.getElementById('empleado-color').value;
    const puesto = document.getElementById('empleado-puesto').value;
    const costeHora = parseFloat(document.getElementById('empleado-coste-hora').value) || 0;
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
        coste_hora: costeHora,
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
window.eliminarEmpleado = async function(id) {
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
window.cerrarModalEmpleado = function() {
    document.getElementById('modal-empleado').classList.remove('active');
    document.getElementById('modal-empleado').style.display = 'none';
    empleadoEditando = null;
};

/**
 * Toggle turno (asignar/quitar)
 */
window.toggleTurno = async function(empleadoId, fecha) {
    const emp = empleados.find(e => e.id === empleadoId);
    if (!emp) return;

    // Verificar si es día libre fijo
    const fechaObj = new Date(fecha + 'T00:00:00');
    if (esDiaLibreFijo(emp.dias_libres_fijos, fechaObj.getDay())) {
        showToast('Este es un día libre fijo del empleado', 'warning');
        return;
    }

    // Buscar turno existente
    const turnoExistente = horarios.find(h => h.empleado_id === empleadoId && h.fecha === fecha);

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
window.semanaAnterior = function() {
    semanaActual.setDate(semanaActual.getDate() - 7);
    cargarHorariosSemana().then(() => {
        renderizarGridHorarios();
        actualizarTextoSemana();
    });
};

/**
 * Navegar a semana siguiente
 */
window.semanaSiguiente = function() {
    semanaActual.setDate(semanaActual.getDate() + 7);
    cargarHorariosSemana().then(() => {
        renderizarGridHorarios();
        actualizarTextoSemana();
    });
};

/**
 * Copiar semana anterior
 */
window.copiarSemana = async function() {
    if (!confirm('¿Copiar los turnos de la semana anterior?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/horarios/copiar-semana`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fecha_destino: formatearFecha(semanaActual)
            })
        });

        if (!response.ok) throw new Error('Error copiando semana');

        showToast('Semana copiada correctamente', 'success');

        await cargarHorariosSemana();
        renderizarGridHorarios();

    } catch (error) {
        console.error('Error copiando semana:', error);
        showToast('Error copiando semana: ' + error.message, 'error');
    }
};

/**
 * Generador de horarios con IA
 */
window.generarHorarioIA = async function() {
    if (empleados.length === 0) {
        showToast('Añade empleados primero', 'warning');
        return;
    }

    if (!confirm('¿Generar horario automático con IA? Esto sobrescribirá los turnos existentes de la semana actual.')) return;

    showToast('⚡ Generando horario inteligente...', 'info');

    try {
        const { inicio, fin } = obtenerRangoSemana(semanaActual);
        const horarioGenerado = generarHorarioInteligente(empleados, inicio, fin);

        // Guardar todos los turnos
        const token = localStorage.getItem('token');

        for (const turno of horarioGenerado) {
            await fetch(`${API_BASE}/horarios`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(turno)
            });
        }

        showToast('✅ Horario generado correctamente', 'success');

        await cargarHorariosSemana();
        renderizarGridHorarios();

    } catch (error) {
        console.error('Error generando horario:', error);
        showToast('Error generando horario: ' + error.message, 'error');
    }
};

/**
 * Algoritmo de generación inteligente de horarios
 */
function generarHorarioInteligente(empleados, fechaInicio, fechaFin) {
    const turnos = [];
    const turnoPorDia = ['mañana', 'tarde', 'noche'];
    const horariosPorTurno = {
        'mañana': { inicio: '09:00', fin: '17:00' },
        'tarde': { inicio: '14:00', fin: '22:00' },
        'noche': { inicio: '22:00', fin: '06:00' }
    };

    // Iterar por cada día de la semana
    const fecha = new Date(fechaInicio);
    while (fecha <= fechaFin) {
        const fechaStr = formatearFecha(fecha);
        const diaSemana = fecha.getDay();

        // Distribuir turnos entre empleados disponibles
        const empleadosDisponibles = empleados.filter(emp => {
            return !esDiaLibreFijo(emp.dias_libres_fijos, diaSemana);
        });

        // Asignar al menos 2 empleados por turno si hay suficientes
        turnoPorDia.forEach((turno, idx) => {
            const numEmpleadosPorTurno = Math.min(2, empleadosDisponibles.length);

            for (let i = 0; i < numEmpleadosPorTurno; i++) {
                // Rotación inteligente: usar módulo para distribuir equitativamente
                const empleadoIdx = (idx + i + fecha.getDate()) % empleadosDisponibles.length;
                const emp = empleadosDisponibles[empleadoIdx];

                if (emp) {
                    turnos.push({
                        empleado_id: emp.id,
                        fecha: fechaStr,
                        turno: turno,
                        hora_inicio: horariosPorTurno[turno].inicio,
                        hora_fin: horariosPorTurno[turno].fin,
                        es_extra: false
                    });
                }
            }
        });

        fecha.setDate(fecha.getDate() + 1);
    }

    return turnos;
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
    const dias = typeof diasLibres === 'string' ? JSON.parse(diasLibres) : diasLibres;
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
        'cocinero': '👨‍🍳',
        'ayudante': '🧑‍🍳',
        'camarero': '🍽️',
        'bartender': '🍸',
        'limpieza': '🧹',
        'gerente': '👔',
        'otro': '👤'
    };
    return emojis[puesto] || '👤';
}

// Exponer funciones globalmente
window.initHorarios = initHorarios;
