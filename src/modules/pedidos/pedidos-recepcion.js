/**
 * Pedidos Recepción Module
 * Flujo completo de recepción de pedidos con varianza de precio/cantidad
 *
 * Funciones:
 * - marcarPedidoRecibido: Abre modal de recepción
 * - renderItemsRecepcionModal: Renderiza items con inputs
 * - actualizarItemRecepcion: Handler de inputs
 * - actualizarTotalesRecepcion: Recalcula totales
 * - cambiarEstadoItem: Cambia estado OK/varianza/no-entregado
 * - cerrarModalRecibirPedido: Cierra modal
 * - confirmarRecepcionPedido: Confirma y actualiza stock
 */

import { t } from '@/i18n/index.js';
import { escapeHTML, cm, getDateLocale, formatQuantity } from '../../utils/helpers.js';
import { formatoDesdeBase, esCantidadEnteraEnFormato } from './formato-utils.js';
import ingredientStore from '../../stores/ingredientStore.js';
import { precioDesviacionSospechosa, getIngredientUnitPrice } from '../../utils/cost-calculator.js';

/**
 * Contexto de formato de un ingrediente para mostrar la recepción en formato
 * de compra (bote, caja…) en vez de unidad base. cpf>1 + formato_compra = hay
 * formato. El dato interno (cantidadRecibida/precioReal) SIEMPRE queda en base;
 * esto es SOLO para mostrar/editar. Así el delta de stock no cambia y no se
 * puede inflar inventario.
 */
function ctxFormato(ing) {
    const cpfRaw = parseFloat(ing?.cantidad_por_formato);
    const cpf = cpfRaw > 1 ? cpfRaw : 1;
    const formatoNombre = ing?.formato_compra;
    return { cpf, formatoNombre, usaFormato: cpf > 1 && !!formatoNombre };
}

// 🔒 Guard anti-doble-click: si una recepción está en curso, el siguiente clic no hace nada.
// Evita duplicar stock cuando el usuario pulsa "Confirmar" dos veces rápido.
let isConfirmingReception = false;

/**
 * 📸 Pieza B.2: VUELCA los datos leídos del albarán en las líneas de recepción ya
 * macheadas (mismo criterio de unidad que un input manual: valor de display × / ÷ cpf).
 * Marca varianza si difiere del pedido. NO consolida — el humano revisa y confirma.
 */
function volcarAlbaranEnRecepcion(ped) {
    const hints = window.__albaranHints;
    if (!hints || !ped.itemsRecepcion) return;
    const ingMap = new Map((window.ingredientes || []).map((i) => [i.id, i]));
    ped.itemsRecepcion.forEach((item) => {
        if (item.personal === true) return;
        const ingId = item.ingredienteId || item.ingrediente_id;
        const h = hints.porIngrediente.get(Number(ingId));
        if (!h) return;
        const ing = ingMap.get(ingId);
        const cpfRaw = parseFloat(ing?.cantidad_por_formato);
        const cpf = cpfRaw > 1 ? cpfRaw : 1;
        const usaFormato = cpf > 1 && !!ing?.formato_compra
            && esCantidadEnteraEnFormato(parseFloat(item.cantidad || 0), cpf);
        const k = usaFormato ? cpf : 1;
        item.cantidadRecibida = (parseFloat(h.cantidad) || 0) * k;
        item.precioReal = (parseFloat(h.precio) || 0) / k;
        if (Math.abs(item.cantidadRecibida - item.cantidad) > 0.01
            || Math.abs(item.precioReal - item.precioUnitario) > 0.01) {
            item.estado = 'varianza';
        }
    });
}

/**
 * Marca un pedido como recibido (abre modal)
 * @param {number} id - ID del pedido
 */
export function marcarPedidoRecibido(id) {
    window.pedidoRecibiendoId = id;
    const ped = (window.pedidos || []).find(p => p.id === id);
    if (!ped) return;

    const prov = (window.proveedores || []).find(
        p => p.id === ped.proveedorId || p.id === ped.proveedor_id
    );

    // Llenar info del modal
    const provSpan = document.getElementById('modal-rec-proveedor');
    if (provSpan) provSpan.textContent = prov ? prov.nombre : 'Sin proveedor';

    // 🧾 Autorelleno IVA del albarán (Migración 015): prioriza el IVA que viaja
    // CON el pedido (puesto al crear/editar) → IVA habitual del proveedor → vacío.
    // El IVA se persiste pero NO afecta a precio_medio_compra ni al food cost;
    // `total` sigue siendo la BASE sin IVA.
    const ivaInput = document.getElementById('modal-rec-iva-pct');
    if (ivaInput) {
        if (ped.iva_pct !== null && ped.iva_pct !== undefined) {
            ivaInput.value = ped.iva_pct;
        } else if (prov && prov.iva_pct !== null && prov.iva_pct !== undefined) {
            ivaInput.value = prov.iva_pct;
        } else {
            ivaInput.value = '';
        }
        // Listener idempotente: removemos cualquier anterior antes de añadir.
        ivaInput.oninput = () => actualizarTotalConIva();
    }

    // 💸 Autorelleno bonificación del albarán (Migración 016): el importe que viaja
    // con el pedido (puesto al recibir/editar) → vacío. Al teclearla, recalcula la
    // base neta y el total con IVA.
    const bonifInput = document.getElementById('modal-rec-bonificacion');
    if (bonifInput) {
        bonifInput.value = (ped.bonificacion !== null && ped.bonificacion !== undefined && parseFloat(ped.bonificacion) > 0)
            ? ped.bonificacion
            : '';
        bonifInput.oninput = () => actualizarTotalConIva();
    }

    const fechaSpan = document.getElementById('modal-rec-fecha');
    if (fechaSpan) {
        const fechaStr = typeof ped.fecha === 'string' && ped.fecha.length === 10 ? ped.fecha + 'T12:00:00' : ped.fecha;
        // 🔒 Auditoría Capa 7 (S9): locale dinámico (era 'es-ES' hardcodeado)
        fechaSpan.textContent = new Date(fechaStr).toLocaleDateString(getDateLocale());
    }

    const totalSpan = document.getElementById('modal-rec-total-original');
    if (totalSpan) totalSpan.textContent = cm(ped.total || 0);

    // 📸 Si se llegó por foto (Pieza B.2), reconstruir para volcar los datos del albarán.
    const hayAlbaran = !!(window.__albaranHints && window.__albaranHints.pedidoId === id);
    if (hayAlbaran) ped.itemsRecepcion = null;

    // Inicializar items de recepción con estado
    // 🔒 Excluir items de tipo 'ajuste' (envases/bonificaciones) — solo afectan al total, no al stock
    if (!ped.itemsRecepcion) {
        ped.itemsRecepcion = (ped.ingredientes || [])
            // Solo se excluyen los 'ajuste' (envases). Las líneas de comida personal
            // SÍ se muestran (en modo lectura) para que el usuario las vea y el total
            // cuadre; el stock las salta aparte (filtro !item.personal en el confirm).
            .filter(item => item.tipo !== 'ajuste')
            .map(item => {
                const precio = parseFloat(item.precio_unitario || item.precio || 0);
                return {
                    ...item,
                    ingredienteId: item.ingredienteId || item.ingrediente_id,
                    precioUnitario: precio,
                    cantidadRecibida: parseFloat(item.cantidad || 0),
                    precioReal: precio,
                    estado: 'consolidado'
                };
            });
    }

    // 📸 Volcar cantidades y precios leídos del albarán en las líneas macheadas.
    if (hayAlbaran) volcarAlbaranEnRecepcion(ped);

    renderItemsRecepcionModal(ped);

    // Mostrar modal
    const modal = document.getElementById('modal-recibir-pedido');
    if (modal) modal.classList.add('active');
}

/**
 * Recalcula el "Total con IVA" del modal de recepción a partir del valor
 * actual del input IVA y del totalRecibido ya renderizado. Solo es DISPLAY
 * — no se envía al backend, no afecta a precio_medio_compra ni a ninguna
 * fórmula crítica. Permite al cliente cuadrar el total con el albarán
 * físico que viene con IVA aparte.
 */
/**
 * Parsea un string formateado con cm() (ej. "1.234,56 €" o "1,234.56 RM")
 * a número. Soporta los dos separadores europeos comunes:
 *   - es/ca/pt: "1.234,56" → 1234.56 (punto miles, coma decimal)
 *   - en/zh:    "1,234.56" → 1234.56 (coma miles, punto decimal)
 * Si solo hay un separador, asume que es decimal.
 */
function parseMonedaLocale(str) {
    if (!str) return 0;
    const limpio = String(str).replace(/[^0-9.,-]/g, '');
    if (!limpio) return 0;
    const hasComma = limpio.includes(',');
    const hasDot = limpio.includes('.');
    if (hasComma && hasDot) {
        // Detectar cuál es el decimal: el que aparece más tarde.
        const idxComma = limpio.lastIndexOf(',');
        const idxDot = limpio.lastIndexOf('.');
        if (idxComma > idxDot) {
            // coma decimal, punto miles
            return parseFloat(limpio.replace(/\./g, '').replace(',', '.')) || 0;
        }
        // punto decimal, coma miles
        return parseFloat(limpio.replace(/,/g, '')) || 0;
    }
    if (hasComma) {
        return parseFloat(limpio.replace(',', '.')) || 0;
    }
    return parseFloat(limpio) || 0;
}

export function actualizarTotalConIva() {
    const ivaInput = document.getElementById('modal-rec-iva-pct');
    const bonifInput = document.getElementById('modal-rec-bonificacion');
    const resumenRec = document.getElementById('modal-rec-resumen-recibido');
    const resumenBase = document.getElementById('modal-rec-resumen-base-neta');
    const resumenConIva = document.getElementById('modal-rec-resumen-con-iva');
    if (!resumenConIva) return;
    // Re-parseamos el total recibido (BRUTO: Σ líneas + ajustes) desde el DOM.
    // Soporta separadores de miles europeos.
    const totalRecibido = parseMonedaLocale(resumenRec?.textContent);
    // 💸 Bonificación: descuento real → baja la base. Clamp a [0, totalRecibido]
    // (no permitir base negativa).
    const bonif = bonifInput ? Math.max(0, parseFloat(bonifInput.value) || 0) : 0;
    const baseNeta = Math.max(0, totalRecibido - bonif);
    if (resumenBase) resumenBase.textContent = cm(baseNeta);
    const ivaPct = ivaInput ? (parseFloat(ivaInput.value) || 0) : 0;
    // Clamp defensivo aunque el constraint backend ya lo cubre.
    const ivaClamped = Math.min(100, Math.max(0, ivaPct));
    // El IVA se aplica sobre la base NETA (tras bonificación). cm() respeta la moneda.
    const totalConIva = baseNeta * (1 + ivaClamped / 100);
    resumenConIva.textContent = cm(totalConIva);
}

/**
 * Renderiza los items del modal de recepción con cálculo de varianza
 * ⚡ OPTIMIZACIÓN: Pre-build Map de ingredientes
 */
function renderItemsRecepcionModal(ped) {
    const tbody = document.getElementById('modal-rec-items');
    if (!tbody) return;

    // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez, no .find() O(n) por cada item
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    let html = '';
    let totalOriginal = 0;
    let totalRecibido = 0;

    // data-label por columna → vista TARJETA en móvil (#tabla-recepcion, main.css).
    // El camarero recibe el albarán desde el móvil: antes era una tabla de 780px
    // con scroll lateral. Las etiquetas las pinta td::before{content:attr(data-label)}.
    const lRecIng = t('pedidos:reception_col_ingredient');
    const lRecPed = t('pedidos:reception_col_ordered');
    const lRecRec = t('pedidos:reception_col_received');
    const lRecPP = t('pedidos:reception_col_price_ordered');
    const lRecPR = t('pedidos:reception_col_price_real');
    const lRecSub = t('pedidos:reception_col_subtotal');
    const lRecEst = t('pedidos:reception_col_status');

    ped.itemsRecepcion.forEach((item, idx) => {
        const ingId = item.ingredienteId || item.ingrediente_id;
        const ing = ingMap.get(ingId);
        const nombre = ing ? ing.nombre : 'Ingrediente';
        const unidad = ing ? ing.unidad : '';

        const cantPedida = parseFloat(item.cantidad || 0);
        const cantRecibida = parseFloat(item.cantidadRecibida || 0);
        const precioPed = parseFloat(item.precioUnitario || 0);
        const precioReal = parseFloat(item.precioReal || 0);

        const subtotalOriginal = cantPedida * precioPed;
        const subtotalRecibido = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

        totalOriginal += subtotalOriginal;
        totalRecibido += subtotalRecibido;

        // 📦 Mostrar en FORMATO de compra (bote, caja…) como el resto de la app.
        // SOLO display: cantidadRecibida/precioReal siguen en base internamente,
        // el delta de stock no cambia → imposible inflar inventario por esto.
        const { cpf, formatoNombre } = ctxFormato(ing);
        // Formato solo si la cantidad pedida son cajas/botes ENTEROS; si no
        // (reparto de personal, sueltas), en base (botella) para no ver 0,333 CAJA.
        const usaFormato = cpf > 1 && !!formatoNombre && esCantidadEnteraEnFormato(cantPedida, cpf);
        const unidadLabel = usaFormato ? formatoNombre : unidad;
        const cantPedidaShown = usaFormato ? formatoDesdeBase(cantPedida, 0, cpf).cantidad : cantPedida;
        const cantRecibidaShown = usaFormato ? formatoDesdeBase(cantRecibida, 0, cpf).cantidad : cantRecibida;
        const precioPedShown = usaFormato ? formatoDesdeBase(0, precioPed, cpf).precio : precioPed;
        const precioRealShown = usaFormato ? formatoDesdeBase(0, precioReal, cpf).precio : precioReal;
        const precioPedTxt = usaFormato ? `${cm(precioPedShown)}/${escapeHTML(formatoNombre)}` : cm(precioPed);
        const precioRealTxt = usaFormato ? `${cm(precioRealShown)}/${escapeHTML(formatoNombre)}` : cm(precioReal);
        const hintBase = usaFormato ? `<div style="font-size:10px;color:#94a3b8;">= ${escapeHTML(formatQuantity(cantPedida))} ${escapeHTML(unidad)}</div>` : '';
        // En modo base (usaFormato=false) NO se debe convertir al teclear → cpf=1,
        // si no, multiplicaría el valor base por cpf e inflaría el stock.
        const cpfInput = usaFormato ? cpf : 1;
        const recOnchange = `window.actualizarItemRecepcion(${idx}, 'cantidad', this.value, ${cpfInput})`;
        const precioOnchange = `window.actualizarItemRecepcion(${idx}, 'precio', this.value, ${cpfInput})`;

        // 📸 Pieza B.2: los datos del albarán ya vienen VOLCADOS en los inputs (se
        // rellenan al abrir la recepción por foto, en marcarPedidoRecibido). Aquí solo
        // se marca el origen (📸) y el aviso de precio. El humano revisa y confirma
        // igual que a mano — no hay que pulsar nada por línea.
        const albHint = (window.__albaranHints && window.__albaranHints.pedidoId === ped.id)
            ? window.__albaranHints.porIngrediente.get(Number(ingId)) : null;
        const albHintCant = albHint
            ? '<span title="Volcado del albarán" style="margin-left:5px;font-size:11px;">📸</span>'
            : '';
        // 📈 Aviso de subida de precio: compara el precio del albarán (base = €/ud,
        // ÷cpf de la fila) con el del pedido. Rojo si sube ≥5%, verde si baja ≥5%.
        let albPrecioBadge = '';
        if (albHint && precioPed > 0) {
            const albBase = (parseFloat(albHint.precio) || 0) / cpfInput;
            const pct = ((albBase - precioPed) / precioPed) * 100;
            if (pct >= 5) albPrecioBadge = `<span style="font-size:9.5px;font-weight:800;color:#b91c1c;background:#fde2e2;border-radius:5px;padding:1px 6px;">▲ +${pct.toFixed(0)}% vs pedido</span>`;
            else if (pct <= -5) albPrecioBadge = `<span style="font-size:9.5px;font-weight:800;color:#047857;background:#d1fae5;border-radius:5px;padding:1px 6px;">▼ ${pct.toFixed(0)}%</span>`;
        }
        const albHintPrecio = albHint
            ? `<div style="margin-top:3px;">${albPrecioBadge || '<span title="Volcado del albarán" style="font-size:11px;">📸</span>'}</div>`
            : '';

        // 🍽️ Líneas de comida personal: fila en modo LECTURA (gris, badge), sin
        // inputs ni estado. Cuenta en el total pero NO toca stock ni food cost.
        if (item.personal === true) {
            html += `
          <tr style="background:#faf5ff;">
            <td data-label="${lRecIng}">${escapeHTML(nombre)} <span style="display:inline-block;margin-left:6px;font-size:10px;font-weight:700;color:#7c3aed;background:#ede9fe;border-radius:6px;padding:2px 7px;white-space:nowrap;">🍽️ ${escapeHTML(t('pedidos:personal_label'))}</span></td>
            <td data-label="${lRecPed}">${formatQuantity(cantPedidaShown)} ${escapeHTML(unidadLabel)}</td>
            <td data-label="${lRecRec}"><span style="color:#94a3b8;">${formatQuantity(cantPedidaShown)} ${escapeHTML(unidadLabel)}</span></td>
            <td data-label="${lRecPP}">${precioPedTxt}</td>
            <td data-label="${lRecPR}"><span style="color:#94a3b8;">${precioRealTxt}</span></td>
            <td data-label="${lRecSub}"><strong>${cm(subtotalRecibido)}</strong></td>
            <td data-label="${lRecEst}"><span style="font-size:11px;color:#7c3aed;font-weight:600;">no toca stock</span></td>
          </tr>
        `;
            return;
        }

        html += `
          <tr>
            <td data-label="${lRecIng}">${escapeHTML(nombre)}</td>
            <td data-label="${lRecPed}">${formatQuantity(cantPedidaShown)} ${escapeHTML(unidadLabel)}${hintBase}</td>
            <td data-label="${lRecRec}">
              ${item.estado === 'no-entregado'
                ? '<span style="color:#999;">-</span>'
                : `<input type="number" step="0.01" min="0" value="${cantRecibidaShown}" id="rec-cant-${idx}" data-cpf="${cpfInput}"
                    style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                    oninput="${recOnchange}"> <small style="color:#64748b;">${escapeHTML(unidadLabel)}</small>${albHintCant}`
            }
            </td>
            <td data-label="${lRecPP}">${precioPedTxt}</td>
            <td data-label="${lRecPR}">
              ${item.estado === 'no-entregado'
                ? '<span style="color:#999;">-</span>'
                : `<input type="number" step="0.01" min="0" value="${usaFormato ? precioRealShown.toFixed(2) : precioReal}" id="rec-precio-${idx}" data-cpf="${cpfInput}"
                    style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                    oninput="${precioOnchange}">${usaFormato ? ` <small style="color:#64748b;white-space:nowrap;">/${escapeHTML(formatoNombre)}</small>` : ''}${albHintPrecio}`
            }
            </td>
            <td data-label="${lRecSub}"><strong id="subtotal-item-${idx}">${cm(subtotalRecibido)}</strong></td>
            <td data-label="${lRecEst}">
              <select onchange="window.cambiarEstadoItem(${idx}, this.value)"
                style="padding:5px;border:1px solid #ddd;border-radius:4px;">
                <option value="consolidado" ${item.estado === 'consolidado' ? 'selected' : ''}>✅ OK</option>
                <option value="varianza" ${item.estado === 'varianza' ? 'selected' : ''}>⚠️ Varianza</option>
                <option value="no-entregado" ${item.estado === 'no-entregado' ? 'selected' : ''}>❌ No entreg.</option>
              </select>
            </td>
          </tr>
        `;
    });

    // 📸 Extras del albarán: líneas leídas que NO están en el pedido (producto que
    // llegó de más, o que la IA no reconoció). Añadir/emparejar a mano; el humano
    // decide y confirma. NO se añade nada solo.
    const hintsX = window.__albaranHints;
    window.__albaranExtras = [];
    if (hintsX && hintsX.pedidoId === ped.id && Array.isArray(hintsX.todasLineas)) {
        const idsPedido = new Set((ped.itemsRecepcion || []).map((it) => Number(it.ingredienteId || it.ingrediente_id)));
        window.__albaranExtras = hintsX.todasLineas.filter((l) => l.ingredienteId === null || !idsPedido.has(Number(l.ingredienteId)));
        if (window.__albaranExtras.length) {
            const ingsSorted = [...(window.ingredientes || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
            html += `<tr><td colspan="7" style="padding-top:14px;font-weight:800;font-size:12px;color:#b45309;text-transform:uppercase;letter-spacing:.05em;">📸 En el albarán, no en el pedido</td></tr>`;
            window.__albaranExtras.forEach((ex, ei) => {
                const sub = (parseFloat(ex.cantidad) || 0) * (parseFloat(ex.precio) || 0);
                if (ex.ingredienteId !== null) {
                    const ing = ingMap.get(Number(ex.ingredienteId));
                    const nom = ing ? ing.nombre : (ex.nombre || 'Ingrediente');
                    html += `<tr style="background:#f0fdf4;">
                        <td data-label="${lRecIng}">🆕 ${escapeHTML(nom)}</td>
                        <td data-label="${lRecPed}"><span style="color:#999;">—</span></td>
                        <td data-label="${lRecRec}">${escapeHTML(formatQuantity(ex.cantidad))}</td>
                        <td data-label="${lRecPP}"><span style="color:#999;">—</span></td>
                        <td data-label="${lRecPR}">${cm(ex.precio)}</td>
                        <td data-label="${lRecSub}"><strong>${cm(sub)}</strong></td>
                        <td data-label="${lRecEst}"><button type="button" onclick="window.anadirExtraAlbaran(${ei})" style="border:0;background:#059669;color:#fff;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;">Añadir</button></td>
                      </tr>`;
                } else {
                    const opts = ingsSorted.map((i) => `<option value="${i.id}">${escapeHTML(i.nombre)}</option>`).join('');
                    html += `<tr style="background:#fffbeb;">
                        <td data-label="${lRecIng}">❓ ${escapeHTML(ex.nombre || 'No reconocido')} <small style="color:#b45309;">(${escapeHTML(formatQuantity(ex.cantidad))} · ${cm(ex.precio)})</small></td>
                        <td data-label="Emparejar" colspan="6">
                          <select id="rel-extra-${ei}" style="max-width:160px;padding:5px;border:1px solid #ddd;border-radius:5px;font-size:12px;"><option value="">Emparejar con…</option>${opts}</select>
                          <button type="button" onclick="window.emparejarExtraAlbaran(${ei})" style="border:0;background:#059669;color:#fff;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:800;cursor:pointer;margin-left:6px;">Añadir</button>
                        </td>
                      </tr>`;
                }
            });
        }
    }

    tbody.innerHTML = html;

    // Actualizar resúmenes
    const varianza = totalRecibido - totalOriginal;

    const resumenOrig = document.getElementById('modal-rec-resumen-original');
    if (resumenOrig) resumenOrig.textContent = cm(totalOriginal);

    const resumenRec = document.getElementById('modal-rec-resumen-recibido');
    if (resumenRec) resumenRec.textContent = cm(totalRecibido);

    const resumenVar = document.getElementById('modal-rec-resumen-varianza');
    if (resumenVar) {
        resumenVar.textContent = (varianza >= 0 ? '+' : '') + cm(varianza);
        resumenVar.style.color = varianza > 0 ? '#ef4444' : varianza < 0 ? '#10b981' : '#666';
    }

    // Recalcula "Total con IVA" tras cualquier cambio en el total recibido.
    actualizarTotalConIva();
}

/**
 * Actualiza un item de recepción y recalcula totales SIN perder el foco
 */
export function actualizarItemRecepcion(idx, tipo, valor, cpf) {
    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
    if (!ped || !ped.itemsRecepcion) return;

    const item = ped.itemsRecepcion[idx];
    if (!item) return;

    // 📦 El input puede venir en FORMATO (botes). Se convierte a unidad BASE
    // antes de guardar en el item, porque el delta de stock y los totales se
    // calculan SIEMPRE en base. cantidad: formato × cpf. precio: €/formato ÷ cpf.
    // cpf<=1 (sin formato) → k=1, comportamiento idéntico al de antes.
    const k = parseFloat(cpf) > 1 ? parseFloat(cpf) : 1;

    if (tipo === 'cantidad') {
        item.cantidadRecibida = (parseFloat(valor) || 0) * k;
        // Auto-detectar varianza (ambos lados en base)
        if (Math.abs(item.cantidadRecibida - item.cantidad) > 0.01) {
            item.estado = 'varianza';
        }
    } else if (tipo === 'precio') {
        item.precioReal = (parseFloat(valor) || 0) / k;
        // Auto-detectar varianza (ambos lados en base)
        if (Math.abs(item.precioReal - item.precioUnitario) > 0.01) {
            item.estado = 'varianza';
        }
    }

    // Solo actualizar los totales, NO re-renderizar toda la tabla
    actualizarTotalesRecepcion(ped, idx);
}

/**
 * Actualiza solo los totales y el subtotal de una fila específica (sin perder foco)
 */
function actualizarTotalesRecepcion(ped, idxActualizado) {
    let totalOriginal = 0;
    let totalRecibido = 0;

    ped.itemsRecepcion.forEach((item, idx) => {
        const cantPedida = parseFloat(item.cantidad || 0);
        const cantRecibida = parseFloat(item.cantidadRecibida || 0);
        const precioPed = parseFloat(item.precioUnitario || 0);
        const precioReal = parseFloat(item.precioReal || 0);

        const subtotalOriginal = cantPedida * precioPed;
        const subtotalRecibido = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

        totalOriginal += subtotalOriginal;
        totalRecibido += subtotalRecibido;

        // Actualizar subtotal de la fila modificada
        if (idx === idxActualizado) {
            const subtotalEl = document.getElementById(`subtotal-item-${idx}`);
            if (subtotalEl) {
                subtotalEl.textContent = cm(subtotalRecibido);
            }
        }
    });

    // Actualizar resúmenes
    const varianza = totalRecibido - totalOriginal;

    const resumenOrig = document.getElementById('modal-rec-resumen-original');
    if (resumenOrig) resumenOrig.textContent = cm(totalOriginal);

    const resumenRec = document.getElementById('modal-rec-resumen-recibido');
    if (resumenRec) resumenRec.textContent = cm(totalRecibido);

    const resumenVar = document.getElementById('modal-rec-resumen-varianza');
    if (resumenVar) {
        resumenVar.textContent = (varianza >= 0 ? '+' : '') + cm(varianza);
        resumenVar.style.color = varianza > 0 ? '#ef4444' : varianza < 0 ? '#10b981' : '#666';
    }

    // Recalcula "Total con IVA" tras cualquier cambio en el total recibido.
    actualizarTotalConIva();
}

/**
 * Cambia el estado de un item de recepción
 */
export function cambiarEstadoItem(idx, estado) {
    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
    if (!ped || !ped.itemsRecepcion) return;

    ped.itemsRecepcion[idx].estado = estado;
    renderItemsRecepcionModal(ped);
}

/**
 * Cierra el modal de recibir pedido
 */
export function cerrarModalRecibirPedido() {
    const modal = document.getElementById('modal-recibir-pedido');
    if (modal) modal.classList.remove('active');
    window.pedidoRecibiendoId = null;
    // Limpiar pistas del albarán (Pieza B.2) para que no reaparezcan en una
    // recepción manual posterior de otro pedido.
    window.__albaranHints = null;
    window.__albaranExtras = null;
}

/**
 * 📸 Pieza B.2: aplica el valor leído del albarán a una línea (cantidad o precio).
 * El valor del albarán se trata como valor de DISPLAY (misma unidad que el input
 * de la fila) y se convierte a base con el cpf de la fila, IGUAL que un input
 * manual. Marca varianza si difiere de lo pedido. NO confirma nada: el humano
 * sigue teniendo que pulsar "Confirmar recepción".
 */
function aplicarAlbaran(idx, tipo) {
    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
    const hints = window.__albaranHints;
    if (!ped || !ped.itemsRecepcion || !hints || hints.pedidoId !== ped.id) return;
    const item = ped.itemsRecepcion[idx];
    if (!item) return;
    const h = hints.porIngrediente.get(Number(item.ingredienteId || item.ingrediente_id));
    if (!h) return;
    const inputId = tipo === 'cantidad' ? `rec-cant-${idx}` : `rec-precio-${idx}`;
    const cpfRaw = parseFloat(document.getElementById(inputId)?.dataset.cpf);
    const k = cpfRaw > 1 ? cpfRaw : 1;
    if (tipo === 'cantidad') {
        item.cantidadRecibida = (parseFloat(h.cantidad) || 0) * k;
        if (Math.abs(item.cantidadRecibida - item.cantidad) > 0.01) item.estado = 'varianza';
    } else {
        item.precioReal = (parseFloat(h.precio) || 0) / k;
        if (Math.abs(item.precioReal - item.precioUnitario) > 0.01) item.estado = 'varianza';
    }
    renderItemsRecepcionModal(ped);
}
export function aplicarAlbaranCant(idx) { aplicarAlbaran(idx, 'cantidad'); }
export function aplicarAlbaranPrecio(idx) { aplicarAlbaran(idx, 'precio'); }

/**
 * 📸 Añade una línea EXTRA del albarán (producto que no estaba en el pedido) como
 * línea recibida. Pedido=0 (no se pidió) → sale como varianza. El humano confirma.
 */
function anadirLineaRecepcion(ped, ingredienteId, cantidadBase, precioBase) {
    const ing = (window.ingredientes || []).find((i) => i.id === Number(ingredienteId));
    ped.itemsRecepcion = ped.itemsRecepcion || [];
    ped.itemsRecepcion.push({
        ingredienteId: Number(ingredienteId),
        ingrediente_id: Number(ingredienteId),
        cantidad: 0,                 // no estaba en el pedido
        precioUnitario: precioBase,
        cantidadRecibida: cantidadBase,
        precioReal: precioBase,
        estado: 'varianza',
        nombre: ing ? ing.nombre : '',
    });
}

export function anadirExtraAlbaran(ei) {
    const ped = (window.pedidos || []).find((p) => p.id === window.pedidoRecibiendoId);
    const ex = (window.__albaranExtras || [])[ei];
    if (!ped || !ex || ex.ingredienteId === null || ex.ingredienteId === undefined) return;
    anadirLineaRecepcion(ped, ex.ingredienteId, parseFloat(ex.cantidad) || 0, parseFloat(ex.precio) || 0);
    renderItemsRecepcionModal(ped);
}

export function emparejarExtraAlbaran(ei) {
    const ped = (window.pedidos || []).find((p) => p.id === window.pedidoRecibiendoId);
    const ex = (window.__albaranExtras || [])[ei];
    const sel = document.getElementById('rel-extra-' + ei);
    const ingId = sel ? Number(sel.value) : 0;
    if (!ped || !ex || !ingId) { window.showToast?.('Elige un ingrediente para emparejar.', 'warning'); return; }
    ex.ingredienteId = ingId;   // marca la línea como emparejada (no reaparece)
    anadirLineaRecepcion(ped, ingId, parseFloat(ex.cantidad) || 0, parseFloat(ex.precio) || 0);
    renderItemsRecepcionModal(ped);

    // 🧠 APRENDER: guarda el texto que leyó el OCR como alias del ingrediente, para
    // que el próximo albarán lo machee solo. Fire-and-forget: si falla, la recepción
    // sigue igual (no bloquea nada).
    const aliasTxt = (ex.nombre || '').toString().trim();
    if (aliasTxt && window.API?.fetch) {
        window.API.fetch('/purchases/alias', {
            method: 'POST',
            body: JSON.stringify({ ingredienteId: ingId, alias: aliasTxt }),
        }).then((r) => {
            if (r && r.success && !r.alreadyExists) {
                window.showToast?.(`🧠 Aprendido: "${aliasTxt}" lo reconoceré solo la próxima vez.`, 'success');
            }
        }).catch(() => { /* no rompe la recepción */ });
    }
}

/**
 * Confirma la recepción del pedido (actualiza stock Y PRECIO MEDIO PONDERADO)
 * 💰 CORREGIDO: Ahora calcula media ponderada de precios
 */
export async function confirmarRecepcionPedido() {
    if (window.pedidoRecibiendoId === null) return;
    if (isConfirmingReception) {
        console.warn('⏳ Recepción ya en curso, ignorando doble-click');
        return;
    }

    const ped = (window.pedidos || []).find(p => p.id === window.pedidoRecibiendoId);
    if (!ped || !ped.itemsRecepcion) return;

    // 🛡️ Guard anti-dedazo: avisar si algún precio recibido se desvía mucho de la
    // referencia del ingrediente (media de compras > configurado). NO bloquea: el
    // usuario confirma una subida real o vuelve a corregir. Evita que un precio mal
    // tecleado entre en la media de compras y reviente el food cost. Se ejecuta
    // ANTES de marcar isConfirmingReception → si cancela, no queda nada a medias.
    {
        const invMap = new Map((window.inventarioCompleto || []).map(i => [i.id, i]));
        const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));
        const sospechosos = [];
        for (const item of ped.itemsRecepcion) {
            if (item.estado === 'no-entregado') continue;
            const precioNuevo = parseFloat(item.precioReal || item.precioUnitario || 0);
            if (!(precioNuevo > 0)) continue;
            const ingId = item.ingredienteId || item.ingrediente_id;
            const inv = invMap.get(ingId);
            const ing = ingMap.get(ingId);
            // Referencia = precio unitario canónico (media de compras > configurado),
            // vía el helper único. Si no hay referencia (>0) no se puede comparar.
            const ref = getIngredientUnitPrice(inv, ing);
            const chk = precioDesviacionSospechosa(precioNuevo, ref);
            if (chk.sospechoso) {
                const nombre = ing ? ing.nombre : `Ingrediente ${ingId}`;
                const signo = chk.pct > 0 ? '+' : '';
                sospechosos.push(`• ${nombre}: ${cm(precioNuevo)} (${signo}${chk.pct}% vs ${cm(ref)})`);
            }
        }
        if (sospechosos.length > 0) {
            const msg = '⚠️ Estos precios se desvían mucho de lo habitual y entrarán en la media de compras:\n\n'
                + sospechosos.join('\n')
                + '\n\n¿Son correctos?\n\nAceptar = guardar igualmente · Cancelar = volver y corregir';
            if (!window.confirm(msg)) {
                return; // el usuario vuelve a corregir; no se ha tocado nada
            }
        }
    }

    isConfirmingReception = true;
    const btnConfirmar = document.querySelector('#modal-recibir-pedido button[onclick*="confirmarRecepcionPedido"]');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.style.opacity = '0.6';
        btnConfirmar.style.cursor = 'not-allowed';
    }

    window.showLoading();

    try {
        let totalRecibido = 0;

        // 💸 Bonificación del albarán (Migración 016): descuento del proveedor que SÍ
        // baja el COSTE real. Se reparte proporcionalmente entre las líneas de género
        // bajando su precioReal → ese precio neto va a precios_compra_diarios (food
        // cost) y al total. Así el camarero teclea el BRUTO en cada línea + la
        // bonificación del albarán, sin restar a mano. (Envases/ajustes NO se prorratean.)
        const bonifInput = document.getElementById('modal-rec-bonificacion');
        const bonificacion = bonifInput ? Math.max(0, parseFloat(bonifInput.value) || 0) : 0;
        const baseBrutaGenero = ped.itemsRecepcion.reduce((s, item) => {
            if (item.estado === 'no-entregado') return s;
            const cant = parseFloat(item.cantidadRecibida || 0);
            const pr = parseFloat(item.precioReal || item.precioUnitario || 0);
            return s + cant * pr;
        }, 0);
        // Clamp: la bonificación no puede dejar la base en negativo.
        const bonifAplicada = Math.min(bonificacion, baseBrutaGenero);
        const factorBonif = baseBrutaGenero > 0 ? (baseBrutaGenero - bonifAplicada) / baseBrutaGenero : 1;

        // Preparar ingredientes con precioReal actualizado (ya con la bonificación
        // repartida: precioReal neto = precioReal bruto × factorBonif).
        const ingredientesActualizados = ped.itemsRecepcion.map(item => {
            const cantRecibida = item.estado === 'no-entregado' ? 0 : parseFloat(item.cantidadRecibida || 0);
            const precioReal = parseFloat(item.precioReal || item.precioUnitario || 0) * factorBonif;

            if (item.estado !== 'no-entregado') {
                totalRecibido += cantRecibida * precioReal;
            }

            return {
                ingredienteId: item.ingredienteId,
                ingrediente_id: item.ingredienteId,
                // 🍽️ preservar la marca personal en el confirm (si no, recepción la
                // borraría y la línea volvería a contar en food cost/stock).
                personal: item.personal === true,
                cantidad: parseFloat(item.cantidad || 0),
                cantidadRecibida: cantRecibida,
                precioUnitario: parseFloat(item.precioUnitario || 0),
                precioReal: precioReal,
                precio_unitario: parseFloat(item.precioUnitario || 0),
                estado: item.estado || 'consolidado'
            };
        });

        // 🔒 Preservar items de tipo 'ajuste' (envases/bonificaciones) y sumar al total
        const ajustesOriginales = (ped.ingredientes || []).filter(it => it.tipo === 'ajuste');
        ajustesOriginales.forEach(aj => {
            ingredientesActualizados.push(aj);
            totalRecibido += parseFloat(aj.importe) || 0;
        });

        /**
         * ⚠️ CRITICAL - NO MODIFICAR ESTA SECCIÓN ⚠️
         * Solo se actualiza el STOCK, NUNCA el precio del ingrediente.
         * El backend calcula precio_medio correctamente desde los pedidos.
         * Modificar esto causará corrupción de datos de precio.
         *
         * 🔒 FIX v2: Usar ajuste atómico de stock (delta) en vez de valor absoluto
         * Esto evita que datos stale en window.ingredientes sobreescriban el stock real
         */
        // Preparar ajustes atómicos: delta en UNIDADES BASE
        // 🔧 FIX: cantidadRecibida YA viene en unidades base desde pedidos-crud.js línea 75
        // (cantidadReal = cantidadValue * formatoMult cuando se creó el pedido).
        // NO multiplicar otra vez — causaba multiplicación doble (bug 2026-04-15).
        const adjustments = ingredientesActualizados
            .filter(item => item.estado !== 'no-entregado' && !item.personal && parseFloat(item.cantidadRecibida) > 0)
            .map(item => ({
                id: item.ingredienteId,
                delta: parseFloat(item.cantidadRecibida)
            }));

        const actualizacionesExitosas = [];
        const actualizacionesFallidas = [];

        if (adjustments.length > 0) {
            try {
                const result = await window.api.bulkAdjustStock(adjustments, 'recepcion_pedido');

                // Procesar resultados
                for (const r of (result.results || [])) {
                    actualizacionesExitosas.push({
                        id: r.id,
                        nombre: r.nombre,
                        stockNuevo: r.stock_actual,
                        cantidadRecibida: r.delta
                    });
                    console.log(`📦 ${r.nombre}: +${r.delta} → Stock = ${r.stock_actual}`);
                }
                for (const e of (result.errors || [])) {
                    actualizacionesFallidas.push({
                        id: e.id,
                        nombre: `ID ${e.id}`,
                        error: e.error
                    });
                    console.error(`❌ Error stock ID ${e.id}: ${e.error}`);
                }
            } catch (bulkError) {
                // Fallback: intentar uno por uno
                console.error('❌ Bulk adjust falló, intentando uno por uno:', bulkError);
                for (const adj of adjustments) {
                    try {
                        const r = await window.api.adjustStock(adj.id, adj.delta, 'recepcion_pedido');
                        actualizacionesExitosas.push({
                            id: r.id,
                            nombre: r.nombre,
                            stockNuevo: r.stock_actual,
                            cantidadRecibida: r.delta
                        });
                    } catch (itemError) {
                        actualizacionesFallidas.push({
                            id: adj.id,
                            nombre: `ID ${adj.id}`,
                            error: itemError.message
                        });
                    }
                }
            }
        }

        // 🔒 FIX: Si hubo fallos, NO marcar pedido como recibido para evitar duplicación
        if (actualizacionesFallidas.length > 0) {
            const exitosos = actualizacionesExitosas.map(a => a.nombre).join(', ');
            const fallidos = actualizacionesFallidas.map(a => `${a.nombre}: ${a.error}`).join('\n');

            // Log para auditoría
            console.error('⚠️ RECEPCIÓN PARCIAL:', {
                pedidoId: window.pedidoRecibiendoId,
                exitosos: actualizacionesExitosas,
                fallidos: actualizacionesFallidas,
                fecha: new Date().toISOString()
            });

            window.hideLoading();

            alert(
                `⚠️ ATENCIÓN: Recepción parcialmente completada\n\n` +
                `✅ Stock actualizado: ${exitosos || 'ninguno'}\n\n` +
                `❌ Falló actualizar:\n${fallidos}\n\n` +
                `⚠️ El pedido NO se marcó como recibido para evitar duplicación.\n` +
                `Soluciona los errores e intenta de nuevo.`
            );

            await window.cargarDatos();
            await ingredientStore.getState().fetchIngredients();
            window.renderizarPedidos();
            window.renderizarIngredientes();
            return;
        }

        // Solo si TODOS los stocks se actualizaron, marcar pedido como recibido
        // 📅 FIX: Usar la fecha original del pedido para que el Diario registre en el día correcto
        const fechaOriginal = ped.fecha || new Date().toISOString();
        await window.api.updatePedido(window.pedidoRecibiendoId, {
            ...ped,
            estado: 'recibido',
            ingredientes: ingredientesActualizados, // ← IMPORTANTE: Esto guarda precioReal
            fecha_recepcion: fechaOriginal,
            // 💶 El GASTO del P&L (informe mensual, chat P&L, compras) usa pedidos.total.
            // Al recibir, total pasa a ser lo REALMENTE recibido (precio real × cantidad
            // recibida + ajustes/envases), no lo que se pidió → el gasto refleja lo que
            // pagas de verdad, en línea con el coste (precio_medio_compra sale del mismo
            // precioReal). Antes total se quedaba con el valor del pedido original y el
            // gasto no reflejaba descuentos/variaciones al recibir. (2026-06-27)
            total: totalRecibido,
            total_recibido: totalRecibido,
            totalRecibido: totalRecibido,
            // 🧾 IVA del albarán (Migración 015): persistir el valor del modal de
            // recepción (puede haberlo ajustado el camarero). Si está vacío, null →
            // el backend (COALESCE) conserva el que ya tenía el pedido. NO toca total.
            iva_pct: (() => {
                const el = document.getElementById('modal-rec-iva-pct');
                if (!el || el.value === '') return (ped.iva_pct ?? null);
                const v = parseFloat(el.value);
                return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : (ped.iva_pct ?? null);
            })(),
            // 💸 Bonificación del albarán (Migración 016): persistir el importe para
            // mostrarlo/cuadrar. El efecto en el coste YA va dentro de precioReal/total.
            bonificacion: bonifAplicada > 0 ? bonifAplicada : (ped.bonificacion ?? null)
        });

        // ℹ️ Diario (precios_compra_diarios) se registra automáticamente en el backend
        // al actualizar el pedido a estado='recibido' (PUT /api/orders/:id)
        // NO llamar a /daily/purchases/bulk aquí para evitar doble registro

        await window.cargarDatos();
        // 🔄 FIX stock stale: refrescar Zustand store para que TODAS las pestañas vean el stock nuevo
        await ingredientStore.getState().fetchIngredients();
        window.renderizarPedidos();
        window.renderizarIngredientes();
        window.renderizarInventario?.();
        window.hideLoading();
        cerrarModalRecibirPedido();
        window.showToast(t('pedidos:reception_success'), 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast(t('pedidos:reception_error', { message: error.message }), 'error');
    } finally {
        // 🔒 Liberar siempre el guard y rehabilitar el botón, pase lo que pase
        isConfirmingReception = false;
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.style.opacity = '';
            btnConfirmar.style.cursor = '';
        }
    }
}

// Exponer al window para compatibilidad con onclick en HTML
if (typeof window !== 'undefined') {
    window.marcarPedidoRecibido = marcarPedidoRecibido;
    window.actualizarItemRecepcion = actualizarItemRecepcion;
    window.cambiarEstadoItem = cambiarEstadoItem;
    window.cerrarModalRecibirPedido = cerrarModalRecibirPedido;
    window.aplicarAlbaranCant = aplicarAlbaranCant;
    window.aplicarAlbaranPrecio = aplicarAlbaranPrecio;
    window.anadirExtraAlbaran = anadirExtraAlbaran;
    window.emparejarExtraAlbaran = emparejarExtraAlbaran;
    window.confirmarRecepcionPedido = confirmarRecepcionPedido;
}
