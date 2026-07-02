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
import { mostrarOmnesInfo } from './omnes-info.js';

const HOST_ID = 'analisis-omnes';

function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    // Insertar DEBAJO del BCG (matriz-bcg.js monta su host como #analisis-matriz-bcg-v2;
    // fix auditoría 2026-07-02: antes buscaba 'bcg-matrix-container-v2', que no existe,
    // y el panel caía siempre al fallback de appendChild).
    const bcgV2 = document.getElementById('analisis-matriz-bcg-v2');
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

/* ===== Consejos por card ============================================
 * Cada función devuelve { tono, titulo, texto } adaptado al estado real
 * y los números concretos del backend. NO son frases plantilla: usan
 * nombres de platos, precios y porcentajes reales.
 *
 * tono ∈ 'ok' | 'warn' | 'bad' | 'mute'  (mapea a colores oms-tip--*)
 * ====================================================================*/

function consejoDispersion(d) {
    if (!d || d.estado === 'sin_datos') {
        return { tono: 'mute', titulo: 'Sin datos', texto: 'Añade más platos a la carta para poder medir la dispersión.' };
    }
    if (d.estado === 'ok') {
        return { tono: 'ok', titulo: 'Dispersión sana', texto: `Tu plato más caro vale ${d.valor.toFixed(2)}× el más barato — dentro del ideal (≤ 2,5×). Mantén la estructura.` };
    }
    const palancas = [];
    palancas.push(`mueve "${d.plato_max}" (${cm(d.precio_max)}) a sugerencias del día`);
    palancas.push(`sube 50 cts – 1 € los más baratos como "${d.plato_min}" (${cm(d.precio_min)})`);
    if (d.estado === 'alta') {
        return {
            tono: 'warn',
            titulo: 'Reduce la brecha',
            texto: `Tienes ${d.valor.toFixed(2)}× de diferencia entre extremos (ideal ≤ 2,5×). Quita 1-2 platos del extremo caro o ${palancas[1]}. Objetivo: bajar a ≤ 2,5×.`
        };
    }
    // muy_alta
    return {
        tono: 'bad',
        titulo: 'Brecha demasiado grande',
        texto: `${d.valor.toFixed(2)}× de diferencia entre "${d.plato_max}" (${cm(d.precio_max)}) y "${d.plato_min}" (${cm(d.precio_min)}). Acércate al ideal ≤ 2,5×: ${palancas[0]} y ${palancas[1]}.`
    };
}

function consejoAmplitud(a) {
    if (!a || a.estado === 'sin_datos') {
        return { tono: 'mute', titulo: 'Sin datos', texto: 'Necesitas al menos 2 platos para medir la amplitud de gama.' };
    }
    if (a.estado === 'equilibrada') {
        return { tono: 'ok', titulo: 'Distribución equilibrada', texto: `${a.baja_pct}/${a.media_pct}/${a.alta_pct} sobre ${a.total_platos} platos. Cerca del ideal 25/50/25. Mantén.` };
    }
    // Detectar qué gama está sobre-representada para personalizar el consejo
    const ideal = { baja: 25, media: 50, alta: 25 };
    const exceso = {
        baja: a.baja_pct - ideal.baja,
        media: a.media_pct - ideal.media,
        alta: a.alta_pct - ideal.alta
    };
    const maxExceso = Object.keys(exceso).reduce((acc, k) => exceso[k] > exceso[acc] ? k : acc, 'baja');
    let palanca = '';
    if (maxExceso === 'media') {
        palanca = `Tienes el ${a.media_pct}% en gama media. Mete 1-2 platos en gama baja (para atraer) y 1-2 en gama alta (para subir ticket).`;
    } else if (maxExceso === 'baja') {
        palanca = `Tienes el ${a.baja_pct}% en gama baja — regalas margen. Sube precios 50 cts – 1 € o reduce 1-2 baratos para forzar el upsell.`;
    } else {
        palanca = `Tienes el ${a.alta_pct}% en gama alta. Mete 2-3 opciones de gama media para que el cliente medio tenga dónde caer y no se vaya al barato.`;
    }
    const tituloEstado = a.estado === 'muy_desbalanceada' ? 'Carta muy desbalanceada' : 'Carta con desbalance';
    return {
        tono: a.estado === 'muy_desbalanceada' ? 'bad' : 'warn',
        titulo: tituloEstado,
        texto: `${palanca} Objetivo: acercarte a 25/50/25.`
    };
}

function consejoCalidadPrecio(c) {
    if (!c || c.estado === 'sin_datos') {
        return { tono: 'mute', titulo: 'Sin datos', texto: 'No hay platos activos para calcular la relación calidad-precio.' };
    }
    if (c.estado === 'sin_ventas') {
        return { tono: 'mute', titulo: 'Sin ventas en el periodo', texto: 'No hay ventas en el periodo seleccionado. Amplía el rango (mes / trimestre) para ver el ratio real.' };
    }
    if (c.estado === 'equilibrado') {
        return { tono: 'ok', titulo: 'Estrategia equilibrada', texto: `Tus clientes piden de media ${cm(c.vendido)} y tu carta ofrece de media ${cm(c.ofertado)}. Lo que vendes coincide con lo que ofreces — estrategia perfecta.` };
    }
    if (c.estado === 'bajan') {
        return {
            tono: 'warn',
            titulo: 'Tirón hacia abajo',
            texto: `Tus clientes piden de media ${cm(c.vendido)} aunque ofreces de media ${cm(c.ofertado)} (ratio ${c.ratio.toFixed(2)}×). Sube precios medios un 5-7% o quita 1-2 platos baratos para forzar el upsell.`
        };
    }
    // suben
    return {
        tono: 'warn',
        titulo: 'Tirón hacia arriba',
        texto: `Tus clientes piden de media ${cm(c.vendido)} aunque ofreces de media ${cm(c.ofertado)} (ratio ${c.ratio.toFixed(2)}×). Mete más opciones de gama media para no perder al cliente prudente.`
    };
}

function tipHTML(tip) {
    if (!tip) return '';
    return `
        <div class="oms-tip oms-tip--${tip.tono}">
            <div class="oms-tip__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
            </div>
            <div class="oms-tip__body">
                <div class="oms-tip__label">${escapeHTML(tip.titulo)}</div>
                <p class="oms-tip__text">${escapeHTML(tip.texto)}</p>
            </div>
        </div>
    `;
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
                ${tipHTML(consejoDispersion(d))}
            </div>
        `;
    }
    const valor = `${d.valor.toFixed(2)}×`;
    const ideal = 'Ideal ≤ 2,5×';
    // Iker 2026-06-09: el backend ya excluye categorías "no plato" (pincho,
    // aperitivo, tapa, extra, guarnición, aceite, bebidas, suministros, base)
    // antes de calcular dispersión. Aquí solo mostramos el ratio limpio.
    const subtituloRango = `${escapeHTML(ideal)} · plato más caro / plato más barato`;
    return `
        <div class="oms-card">
            <div class="oms-card__head">
                <h4 class="oms-card__title">Dispersión</h4>
                ${badgeHTML(ESTADO_DISPERSION, d.estado)}
            </div>
            <div class="oms-card__value">${escapeHTML(valor)}</div>
            <p class="oms-card__sub">${subtituloRango}</p>
            <div class="oms-extremos">
                <div class="oms-extremos__col">
                    <div class="oms-extremos__head">🔺 3 más caros</div>
                    ${(d.mas_caros || []).map(p => `<div class="oms-extremos__row"><span class="oms-extremos__price">${cm(p.precio)}</span><span class="oms-extremos__name" title="${escapeHTML(p.nombre || '')}">${escapeHTML(p.nombre || '—')}</span></div>`).join('') || '<div class="oms-extremos__row"><span class="oms-extremos__name">—</span></div>'}
                </div>
                <div class="oms-extremos__col">
                    <div class="oms-extremos__head">🔻 3 más baratos</div>
                    ${(d.mas_baratos || []).map(p => `<div class="oms-extremos__row"><span class="oms-extremos__price">${cm(p.precio)}</span><span class="oms-extremos__name" title="${escapeHTML(p.nombre || '')}">${escapeHTML(p.nombre || '—')}</span></div>`).join('') || '<div class="oms-extremos__row"><span class="oms-extremos__name">—</span></div>'}
                </div>
            </div>
            ${tipHTML(consejoDispersion(d))}
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
                ${tipHTML(consejoAmplitud(a))}
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
            ${tipHTML(consejoAmplitud(a))}
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
                ${tipHTML(consejoCalidadPrecio(c))}
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
                ${tipHTML(consejoCalidadPrecio(c))}
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
            ${tipHTML(consejoCalidadPrecio(c))}
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

function bindInfoButton(host) {
    host.querySelectorAll('[data-action="oms-info"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarOmnesInfo();
        });
    });
}

const INFO_BTN_HTML = `
    <button type="button" class="oms-info-btn" data-action="oms-info" aria-label="Qué son los Principios de Omnes">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>¿Qué es esto?</span>
    </button>
`;

function skeletonHTML() {
    return `
        <div class="oms-header">
            <div>
                <h3 class="oms-title">Principios de Omnes</h3>
                <p class="oms-subtitle">Diagnóstico de la estrategia de carta — calculando…</p>
            </div>
            ${INFO_BTN_HTML}
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
            ${INFO_BTN_HTML}
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
    bindInfoButton(host);
    try {
        const data = await getOmnes();
        if (!data) {
            host.innerHTML = errorHTML('Sin datos del backend');
            bindInfoButton(host);
            return;
        }
        host.innerHTML = `
            <div class="oms-header">
                <div>
                    <h3 class="oms-title">Principios de Omnes</h3>
                    <p class="oms-subtitle">Diagnóstico de la estrategia de carta · dispersión, amplitud y calidad-precio.</p>
                </div>
                ${INFO_BTN_HTML}
            </div>
            <div class="oms-cards">
                ${cardDispersion(data.dispersion)}
                ${cardAmplitud(data.amplitud)}
                ${cardCalidadPrecio(data.calidad_precio)}
            </div>
            ${recomendacionHTML(data.recomendacion_global)}
        `;
        bindInfoButton(host);
    } catch (err) {
        console.warn('[analisis] omnes falló:', err?.message);
        host.innerHTML = errorHTML(err?.message || 'Error desconocido');
        bindInfoButton(host);
    }
}

if (typeof window !== 'undefined') {
    window.mlAnalisisOmnesRender = renderOmnes;
}
