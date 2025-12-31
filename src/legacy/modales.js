window.confirmarEliminacion = function (config) {
    return new Promise(resolve => {
        const modal = document.getElementById('modal-confirmacion');
        const titulo = document.getElementById('confirm-titulo');
        const mensaje = document.getElementById('confirm-mensaje');
        const btnConfirmar = document.getElementById('btn-confirmar-eliminar');

        titulo.textContent = config.titulo || 'Confirmar Eliminación';
        mensaje.innerHTML = `
      ¿Estás seguro de eliminar <strong>${escapeHTML(config.tipo || 'este elemento')}</strong>?
      <br><br>
      <strong style="font-size: 1.15rem;">"${escapeHTML(config.nombre)}"</strong>
      <br><br>
      <span style="font-size: 0.95rem; color: #6c757d;">Esta acción no se puede deshacer.</span>
    `;

        modal.style.display = 'flex';

        function handleConfirm() {
            modal.style.display = 'none';
            btnConfirmar.removeEventListener('click', handleConfirm);
            resolve(true);
        }

        window.cerrarConfirmacion = function () {
            modal.style.display = 'none';
            btnConfirmar.removeEventListener('click', handleConfirm);
            resolve(false);
        };

        modal.onclick = function (e) {
            if (e.target === modal) window.cerrarConfirmacion();
        };

        btnConfirmar.addEventListener('click', handleConfirm);
    });
};

// ==================== GASTOS FIJOS ====================
let gastosFijos = [];

async function cargarGastosFijos() {
    try {
        gastosFijos = await window.API.getGastosFijos();
        renderizarGastosFijos();
        actualizarTotalesGastosFijos();
    } catch (error) {
        console.error('Error cargando gastos fijos:', error);
    }
}

function renderizarGastosFijos() {
    const tbody = document.getElementById('tabla-gastos-fijos');
    if (!tbody) return;

    if (gastosFijos.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="4" style="text-align:center;padding:40px;color:#999"><div style="font-size:48px">💰</div><div>Aún no hay gastos fijos</div></td></tr>';
        return;
    }

    tbody.innerHTML = gastosFijos
        .map(g => {
            const costeDiario = (parseFloat(g.monto_mensual) / 30).toFixed(2);
            return `<tr>
            <td><strong>${escapeHTML(g.concepto)}</strong></td>
            <td>${parseFloat(g.monto_mensual).toFixed(2)}€</td>
            <td>${costeDiario}€</td>
            <td>
                <button class="btn-icon" onclick="editarGastoFijo(${g.id})">✏️</button>
                <button class="btn-icon" onclick="confirmarEliminarGastoFijo(${g.id}, '${escapeHTML(g.concepto)}')">🗑️</button>
            </td>
        </tr>`;
        })
        .join('');
}

function actualizarTotalesGastosFijos() {
    const totalMensual = gastosFijos.reduce((sum, g) => sum + parseFloat(g.monto_mensual || 0), 0);
    const totalDiario = totalMensual / 30;

    const elemMensual = document.getElementById('total-mensual-gastos');
    const elemDiario = document.getElementById('total-diario-gastos');
    if (elemMensual) elemMensual.textContent = totalMensual.toFixed(2) + '€';
    if (elemDiario) elemDiario.textContent = totalDiario.toFixed(2) + '€';
}

function abrirFormularioGastoFijo(id = null) {
    const modal = document.getElementById('modal-gasto-fijo');
    const titulo = document.getElementById('titulo-modal-gasto');
    const form = document.getElementById('form-gasto-fijo');

    form.reset();

    if (id) {
        titulo.textContent = 'Editar Gasto Fijo';
        const gasto = gastosFijos.find(g => g.id === id);
        if (gasto) {
            document.getElementById('gasto-id').value = gasto.id;
            document.getElementById('gasto-concepto').value = gasto.concepto;
            document.getElementById('gasto-monto').value = parseFloat(gasto.monto_mensual);
        }
    } else {
        titulo.textContent = 'Añadir Gasto Fijo';
        document.getElementById('gasto-id').value = '';
    }

    modal.style.display = 'block';
}

function cerrarFormularioGastoFijo() {
    document.getElementById('modal-gasto-fijo').style.display = 'none';
}

async function guardarGastoFijo(event) {
    event.preventDefault();

    const id = document.getElementById('gasto-id').value;
    const concepto = document.getElementById('gasto-concepto').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value);

    try {
        if (id) {
            await window.API.updateGastoFijo(id, concepto, monto);
            showToast('✅ Gasto fijo actualizado', 'success');
        } else {
            await window.API.createGastoFijo(concepto, monto);
            showToast('✅ Gasto fijo creado', 'success');
        }

        cerrarFormularioGastoFijo();
        await cargarGastosFijos();
    } catch (error) {
        showToast('❌ Error guardando gasto', 'error');
    }
}

function editarGastoFijo(id) {
    abrirFormularioGastoFijo(id);
}

async function confirmarEliminarGastoFijo(id, concepto) {
    const confirmado = await window.confirmarEliminacion({
        titulo: 'Eliminar Gasto Fijo',
        tipo: 'el gasto fijo',
        nombre: concepto,
    });

    if (confirmado) {
        try {
            await window.API.deleteGastoFijo(id);
            gastosFijos = gastosFijos.filter(g => g.id !== id);
            renderizarGastosFijos();
            actualizarTotalesGastosFijos();
            showToast(`✅ Gasto "${concepto}" eliminado`, 'success');
        } catch (error) {
            showToast('❌ Error eliminando', 'error');
        }
    }
}

window.cargarGastosFijos = cargarGastosFijos;

// FUNCIÓN DESACTIVADA - Causa error 8372 llamando a API inexistente
/*
async function actualizarBeneficioRealDiario() {
  try {
    const totales = await window.API.getTotalGastosFijos();
    const gastosDiario = totales.total_diario || 0;
 
    const elemGastos = document.getElementById('diario-gastos-fijos');
    if (elemGastos) elemGastos.textContent = gastosDiario.toFixed(2) + ' €';
 
    const beneficioBrutoMensual = parseFloat(document.getElementById('diario-beneficio')?.textContent || '0');
    const beneficioBrutoDiario = beneficioBrutoMensual / 30;
    const beneficioReal = beneficioBrutoDiario - gastosDiario;
 
    const elemBeneficio = document.getElementById('diario-beneficio-real');
    const cardBeneficio = document.getElementById('card-beneficio-real');
 
    if (elemBeneficio) elemBeneficio.textContent = beneficioReal.toFixed(2) + ' €';
    if (cardBeneficio) {
      cardBeneficio.className = beneficioReal < 0 ? 'stat-card red' : 'stat-card green';
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
 
setInterval(actualizarBeneficioRealDiario, 2000);
*/

// ============ FINANZAS: Guardar/Cargar Gastos Fijos desde BD ============
window.guardarGastoFinanzas = async function (concepto, inputId) {
    const elem = document.getElementById(inputId);
    if (!elem) return;

    const monto = parseFloat(elem.value) || 0;

    try {
        // Guardar en localStorage directamente (más rápido y confiable)
        let opexData = JSON.parse(localStorage.getItem('opex_inputs') || '{}');

        // Validar que opexData es un objeto
        if (!opexData || typeof opexData !== 'object' || Array.isArray(opexData)) {
            console.warn('Datos corruptos en opex_inputs, reiniciando');
            opexData = {};
        }

        // Mapear concepto a clave correcta
        const conceptoKey = concepto.toLowerCase();
        opexData[conceptoKey] = monto;

        localStorage.setItem('opex_inputs', JSON.stringify(opexData));

        // También actualizar en gastos_fijos para compatibilidad
        let gastosFijos = JSON.parse(localStorage.getItem('gastos_fijos') || '[]');

        // Validar que gastosFijos es un array
        if (!Array.isArray(gastosFijos)) {
            console.warn('Datos corruptos en gastos_fijos, reiniciando');
            gastosFijos = [];
        }

        const idx = gastosFijos.findIndex(g => g.concepto === concepto);

        if (idx >= 0) {
            gastosFijos[idx].monto_mensual = monto;
        } else {
            gastosFijos.push({
                id: Date.now(),
                concepto: concepto,
                monto_mensual: monto,
            });
        }

        localStorage.setItem('gastos_fijos', JSON.stringify(gastosFijos));

        // Actualizar el total
        actualizarTotalGastosFijos();
    } catch (error) {
        console.error('Error guardando gasto:', error);
    }
};

// ✅ CRITICAL FIX #1: Función centralizada única para calcular gastos fijos
// Esta es la ÚNICA fuente de verdad - todas las demás funciones deben llamar a esta
function calcularTotalGastosFijos() {
    try {
        const opex = JSON.parse(localStorage.getItem('opex_inputs') || '{}');

        // Validar que opex es un objeto y no un array u otro tipo
        if (!opex || typeof opex !== 'object' || Array.isArray(opex)) {
            console.warn('Datos de gastos fijos inválidos en localStorage, usando valores por defecto');
            return 0;
        }

        const total =
            (parseFloat(opex.alquiler) || 0) +
            (parseFloat(opex.personal) || 0) +
            (parseFloat(opex.suministros) || 0) +
            (parseFloat(opex.otros) || 0);

        // ✅ CRITICAL FIX #3: Validar resultado
        if (isNaN(total) || total < 0) {
            console.error('Error: Gastos fijos inválidos', opex);
            return 0;
        }

        return total;
    } catch (error) {
        console.error('Error calculando gastos fijos:', error);
        return 0;
    }
}

// Actualizar el display del total (usa la función centralizada)
function actualizarTotalGastosFijos() {
    try {
        const total = calcularTotalGastosFijos(); // ← Usar función central
        const elem = document.getElementById('diario-gastos-fijos-total');
        if (elem) {
            elem.textContent = total.toFixed(2) + ' €';
        }
    } catch (error) {
        console.error('Error actualizando display:', error);
    }
}

// Cargar valores guardados en los sliders al iniciar
function cargarValoresGastosFijos() {
    try {
        const opex = JSON.parse(localStorage.getItem('opex_inputs') || '{}');

        // Validar que opex es un objeto válido
        if (!opex || typeof opex !== 'object' || Array.isArray(opex)) {
            console.warn('Datos de gastos fijos inválidos, no se cargarán valores');
            return;
        }

        if (opex.alquiler) {
            const slider = document.getElementById('gf-alquiler');
            if (slider) {
                slider.value = opex.alquiler;
                document.getElementById('gf-alquiler-valor').textContent = opex.alquiler + '€';
            }
        }
        if (opex.personal) {
            const slider = document.getElementById('gf-personal');
            if (slider) {
                slider.value = opex.personal;
                document.getElementById('gf-personal-valor').textContent = opex.personal + '€';
            }
        }
        if (opex.suministros) {
            const slider = document.getElementById('gf-suministros');
            if (slider) {
                slider.value = opex.suministros;
                document.getElementById('gf-suministros-valor').textContent =
                    opex.suministros + '€';
            }
        }
        if (opex.otros) {
            const slider = document.getElementById('gf-otros');
            if (slider) {
                slider.value = opex.otros;
                document.getElementById('gf-otros-valor').textContent = opex.otros + '€';
            }
        }

        actualizarTotalGastosFijos();
    } catch (error) {
        console.error('Error cargando gastos fijos:', error);
    }
}

// Llamar al cargar la página
setTimeout(cargarValoresGastosFijos, 500);

// ✅ Renderizar beneficio neto ACUMULADO por día (VERSIÓN PRO con Punto de Equilibrio)
function renderizarBeneficioNetoDiario() {
    const container = document.getElementById('beneficio-neto-diario-lista');
    if (!container) return;

    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML =
            '<p style="color: #64748B; margin: 0; text-align: center; padding: 20px;">Carga un mes para ver los datos</p>';
        return;
    }

    const dias = window.datosResumenMensual.dias;
    const gastosFijosMes = calcularTotalGastosFijos();
    const mes = parseInt(document.getElementById('diario-mes')?.value || new Date().getMonth() + 1);
    const ano = parseInt(document.getElementById('diario-ano')?.value || new Date().getFullYear());

    if (!mes || !ano || mes < 1 || mes > 12 || ano < 2020 || ano > 2030) {
        container.innerHTML =
            '<p style="color: #ef4444; text-align: center; padding: 20px;">Error: Mes o año inválido</p>';
        return;
    }

    const diasTotalesMes = new Date(ano, mes, 0).getDate();
    if (!diasTotalesMes || isNaN(diasTotalesMes) || diasTotalesMes <= 0) {
        container.innerHTML =
            '<p style="color: #ef4444; text-align: center; padding: 20px;">Error calculando días del mes</p>';
        return;
    }

    const gastosFijosDia = gastosFijosMes / diasTotalesMes;

    // Crear mapa de datos por día con ingresos y costos REALES
    const diasDataMap = {};
    const recetasData = window.datosResumenMensual.ventas?.recetas || {};

    // Iterar sobre cada receta y agregar sus datos por día
    for (const [nombre, recetaInfo] of Object.entries(recetasData)) {
        for (const [diaString, diaData] of Object.entries(recetaInfo.dias || {})) {
            const fecha = new Date(diaString);
            if (isNaN(fecha.getTime())) continue;

            const key = fecha.getDate();
            if (!diasDataMap[key]) {
                diasDataMap[key] = {
                    ingresos: 0,
                    costos: 0,
                    cantidadVendida: 0,
                    tieneActividad: true
                };
            }

            diasDataMap[key].ingresos += diaData.ingresos || 0;
            diasDataMap[key].costos += diaData.coste || 0;
            diasDataMap[key].cantidadVendida += diaData.vendidas || 0;
        }
    }

    // Calcular beneficios y acumulados para TODOS los días del mes
    let html = '';
    let acumulado = 0;
    let sumaTotal = 0;
    let totalPlatosVendidos = 0;
    let diasConDatos = 0;

    // Obtener el día actual para no mostrar días futuros
    const hoy = new Date();
    const esEsteMes = mes === hoy.getMonth() + 1 && ano === hoy.getFullYear();
    const ultimoDiaMostrar = esEsteMes ? hoy.getDate() : diasTotalesMes;

    // Iterar por todos los días del mes (del 1 al último día a mostrar)
    // Todos los días restan gastos fijos - enfoque contable claro
    let beneficioRealTotal = 0;
    let diasSinActividad = 0;
    let gastosPendientes = 0;

    for (let diaNum = 1; diaNum <= ultimoDiaMostrar; diaNum++) {
        const diaData = diasDataMap[diaNum] || { ingresos: 0, costos: 0, cantidadVendida: 0 };
        const tieneActividad = diasDataMap[diaNum] !== undefined;

        const ingresos = diaData.ingresos || 0;
        const costos = diaData.costos || 0;

        // Siempre restamos gastos fijos (enfoque contable real)
        const beneficioNeto = ingresos - costos - gastosFijosDia;
        beneficioRealTotal += beneficioNeto;

        if (tieneActividad) {
            acumulado += ingresos - costos - gastosFijosDia;
            sumaTotal += ingresos - costos - gastosFijosDia;
            diasConDatos++;
        } else {
            diasSinActividad++;
            gastosPendientes += gastosFijosDia;
        }

        totalPlatosVendidos += diaData.cantidadVendida || 0;

        // Determinar icono y estilo según el estado del día
        let icono, estiloFecha, beneficioTexto;
        const colorAcumulado = beneficioRealTotal >= 0 ? '#10b981' : '#ef4444';

        if (!tieneActividad) {
            // Día cerrado - muestra el coste fijo que se resta
            icono = '🔘';
            estiloFecha = 'color: #9ca3af; font-size: 13px;';
            beneficioTexto = `<span style="color: #ef4444; font-size: 11px; margin-left: 8px;">-${gastosFijosDia.toFixed(2)}€</span>`;
        } else if (beneficioNeto >= 0) {
            icono = '✅';
            estiloFecha = 'color: #10b981; font-size: 13px;';
            beneficioTexto = `<span style="color: #10b981; font-size: 11px; margin-left: 8px;">+${beneficioNeto.toFixed(2)}€</span>`;
        } else {
            icono = '❌';
            estiloFecha = 'color: #ef4444; font-size: 13px;';
            beneficioTexto = `<span style="color: #ef4444; font-size: 11px; margin-left: 8px;">${beneficioNeto.toFixed(2)}€</span>`;
        }

        const fechaFormateada = `${diaNum}/${mes}`;

        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; ${!tieneActividad ? 'background: #f8fafc;' : ''}">
            <div>
              <span style="${estiloFecha}">${icono} ${fechaFormateada}</span>
              ${beneficioTexto}
            </div>
            <span style="color: ${colorAcumulado}; font-weight: 700; font-size: 14px;">${beneficioRealTotal.toFixed(2)} €</span>
          </div>
        `;
    }

    // ✅ NUEVO: Calcular PUNTO DE EQUILIBRIO
    let puntoEquilibrioHTML = '';
    if (window.recetas && window.recetas.length > 0 && gastosFijosMes > 0) {
        // Calcular margen promedio de todas las recetas
        let totalMargen = 0;
        window.recetas.forEach(rec => {
            const precioVenta = parseFloat(rec.precio_venta) || 0;
            let costeReceta = 0;
            if (rec.ingredientes && Array.isArray(rec.ingredientes)) {
                rec.ingredientes.forEach(ing => {
                    const ingData = window.ingredientes?.find(i => i.id === ing.ingredienteId);
                    if (ingData) {
                        costeReceta += (parseFloat(ingData.precio) || 0) * (ing.cantidad || 0);
                    }
                });
            }
            totalMargen += precioVenta - costeReceta;
        });
        const margenPromedio = totalMargen / window.recetas.length;

        // Punto de equilibrio = Gastos fijos / Margen promedio
        const puntoEquilibrio = margenPromedio > 0 ? Math.ceil(gastosFijosMes / margenPromedio) : 0;

        // Ventas del mes (cantidad total) - sumar de todas las recetas vendidas
        let ventasMes = 0;
        const recetasVendidas = window.datosResumenMensual.ventas?.recetas || {};
        for (const [nombre, data] of Object.entries(recetasVendidas)) {
            ventasMes += data.totalVendidas || 0;
        }
        const progreso =
            puntoEquilibrio > 0 ? Math.min(100, (ventasMes / puntoEquilibrio) * 100) : 0;
        const faltantes = Math.max(0, puntoEquilibrio - ventasMes);
        const ventasFaltantes = faltantes * margenPromedio;

        const progresoColor = progreso >= 100 ? '#10b981' : progreso >= 50 ? '#f59e0b' : '#ef4444';
        const progresoIcon = progreso >= 100 ? '🎉' : progreso >= 50 ? '📈' : '⚠️';

        puntoEquilibrioHTML = `
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 16px; border-radius: 12px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="color: white; font-weight: 600; font-size: 13px;">🎯 Punto de Equilibrio Mensual</span>
              <span style="color: ${progresoColor}; font-weight: 700; font-size: 14px;">${progresoIcon} ${progreso.toFixed(0)}%</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; height: 12px; overflow: hidden; margin-bottom: 12px;">
              <div style="background: linear-gradient(90deg, ${progresoColor}, ${progresoColor}99); height: 100%; width: ${progreso}%; border-radius: 8px; transition: width 0.5s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; color: rgba(255,255,255,0.8); font-size: 12px;">
              <span><strong style="color: white;">${ventasMes}</strong> / ${puntoEquilibrio} platos</span>
              <span>Margen/plato: <strong style="color: #10b981;">${margenPromedio.toFixed(2)}€</strong></span>
            </div>
            ${faltantes > 0
                ? `
              <div style="margin-top: 10px; padding: 8px; background: rgba(239, 68, 68, 0.2); border-radius: 6px; text-align: center;">
                <span style="color: #fca5a5; font-size: 12px;">Te faltan <strong style="color: white;">${faltantes} platos</strong> (~${ventasFaltantes.toFixed(0)}€ en ventas)</span>
              </div>
            `
                : `
              <div style="margin-top: 10px; padding: 8px; background: rgba(16, 185, 129, 0.2); border-radius: 6px; text-align: center;">
                <span style="color: #6ee7b7; font-size: 12px;">✅ ¡Gastos fijos cubiertos! Todo desde aquí es beneficio</span>
              </div>
            `
            }
          </div>
        `;
    }

    // Proyección (diasConDatos ya calculado arriba en el loop)
    const promedioDiario = diasConDatos > 0 ? sumaTotal / diasConDatos : 0;
    const diasRestantes = diasTotalesMes - ultimoDiaMostrar;
    const proyeccionFinMes = beneficioRealTotal + promedioDiario * diasRestantes;

    const finalColor = beneficioRealTotal >= 0 ? '#059669' : '#dc2626';
    const finalBg = beneficioRealTotal >= 0 ? '#ecfdf5' : '#fef2f2';
    const finalIcon = beneficioRealTotal >= 0 ? '✨' : '⚠️';

    // Mensaje de gastos pendientes (días cerrados)
    const gastosPendientesHTML = diasSinActividad > 0 ? `
        <div style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #fcd34d;">
          <div style="font-size: 11px; color: #92400e; text-align: center;">
            ⚠️ <strong>${diasSinActividad} días sin actividad</strong> → ${gastosPendientes.toFixed(2)}€ pendientes de cubrir
          </div>
        </div>
    ` : '';

    const headerHTML = `
        ${puntoEquilibrioHTML}
        <div style="background: ${finalBg}; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
          <div style="text-align: center; font-size: 13px; color: ${finalColor}; font-weight: 600; margin-bottom: 8px;">
            ${finalIcon} Beneficio días operativos: <strong>${acumulado.toFixed(2)}€</strong>
          </div>
          ${gastosPendientesHTML}
          <div style="text-align: center; font-size: 14px; font-weight: 700; color: ${beneficioRealTotal >= 0 ? '#059669' : '#dc2626'}; padding: 8px; background: white; border-radius: 6px; margin-bottom: 8px;">
            📊 Beneficio REAL: ${beneficioRealTotal.toFixed(2)}€
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
            <div style="text-align: center; padding: 6px; background: white; border-radius: 6px;">
              <div style="color: #64748B;">📅 Días operativos</div>
              <div style="color: #1e293b; font-weight: 700;">${diasConDatos} de ${ultimoDiaMostrar}</div>
            </div>
            <div style="text-align: center; padding: 6px; background: white; border-radius: 6px;">
              <div style="color: #64748B;">🎯 Proyección mes</div>
              <div style="color: ${proyeccionFinMes >= 0 ? '#059669' : '#dc2626'}; font-weight: 700;">${proyeccionFinMes.toFixed(2)}€</div>
            </div>
          </div>
        </div>
      `;

    container.innerHTML = headerHTML + html;
}

// ✅ PRODUCTION FIX #1: Auto-refresh de JWT Token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch (e) {
        return null;
    }
}

setInterval(
    async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const decoded = parseJwt(token);
            if (!decoded?.exp) return;
            const expiresIn = decoded.exp * 1000 - Date.now();
            if (expiresIn < 5 * 60 * 1000 && expiresIn > 0) {
                // Renovando token
                const API_BASE =
                    window.API_CONFIG?.baseUrl || 'https://lacaleta-api.mindloop.cloud';
                const response = await fetch(API_BASE + '/api/auth/refresh', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token },
                });
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('token', data.token);
                    window.showToast('Sesión renovada', 'info');
                }
            }
        } catch (e) {
            /* Auto-refresh no disponible */
        }
    },
    4 * 60 * 1000
);

// Limpiar campos de búsqueda al cargar (combate autocompletado de Chrome)
setTimeout(function () {
    [
        'busqueda-ingredientes',
        'busqueda-recetas',
        'busqueda-proveedores',
        'busqueda-pedidos',
    ].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}, 100);
