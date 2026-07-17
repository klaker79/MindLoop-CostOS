/**
 * Recibir albarán por foto (Pieza B) — CosteOS móvil.
 *
 * Flujo: botón "Recibir albarán" → cámara nativa del móvil → foto → se reescala y
 * se manda a POST /parse-albaran (Claude Vision, ya activo en staging) → se muestra
 * lo que la IA ha leído. La reconciliación contra el pedido (pre-rellenar el modal
 * de recepción) llega en la Pieza B.2.
 *
 * Solo staging (OCR_ENABLED). En prod el backend devuelve 410 (backstop) → aquí se
 * avisa con un toast, no se rompe nada.
 */

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

        // Duplicado (por nº de factura o por imagen): NO es "poca luz". Se comprueba
        // ANTES que success (la respuesta de duplicado llega con success:false). En vez
        // de un callejón sin salida, le REABRIMOS el albarán ya leído para que pueda
        // recibirlo — no se duplica nada (Ley: nunca duplicar).
        if (r && r.duplicateWarning) {
            const dw = r.duplicateWarning;
            const nf = dw.numero_factura ? ` (factura ${dw.numero_factura})` : '';
            toast(`Este albarán ya lo habías escaneado${nf}. Te lo abro para recibirlo, no lo duplico.`, 'info');
            await reconciliarConPedido({ batchId: dw.batchId, proveedor: '', matched: dw.itemCount, totalItems: dw.itemCount });
            return;
        }
        if (!r || r.success !== true) {
            toast('No pude leer bien el albarán. Prueba con más luz, enfocado y recto, o mételo a mano.', 'warning');
            return;
        }
        // Pieza B.2: reconciliar contra el pedido pendiente del proveedor.
        await reconciliarConPedido(r);
    } catch (e) {
        window.hideLoading?.();
        // El backstop de prod devuelve 410; cualquier fallo aquí no rompe la app.
        toast('No se pudo procesar el albarán: ' + (e?.message || 'error'), 'error');
    }
}

// Normaliza un nombre (minúsculas, sin acentos ni signos) para comparar proveedores.
function normalizarNombre(s) {
    return (s || '').toString().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Pieza B.2 — reconciliación foto → pedido.
 * Trae las líneas leídas de este albarán (compras_pendientes), busca el/los
 * pedidos PENDIENTES del proveedor y abre el modal de recepción del pedido con
 * las pistas del albarán cargadas. NO escribe nada en el pedido ni en el stock:
 * solo prepara el modal; el humano revisa y confirma (Ley: auto-consolidar NUNCA).
 */
async function reconciliarConPedido(r) {
    const toast = (m, tt) => window.showToast?.(m, tt);

    // 1) Líneas leídas de ESTE batch. `porIngrediente` = macheadas (para volcar en
    //    la recepción). `todasLineas` = TODAS (incluidas las no encontradas, con
    //    ingredienteId=null y el nombre leído) → para relacionar/añadir las que no
    //    estén en el pedido.
    const porIngrediente = new Map();
    const todasLineas = [];
    let provDelBatch = '';
    try {
        const pend = await window.API.fetch('/purchases/pending?estado=pendiente');
        const lineas = (Array.isArray(pend) ? pend : []).filter(x => x.batch_id === r.batchId);
        lineas.forEach(l => {
            const id = (l.ingrediente_id !== null && l.ingrediente_id !== undefined) ? Number(l.ingrediente_id) : null;
            const cantidad = parseFloat(l.cantidad) || 0;
            const precio = parseFloat(l.precio) || 0;
            const nombre = l.ingrediente_nombre || l.ingrediente_nombre_db || '';
            if (!provDelBatch && l.proveedor) provDelBatch = l.proveedor;
            todasLineas.push({ ingredienteId: id, nombre, cantidad, precio });
            if (id !== null) porIngrediente.set(id, { cantidad, precio, nombre });
        });
    } catch { /* si falla, abrimos igual el pedido pero sin pistas */ }

    // Si venimos de un duplicado no traemos proveedor: lo sacamos de las líneas del batch.
    if (!r.proveedor && provDelBatch) r.proveedor = provDelBatch;
    // 2) Pedidos PENDIENTES del proveedor del albarán.
    const provNorm = normalizarNombre(r.proveedor);
    const provs = window.proveedores || [];
    const nombreProv = (pid) => normalizarNombre(provs.find(x => x.id === pid)?.nombre);
    const pendientes = (window.pedidos || []).filter(p => p.estado === 'pendiente');

    let candidatos = pendientes;
    if (provNorm) {
        const match = pendientes.filter(p => {
            const pn = nombreProv(p.proveedor_id ?? p.proveedorId);
            return pn && (pn.includes(provNorm) || provNorm.includes(pn));
        });
        if (match.length) candidatos = match;
    }

    if (!candidatos.length) {
        toast(`📸 Albarán de ${r.proveedor || 'proveedor'} leído (${r.matched}/${r.totalItems} líneas). No encontré un pedido pendiente de ese proveedor; revísalo en Pedidos.`, 'warning');
        return;
    }
    if (candidatos.length === 1) {
        abrirReconciliacion(candidatos[0].id, porIngrediente, todasLineas, r);
        return;
    }
    mostrarSelectorPedido(candidatos, porIngrediente, todasLineas, r);
}

function abrirReconciliacion(pedidoId, porIngrediente, todasLineas, r) {
    window.__albaranHints = { pedidoId, porIngrediente, todasLineas, proveedor: r.proveedor, batchId: r.batchId };
    if (typeof window.marcarPedidoRecibido === 'function') {
        window.marcarPedidoRecibido(pedidoId);
        window.showToast?.(`📸 Albarán de ${r.proveedor || ''} leído y volcado. Revisa las cantidades y precios (📸) y confirma la recepción.`, 'success');
    }
}

/** Selector simple cuando hay varios pedidos pendientes del mismo proveedor. */
function mostrarSelectorPedido(candidatos, porIngrediente, todasLineas, r) {
    document.getElementById('ml-albaran-picker')?.remove();
    const ov = document.createElement('div');
    ov.id = 'ml-albaran-picker';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;';
    const fmtFecha = (f) => { try { return new Date((typeof f === 'string' && f.length === 10) ? f + 'T12:00:00' : f).toLocaleDateString(); } catch { return ''; } };
    const filas = candidatos.map(p =>
        `<button type="button" data-pid="${p.id}" style="display:flex;justify-content:space-between;gap:12px;width:100%;text-align:left;border:0;border-bottom:1px solid #eef2f7;background:#fff;padding:14px 16px;font-size:15px;cursor:pointer;">
            <span>Pedido del ${fmtFecha(p.fecha)}</span>
            <strong>${window.cm ? window.cm(p.total || 0) : (p.total || 0)}</strong>
         </button>`
    ).join('');
    ov.innerHTML = `<div style="background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;overflow:hidden;">
        <div style="padding:14px 16px;font-weight:700;border-bottom:1px solid #eef2f7;">📸 ${r.proveedor || 'Proveedor'} — elige el pedido</div>
        ${filas}
        <button type="button" id="ml-albaran-picker-cancel" style="width:100%;border:0;background:#f8fafc;padding:14px;font-size:15px;color:#64748b;cursor:pointer;">Cancelar</button>
    </div>`;
    ov.addEventListener('click', (ev) => {
        if (ev.target === ov || ev.target.id === 'ml-albaran-picker-cancel') { ov.remove(); return; }
        const btn = ev.target.closest('[data-pid]');
        if (btn) {
            const pid = Number(btn.dataset.pid);
            ov.remove();
            abrirReconciliacion(pid, porIngrediente, todasLineas, r);
        }
    });
    document.body.appendChild(ov);
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
