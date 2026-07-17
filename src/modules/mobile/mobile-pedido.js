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
import { formatoDesdeBase, esCantidadEnteraEnFormato } from '../pedidos/formato-utils.js';
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

function construirLineas(provId) {
    const ingMap = new Map((window.ingredientes || []).map((i) => [i.id, i]));
    const hist = historialProveedor(provId);
    const lineas = [];
    for (const [id, h] of hist) {
        const ing = ingMap.get(id);
        if (!ing) continue;
        const { cpf, formato, unidad } = ctxFmt(ing);
        const usaFormato = cpf > 1 && !!formato && esCantidadEnteraEnFormato(h.cantidad, cpf);
        const cantDisplay = usaFormato ? formatoDesdeBase(h.cantidad, 0, cpf).cantidad : h.cantidad;
        // Precio: el del historial; si viniera 0, el precio actual del ingrediente
        // (precio_medio_compra > precio_medio > precio/formato, vía getIngredientUnitPrice).
        let precioBase = h.precio;
        if (!(precioBase > 0)) {
            try { precioBase = parseFloat(getIngredientUnitPrice(ing)) || 0; } catch { precioBase = 0; }
        }
        lineas.push({
            ingredienteId: id,
            nombre: ing.nombre || 'Ingrediente',
            usaFormato,
            cpf,
            unidadLabel: usaFormato ? formato : unidad,
            precioBase,
            cantDisplay,
        });
    }
    return lineas;
}

function totalActual() {
    return estado.lineas.reduce((s, l) => {
        const base = l.cantDisplay * (l.usaFormato ? l.cpf : 1);
        return s + base * l.precioBase;
    }, 0);
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
            <small>${cm(l.precioBase)}${l.usaFormato ? '/' + escapeHTML(l.unidadLabel) : (l.unidadLabel ? '/' + escapeHTML(l.unidadLabel) : '')}</small>
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
      <div class="mlp-sub">Lo que le pides siempre · ajusta las cantidades</div>
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
                precio_unitario: l.precioBase,
                precioUnitario: l.precioBase,
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
    const prov = ev.target.closest('[data-pid]');
    if (prov) { elegirProveedor(Number(prov.dataset.pid)); return; }
    const step = ev.target.closest('[data-op]');
    if (step) { ajustar(Number(step.dataset.i), step.dataset.op); return; }
}

function abrir() {
    estado = { provId: null, provNombre: '', lineas: [] };
    pintar(renderSelectorProveedor());
}

export function initMobilePedido() {
    window.mlNuevoPedido = abrir;
}
