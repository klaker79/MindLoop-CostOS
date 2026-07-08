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
    const barras = []; // {dia, beneficio, activo} por día → alimenta el gráfico

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

        // Siempre restamos gastos fijos + gastos operativos del día (enfoque contable real)
        const beneficioNeto = ingresos - costos - mermaDia - comidaDia - extraDia - gastosFijosDia;
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

        // Recogemos el neto del día para el gráfico de barras (verde arriba si
        // ganas, rojo abajo si pierdes). El día sin actividad entra como pérdida
        // (solo gastos fijos) pero marcado inactivo para atenuar su barra.
        barras.push({ dia: diaNum, beneficio: beneficioNeto, activo: tieneActividad });
    }

    // El mini de "Punto de equilibrio" se movió SOLO a la pestaña Análisis
    // (Iker 2026-07-08): en el Diario mezclaba el gasto fijo/día (coste) con el
    // objetivo de ventas/día del equilibrio y confundía. Sigue en Análisis vía
    // window.mlBreakevenGetSnapshot.

    // Proyección (diasConDatos ya calculado arriba en el loop)
    const promedioDiario = diasConDatos > 0 ? sumaTotal / diasConDatos : 0;
    const diasRestantes = diasTotalesMes - ultimoDiaMostrar;
    const proyeccionFinMes = beneficioRealTotal + promedioDiario * diasRestantes;

    // ── GRÁFICO "Beneficio neto por día": barras divergentes (verde arriba =
    // ganas, rojo abajo = pierdes) + titular grande. Sustituye la lista de texto
    // anterior para que se lea de un vistazo. NO cambia ningún cálculo, solo la
    // presentación (Iker 2026-07-08). El día sin ventas entra como barra roja
    // atenuada (solo carga gastos fijos).
    const maxAbs = barras.reduce((m, b) => Math.max(m, Math.abs(b.beneficio)), 0) || 1;
    const mostrarEtiquetas = barras.length <= 12; // con muchos días, solo tooltip
    const colorMes = beneficioRealTotal >= 0 ? '#34d399' : '#f87171';
    const anchoMin = Math.max(320, barras.length * 26);

    const mejor = barras.reduce((a, b) => (b.beneficio > a.beneficio ? b : a), { beneficio: -Infinity, dia: 0 });
    const peor = barras.reduce((a, b) => (b.beneficio < a.beneficio ? b : a), { beneficio: Infinity, dia: 0 });

    const fmt = (n) => `${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('es-ES')}`;

    const barrasHTML = barras.map(b => {
        const h = Math.max(2, Math.round((Math.abs(b.beneficio) / maxAbs) * 100));
        const positivo = b.beneficio >= 0 && b.activo;
        const grad = positivo ? 'linear-gradient(180deg,#34d399,#10b981)' : 'linear-gradient(180deg,#ef4444,#b91c1c)';
        const radio = positivo ? '5px 5px 2px 2px' : '2px 2px 5px 5px';
        const etiqueta = mostrarEtiquetas
            ? `<span style="position:absolute;left:50%;transform:translateX(-50%);${positivo ? 'top:-15px;color:#34d399;' : 'bottom:-15px;color:#f87171;'}font-size:10px;font-weight:700;white-space:nowrap;">${fmt(b.beneficio)}</span>`
            : '';
        const barra = `<div title="${b.dia}/${mes}: ${cm(b.beneficio)}" style="width:72%;max-width:30px;height:${h}%;background:${grad};opacity:${b.activo ? '1' : '0.5'};border-radius:${radio};position:relative;">${etiqueta}</div>`;
        return `<div style="flex:1;min-width:20px;display:flex;flex-direction:column;height:180px;">`
            + `<div style="flex:1;display:flex;align-items:flex-end;justify-content:center;">${positivo ? barra : ''}</div>`
            + `<div style="flex:1;display:flex;align-items:flex-start;justify-content:center;border-top:1px solid rgba(255,255,255,0.14);">${!positivo ? barra : ''}</div>`
            + `</div>`;
    }).join('');

    const ejeHTML = barras.map(b => `<span style="flex:1;min-width:20px;text-align:center;font-size:10px;color:#8595ad;font-weight:600;">${b.dia}</span>`).join('');

    // Línea de ACUMULADO del mes sobre las barras: sube cuando ganas, baja
    // cuando pierdes → es lo que antes mostraba la lista día a día (el arrastre).
    // Escala propia (el acumulado crece más que un día suelto), etiquetada aparte.
    let _acc = 0;
    const acumulados = barras.map(b => (_acc += b.beneficio));
    const maxAbsCum = Math.max(1, ...acumulados.map(v => Math.abs(v)));
    const nCol = barras.length || 1;
    const xPct = (i) => ((i + 0.5) / nCol) * 100;      // % del ancho
    const yPx = (v) => 90 - (v / maxAbsCum) * 86;      // alto de barras = 180px, centro = 90
    const puntosLinea = acumulados.map((v, i) => `${xPct(i).toFixed(2)},${yPx(v).toFixed(2)}`).join(' ');
    const lineaSVG = `<svg viewBox="0 0 100 180" preserveAspectRatio="none" style="position:absolute;top:0;left:0;width:100%;height:180px;pointer-events:none;overflow:visible;"><polyline points="${puntosLinea}" fill="none" stroke="#7dd3fc" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
    const dotsHTML = acumulados.map((v, i) => {
        const etq = mostrarEtiquetas
            ? `<span style="position:absolute;left:50%;bottom:11px;transform:translateX(-50%);white-space:nowrap;font-size:9.5px;font-weight:700;color:#bae6fd;background:rgba(15,23,42,0.8);padding:1px 5px;border-radius:5px;">${fmt(v)}</span>`
            : '';
        return `<div title="Acumulado ${barras[i].dia}/${mes}: ${cm(v)}" style="position:absolute;left:${xPct(i).toFixed(2)}%;top:${yPx(v).toFixed(2)}px;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#7dd3fc;border:2px solid #0f172a;">${etq}</div>`;
    }).join('');

    const notaHTML = diasSinActividad > 0
        ? `<div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:9px 13px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:9px;color:#fcd9a0;font-size:12.5px;">⚠️ <span><strong style="color:#fde9c7;">${window.t('balance:net_profit_inactive_days', { count: diasSinActividad })}</strong> → ${window.t('balance:net_profit_pending', { amount: gastosPendientes.toFixed(2) })}</span></div>`
        : '';

    const stat = (k, v, color) => `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:11px 13px;"><div style="font-size:10.5px;color:#8595ad;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">${k}</div><div style="font-size:16px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums;color:${color};">${v}</div></div>`;

    container.innerHTML = `
      <div style="background:linear-gradient(160deg,#14294a 0%,#0f172a 100%);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;box-shadow:0 12px 30px -14px rgba(2,8,20,0.5);">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px;">
          <div>
            <div style="font-size:11.5px;color:#93a2b7;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Beneficio real del mes</div>
            <div style="font-size:38px;font-weight:800;line-height:1;letter-spacing:-0.02em;color:${colorMes};font-variant-numeric:tabular-nums;">${cm(beneficioRealTotal)}</div>
          </div>
          <div style="text-align:right;color:#c7d3e6;font-size:12px;line-height:1.7;">
            ${isFinite(mejor.beneficio) && mejor.dia ? `Mejor día · <strong style="color:#fff;">${fmt(mejor.beneficio)} €</strong> (${mejor.dia}/${mes})<br>` : ''}
            ${isFinite(peor.beneficio) && peor.dia ? `Peor día · <strong style="color:#fff;">${fmt(peor.beneficio)} €</strong> (${peor.dia}/${mes})` : ''}
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 10px 8px;overflow-x:auto;">
          <div style="position:relative;min-width:${anchoMin}px;">
            <div style="display:flex;gap:8px;">${barrasHTML}</div>
            ${lineaSVG}
            ${dotsHTML}
          </div>
          <div style="display:flex;gap:8px;min-width:${anchoMin}px;margin-top:10px;">${ejeHTML}</div>
        </div>

        <div style="display:flex;gap:16px;justify-content:center;margin-top:12px;font-size:11.5px;color:#93a2b7;">
          <span><i style="width:10px;height:10px;border-radius:3px;display:inline-block;background:#10b981;margin-right:5px;vertical-align:-1px;"></i>Día en beneficio</span>
          <span><i style="width:10px;height:10px;border-radius:3px;display:inline-block;background:#ef4444;margin-right:5px;vertical-align:-1px;"></i>Día en pérdida</span>
          <span><span style="display:inline-block;width:16px;height:0;border-top:2px solid #7dd3fc;margin-right:5px;vertical-align:3px;"></span>Acumulado del mes</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px;">
          ${stat(window.t('balance:net_profit_operating_days'), `${diasConDatos} / ${ultimoDiaMostrar}`, '#fff')}
          ${stat('Acumulado', cm(beneficioRealTotal), colorMes)}
          ${stat(window.t('balance:net_profit_projection'), cm(proyeccionFinMes), '#fff')}
        </div>

        ${notaHTML}
      </div>
    `;
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
