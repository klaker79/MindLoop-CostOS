/**
 * Módulo Principios de Omnes (D5).
 *
 * Consume `/api/analysis/omnes` (cacheado en analisis-state.js) y pinta
 * 3 cards de salud de la carta + 1 banner de recomendación global.
 *
 * Cards:
 *   - Dispersión: precio_max / precio_min. Ideal ≤ 2.5.
 *   - Amplitud: distribución % baja/media/alta. Ideal 25/50/25.
 *   - Calidad-Precio: ratio vendido/ofertado. Ideal 0.95-1.05.
 *
 * Namespace CSS: .oms-
 */

import { getOmnes } from './analisis-state.js';
import { escapeHTML, cm } from '../../utils/helpers.js';

const HOST_ID = 'analisis-omnes';

function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    // Insertar DEBAJO del BCG (matriz-bcg.js usa #bcg-matrix-container-v2).
    const bcgV2 = document.getElementById('bcg-matrix-container-v2');
    const contenido = document.getElementById('analisis-contenido');
    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'chart-card';
    host.style.marginTop = '16px';
    if (bcgV2 && bcgV2.parentNode) {
        bcgV2.parentNode.insertBefore(host, bcgV2.nextSibling);
    } else if (contenido) {
        contenido.appendChild(host);
    }
    return host;
}

const ESTADO_DISPERSION = {
    ok: { label: 'Equilibrada', cls: 'oms-badge--ok' },
    alta: { label: 'Alta', cls: 'oms-badge--warn' },
    muy_alta: { label: 'Muy alta', cls: 'oms-badge--bad' },
    sin_datos: { label: 'Sin datos', cls: 'oms-badge--mute' }
};

const ESTADO_AMPLITUD = {
    equilibrada: { label: 'Equilibrada', cls: 'oms-badge--ok' },
    desbalance: { label: 'Desbalance', cls: 'oms-badge--warn' },
    muy_desbalanceada: { label: 'Muy desbalanceada', cls: 'oms-badge--bad' },
    sin_datos: { label: 'Sin datos', cls: 'oms-badge--mute' }
};

const ESTADO_CALIDAD = {
    equilibrado: { label: 'Equilibrada', cls: 'oms-badge--ok' },
    bajan: { label: 'Tirón hacia abajo', cls: 'oms-badge--warn' },
    suben: { label: 'Tirón hacia arriba', cls: 'oms-badge--warn' },
    sin_datos: { label: 'Sin datos', cls: 'oms-badge--mute' },
    sin_ventas: { label: 'Sin ventas', cls: 'oms-badge--mute' }
};

function badgeHTML(map, estado) {
    const e = map[estado] || map.sin_datos;
    return `<span class="oms-badge ${e.cls}">${escapeHTML(e.label)}</span>`;
}

function cardDispersion(d) {
    if (!d || d.estado === 'sin_datos') {
        return `
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Dispersión</h4>
                    ${badgeHTML(ESTADO_DISPERSION, 'sin_datos')}
                </div>
                <div class="oms-card__value oms-card__value--mute">—</div>
                <p class="oms-card__hint">No hay platos suficientes para calcular dispersión.</p>
            </div>
        `;
    }
    const valor = `${d.valor.toFixed(2)}×`;
    const ideal = 'Ideal ≤ 2,5×';
    return `
        <div class="oms-card">
            <div class="oms-card__head">
                <h4 class="oms-card__title">Dispersión</h4>
                ${badgeHTML(ESTADO_DISPERSION, d.estado)}
            </div>
            <div class="oms-card__value">${escapeHTML(valor)}</div>
            <p class="oms-card__sub">${escapeHTML(ideal)} · plato más caro / plato más barato</p>
            <div class="oms-meta">
                <div class="oms-meta__row">
                    <span class="oms-meta__label">Máx</span>
                    <span class="oms-meta__value">${cm(d.precio_max)}</span>
                    <span class="oms-meta__name" title="${escapeHTML(d.plato_max || '')}">${escapeHTML(d.plato_max || '—')}</span>
                </div>
                <div class="oms-meta__row">
                    <span class="oms-meta__label">Mín</span>
                    <span class="oms-meta__value">${cm(d.precio_min)}</span>
                    <span class="oms-meta__name" title="${escapeHTML(d.plato_min || '')}">${escapeHTML(d.plato_min || '—')}</span>
                </div>
            </div>
        </div>
    `;
}

function cardAmplitud(a) {
    if (!a || a.estado === 'sin_datos') {
        return `
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Amplitud de gama</h4>
                    ${badgeHTML(ESTADO_AMPLITUD, 'sin_datos')}
                </div>
                <div class="oms-card__value oms-card__value--mute">—</div>
                <p class="oms-card__hint">Necesitamos al menos 2 platos para calcular la distribución.</p>
            </div>
        `;
    }
    const valor = `${a.baja_pct}/${a.media_pct}/${a.alta_pct}`;
    return `
        <div class="oms-card">
            <div class="oms-card__head">
                <h4 class="oms-card__title">Amplitud de gama</h4>
                ${badgeHTML(ESTADO_AMPLITUD, a.estado)}
            </div>
            <div class="oms-card__value">${escapeHTML(valor)}</div>
            <p class="oms-card__sub">Ideal 25/50/25 · ${a.total_platos} platos · desviación ${a.desviacion} pts</p>
            <div class="oms-bars">
                <div class="oms-bars__row">
                    <span class="oms-bars__label">Baja</span>
                    <div class="oms-bars__track"><div class="oms-bars__fill oms-bars__fill--baja" style="width:${a.baja_pct}%"></div></div>
                    <span class="oms-bars__pct">${a.baja_pct}%</span>
                </div>
                <div class="oms-bars__row">
                    <span class="oms-bars__label">Media</span>
                    <div class="oms-bars__track"><div class="oms-bars__fill oms-bars__fill--media" style="width:${a.media_pct}%"></div></div>
                    <span class="oms-bars__pct">${a.media_pct}%</span>
                </div>
                <div class="oms-bars__row">
                    <span class="oms-bars__label">Alta</span>
                    <div class="oms-bars__track"><div class="oms-bars__fill oms-bars__fill--alta" style="width:${a.alta_pct}%"></div></div>
                    <span class="oms-bars__pct">${a.alta_pct}%</span>
                </div>
            </div>
        </div>
    `;
}

function cardCalidadPrecio(c) {
    if (!c || c.estado === 'sin_datos') {
        return `
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Calidad-precio</h4>
                    ${badgeHTML(ESTADO_CALIDAD, 'sin_datos')}
                </div>
                <div class="oms-card__value oms-card__value--mute">—</div>
                <p class="oms-card__hint">No hay platos para calcular relación calidad-precio.</p>
            </div>
        `;
    }
    if (c.estado === 'sin_ventas') {
        return `
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Calidad-precio</h4>
                    ${badgeHTML(ESTADO_CALIDAD, 'sin_ventas')}
                </div>
                <div class="oms-card__value oms-card__value--mute">—</div>
                <p class="oms-card__hint">No hay ventas en este periodo para calcular ratio vendido/ofertado.</p>
                <div class="oms-meta">
                    <div class="oms-meta__row">
                        <span class="oms-meta__label">Ofertado medio</span>
                        <span class="oms-meta__value">${cm(c.ofertado)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    const valor = `${c.ratio.toFixed(2)}×`;
    return `
        <div class="oms-card">
            <div class="oms-card__head">
                <h4 class="oms-card__title">Calidad-precio</h4>
                ${badgeHTML(ESTADO_CALIDAD, c.estado)}
            </div>
            <div class="oms-card__value">${escapeHTML(valor)}</div>
            <p class="oms-card__sub">Ideal 0,95 – 1,05× · vendido / ofertado</p>
            <div class="oms-meta">
                <div class="oms-meta__row">
                    <span class="oms-meta__label">Ofertado</span>
                    <span class="oms-meta__value">${cm(c.ofertado)}</span>
                    <span class="oms-meta__name">medio carta</span>
                </div>
                <div class="oms-meta__row">
                    <span class="oms-meta__label">Vendido</span>
                    <span class="oms-meta__value">${cm(c.vendido)}</span>
                    <span class="oms-meta__name">ticket medio plato</span>
                </div>
                <div class="oms-meta__row">
                    <span class="oms-meta__label">Unidades</span>
                    <span class="oms-meta__value">${(c.unidades_vendidas || 0).toLocaleString('es-ES')}</span>
                    <span class="oms-meta__name">en el periodo</span>
                </div>
            </div>
        </div>
    `;
}

function recomendacionHTML(texto) {
    if (!texto) return '';
    return `
        <div class="oms-recom">
            <div class="oms-recom__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
            </div>
            <div class="oms-recom__body">
                <div class="oms-recom__label">Recomendación global</div>
                <p class="oms-recom__text">${escapeHTML(texto)}</p>
            </div>
        </div>
    `;
}

function skeletonHTML() {
    return `
        <div class="oms-header">
            <div>
                <h3 class="oms-title">Principios de Omnes</h3>
                <p class="oms-subtitle">Diagnóstico de la estrategia de carta — calculando…</p>
            </div>
        </div>
        <div class="oms-cards">
            <div class="oms-card oms-card--skeleton"></div>
            <div class="oms-card oms-card--skeleton"></div>
            <div class="oms-card oms-card--skeleton"></div>
        </div>
    `;
}

function errorHTML(msg) {
    return `
        <div class="oms-header">
            <div>
                <h3 class="oms-title">Principios de Omnes</h3>
                <p class="oms-subtitle">No se pudieron calcular los Principios de Omnes.</p>
            </div>
        </div>
        <div class="oms-error">${escapeHTML(msg || 'Error desconocido')}</div>
    `;
}

/**
 * Renderiza el bloque completo. Se llama desde el orchestrator después
 * del BCG. Si falla por cualquier motivo, deja el host con un mensaje
 * de error pero NO rompe el resto del módulo.
 */
export async function renderOmnes() {
    const host = ensureHost();
    if (!host) return;
    host.innerHTML = skeletonHTML();
    try {
        const data = await getOmnes();
        if (!data) {
            host.innerHTML = errorHTML('Sin datos del backend');
            return;
        }
        host.innerHTML = `
            <div class="oms-header">
                <div>
                    <h3 class="oms-title">Principios de Omnes</h3>
                    <p class="oms-subtitle">Diagnóstico de la estrategia de carta · dispersión, amplitud y calidad-precio.</p>
                </div>
            </div>
            <div class="oms-cards">
                ${cardDispersion(data.dispersion)}
                ${cardAmplitud(data.amplitud)}
                ${cardCalidadPrecio(data.calidad_precio)}
            </div>
            ${recomendacionHTML(data.recomendacion_global)}
        `;
    } catch (err) {
        console.warn('[analisis] omnes falló:', err?.message);
        host.innerHTML = errorHTML(err?.message || 'Error desconocido');
    }
}

if (typeof window !== 'undefined') {
    window.mlAnalisisOmnesRender = renderOmnes;
}
