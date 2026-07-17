/**
 * Portada móvil (Inicio) — CosteOS · Fase 2 del rediseño.
 *
 * Rellena la home con los dos bloques dinámicos:
 *  - "Qué me falta": cuenta ingredientes bajo mínimo → botón que lanza el
 *    Smart Order (window.abrirSmartOrder, ya existe).
 *  - "Volver a pedir": último pedido por proveedor → botón que repite ese
 *    pedido (window.repetirPedido, ya existe).
 *
 * Solo cablea funciones existentes: NO toca datos ni crea nada por su cuenta.
 * El "volver a pedir" pasa por repetirPedido, que pide confirmación al usuario.
 */

import { escapeHTML, cm, getDateLocale } from '../../utils/helpers.js';

// Mismo criterio que el KPI de stock bajo (dashboard/kpis/stock-bajo.js):
// stock 0, o (mínimo>0 y stock<=mínimo). null/undefined = no registrado, no cuenta.
function contarBajoMinimo() {
    const ings = window.ingredientes || [];
    return ings.filter((ing) => {
        if (ing.stock_actual === null || ing.stock_actual === undefined) return false;
        const stock = parseFloat(ing.stock_actual) || 0;
        const minimo = parseFloat(ing.stock_minimo) || parseFloat(ing.stockMinimo) || 0;
        return stock === 0 || (minimo > 0 && stock <= minimo);
    }).length;
}

// Último pedido por proveedor (para "volver a pedir"), más recientes primero.
function ultimosPedidosPorProveedor(max = 3) {
    const pedidos = window.pedidos || [];
    const provs = window.proveedores || [];
    const nombreProv = (pid) => provs.find((p) => p.id === pid)?.nombre || 'Proveedor';
    const porProv = new Map();
    for (const p of pedidos) {
        const pid = p.proveedor_id ?? p.proveedorId;
        if (pid === undefined || pid === null) continue;
        const prev = porProv.get(pid);
        const masReciente = !prev
            || new Date(p.fecha) > new Date(prev.fecha)
            || (p.fecha === prev.fecha && p.id > prev.id);
        if (masReciente) porProv.set(pid, p);
    }
    return [...porProv.values()]
        .sort((a, b) => (new Date(b.fecha) - new Date(a.fecha)) || (b.id - a.id))
        .slice(0, max)
        .map((p) => ({
            id: p.id,
            provNombre: nombreProv(p.proveedor_id ?? p.proveedorId),
            total: p.total,
            fecha: p.fecha,
        }));
}

function fmtFechaCorta(f) {
    try {
        const d = new Date((typeof f === 'string' && f.length === 10) ? f + 'T12:00:00' : f);
        return d.toLocaleDateString(getDateLocale());
    } catch { return ''; }
}

export function renderMobileHome() {
    // 1) Qué me falta (Smart Order)
    const falta = document.getElementById('ml-home-falta');
    if (falta) {
        const n = contarBajoMinimo();
        falta.innerHTML = n > 0
            ? `<div class="ml-home-falta-card">
                 <div class="ml-home-falta-h">⚠️ Te ${n === 1 ? 'falta' : 'faltan'} ${n} ${n === 1 ? 'ingrediente' : 'ingredientes'}</div>
                 <p class="ml-home-falta-p">Bajo mínimo. Te genero el pedido sugerido.</p>
                 <button type="button" class="ml-home-falta-btn" onclick="window.abrirSmartOrder && window.abrirSmartOrder()">Generar pedido sugerido</button>
               </div>`
            : '';
    }
    // 2) Volver a pedir
    const rep = document.getElementById('ml-home-repetir');
    if (rep) {
        const ultimos = ultimosPedidosPorProveedor(3);
        rep.innerHTML = ultimos.length
            ? `<div class="ml-home-subh">Volver a pedir</div>
               ${ultimos.map((u) => `
                 <div class="ml-home-rep-row">
                   <div class="ml-home-rep-av">🚚</div>
                   <div class="ml-home-rep-tt"><b>${escapeHTML(u.provNombre)}</b><small>Último: ${escapeHTML(fmtFechaCorta(u.fecha))} · ${cm(u.total || 0)}</small></div>
                   <button type="button" class="ml-home-rep-btn" onclick="window.mlVolverAPedir(${u.id})">Repetir</button>
                 </div>`).join('')}`
            : '';
    }
}

export async function mlVolverAPedir(id) {
    if (typeof window.repetirPedido !== 'function') return;
    await window.repetirPedido(id);   // crea el pedido (con su confirm) y recarga datos
    if (typeof window.cambiarTab === 'function') window.cambiarTab('pedidos');
}

export function initMobileHome() {
    window.renderMobileHome = renderMobileHome;
    window.mlVolverAPedir = mlVolverAPedir;
    renderMobileHome();
}
