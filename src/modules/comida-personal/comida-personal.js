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

// Periodo seleccionado: null = aún no elegido (se pone al mes actual en el 1er render).
// 'todos' = todo el histórico. Si no, 'YYYY-MM'.
let periodoSel = null;
// Texto de búsqueda (producto/proveedor/fecha) y orden de columna.
let busquedaSel = '';
let ordenCol = 'fecha';
let ordenDir = 'desc';
// Flag para devolver el foco al input de búsqueda tras el re-render.
let enfocarBusqueda = false;

function mesLabel(ym) {
    if (ym === 'todos') return t('comida_personal:filter_all');
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(getDateLocale(), { month: 'long', year: 'numeric' });
}

export function filtrarComidaPersonal(periodo) {
    periodoSel = periodo;
    renderizarComidaPersonal();
}

export function buscarComidaPersonal(valor) {
    busquedaSel = String(valor || '');
    enfocarBusqueda = true;
    renderizarComidaPersonal();
}

// Clic en cabecera: misma columna → invierte sentido; columna nueva → ese campo
// (fecha/subtotal/precio/cantidad arrancan desc, textos asc).
export function ordenarComidaPersonal(col) {
    if (ordenCol === col) {
        ordenDir = ordenDir === 'asc' ? 'desc' : 'asc';
    } else {
        ordenCol = col;
        ordenDir = ['proveedor', 'ingrediente'].includes(col) ? 'asc' : 'desc';
    }
    renderizarComidaPersonal();
}

function compararFilas(a, b) {
    const dir = ordenDir === 'asc' ? 1 : -1;
    const col = ordenCol;
    if (col === 'cantidad' || col === 'precio' || col === 'subtotal') {
        return (a[col] - b[col]) * dir;
    }
    if (col === 'fecha') {
        return String(a.fecha).localeCompare(String(b.fecha)) * dir;
    }
    return String(a[col] || '').localeCompare(String(b[col] || ''), undefined, { sensitivity: 'base' }) * dir;
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

    // Meses disponibles (YYYY-MM) de más reciente a más antiguo.
    const meses = [...new Set(filas.map(f => String(f.fecha).slice(0, 7)))].sort().reverse();
    const ahora = new Date();
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
    // Default: mes actual si tiene datos; si no, el mes más reciente con datos.
    if (periodoSel === null || (periodoSel !== 'todos' && !meses.includes(periodoSel))) {
        periodoSel = meses.includes(mesActual) ? mesActual : (meses[0] || 'todos');
    }

    const filtradas = periodoSel === 'todos'
        ? filas
        : filas.filter(f => String(f.fecha).slice(0, 7) === periodoSel);

    // Búsqueda: producto, proveedor o fecha (formateada y cruda) — case-insensitive.
    const q = busquedaSel.trim().toLowerCase();
    const visibles = (q
        ? filtradas.filter(f => `${f.ingrediente} ${f.proveedor} ${fmtFecha(f.fecha)} ${f.fecha}`.toLowerCase().includes(q))
        : filtradas.slice()
    ).sort(compararFilas);

    const totalPeriodo = filtradas.reduce((s, f) => s + f.subtotal, 0);
    const totalVisible = visibles.reduce((s, f) => s + f.subtotal, 0);
    const totalAcumulado = filas.reduce((s, f) => s + f.subtotal, 0);

    const opciones = ['todos', ...meses]
        .map(m => `<option value="${m}" ${m === periodoSel ? 'selected' : ''}>${escapeHTML(mesLabel(m))}</option>`)
        .join('');
    const selector = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <label style="font-size:13px;font-weight:600;color:#475569;">${escapeHTML(t('comida_personal:filter_label'))}</label>
        <select onchange="window.filtrarComidaPersonal(this.value)" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;cursor:pointer;text-transform:capitalize;">${opciones}</select>
        <div style="position:relative;flex:1;min-width:220px;">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:#94a3b8;">🔍</span>
          <input id="cp-search" type="search" value="${escapeHTML(busquedaSel)}" oninput="window.buscarComidaPersonal(this.value)"
            placeholder="${escapeHTML(t('comida_personal:search_placeholder'))}"
            style="width:100%;padding:8px 12px 8px 34px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;">
        </div>
      </div>`;

    const cards = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;">
        <div style="flex:1;min-width:190px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border-radius:12px;padding:18px 20px;">
          <div style="font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.5px;">${escapeHTML(mesLabel(periodoSel))}</div>
          <div style="font-size:26px;font-weight:700;margin-top:4px;">${cm(totalPeriodo)}</div>
          <div style="font-size:12px;opacity:.8;margin-top:2px;">${filtradas.length} ${escapeHTML(t('comida_personal:lines'))}</div>
        </div>
        <div style="flex:1;min-width:190px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">${escapeHTML(t('comida_personal:card_total'))}</div>
          <div style="font-size:26px;font-weight:700;color:#1e293b;margin-top:4px;">${cm(totalAcumulado)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:2px;">${filas.length} ${escapeHTML(t('comida_personal:lines'))}</div>
        </div>
      </div>`;

    // Aviso de búsqueda activa: cuántas líneas se muestran y su suma.
    const infoBusqueda = q
        ? `<div style="font-size:13px;color:#7c3aed;font-weight:600;margin-bottom:10px;">${escapeHTML(t('comida_personal:showing', { n: visibles.length, total: filtradas.length }))} · ${cm(totalVisible)}</div>`
        : '';

    // Cabecera ordenable: flecha en la columna activa.
    const flecha = (col) => ordenCol === col ? (ordenDir === 'asc' ? ' ▲' : ' ▼') : '';
    const th = (col, label, alignRight) => `<th onclick="window.ordenarComidaPersonal('${col}')" style="cursor:pointer;user-select:none;${alignRight ? 'text-align:right;' : ''}" title="Ordenar">${escapeHTML(label)}${flecha(col)}</th>`;

    let tabla = '<table><thead><tr>';
    tabla += th('fecha', t('comida_personal:col_date'))
        + th('proveedor', t('comida_personal:col_supplier'))
        + th('ingrediente', t('comida_personal:col_product'))
        + th('cantidad', t('comida_personal:col_qty'), true)
        + th('precio', t('comida_personal:col_price'), true)
        + th('subtotal', t('comida_personal:col_subtotal'), true);
    tabla += '</tr></thead><tbody>';
    if (visibles.length === 0) {
        tabla += `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px;">${escapeHTML(t('comida_personal:no_results'))}</td></tr>`;
    } else {
        for (const f of visibles) {
            tabla += `<tr>
              <td>${fmtFecha(f.fecha)}</td>
              <td>${escapeHTML(f.proveedor)}</td>
              <td>${escapeHTML(f.ingrediente)}</td>
              <td style="text-align:right;">${escapeHTML(String(f.cantidad))} ${escapeHTML(f.unidad)}</td>
              <td style="text-align:right;">${cm(f.precio)}</td>
              <td style="text-align:right;font-weight:600;">${cm(f.subtotal)}</td>
            </tr>`;
        }
    }
    tabla += '</tbody></table>';

    container.innerHTML = selector + cards + infoBusqueda + tabla;

    // Devolver el foco al buscador tras el re-render (si el cambio vino de teclear),
    // con el cursor al final — si no, el input perdería el foco en cada tecla.
    if (enfocarBusqueda) {
        enfocarBusqueda = false;
        const inp = document.getElementById('cp-search');
        if (inp) {
            inp.focus();
            const v = inp.value;
            inp.value = '';
            inp.value = v;
        }
    }
}

/**
 * Aplica el opt-in: muestra/oculta la entrada del menú "Comida Personal" según
 * `window.comidaPersonalActiva` (apagado por defecto). Si se apaga estando en la
 * pestaña, devuelve al usuario al dashboard para que no quede en una pestaña oculta.
 */
export function aplicarGatingComidaPersonal() {
    const activa = window.comidaPersonalActiva === true;
    document.querySelectorAll('[data-tab="comida-personal"]').forEach(el => {
        el.style.display = activa ? '' : 'none';
    });
    if (!activa) {
        const tab = document.getElementById('tab-comida-personal');
        if (tab && tab.classList.contains('active')) window.cambiarTab?.('dashboard');
    }
}

if (typeof window !== 'undefined') {
    window.renderizarComidaPersonal = renderizarComidaPersonal;
    window.filtrarComidaPersonal = filtrarComidaPersonal;
    window.buscarComidaPersonal = buscarComidaPersonal;
    window.ordenarComidaPersonal = ordenarComidaPersonal;
    window.aplicarGatingComidaPersonal = aplicarGatingComidaPersonal;
}
