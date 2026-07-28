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

/**
 * Abre el selector de imagen. `usarCamara=true` fuerza la cámara trasera
 * (capture=environment); false abre la galería/archivos del móvil.
 */
function abrirSelectorFoto(usarCamara) {
    let input = document.getElementById('ml-albaran-input');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.id = 'ml-albaran-input';
        input.style.display = 'none';
        input.addEventListener('change', (ev) => {
            const file = ev.target.files && ev.target.files[0];
            ev.target.value = '';           // permite re-elegir la misma foto
            procesarFotoAlbaran(file);
        });
        document.body.appendChild(input);
    }
    if (usarCamara) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.click();
}

// ==================== MODAL DE ENTRADA "RECIBIR ALBARÁN" ====================
// Pantalla previa a la cámara: ilustración cámara + factura, tres consejos
// (que además mejoran la lectura del OCR) y los botones de captura. Solo visual;
// no toca el flujo de lectura/consolidación.
const ALB_INTRO_OV = 'ml-albaran-intro-ov';

function cerrarIntroAlbaran() { document.getElementById(ALB_INTRO_OV)?.remove(); }

function abrirIntroAlbaran() {
    if (document.getElementById(ALB_INTRO_OV)) return;
    const ov = document.createElement('div');
    ov.id = ALB_INTRO_OV;
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(58,34,22,.42);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = `
      <div style="background:#fffdfb;width:100%;max-width:560px;max-height:94vh;overflow-y:auto;border-radius:26px 26px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom,0));box-shadow:0 -18px 40px -20px rgba(36,18,9,.5);">
        <div style="width:38px;height:5px;border-radius:999px;background:#e7d7c8;margin:2px auto 12px;"></div>
        <svg viewBox="0 0 190 150" style="display:block;width:178px;height:140px;margin:2px auto 4px;" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cámara fotografiando una factura">
          <ellipse cx="95" cy="132" rx="66" ry="10" fill="#eaddcf"/>
          <g transform="rotate(-7 92 66)">
            <rect x="46" y="18" width="92" height="104" rx="9" fill="#ffffff" stroke="#eaddcf" stroke-width="1.5"/>
            <rect x="46" y="18" width="92" height="26" rx="9" fill="#b0533a"/>
            <rect x="46" y="35" width="92" height="9" fill="#b0533a"/>
            <rect x="56" y="26" width="34" height="6" rx="3" fill="#ffffff" opacity=".9"/>
            <circle cx="126" cy="31" r="6.5" fill="#ffffff" opacity=".28"/>
            <rect x="56" y="56" width="58" height="5" rx="2.5" fill="#e7d7c8"/>
            <rect x="56" y="67" width="72" height="5" rx="2.5" fill="#efe1d5"/>
            <rect x="56" y="78" width="48" height="5" rx="2.5" fill="#efe1d5"/>
            <rect x="56" y="89" width="66" height="5" rx="2.5" fill="#efe1d5"/>
            <rect x="56" y="102" width="72" height="12" rx="4" fill="#f4e4d6"/>
            <rect x="98" y="105" width="24" height="6" rx="3" fill="#b0533a"/>
          </g>
          <g stroke="#b0533a" stroke-width="3.2" stroke-linecap="round">
            <path d="M20 40 L20 26 L34 26"/><path d="M170 40 L170 26 L156 26"/>
            <path d="M20 112 L20 126 L34 126"/><path d="M170 112 L170 126 L156 126"/>
          </g>
          <g transform="translate(104 84)">
            <rect x="0" y="10" width="70" height="48" rx="11" fill="#3d251a"/>
            <path d="M18 10 l6 -8 h22 l6 8 z" fill="#3d251a"/>
            <rect x="8" y="17" width="12" height="7" rx="2" fill="#5c3a27"/>
            <circle cx="35" cy="35" r="16" fill="#241209"/>
            <circle cx="35" cy="35" r="11" fill="#b0533a"/>
            <circle cx="35" cy="35" r="5.5" fill="#f4e4d6"/>
            <circle cx="31" cy="31" r="2.2" fill="#ffffff" opacity=".8"/>
            <circle cx="58" cy="20" r="3" fill="#e6c9b6"/>
          </g>
        </svg>
        <h2 style="text-align:center;font-size:21px;font-weight:800;letter-spacing:-.02em;color:#3a2216;margin:6px 0 6px;">Recibir albarán</h2>
        <p style="text-align:center;font-size:13.5px;line-height:1.5;color:#a07d68;margin:0 auto 16px;max-width:34ch;">Haz una foto del albarán o la factura. La IA lee proveedor, productos, cantidades y precios por ti.</p>
        <div style="display:flex;gap:8px;margin:0 0 18px;">
          <div style="flex:1;background:#faf1e9;border:1px solid #efe1d5;border-radius:14px;padding:11px 6px 9px;text-align:center;"><div style="font-size:19px;line-height:1;">☀️</div><span style="display:block;margin-top:5px;font-size:11px;font-weight:700;color:#8a6a54;">Buena luz</span></div>
          <div style="flex:1;background:#faf1e9;border:1px solid #efe1d5;border-radius:14px;padding:11px 6px 9px;text-align:center;"><div style="font-size:19px;line-height:1;">▭</div><span style="display:block;margin-top:5px;font-size:11px;font-weight:700;color:#8a6a54;">Plano</span></div>
          <div style="flex:1;background:#faf1e9;border:1px solid #efe1d5;border-radius:14px;padding:11px 6px 9px;text-align:center;"><div style="font-size:19px;line-height:1;">⌖</div><span style="display:block;margin-top:5px;font-size:11px;font-weight:700;color:#8a6a54;">Enfocado</span></div>
        </div>
        <button type="button" data-act="camara" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:0;border-radius:16px;padding:16px;margin-bottom:10px;background:linear-gradient(145deg,#b0533a,#8c3f2b);color:#fff;font-weight:800;font-size:16px;box-shadow:0 16px 30px -14px rgba(150,60,40,.7);cursor:pointer;"><span style="font-size:19px;">📷</span> Hacer foto</button>
        <button type="button" data-act="galeria" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:1px solid #e7d7c8;background:#fff;border-radius:16px;padding:13px;color:#8a5a3e;font-weight:700;font-size:14px;cursor:pointer;"><span>🖼️</span> Elegir de la galería</button>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (ev) => {
        if (ev.target === ov) { cerrarIntroAlbaran(); return; }
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'camara') { cerrarIntroAlbaran(); abrirSelectorFoto(true); }
        else if (act === 'galeria') { cerrarIntroAlbaran(); abrirSelectorFoto(false); }
    });
}

export function initMobileAlbaran() {
    // "Recibir albarán" → modal de entrada (ilustración + consejos) → cámara.
    window.mlRecibirAlbaran = abrirIntroAlbaran;
}
