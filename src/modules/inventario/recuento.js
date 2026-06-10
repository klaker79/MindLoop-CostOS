/**
 * Recuento de inventario — contador digital sencillo, pensado para MÓVIL.
 *
 * El usuario va por la cámara/almacén tecleando lo que cuenta de cada ingrediente.
 * Al confirmar, reconcilia el stock REUTILIZANDO EXACTAMENTE el mismo camino que el
 * import Excel (`confirmarInventarioMasivo`):
 *   - cuenta < sistema  → se registra una MERMA ("Ajuste de inventario") vía createMermas
 *   - cuenta ≥ sistema  → ajuste al alza vía consolidateStock
 * Backend: CERO cambios. Aislado: no toca ningún módulo existente.
 *
 * Tono deliberadamente tranquilo: sin rojos ni avisos por línea. Solo un resumen
 * neutro antes de confirmar.
 */
import { t } from '@/i18n/index.js';
import { escapeHTML, formatQuantity, cm } from '../../utils/helpers.js';

// Conteos en curso: { [ingredienteId]: numero }. Persistido en localStorage
// (tenant-scoped) para poder "guardar y seguir luego".
let conteos = {};
let familiaSel = 'todas';

function restauranteId() {
    try { return JSON.parse(localStorage.getItem('user') || '{}').restauranteId || 'x'; }
    catch { return 'x'; }
}
function storageKey() { return `recuento_inventario_${restauranteId()}`; }

function cargarParcial() {
    try {
        const raw = localStorage.getItem(storageKey());
        conteos = raw ? (JSON.parse(raw).conteos || {}) : {};
    } catch { conteos = {}; }
}
function guardarParcial() {
    try { localStorage.setItem(storageKey(), JSON.stringify({ conteos, ts: Date.now() })); }
    catch { /* sin persistencia, no es crítico */ }
}
function limpiarParcial() {
    conteos = {};
    try { localStorage.removeItem(storageKey()); } catch { /* noop */ }
}

/** Lista base: ingredientes activos con su stock de sistema, unidad, familia y precio. */
function ingredientesParaContar() {
    const invMap = new Map((window.inventarioCompleto || []).map(i => [i.id, i]));
    return (window.ingredientes || [])
        .map(ing => {
            const inv = invMap.get(ing.id) || {};
            // Precio unitario (€/unidad-base) con la prioridad estándar de la app,
            // idéntica a confirmarInventarioMasivo.
            let precio = parseFloat(inv.precio_medio_compra) || 0;
            if (!precio) precio = parseFloat(inv.precio_medio) || 0;
            if (!precio && ing.precio && ing.cantidad_por_formato > 0) {
                precio = parseFloat(ing.precio) / parseFloat(ing.cantidad_por_formato);
            }
            return {
                id: ing.id,
                nombre: ing.nombre || `#${ing.id}`,
                unidad: ing.unidad || 'ud',
                familia: (ing.familia || '').trim() || 'otros',
                stockSistema: parseFloat(ing.stock_actual ?? ing.stock_virtual ?? 0) || 0,
                precio
            };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

function familiasDisponibles(items) {
    return [...new Set(items.map(i => i.familia))].sort((a, b) => a.localeCompare(b, 'es'));
}

function contadosCount() {
    return Object.values(conteos).filter(v => Number.isFinite(v)).length;
}

/** Abre el recuento (overlay a pantalla completa). */
export function abrirRecuentoInventario() {
    cargarParcial();
    familiaSel = 'todas';
    let overlay = document.getElementById('recuento-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'recuento-overlay';
        // Listener delegado (sobrevive a los re-render de innerHTML): los chips de
        // familia pasan su valor por dataset, nunca por JS inline.
        overlay.addEventListener('click', (e) => {
            const chip = e.target.closest('.recuento-chip');
            if (chip) filtrarRecuentoFamilia(chip.dataset.familia || 'todas');
        });
        document.body.appendChild(overlay);
    }
    renderRecuento();
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

export function cerrarRecuento() {
    const overlay = document.getElementById('recuento-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

export function filtrarRecuentoFamilia(familia) {
    familiaSel = familia;
    renderRecuento();
}

/** Guarda el número contado de una línea. NO re-renderiza (no perder el foco). */
export function setConteo(id, valor) {
    const v = parseFloat(valor);
    if (Number.isFinite(v) && v >= 0) conteos[id] = v;
    else delete conteos[id];
    guardarParcial();
    // Actualizar solo el contador de progreso y la marca de la fila, sin re-render.
    const items = ingredientesParaContar();
    const visibles = familiaSel === 'todas' ? items : items.filter(i => i.familia === familiaSel);
    const prog = document.getElementById('recuento-progreso');
    if (prog) {
        const hechos = visibles.filter(i => Number.isFinite(conteos[i.id])).length;
        prog.textContent = `${hechos}/${visibles.length}`;
        const barra = document.getElementById('recuento-barra');
        if (barra) barra.style.width = `${visibles.length ? Math.round(hechos / visibles.length * 100) : 0}%`;
    }
    const marca = document.getElementById(`recuento-marca-${id}`);
    if (marca) marca.textContent = Number.isFinite(conteos[id]) ? `· ${t('recuento:counted')}` : '';
}

export function guardarYSeguir() {
    guardarParcial();
    window.showToast?.(t('recuento:saved_partial'), 'success');
    cerrarRecuento();
}

function renderRecuento() {
    const overlay = document.getElementById('recuento-overlay');
    if (!overlay) return;

    const items = ingredientesParaContar();
    const familias = familiasDisponibles(items);
    const visibles = familiaSel === 'todas' ? items : items.filter(i => i.familia === familiaSel);
    const hechos = visibles.filter(i => Number.isFinite(conteos[i.id])).length;
    const pct = visibles.length ? Math.round(hechos / visibles.length * 100) : 0;

    // Chips por familia: data-familia (HTML-escapado) + listener delegado en el
    // overlay. NO se construye JS inline con datos → sin riesgo de XSS por familia.
    const chips = ['todas', ...familias].map(f => {
        const activo = f === familiaSel;
        const label = f === 'todas' ? t('recuento:all_families') : f;
        return `<button type="button" class="recuento-chip" data-familia="${escapeHTML(f)}"
            style="border:1px solid ${activo ? '#0284c7' : '#cbd5e1'};background:${activo ? '#0284c7' : '#fff'};
            color:${activo ? '#fff' : '#475569'};border-radius:999px;padding:6px 14px;font-size:13px;
            font-weight:600;white-space:nowrap;cursor:pointer;text-transform:capitalize;">${escapeHTML(label)}</button>`;
    }).join('');

    const filas = visibles.map(it => {
        const val = Number.isFinite(conteos[it.id]) ? conteos[it.id] : '';
        const contado = Number.isFinite(conteos[it.id]);
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 4px;border-bottom:1px solid #f1f5f9;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(it.nombre)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:2px;">
              ${t('recuento:system_was')} ${escapeHTML(formatQuantity(it.stockSistema))} ${escapeHTML(it.unidad)}
              <span id="recuento-marca-${it.id}" style="color:#64748b;margin-left:6px;">${contado ? `· ${t('recuento:counted')}` : ''}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="number" inputmode="decimal" step="0.01" min="0" value="${val}"
              onchange="window.setConteoRecuento(${it.id}, this.value)"
              style="width:84px;padding:12px 10px;border:1.5px solid #cbd5e1;border-radius:10px;
              text-align:center;font-size:17px;font-weight:600;color:#0f172a;">
            <span style="font-size:13px;color:#64748b;min-width:26px;">${escapeHTML(it.unidad)}</span>
          </div>
        </div>`;
    }).join('');

    overlay.innerHTML = `
      <div style="position:fixed;inset:0;background:#fff;z-index:9999;display:flex;flex-direction:column;">
        <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;">
          <button onclick="window.cerrarRecuento()" style="background:none;border:none;font-size:22px;color:#475569;cursor:pointer;padding:0 4px;">←</button>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:16px;color:#0f172a;">${t('recuento:title')}</div>
            <div style="font-size:12px;color:#94a3b8;"><span id="recuento-progreso">${hechos}/${visibles.length}</span> ${t('recuento:counted_plural')}</div>
          </div>
        </div>
        <div style="height:4px;background:#e2e8f0;"><div id="recuento-barra" style="height:100%;width:${pct}%;background:#0ea5e9;transition:width .2s;"></div></div>
        <div style="display:flex;gap:8px;overflow-x:auto;padding:12px 16px;border-bottom:1px solid #f1f5f9;">${chips}</div>
        <div style="flex:1;overflow-y:auto;padding:4px 16px 16px;">
          ${visibles.length ? filas : `<p style="text-align:center;color:#94a3b8;padding:40px 0;">${t('recuento:empty')}</p>`}
        </div>
        <div style="padding:12px 16px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
          <button onclick="window.guardarYSeguirRecuento()" style="flex:1;padding:14px;border:1.5px solid #cbd5e1;background:#fff;color:#475569;border-radius:12px;font-weight:600;font-size:15px;cursor:pointer;">${t('recuento:save_continue')}</button>
          <button onclick="window.revisarRecuento()" style="flex:1;padding:14px;border:none;background:#0284c7;color:#fff;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;">${t('recuento:review')} (${contadosCount()})</button>
        </div>
      </div>`;
}

/** Construye los ajustes (mismo formato que confirmarInventarioMasivo) y los datos del resumen. */
function calcularAjustes() {
    const items = ingredientesParaContar();
    const mermas = [];
    const subidas = [];
    let igual = 0;
    const hoy = new Date().toLocaleDateString('es-ES');

    for (const it of items) {
        const real = conteos[it.id];
        if (!Number.isFinite(real)) continue; // no contado → no se toca
        const sistema = it.stockSistema;
        if (Math.abs(real - sistema) < 0.0001) { igual++; continue; }
        if (real < sistema) {
            const cantidad = +(sistema - real).toFixed(4);
            mermas.push({
                ingredienteId: it.id,
                ingredienteNombre: it.nombre,
                cantidad,
                unidad: it.unidad,
                valorPerdida: +(cantidad * it.precio).toFixed(2),
                motivo: 'Ajuste de inventario',
                nota: `Recuento — ${hoy}`,
                _de: sistema, _a: real
            });
        } else {
            subidas.push({ id: it.id, stock_real: real, _nombre: it.nombre, _de: sistema, _a: real });
        }
    }
    return { mermas, subidas, igual };
}

export function revisarRecuento() {
    const { mermas, subidas, igual } = calcularAjustes();
    if (mermas.length === 0 && subidas.length === 0) {
        window.showToast?.(t('recuento:nothing_to_apply'), 'warning');
        return;
    }
    const valorMermas = mermas.reduce((s, m) => s + m.valorPerdida, 0);
    const linea = (x, color) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:${color};">
        <span>${escapeHTML(x._nombre || x.ingredienteNombre)}</span>
        <span>${escapeHTML(formatQuantity(x._de))} → ${escapeHTML(formatQuantity(x._a))}</span></div>`;

    let modal = document.getElementById('recuento-confirm');
    if (!modal) { modal = document.createElement('div'); modal.id = 'recuento-confirm'; document.body.appendChild(modal); }
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;">
        <div style="background:#fff;width:100%;max-width:560px;border-radius:18px 18px 0 0;max-height:85vh;display:flex;flex-direction:column;">
          <div style="padding:18px 20px 8px;">
            <h3 style="margin:0;font-size:18px;color:#0f172a;">${t('recuento:summary_title')}</h3>
            <p style="margin:6px 0 0;font-size:13px;color:#64748b;">
              ${subidas.length} ${t('recuento:go_up')} · ${mermas.length} ${t('recuento:go_down')} · ${igual} ${t('recuento:unchanged')}
            </p>
          </div>
          <div style="flex:1;overflow-y:auto;padding:8px 20px;">
            ${subidas.length ? `<div style="font-size:12px;font-weight:700;color:#0284c7;margin:8px 0 2px;">${t('recuento:go_up').toUpperCase()}</div>${subidas.map(s => linea(s, '#334155')).join('')}` : ''}
            ${mermas.length ? `<div style="font-size:12px;font-weight:700;color:#64748b;margin:12px 0 2px;">${t('recuento:go_down').toUpperCase()}</div>${mermas.map(m => linea(m, '#334155')).join('')}
              <p style="font-size:12px;color:#94a3b8;margin:10px 0 0;">${t('recuento:down_as_waste')}${valorMermas > 0 ? ` (~${cm(valorMermas)})` : ''}.</p>` : ''}
          </div>
          <div style="padding:14px 20px;border-top:1px solid #e2e8f0;display:flex;gap:10px;">
            <button onclick="window.cerrarConfirmRecuento()" style="flex:1;padding:13px;border:1.5px solid #cbd5e1;background:#fff;color:#475569;border-radius:12px;font-weight:600;cursor:pointer;">${t('recuento:cancel')}</button>
            <button onclick="window.confirmarRecuento()" style="flex:1;padding:13px;border:none;background:#0284c7;color:#fff;border-radius:12px;font-weight:700;cursor:pointer;">${t('recuento:confirm')}</button>
          </div>
        </div>
      </div>`;
    modal.style.display = 'block';
}

export function cerrarConfirmRecuento() {
    const m = document.getElementById('recuento-confirm');
    if (m) m.style.display = 'none';
}

export async function confirmarRecuento() {
    const { mermas, subidas } = calcularAjustes();
    cerrarConfirmRecuento();
    window.showLoading?.();
    try {
        // MISMO camino probado que el import Excel:
        if (mermas.length > 0) {
            await window.api.createMermas(mermas.map(m => ({
                ingredienteId: m.ingredienteId, ingredienteNombre: m.ingredienteNombre,
                cantidad: m.cantidad, unidad: m.unidad, valorPerdida: m.valorPerdida,
                motivo: m.motivo, nota: m.nota
            })));
        }
        if (subidas.length > 0) {
            await window.api.consolidateStock([], [], subidas.map(s => ({ id: s.id, stock_real: s.stock_real })));
        }
        limpiarParcial();
        await window.cargarDatos?.();
        window.renderizarInventario?.();
        window.hideLoading?.();
        cerrarRecuento();
        window.showToast?.(t('recuento:done'), 'success');
    } catch (err) {
        window.hideLoading?.();
        console.error('Error confirmando recuento:', err);
        window.showToast?.(t('recuento:error') + ': ' + err.message, 'error');
    }
}

// El botón "📋 Recuento" del Inventario solo se muestra en móvil (en index.html
// va con display:none). Escritorio queda EXACTAMENTE igual que antes.
if (typeof document !== 'undefined' && !document.getElementById('recuento-css')) {
    const st = document.createElement('style');
    st.id = 'recuento-css';
    st.textContent = '@media (max-width: 820px){ #btn-recuento-inventario{ display:inline-flex !important; } }';
    document.head.appendChild(st);
}

if (typeof window !== 'undefined') {
    window.abrirRecuentoInventario = abrirRecuentoInventario;
    window.cerrarRecuento = cerrarRecuento;
    window.filtrarRecuentoFamilia = filtrarRecuentoFamilia;
    window.setConteoRecuento = setConteo;
    window.guardarYSeguirRecuento = guardarYSeguir;
    window.revisarRecuento = revisarRecuento;
    window.cerrarConfirmRecuento = cerrarConfirmRecuento;
    window.confirmarRecuento = confirmarRecuento;
}
