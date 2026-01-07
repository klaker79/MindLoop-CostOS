/**
 * Horarios UI Module
 * Gestión visual de horarios del personal estilo 7shifts/Deputy
 */

console.log('📅 Módulo horarios-ui.js CARGADO');

let empleados = [];
let horariosSemanales = {};
let semanaActual = getInicioSemana(new Date());

// Obtener lunes de la semana
function getInicioSemana(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Formatear fecha YYYY-MM-DD
function formatFecha(date) {
    return date.toISOString().split('T')[0];
}

// Obtener días de la semana
function getDiasSemana(inicioSemana) {
    const dias = [];
    const nombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    for (let i = 0; i < 7; i++) {
        const d = new Date(inicioSemana);
        d.setDate(d.getDate() + i);
        dias.push({
            nombre: nombres[i],
            fecha: formatFecha(d),
            dia: d.getDate()
        });
    }
    return dias;
}

// Cargar empleados
async function cargarEmpleados() {
    console.log('📅 cargarEmpleados: iniciando...');
    try {
        const apiFunc = window.API?.fetch || window.api?.fetch;
        if (!apiFunc) {
            console.error('📅 API.fetch no disponible');
            empleados = [];
            return;
        }
        empleados = await apiFunc('/api/empleados');
        console.log('📅 cargarEmpleados: recibidos', empleados);
        if (!Array.isArray(empleados)) empleados = [];
    } catch (error) {
        console.error('📅 Error cargando empleados:', error);
        empleados = [];
    }
}

// Cargar horarios de la semana
async function cargarHorariosSemana() {
    console.log('📅 cargarHorariosSemana: iniciando...');
    try {
        const desde = formatFecha(semanaActual);
        const hasta = formatFecha(new Date(semanaActual.getTime() + 6 * 24 * 60 * 60 * 1000));
        const horarios = await window.API.fetch(`/api/horarios?desde=${desde}&hasta=${hasta}`);

        horariosSemanales = {};
        if (Array.isArray(horarios)) {
            horarios.forEach(h => {
                const key = `${h.empleado_id}-${h.fecha}`;
                horariosSemanales[key] = h;
            });
        }
    } catch (error) {
        console.error('Error cargando horarios:', error);
        horariosSemanales = {};
    }
}

// Toggle turno
async function toggleTurno(empleadoId, fecha) {
    const key = `${empleadoId}-${fecha}`;

    try {
        if (horariosSemanales[key]) {
            // Eliminar turno
            await window.API.fetch(`/api/horarios/empleado/${empleadoId}/fecha/${fecha}`, {
                method: 'DELETE'
            });
            delete horariosSemanales[key];
        } else {
            // Crear turno
            const result = await window.API.fetch('/api/horarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleado_id: empleadoId, fecha })
            });
            horariosSemanales[key] = result;
        }
        renderizarHorarios();
    } catch (error) {
        console.error('Error toggling turno:', error);
        window.showToast?.('Error al modificar turno', 'error');
    }
}

// Semana anterior
function semanaAnterior() {
    semanaActual.setDate(semanaActual.getDate() - 7);
    renderizarHorarios();
}

// Semana siguiente
function semanaSiguiente() {
    semanaActual.setDate(semanaActual.getDate() + 7);
    renderizarHorarios();
}

// Copiar semana anterior
async function copiarSemanaAnterior() {
    const semanaOrigen = new Date(semanaActual);
    semanaOrigen.setDate(semanaOrigen.getDate() - 7);

    try {
        const result = await window.API.fetch('/api/horarios/copiar-semana', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                semana_origen: formatFecha(semanaOrigen),
                semana_destino: formatFecha(semanaActual)
            })
        });
        window.showToast?.(`${result.turnos_copiados} turnos copiados`, 'success');
        await cargarHorariosSemana();
        renderizarHorarios();
    } catch (error) {
        console.error('Error copiando semana:', error);
        window.showToast?.('Error al copiar semana', 'error');
    }
}

// Modal añadir empleado
function mostrarModalEmpleado(empleado = null) {
    const modal = document.getElementById('modal-empleado');
    const form = document.getElementById('form-empleado');

    if (empleado) {
        document.getElementById('empleado-id').value = empleado.id;
        document.getElementById('empleado-nombre').value = empleado.nombre;
        document.getElementById('empleado-color').value = empleado.color || '#3B82F6';
        document.getElementById('empleado-puesto').value = empleado.puesto || 'Camarero';
        document.getElementById('empleado-coste-hora').value = empleado.coste_hora || 10;
    } else {
        form.reset();
        document.getElementById('empleado-id').value = '';
        document.getElementById('empleado-color').value = '#3B82F6';
    }

    modal.style.display = 'flex';
}

function cerrarModalEmpleado() {
    document.getElementById('modal-empleado').style.display = 'none';
}

// Guardar empleado
async function guardarEmpleado(event) {
    event.preventDefault();

    const id = document.getElementById('empleado-id').value;
    const data = {
        nombre: document.getElementById('empleado-nombre').value,
        color: document.getElementById('empleado-color').value,
        puesto: document.getElementById('empleado-puesto').value,
        coste_hora: parseFloat(document.getElementById('empleado-coste-hora').value) || 10
    };

    try {
        if (id) {
            await window.API.fetch(`/api/empleados/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await window.API.fetch('/api/empleados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        cerrarModalEmpleado();
        await cargarEmpleados();
        renderizarHorarios();
        window.showToast?.('Empleado guardado', 'success');
    } catch (error) {
        console.error('Error guardando empleado:', error);
        window.showToast?.('Error al guardar empleado', 'error');
    }
}

// Eliminar empleado
async function eliminarEmpleado(id) {
    if (!confirm('¿Eliminar este empleado?')) return;

    try {
        await window.API.fetch(`/api/empleados/${id}`, { method: 'DELETE' });
        await cargarEmpleados();
        renderizarHorarios();
        window.showToast?.('Empleado eliminado', 'success');
    } catch (error) {
        console.error('Error eliminando empleado:', error);
        window.showToast?.('Error al eliminar empleado', 'error');
    }
}

// Calcular estadísticas
function calcularEstadisticas() {
    let totalTurnos = 0;
    let costeTotal = 0;
    const horasJornada = 8;

    Object.values(horariosSemanales).forEach(h => {
        totalTurnos++;
        const emp = empleados.find(e => e.id === h.empleado_id);
        if (emp) {
            costeTotal += (emp.coste_hora || 10) * horasJornada;
        }
    });

    return { totalTurnos, costeTotal, empleadosActivos: empleados.length };
}

// Renderizar
export async function renderizarHorarios() {
    console.log('📅 renderizarHorarios: iniciando...');
    const container = document.getElementById('horarios-container');
    if (!container) {
        console.error('📅 Container horarios-container no encontrado');
        return;
    }
    console.log('📅 Container encontrado, cargando datos...');

    await cargarEmpleados();
    await cargarHorariosSemana();

    const dias = getDiasSemana(semanaActual);
    const stats = calcularEstadisticas();

    // Header con navegación
    const mesAno = semanaActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const rangoFechas = `${dias[0].dia}-${dias[6].dia} ${mesAno.charAt(0).toUpperCase() + mesAno.slice(1)}`;

    let html = `
        <div class="horarios-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <button onclick="window.semanaAnterior()" class="btn btn-secondary" style="padding: 8px 12px;">◀</button>
                <h3 style="margin: 0; font-size: 1.1rem;">${rangoFechas}</h3>
                <button onclick="window.semanaSiguiente()" class="btn btn-secondary" style="padding: 8px 12px;">▶</button>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.copiarSemanaAnterior()" class="btn btn-secondary" title="Copiar semana anterior">📋 Copiar Semana</button>
                <button onclick="window.mostrarModalEmpleado()" class="btn btn-primary">+ Añadir Empleado</button>
            </div>
        </div>
    `;

    // Tabla de horarios
    html += `
        <div class="horarios-grid" style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        <th style="padding: 12px 15px; text-align: left; border-radius: 8px 0 0 0;">Empleado</th>
                        ${dias.map((d, i) => `<th style="padding: 12px 10px; text-align: center; ${i === 6 ? 'border-radius: 0 8px 0 0;' : ''}">${d.nombre} ${d.dia}</th>`).join('')}
                        <th style="padding: 12px 10px; text-align: center;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (empleados.length === 0) {
        html += `
            <tr>
                <td colspan="9" style="padding: 40px; text-align: center; color: #64748B;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">👥</div>
                    <p>No hay empleados. <a href="#" onclick="window.mostrarModalEmpleado(); return false;" style="color: #7C3AED;">Añade el primero</a></p>
                </td>
            </tr>
        `;
    } else {
        empleados.forEach(emp => {
            html += `
                <tr style="border-bottom: 1px solid #E2E8F0;">
                    <td style="padding: 12px 15px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="width: 12px; height: 12px; border-radius: 50%; background: ${emp.color || '#3B82F6'};"></span>
                            <span style="font-weight: 500;">${emp.nombre}</span>
                            <span style="font-size: 0.75rem; color: #64748B;">${emp.puesto || ''}</span>
                        </div>
                    </td>
            `;

            dias.forEach(dia => {
                const key = `${emp.id}-${dia.fecha}`;
                const tieneTurno = horariosSemanales[key];
                const esExtra = tieneTurno?.es_extra;

                html += `
                    <td style="padding: 8px; text-align: center;">
                        <div onclick="window.toggleTurno(${emp.id}, '${dia.fecha}')" 
                             style="width: 36px; height: 36px; margin: 0 auto; border-radius: 8px; cursor: pointer; 
                                    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                                    ${tieneTurno
                        ? `background: ${emp.color || '#3B82F6'}; color: white; box-shadow: 0 2px 8px ${emp.color}40;`
                        : 'background: #F1F5F9; color: #94A3B8;'}"
                             title="${tieneTurno ? 'Quitar turno' : 'Añadir turno'}">
                            ${tieneTurno ? (esExtra ? '★' : '✓') : ''}
                        </div>
                    </td>
                `;
            });

            html += `
                    <td style="padding: 8px; text-align: center;">
                        <button onclick="window.mostrarModalEmpleado(${JSON.stringify(emp).replace(/"/g, '&quot;')})" 
                                class="icon-btn" title="Editar" style="margin-right: 5px;">✏️</button>
                        <button onclick="window.eliminarEmpleado(${emp.id})" 
                                class="icon-btn delete" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    // Estadísticas
    html += `
        <div style="margin-top: 20px; padding: 15px 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
                    border-radius: 12px; display: flex; justify-content: space-around; text-align: center;">
            <div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #7C3AED;">${stats.empleadosActivos}</div>
                <div style="font-size: 0.8rem; color: #64748B;">Empleados</div>
            </div>
            <div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${stats.totalTurnos}</div>
                <div style="font-size: 0.8rem; color: #64748B;">Turnos esta semana</div>
            </div>
            <div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #DC2626;">${stats.costeTotal.toFixed(0)}€</div>
                <div style="font-size: 0.8rem; color: #64748B;">Coste estimado</div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Exponer funciones globalmente
window.renderizarHorarios = renderizarHorarios;
window.semanaAnterior = semanaAnterior;
window.semanaSiguiente = semanaSiguiente;
window.copiarSemanaAnterior = copiarSemanaAnterior;
window.toggleTurno = toggleTurno;
window.mostrarModalEmpleado = mostrarModalEmpleado;
window.cerrarModalEmpleado = cerrarModalEmpleado;
window.guardarEmpleado = guardarEmpleado;
window.eliminarEmpleado = eliminarEmpleado;

export { cargarEmpleados, cargarHorariosSemana };
