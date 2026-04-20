/**
 * Gastos Fijos Dinámicos
 * ---------------------
 * Reemplaza las 4 barras hardcoded (alquiler/personal/suministros/otros) por
 * una lista dinámica basada en los gastos_fijos configurados en la BD por
 * cada restaurante. Cada restaurante decide sus propias categorías (BANCOS,
 * IRPF, SUELDOS, SEG.SOCIAL, IMPUESTOS, etc.) desde el modal existente
 * `#modal-gasto-fijo`.
 *
 * El total sigue calculándose con `calcularTotalGastosFijos()` (genérico,
 * suma todas las filas de DB). El P&L y el chat no se tocan.
 */

import { cm, escapeHTML } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

const DEBOUNCE_MS = 500;
const _saveTimers = {};

// Range ceiling grows with value so the slider is usable even for big expenses.
function dynamicMax(monto) {
    const base = Math.max(monto || 0, 1000);
    // Round up to a "nice" ceiling (x2 with a minimum of 5000)
    const candidate = Math.max(base * 2, 5000);
    return Math.ceil(candidate / 500) * 500;
}

function sliderCardHtml(gasto) {
    const monto = parseFloat(gasto.monto_mensual) || 0;
    const max = dynamicMax(monto);
    const label = escapeHTML(gasto.concepto || '—');
    const id = gasto.id;
    return `
        <div class="gf-card" data-gasto-id="${id}"
             style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 14px; transition: background 0.2s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                <label style="font-weight: 600; color: rgba(255,255,255,0.95); font-size: 14px; word-break: break-word; flex: 1;">
                    ${label}
                </label>
                <div style="display: flex; gap: 2px; flex-shrink: 0;">
                    <button type="button" class="gf-edit-btn" data-gasto-id="${id}" title="${escapeHTML(t('common:btn_edit') || 'Editar')}"
                        style="background: none; border: none; color: rgba(255,255,255,0.75); cursor: pointer; padding: 4px 6px; font-size: 13px; line-height: 1; border-radius: 6px;">✎</button>
                    <button type="button" class="gf-delete-btn" data-gasto-id="${id}" title="${escapeHTML(t('common:btn_delete') || 'Eliminar')}"
                        style="background: none; border: none; color: rgba(255,255,255,0.75); cursor: pointer; padding: 4px 6px; font-size: 13px; line-height: 1; border-radius: 6px;">🗑</button>
                </div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-bottom: 6px;">
                <span id="gf-dyn-${id}-valor" style="font-weight: 700; color: white; font-size: 17px;">${cm(monto, 0)}</span>
            </div>
            <input type="range" id="gf-dyn-${id}" min="0" max="${max}" step="50" value="${monto}" data-gasto-id="${id}"
                style="width: 100%; height: 8px; border-radius: 10px; background: rgba(255,255,255,0.3); outline: none; cursor: pointer;">
        </div>
    `;
}

function emptyStateHtml() {
    return `
        <div style="grid-column: 1/-1; text-align: center; padding: 30px 20px; color: rgba(255,255,255,0.85);">
            <div style="font-size: 36px; margin-bottom: 8px; opacity: 0.7;">💸</div>
            <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600;">${escapeHTML(t('balance:no_fixed_expenses_title') || 'Aún no hay gastos fijos')}</p>
            <p style="margin: 0; font-size: 13px; opacity: 0.8;">${escapeHTML(t('balance:no_fixed_expenses_hint') || 'Pulsa «+ Añadir» para empezar a configurarlos.')}</p>
        </div>
    `;
}

/**
 * Main render — called on tab switch and after every CRUD operation.
 */
export async function renderizarGastosFijosDinamicos() {
    const container = document.getElementById('gastos-fijos-dinamico-list');
    if (!container) return;

    let gastos = [];
    try {
        gastos = await window.API.getGastosFijos();
    } catch (_e) {
        // If the API fails (offline, 401, etc.) show empty state and let the total fall back.
        container.innerHTML = emptyStateHtml();
        return;
    }

    if (!Array.isArray(gastos) || gastos.length === 0) {
        container.innerHTML = emptyStateHtml();
    } else {
        // Sort alphabetically so the order is stable across renders.
        gastos.sort((a, b) => (a.concepto || '').localeCompare(b.concepto || ''));
        container.innerHTML = gastos.map(sliderCardHtml).join('');
        wireSliderEvents(container);
    }

    // Keep the visible total in sync (centralized function already sums all rows from DB)
    if (typeof window.actualizarTotalGastosFijos === 'function') {
        await window.actualizarTotalGastosFijos();
    }
}

function wireSliderEvents(container) {
    container.querySelectorAll('input[type="range"][data-gasto-id]').forEach(slider => {
        const id = parseInt(slider.dataset.gastoId, 10);
        if (!id) return;
        const valorSpan = document.getElementById(`gf-dyn-${id}-valor`);
        slider.addEventListener('input', () => {
            // Live update of the label so the user sees the value as they drag.
            if (valorSpan) valorSpan.textContent = cm(slider.value, 0);
            scheduleSave(id, slider);
        });
    });

    container.querySelectorAll('.gf-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.gastoId, 10);
            if (id) editarGastoFijo(id);
        });
    });

    container.querySelectorAll('.gf-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.gastoId, 10);
            if (id) eliminarGastoFijo(id);
        });
    });
}

function scheduleSave(id, slider) {
    clearTimeout(_saveTimers[id]);
    _saveTimers[id] = setTimeout(() => saveSliderValue(id, slider), DEBOUNCE_MS);
}

async function saveSliderValue(id, slider) {
    const monto = parseFloat(slider.value) || 0;
    // We need the current concepto (backend PUT requires both fields).
    const card = slider.closest('.gf-card');
    const label = card?.querySelector('label')?.textContent?.trim() || '';
    try {
        await window.API.updateGastoFijo(id, label, monto);
        if (typeof window.actualizarTotalGastosFijos === 'function') {
            await window.actualizarTotalGastosFijos();
        }
    } catch (_e) {
        window.showToast?.(t('balance:error_saving_expense') || 'Error guardando gasto fijo', 'error');
    }
}

// ---------------------------------------------------------------------------
// Modal wiring — reuse #modal-gasto-fijo already present in index.html.
// ---------------------------------------------------------------------------

export function abrirModalNuevoGastoFijo() {
    const modal = document.getElementById('modal-gasto-fijo');
    const idInput = document.getElementById('gasto-id');
    const conceptoInput = document.getElementById('gasto-concepto');
    const montoInput = document.getElementById('gasto-monto');
    const titulo = document.getElementById('titulo-modal-gasto');
    if (idInput) idInput.value = '';
    if (conceptoInput) conceptoInput.value = '';
    if (montoInput) montoInput.value = '';
    if (titulo) titulo.textContent = t('balance:gasto_fijo_title') || 'Añadir Gasto Fijo';
    // .modal has `display: none !important` in main.css — open via the `.active` class.
    if (modal) modal.classList.add('active');
    conceptoInput?.focus();
}

export async function editarGastoFijo(id) {
    let gasto = null;
    try {
        const gastos = await window.API.getGastosFijos();
        gasto = (gastos || []).find(g => g.id === id);
    } catch { /* ignore */ }
    if (!gasto) return;

    const modal = document.getElementById('modal-gasto-fijo');
    const idInput = document.getElementById('gasto-id');
    const conceptoInput = document.getElementById('gasto-concepto');
    const montoInput = document.getElementById('gasto-monto');
    const titulo = document.getElementById('titulo-modal-gasto');
    if (idInput) idInput.value = String(id);
    if (conceptoInput) conceptoInput.value = gasto.concepto || '';
    if (montoInput) montoInput.value = parseFloat(gasto.monto_mensual) || 0;
    if (titulo) titulo.textContent = t('balance:gasto_fijo_edit_title') || 'Editar Gasto Fijo';
    if (modal) modal.classList.add('active');
    conceptoInput?.focus();
}

export async function eliminarGastoFijo(id) {
    const msg = t('balance:confirm_delete_expense') || '¿Eliminar este gasto fijo?';
    if (!window.confirm(msg)) return;
    try {
        await window.API.deleteGastoFijo(id);
        window.showToast?.(t('balance:expense_deleted') || 'Gasto fijo eliminado', 'success');
        await renderizarGastosFijosDinamicos();
    } catch (_e) {
        window.showToast?.(t('balance:error_deleting_expense') || 'Error eliminando gasto fijo', 'error');
    }
}

/**
 * Called from the form submit in index.html (`onsubmit="guardarGastoFijo(event)"`).
 * Creates a new gasto fijo OR updates an existing one depending on #gasto-id.
 */
export async function guardarGastoFijo(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const id = document.getElementById('gasto-id')?.value;
    const concepto = (document.getElementById('gasto-concepto')?.value || '').trim();
    const monto = parseFloat(document.getElementById('gasto-monto')?.value) || 0;

    if (!concepto) {
        window.showToast?.(t('balance:error_concept_required') || 'El concepto es obligatorio', 'warning');
        return;
    }
    if (monto < 0) {
        window.showToast?.(t('balance:error_amount_negative') || 'El monto no puede ser negativo', 'warning');
        return;
    }

    try {
        if (id) {
            await window.API.updateGastoFijo(parseInt(id, 10), concepto, monto);
        } else {
            await window.API.createGastoFijo(concepto, monto);
        }
        cerrarFormGastoFijo();
        window.showToast?.(t('balance:expense_saved') || 'Gasto fijo guardado', 'success');
        await renderizarGastosFijosDinamicos();
    } catch (_e) {
        window.showToast?.(t('balance:error_saving_expense') || 'Error guardando gasto fijo', 'error');
    }
}

export function cerrarFormGastoFijo() {
    const modal = document.getElementById('modal-gasto-fijo');
    if (modal) modal.classList.remove('active');
}

// Expose to window so inline handlers in index.html keep working
if (typeof window !== 'undefined') {
    window.renderizarGastosFijosDinamicos = renderizarGastosFijosDinamicos;
    window.abrirModalNuevoGastoFijo = abrirModalNuevoGastoFijo;
    window.editarGastoFijo = editarGastoFijo;
    window.eliminarGastoFijo = eliminarGastoFijo;
    window.guardarGastoFijo = guardarGastoFijo;
    window.cerrarFormGastoFijo = cerrarFormGastoFijo;
    // Alias expected by event-bindings.js (data-action="cerrar-form-gasto-fijo")
    window.cerrarFormularioGastoFijo = cerrarFormGastoFijo;
}
