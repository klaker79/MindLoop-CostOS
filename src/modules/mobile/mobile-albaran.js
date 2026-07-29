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

import { escapeHTML, cm, getDateLocale, formatQuantity } from '../../utils/helpers.js';

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
        // NO se re-parsea; recuperamos el albarán ya leído (sus líneas siguen en la cola con
        // su batchId) y seguimos por el MISMO camino que uno nuevo.
        //
        // Antes esto llamaba directamente a abrirConsolidacionAlbaran() y hacía return, así
        // que un albarán marcado como duplicado NUNCA pasaba por enrutarAlbaran(): el usuario
        // se quedaba sin la opción de recibir sobre el pedido pendiente y sin varianzas, que
        // es justo lo que necesita al reescanear el albarán de un pedido hecho por la app
        // (el caso en el que MÁS salta el duplicado). El aviso no se pierde: viaja en
        // `duplicateWarning` y se pinta en las tres pantallas del flujo (bannerDuplicado).
        if (r && r.duplicateWarning) {
            const dw = r.duplicateWarning;
            await enrutarAlbaran({
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
        await enrutarAlbaran(r);
    } catch (e) {
        window.hideLoading?.();
        // El backstop de prod devuelve 410; cualquier fallo aquí no rompe la app.
        toast('No se pudo procesar el albarán: ' + (e?.message || 'error'), 'error');
    }
}

// ==================== ENRUTADO: ¿matchea con un pedido pendiente? ====================
// Tras leer el albarán decidimos la vía, SIN duplicar la lógica de recepción:
//   • Hay pedido pendiente del proveedor → abrimos la MISMA recepción que un pedido
//     manual (window.marcarPedidoRecibido), volcando el albarán sobre él (varianzas).
//   • No hay pedido → avisamos y, tras confirmar, se guarda como compra nueva
//     (abrirConsolidacionAlbaran, el flujo de siempre).
// El OCR solo reduce fricción: el cálculo de stock/precio/varianza es idéntico al manual.

const fmtFechaAlb = (f) => { try { return new Date((typeof f === 'string' && f.length === 10) ? f + 'T12:00:00' : f).toLocaleDateString(); } catch { return ''; } };

// Normaliza el nombre de un proveedor para casarlo: minúsculas, sin acentos, sin
// forma societaria (SL/SA/SCP…) ni puntuación. Los proveedores NO guardan CIF, así
// que el matcheo es por nombre.
function normProv(s) {
    return (s || '').toString().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\b(s\.?l\.?u?|s\.?a\.?|s\.?c\.?p?|c\.?b\.?|sociedad limitada|sociedad anonima)\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// Palabras que no distinguen a un proveedor de otro.
const PROV_STOPWORDS = new Set(['y', 'e', 'de', 'del', 'la', 'el', 'los', 'las', 'hnos', 'hermanos', 'grupo', 'distribuciones', 'distribucion', 'comercial', 'suministros']);

function tokensProv(s) {
    return normProv(s).split(' ').filter(t => t.length >= 2 && !PROV_STOPWORDS.has(t));
}

/**
 * Casa el proveedor del albarán con window.proveedores.
 *
 * Tres niveles: exacto → contención → PALABRAS en común.
 *
 * El tercero es el que hace falta con nombres reales: el albarán trae la razón social
 * larga y en la app está guardado el nombre corto o con las palabras en otro orden.
 * Caso real: "OROSA AVES HUEVOS Y CAZA" (albarán) contra "OROSA AVES Y HUEVOS"
 * (guardado). No son iguales ni uno contiene al otro —el orden cambia—, así que los
 * dos primeros niveles fallaban y el usuario acababa en "sin pedido para casar".
 *
 * Puntuación = palabras compartidas / palabras del nombre más corto. Exige además al
 * menos una palabra "fuerte" (≥4 letras) en común, para que un "PESCADOS PEREZ" no se
 * confunda con un "PESCADOS GOMEZ" (comparten solo "pescados": 1/2 = 0,5 < umbral).
 * Gana la puntuación más alta y, a igualdad, el que más palabras comparte.
 */
const PROV_UMBRAL = 0.6;

function casarProveedor(nombreAlbaran) {
    const objetivo = normProv(nombreAlbaran);
    if (!objetivo) return null;
    const provs = window.proveedores || [];

    // 1) Exacto.
    let hit = provs.find(p => normProv(p.nombre) === objetivo);
    if (hit) return hit;

    // 2) Contención (un nombre dentro del otro, mismo orden).
    hit = provs.find(p => {
        const n = normProv(p.nombre);
        return n.length >= 4 && (n.includes(objetivo) || objetivo.includes(n));
    });
    if (hit) return hit;

    // 3) Palabras en común.
    const tokObj = tokensProv(nombreAlbaran);
    if (!tokObj.length) return null;
    const setObj = new Set(tokObj);

    let mejor = null, mejorScore = 0, mejorComunes = 0;
    for (const p of provs) {
        const tokP = tokensProv(p.nombre);
        if (!tokP.length) continue;
        const comunes = tokP.filter(t => setObj.has(t));
        if (!comunes.length) continue;
        if (!comunes.some(t => t.length >= 4)) continue;   // exige una palabra con peso
        const score = comunes.length / Math.min(tokP.length, tokObj.length);
        if (score > mejorScore || (score === mejorScore && comunes.length > mejorComunes)) {
            mejor = p; mejorScore = score; mejorComunes = comunes.length;
        }
    }
    return mejorScore >= PROV_UMBRAL ? mejor : null;
}

// Líneas del albarán recién leído (cola compras_pendientes, filtradas por batch).
async function cargarLineasBatch(batchId) {
    try {
        const pend = await window.API.fetch('/purchases/pending?estado=pendiente');
        return (Array.isArray(pend) ? pend : [])
            .filter(x => x.batch_id === batchId)
            .map(l => ({
                id: l.id,
                nombre: l.ingrediente_nombre || '',
                ingredienteId: (l.ingrediente_id !== null && l.ingrediente_id !== undefined) ? Number(l.ingrediente_id) : null,
                cantidad: parseFloat(l.cantidad) || 0,
                precio: parseFloat(l.precio) || 0,
            }));
    } catch { return []; }
}

/**
 * El albarán completo, en cualquier estado (GET /purchases/batch/:batchId).
 *
 * `cargarLineasBatch` solo ve líneas 'pendiente'. Cuando reescaneas un albarán que YA
 * consolidaste, el backend devuelve el batch original —ya aprobado— y aquella función
 * devolvía [], que es lo que producía el "No pude cargar las líneas del albarán".
 * Con esto podemos decir qué se registró y cuándo.
 */
async function cargarBatch(batchId) {
    if (!batchId) return null;
    try {
        const info = await window.API.fetch('/purchases/batch/' + encodeURIComponent(batchId));
        return (info && info.batchId) ? info : null;
    } catch { return null; }
}

// Pedidos pendientes de un proveedor, "más probable" primero: importe más cercano
// al total del albarán y, a igualdad, el más reciente. (Multi-pedido: auto + cambiar.)
function pedidosPendientesDe(provId, totalAlbaran) {
    return (window.pedidos || [])
        .filter(p => p.estado === 'pendiente' && (p.proveedor_id ?? p.proveedorId) === provId)
        .sort((a, b) => {
            const da = Math.abs((parseFloat(a.total) || 0) - totalAlbaran);
            const db = Math.abs((parseFloat(b.total) || 0) - totalAlbaran);
            if (Math.abs(da - db) > 0.01) return da - db;
            return new Date(b.fecha) - new Date(a.fecha);
        });
}

// Rellena las globales que consume la recepción (pedidos-recepcion.js): las líneas del
// albarán que casan con el pedido van a __albaranHints.porIngrediente (para volcar
// cantidad/precio y marcar varianza); las que NO estaban en el pedido, a __albaranExtras.
function prepararHints(lineas, ped, r) {
    const idsPedido = new Set((ped.ingredientes || [])
        .map(it => Number(it.ingredienteId ?? it.ingrediente_id))
        .filter(n => Number.isFinite(n)));
    const porIngrediente = new Map();
    const extras = [];
    for (const l of lineas) {
        if (l.ingredienteId && idsPedido.has(l.ingredienteId)) {
            const prev = porIngrediente.get(l.ingredienteId);
            if (prev) {
                // Mismo ingrediente en varias líneas del albarán: suma cantidad, precio ponderado.
                const totCant = prev.cantidad + l.cantidad;
                const precio = totCant ? (prev.cantidad * prev.precio + l.cantidad * l.precio) / totCant : l.precio;
                porIngrediente.set(l.ingredienteId, { cantidad: totCant, precio });
            } else {
                porIngrediente.set(l.ingredienteId, { cantidad: l.cantidad, precio: l.precio });
            }
        } else {
            // Extra: no estaba en el pedido (tenga o no ingrediente reconocido). Se confirma a mano.
            extras.push({ ingredienteId: l.ingredienteId ?? null, cantidad: l.cantidad, precio: l.precio, nombre: l.nombre });
        }
    }
    window.__albaranHints = {
        pedidoId: ped.id,
        porIngrediente,
        todasLineas: lineas,
        ivaPct: (r?.iva_pct !== null && r?.iva_pct !== undefined) ? r.iva_pct : null,
        // El OBJETO completo, no un booleano. pedidos-recepcion.js pinta el banner con
        // sus campos (proveedor, fecha, itemCount, numero_factura); con `true` salía
        // "POSIBLE DUPLICADO — este albarán ya lo escaneaste: ." sin un solo dato.
        duplicado: r?.duplicateWarning || null,
    };
    window.__albaranExtras = extras;
}

// Aviso de albarán ya escaneado. Se pinta en TODAS las pantallas del flujo (decisión de
// pedido y consolidación): el duplicado ya no corta el camino, así que el usuario debe
// seguir viendo el aviso decida lo que decida.
function bannerDuplicado(r, cola) {
    const dup = r?.duplicateWarning;
    if (!dup) return '';
    const detalle = [
        dup.proveedor,
        dup.fecha ? fmtFechaAlb(dup.fecha) : '',
        dup.numero_factura ? 'factura ' + dup.numero_factura : ''
    ].filter(Boolean).join(' · ');
    return `<div style="background:#fef2f2;border:2px solid #dc2626;color:#991b1b;padding:12px 14px;border-radius:8px;margin-bottom:12px;font-weight:600;font-size:13px;">⚠️ POSIBLE DUPLICADO — este albarán ya lo escaneaste (${escapeHTML(detalle)}). ${escapeHTML(cola)}</div>`;
}

// Overlay tipo bottom-sheet (terracota), coherente con el modal de entrada del albarán.
function overlaySheet(innerHtml) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(58,34,22,.42);display:flex;align-items:flex-end;justify-content:center;';
    ov.innerHTML = `<div style="background:#fffdfb;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;border-radius:26px 26px 0 0;padding:14px 20px calc(20px + env(safe-area-inset-bottom,0));box-shadow:0 -18px 40px -20px rgba(36,18,9,.5);"><div style="width:38px;height:5px;border-radius:999px;background:#e7d7c8;margin:2px auto 14px;"></div>${innerHtml}</div>`;
    document.body.appendChild(ov);
    return ov;
}

const BTN_TERRA = 'display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:16px;padding:15px;margin-bottom:10px;background:linear-gradient(145deg,#b0533a,#8c3f2b);color:#fff;font-weight:800;font-size:15px;box-shadow:0 16px 30px -14px rgba(150,60,40,.7);cursor:pointer;';
const BTN_GHOST = 'width:100%;border:1px solid #e7d7c8;background:#fff;border-radius:16px;padding:12px;color:#8a5a3e;font-weight:700;font-size:14px;cursor:pointer;';

// No hay pedido pendiente → avisar y permitir subir igualmente como compra nueva.
function abrirDecisionSinPedido(r, prov) {
    const nombreProv = prov?.nombre || r?.proveedor || 'este proveedor';
    const ov = overlaySheet(`
        ${bannerDuplicado(r, 'Revísalo antes de guardarlo.')}
        <div style="width:52px;height:52px;border-radius:16px;background:#fef3e6;display:flex;align-items:center;justify-content:center;font-size:26px;margin:2px auto 10px;">📄</div>
        <h2 style="text-align:center;font-size:19px;font-weight:800;color:#3a2216;margin:0 0 8px;">Sin pedido para casar</h2>
        <p style="text-align:center;font-size:13.5px;line-height:1.5;color:#a07d68;margin:0 auto 18px;max-width:36ch;">Este albarán no coincide con ningún pedido pendiente de <b>${escapeHTML(nombreProv)}</b>. ¿Guardarlo igualmente como una compra nueva?</p>
        <button type="button" data-act="subir" style="${BTN_TERRA}">Sí, guardar como compra</button>
        <button type="button" data-act="cerrar" style="${BTN_GHOST}">Cancelar</button>`);
    ov.addEventListener('click', (ev) => {
        if (ev.target === ov) { ov.remove(); return; }
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act === 'cerrar') ov.remove();
        else if (act === 'subir') { ov.remove(); abrirConsolidacionAlbaran(r); }
    });
}

// Hay pedido(s) pendientes → sugerir el más probable, permitir cambiarlo o subir como nuevo.
function abrirDecisionConPedido(r, prov, pendientes, lineas) {
    const nombreProv = prov?.nombre || r?.proveedor || 'proveedor';
    const varios = pendientes.length > 1;
    const opciones = pendientes.map((p, i) => `
        <label style="display:flex;align-items:center;gap:11px;background:#fff;border:1px solid ${i === 0 ? '#b0533a' : '#efe1d5'};border-radius:14px;padding:12px 13px;margin-bottom:9px;cursor:pointer;">
          <input type="radio" name="ml-ped-sel" value="${p.id}" ${i === 0 ? 'checked' : ''} style="accent-color:#b0533a;width:18px;height:18px;flex:0 0 auto;">
          <span style="flex:1;min-width:0;"><b style="display:block;font-size:14px;color:#3a2216;">Pedido del ${escapeHTML(fmtFechaAlb(p.fecha))}</b><small style="font-size:11.5px;color:#a8917f;">${cm(parseFloat(p.total) || 0)}${i === 0 ? ' · sugerido' : ''}</small></span>
        </label>`).join('');
    const ov = overlaySheet(`
        ${bannerDuplicado(r, 'Revísalo antes de recibirlo.')}
        <div style="width:52px;height:52px;border-radius:16px;background:#eef7ee;display:flex;align-items:center;justify-content:center;font-size:26px;margin:2px auto 10px;">✅</div>
        <h2 style="text-align:center;font-size:19px;font-weight:800;color:#3a2216;margin:0 0 6px;">${varios ? 'Elige el pedido' : 'Pedido encontrado'}</h2>
        <p style="text-align:center;font-size:13.5px;line-height:1.5;color:#a07d68;margin:0 auto 16px;max-width:36ch;">${varios ? `Hay ${pendientes.length} pedidos pendientes de <b>${escapeHTML(nombreProv)}</b>. Elige con cuál casar el albarán.` : `Casamos el albarán con tu pedido pendiente de <b>${escapeHTML(nombreProv)}</b> para comparar lo pedido con lo recibido.`}</p>
        ${opciones}
        <button type="button" data-act="recibir" style="${BTN_TERRA}">Recibir sobre este pedido</button>
        <button type="button" data-act="nuevo" style="${BTN_GHOST}">Ninguno · subir como compra nueva</button>`);
    ov.addEventListener('click', (ev) => {
        if (ev.target === ov) { ov.remove(); return; }
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'nuevo') { ov.remove(); abrirConsolidacionAlbaran(r); return; }
        if (act === 'recibir') {
            const sel = ov.querySelector('input[name="ml-ped-sel"]:checked');
            const pedId = sel ? Number(sel.value) : pendientes[0].id;
            const ped = pendientes.find(p => p.id === pedId) || pendientes[0];
            prepararHints(lineas, ped, r);
            ov.remove();
            if (typeof window.marcarPedidoRecibido === 'function') {
                window.marcarPedidoRecibido(ped.id);
            } else {
                window.showToast?.('No se pudo abrir la recepción del pedido.', 'error');
                abrirConsolidacionAlbaran(r);
            }
        }
    });
}

/**
 * Deshace el registro de un albarán y lo devuelve a la cola para procesarlo bien.
 * El backend revierte stock, Diario y precio en una transacción.
 */
async function revertirRegistro(batchId) {
    try {
        const r = await window.API.fetch('/purchases/batch/' + encodeURIComponent(batchId) + '/revert', { method: 'POST' });
        return !!(r && r.success);
    } catch { return false; }
}

/**
 * Albarán que YA se registró.
 *
 * Que el ALBARÁN esté registrado no significa que el PEDIDO se haya recibido. Si se
 * consolidó como compra suelta, el pedido sigue 'pendiente' y el stock entró por una
 * vía que no lo cierra. En ese caso no basta con avisar: se ofrece PASARLO AL PEDIDO,
 * que deshace el registro anterior y abre la recepción normal, con sus varianzas.
 * Así el usuario acaba donde tenía que estar desde el principio, sin tocar nada a mano.
 */
function abrirYaRegistrado(info, pendientes, r) {
    const cuando = info.aprobado_at || info.created_at;
    let cuandoTxt = '';
    try {
        cuandoTxt = new Date(cuando).toLocaleString(getDateLocale(), {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    } catch { cuandoTxt = ''; }

    const cab = [
        info.proveedor,
        info.numero_factura ? 'factura ' + info.numero_factura : ''
    ].filter(Boolean).join(' · ');

    const filas = (info.items || []).map(it => {
        const cant = parseFloat(it.cantidad) || 0;
        const pre = parseFloat(it.precio) || 0;
        const nom = it.ingrediente_nombre_db || it.ingrediente_nombre || '';
        return `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #f2e7dd;font-size:13px;">
            <span style="color:#3a2216;flex:1;min-width:0;">${escapeHTML(nom)}</span>
            <span style="color:#a8917f;white-space:nowrap;">${formatQuantity(cant)} × ${cm(pre)}</span>
            <span style="color:#3a2216;font-weight:700;white-space:nowrap;">${cm(cant * pre)}</span>
        </div>`;
    }).join('');

    const hayPedido = !!(pendientes && pendientes.length);
    const ped = hayPedido ? pendientes[0] : null;

    const ov = overlaySheet(`
        <div style="width:52px;height:52px;border-radius:16px;background:${hayPedido ? '#fffbeb' : '#eef7ee'};display:flex;align-items:center;justify-content:center;font-size:26px;margin:2px auto 10px;">${hayPedido ? '⚠️' : '✅'}</div>
        <h2 style="text-align:center;font-size:19px;font-weight:800;color:#3a2216;margin:0 0 6px;">${hayPedido ? 'Se guardó como compra suelta' : 'Este albarán ya está registrado'}</h2>
        <p style="text-align:center;font-size:13.5px;line-height:1.5;color:#a07d68;margin:0 auto 14px;max-width:38ch;">
            ${hayPedido
        ? `Lo diste de alta ${cuandoTxt ? `el <b>${escapeHTML(cuandoTxt)}</b>` : 'antes'}, pero <b>fuera del pedido</b>, así que tu pedido del ${escapeHTML(fmtFechaAlb(ped.fecha))} (${cm(parseFloat(ped.total) || 0)}) sigue pendiente. Puedo pasarlo a ese pedido: deshago el registro anterior y abro la recepción para que revises cantidades y precios.`
        : `Lo diste de alta ${cuandoTxt ? `el <b>${escapeHTML(cuandoTxt)}</b>` : 'anteriormente'}. El stock y los precios ya se actualizaron entonces, así que no hace falta volver a subirlo.`}
        </p>
        ${cab ? `<div style="text-align:center;font-size:12.5px;color:#8a5a3e;margin-bottom:10px;">${escapeHTML(cab)}</div>` : ''}
        <div style="background:#fffdfb;border:1px solid #efe1d5;border-radius:14px;padding:10px 13px;margin-bottom:8px;max-height:34vh;overflow-y:auto;">
            ${filas || '<div style="color:#a8917f;font-size:13px;">Sin líneas.</div>'}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:800;color:#3a2216;padding:4px 3px 14px;">
            <span>${info.itemCount} ${info.itemCount === 1 ? 'línea' : 'líneas'}</span>
            <span>${cm(info.totalImporte || 0)}</span>
        </div>
        ${hayPedido
        ? `<button type="button" data-act="pasar" style="${BTN_TERRA}">Pasarlo al pedido #${ped.id}</button>
           <button type="button" data-act="cerrar" style="${BTN_GHOST}">Dejarlo como está</button>`
        : `<button type="button" data-act="cerrar" style="${BTN_TERRA}">Entendido</button>`}`);

    ov.addEventListener('click', async (ev) => {
        if (ev.target === ov || ev.target.closest('[data-act="cerrar"]')) { ov.remove(); return; }
        if (!ev.target.closest('[data-act="pasar"]')) return;

        const btn = ev.target.closest('[data-act="pasar"]');
        btn.disabled = true;
        btn.textContent = 'Deshaciendo el registro…';

        const ok = await revertirRegistro(info.batchId);
        if (!ok) {
            btn.disabled = false;
            btn.textContent = `Pasarlo al pedido #${ped.id}`;
            window.showToast?.('No se pudo deshacer el registro anterior. Revísalo en la cola de compras.', 'error');
            return;
        }

        // El albarán vuelve a estar pendiente: se recargan sus líneas y se recibe
        // sobre el pedido por el camino de siempre (mismo modal, mismas varianzas).
        const lineas = await cargarLineasBatch(info.batchId);
        ov.remove();
        if (!lineas.length) {
            window.showToast?.('Registro deshecho, pero no pude recuperar las líneas. Revisa la cola de compras.', 'warning');
            return;
        }
        await window.cargarDatos?.();
        prepararHints(lineas, ped, r || {});
        if (typeof window.marcarPedidoRecibido === 'function') {
            window.marcarPedidoRecibido(ped.id);
        } else {
            window.showToast?.('No se pudo abrir la recepción del pedido.', 'error');
        }
    });
}

// Punto de entrada tras leer el albarán: decide recepción-con-varianzas o compra nueva.
async function enrutarAlbaran(r) {
    const toast = (m, tt) => window.showToast?.(m, tt);
    const lineas = await cargarLineasBatch(r.batchId);

    // Sin líneas pendientes hay dos motivos muy distintos, y antes se trataban igual
    // (un toast de error): que el albarán YA se registrara, o que algo fallara de verdad.
    if (!lineas.length) {
        const info = await cargarBatch(r.batchId);
        if (info) {
            // Registrado ≠ pedido recibido. Si hay pedido pendiente de ese proveedor,
            // el albarán entró como compra suelta y se ofrece pasarlo al pedido.
            const provReg = casarProveedor(info.proveedor || r.proveedor);
            const pendReg = provReg ? pedidosPendientesDe(provReg.id, info.totalImporte || 0) : [];
            abrirYaRegistrado(info, pendReg, r);
            return;
        }
        toast('No pude cargar las líneas del albarán. Revísalo en la cola de compras.', 'warning');
        return;
    }

    const totalAlb = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);
    const prov = casarProveedor(r.proveedor);
    const pendientes = prov ? pedidosPendientesDe(prov.id, totalAlb) : [];
    if (pendientes.length) abrirDecisionConPedido(r, prov, pendientes, lineas);
    else abrirDecisionSinPedido(r, prov);
}

// ==================== CONSOLIDACIÓN DEL ALBARÁN (compra nueva, sin pedido) ====================
// El albarán se consolida SOLO (sus propias líneas). Foto → líneas leídas → revisas
// (relacionas las nuevas) → Consolidar = registra stock + precio + diario
// (POST /purchases/pending/approve-batch). Las líneas sin ingrediente se OMITEN.
const CONSOL_OV = 'ml-consol-ov';
let consolEstado = { r: null, batchId: null, lineas: [] };

function cerrarConsol() { document.getElementById(CONSOL_OV)?.remove(); }

async function abrirConsolidacionAlbaran(r) {
    const toast = (m, tt) => window.showToast?.(m, tt);
    const lineas = await cargarLineasBatch(r.batchId);
    if (!lineas.length) { toast('No pude cargar las líneas del albarán. Revísalo en la cola de compras.', 'warning'); return; }
    consolEstado = {
        r, batchId: r.batchId,
        lineas: lineas.map(l => ({ id: l.id, nombre: l.nombre, ingredienteId: l.ingredienteId, ingredienteOriginal: l.ingredienteId, cantidad: l.cantidad, precio: l.precio })),
    };
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
    const dupBanner = bannerDuplicado(r, 'Revísalo antes de consolidar.');
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
        <p style="text-align:center;font-size:13.5px;line-height:1.5;color:#a07d68;margin:0 auto 18px;max-width:34ch;">Haz una foto del albarán o la factura. La IA lee proveedor, productos, cantidades y precios por ti.</p>
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
