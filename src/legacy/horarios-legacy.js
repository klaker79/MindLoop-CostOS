/**
 * MindLoop AI Staff Scheduler
 * Ultra-modern staff scheduling with AI generation
 */

(function () {
    'use strict';

    // State
    let empleados = [];
    let horarios = {};
    let semanaActual = getInicioSemana(new Date());

    // Utilities
    function getInicioSemana(date) {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function formatFecha(date) {
        return date.toISOString().split('T')[0];
    }

    function getDiasSemana() {
        const dias = [];
        const nombres = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(semanaActual);
            d.setDate(d.getDate() + i);
            dias.push({ nombre: nombres[i], fecha: formatFecha(d), dia: d.getDate() });
        }
        return dias;
    }

    // API calls
    async function api(url, options = {}) {
        const apiObj = window.API || window.api;
        if (!apiObj || !apiObj.fetch) throw new Error('API not available');
        return await apiObj.fetch(url, options);
    }

    async function cargarEmpleados() {
        try {
            empleados = await api('/api/empleados');
            if (!Array.isArray(empleados)) empleados = [];
            console.log('✅ Empleados cargados:', empleados.length);
        } catch (e) {
            console.error('Error cargando empleados:', e);
            empleados = [];
        }
    }

    async function cargarHorarios() {
        try {
            const desde = formatFecha(semanaActual);
            const hasta = formatFecha(new Date(semanaActual.getTime() + 6 * 24 * 60 * 60 * 1000));
            const data = await api(`/api/horarios?desde=${desde}&hasta=${hasta}`);
            horarios = {};
            if (Array.isArray(data)) {
                data.forEach(h => { horarios[`${h.empleado_id}-${h.fecha}`] = h; });
            }
        } catch (e) {
            console.error('Error cargando horarios:', e);
            horarios = {};
        }
    }

    // Render functions
    function renderListaEmpleados() {
        const container = document.getElementById('lista-empleados');
        if (!container) return;

        if (empleados.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #64748B;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">👤</div>
                    <p style="font-size: 0.85rem;">Sin empleados</p>
                    <p style="font-size: 0.75rem; opacity: 0.7;">Haz clic en "+ Nuevo"</p>
                </div>`;
            return;
        }

        container.innerHTML = empleados.map(emp => `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 10px; margin-bottom: 8px; background: linear-gradient(135deg, ${emp.color}15 0%, ${emp.color}08 100%); border: 1px solid ${emp.color}30; cursor: pointer; transition: all 0.2s;" 
                 onmouseover="this.style.transform='scale(1.02)'" 
                 onmouseout="this.style.transform='scale(1)'">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: ${emp.color || '#667eea'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.9rem;">
                    ${(emp.nombre || '?')[0].toUpperCase()}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${emp.nombre}</div>
                    <div style="font-size: 0.75rem; color: #64748B;">${emp.puesto || 'Sin puesto'} • ${emp.coste_hora || 10}€/h</div>
                </div>
                <button onclick="event.stopPropagation(); eliminarEmpleadoUI(${emp.id})" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 1rem;">✕</button>
            </div>
        `).join('');
    }

    function renderGrid() {
        const tbody = document.getElementById('tbody-horarios');
        const titulo = document.getElementById('titulo-semana');
        if (!tbody) return;

        const dias = getDiasSemana();
        const mesAno = semanaActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        if (titulo) titulo.textContent = `${dias[0].dia}-${dias[6].dia} ${mesAno.charAt(0).toUpperCase() + mesAno.slice(1)}`;

        if (empleados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="padding: 50px; text-align: center; color: #94A3B8;">
                        <div style="font-size: 2.5rem; margin-bottom: 15px;">📅</div>
                        <p style="font-weight: 500;">Añade empleados para empezar</p>
                        <p style="font-size: 0.8rem; opacity: 0.7;">Usa el botón "+ Nuevo" en el panel izquierdo</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = empleados.map(emp => {
            const celdas = dias.map(dia => {
                const key = `${emp.id}-${dia.fecha}`;
                const tiene = !!horarios[key];
                return `
                    <td style="padding: 6px; text-align: center;">
                        <div onclick="toggleTurnoUI(${emp.id}, '${dia.fecha}')" 
                             style="width: 40px; height: 40px; margin: 0 auto; border-radius: 10px; cursor: pointer; 
                                    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                                    ${tiene
                        ? `background: ${emp.color || '#667eea'}; color: white; box-shadow: 0 3px 12px ${emp.color || '#667eea'}50;`
                        : 'background: #f1f5f9; color: #94A3B8;'}"
                             onmouseover="this.style.transform='scale(1.1)'" 
                             onmouseout="this.style.transform='scale(1)'">
                            ${tiene ? '✓' : ''}
                        </div>
                    </td>`;
            }).join('');

            return `
                <tr>
                    <td style="padding: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${emp.color || '#667eea'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.8rem;">
                                ${(emp.nombre || '?')[0].toUpperCase()}
                            </div>
                            <span style="font-weight: 500; font-size: 0.9rem;">${emp.nombre}</span>
                        </div>
                    </td>
                    ${celdas}
                </tr>`;
        }).join('');
    }

    function renderStats() {
        const totalTurnos = Object.keys(horarios).length;
        const horasTurno = 8;
        let costeTotal = 0;
        Object.values(horarios).forEach(h => {
            const emp = empleados.find(e => e.id === h.empleado_id);
            if (emp) costeTotal += (emp.coste_hora || 10) * horasTurno;
        });

        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('stat-empleados', empleados.length);
        el('stat-turnos', totalTurnos);
        el('stat-horas', `${totalTurnos * horasTurno}h`);
        el('stat-coste', `${costeTotal}€`);
    }

    async function render() {
        await cargarEmpleados();
        await cargarHorarios();
        renderListaEmpleados();
        renderGrid();
        renderStats();
    }

    // Actions
    window.toggleTurnoUI = async function (empId, fecha) {
        const key = `${empId}-${fecha}`;
        try {
            if (horarios[key]) {
                await api(`/api/horarios/empleado/${empId}/fecha/${fecha}`, { method: 'DELETE' });
                delete horarios[key];
            } else {
                const result = await api('/api/horarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ empleado_id: empId, fecha })
                });
                horarios[key] = result;
            }
            renderGrid();
            renderStats();
        } catch (e) {
            console.error('Error toggle turno:', e);
            window.showToast?.('Error al modificar turno', 'error');
        }
    };

    window.eliminarEmpleadoUI = async function (id) {
        if (!confirm('¿Eliminar este empleado?')) return;
        try {
            await api(`/api/empleados/${id}`, { method: 'DELETE' });
            await render();
            window.showToast?.('Empleado eliminado', 'success');
        } catch (e) {
            console.error('Error eliminando empleado:', e);
        }
    };

    // Modal functions
    function showModal() {
        const modal = document.getElementById('modal-empleado');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('empleado-id').value = '';
            document.getElementById('empleado-nombre').value = '';
            document.getElementById('empleado-color').value = '#667eea';
            document.getElementById('empleado-puesto').value = 'Camarero';
            document.getElementById('empleado-coste-hora').value = '10';
            setTimeout(() => document.getElementById('empleado-nombre')?.focus(), 100);
        }
    }

    function hideModal() {
        const modal = document.getElementById('modal-empleado');
        if (modal) modal.style.display = 'none';
    }

    async function saveEmpleado(e) {
        if (e) e.preventDefault();
        const nombre = document.getElementById('empleado-nombre')?.value;
        if (!nombre) { alert('Nombre requerido'); return; }

        const data = {
            nombre,
            color: document.getElementById('empleado-color')?.value || '#667eea',
            puesto: document.getElementById('empleado-puesto')?.value || 'Camarero',
            coste_hora: parseFloat(document.getElementById('empleado-coste-hora')?.value) || 10
        };

        try {
            await api('/api/empleados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            hideModal();
            await render();
            window.showToast?.('Empleado añadido', 'success');
        } catch (e) {
            console.error('Error guardando empleado:', e);
            window.showToast?.('Error al guardar', 'error');
        }
    }

    // AI Generation
    async function generarHorarioIA() {
        if (empleados.length === 0) {
            window.showToast?.('Primero añade empleados', 'warning');
            return;
        }

        window.showToast?.('🤖 Generando horario inteligente...', 'info');

        const dias = getDiasSemana();

        // Simple AI: distribute employees across days based on availability
        for (const emp of empleados) {
            // Parse dias_libres_fijos if available
            const diasLibres = (emp.dias_libres_fijos || '').split(',').map(d => d.trim().toLowerCase());
            const diasNombres = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

            for (let i = 0; i < dias.length; i++) {
                const dia = dias[i];
                const key = `${emp.id}-${dia.fecha}`;

                // Skip if already has shift or is a day off
                if (horarios[key]) continue;
                if (diasLibres.includes(diasNombres[i])) continue;

                // Add shift
                try {
                    const result = await api('/api/horarios', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ empleado_id: emp.id, fecha: dia.fecha })
                    });
                    horarios[key] = result;
                } catch (e) {
                    // Ignore errors (might already exist)
                }
            }
        }

        renderGrid();
        renderStats();
        window.showToast?.('✅ Horario generado con IA', 'success');
    }

    // Event bindings
    function bindEvents() {
        // Add employee button
        document.getElementById('btn-add-empleado')?.addEventListener('click', showModal);

        // Week navigation
        document.getElementById('btn-semana-prev')?.addEventListener('click', () => {
            semanaActual.setDate(semanaActual.getDate() - 7);
            render();
        });
        document.getElementById('btn-semana-next')?.addEventListener('click', () => {
            semanaActual.setDate(semanaActual.getDate() + 7);
            render();
        });

        // Copy week
        document.getElementById('btn-copiar-semana')?.addEventListener('click', async () => {
            try {
                const origen = new Date(semanaActual);
                origen.setDate(origen.getDate() - 7);
                const result = await api('/api/horarios/copiar-semana', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        semana_origen: formatFecha(origen),
                        semana_destino: formatFecha(semanaActual)
                    })
                });
                await render();
                window.showToast?.(`${result.turnos_copiados} turnos copiados`, 'success');
            } catch (e) {
                window.showToast?.('Error copiando semana', 'error');
            }
        });

        // AI Generation
        document.getElementById('btn-generar-horario')?.addEventListener('click', generarHorarioIA);

        // Modal close button
        document.querySelector('#modal-empleado .close')?.addEventListener('click', hideModal);

        // Form submit
        document.getElementById('form-empleado')?.addEventListener('submit', saveEmpleado);

        // Close modal on backdrop click
        document.getElementById('modal-empleado')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-empleado') hideModal();
        });
    }

    // Expose globally for legacy compatibility and onclick handlers
    window.mostrarModalEmpleado = showModal;
    window.cerrarModalEmpleado = hideModal;
    window.guardarEmpleado = saveEmpleado;
    window.renderizarHorarios = render;
    window.generarHorarioIA = generarHorarioIA;
    window.semanaAnteriorUI = function () {
        semanaActual.setDate(semanaActual.getDate() - 7);
        render();
    };
    window.semanaSiguienteUI = function () {
        semanaActual.setDate(semanaActual.getDate() + 7);
        render();
    };
    window.copiarSemanaUI = async function () {
        try {
            const origen = new Date(semanaActual);
            origen.setDate(origen.getDate() - 7);
            const result = await api('/api/horarios/copiar-semana', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    semana_origen: formatFecha(origen),
                    semana_destino: formatFecha(semanaActual)
                })
            });
            await render();
            window.showToast?.(`${result.turnos_copiados} turnos copiados`, 'success');
        } catch (e) {
            window.showToast?.('Error copiando semana', 'error');
        }
    };

    // Initialize
    function init() {
        console.log('🤖 MindLoop AI Staff Scheduler inicializando...');
        bindEvents();
        render();
    }

    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

    console.log('✅ MindLoop AI Staff Scheduler cargado');
})();
