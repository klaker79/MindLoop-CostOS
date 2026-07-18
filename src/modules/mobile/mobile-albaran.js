/**
 * Recibir albarán por foto — CosteOS.
 *
 * Flujo: botón "Recibir albarán" → foto → POST /parse-albaran (Claude Vision) →
 * se abre la CONSOLIDACIÓN DEL PROPIO ALBARÁN: sus líneas (proveedor, productos,
 * cantidad, precio, IVA). El humano revisa, relaciona las líneas nuevas y CONSOLIDA
 * → se registra la compra (stock + precio + diario) vía approve-batch.
 *
 * NO busca pedidos pendientes: el albarán se consolida SOLO, por sí mismo.
 * Solo staging (OCR_ENABLED). En prod el backend devuelve 410 (backstop) → toast, no rompe.
 */

import { escapeHTML, cm } from '../../utils/helpers.js';

// Reescala la imagen a máx `maxLado` px (lado mayor) y devuelve JPEG base64 (sin el
// prefijo data:). Mantiene la legibilidad para OCR y evita subir 10 MB desde el móvil.
// Usa createImageBitmap para decodificar el fichero directo a bitmap: sin <img> ni
// blob URL, y con `imageOrientation: 'from-image'` endereza la foto girada del móvil.
async function imagenAJpegBase64(file, maxLado = 1600, calidad = 0.85) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
        const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * escala);
        const h = Math.round(bitmap.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', calidad);
        return dataUrl.split(',')[1];
    } finally {
        bitmap.close();
    }
}

async function procesarFotoAlbaran(file) {
    if (!file) return;
    const toast = (m, t) => window.showToast?.(m, t);
    try {
        window.showLoading?.();
        toast('Leyendo el albarán con IA…', 'info');
        const imageBase64 = await imagenAJpegBase64(file);

        const r = await window.API.fetch('/parse-albaran', {
            method: 'POST',
            body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg', filename: file.name || 'albaran.jpg' }),
        });

        window.hideLoading?.();

        // Duplicado (por nº de factura o imagen): llega con success:false + duplicateWarning.
        // NO se duplica; reabrimos la CONSOLIDACIÓN del albarán ya leído (sus líneas siguen
        // en la cola) y marcamos el aviso en la propia pantalla (banner rojo).
        if (r && r.duplicateWarning) {
            const dw = r.duplicateWarning;
            await abrirConsolidacionAlbaran({
                ...r,
                batchId: dw.batchId,
                proveedor: dw.proveedor || r.proveedor,
                fecha: dw.fecha || r.fecha,
                numero_factura: dw.numero_factura || r.numero_factura,
            });
            return;
        }
        if (!r || r.success !== true) {
            toast('No pude leer bien el albarán. Prueba con más luz, enfocado y recto, o mételo a mano.', 'warning');
            return;
        }
        await abrirConsolidacionAlbaran(r);
    } catch (e) {
        window.hideLoading?.();
        // El backstop de prod devuelve 410; cualquier fallo aquí no rompe la app.
        toast('No se pudo procesar el albarán: ' + (e?.message || 'error'), 'error');
    }
}

// ==================== CONSOLIDACIÓN DEL ALBARÁN ====================
// El albarán se consolida SOLO (sus propias líneas), sin buscar pedidos pendientes.
// Foto → líneas leídas → revisas (relacionas las nuevas) → Consolidar = registra
// stock + precio + diario (POST /purchases/pending/approve-batch). Las líneas sin
// ingrediente se OMITEN (approve-batch las salta, no rompe).
const CONSOL_OV = 'ml-consol-ov';
let consolEstado = { r: null, batchId: null, lineas: [] };

function cerrarConsol() { document.getElementById(CONSOL_OV)?.remove(); }

const fmtFechaAlb = (f) => { try { return new Date((typeof f === 'string' && f.length === 10) ? f + 'T12:00:00' : f).toLocaleDateString(); } catch { return ''; } };

async function abrirConsolidacionAlbaran(r) {
    const toast = (m, tt) => window.showToast?.(m, tt);
    let lineas = [];
    try {
        const pend = await window.API.fetch('/purchases/pending?estado=pendiente');
        lineas = (Array.isArray(pend) ? pend : [])
            .filter(x => x.batch_id === r.batchId)
            .map(l => {
                const ing = (l.ingrediente_id !== null && l.ingrediente_id !== undefined) ? Number(l.ingrediente_id) : null;
                return {
                    id: l.id,
                    nombre: l.ingrediente_nombre || '',
                    ingredienteId: ing,
                    ingredienteOriginal: ing,
                    cantidad: parseFloat(l.cantidad) || 0,
                    precio: parseFloat(l.precio) || 0,
                };
            });
    } catch { /* no-op */ }
    if (!lineas.length) { toast('No pude cargar las líneas del albarán. Revísalo en la cola de compras.', 'warning'); return; }
    consolEstado = { r, batchId: r.batchId, lineas };
    pintarConsol();
}

function opcionesIngredientes(sel) {
    const ings = (window.ingredientes || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    const opts = ['<option value="">— sin asignar —</option>'];
    ings.forEach(i => { opts.push(`<option value="${i.id}" ${Number(sel) === i.id ? 'selected' : ''}>${escapeHTML(i.nombre || '')}</option>`); });
    return opts.join('');
}

function totalesConsol() {
    const base = consolEstado.lineas.reduce((s, l) => s + (l.cantidad * l.precio), 0);
    const iva = parseFloat(consolEstado.r?.iva_pct) || 0;
    return { base, iva, conIva: base * (1 + iva / 100) };
}

function refrescarTotalesConsol() {
    const t = totalesConsol();
    const b = document.getElementById('consol-base'); if (b) b.textContent = cm(t.base);
    const i = document.getElementById('consol-iva'); if (i) i.textContent = cm(t.conIva - t.base);
    const tt = document.getElementById('consol-total'); if (tt) tt.textContent = cm(t.conIva);
}

function pintarConsol() {
    const r = consolEstado.r;
    const dup = r?.duplicateWarning;
    const dupBanner = dup
        ? `<div style="background:#fef2f2;border:2px solid #dc2626;color:#991b1b;padding:12px 14px;border-radius:8px;margin-bottom:12px;font-weight:600;font-size:13px;">⚠️ POSIBLE DUPLICADO — este albarán ya lo escaneaste (${escapeHTML([dup.proveedor, dup.fecha ? fmtFechaAlb(dup.fecha) : '', dup.numero_factura ? 'factura ' + dup.numero_factura : ''].filter(Boolean).join(' · '))}). Revísalo antes de consolidar.</div>`
        : '';
    const ivaTxt = (r?.iva_pct !== null && r?.iva_pct !== undefined) ? 'IVA ' + r.iva_pct + '%' : '';
    const cab = [r?.proveedor, r?.fecha ? fmtFechaAlb(r.fecha) : '', r?.numero_factura ? 'Factura ' + r.numero_factura : '', ivaTxt].filter(Boolean).map(escapeHTML).join(' · ');

    const filas = consolEstado.lineas.map((l, i) => `
        <div style="border-bottom:1px solid #eef2f7;padding:10px 0;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${escapeHTML(l.nombre) || '(sin nombre)'}</div>
          <select data-i="${i}" data-f="ing" style="width:100%;padding:8px;border:1px solid ${l.ingredienteId ? '#cbd5e1' : '#f59e0b'};border-radius:6px;font-size:13px;margin-bottom:6px;">${opcionesIngredientes(l.ingredienteId)}</select>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="number" step="0.001" inputmode="decimal" data-i="${i}" data-f="cantidad" value="${l.cantidad}" style="width:82px;padding:6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            <span style="color:#64748b;font-size:12px;">×</span>
            <input type="number" step="0.0001" inputmode="decimal" data-i="${i}" data-f="precio" value="${l.precio}" style="width:92px;padding:6px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            <span style="color:#64748b;font-size:12px;">€/ud</span>
          </div>
        </div>`).join('');

    const t = totalesConsol();
    const totalHtml = `<div style="margin-top:12px;font-size:14px;">
        <div style="display:flex;justify-content:space-between;"><span>Base (sin IVA)</span><b id="consol-base">${cm(t.base)}</b></div>
        ${t.iva ? `<div style="display:flex;justify-content:space-between;color:#64748b;"><span>IVA ${t.iva}%</span><span id="consol-iva">${cm(t.conIva - t.base)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:2px;"><span>Total con IVA</span><span id="consol-total">${cm(t.conIva)}</span></div>` : ''}
    </div>`;

    let ov = document.getElementById(CONSOL_OV);
    if (!ov) {
        ov = document.createElement('div');
        ov.id = CONSOL_OV;
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;';
        document.body.appendChild(ov);
        ov.addEventListener('click', onClickConsol);
        ov.addEventListener('input', onInputConsol);
    }
    ov.innerHTML = `
      <div style="background:#fff;width:100%;max-width:560px;max-height:92vh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;overflow:hidden;">
        <div style="padding:14px 16px;border-bottom:1px solid #eef2f7;display:flex;justify-content:space-between;align-items:center;">
          <b style="font-size:16px;">📸 Consolidar albarán</b>
          <button type="button" data-act="cerrar" style="border:0;background:none;font-size:20px;color:#64748b;cursor:pointer;">✕</button>
        </div>
        <div style="padding:14px 16px;overflow-y:auto;">
          ${dupBanner}
          <div style="color:#475569;font-size:13px;margin-bottom:10px;">${cab || 'Albarán'}</div>
          ${filas || '<p style="color:#64748b;">El albarán no tiene líneas.</p>'}
          ${totalHtml}
        </div>
        <div style="padding:12px 16px;border-top:1px solid #eef2f7;display:flex;gap:8px;">
          <button type="button" data-act="cerrar" style="flex:0 0 auto;border:0;background:#f1f5f9;color:#334155;border-radius:8px;padding:12px 16px;font-size:14px;cursor:pointer;">Cancelar</button>
          <button type="button" data-act="consolidar" style="flex:1;border:0;background:#059669;color:#fff;border-radius:8px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;">✅ Consolidar (registra stock y precio)</button>
        </div>
      </div>`;
}

function onInputConsol(ev) {
    const el = ev.target;
    const i = Number(el.getAttribute('data-i'));
    const f = el.getAttribute('data-f');
    if (Number.isNaN(i) || !consolEstado.lineas[i]) return;
    if (f === 'ing') {
        consolEstado.lineas[i].ingredienteId = el.value ? Number(el.value) : null;
        el.style.borderColor = el.value ? '#cbd5e1' : '#f59e0b';
    } else if (f === 'cantidad') {
        consolEstado.lineas[i].cantidad = parseFloat(el.value) || 0;
        refrescarTotalesConsol();
    } else if (f === 'precio') {
        consolEstado.lineas[i].precio = parseFloat(el.value) || 0;
        refrescarTotalesConsol();
    }
}

function onClickConsol(ev) {
    const ov = document.getElementById(CONSOL_OV);
    if (ev.target === ov) { cerrarConsol(); return; }
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'cerrar') { cerrarConsol(); return; }
    if (act === 'consolidar') { consolidarAlbaran(); return; }
}

async function consolidarAlbaran() {
    const lineas = consolEstado.lineas;
    const conIng = lineas.filter(l => l.ingredienteId);
    if (!conIng.length) {
        window.showToast?.('Relaciona al menos un producto con un ingrediente antes de consolidar.', 'warning');
        return;
    }
    window.showLoading?.();
    try {
        // 1) Persistir cada línea macheada (relacionar/editar) y aprender alias de las nuevas.
        for (const l of conIng) {
            await window.API.fetch(`/purchases/pending/${l.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ingrediente_id: l.ingredienteId, cantidad: l.cantidad, precio: l.precio }),
            }).catch(() => { /* si una línea falla, seguimos con el resto */ });
            if (l.ingredienteOriginal === null && l.nombre) {
                window.API.fetch('/purchases/alias', {
                    method: 'POST',
                    body: JSON.stringify({ ingredienteId: l.ingredienteId, alias: l.nombre }),
                }).catch(() => { /* no bloquea */ });
            }
        }
        // 2) Consolidar el batch → registra stock + precio + diario.
        const res = await window.API.fetch('/purchases/pending/approve-batch', {
            method: 'POST',
            body: JSON.stringify({ batchId: consolEstado.batchId }),
        });
        // 3) Recargar datos afectados (stock/precio de ingredientes).
        try { window.ingredientes = await window.api.getIngredientes(); } catch { /* no-op */ }
        window.renderizarIngredientes?.();
        window.renderizarInventario?.();
        window.hideLoading?.();
        cerrarConsol();
        const aprobados = res?.aprobados ?? res?.resultados?.aprobados;
        const omitidos = res?.omitidos ?? res?.resultados?.omitidos;
        let msg = '✅ Albarán consolidado. Stock y precios actualizados.';
        if (aprobados !== null && aprobados !== undefined) {
            msg = `✅ Consolidado: ${aprobados} línea(s) registradas${omitidos ? `, ${omitidos} sin asignar omitidas` : ''}.`;
        }
        window.showToast?.(msg, 'success');
    } catch (e) {
        window.hideLoading?.();
        window.showToast?.('No se pudo consolidar el albarán: ' + (e?.message || 'error'), 'error');
    }
}

/** Abre la cámara nativa del móvil (o selector de archivo) para el albarán. */
function iniciarRecepcionFoto() {
    let input = document.getElementById('ml-albaran-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';   // cámara trasera del móvil
        input.id = 'ml-albaran-input';
        input.style.display = 'none';
        input.addEventListener('change', (ev) => {
            const file = ev.target.files && ev.target.files[0];
            ev.target.value = '';           // permite re-elegir la misma foto
            procesarFotoAlbaran(file);
        });
        document.body.appendChild(input);
    }
    input.click();
}

export function initMobileAlbaran() {
    // Sustituye el placeholder de la Pieza A por la cámara real.
    window.mlRecibirAlbaran = iniciarRecepcionFoto;
}
