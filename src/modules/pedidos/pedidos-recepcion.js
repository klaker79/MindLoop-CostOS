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

    // Autorelleno IVA del albarán desde el proveedor (Migration 013, 2026-06-06).
    // Si el proveedor no tiene iva_pct configurado, dejamos vacío (placeholder 0).
    // El IVA es SOLO display — no se envía al backend ni afecta a precio_medio_compra.
    const ivaInput = document.getElementById('modal-rec-iva-pct');
    if (ivaInput) {
        ivaInput.value = (prov && prov.iva_pct !== null && prov.iva_pct !== undefined) ? prov.iva_pct : '';
        // Listener idempotente: removemos cualquier anterior antes de añadir.
        ivaInput.oninput = () => actualizarTotalConIva();
    }

    const fechaSpan = document.getElementById('modal-rec-fecha');
    if (fechaSpan) {
        const fechaStr = typeof ped.fecha === 'string' && ped.fecha.length === 10 ? ped.fecha + 'T12:00:00' : ped.fecha;
        // 🔒 Auditoría Capa 7 (S9): locale dinámico (era 'es-ES' hardcodeado)
        fechaSpan.textContent = new Date(fechaStr).toLocaleDateString(getDateLocale());
    }

    const totalSpan = document.getElementById('modal-rec-total-original');
    if (totalSpan) totalSpan.textContent = cm(ped.total || 0);

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
    const resumenRec = document.getElementById('modal-rec-resumen-recibido');
    const resumenConIva = document.getElementById('modal-rec-resumen-con-iva');
    if (!resumenConIva) return;
    // Re-parseamos el total recibido desde el DOM para no tener que cablear
    // el valor desde 3 sitios. Soporta separadores de miles europeos.
    const totalRecibido = parseMonedaLocale(resumenRec?.textContent);
    const ivaPct = ivaInput ? (parseFloat(ivaInput.value) || 0) : 0;
    // Clamp defensivo aunque el constraint backend ya lo cubre.
    const ivaClamped = Math.min(100, Math.max(0, ivaPct));
    const totalConIva = totalRecibido * (1 + ivaClamped / 100);
    // cm() respeta la moneda del tenant (RM/€/...).
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

        // 🍽️ Líneas de comida personal: fila en modo LECTURA (gris, badge), sin
        // inputs ni estado. Cuenta en el total pero NO toca stock ni food cost.
        if (item.personal === true) {
            html += `
          <tr style="background:#faf5ff;">
            <td>${escapeHTML(nombre)} <span style="display:inline-block;margin-left:6px;font-size:10px;font-weight:700;color:#7c3aed;background:#ede9fe;border-radius:6px;padding:2px 7px;white-space:nowrap;">🍽️ ${escapeHTML(t('pedidos:personal_label'))}</span></td>
            <td>${formatQuantity(cantPedidaShown)} ${escapeHTML(unidadLabel)}</td>
            <td><span style="color:#94a3b8;">${formatQuantity(cantPedidaShown)} ${escapeHTML(unidadLabel)}</span></td>
            <td>${precioPedTxt}</td>
            <td><span style="color:#94a3b8;">${precioRealTxt}</span></td>
            <td><strong>${cm(subtotalRecibido)}</strong></td>
            <td><span style="font-size:11px;color:#7c3aed;font-weight:600;">no toca stock</span></td>
          </tr>
        `;
            return;
        }

        html += `
          <tr>
            <td>${escapeHTML(nombre)}</td>
            <td>${formatQuantity(cantPedidaShown)} ${escapeHTML(unidadLabel)}${hintBase}</td>
            <td>
              ${item.estado === 'no-entregado'
                ? '<span style="color:#999;">-</span>'
                : `<input type="number" step="0.01" min="0" value="${cantRecibidaShown}"
                    style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                    oninput="${recOnchange}"> <small style="color:#64748b;">${escapeHTML(unidadLabel)}</small>`
            }
            </td>
            <td>${precioPedTxt}</td>
            <td>
              ${item.estado === 'no-entregado'
                ? '<span style="color:#999;">-</span>'
                : `<input type="number" step="0.01" min="0" value="${usaFormato ? precioRealShown.toFixed(2) : precioReal}"
                    style="width:80px;padding:4px;border:1px solid #ddd;border-radius:4px;"
                    oninput="${precioOnchange}">${usaFormato ? ` <small style="color:#64748b;white-space:nowrap;">/${escapeHTML(formatoNombre)}</small>` : ''}`
            }
            </td>
            <td><strong id="subtotal-item-${idx}">${cm(subtotalRecibido)}</strong></td>
            <td>
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

        // Preparar ingredientes con precioReal actualizado
        const ingredientesActualizados = ped.itemsRecepcion.map(item => {
            const cantRecibida = item.estado === 'no-entregado' ? 0 : parseFloat(item.cantidadRecibida || 0);
            const precioReal = parseFloat(item.precioReal || item.precioUnitario || 0);

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
            total_recibido: totalRecibido,
            totalRecibido: totalRecibido
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
    window.confirmarRecepcionPedido = confirmarRecepcionPedido;
}
