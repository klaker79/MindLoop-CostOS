/**
 * Elaboración — pesaje real de una producción de cocina (crudo → cocido/limpio).
 *
 * El caso PULPO (auditoría 2026-08-02): la ficha decía rendimiento 60% pero el
 * consumo real implicaba ~44%, y esa diferencia era food cost invisible
 * (36,5% → 49,7% en el plato estrella). La única forma de saberlo es PESAR.
 *
 * ⚠️ NO toca stock (es una medición, no un movimiento) y NO cambia el
 * rendimiento de la ficha solo: se ENSEÑA la comparación y decide el chef —
 * misma filosofía que la diferencia de inventario.
 *
 * Cableado SIN globales window.* nuevas (censo congelado, Fase E): los
 * data-action importan este módulo directamente desde event-bindings.js.
 *
 * @module modules/inventario/elaboracion-rapida
 */

import { escapeHTML } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';
import { logger } from '../../utils/logger.js';

const MODAL_ID = 'modal-elaboracion';

const el = (id) => document.getElementById(id);

// Mismo criterio que el backend (rendimientoReal.js): >500% = dedazo de unidades.
const RENDIMIENTO_MAX = 500;

const fmtLocalISO = (d) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().split('T')[0];
};

export function mostrarModalElaboracion() {
    const hoy = fmtLocalISO(new Date());
    const inputFecha = el('elab-fecha');
    if (inputFecha) {
        inputFecha.value = hoy;
        inputFecha.max = hoy;
    }

    // Ingredientes activos ordenados por nombre.
    const select = el('elab-ingrediente');
    if (select) {
        const ingredientes = (window.ingredientes || [])
            .filter(i => i && i.nombre)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        let html = `<option value="">${escapeHTML(t('inventario:elab_select_ingredient'))}</option>`;
        ingredientes.forEach(i => {
            const rend = i.rendimiento !== null && i.rendimiento !== undefined ? parseFloat(i.rendimiento) : null;
            html += `<option value="${i.id}" data-unidad="${escapeHTML(i.unidad || 'ud')}" data-rendimiento="${rend ?? ''}">${escapeHTML(i.nombre)}</option>`;
        });
        select.innerHTML = html;
    }

    // Reset del formulario
    if (el('elab-bruta')) el('elab-bruta').value = '';
    if (el('elab-neta')) el('elab-neta').value = '';
    if (el('elab-nota')) el('elab-nota').value = '';

    // `.onchange`/`.oninput` (no addEventListener) para que reabrir el modal
    // NO apile listeners — mismo patrón que consumo-interno.
    if (select) select.onchange = actualizarPreviewElaboracion;
    if (el('elab-bruta')) el('elab-bruta').oninput = actualizarPreviewElaboracion;
    if (el('elab-neta')) el('elab-neta').oninput = actualizarPreviewElaboracion;

    actualizarPreviewElaboracion();
    cargarRendimientos();

    el(MODAL_ID)?.classList.add('active');
}

/**
 * Preview en vivo: rendimiento real de las dos pesadas vs el de la ficha.
 * Solo informa — el cálculo que se guarda lo hace el backend.
 */
export function actualizarPreviewElaboracion() {
    const preview = el('elab-preview');
    if (!preview) return;

    const select = el('elab-ingrediente');
    const bruta = parseFloat(el('elab-bruta')?.value);
    const neta = parseFloat(el('elab-neta')?.value);
    const opcion = select?.selectedOptions?.[0];
    const unidad = opcion?.dataset?.unidad || 'ud';
    const ficha = opcion?.dataset?.rendimiento ? parseFloat(opcion.dataset.rendimiento) : null;

    if (!select?.value || !Number.isFinite(bruta) || bruta <= 0 || !Number.isFinite(neta) || neta <= 0) {
        preview.textContent = '—';
        preview.style.color = '';
        return;
    }

    const real = Math.round((neta / bruta) * 100 * 10) / 10;

    if (real > RENDIMIENTO_MAX) {
        preview.textContent = t('inventario:elab_unit_mismatch');
        preview.style.color = '#dc2626';
        return;
    }

    let texto = `${real}% (${neta} / ${bruta} ${escapeHTML(unidad)})`;
    if (ficha !== null && Number.isFinite(ficha)) {
        const delta = Math.round((real - ficha) * 10) / 10;
        const signo = delta > 0 ? '+' : '';
        texto += `  ·  ${t('inventario:elab_vs_ficha')} ${ficha}% (${signo}${delta} pts)`;
        // Rojo si el real es peor que la ficha por >5 pts: el coste real es mayor.
        preview.style.color = delta < -5 ? '#dc2626' : delta > 5 ? '#d97706' : '#16a34a';
    } else {
        preview.style.color = '';
    }
    preview.textContent = texto;
}

export async function registrarElaboracion() {
    const select = el('elab-ingrediente');
    const ingredienteId = parseInt(select?.value, 10);
    const bruta = parseFloat(el('elab-bruta')?.value);
    const neta = parseFloat(el('elab-neta')?.value);

    if (!ingredienteId) {
        window.showToast?.(t('inventario:elab_error_no_ingredient'), 'warning');
        return;
    }
    if (!Number.isFinite(bruta) || bruta <= 0 || !Number.isFinite(neta) || neta <= 0) {
        window.showToast?.(t('inventario:elab_error_weights'), 'warning');
        return;
    }

    const btn = el('elab-btn-registrar');
    if (btn) btn.disabled = true;

    try {
        const creado = await window.api.createElaboracion({
            ingredienteId,
            cantidadBruta: bruta,
            cantidadNeta: neta,
            nota: el('elab-nota')?.value || undefined,
            fecha: el('elab-fecha')?.value || undefined
        });

        const real = parseFloat(creado?.rendimiento_real);
        window.showToast?.(
            `${t('inventario:elab_saved')} ${Number.isFinite(real) ? real + '%' : ''}`,
            'success'
        );

        // Limpiar pesadas (el ingrediente se queda: sesiones de varios pesajes)
        if (el('elab-bruta')) el('elab-bruta').value = '';
        if (el('elab-neta')) el('elab-neta').value = '';
        actualizarPreviewElaboracion();
        cargarRendimientos();
    } catch (err) {
        logger.error('Error registrando elaboración', err);
        window.showToast?.(err?.message || t('inventario:elab_error_save'), 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/**
 * Aplica el rendimiento real medido a la ficha del ingrediente. UN clic con
 * confirmación: la app nunca cambia la ficha sola (ley de producto), pero
 * tampoco te manda a Ingredientes a copiar el número a mano.
 * La ficha guarda un ENTERO 1–100: se aplica redondeado.
 */
export async function aplicarRendimientoFicha(dataset) {
    const id = parseInt(dataset?.id, 10);
    const real = parseFloat(dataset?.real);
    if (!id || !Number.isFinite(real)) return;

    const nuevo = Math.min(100, Math.max(1, Math.round(real)));
    const nombre = dataset.nombre || '';
    const ficha = dataset.ficha || '?';

    const mensaje = t('inventario:elab_apply_confirm')
        .replace('{{nombre}}', nombre)
        .replace('{{ficha}}', ficha)
        .replace('{{nuevo}}', nuevo);
    if (!window.confirm(mensaje)) return;

    try {
        await window.api.updateIngrediente(id, { rendimiento: nuevo });
        window.showToast?.(`${t('inventario:elab_applied')} ${nombre}: ${nuevo}%`, 'success');
        // Refrescar datos en memoria para que escandallos/inventario vean la ficha nueva
        if (window.api?.getIngredientes) {
            window.ingredientes = await window.api.getIngredientes();
        }
        cargarRendimientos();
    } catch (err) {
        logger.error('Error aplicando rendimiento a la ficha', err);
        window.showToast?.(err?.message || t('inventario:elab_apply_error'), 'error');
    }
}

/**
 * Resumen por ingrediente: rendimiento real PONDERADO vs ficha, con semáforo.
 */
async function cargarRendimientos() {
    const cont = el('elab-rendimientos');
    if (!cont) return;
    cont.innerHTML = `<p style="color:#64748b;font-size:13px;">…</p>`;

    try {
        const data = await window.api.getRendimientosReales();
        const filas = data?.rendimientos || [];

        if (filas.length === 0) {
            cont.innerHTML = `<p style="color:#64748b;font-size:13px;">${escapeHTML(t('inventario:elab_empty'))}</p>`;
            return;
        }

        let html = '';
        filas.forEach(r => {
            const real = parseFloat(r.rendimiento_real);
            const ficha = r.rendimiento_ficha !== null ? parseFloat(r.rendimiento_ficha) : null;
            const delta = r.desviacion_pts !== null ? parseFloat(r.desviacion_pts) : null;
            const color = delta === null ? '#64748b' : delta < -5 ? '#dc2626' : delta > 5 ? '#d97706' : '#16a34a';
            const deltaTxt = delta === null ? '' :
                ` <span style="color:${color};font-weight:700;">(${delta > 0 ? '+' : ''}${delta} pts)</span>`;
            // "Aplicar a la ficha": cierra el círculo sin peregrinar a Ingredientes.
            // Solo si hay desviación real (≥1 pt) y el valor cabe en la ficha (1–100:
            // la columna `rendimiento` es INTEGER acotado; los >100 tipo arroz no).
            const aplicable = r.ingrediente_id && delta !== null && Math.abs(delta) >= 1
                && Number.isFinite(real) && real >= 1 && real <= 100;
            const btnAplicar = aplicable
                ? `<button data-action="aplicar-rendimiento-ficha"
                       data-id="${r.ingrediente_id}" data-nombre="${escapeHTML(r.nombre || '')}"
                       data-real="${real}" data-ficha="${ficha}"
                       style="border:1px solid #059669;background:#ecfdf5;color:#047857;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
                       ✅ ${t('inventario:elab_apply_btn')}</button>`
                : '';
            html += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid #f1f5f9;font-size:13px;">
                <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(r.nombre || '')}</span>
                <span style="white-space:nowrap;display:inline-flex;align-items:center;gap:8px;">
                  <span>
                    <strong>${Number.isFinite(real) ? real + '%' : '—'}</strong>
                    <span style="color:#94a3b8;"> ${t('inventario:elab_vs_ficha')} ${ficha !== null ? ficha + '%' : '—'}</span>${deltaTxt}
                    <span style="color:#94a3b8;font-size:12px;"> · ${r.n_elaboraciones}×</span>
                  </span>
                  ${btnAplicar}
                </span>
              </div>`;
        });
        cont.innerHTML = html;
    } catch (err) {
        logger.error('Error cargando rendimientos', err);
        cont.innerHTML = `<p style="color:#dc2626;font-size:13px;">${escapeHTML(t('inventario:elab_error_load'))}</p>`;
    }
}
