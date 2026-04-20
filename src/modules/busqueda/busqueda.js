/**
 * Búsqueda (Search) module
 * ------------------------
 * UI for the "Búsqueda" tab: searches sales or purchases in a date range
 * with optional name / supplier filters. Hits GET /api/search on the backend.
 *
 * Self-contained: this module does not mutate any global state the rest of
 * the app depends on. It only reads `window.proveedores` (already loaded
 * by core.js on login) and writes into `#busqueda-container`.
 *
 * Entry point: renderizarBusqueda() — attached to window for cambiarTab().
 */

import { api } from '../../api/client.js';
import { t } from '@/i18n/index.js';
import { cm, escapeHTML } from '../../utils/helpers.js';
import { exportToExcel } from '../export/excel-export.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Module state (lives only while the tab is visible; re-renders reuse it).
// ---------------------------------------------------------------------------
const state = {
    tipo: 'ventas',     // 'ventas' | 'compras'
    desde: '',          // YYYY-MM-DD
    hasta: '',          // YYYY-MM-DD (exclusive — 1st of next period)
    q: '',              // Free text
    proveedorId: '',    // Purchases only
    lastResult: null,
    loading: false
};

// ---------------------------------------------------------------------------
// Date helpers — local, not dependent on any app-wide util.
// Using local dates avoids timezone shifts on toISOString().
// ---------------------------------------------------------------------------
function fmtLocalISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function addDays(d, n) {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + n);
    return nd;
}
function startOfWeek(d) {
    // Monday as first day of the week
    const nd = new Date(d);
    const dow = nd.getDay(); // 0=Sun .. 6=Sat
    const diff = (dow + 6) % 7;
    nd.setDate(nd.getDate() - diff);
    return nd;
}
function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfNextMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function computePreset(preset) {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    switch (preset) {
        case 'today':
            return { desde: fmtLocalISO(todayMid), hasta: fmtLocalISO(addDays(todayMid, 1)) };
        case 'yesterday': {
            const y = addDays(todayMid, -1);
            return { desde: fmtLocalISO(y), hasta: fmtLocalISO(todayMid) };
        }
        case 'this_week': {
            const start = startOfWeek(todayMid);
            return { desde: fmtLocalISO(start), hasta: fmtLocalISO(addDays(start, 7)) };
        }
        case 'last_week': {
            const thisWeekStart = startOfWeek(todayMid);
            const lastWeekStart = addDays(thisWeekStart, -7);
            return { desde: fmtLocalISO(lastWeekStart), hasta: fmtLocalISO(thisWeekStart) };
        }
        case 'this_month':
            return { desde: fmtLocalISO(startOfMonth(todayMid)), hasta: fmtLocalISO(startOfNextMonth(todayMid)) };
        case 'last_month': {
            const start = new Date(todayMid.getFullYear(), todayMid.getMonth() - 1, 1);
            const end = startOfMonth(todayMid);
            return { desde: fmtLocalISO(start), hasta: fmtLocalISO(end) };
        }
        case 'last_7':
            return { desde: fmtLocalISO(addDays(todayMid, -7)), hasta: fmtLocalISO(addDays(todayMid, 1)) };
        case 'last_30':
            return { desde: fmtLocalISO(addDays(todayMid, -30)), hasta: fmtLocalISO(addDays(todayMid, 1)) };
        default:
            return null;
    }
}

function formatDisplayDate(isoDateTime) {
    if (!isoDateTime) return '';
    const lang = window.getCurrentLanguage?.() || 'es';
    const locale = lang === 'en' ? 'en-GB' : lang === 'zh' ? 'zh-CN' : 'es-ES';
    try {
        const d = new Date(isoDateTime);
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return isoDateTime.split('T')[0];
    }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function renderizarBusqueda() {
    const container = document.getElementById('busqueda-container');
    if (!container) return;

    // Default range: current month if not chosen yet.
    if (!state.desde || !state.hasta) {
        const r = computePreset('this_month');
        state.desde = r.desde;
        state.hasta = r.hasta;
    }

    container.innerHTML = renderHTML();
    wireEvents(container);
}

function renderHTML() {
    const salesLabel = t('busqueda:type_sales');
    const purchasesLabel = t('busqueda:type_purchases');
    const presets = [
        ['today', 'preset_today'],
        ['yesterday', 'preset_yesterday'],
        ['this_week', 'preset_this_week'],
        ['last_week', 'preset_last_week'],
        ['this_month', 'preset_this_month'],
        ['last_month', 'preset_last_month'],
        ['last_7', 'preset_last_7_days'],
        ['last_30', 'preset_last_30_days']
    ];
    const presetButtons = presets.map(
        ([key, i18nKey]) => `<button class="bsq-chip bsq-preset" data-preset="${key}">${escapeHTML(t('busqueda:' + i18nKey))}</button>`
    ).join('');

    const proveedores = Array.isArray(window.proveedores) ? window.proveedores : [];
    const proveedorOptions = [
        `<option value="">${escapeHTML(t('busqueda:all_suppliers'))}</option>`,
        ...proveedores.map(p => `<option value="${p.id}">${escapeHTML(p.nombre || '—')}</option>`)
    ].join('');

    const showSupplier = state.tipo === 'compras';

    return `
        <div class="bsq-toggle" role="tablist">
            <button class="bsq-toggle-btn ${state.tipo === 'ventas' ? 'active' : ''} bsq-type" data-type="ventas" role="tab" aria-selected="${state.tipo === 'ventas'}">
                <span class="bsq-toggle-icon">💰</span>${escapeHTML(salesLabel)}
            </button>
            <button class="bsq-toggle-btn ${state.tipo === 'compras' ? 'active' : ''} bsq-type" data-type="compras" role="tab" aria-selected="${state.tipo === 'compras'}">
                <span class="bsq-toggle-icon">📦</span>${escapeHTML(purchasesLabel)}
            </button>
        </div>

        <div class="bsq-filter-card">
            <div class="bsq-filter-section">
                <div class="bsq-section-title">📅 ${escapeHTML(t('busqueda:label_from'))} / ${escapeHTML(t('busqueda:label_to'))}</div>
                <div class="bsq-chips">
                    ${presetButtons}
                </div>
            </div>

            <div class="bsq-filter-section">
                <div class="bsq-grid">
                    <div class="bsq-field">
                        <label class="bsq-label">${escapeHTML(t('busqueda:label_from'))}</label>
                        <input type="date" id="bsq-desde" class="bsq-input" value="${escapeHTML(state.desde)}">
                    </div>
                    <div class="bsq-field">
                        <label class="bsq-label">${escapeHTML(t('busqueda:label_to'))}</label>
                        <input type="date" id="bsq-hasta" class="bsq-input" value="${escapeHTML(getDisplayHasta(state.hasta))}">
                    </div>
                    <div class="bsq-field bsq-field-grow">
                        <label class="bsq-label">${escapeHTML(t('busqueda:label_search'))}</label>
                        <input type="text" id="bsq-q" class="bsq-input" value="${escapeHTML(state.q)}" placeholder="${escapeHTML(t('busqueda:placeholder_search'))}">
                    </div>
                    <div id="bsq-supplier-wrap" class="bsq-field bsq-field-grow" style="${showSupplier ? '' : 'display:none;'}">
                        <label class="bsq-label">${escapeHTML(t('busqueda:label_supplier'))}</label>
                        <select id="bsq-supplier" class="bsq-input">
                            ${proveedorOptions}
                        </select>
                    </div>
                </div>
            </div>

            <div class="bsq-actions">
                <button id="bsq-search" class="btn btn-primary">🔍 ${escapeHTML(t('busqueda:btn_search'))}</button>
                <button id="bsq-reset" class="btn btn-secondary">${escapeHTML(t('busqueda:btn_reset'))}</button>
                <button id="bsq-export" class="btn btn-secondary" disabled>📥 ${escapeHTML(t('busqueda:btn_export'))}</button>
            </div>
        </div>

        <div id="bsq-results" class="bsq-results">
            <div class="bsq-empty">
                <div class="bsq-empty-icon">🔎</div>
                <p>${escapeHTML(t('busqueda:empty_initial'))}</p>
            </div>
        </div>
    `;
}

// The "hasta" value is exclusive (first day of the next period). When we
// show it in a <input type="date">, we present it as the previous day to
// feel natural for the user ("hasta el 30 de abril" instead of 1 de mayo).
function getDisplayHasta(exclusiveIso) {
    if (!exclusiveIso) return '';
    try {
        const d = new Date(exclusiveIso + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        return fmtLocalISO(d);
    } catch {
        return exclusiveIso;
    }
}
function toExclusiveHasta(displayIso) {
    if (!displayIso) return '';
    try {
        const d = new Date(displayIso + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        return fmtLocalISO(d);
    } catch {
        return displayIso;
    }
}

function wireEvents(container) {
    container.querySelectorAll('.bsq-type').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tipo = btn.dataset.type;
            renderizarBusqueda();
        });
    });
    container.querySelectorAll('.bsq-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const r = computePreset(btn.dataset.preset);
            if (!r) return;
            state.desde = r.desde;
            state.hasta = r.hasta;
            renderizarBusqueda();
        });
    });
    container.querySelector('#bsq-search')?.addEventListener('click', doSearch);
    container.querySelector('#bsq-reset')?.addEventListener('click', () => {
        state.q = '';
        state.proveedorId = '';
        const r = computePreset('this_month');
        state.desde = r.desde;
        state.hasta = r.hasta;
        state.lastResult = null;
        renderizarBusqueda();
    });
    container.querySelector('#bsq-export')?.addEventListener('click', doExport);

    // Enter in search field triggers search
    container.querySelector('#bsq-q')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSearch();
    });
}

async function doSearch() {
    const container = document.getElementById('busqueda-container');
    if (!container) return;

    const desde = container.querySelector('#bsq-desde')?.value;
    const hastaDisplay = container.querySelector('#bsq-hasta')?.value;
    const hasta = toExclusiveHasta(hastaDisplay);
    const q = container.querySelector('#bsq-q')?.value.trim();
    const proveedorId = container.querySelector('#bsq-supplier')?.value || '';

    if (!desde || !hastaDisplay) {
        window.showToast?.(t('busqueda:error_dates'), 'warning');
        return;
    }
    if (desde >= hasta) {
        window.showToast?.(t('busqueda:error_dates'), 'warning');
        return;
    }

    state.desde = desde;
    state.hasta = hasta;
    state.q = q;
    state.proveedorId = proveedorId;
    state.loading = true;

    const resultsEl = container.querySelector('#bsq-results');
    if (resultsEl) {
        resultsEl.innerHTML = `<p style="color:#64748b;text-align:center;padding:30px;">${escapeHTML(t('busqueda:loading'))}</p>`;
    }

    try {
        const params = {
            tipo: state.tipo,
            desde,
            hasta,
            limit: 500
        };
        if (q) params.q = q;
        if (state.tipo === 'compras' && proveedorId) params.proveedor_id = proveedorId;

        const data = await api.search(params);
        state.lastResult = data;
        renderResults(data);

        const exportBtn = container.querySelector('#bsq-export');
        if (exportBtn) {
            exportBtn.disabled = !(data.resultados && data.resultados.length);
        }
    } catch (err) {
        logger.error('Búsqueda: search failed', err);
        if (resultsEl) {
            resultsEl.innerHTML = `<p style="color:#dc2626;text-align:center;padding:30px;">${escapeHTML(t('busqueda:error_generic'))}</p>`;
        }
    } finally {
        state.loading = false;
    }
}

function renderResults(data) {
    const resultsEl = document.getElementById('bsq-results');
    if (!resultsEl) return;

    if (!data.resultados || data.resultados.length === 0) {
        resultsEl.innerHTML = `
            <div class="bsq-empty">
                <div class="bsq-empty-icon">🙁</div>
                <p>${escapeHTML(t('busqueda:empty_no_results'))}</p>
            </div>
        `;
        return;
    }

    const isVentas = data.tipo === 'ventas';

    // Build KPI cards
    let kpiCards;
    if (isVentas) {
        kpiCards = `
            <div class="bsq-kpi-grid">
                <div class="bsq-kpi bsq-kpi-primary">
                    <div class="bsq-kpi-label">${escapeHTML(t('busqueda:col_total'))}</div>
                    <div class="bsq-kpi-value">${cm(data.total_importe || 0)}</div>
                </div>
                <div class="bsq-kpi">
                    <div class="bsq-kpi-label">${escapeHTML(t('busqueda:col_quantity'))}</div>
                    <div class="bsq-kpi-value">${Math.round(data.total_cantidad || 0)}</div>
                </div>
                <div class="bsq-kpi">
                    <div class="bsq-kpi-label">${escapeHTML(t('busqueda:results_lines') || 'Líneas')}</div>
                    <div class="bsq-kpi-value">${data.total_registros}</div>
                </div>
            </div>
        `;
    } else {
        kpiCards = `
            <div class="bsq-kpi-grid">
                <div class="bsq-kpi bsq-kpi-primary">
                    <div class="bsq-kpi-label">${escapeHTML(t('busqueda:col_total'))}</div>
                    <div class="bsq-kpi-value">${cm(data.total_importe || 0)}</div>
                </div>
                <div class="bsq-kpi">
                    <div class="bsq-kpi-label">${escapeHTML(t('busqueda:kpi_orders') || 'Pedidos')}</div>
                    <div class="bsq-kpi-value">${data.num_pedidos || 0}</div>
                </div>
                <div class="bsq-kpi">
                    <div class="bsq-kpi-label">${escapeHTML(t('busqueda:results_lines') || 'Líneas')}</div>
                    <div class="bsq-kpi-value">${data.total_registros}</div>
                </div>
            </div>
        `;
    }

    const truncatedWarning = data.truncado
        ? `<div class="bsq-warning">⚠️ ${escapeHTML(t('busqueda:truncated_warning', { shown: data.resultados.length, total: data.total_registros }))}</div>`
        : '';

    let tableHtml;
    if (isVentas) {
        tableHtml = `
            <table class="bsq-table">
                <thead>
                    <tr>
                        <th>${escapeHTML(t('busqueda:col_date'))}</th>
                        <th>${escapeHTML(t('busqueda:col_recipe'))}</th>
                        <th>${escapeHTML(t('busqueda:col_category'))}</th>
                        <th class="bsq-td-right">${escapeHTML(t('busqueda:col_quantity'))}</th>
                        <th class="bsq-td-right">${escapeHTML(t('busqueda:col_unit_price'))}</th>
                        <th class="bsq-td-right">${escapeHTML(t('busqueda:col_total'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.resultados.map(r => `
                        <tr>
                            <td class="bsq-td-muted">${escapeHTML(formatDisplayDate(r.fecha))}</td>
                            <td class="bsq-td-strong">${escapeHTML(r.receta_nombre || '—')}</td>
                            <td class="bsq-td-muted">${escapeHTML(r.categoria || '')}</td>
                            <td class="bsq-td-right">${Number(r.cantidad || 0)}</td>
                            <td class="bsq-td-right bsq-td-muted">${cm(parseFloat(r.precio_unitario) || 0)}</td>
                            <td class="bsq-td-right bsq-td-total">${cm(parseFloat(r.total) || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        tableHtml = `
            <table class="bsq-table">
                <thead>
                    <tr>
                        <th>${escapeHTML(t('busqueda:col_date'))}</th>
                        <th>${escapeHTML(t('busqueda:col_order_id'))}</th>
                        <th>${escapeHTML(t('busqueda:col_supplier'))}</th>
                        <th>${escapeHTML(t('busqueda:col_ingredient'))}</th>
                        <th>${escapeHTML(t('busqueda:col_unit'))}</th>
                        <th class="bsq-td-right">${escapeHTML(t('busqueda:col_quantity'))}</th>
                        <th class="bsq-td-right">${escapeHTML(t('busqueda:col_unit_price'))}</th>
                        <th class="bsq-td-right">${escapeHTML(t('busqueda:col_subtotal'))}</th>
                        <th>${escapeHTML(t('busqueda:col_status'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.resultados.map(r => `
                        <tr>
                            <td class="bsq-td-muted">${escapeHTML(formatDisplayDate(r.fecha))}</td>
                            <td class="bsq-td-muted">#${escapeHTML(String(r.pedido_id || ''))}</td>
                            <td>${escapeHTML(r.proveedor_nombre || '—')}</td>
                            <td class="bsq-td-strong">${escapeHTML(r.ingrediente_nombre || '—')}</td>
                            <td class="bsq-td-muted">${escapeHTML(r.unidad || '')}</td>
                            <td class="bsq-td-right">${Number(r.cantidad || 0)}</td>
                            <td class="bsq-td-right bsq-td-muted">${cm(parseFloat(r.precio_unitario) || 0)}</td>
                            <td class="bsq-td-right bsq-td-total">${cm(parseFloat(r.subtotal) || 0)}</td>
                            <td>${renderStatusBadge(r.estado)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    resultsEl.innerHTML = `
        ${kpiCards}
        ${truncatedWarning}
        <div class="bsq-table-wrap">
            ${tableHtml}
        </div>
    `;
}

function renderStatusBadge(estado) {
    if (!estado) return '';
    const e = String(estado).toLowerCase();
    let cls = 'bsq-badge';
    if (e === 'recibido' || e === 'received') cls += ' bsq-badge-success';
    else if (e === 'pendiente' || e === 'pending') cls += ' bsq-badge-warning';
    else if (e === 'cancelado' || e === 'canceled' || e === 'cancelled') cls += ' bsq-badge-danger';
    else cls += ' bsq-badge-muted';
    return `<span class="${cls}">${escapeHTML(estado)}</span>`;
}

async function doExport() {
    const data = state.lastResult;
    if (!data || !data.resultados || data.resultados.length === 0) {
        return;
    }

    try {
        const isVentas = data.tipo === 'ventas';
        const today = new Date().toISOString().split('T')[0];
        const sheetKey = isVentas ? 'excel_sheet_sales' : 'excel_sheet_purchases';
        const fileKey = isVentas ? 'excel_filename_sales' : 'excel_filename_purchases';
        const filename = `${t('busqueda:' + fileKey)}_${data.periodo.desde}_to_${data.periodo.hasta}_${today}`;

        // Map raw rows to friendly column headers in the current language
        const rows = isVentas
            ? data.resultados.map(r => ({
                [t('busqueda:col_date')]: formatDisplayDate(r.fecha),
                [t('busqueda:col_recipe')]: r.receta_nombre || '',
                [t('busqueda:col_category')]: r.categoria || '',
                [t('busqueda:col_quantity')]: Number(r.cantidad || 0),
                [t('busqueda:col_unit_price')]: parseFloat(r.precio_unitario) || 0,
                [t('busqueda:col_total')]: parseFloat(r.total) || 0
            }))
            : data.resultados.map(r => ({
                [t('busqueda:col_date')]: formatDisplayDate(r.fecha),
                [t('busqueda:col_order_id')]: r.pedido_id || '',
                [t('busqueda:col_supplier')]: r.proveedor_nombre || '',
                [t('busqueda:col_ingredient')]: r.ingrediente_nombre || '',
                [t('busqueda:col_unit')]: r.unidad || '',
                [t('busqueda:col_quantity')]: Number(r.cantidad || 0),
                [t('busqueda:col_unit_price')]: parseFloat(r.precio_unitario) || 0,
                [t('busqueda:col_subtotal')]: parseFloat(r.subtotal) || 0,
                [t('busqueda:col_status')]: r.estado || ''
            }));

        await exportToExcel(rows, filename, {
            sheetName: t('busqueda:' + sheetKey),
            columnWidths: isVentas ? [12, 35, 16, 10, 14, 14] : [12, 10, 25, 30, 10, 10, 14, 14, 14]
        });
    } catch (err) {
        logger.error('Búsqueda: export failed', err);
        window.showToast?.(t('busqueda:error_generic'), 'error');
    }
}

// Expose to window so cambiarTab() in core.js can call it
if (typeof window !== 'undefined') {
    window.renderizarBusqueda = renderizarBusqueda;
}
