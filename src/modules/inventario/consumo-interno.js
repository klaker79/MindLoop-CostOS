/**
 * Consumo interno — un PLATO/BEBIDA de la carta consumido sin venderse.
 *
 * Casos: comida del personal, prueba de cocina, invitación.
 *
 * ⚠️ NO confundir con la "comida personal" de los PEDIDOS: aquello es COMPRA
 * DESVIADA (producto apartado al comprarlo, que nunca entra → NO toca stock).
 * Esto es lo contrario: producto YA COMPRADO que sale del almacén → SÍ descuenta
 * stock. El backend (`POST /consumos-internos`) expande la receta a ingredientes
 * base (subrecetas incluidas) y descuenta.
 *
 * El COSTE lo calcula el BACKEND. Aquí solo se muestra una estimación previa
 * con la misma función que usa la pestaña Recetas.
 *
 * @module modules/inventario/consumo-interno
 */

import { escapeHTML, cm, getDateLocale } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';
import { calcularCosteRecetaCompleto } from '../recetas/recetas-crud.js';
import { logger } from '../../utils/logger.js';

const MODAL_ID = 'modal-consumo-interno';

function fmtLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function el(id) { return document.getElementById(id); }

/**
 * Abre el modal: rellena selectores (platos, empleados), fecha de hoy y carga
 * el histórico del mes en curso.
 */
export function mostrarModalConsumoInterno() {
    // Fecha por defecto: hoy. `max` impide elegir futuro (el backend también lo rechaza).
    const hoy = fmtLocalISO(new Date());
    const inputFecha = el('ci-fecha');
    if (inputFecha) {
        inputFecha.value = hoy;
        inputFecha.max = hoy;
    }

    // Platos: recetas activas ordenadas por nombre.
    const selectPlato = el('ci-plato');
    if (selectPlato) {
        const recetas = (window.recetas || [])
            .filter(r => r && r.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        let html = `<option value="">${escapeHTML(t('inventario:ci_select_dish'))}</option>`;
        recetas.forEach(r => {
            html += `<option value="${r.id}">${escapeHTML(r.nombre)}</option>`;
        });
        selectPlato.innerHTML = html;
    }

    // Empleado (opcional)
    const selectEmpleado = el('ci-empleado');
    if (selectEmpleado) {
        let html = `<option value="">${escapeHTML(t('inventario:ci_no_employee'))}</option>`;
        (window.empleados || []).forEach(emp => {
            html += `<option value="${emp.id}">${escapeHTML(emp.nombre)}</option>`;
        });
        selectEmpleado.innerHTML = html;
    }

    // Reset del formulario
    if (el('ci-raciones')) el('ci-raciones').value = 1;
    if (el('ci-tipo')) el('ci-tipo').value = 'personal';
    if (el('ci-nota')) el('ci-nota').value = '';

    // Recalcular el coste al cambiar plato o raciones. Se asigna con `.onchange`
    // (no addEventListener) para que reabrir el modal NO apile listeners.
    if (selectPlato) selectPlato.onchange = actualizarCostePreview;
    const inputRaciones = el('ci-raciones');
    if (inputRaciones) inputRaciones.oninput = actualizarCostePreview;

    actualizarCostePreview();

    cargarHistorialConsumos();

    el(MODAL_ID)?.classList.add('active');
}

/**
 * Estimación de coste en cliente (el importe real lo calcula el backend).
 */
export function actualizarCostePreview() {
    const box = el('ci-coste-preview');
    if (!box) return;

    const recetaId = parseInt(el('ci-plato')?.value, 10);
    const raciones = parseFloat(el('ci-raciones')?.value) || 0;
    if (!recetaId || raciones <= 0) {
        box.textContent = '—';
        return;
    }
    const receta = (window.recetas || []).find(r => r.id === recetaId);
    if (!receta) { box.textContent = '—'; return; }

    // calcularCosteRecetaCompleto devuelve el coste POR RACIÓN.
    const costePorRacion = calcularCosteRecetaCompleto(receta) || 0;
    box.textContent = cm(costePorRacion * raciones);
}

/**
 * Registra el consumo. El backend descuenta el stock y calcula el coste real.
 */
export async function registrarConsumoInterno() {
    const recetaId = parseInt(el('ci-plato')?.value, 10);
    const porciones = parseFloat(el('ci-raciones')?.value);
    const tipo = el('ci-tipo')?.value || 'personal';
    const fecha = el('ci-fecha')?.value || undefined;
    const empleadoId = el('ci-empleado')?.value || undefined;
    const nota = el('ci-nota')?.value?.trim() || undefined;

    if (!recetaId) {
        window.showToast?.(t('inventario:ci_error_no_dish'), 'warning');
        return;
    }
    if (!porciones || porciones <= 0) {
        window.showToast?.(t('inventario:ci_error_portions'), 'warning');
        return;
    }

    const btn = el('ci-btn-registrar');
    if (btn) btn.disabled = true;
    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        const creado = await window.api.createConsumoInterno({
            recetaId, porciones, tipo, fecha, empleadoId, nota
        });

        // Recargar ingredientes: el stock ha bajado.
        window.ingredientes = await window.api.getIngredientes();
        if (typeof window.renderizarIngredientes === 'function') window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        window._forceRecalcStock = true;
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();

        window.showToast?.(
            t('inventario:ci_saved', { coste: cm(parseFloat(creado?.coste) || 0) }),
            'success'
        );

        // Reset ligero y refresco del histórico (el modal sigue abierto para
        // encadenar varios registros seguidos).
        if (el('ci-nota')) el('ci-nota').value = '';
        if (el('ci-raciones')) el('ci-raciones').value = 1;
        actualizarCostePreview();
        await cargarHistorialConsumos();
    } catch (error) {
        logger.error('Consumo interno: registro fallido', error);
        window.showToast?.(t('inventario:ci_error_save'), 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (typeof window.hideLoading === 'function') window.hideLoading();
    }
}

/**
 * Carga y pinta los consumos del mes en curso + total gastado.
 * FASE 1: este total es la única visibilidad del gasto (aún no está en el P&L).
 */
export async function cargarHistorialConsumos() {
    const cont = el('ci-historial');
    const totalBox = el('ci-total-mes');
    if (!cont) return;

    try {
        const hoy = new Date();
        const desde = fmtLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        const hasta = fmtLocalISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1));
        const data = await window.api.getConsumosInternos(desde, hasta);
        const consumos = data?.consumos || [];

        if (totalBox) totalBox.textContent = cm(data?.total_coste || 0);

        if (consumos.length === 0) {
            cont.innerHTML = `<p style="color:#64748b;text-align:center;padding:14px;margin:0;">${escapeHTML(t('inventario:ci_empty'))}</p>`;
            return;
        }

        const dateLocale = getDateLocale();
        cont.innerHTML = consumos.map(c => {
            const fecha = new Date(c.fecha).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit' });
            const tipoLabel = t(`inventario:ci_type_${c.tipo}`) || c.tipo;
            return `
                <div style="display:grid;grid-template-columns:52px minmax(0,1fr) 90px 78px 34px;gap:8px;align-items:center;padding:7px 4px;border-bottom:1px solid #e2e8f0;font-size:13px;">
                    <span style="color:#64748b;">${escapeHTML(fecha)}</span>
                    <span style="font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(c.receta_nombre || '—')}</span>
                    <span style="color:#64748b;">${escapeHTML(tipoLabel)}</span>
                    <span style="text-align:right;font-weight:600;">${cm(parseFloat(c.coste) || 0)}</span>
                    <button type="button" data-action="borrar-consumo-interno" data-id="${c.id}"
                        title="${escapeHTML(t('inventario:ci_delete_title'))}"
                        style="background:#fee2e2;border:none;border-radius:5px;padding:4px 6px;cursor:pointer;">🗑️</button>
                </div>
            `;
        }).join('');
    } catch (error) {
        logger.error('Consumo interno: histórico fallido', error);
        cont.innerHTML = `<p style="color:#dc2626;text-align:center;padding:14px;margin:0;">${escapeHTML(t('inventario:ci_error_load'))}</p>`;
    }
}

/**
 * Borra un consumo: el backend devuelve al stock exactamente lo descontado.
 */
export async function borrarConsumoInterno(id) {
    const idNum = parseInt(id, 10);
    if (!idNum) return;
    if (!window.confirm(t('inventario:ci_delete_confirm'))) return;

    if (typeof window.showLoading === 'function') window.showLoading();
    try {
        await window.api.deleteConsumoInterno(idNum);

        window.ingredientes = await window.api.getIngredientes();
        if (typeof window.renderizarIngredientes === 'function') window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        window._forceRecalcStock = true;
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();

        window.showToast?.(t('inventario:ci_deleted'), 'success');
        await cargarHistorialConsumos();
    } catch (error) {
        logger.error('Consumo interno: borrado fallido', error);
        window.showToast?.(t('inventario:ci_error_delete'), 'error');
    } finally {
        if (typeof window.hideLoading === 'function') window.hideLoading();
    }
}
