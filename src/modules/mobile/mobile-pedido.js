/**
 * Order-guide móvil (Fase 3 del rediseño) — CosteOS.
 *
 * Flujo: "Nuevo pedido" → elegir proveedor → "lo que le pides siempre" (sacado
 * del HISTORIAL de pedidos a ese proveedor, con la última cantidad y su formato)
 * → ajustar con +/– (0 = quitar) → "Revisar y enviar" → crea el pedido pendiente.
 *
 * Es una CAPA MÓVIL aislada: NO toca el formulario de escritorio
 * (mostrarFormularioPedido/guardarPedido). Reutiliza la MISMA API que ya crea
 * pedidos (window.api.createPedido), la que usan el carrito, el Smart Order y
 * "volver a pedir". El humano revisa y envía; no se manda nada solo.
 */

import { escapeHTML, cm } from '../../utils/helpers.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';

const OV_ID = 'ml-pedido-ov';
let estado = { provId: null, provNombre: '', lineas: [] };

function cerrar() { document.getElementById(OV_ID)?.remove(); }

function ctxFmt(ing) {
    const cpfRaw = parseFloat(ing?.cantidad_por_formato);
    const cpf = cpfRaw > 1 ? cpfRaw : 1;
    return { cpf, formato: ing?.formato_compra, unidad: ing?.unidad || '' };
}

// Último pedido de cada ingrediente a ESTE proveedor (cantidad y precio en base).
function historialProveedor(provId) {
    const map = new Map();
    const pedidos = (window.pedidos || [])
        .filter((p) => (p.proveedor_id ?? p.proveedorId) === provId)
        .sort((a, b) => (new Date(b.fecha) - new Date(a.fecha)) || (b.id - a.id));
    for (const p of pedidos) {
        for (const it of (p.ingredientes || [])) {
            if (it.tipo === 'ajuste') continue;
            const id = it.ingredienteId ?? it.ingrediente_id;
            if (id === null || id === undefined || map.has(id)) continue;
            map.set(id, {
                cantidad: parseFloat(it.cantidadRecibida ?? it.cantidad ?? 0) || 0,
                // Las líneas de pedido del backend guardan el precio en `precio`.
                precio: parseFloat(it.precioReal ?? it.precioUnitario ?? it.precio_unitario ?? it.precio ?? 0) || 0,
            });
        }
    }
    return map;
}

// Construye una línea del order-guide a partir de un ingrediente. precioBaseUd =
// €/unidad base (para GUARDAR); precioDisplay = €/formato (para MOSTRAR y el total,
// coherente con la cantidad en cajas). Así los números cuadran (no se multiplica de más).
function lineaDesdeIngrediente(ing, cantDisplay = 0) {
    const { cpf, formato, unidad } = ctxFmt(ing);
    // Si tiene formato de compra (CAJA, GARRAFA…) se pide en ese formato.
    const usaFormato = cpf > 1 && !!formato;
    let precioBaseUd = 0;
    try { precioBaseUd = parseFloat(getIngredientUnitPrice(ing)) || 0; } catch { precioBaseUd = 0; }
    if (!(precioBaseUd > 0)) precioBaseUd = (parseFloat(ing.precio) || 0) / cpf;
    const precioDisplay = usaFormato ? precioBaseUd * cpf : precioBaseUd;
    return {
        ingredienteId: ing.id,
        nombre: ing.nombre || 'Ingrediente',
        usaFormato,
        cpf,
        unidadLabel: usaFormato ? formato : unidad,
        precioBaseUd,
        precioDisplay,
        cantDisplay,
    };
}

function construirLineas(provId) {
    const ingMap = new Map((window.ingredientes || []).map((i) => [i.id, i]));
    const hist = historialProveedor(provId);
    const lineas = [];
    for (const id of hist.keys()) {
        const ing = ingMap.get(id);
        if (!ing) continue;
        lineas.push(lineaDesdeIngrediente(ing, 0)); // EN BLANCO: cantidades a mano o por voz
    }
    return lineas;
}

function totalActual() {
    // cantidad (en formato) × precio (€/formato). Coherente con lo que se muestra.
    return estado.lineas.reduce((s, l) => s + (l.cantDisplay * l.precioDisplay), 0);
}

// ---------- Paso 1: elegir proveedor ----------
function renderSelectorProveedor() {
    const provs = (window.proveedores || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    // Proveedores con historial primero (los que sueles pedir).
    const conHist = new Set((window.pedidos || []).map((p) => p.proveedor_id ?? p.proveedorId));
    provs.sort((a, b) => (conHist.has(b.id) ? 1 : 0) - (conHist.has(a.id) ? 1 : 0));

    const filas = provs.map((p) => `
        <button type="button" class="mlp-prov" data-pid="${p.id}">
          <span class="mlp-prov-av">🚚</span>
          <span class="mlp-prov-nm">${escapeHTML(p.nombre || 'Proveedor')}</span>
          ${conHist.has(p.id) ? '<span class="mlp-prov-tag">habitual</span>' : ''}
        </button>`).join('');

    return `
      <div class="mlp-head">
        <button type="button" class="mlp-x" data-act="cerrar">✕</button>
        <div class="mlp-title">Nuevo pedido</div>
      </div>
      <div class="mlp-sub">¿A qué proveedor le pides?</div>
      <div class="mlp-body">${filas || '<p class="mlp-empty">No tienes proveedores. Créalos en el ordenador.</p>'}</div>`;
}

// ---------- Paso 2: order-guide ----------
function renderGuide() {
    const filas = estado.lineas.map((l, i) => `
        <div class="mlp-item">
          <div class="mlp-item-tt">
            <b>${escapeHTML(l.nombre)}</b>
            <small>${cm(l.precioDisplay)}${l.unidadLabel ? '/' + escapeHTML(l.unidadLabel) : ''}</small>
          </div>
          <div class="mlp-step">
            <button type="button" class="mlp-b" data-op="menos" data-i="${i}">–</button>
            <span class="mlp-n" id="mlp-n-${i}">${l.cantDisplay}</span>
            <button type="button" class="mlp-b" data-op="mas" data-i="${i}">+</button>
            <small class="mlp-u">${escapeHTML(l.unidadLabel || '')}</small>
          </div>
        </div>`).join('');

    const cuerpo = estado.lineas.length
        ? filas
        : `<p class="mlp-empty">Aún no le has pedido nada a <b>${escapeHTML(estado.provNombre)}</b>.<br>Usa el pedido normal para el primero.</p>`;

    return `
      <div class="mlp-head">
        <button type="button" class="mlp-x" data-act="volver">‹</button>
        <div class="mlp-title">${escapeHTML(estado.provNombre)}</div>
        <button type="button" class="mlp-x" data-act="cerrar">✕</button>
      </div>
      <div class="mlp-sub">Tus productos de este proveedor · pon las cantidades (a mano o 🎙️)</div>
      ${estado.lineas.length ? '<div class="mlp-vozbar"><button type="button" id="mlp-voz-btn" data-act="voz" class="mlp-voz">🎙️ Dictar</button></div>' : ''}
      <div class="mlp-body">${cuerpo}</div>
      ${estado.lineas.length ? `<div class="mlp-footer"><button type="button" class="mlp-send" data-act="enviar">Revisar y enviar · <span id="mlp-total">${cm(totalActual())}</span></button></div>` : ''}`;
}

function pintar(html) {
    let ov = document.getElementById(OV_ID);
    if (!ov) {
        ov = document.createElement('div');
        ov.id = OV_ID;
        ov.className = 'mlp-ov';
        document.body.appendChild(ov);
        ov.addEventListener('click', onClick);
    }
    ov.innerHTML = `<div class="mlp-sheet">${html}</div>`;
}

function elegirProveedor(pid) {
    const prov = (window.proveedores || []).find((p) => p.id === pid);
    estado = { provId: pid, provNombre: prov ? prov.nombre : 'Proveedor', lineas: construirLineas(pid) };
    pintar(renderGuide());
}

function ajustar(i, op) {
    const l = estado.lineas[i];
    if (!l) return;
    const paso = 1;
    l.cantDisplay = Math.max(0, Math.round((l.cantDisplay + (op === 'mas' ? paso : -paso)) * 100) / 100);
    const n = document.getElementById('mlp-n-' + i);
    if (n) n.textContent = l.cantDisplay;
    const tot = document.getElementById('mlp-total');
    if (tot) tot.textContent = cm(totalActual());
}

async function enviar() {
    const ingredientes = estado.lineas
        .filter((l) => l.cantDisplay > 0)
        .map((l) => {
            const cantidadBase = l.cantDisplay * (l.usaFormato ? l.cpf : 1);
            return {
                ingredienteId: l.ingredienteId,
                ingrediente_id: l.ingredienteId,
                cantidad: cantidadBase,
                precio_unitario: l.precioBaseUd,
                precioUnitario: l.precioBaseUd,
            };
        });
    if (!ingredientes.length) { window.showToast?.('Pon alguna cantidad antes de enviar.', 'warning'); return; }
    const total = ingredientes.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    window.showLoading?.();
    try {
        await window.api.createPedido({
            proveedorId: estado.provId,
            proveedor_id: estado.provId,
            fecha: new Date().toISOString().split('T')[0],
            ingredientes,
            total,
            estado: 'pendiente',
        });
        await window.cargarDatos?.();
        window.renderizarPedidos?.();
        window.hideLoading?.();
        cerrar();
        window.showToast?.('Pedido creado. Revísalo y envíalo al proveedor.', 'success');
        window.cambiarTab?.('pedidos');
    } catch (e) {
        window.hideLoading?.();
        window.showToast?.('No se pudo crear el pedido: ' + (e?.message || 'error'), 'error');
    }
}

function onClick(ev) {
    const ov = document.getElementById(OV_ID);
    if (ev.target === ov) { cerrar(); return; }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'cerrar') { cerrar(); return; }
    if (act === 'volver') { pintar(renderSelectorProveedor()); return; }
    if (act === 'enviar') { enviar(); return; }
    if (act === 'voz') { grabarPedido(); return; }
    const prov = ev.target.closest('[data-pid]');
    if (prov) { elegirProveedor(Number(prov.dataset.pid)); return; }
    const step = ev.target.closest('[data-op]');
    if (step) { ajustar(Number(step.dataset.i), step.dataset.op); return; }
}

function abrir() {
    estado = { provId: null, provNombre: '', lineas: [] };
    pintar(renderSelectorProveedor());
}

// ---------- Dictado por voz ----------
function normaliza(s) {
    return (s || '').toString().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

function restaurarVozBtn(txt) {
    const btn = document.getElementById('mlp-voz-btn');
    if (btn) { btn.classList.remove('escuchando'); btn.textContent = txt || '🎙️ Dictar'; }
}

// Dictado por voz usando la GRABADORA NATIVA del móvil (input type=file capture),
// NO getUserMedia. En la app instalada de Android, Chrome deniega el micro por
// getUserMedia (y el reconocedor Web Speech tampoco va), pero un input de audio
// con `capture` abre la grabadora del sistema, que SÍ tiene micro. El usuario
// graba, confirma, y el archivo (m4a/3gp/…) sube al servidor, que lo convierte a
// WAV con ffmpeg y lo transcribe con Gemini.
let vozInput = null;

function ensureVozInput() {
    if (vozInput) return vozInput;
    vozInput = document.createElement('input');
    vozInput.type = 'file';
    vozInput.accept = 'audio/*';
    vozInput.setAttribute('capture', 'microphone');
    vozInput.style.display = 'none';
    vozInput.addEventListener('change', () => {
        const file = vozInput.files && vozInput.files[0];
        vozInput.value = ''; // permite volver a grabar el mismo botón
        if (file) enviarAudio(file);
    });
    document.body.appendChild(vozInput);
    return vozInput;
}

function grabarPedido() {
    const btn = document.getElementById('mlp-voz-btn');
    if (btn) { btn.classList.add('escuchando'); btn.textContent = '🎙️ Abriendo grabadora…'; }
    try {
        ensureVozInput().click();
    } catch {
        window.showToast?.('No pude abrir la grabadora del móvil.', 'warning');
    }
    // Si el usuario cancela la grabadora no llega 'change'; restauramos el botón al volver el foco.
    const restaurar = () => { restaurarVozBtn('🎙️ Dictar'); window.removeEventListener('focus', restaurar); };
    setTimeout(() => window.addEventListener('focus', restaurar), 500);
}

function blobABase64(blob) {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = reject;
        fr.readAsDataURL(blob);
    });
}

async function enviarAudio(blob) {
    restaurarVozBtn('🎙️ Dictar');
    if (!blob || !blob.size) { window.showToast?.('No grabé nada, prueba otra vez.', 'warning'); return; }
    try {
        window.showLoading?.();
        const audioBase64 = await blobABase64(blob);
        const mimeType = (blob.type || 'audio/webm').split(';')[0];
        const r = await window.API.fetch('/parse-pedido-voz-audio', { method: 'POST', body: JSON.stringify({ audioBase64, mimeType }) });
        window.hideLoading?.();
        aplicarLineasVoz(r);
    } catch (e) {
        window.hideLoading?.();
        window.showToast?.('No se pudo procesar la voz: ' + (e?.message || 'error'), 'error');
    }
}

// Empareja un texto dictado contra un nombre: coincide si comparten palabra o uno
// contiene al otro. Devuelve una "puntuación" para elegir el mejor candidato.
function coincide(np, nombre) {
    const nx = normaliza(nombre);
    if (!nx || !np) return 0;
    if (nx === np) return 3;
    if (nx.includes(np) || np.includes(nx)) return 2;
    const palabras = np.split(' ').filter((w) => w.length >= 3);
    if (palabras.some((w) => nx.includes(w))) return 1;
    return 0;
}

function aplicarLineasVoz(r) {
    if (!r || r.success !== true || !Array.isArray(r.lineas) || !r.lineas.length) {
        window.showToast?.('No entendí ningún producto. Prueba otra vez, más claro.', 'warning');
        return;
    }
    const todosIng = window.ingredientes || [];
    let aplicados = 0;
    const noEncontrados = [];
    r.lineas.forEach((l) => {
        const np = normaliza(l.producto);
        const cant = parseFloat(l.cantidad) || 1;
        // 1) ¿ya está como línea del proveedor? → rellenar cantidad.
        let mejor = null; let mejorSc = 0;
        estado.lineas.forEach((x) => { const sc = coincide(np, x.nombre); if (sc > mejorSc) { mejorSc = sc; mejor = x; } });
        if (mejor && mejorSc >= 1) { mejor.cantDisplay = cant; aplicados++; return; }
        // 2) buscar contra TODOS los ingredientes de la cuenta y AÑADIR la línea.
        let ing = null; let ingSc = 0;
        todosIng.forEach((i) => { const sc = coincide(np, i.nombre); if (sc > ingSc) { ingSc = sc; ing = i; } });
        if (ing && ingSc >= 1) {
            estado.lineas.push(lineaDesdeIngrediente(ing, cant));
            aplicados++;
            return;
        }
        // 3) no existe en la cuenta.
        noEncontrados.push(l.producto);
    });
    pintar(renderGuide());
    let msg = `🎙️ ${aplicados} producto(s) puestos por voz.`;
    if (noEncontrados.length) msg += ` No encontré en tus ingredientes: ${noEncontrados.join(', ')}.`;
    window.showToast?.(msg, aplicados ? 'success' : 'warning');
}

export function initMobilePedido() {
    window.mlNuevoPedido = abrir;
}
