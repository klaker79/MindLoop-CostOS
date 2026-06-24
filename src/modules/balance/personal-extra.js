/**
 * Personal extra (por horas)
 * --------------------------
 * Sección del balance (cuenta de resultados), justo debajo de los gastos
 * fijos, para apuntar pagos a extras puntuales: fecha, nombre opcional,
 * horas y €/hora → total. Cada fila se guarda vía la API /personal-extra.
 *
 * Backend: GET/POST/PUT/DELETE /api/personal-extra (campos por fila:
 *   id, fecha, nombre, horas, precio_hora, total, observaciones).
 * GET acepta ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD.
 *
 * Sigue el estilo visual de la sección de gastos fijos (gradiente morado,
 * filas sobre rgba blanco). Render con escapeHTML() en datos de usuario.
 */

import { api as client } from '../../api/client.js';
import { cm, escapeHTML } from '../../utils/helpers.js';

/** Fecha de hoy en formato YYYY-MM-DD (zona local). */
function hoyISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Suma de los `total` de las filas (subtotal del periodo). */
function calcularSubtotal(filas) {
    return (filas || []).reduce((s, f) => s + (parseFloat(f.total) || 0), 0);
}

function rowHtml(fila) {
    const id = fila.id;
    const fecha = fila.fecha || '';
    const nombre = fila.nombre || '';
    const horas = parseFloat(fila.horas) || 0;
    const precioHora = parseFloat(fila.precio_hora) || 0;
    const total = parseFloat(fila.total) || (horas * precioHora);
    return `
        <div class="pe-row" data-pe-id="${id}"
             style="display: grid; grid-template-columns: 100px 1fr 70px 80px 90px 32px; gap: 10px; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;">
            <span style="color: white; font-size: 13px;">${escapeHTML(fecha)}</span>
            <span style="color: white; font-size: 14px; font-weight: 500; word-break: break-word;">${escapeHTML(nombre) || '—'}</span>
            <span style="color: rgba(255,255,255,0.9); font-size: 13px; text-align: right;">${cm(horas, 2)}</span>
            <span style="color: rgba(255,255,255,0.9); font-size: 13px; text-align: right;">${cm(precioHora, 2)}</span>
            <span style="color: white; font-size: 14px; font-weight: 700; text-align: right;">${cm(total, 2)}</span>
            <button type="button" class="pe-delete-btn" data-pe-id="${id}" title="Eliminar"
                style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 4px; font-size: 14px; line-height: 1; border-radius: 6px;">🗑</button>
        </div>
    `;
}

function formHtml() {
    return `
        <div class="pe-form" style="display: grid; grid-template-columns: 110px 1fr 70px 80px 90px auto; gap: 10px; align-items: end; padding: 12px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; margin-bottom: 12px;">
            <div>
                <label style="display:block; color: rgba(255,255,255,0.85); font-size: 11px; margin-bottom: 4px;">Fecha</label>
                <input type="date" id="pe-fecha" value="${escapeHTML(hoyISO())}"
                    style="width: 100%; padding: 7px 8px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; color: white; font-size: 13px; outline: none;">
            </div>
            <div>
                <label style="display:block; color: rgba(255,255,255,0.85); font-size: 11px; margin-bottom: 4px;">Nombre (opcional)</label>
                <input type="text" id="pe-nombre" placeholder="Extra"
                    style="width: 100%; padding: 7px 10px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; color: white; font-size: 14px; outline: none;">
            </div>
            <div>
                <label style="display:block; color: rgba(255,255,255,0.85); font-size: 11px; margin-bottom: 4px;">Horas</label>
                <input type="number" inputmode="decimal" step="0.25" min="0" id="pe-horas" placeholder="0"
                    style="width: 100%; padding: 7px 8px; text-align: right; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; color: white; font-weight: 600; font-size: 14px; outline: none;">
            </div>
            <div>
                <label style="display:block; color: rgba(255,255,255,0.85); font-size: 11px; margin-bottom: 4px;">€/hora</label>
                <input type="number" inputmode="decimal" step="0.01" min="0" id="pe-precio" placeholder="0"
                    style="width: 100%; padding: 7px 8px; text-align: right; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; color: white; font-weight: 600; font-size: 14px; outline: none;">
            </div>
            <div>
                <label style="display:block; color: rgba(255,255,255,0.85); font-size: 11px; margin-bottom: 4px;">Total</label>
                <div id="pe-total-live" style="padding: 7px 8px; text-align: right; color: white; font-weight: 700; font-size: 14px;">${cm(0, 2)}</div>
            </div>
            <button type="button" id="pe-add-btn"
                style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.35); padding: 9px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; white-space: nowrap;">+ Añadir</button>
        </div>
    `;
}

function tableHtml(filas) {
    if (!Array.isArray(filas) || filas.length === 0) {
        return `
            <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.8); font-size: 13px;">
                No hay pagos a extras en este periodo.
            </div>
        `;
    }
    const header = `
        <div style="display: grid; grid-template-columns: 100px 1fr 70px 80px 90px 32px; gap: 10px; padding: 4px 14px; color: rgba(255,255,255,0.65); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;">
            <span>Fecha</span><span>Nombre</span><span style="text-align:right;">Horas</span><span style="text-align:right;">€/h</span><span style="text-align:right;">Total</span><span></span>
        </div>
    `;
    return header + `<div style="display: flex; flex-direction: column; gap: 6px;">${filas.map(rowHtml).join('')}</div>`;
}

function subtotalHtml(filas) {
    const subtotal = calcularSubtotal(filas);
    return `
        <div style="margin-top: 14px; padding: 12px 14px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: white; font-size: 13px; font-weight: 600;">Subtotal periodo</span>
            <span id="pe-subtotal" style="color: white; font-size: 16px; font-weight: 700;">${cm(subtotal, 2)}</span>
        </div>
    `;
}

/**
 * Renderiza la sección "Personal extra (por horas)" dentro de `contenedor`.
 * @param {HTMLElement} contenedor
 * @param {{desde?: string, hasta?: string}} rango — mismo periodo que el balance.
 */
export async function renderPersonalExtra(contenedor, { desde, hasta } = {}) {
    if (!contenedor) return;

    let filas = [];
    try {
        filas = await client.getPersonalExtra(desde, hasta);
    } catch (_e) {
        filas = [];
    }
    if (!Array.isArray(filas)) filas = [];

    contenedor.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 16px; margin-bottom: 25px; box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px;">
                <h3 style="margin: 0; color: white; font-size: 20px; font-weight: 700;">🧑‍🍳 Personal extra (por horas)</h3>
            </div>
            ${formHtml()}
            ${tableHtml(filas)}
            ${subtotalHtml(filas)}
        </div>
    `;

    wireEvents(contenedor, { desde, hasta });
}

function actualizarTotalLive(contenedor) {
    const horasEl = contenedor.querySelector('#pe-horas');
    const precioEl = contenedor.querySelector('#pe-precio');
    const totalEl = contenedor.querySelector('#pe-total-live');
    if (!totalEl) return;
    const horas = parseFloat(horasEl?.value) || 0;
    const precio = parseFloat(precioEl?.value) || 0;
    totalEl.textContent = cm(horas * precio, 2);
}

function wireEvents(contenedor, rango) {
    const horasEl = contenedor.querySelector('#pe-horas');
    const precioEl = contenedor.querySelector('#pe-precio');
    if (horasEl) horasEl.addEventListener('input', () => actualizarTotalLive(contenedor));
    if (precioEl) precioEl.addEventListener('input', () => actualizarTotalLive(contenedor));

    const addBtn = contenedor.querySelector('#pe-add-btn');
    if (addBtn) addBtn.addEventListener('click', () => anadirFila(contenedor, rango));

    contenedor.querySelectorAll('.pe-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.peId, 10);
            if (id) borrarFila(id, contenedor, rango);
        });
    });
}

async function anadirFila(contenedor, rango) {
    const fecha = (contenedor.querySelector('#pe-fecha')?.value || '').trim();
    const nombre = (contenedor.querySelector('#pe-nombre')?.value || '').trim();
    const horas = parseFloat(contenedor.querySelector('#pe-horas')?.value) || 0;
    const precioHora = parseFloat(contenedor.querySelector('#pe-precio')?.value) || 0;

    if (!fecha) {
        window.showToast?.('La fecha es obligatoria', 'warning');
        return;
    }
    if (horas <= 0 || precioHora <= 0) {
        window.showToast?.('Indica horas y €/hora', 'warning');
        return;
    }

    try {
        await client.crearPersonalExtra({ fecha, nombre, horas, precio_hora: precioHora });
        window.showToast?.('Pago a extra añadido', 'success');
        await renderPersonalExtra(contenedor, rango);
    } catch (_e) {
        window.showToast?.('Error guardando pago a extra', 'error');
    }
}

async function borrarFila(id, contenedor, rango) {
    if (!window.confirm('¿Eliminar este pago a extra?')) return;
    try {
        await client.borrarPersonalExtra(id);
        window.showToast?.('Pago a extra eliminado', 'success');
        await renderPersonalExtra(contenedor, rango);
    } catch (_e) {
        window.showToast?.('Error eliminando pago a extra', 'error');
    }
}

// Exponer para handlers/legacy si hiciera falta.
if (typeof window !== 'undefined') {
    window.renderPersonalExtra = renderPersonalExtra;
}
