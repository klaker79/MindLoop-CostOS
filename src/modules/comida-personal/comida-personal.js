/**
 * Comida Personal — pestaña de gasto en comida del equipo.
 *
 * Lista las líneas de pedido marcadas `personal: true`. Estas líneas NO tocan
 * food cost, stock ni P&L (las salta el backend, igual que los envases 'ajuste');
 * aquí solo se listan y se suma su coste, para que el dueño sepa cuánto gasta en
 * dar de comer al personal sin ensuciar los números del restaurante.
 *
 * Side-effect import: se autoasigna `window.renderizarComidaPersonal` para que
 * core.js cambiarTab('comida-personal') lo invoque.
 */
import { t } from '@/i18n/index.js';
import { cm, escapeHTML, getDateLocale } from '../../utils/helpers.js';

/**
 * Recorre window.pedidos y devuelve una fila por cada línea marcada `personal`.
 */
function lineasPersonales() {
    const pedidos = (window.pedidos || []).filter(p => !p.deleted_at);
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));
    const filas = [];

    for (const ped of pedidos) {
        let lineas = ped.ingredientes;
        if (typeof lineas === 'string') {
            try { lineas = JSON.parse(lineas); } catch { lineas = []; }
        }
        if (!Array.isArray(lineas)) continue;

        for (const l of lineas) {
            if (l.personal !== true) continue;
            const ingId = l.ingredienteId || l.ingrediente_id;
            const cantidad = parseFloat(l.cantidadRecibida ?? l.cantidad) || 0;
            const precio = parseFloat(l.precio_unitario ?? l.precio) || 0;
            filas.push({
                fecha: ped.fecha,
                proveedor: provMap.get(ped.proveedorId || ped.proveedor_id)?.nombre || '—',
                ingrediente: ingMap.get(ingId)?.nombre || `#${ingId}`,
                unidad: ingMap.get(ingId)?.unidad || '',
                cantidad,
                precio,
                subtotal: cantidad * precio
            });
        }
    }
    return filas;
}

function fmtFecha(f) {
    if (!f) return '—';
    const s = typeof f === 'string' && f.length === 10 ? `${f}T12:00:00` : f;
    return new Date(s).toLocaleDateString(getDateLocale());
}

export function renderizarComidaPersonal() {
    const container = document.getElementById('comida-personal-container');
    if (!container) return;

    const filas = lineasPersonales()
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    if (filas.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="icon">🍽️</div>
            <h3>${escapeHTML(t('comida_personal:empty_title'))}</h3>
            <p style="color:#64748b;max-width:540px;margin:8px auto 0;">${escapeHTML(t('comida_personal:empty_desc'))}</p>
          </div>`;
        return;
    }

    const ahora = new Date();
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    const totalMes = filas
        .filter(f => String(f.fecha).slice(0, 7) === mesActual)
        .reduce((s, f) => s + f.subtotal, 0);
    const totalAcumulado = filas.reduce((s, f) => s + f.subtotal, 0);

    const cards = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;">
        <div style="flex:1;min-width:190px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border-radius:12px;padding:18px 20px;">
          <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.5px;">${escapeHTML(t('comida_personal:card_month'))}</div>
          <div style="font-size:26px;font-weight:700;margin-top:4px;">${cm(totalMes)}</div>
        </div>
        <div style="flex:1;min-width:190px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">${escapeHTML(t('comida_personal:card_total'))}</div>
          <div style="font-size:26px;font-weight:700;color:#1e293b;margin-top:4px;">${cm(totalAcumulado)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${filas.length} ${escapeHTML(t('comida_personal:lines'))}</div>
        </div>
      </div>`;

    let tabla = '<table><thead><tr>';
    tabla += `<th>${escapeHTML(t('comida_personal:col_date'))}</th>`
        + `<th>${escapeHTML(t('comida_personal:col_supplier'))}</th>`
        + `<th>${escapeHTML(t('comida_personal:col_product'))}</th>`
        + `<th style="text-align:right;">${escapeHTML(t('comida_personal:col_qty'))}</th>`
        + `<th style="text-align:right;">${escapeHTML(t('comida_personal:col_price'))}</th>`
        + `<th style="text-align:right;">${escapeHTML(t('comida_personal:col_subtotal'))}</th>`;
    tabla += '</tr></thead><tbody>';
    for (const f of filas) {
        tabla += `<tr>
          <td>${fmtFecha(f.fecha)}</td>
          <td>${escapeHTML(f.proveedor)}</td>
          <td>${escapeHTML(f.ingrediente)}</td>
          <td style="text-align:right;">${escapeHTML(String(f.cantidad))} ${escapeHTML(f.unidad)}</td>
          <td style="text-align:right;">${cm(f.precio)}</td>
          <td style="text-align:right;font-weight:600;">${cm(f.subtotal)}</td>
        </tr>`;
    }
    tabla += '</tbody></table>';

    container.innerHTML = cards + tabla;
}

if (typeof window !== 'undefined') {
    window.renderizarComidaPersonal = renderizarComidaPersonal;
}
