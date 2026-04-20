/**
 * Gastos Fijos Dinámicos
 * ---------------------
 * UI compacta: lista por categoría con [concepto] [input €] [🗑]. Sin sliders.
 * Botón "+ Añadir" abre un selector con los 27 gastos más comunes agrupados
 * por categoría; los que el restaurante ya tiene se filtran automáticamente
 * de la lista. Opción "Otro…" para nombres libres (útil en restaurantes con
 * categorías locales no previstas).
 *
 * El P&L, el beneficio neto y el chat son agnósticos del nombre del concepto
 * (suman todas las filas), así que cualquier cosa que añadas aquí cuenta.
 */

import { cm, escapeHTML } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

const SAVE_DEBOUNCE_MS = 400;
const _saveTimers = {};

// --------------------------------------------------------------------------
// Preset catalog — 27 common restaurant fixed expenses, grouped by category.
// --------------------------------------------------------------------------
const PRESET_EXPENSES = [
    // Personal
    { concepto: 'Sueldos', cat: 'Personal' },
    { concepto: 'Nóminas', cat: 'Personal' },
    { concepto: 'Seguridad Social', cat: 'Personal' },
    { concepto: 'Finiquitos', cat: 'Personal' },
    // Impuestos
    { concepto: 'IRPF', cat: 'Impuestos' },
    { concepto: 'IVA', cat: 'Impuestos' },
    { concepto: 'Sociedades', cat: 'Impuestos' },
    { concepto: 'IAE', cat: 'Impuestos' },
    // Local
    { concepto: 'Alquiler', cat: 'Local' },
    { concepto: 'Comunidad', cat: 'Local' },
    { concepto: 'Seguro local', cat: 'Local' },
    // Suministros
    { concepto: 'Luz', cat: 'Suministros' },
    { concepto: 'Agua', cat: 'Suministros' },
    { concepto: 'Gas', cat: 'Suministros' },
    { concepto: 'Teléfono/Internet', cat: 'Suministros' },
    // Bancos
    { concepto: 'Comisión TPV', cat: 'Bancos' },
    { concepto: 'Cuota préstamo', cat: 'Bancos' },
    { concepto: 'Comisiones cuenta', cat: 'Bancos' },
    // Servicios
    { concepto: 'Gestoría', cat: 'Servicios' },
    { concepto: 'Seguro RC', cat: 'Servicios' },
    { concepto: 'SGAE', cat: 'Servicios' },
    { concepto: 'Basura', cat: 'Servicios' },
    // Marketing
    { concepto: 'Publicidad', cat: 'Marketing' },
    { concepto: 'Web/dominio', cat: 'Marketing' },
    { concepto: 'Redes sociales', cat: 'Marketing' },
    // Mantenimiento
    { concepto: 'Reparaciones', cat: 'Mantenimiento' },
    { concepto: 'Extractores', cat: 'Mantenimiento' },
    { concepto: 'Fumigación', cat: 'Mantenimiento' }
];

// Map concepto lowercased → category (used to bucket existing DB rows that
// might have been typed by the user).
const CATEGORY_MAP = (() => {
    const m = {};
    PRESET_EXPENSES.forEach(p => { m[p.concepto.toLowerCase()] = p.cat; });
    // Legacy names some users already had:
    m['nomina'] = 'Personal';
    m['telefono/internet'] = 'Suministros';
    m['comision tpv'] = 'Bancos';
    m['cuota prestamo'] = 'Bancos';
    m['gestoria'] = 'Servicios';
    m['fumigacion'] = 'Mantenimiento';
    return m;
})();

const CATEGORY_ORDER = ['Personal', 'Impuestos', 'Local', 'Suministros', 'Bancos', 'Servicios', 'Marketing', 'Mantenimiento', 'Otros'];
const CATEGORY_ICONS = {
    'Personal': '👥', 'Impuestos': '🏛️', 'Local': '🏪', 'Suministros': '⚡',
    'Bancos': '🏦', 'Servicios': '🧾', 'Marketing': '📣', 'Mantenimiento': '🔧', 'Otros': '📌'
};

function categoriaFor(concepto) {
    if (!concepto) return 'Otros';
    return CATEGORY_MAP[String(concepto).toLowerCase().trim()] || 'Otros';
}

// --------------------------------------------------------------------------
// Row + section rendering
// --------------------------------------------------------------------------
function rowHtml(gasto) {
    const monto = parseFloat(gasto.monto_mensual) || 0;
    const id = gasto.id;
    return `
        <div class="gf-row" data-gasto-id="${id}"
             style="display: grid; grid-template-columns: 1fr 140px 32px; gap: 12px; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; transition: background 0.2s;">
            <span style="color: white; font-size: 14px; font-weight: 500; word-break: break-word;">${escapeHTML(gasto.concepto || '—')}</span>
            <div style="position: relative;">
                <input type="number" inputmode="decimal" step="0.01" min="0" value="${monto}"
                    class="gf-input" data-gasto-id="${id}"
                    style="width: 100%; padding: 7px 28px 7px 10px; text-align: right; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; color: white; font-weight: 600; font-size: 14px; outline: none;">
                <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.65); font-size: 13px; pointer-events: none;">€</span>
            </div>
            <button type="button" class="gf-delete-btn" data-gasto-id="${id}" title="${escapeHTML(t('common:btn_delete') || 'Eliminar')}"
                style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 4px; font-size: 14px; line-height: 1; border-radius: 6px;">🗑</button>
        </div>
    `;
}

function emptyStateHtml() {
    return `
        <div style="text-align: center; padding: 30px 20px; color: rgba(255,255,255,0.85);">
            <div style="font-size: 36px; margin-bottom: 8px; opacity: 0.7;">💸</div>
            <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600;">${escapeHTML(t('balance:no_fixed_expenses_title') || 'Aún no hay gastos fijos')}</p>
            <p style="margin: 0; font-size: 13px; opacity: 0.8;">${escapeHTML(t('balance:no_fixed_expenses_hint') || 'Pulsa «+ Añadir» para empezar a configurarlos.')}</p>
        </div>
    `;
}

function renderGrouped(gastos) {
    const buckets = {};
    for (const g of gastos) {
        const cat = categoriaFor(g.concepto);
        if (!buckets[cat]) buckets[cat] = [];
        buckets[cat].push(g);
    }
    Object.keys(buckets).forEach(cat => {
        buckets[cat].sort((a, b) => (a.concepto || '').localeCompare(b.concepto || ''));
    });
    // Open state persisted in localStorage so user expansion survives reloads.
    let openSet = new Set();
    try {
        openSet = new Set(JSON.parse(localStorage.getItem('gf_open_cats') || '[]'));
    } catch { /* ignore */ }

    const sections = CATEGORY_ORDER
        .filter(cat => buckets[cat] && buckets[cat].length > 0)
        .map(cat => {
            const subtotal = buckets[cat].reduce((s, g) => s + (parseFloat(g.monto_mensual) || 0), 0);
            const icon = CATEGORY_ICONS[cat] || '•';
            const count = buckets[cat].length;
            const isOpen = openSet.has(cat);
            return `
                <details class="gf-group" data-cat="${escapeHTML(cat)}"${isOpen ? ' open' : ''}
                    style="margin-bottom: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; overflow: hidden;">
                    <summary style="list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; user-select: none;">
                        <span style="display: flex; align-items: center; gap: 10px;">
                            <span class="gf-chevron" style="display: inline-block; transition: transform 0.2s; color: rgba(255,255,255,0.8); font-size: 11px;">▶</span>
                            <span style="font-size: 15px;">${icon}</span>
                            <span style="color: white; font-size: 13px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;">${escapeHTML(cat)}</span>
                            <span style="color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 500;">${count}</span>
                        </span>
                        <span style="color: rgba(255,255,255,0.95); font-size: 14px; font-weight: 700;">${cm(subtotal, 0)}</span>
                    </summary>
                    <div style="display: flex; flex-direction: column; gap: 6px; padding: 4px 12px 12px 12px;">
                        ${buckets[cat].map(rowHtml).join('')}
                    </div>
                </details>
            `;
        });
    return sections.join('');
}

function persistOpenCats(container) {
    const open = Array.from(container.querySelectorAll('details.gf-group[open]'))
        .map(el => el.dataset.cat)
        .filter(Boolean);
    try { localStorage.setItem('gf_open_cats', JSON.stringify(open)); } catch { /* ignore */ }
}

// --------------------------------------------------------------------------
// Main render
// --------------------------------------------------------------------------
export async function renderizarGastosFijosDinamicos() {
    const container = document.getElementById('gastos-fijos-dinamico-list');
    if (!container) return;

    let gastos = [];
    try {
        gastos = await window.API.getGastosFijos();
    } catch (_e) {
        container.innerHTML = emptyStateHtml();
        return;
    }

    if (!Array.isArray(gastos) || gastos.length === 0) {
        container.innerHTML = emptyStateHtml();
    } else {
        container.innerHTML = renderGrouped(gastos);
        wireRowEvents(container);
    }

    if (typeof window.actualizarTotalGastosFijos === 'function') {
        await window.actualizarTotalGastosFijos();
    }
}

function wireRowEvents(container) {
    // Persist open/closed state per category and animate chevron.
    container.querySelectorAll('details.gf-group').forEach(det => {
        det.addEventListener('toggle', () => {
            const chev = det.querySelector('.gf-chevron');
            if (chev) chev.style.transform = det.open ? 'rotate(90deg)' : 'rotate(0deg)';
            persistOpenCats(container);
        });
        // Initial chevron orientation (matches the [open] attribute at render time)
        const chev0 = det.querySelector('.gf-chevron');
        if (chev0 && det.open) chev0.style.transform = 'rotate(90deg)';
    });

    container.querySelectorAll('.gf-input').forEach(input => {
        const id = parseInt(input.dataset.gastoId, 10);
        if (!id) return;
        // Save while typing (debounced) AND on blur/enter.
        input.addEventListener('input', () => scheduleSave(id, input));
        input.addEventListener('blur', () => { flushSave(id, input); });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });
    });
    container.querySelectorAll('.gf-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.gastoId, 10);
            if (id) eliminarGastoFijo(id);
        });
    });
}

function scheduleSave(id, input) {
    clearTimeout(_saveTimers[id]);
    _saveTimers[id] = setTimeout(() => saveInputValue(id, input), SAVE_DEBOUNCE_MS);
}
function flushSave(id, input) {
    clearTimeout(_saveTimers[id]);
    saveInputValue(id, input);
}

async function saveInputValue(id, input) {
    const monto = parseFloat(input.value) || 0;
    const row = input.closest('.gf-row');
    const label = row?.querySelector('span')?.textContent?.trim() || '';
    try {
        await window.API.updateGastoFijo(id, label, monto);
        if (typeof window.actualizarTotalGastosFijos === 'function') {
            await window.actualizarTotalGastosFijos();
        }
        // Update the section subtotal live without re-rendering the whole list.
        refreshSectionSubtotal(input);
    } catch (_e) {
        window.showToast?.(t('balance:error_saving_expense') || 'Error guardando gasto fijo', 'error');
    }
}

function refreshSectionSubtotal(input) {
    const section = input.closest('.gf-group');
    if (!section) return;
    const total = Array.from(section.querySelectorAll('.gf-input'))
        .reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
    // New structure: <summary><span>…</span><span>subtotal</span></summary>
    const span = section.querySelector('summary > span:last-child');
    if (span) span.textContent = cm(total, 0);
}

// --------------------------------------------------------------------------
// Modal "+ Añadir" — dropdown with presets + "Otro" fallback
// --------------------------------------------------------------------------

export async function abrirModalNuevoGastoFijo() {
    // Load what we already have so we can filter the preset list.
    let existing = [];
    try {
        existing = await window.API.getGastosFijos();
    } catch { /* ignore */ }
    const existingLower = new Set((existing || []).map(g => (g.concepto || '').toLowerCase().trim()));

    const titulo = document.getElementById('titulo-modal-gasto');
    if (titulo) titulo.textContent = t('balance:gasto_fijo_title') || 'Añadir Gasto Fijo';

    const select = document.getElementById('gasto-preset-select');
    const conceptoInput = document.getElementById('gasto-concepto');
    const montoInput = document.getElementById('gasto-monto');
    const customWrap = document.getElementById('gasto-custom-wrap');
    const idInput = document.getElementById('gasto-id');

    if (idInput) idInput.value = '';
    if (montoInput) montoInput.value = '';
    if (conceptoInput) conceptoInput.value = '';

    // Build the grouped select with ALL presets. Those already in DB are
    // rendered as disabled options with a ✓ so the user sees the full catalog
    // as reference but can't create duplicates accidentally.
    if (select) {
        const byCat = {};
        PRESET_EXPENSES.forEach(p => {
            if (!byCat[p.cat]) byCat[p.cat] = [];
            byCat[p.cat].push(p);
        });
        let html = `<option value="">— ${escapeHTML(t('balance:choose_expense') || 'Selecciona un gasto')} —</option>`;
        CATEGORY_ORDER.forEach(cat => {
            if (!byCat[cat] || byCat[cat].length === 0) return;
            html += `<optgroup label="${escapeHTML((CATEGORY_ICONS[cat] || '') + ' ' + cat)}">`;
            byCat[cat].forEach(p => {
                const used = existingLower.has(p.concepto.toLowerCase());
                const label = used ? `${p.concepto}  ✓` : p.concepto;
                const disabledAttr = used ? ' disabled' : '';
                html += `<option value="${escapeHTML(p.concepto)}"${disabledAttr}>${escapeHTML(label)}</option>`;
            });
            html += `</optgroup>`;
        });
        html += `<optgroup label="${escapeHTML(t('balance:preset_other_group') || 'Otro')}">`;
        html += `<option value="__custom__">${escapeHTML(t('balance:preset_other') || 'Otro (nombre libre)…')}</option>`;
        html += `</optgroup>`;
        select.innerHTML = html;
        select.value = '';
        // Hide custom input until the user picks "Otro"
        if (customWrap) customWrap.style.display = 'none';
        select.onchange = () => {
            if (select.value === '__custom__') {
                if (customWrap) customWrap.style.display = 'block';
                conceptoInput?.focus();
            } else {
                if (customWrap) customWrap.style.display = 'none';
                if (conceptoInput) conceptoInput.value = select.value || '';
                montoInput?.focus();
            }
        };
    }

    const modal = document.getElementById('modal-gasto-fijo');
    if (modal) modal.classList.add('active');
    // Default focus: the preset select
    select?.focus();
}

export async function editarGastoFijo(id) {
    // Same modal, pre-filled.
    let gasto = null;
    try {
        const gastos = await window.API.getGastosFijos();
        gasto = (gastos || []).find(g => g.id === id);
    } catch { /* ignore */ }
    if (!gasto) return;

    const idInput = document.getElementById('gasto-id');
    const select = document.getElementById('gasto-preset-select');
    const customWrap = document.getElementById('gasto-custom-wrap');
    const conceptoInput = document.getElementById('gasto-concepto');
    const montoInput = document.getElementById('gasto-monto');
    const titulo = document.getElementById('titulo-modal-gasto');

    if (idInput) idInput.value = String(id);
    if (titulo) titulo.textContent = t('balance:gasto_fijo_edit_title') || 'Editar Gasto Fijo';
    // When editing, skip the preset picker entirely and show the text input with the name.
    if (select) { select.innerHTML = ''; select.style.display = 'none'; }
    if (customWrap) customWrap.style.display = 'block';
    if (conceptoInput) conceptoInput.value = gasto.concepto || '';
    if (montoInput) montoInput.value = parseFloat(gasto.monto_mensual) || 0;

    const modal = document.getElementById('modal-gasto-fijo');
    if (modal) modal.classList.add('active');
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

export async function guardarGastoFijo(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const id = document.getElementById('gasto-id')?.value;
    let concepto = (document.getElementById('gasto-concepto')?.value || '').trim();
    // If a preset is selected and the text input wasn't populated (first time), take the preset value.
    if (!concepto) {
        const sel = document.getElementById('gasto-preset-select')?.value || '';
        if (sel && sel !== '__custom__') concepto = sel;
    }
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
    // Restore the select for next add (edit flow hides it)
    const select = document.getElementById('gasto-preset-select');
    if (select) select.style.display = '';
}

if (typeof window !== 'undefined') {
    window.renderizarGastosFijosDinamicos = renderizarGastosFijosDinamicos;
    window.abrirModalNuevoGastoFijo = abrirModalNuevoGastoFijo;
    window.editarGastoFijo = editarGastoFijo;
    window.eliminarGastoFijo = eliminarGastoFijo;
    window.guardarGastoFijo = guardarGastoFijo;
    window.cerrarFormGastoFijo = cerrarFormGastoFijo;
    window.cerrarFormularioGastoFijo = cerrarFormGastoFijo;
}
