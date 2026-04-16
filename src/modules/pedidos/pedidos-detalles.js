/**
 * Pedidos Detalles Module
 * Visualización de detalles de pedidos en modal
 *
 * Funciones:
 * - verDetallesPedido: Abre modal con info completa del pedido
 * - cerrarModalVerPedido: Cierra el modal
 */
import { t } from '@/i18n/index.js';
import { escapeHTML } from '../../utils/helpers.js';

/**
 * Muestra detalles de un pedido en modal
 * @param {number} pedidoId - ID del pedido
 */
export function verDetallesPedido(pedidoId) {
    window.pedidoViendoId = pedidoId;
    const ped = (window.pedidos || []).find(p => p.id === pedidoId);
    if (!ped) return;

    const prov = (window.proveedores || []).find(
        p => p.id === ped.proveedorId || p.id === ped.proveedor_id
    );
    const provNombre = prov ? prov.nombre : t('pedidos:detail_no_supplier');
    const lang = localStorage.getItem('mindloop_lang') || 'es';
    const locale = lang === 'en' ? 'en-GB' : 'es-ES';
    const fechaFormateada = new Date(ped.fecha).toLocaleDateString(locale);
    const estadoClass = ped.estado === 'recibido' ? '#10B981' : '#F59E0B';
    const estadoText = ped.estado === 'recibido' ? t('pedidos:detail_status_received') : t('pedidos:detail_status_pending');
    const esRecibido = ped.estado === 'recibido';

    let ingredientesHtml = '';
    let totalOriginal = 0;
    let totalRecibido = 0;

    // Determinar si usar itemsRecepcion (con varianza) o ingredientes básicos
    const itemsRaw = ped.itemsRecepcion || ped.ingredientes || [];
    // Separar ajustes (envases/bonificaciones) de items normales
    const items = itemsRaw.filter(it => it.tipo !== 'ajuste');
    const ajustes = itemsRaw.filter(it => it.tipo === 'ajuste');

    if (items.length > 0) {
        items.forEach(item => {
            const ingId = item.ingredienteId || item.ingrediente_id;
            const ing = (window.ingredientes || []).find(i => i.id === ingId);
            const nombreIng = ing ? ing.nombre : t('pedidos:detail_col_ingredient');
            const unidadIng = ing ? ing.unidad : '';

            // 🆕 Detectar si se usó formato de compra
            const formatoUsado = item.formatoUsado;
            const cantidadFormatos = item.cantidadFormatos || item.cantidadOriginal;
            const multiplicador = item.multiplicador || 1;
            const usaFormato = formatoUsado === 'formato' && cantidadFormatos && multiplicador !== 1;

            // Cantidades
            const cantPedida = parseFloat(item.cantidad || 0);
            const cantRecibida = parseFloat(item.cantidadRecibida || item.cantidad || 0);
            const varianzaCant = cantRecibida - cantPedida;

            // 🆕 Mostrar cantidad en formato si se usó (ej: "2 BOTES → 1 kg")
            let cantidadDisplay = `${cantPedida.toFixed(2)} ${unidadIng}`;
            if (usaFormato && ing?.formato_compra) {
                cantidadDisplay = `${cantidadFormatos} ${ing.formato_compra}<br><small style="color:#64748b;">(= ${cantPedida.toFixed(2)} ${unidadIng})</small>`;
            }

            // Precios - usar el precio unitario guardado (ya está calculado correctamente)
            const precioGuardado = parseFloat(
                item.precioUnitario || item.precio_unitario || item.precio || 0
            );
            // ⚠️ NO sobrescribir con el precio del ingrediente - ese es el precio del FORMATO, no unitario
            // El precioUnitario guardado ya es el precio correcto por unidad (ej: 0.33€/kg)
            const precioOriginal = precioGuardado;
            const precioReal = parseFloat(item.precioReal || precioOriginal);
            const varianzaPrecio = precioReal - precioOriginal;

            // Subtotales
            const subtotalOriginal = cantPedida * precioOriginal;
            const subtotalReal = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

            totalOriginal += subtotalOriginal;
            totalRecibido += subtotalReal;

            // Estado del ítem
            const itemEstado = item.estado || 'consolidado';
            let estadoBadge = '';
            if (esRecibido) {
                if (itemEstado === 'no-entregado') {
                    estadoBadge =
                        `<span style="background:#EF4444;color:white;padding:2px 8px;border-radius:10px;font-size:11px;">${t('pedidos:detail_not_delivered')}</span>`;
                } else if (Math.abs(varianzaCant) > 0.01 || Math.abs(varianzaPrecio) > 0.01) {
                    estadoBadge =
                        `<span style="background:#F59E0B;color:white;padding:2px 8px;border-radius:10px;font-size:11px;">${t('pedidos:detail_variance')}</span>`;
                } else {
                    estadoBadge =
                        `<span style="background:#10B981;color:white;padding:2px 8px;border-radius:10px;font-size:11px;">${t('pedidos:detail_ok')}</span>`;
                }
            }

            ingredientesHtml += `
              <tr style="border-bottom: 1px solid #F1F5F9;">
                <td style="padding: 12px;"><strong>${escapeHTML(nombreIng)}</strong></td>
                <td style="padding: 12px; text-align: center;">
                  ${cantidadDisplay}
                  ${esRecibido && Math.abs(varianzaCant) > 0.01 ? `<br><small style="color:${varianzaCant > 0 ? '#10B981' : '#EF4444'};">→ ${cantRecibida.toFixed(2)} (${varianzaCant > 0 ? '+' : ''}${varianzaCant.toFixed(2)})</small>` : ''}
                </td>
                <td style="padding: 12px; text-align: right;">
                  ${precioOriginal.toFixed(2)} ${window.currentUser?.moneda || '€'}
                  ${esRecibido && Math.abs(varianzaPrecio) > 0.01 ? `<br><small style="color:${varianzaPrecio > 0 ? '#EF4444' : '#10B981'};">→ ${precioReal.toFixed(2)} ${window.currentUser?.moneda || '€'} (${varianzaPrecio > 0 ? '+' : ''}${varianzaPrecio.toFixed(2)})</small>` : ''}
                </td>
                <td style="padding: 12px; text-align: right;">
                  ${esRecibido && subtotalReal !== subtotalOriginal ? `<small style="text-decoration:line-through;color:#999;">${subtotalOriginal.toFixed(2)} ${window.currentUser?.moneda || '€'}</small><br>` : ''}
                  <strong>${(esRecibido ? subtotalReal : subtotalOriginal).toFixed(2)} ${window.currentUser?.moneda || '€'}</strong>
                </td>
                ${esRecibido ? `<td style="padding: 12px; text-align: center;">${estadoBadge}</td>` : ''}
              </tr>
            `;
        });
    } else if (ajustes.length === 0) {
        ingredientesHtml = `<tr><td colspan="${esRecibido ? 5 : 4}" style="padding: 40px; text-align: center; color: #94A3B8;">${t('pedidos:detail_no_ingredients')}</td></tr>`;
    }

    // Añadir ajustes (envases/bonificaciones) al final
    ajustes.forEach(aj => {
        const importe = parseFloat(aj.importe) || 0;
        const desc = aj.descripcion ? ` (${escapeHTML(aj.descripcion)})` : '';
        const color = importe < 0 ? '#dc2626' : '#0891b2';
        ingredientesHtml += `
            <tr style="background: #fffbeb;">
                <td style="padding: 12px;"><strong>💸 Ajuste${desc}</strong></td>
                <td colspan="${esRecibido ? 3 : 2}" style="padding: 12px; color: #94a3b8; font-style: italic;">No afecta al stock</td>
                <td style="padding: 12px; text-align: right; color: ${color}; font-weight: 700;">${importe >= 0 ? '+' : ''}${importe.toFixed(2)}${window.currentUser?.moneda || '€'}</td>
            </tr>
        `;
        totalOriginal += importe;
        if (esRecibido) totalRecibido += importe;
    });

    // Calcular varianza total
    const varianzaTotal = totalRecibido - totalOriginal;
    const varianzaColor = varianzaTotal > 0 ? '#EF4444' : varianzaTotal < 0 ? '#10B981' : '#666';

    // Mostrar detalle del mercado si existe
    const detalleMercadoHtml = ped.detalle_mercado
        ? `<p style="margin: 5px 0 0; color: #10b981; font-size: 13px;">📍 ${escapeHTML(ped.detalle_mercado)}</p>`
        : '';

    const html = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #1E293B;">${t('pedidos:detail_order_title', { id: ped.id })}</h2>
          <p style="margin: 5px 0 0; color: #64748B;">${escapeHTML(provNombre)}</p>
          ${detalleMercadoHtml}
        </div>
        <div style="text-align: right;">
          <span style="background: ${estadoClass}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${estadoText}</span>
          <p style="margin: 10px 0 0; color: #64748B; font-size: 14px;">${fechaFormateada}</p>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden;">
        <thead>
          <tr style="background: #F8FAFC;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #64748B;">${t('pedidos:detail_col_ingredient')}</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">${t('pedidos:detail_col_quantity')}</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #64748B;">${t('pedidos:detail_col_price')}</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #64748B;">${t('pedidos:detail_col_subtotal')}</th>
            ${esRecibido ? `<th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">${t('pedidos:detail_col_status')}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${ingredientesHtml}
        </tbody>
      </table>
      
      ${esRecibido
            ? `
      <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
        <div style="padding: 15px; background: #F8FAFC; border-radius: 12px; text-align: center;">
          <div style="color: #64748B; font-size: 12px;">${t('pedidos:detail_total_original')}</div>
          <div style="font-size: 20px; font-weight: bold; color: #1E293B;">${totalOriginal.toFixed(2)} ${window.currentUser?.moneda || '€'}</div>
        </div>
        <div style="padding: 15px; background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; text-align: center;">
          <div style="color: #64748B; font-size: 12px;">${t('pedidos:detail_total_received')}</div>
          <div style="font-size: 20px; font-weight: bold; color: #059669;">${totalRecibido.toFixed(2)} ${window.currentUser?.moneda || '€'}</div>
        </div>
        <div style="padding: 15px; background: ${Math.abs(varianzaTotal) > 0.01 ? '#FEF3C7' : '#F8FAFC'}; border-radius: 12px; text-align: center;">
          <div style="color: #64748B; font-size: 12px;">${t('pedidos:detail_variance')}</div>
          <div style="font-size: 20px; font-weight: bold; color: ${varianzaColor};">${varianzaTotal > 0 ? '+' : ''}${varianzaTotal.toFixed(2)} ${window.currentUser?.moneda || '€'}</div>
        </div>
      </div>
      `
            : `
      <div style="margin-top: 20px; padding: 20px; background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; text-align: right;">
        <strong style="color: #666;">${t('pedidos:detail_total_order')}</strong><br>
        <span style="font-size: 28px; font-weight: bold; color: #059669;">${parseFloat(ped.total || totalOriginal || 0).toFixed(2)} ${window.currentUser?.moneda || '€'}</span>
      </div>
      `
        }
    `;

    const contenedor = document.getElementById('modal-ver-pedido-contenido');
    if (contenedor) contenedor.innerHTML = html;

    const modal = document.getElementById('modal-ver-pedido');
    if (modal) modal.classList.add('active');
}

/**
 * Cierra el modal de ver pedido
 */
export function cerrarModalVerPedido() {
    document.getElementById('modal-ver-pedido').classList.remove('active');
    window.pedidoViendoId = null;
}

// Exponer al window para compatibilidad con onclick en HTML
if (typeof window !== 'undefined') {
    window.verDetallesPedido = verDetallesPedido;
    window.cerrarModalVerPedido = cerrarModalVerPedido;
}
