/**
 * Pedidos Export Module
 * Exportación de pedidos: PDF y WhatsApp
 *
 * Funciones:
 * - descargarPedidoPDF: Genera PDF del pedido actual
 * - enviarPedidoWhatsApp: Envía pedido por WhatsApp al proveedor
 */

import { t } from '@/i18n/index.js';

/**
 * Descarga PDF del pedido actual
 */
export function descargarPedidoPDF() {
  if (window.pedidoViendoId === null) return;

  const pedido = (window.pedidos || []).find(p => p.id === window.pedidoViendoId);
  if (!pedido) return;

  const provId = pedido.proveedorId || pedido.proveedor_id;
  const prov = (window.proveedores || []).find(p => p.id === provId);
  const provNombre = prov ? prov.nombre : t('pedidos:detail_no_supplier');
  const provDir = prov?.direccion || '';
  const provTel = prov?.telefono || '';
  const provEmail = prov?.email || '';

  const esRecibido = pedido.estado === 'recibido';
  const items = pedido.itemsRecepcion || pedido.ingredientes || [];

  let totalOriginal = 0;
  let totalRecibido = 0;
  let ingredientesHtml = '';

  items.forEach(item => {
    const ingId = item.ingredienteId || item.ingrediente_id;
    const ing = (window.ingredientes || []).find(i => i.id === ingId);
    const nombre = ing ? ing.nombre : t('pedidos:detail_col_ingredient');
    const unidad = ing ? ing.unidad : '';

    const cantPedida = parseFloat(item.cantidad || 0);
    const cantRecibida = parseFloat(item.cantidadRecibida || cantPedida);
    const precioOrig = parseFloat(
      item.precioUnitario || item.precio_unitario || item.precio || 0
    );
    const precioReal = parseFloat(item.precioReal || precioOrig);

    const subtotalOrig = cantPedida * precioOrig;
    const subtotalReal = item.estado === 'no-entregado' ? 0 : cantRecibida * precioReal;

    totalOriginal += subtotalOrig;
    totalRecibido += subtotalReal;

    // Determinar estado
    let estadoTxt = '';
    if (esRecibido) {
      if (item.estado === 'no-entregado') {
        estadoTxt = `❌ ${t('pedidos:detail_not_delivered')}`;
      } else if (
        Math.abs(cantRecibida - cantPedida) > 0.01 ||
        Math.abs(precioReal - precioOrig) > 0.01
      ) {
        estadoTxt = `⚠️ ${t('pedidos:detail_variance')}`;
      } else {
        estadoTxt = `✅ ${t('pedidos:detail_ok')}`;
      }
    }

    ingredientesHtml += `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${nombre}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${cantPedida.toFixed(2)} ${unidad}</td>
            ${esRecibido ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${cantRecibida !== cantPedida ? '#dc2626' : '#059669'};">${cantRecibida.toFixed(2)} ${unidad}</td>` : ''}
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${precioOrig.toFixed(2)} €</td>
            ${esRecibido ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${precioReal !== precioOrig ? '#dc2626' : '#059669'};">${precioReal.toFixed(2)} €</td>` : ''}
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${(esRecibido ? subtotalReal : subtotalOrig).toFixed(2)} €</td>
            ${esRecibido ? `<td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${estadoTxt}</td>` : ''}
          </tr>
        `;
  });

  const varianza = totalRecibido - totalOriginal;
  const varianzaColor = varianza > 0 ? '#dc2626' : varianza < 0 ? '#059669' : '#374151';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido #${pedido.id} - ${provNombre}</title>
      <style>
        @page { margin: 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #7c3aed; }
        .doc-info { text-align: right; }
        .doc-number { font-size: 24px; font-weight: bold; color: #1f2937; }
        .badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .badge-recibido { background: #dcfce7; color: #166534; }
        .badge-pendiente { background: #fef3c7; color: #92400e; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
        .info-box h3 { margin: 0 0 15px 0; color: #7c3aed; font-size: 14px; text-transform: uppercase; }
        .info-box p { margin: 5px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #7c3aed; color: white; padding: 12px 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
        .totals { display: grid; grid-template-columns: repeat(${esRecibido ? 3 : 1}, 1fr); gap: 20px; margin-top: 30px; }
        .total-box { padding: 20px; border-radius: 8px; text-align: center; }
        .total-box.original { background: #f1f5f9; }
        .total-box.recibido { background: #dcfce7; border: 2px solid #22c55e; }
        .total-box.varianza { background: #fef3c7; }
        .total-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
        .total-value { font-size: 24px; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">${window.getRestaurantName ? window.getRestaurantName() : 'MindLoop CostOS'}</div>
          <p style="margin: 5px 0; color: #6b7280;">${t('pedidos:pdf_cost_management')}</p>
        </div>
        <div class="doc-info">
          <div class="doc-number">${t('pedidos:pdf_order_label')} #${pedido.id}</div>
          <p style="margin: 10px 0;"><span class="badge ${esRecibido ? 'badge-recibido' : 'badge-pendiente'}">${esRecibido ? t('pedidos:detail_status_received').toUpperCase() : t('pedidos:detail_status_pending').toUpperCase()}</span></p>
          <p style="color: #6b7280;">${new Date(typeof pedido.fecha === 'string' && pedido.fecha.length === 10 ? pedido.fecha + 'T12:00:00' : pedido.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-box">
          <h3>📦 ${t('pedidos:col_supplier')}</h3>
          <p><strong>${provNombre}</strong></p>
          ${provDir ? `<p>${provDir}</p>` : ''}
          ${provTel ? `<p>📞 ${provTel}</p>` : ''}
          ${provEmail ? `<p>✉️ ${provEmail}</p>` : ''}
        </div>
        <div class="info-box">
          <h3>📋 ${t('pedidos:pdf_order_details')}</h3>
          <p><strong>${t('pedidos:pdf_order_date')}:</strong> ${new Date(typeof pedido.fecha === 'string' && pedido.fecha.length === 10 ? pedido.fecha + 'T12:00:00' : pedido.fecha).toLocaleDateString('es-ES')}</p>
          ${pedido.fecha_recepcion ? `<p><strong>${t('pedidos:pdf_reception_date')}:</strong> ${new Date(pedido.fecha_recepcion).toLocaleDateString('es-ES')}</p>` : ''}
          <p><strong>${t('pedidos:pdf_total_items')}:</strong> ${items.length}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>${t('pedidos:detail_col_ingredient')}</th>
            <th style="text-align: center;">${t('pedidos:pdf_qty_ordered')}</th>
            ${esRecibido ? `<th style="text-align: center;">${t('pedidos:pdf_qty_received')}</th>` : ''}
            <th style="text-align: right;">${t('pedidos:pdf_price_orig')}</th>
            ${esRecibido ? `<th style="text-align: right;">${t('pedidos:pdf_price_real')}</th>` : ''}
            <th style="text-align: right;">${t('pedidos:detail_col_subtotal')}</th>
            ${esRecibido ? `<th style="text-align: center;">${t('pedidos:detail_col_status')}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${ingredientesHtml}
        </tbody>
      </table>
      
      <div class="totals">
        ${esRecibido
      ? `
        <div class="total-box original">
          <div class="total-label">${t('pedidos:detail_total_original')}</div>
          <div class="total-value" style="color: #374151;">${totalOriginal.toFixed(2)} €</div>
        </div>
        <div class="total-box recibido">
          <div class="total-label">${t('pedidos:detail_total_received')}</div>
          <div class="total-value" style="color: #059669;">${totalRecibido.toFixed(2)} €</div>
        </div>
        <div class="total-box varianza">
          <div class="total-label">${t('pedidos:detail_variance')}</div>
          <div class="total-value" style="color: ${varianzaColor};">${varianza > 0 ? '+' : ''}${varianza.toFixed(2)} €</div>
        </div>
        `
      : `
        <div class="total-box recibido">
          <div class="total-label">${t('pedidos:detail_total_order')}</div>
          <div class="total-value" style="color: #059669;">${parseFloat(pedido.total || totalOriginal).toFixed(2)} €</div>
        </div>
        `
    }
      </div>
      
      <div class="footer">
        ${t('pedidos:pdf_generated_on')} ${new Date().toLocaleString('es-ES')} • ${window.getRestaurantName ? window.getRestaurantName() : 'MindLoop CostOS'}
      </div>
    </body>
    </html>
    `;

  // 🔒 FIX: Verificar que window.open no fue bloqueado por popup blocker
  const ventana = window.open('', '', 'width=900,height=700');

  if (!ventana) {
    window.showToast(t('pedidos:export_popup_blocked'), 'warning');
    return;
  }

  try {
    ventana.document.write(html);
    ventana.document.close();
    ventana.print();
  } catch (error) {
    console.error('Error generando PDF:', error);
    window.showToast(t('pedidos:export_pdf_error'), 'error');
    ventana.close();
  }
}

/**
 * Envía el pedido actual por WhatsApp al proveedor
 * 📱 Usa la API de WhatsApp Web para abrir chat con mensaje pre-escrito
 */
export function enviarPedidoWhatsApp() {
  if (window.pedidoViendoId === null) {
    window.showToast(t('pedidos:export_no_order_selected'), 'warning');
    return;
  }

  const pedido = (window.pedidos || []).find(p => p.id === window.pedidoViendoId);
  if (!pedido) return;

  const provId = pedido.proveedorId || pedido.proveedor_id;
  const prov = (window.proveedores || []).find(p => p.id === provId);

  if (!prov || !prov.telefono) {
    // 🔧 Si no tiene teléfono, abrir edición del proveedor
    window.showToast(t('pedidos:export_configure_phone'), 'warning');

    // Cerrar modal del pedido
    const modalPedido = document.getElementById('modal-ver-pedido');
    if (modalPedido) modalPedido.classList.remove('active');

    // Abrir edición del proveedor
    if (prov && typeof window.editarProveedor === 'function') {
      setTimeout(() => {
        window.showTab('proveedores');
        setTimeout(() => window.editarProveedor(prov.id), 300);
      }, 200);
    } else {
      // Ir a la pestaña de proveedores
      window.showTab('proveedores');
    }
    return;
  }

  // Limpiar número de teléfono (quitar espacios, guiones, etc.)
  let telefono = prov.telefono.replace(/[\s\-()]/g, '');
  // Si empieza con 0, añadir código de España
  if (telefono.startsWith('0')) {
    telefono = '34' + telefono.substring(1);
  }
  // Si no tiene código de país, añadir 34 (España)
  if (!telefono.startsWith('+') && !telefono.startsWith('34')) {
    telefono = '34' + telefono;
  }
  // Quitar el + si lo tiene
  telefono = telefono.replace('+', '');

  // Obtener nombre del restaurante
  const restaurante = window.getRestaurantName ? window.getRestaurantName() : 'La Nave 5';

  // Construir mensaje ELEGANTE Y PROFESIONAL
  const items = pedido.itemsRecepcion || pedido.ingredientes || [];
  const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let mensaje = `━━━━━━━━━━━━━━━━━━━━━━\n`;
  mensaje += `🍽️ *${restaurante.toUpperCase()}*\n`;
  mensaje += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  mensaje += `📋 *${t('pedidos:wa_order_number', { id: pedido.id })}*\n`;
  mensaje += `📅 ${fecha}\n\n`;
  mensaje += `${t('pedidos:wa_greeting')}\n\n`;
  mensaje += `${t('pedidos:wa_order_intro')}\n\n`;
  mensaje += `┌─────────────────────────\n`;

  items.forEach(item => {
    const ingId = item.ingredienteId || item.ingrediente_id;
    const ing = (window.ingredientes || []).find(i => i.id === ingId);
    const nombre = ing ? ing.nombre : t('pedidos:detail_col_ingredient');
    const unidad = ing ? ing.unidad : '';
    const cantidad = parseFloat(item.cantidad || 0);

    // Si tiene formato de compra, mostrar en formato
    if (item.formatoUsado === 'formato' && ing?.formato_compra) {
      const cantFormatos = item.cantidadFormatos || Math.ceil(cantidad / (ing.cantidad_por_formato || 1));
      mensaje += `│ ▪️ ${nombre}\n│    ${cantFormatos} ${ing.formato_compra}\n`;
    } else {
      mensaje += `│ ▪️ ${nombre}\n│    ${cantidad} ${unidad}\n`;
    }
  });

  mensaje += `└─────────────────────────\n\n`;
  mensaje += `💰 *${t('pedidos:wa_estimated_total', { total: parseFloat(pedido.total || 0).toFixed(2) })}*\n\n`;
  mensaje += `${t('pedidos:wa_confirm_availability')}\n\n`;
  mensaje += `${t('pedidos:wa_thanks')}\n`;
  mensaje += `${t('pedidos:wa_regards')}\n`;
  mensaje += `*${restaurante}* 🍽️`;

  // Codificar mensaje con los detalles del pedido
  const mensajeCodificado = encodeURIComponent(mensaje);

  // Abrir WhatsApp Web DIRECTAMENTE con el mensaje completo
  const url = `https://web.whatsapp.com/send?phone=${telefono}&text=${mensajeCodificado}`;
  window.open(url, '_blank');

  // Toast indicando que puede descargar PDF si quiere
  window.showToast(t('pedidos:export_whatsapp_opened'), 'success');
}

// Exponer al window para compatibilidad con onclick en HTML
if (typeof window !== 'undefined') {
  window.descargarPedidoPDF = descargarPedidoPDF;
  window.enviarPedidoWhatsApp = enviarPedidoWhatsApp;
}
