// MindLoop CostOS - Modales v2.1.0 - Build 2026-01-01T20:18:00Z
/* global cm -- defined via window.cm in main.js */
window.confirmarEliminacion = function (config) {
    return new Promise(resolve => {
        const modal = document.getElementById('modal-confirmacion');
        const titulo = document.getElementById('confirm-titulo');
        const mensaje = document.getElementById('confirm-mensaje');
        const btnConfirmar = document.getElementById('btn-confirmar-eliminar');

        // 🔒 FIX: Verificar que elementos existan antes de usarlos
        if (!modal || !titulo || !mensaje || !btnConfirmar) {
            console.error('❌ Error: Elementos del modal de confirmación no encontrados');
            window.showToast?.('Error mostrando confirmación', 'error');
            resolve(false);
            return;
        }

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
            const costeDiario = parseFloat(g.monto_mensual) / 30;
            return `<tr>
            <td><strong>${escapeHTML(g.concepto)}</strong></td>
            <td>${cm(parseFloat(g.monto_mensual))}</td>
            <td>${cm(costeDiario)}</td>
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
    // fix B4: usar días reales del mes en vez de 30 fijo
    const hoy = new Date();
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const totalDiario = totalMensual / diasMes;

    const elemMensual = document.getElementById('total-mensual-gastos');
    const elemDiario = document.getElementById('total-diario-gastos');
    if (elemMensual) elemMensual.textContent = cm(totalMensual);
    if (elemDiario) elemDiario.textContent = cm(totalDiario);
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
    if (elemGastos) elemGastos.textContent = cm(gastosDiario);
 
    const beneficioBrutoMensual = parseFloat(document.getElementById('diario-beneficio')?.textContent || '0');
    const beneficioBrutoDiario = beneficioBrutoMensual / 30;
    const beneficioReal = beneficioBrutoDiario - gastosDiario;
 
    const elemBeneficio = document.getElementById('diario-beneficio-real');
    const cardBeneficio = document.getElementById('card-beneficio-real');
 
    if (elemBeneficio) elemBeneficio.textContent = cm(beneficioReal);
    if (cardBeneficio) {
      cardBeneficio.className = beneficioReal < 0 ? 'stat-card red' : 'stat-card green';
    }
  } catch (error) {
    console.error('Error:', error);
  }
}
 
setInterval(actualizarBeneficioRealDiario, 2000);
*/

// ============ FINANZAS: Gastos Fijos desde BD ============
// Nota: los sliders ya NO son hardcoded (alquiler/personal/suministros/otros).
// Las barras se generan dinámicamente desde src/modules/balance/gastos-fijos-dinamico.js
// leyendo `gastos_fijos` de BD. El cache y el cálculo del total (genérico) se
// mantienen aquí porque son usados por otros módulos legacy (renderizarBeneficioNetoDiario, etc.).

// Cache para evitar llamadas repetidas a la API
let gastosFijosCache = null;
let gastosFijosCacheTime = 0;
const CACHE_TTL = 5000; // 5 segundos

// ⚡ API BASE URL - 🔧 FIX: Lazy resolution (window.API_CONFIG se configura DESPUÉS por main.js)
function getGastosApiBase() {
    return (window.API_CONFIG?.baseUrl ?? 'https://lacaleta-api.mindloop.cloud') + '/api';
}

function getGastosAuthHeaders() {
    // 🔒 SECURITY: Dual-mode auth — cookie + in-memory Bearer (NOT localStorage)
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? window.authToken : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function fetchGastosFijos() {
    const now = Date.now();
    if (gastosFijosCache && (now - gastosFijosCacheTime) < CACHE_TTL) {
        return gastosFijosCache;
    }
    try {
        const res = await fetch(getGastosApiBase() + '/gastos-fijos', {
            headers: getGastosAuthHeaders(),
            credentials: 'include'
        });
        if (!res.ok) throw new Error('Error fetching gastos fijos');
        const gastos = await res.json();
        gastosFijosCache = gastos;
        gastosFijosCacheTime = now;
        return gastos;
    } catch (error) {
        console.error('Error fetching gastos fijos:', error);
        return gastosFijosCache || [];
    }
}

// window.guardarGastoFinanzas ya no se usa (las barras hardcoded se eliminaron).
// Dejamos un no-op por seguridad por si queda algún handler inline en cache.
window.guardarGastoFinanzas = function () { /* deprecated, kept for safety */ };

// ✅ Función centralizada única para calcular gastos fijos (desde BD)
async function calcularTotalGastosFijos() {
    try {
        const gastos = await fetchGastosFijos();

        if (!gastos || !Array.isArray(gastos)) {
            console.warn('Datos de gastos fijos inválidos');
            return 0;
        }

        const total = gastos.reduce((sum, g) => sum + (parseFloat(g.monto_mensual) || 0), 0);

        if (isNaN(total) || total < 0) {
            console.error('Error: Gastos fijos inválidos', gastos);
            return 0;
        }

        return total;
    } catch (error) {
        console.error('Error calculando gastos fijos:', error);
        return 0;
    }
}

// ✅ Gastos fijos OPERATIVOS (de explotación): excluye impuestos NO operativos
// (IVA/IGIC/IRPF/Sociedades) pero MANTIENE el IAE, IBI, tasas, licencias… Es lo
// que debe alimentar el P&L (beneficio neto) y el punto de equilibrio, para que
// ambos cuadren. Usa la MISMA regla que el bloque de Análisis
// (window.mlSumaGastosOperativos). Si el módulo ESM aún no cargó, cae al total
// completo (comportamiento antiguo) para no romper.
async function calcularGastosFijosOperativos() {
    try {
        const gastos = await fetchGastosFijos();
        if (!gastos || !Array.isArray(gastos)) return 0;
        const suma = typeof window.mlSumaGastosOperativos === 'function'
            ? window.mlSumaGastosOperativos(gastos)
            : gastos.reduce((sum, g) => sum + (parseFloat(g.monto_mensual) || 0), 0);
        return (isNaN(suma) || suma < 0) ? 0 : suma;
    } catch (error) {
        console.error('Error calculando gastos fijos operativos:', error);
        return 0;
    }
}

// Actualizar el display del total (usa la función centralizada)
async function actualizarTotalGastosFijos() {
    try {
        const total = await calcularTotalGastosFijos();
        const elem = document.getElementById('diario-gastos-fijos-total');
        if (elem) {
            elem.textContent = cm(total);
        }
    } catch (error) {
        console.error('Error actualizando display:', error);
    }
}

// Backwards-compat shim: callers still use `window.cargarValoresGastosFijos()` (core.js tab switch,
// balance/index.js, etc.). Now it re-renders the dynamic widget + updates the total.
window.cargarValoresGastosFijos = async function () {
    if (typeof window.renderizarGastosFijosDinamicos === 'function') {
        await window.renderizarGastosFijosDinamicos();
    } else {
        // Fallback: at least refresh the total if the dynamic module hasn't loaded yet.
        await actualizarTotalGastosFijos();
    }
};

// Llamar al cargar la página SOLO si hay sesión activa
setTimeout(function () {
    if (window.authToken || sessionStorage.getItem('_at')) {
        window.cargarValoresGastosFijos();
    }
}, 1000);

// ✅ Renderizar beneficio neto ACUMULADO por día (VERSIÓN PRO con Punto de Equilibrio)
async function renderizarBeneficioNetoDiario() {
    const container = document.getElementById('beneficio-neto-diario-lista');
    if (!container) return;

    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML =
            '<p style="color: #64748B; margin: 0; text-align: center; padding: 20px;">Carga un mes para ver los datos</p>';
        return;
    }

    const dias = window.datosResumenMensual.dias;
    // P&L operativo: usa gastos fijos OPERATIVOS (sin IVA/IRPF/Sociedades), igual
    // que el punto de equilibrio → el beneficio neto refleja la realidad y cuadra.
    let gastosFijosMes = await calcularGastosFijosOperativos();

    // ✅ VALIDACIÓN DEFENSIVA: Prevenir NaN en todos los edge cases
    if (typeof gastosFijosMes !== 'number' || isNaN(gastosFijosMes) || gastosFijosMes < 0) {
        console.warn('Gastos fijos inválidos, usando 0:', gastosFijosMes);
        gastosFijosMes = 0;
    }

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

    let gastosFijosDia = gastosFijosMes / diasTotalesMes;

    // ✅ VALIDACIÓN DEFENSIVA: Garantizar que gastosFijosDia sea válido
    if (!isFinite(gastosFijosDia) || isNaN(gastosFijosDia)) {
        gastosFijosDia = 0;
    }

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

        // 🔗 Mismos componentes que la tabla P&L (única fuente de verdad): además
        // de los gastos fijos, restamos mermas, comida de personal y personal extra
        // del día, para que el beneficio neto diario cuadre con la Cuenta de
        // Resultados. Los mapas (clave YYYY-MM-DD) los expone renderizarTablaPLDiario.
        const _ymd = `${ano}-${String(mes).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
        const mermaDia = (window.plMermasPorDia && window.plMermasPorDia[_ymd]) || 0;
        const comidaDia = (window.plComidaPersonalPorDia && window.plComidaPersonalPorDia[_ymd]) || 0;
        const extraDia = (window.plPersonalExtraPorDia && window.plPersonalExtraPorDia[_ymd]) || 0;

        // 📐 Criterio Iker 2026-07-08 (el MISMO que la Cuenta de Resultados):
        // el gasto fijo diario se descuenta SOLO en los días con ventas; un día
        // cerrado no carga fijos. Así el acumulado de este widget cuadra con el
        // TOTAL MES de la tabla P&L y con Omnes (resumen_pyg, mismo criterio).
        // Los gastos CON FECHA de un día cerrado (mermas, comida personal,
        // extras) sí restan: son dinero real de ese día.
        const fijosDelDia = tieneActividad ? gastosFijosDia : 0;
        const beneficioNeto = ingresos - costos - mermaDia - comidaDia - extraDia - fijosDelDia;
        beneficioRealTotal += beneficioNeto;

        if (tieneActividad) {
            acumulado += beneficioNeto;
            sumaTotal += beneficioNeto;
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
            // Día cerrado — sin gasto fijo (criterio 2026-07-08). Solo muestra
            // gastos CON FECHA de ese día (mermas, comida personal, extras),
            // normalmente 0.
            icono = '🔘';
            estiloFecha = 'color: #9ca3af; font-size: 13px;';
            beneficioTexto = `<span style="color: #ef4444; font-size: 11px; margin-left: 8px;">${cm(beneficioNeto)}</span>`;
        } else if (beneficioNeto >= 0) {
            icono = '✅';
            estiloFecha = 'color: #10b981; font-size: 13px;';
            beneficioTexto = `<span style="color: #10b981; font-size: 11px; margin-left: 8px;">+${cm(beneficioNeto)}</span>`;
        } else {
            icono = '❌';
            estiloFecha = 'color: #ef4444; font-size: 13px;';
            beneficioTexto = `<span style="color: #ef4444; font-size: 11px; margin-left: 8px;">${cm(beneficioNeto)}</span>`;
        }

        const fechaFormateada = `${diaNum}/${mes}`;

        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f1f5f9; ${!tieneActividad ? 'background: #f8fafc;' : ''}">
            <div>
              <span style="${estiloFecha}">${icono} ${fechaFormateada}</span>
              ${beneficioTexto}
            </div>
            <span style="color: ${colorAcumulado}; font-weight: 700; font-size: 14px;">${cm(beneficioRealTotal)}</span>
          </div>
        `;
    }

    // ✅ PUNTO DE EQUILIBRIO — mini compacto. Usa el MISMO cálculo que el
    // bloque grande de Análisis (margen ponderado por ventas reales) vía
    // window.mlBreakevenGetSnapshot, para que los números cuadren entre
    // las dos pantallas. Si el módulo no cargó, cae al cálculo simple viejo.
    let puntoEquilibrioHTML = '';
    try {
        const snap = typeof window.mlBreakevenGetSnapshot === 'function'
            ? await window.mlBreakevenGetSnapshot()
            : null;
        if (snap && snap.estado === 'ok' && snap.breakevenPlatosMes > 0) {
            let unidadesMes = 0;
            const vendidas = window.datosResumenMensual.ventas?.recetas || {};
            for (const nombre in vendidas) {
                unidadesMes += parseFloat(vendidas[nombre]?.totalVendidas) || 0;
            }
            const be = snap.breakevenPlatosMes;
            const progreso = Math.min(100, (unidadesMes / be) * 100);
            const faltantes = Math.max(0, be - unidadesMes);
            const faltantesEuros = faltantes * snap.ticketMedio;
            // Etiqueta honesta del periodo: "este mes" SOLO si lo cargado es el
            // mes actual; si el usuario cargó un mes pasado, se nombra (07/2026).
            const _drmMini = window.datosResumenMensual || {};
            const _hoyMini = new Date();
            const _esMesActualMini = parseInt(_drmMini.mes) === _hoyMini.getMonth() + 1
                && parseInt(_drmMini.ano) === _hoyMini.getFullYear();
            const etiquetaMes = _esMesActualMini
                ? 'este mes'
                : `en ${String(_drmMini.mes || '?').padStart(2, '0')}/${_drmMini.ano || ''}`;
            // Franja superior navy del branding CosteOS (número €/día en verde
            // dinero) + cuerpo claro. La barra y el "faltan" llevan el color de
            // estado (verde/ámbar/rojo) según el progreso.
            const cubierto = faltantes <= 0;
            const accent = cubierto ? '#10b981' : progreso >= 60 ? '#f59e0b' : '#ef4444';
            const pie = cubierto
                ? '✅ Gastos fijos cubiertos'
                : `faltan <strong style="color:${accent};">${faltantes.toLocaleString('es-ES')}</strong> platos (~${cm(faltantesEuros)})`;
            puntoEquilibrioHTML = `
              <div style="border: 1px solid #e5e8ee; border-radius: 12px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(15,23,42,0.06);">
                <div style="background: linear-gradient(135deg, #14294a 0%, #0f172a 100%); padding: 11px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                  <span style="color: #fff; font-weight: 700; font-size: 13px;">🎯 Punto de equilibrio</span>
                  <span style="color: #34d399; font-weight: 800; font-size: 19px; line-height: 1;">${cm(snap.ventasEquilibrioDia)}<span style="font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.6);"> / día</span></span>
                </div>
                <div style="padding: 12px 16px; background: #fff;">
                  <div style="background: #eef1f6; border-radius: 999px; height: 8px; overflow: hidden; margin-bottom: 8px;">
                    <div style="background: ${accent}; height: 100%; width: ${progreso}%; border-radius: 999px; transition: width 0.5s;"></div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; color: #64748b;">
                    <span><strong style="color: #1e293b;">${unidadesMes.toLocaleString('es-ES')}</strong> / ${be.toLocaleString('es-ES')} platos ${etiquetaMes} · ${progreso.toFixed(0)}%</span>
                    <span>${pie}</span>
                  </div>
                  <div style="margin-top: 7px; font-size: 11px; color: #94a3b8;">Detalle y palancas en la pestaña Análisis →</div>
                </div>
              </div>
            `;
        }
    } catch (e) {
        console.warn('[diario] breakeven mini falló, uso fallback:', e?.message);
    }

    // Fallback: cálculo simple antiguo (solo si el snapshot no está disponible).
    if (!puntoEquilibrioHTML && window.recetas && window.recetas.length > 0 && gastosFijosMes > 0) {
        // Calcular margen promedio de todas las recetas
        let totalMargen = 0;
        window.recetas.forEach(rec => {
            const precioVenta = parseFloat(rec.precio_venta) || 0;
            let costeReceta = 0;
            if (rec.ingredientes && Array.isArray(rec.ingredientes)) {
                rec.ingredientes.forEach(ing => {
                    const ingData = window.ingredientes?.find(i => i.id === ing.ingredienteId);
                    if (ingData) {
                        // fix C3: precio es por FORMATO → dividir por cantidad_por_formato para obtener precio unitario
                        const cpf = parseFloat(ingData.cantidad_por_formato) || 1;
                        const precioUnitario = (parseFloat(ingData.precio) || 0) / cpf;
                        costeReceta += precioUnitario * (ing.cantidad || 0);
                    }
                });
            }
            totalMargen += precioVenta - costeReceta;
        });
        // 🔒 FIX: Proteger división por cero si no hay recetas
        const margenPromedio = window.recetas?.length > 0
            ? totalMargen / window.recetas.length
            : 0;

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
              <span style="color: white; font-weight: 600; font-size: 13px;">${window.t('balance:breakeven_title')}</span>
              <span style="color: ${progresoColor}; font-weight: 700; font-size: 14px;">${progresoIcon} ${progreso.toFixed(0)}%</span>
            </div>
            <div style="background: rgba(255,255,255,0.1); border-radius: 8px; height: 12px; overflow: hidden; margin-bottom: 12px;">
              <div style="background: linear-gradient(90deg, ${progresoColor}, ${progresoColor}99); height: 100%; width: ${progreso}%; border-radius: 8px; transition: width 0.5s;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; color: rgba(255,255,255,0.8); font-size: 12px;">
              <span><strong style="color: white;">${ventasMes}</strong> / ${puntoEquilibrio} ${window.t('balance:breakeven_dishes')}</span>
              <span>${window.t('balance:breakeven_margin_dish')} <strong style="color: #10b981;">${cm(margenPromedio)}</strong></span>
            </div>
            ${faltantes > 0
                ? `
              <div style="margin-top: 10px; padding: 8px; background: rgba(239, 68, 68, 0.2); border-radius: 6px; text-align: center;">
                <span style="color: #fca5a5; font-size: 12px;">${window.t('balance:breakeven_missing', { count: faltantes, amount: ventasFaltantes.toFixed(0) })}</span>
              </div>
            `
                : `
              <div style="margin-top: 10px; padding: 8px; background: rgba(16, 185, 129, 0.2); border-radius: 6px; text-align: center;">
                <span style="color: #6ee7b7; font-size: 12px;">${window.t('balance:breakeven_covered')}</span>
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
            ⚠️ <strong>${window.t('balance:net_profit_inactive_days', { count: diasSinActividad })}</strong> → ${window.t('balance:net_profit_pending', { amount: gastosPendientes.toFixed(2) })}
          </div>
        </div>
    ` : '';

    const headerHTML = `
        ${puntoEquilibrioHTML}
        <div style="background: ${finalBg}; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
          <div style="text-align: center; font-size: 13px; color: ${finalColor}; font-weight: 600; margin-bottom: 8px;">
            ${finalIcon} ${window.t('balance:net_profit_operating')} <strong>${cm(acumulado)}</strong>
          </div>
          ${gastosPendientesHTML}
          <div style="text-align: center; font-size: 14px; font-weight: 700; color: ${beneficioRealTotal >= 0 ? '#059669' : '#dc2626'}; padding: 8px; background: white; border-radius: 6px; margin-bottom: 8px;">
            ${window.t('balance:net_profit_real')} ${cm(beneficioRealTotal)}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
            <div style="text-align: center; padding: 6px; background: white; border-radius: 6px;">
              <div style="color: #64748B;">${window.t('balance:net_profit_operating_days')}</div>
              <div style="color: #1e293b; font-weight: 700;">${diasConDatos} ${window.t('balance:net_profit_of')} ${ultimoDiaMostrar}</div>
            </div>
            <div style="text-align: center; padding: 6px; background: white; border-radius: 6px;">
              <div style="color: #64748B;">${window.t('balance:net_profit_projection')}</div>
              <div style="color: ${proyeccionFinMes >= 0 ? '#059669' : '#dc2626'}; font-weight: 700;">${cm(proyeccionFinMes)}</div>
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

// 🔒 SECURITY: Token refresh via cookie-based session
// The httpOnly cookie is managed by the backend.
// No need for client-side token refresh — the backend handles session validity.
function startTokenRefresh() {
    // Limpiar interval anterior si existe
    if (window._tokenRefreshInterval) {
        clearInterval(window._tokenRefreshInterval);
    }

    window._tokenRefreshInterval = setInterval(
        async () => {
            try {
                // Use the verify endpoint to check session validity
                const API_BASE =
                    window.API_CONFIG?.baseUrl ?? 'https://lacaleta-api.mindloop.cloud';
                const response = await fetch(API_BASE + '/api/auth/verify', {
                    credentials: 'include',
                    headers: Object.assign({}, window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {})
                });
                if (!response.ok) {
                    // Session expired — redirect to login
                    console.warn('🔒 Session expired, redirecting to login');
                    window.dispatchEvent(new CustomEvent('auth:expired'));
                    if (!window.location.pathname.includes('login')) {
                        window.location.href = '/login.html';
                    }
                }
            } catch (e) {
                /* Network error — skip */
            }
        },
        4 * 60 * 1000
    );
}

// 🔒 FIX: Función para limpiar el interval al logout
window.stopTokenRefresh = function () {
    if (window._tokenRefreshInterval) {
        clearInterval(window._tokenRefreshInterval);
        window._tokenRefreshInterval = null;
    }
};

// Iniciar session check si hay cookie de auth
// fix M4: usar authToken/sessionStorage en vez de localStorage
if (window.authToken || sessionStorage.getItem('_at')) {
    startTokenRefresh();
}

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
