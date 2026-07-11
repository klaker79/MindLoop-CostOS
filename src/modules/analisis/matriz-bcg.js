/**
 * Matriz BCG (Ingeniería de Menú v2).
 *
 * Scatter chart con cuadrantes coloreados + 4 listas debajo por categoría.
 * Reemplaza visualmente el contenedor `#bcg-matrix-container` del legacy
 * (que se oculta cuando este módulo monta correctamente).
 *
 * Click en cualquier punto del scatter o item de lista emite el evento
 * `analisis:plato-click` con `{ detail: { id, nombre, plato } }` para que
 * el modal drill-down (D4) lo escuche.
 *
 * Multi-tenancy y soft-delete: los datos vienen del backend ya filtrados.
 * Este módulo solo renderiza — no toca SQL.
 */

import { renderIcono, COLORES, LABELS, DESCRIPCIONES } from './iconos.js';
import { escapeHTML, cm } from '../../utils/helpers.js';
import { mostrarBcgInfo } from './bcg-info.js';

const HOST_ID = 'analisis-matriz-bcg-v2';
const SCATTER_CANVAS_ID = 'ans-bcg-scatter';

const CATEGORIAS = ['estrella', 'puzzle', 'caballo', 'perro'];

let scatterChart = null;

/**
 * Inserta el host del BCG v2 justo después del dashboard sintético
 * y antes del `#bcg-matrix-container` legacy. Si el dashboard sintético
 * no existe aún, monta al inicio de `#analisis-contenido`.
 */
function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    const legacy = document.getElementById('bcg-matrix-container');
    const sintetico = document.getElementById('analisis-dashboard-sintetico');
    const contenido = document.getElementById('analisis-contenido');
    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'chart-card';
    host.style.marginBottom = '16px';
    if (legacy && legacy.parentNode) {
        legacy.parentNode.insertBefore(host, legacy);
    } else if (sintetico && sintetico.parentNode) {
        sintetico.parentNode.insertBefore(host, sintetico.nextSibling);
    } else if (contenido) {
        contenido.appendChild(host);
    }
    return host;
}

function ocultarLegacy() {
    const legacy = document.getElementById('bcg-matrix-container');
    if (legacy) legacy.style.display = 'none';
}

function clasificacionDePlato(plato, promedios) {
    // Misma regla que el backend: estrella si popular Y rentable, etc.
    // Si el backend ya manda `clasificacion`, la usamos.
    if (plato.clasificacion) return plato.clasificacion;
    const esPopular = plato.popularidad >= (promedios.popularidad * 0.7);
    const esRentable = plato.margen >= promedios.margen;
    if (esPopular && esRentable) return 'estrella';
    if (esPopular && !esRentable) return 'caballo';
    if (!esPopular && esRentable) return 'puzzle';
    return 'perro';
}

function emitirClickPlato(plato) {
    try {
        window.dispatchEvent(new CustomEvent('analisis:plato-click', {
            detail: { id: plato.id, nombre: plato.nombre, plato }
        }));
    } catch (e) { /* noop */ }
}

/**
 * Devuelve el consejo personalizado para un cuadrante, basado en cuántos
 * platos hay y, cuando aporta, en cuál es el plato top (el primero del
 * array porque ya viene ordenado por popularidad desc).
 *
 * Tono ∈ 'ok' | 'warn' | 'bad' | 'mute'.
 */
function consejoCuadrante(categoria, platos) {
    const n = platos.length;
    const top = n > 0 ? platos[0] : null;
    const ejemploTop = top ? ` Empieza por "${top.nombre}".` : '';

    if (categoria === 'estrella') {
        if (n === 0) return { tono: 'warn', titulo: 'Sin estrellas', texto: 'Tu carta no tiene líderes claros. Coge el Puzzle más rentable y promociónalo cuatro semanas — el objetivo es convertirlo en Estrella.' };
        return { tono: 'ok', titulo: `${n} ${n === 1 ? 'estrella' : 'estrellas'}`, texto: `Protege estos platos. No subas precio sin pensar, mantén calidad y dales sitio destacado en la carta.${ejemploTop}` };
    }

    if (categoria === 'puzzle') {
        if (n === 0) return { tono: 'ok', titulo: 'Sin puzzles', texto: 'Los platos rentables ya se venden bien. Está bien — no hay margen oculto por activar.' };
        return { tono: 'warn', titulo: `${n} ${n === 1 ? 'puzzle' : 'puzzles'}`, texto: `Ganan bien pero no se venden. Posición destacada en carta, recomendación del camarero, foto en redes.${ejemploTop}` };
    }

    if (categoria === 'caballo') {
        if (n === 0) return { tono: 'ok', titulo: 'Sin caballos', texto: 'Bien: tus populares también son rentables. No hay platos con margen apretado entre los más vendidos.' };
        return { tono: 'warn', titulo: `${n} ${n === 1 ? 'caballo' : 'caballos'}`, texto: `Mucho tráfico, margen justo. Revisa proveedor, ajusta gramaje o sube 30-50 cts el precio. Cuidado al tocarlos — son los que traen al cliente.${ejemploTop}` };
    }

    // perro
    if (n === 0) return { tono: 'ok', titulo: 'Sin perros', texto: 'Bien: tu carta no arrastra platos muertos.' };
    return { tono: 'bad', titulo: `${n} ${n === 1 ? 'perro' : 'perros'}`, texto: `Ni venden ni dejan. Candidatos a retirar para hacer hueco a platos nuevos. Si alguno tiene valor estratégico (ingrediente local, identidad del local), revísalo antes de quitar.${ejemploTop}` };
}

function tipCuadranteHTML(tip) {
    if (!tip) return '';
    return `
        <div class="bcg2-tip bcg2-tip--${tip.tono}">
            <div class="bcg2-tip__icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
            </div>
            <div class="bcg2-tip__body">
                <div class="bcg2-tip__label">${escapeHTML(tip.titulo)}</div>
                <p class="bcg2-tip__text">${escapeHTML(tip.texto)}</p>
            </div>
        </div>
    `;
}

function renderListaCuadrante(categoria, platos) {
    const color = COLORES[categoria];
    const items = platos.length === 0
        ? `<div class="bcg2-empty">Sin platos en esta categoría.</div>`
        : platos.slice(0, 12).map(p => `
            <button type="button" class="bcg2-item" data-plato-id="${p.id}">
                <span class="bcg2-item__nombre">${escapeHTML(p.nombre)}</span>
                <span class="bcg2-item__margen" title="Margen de contribución por ración (precio de venta − coste real)">${cm(p.margen?.toFixed?.(2) ?? p.margen)}</span>
                <span class="bcg2-item__uds" title="Unidades vendidas en el periodo">${Math.round(p.popularidad || 0)}</span>
            </button>
        `).join('');

    const leyenda = platos.length === 0 ? '' : `
        <div class="bcg2-cuadrante__leyenda" aria-hidden="true">
            <span class="bcg2-leyenda__nombre">Plato</span>
            <span class="bcg2-leyenda__margen">Margen/ración</span>
            <span class="bcg2-leyenda__uds">Uds vendidas</span>
        </div>`;

    return `
        <div class="bcg2-cuadrante" data-cat="${categoria}" style="--cat-color:${color};">
            <header class="bcg2-cuadrante__header">
                <span class="bcg2-cuadrante__icon">${renderIcono(categoria, { size: 28 })}</span>
                <div class="bcg2-cuadrante__title-wrap">
                    <h4 class="bcg2-cuadrante__title">${LABELS[categoria]}</h4>
                    <p class="bcg2-cuadrante__hint">${DESCRIPCIONES[categoria]}</p>
                </div>
                <span class="bcg2-cuadrante__count">${platos.length}</span>
            </header>
            ${leyenda}
            <div class="bcg2-cuadrante__items">${items}</div>
            ${tipCuadranteHTML(consejoCuadrante(categoria, platos))}
        </div>
    `;
}

function renderScatter(canvas, data, promedios) {
    if (!canvas || typeof window.Chart !== 'function') return;
    if (scatterChart) { scatterChart.destroy(); scatterChart = null; }

    // Datasets: puntos con borde blanco para definición editorial. Hover
    // crece el punto y oscurece el color del borde para feedback claro.
    const puntos = CATEGORIAS.map(cat => ({
        label: LABELS[cat],
        backgroundColor: COLORES[cat],
        borderColor: 'rgba(255,255,255,0.95)',
        borderWidth: 2,
        pointRadius: 10,
        pointHoverRadius: 14,
        pointHoverBorderWidth: 3,
        data: data
            .filter(p => clasificacionDePlato(p, promedios) === cat)
            .map(p => ({ x: p.popularidad || 0, y: p.margen || 0, nombre: p.nombre, plato: p }))
    }));

    const midX = promedios.popularidad * 0.7;
    const midY = promedios.margen;

    // Plugin de cuadrantes — gradients suaves desde el centro + labels
    // editoriales en las esquinas internas con tipografía nítida.
    const quadrantPlugin = {
        id: 'bcg2Quadrants',
        beforeDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            const xMid = xAxis.getPixelForValue(midX);
            const yMid = yAxis.getPixelForValue(midY);

            // Gradients sutiles que se intensifican hacia las esquinas
            const cuadrantes = [
                { x: xMid, y: yAxis.top, w: xAxis.right - xMid, h: yMid - yAxis.top, base: [16, 185, 129] }, // estrella
                { x: xAxis.left, y: yAxis.top, w: xMid - xAxis.left, h: yMid - yAxis.top, base: [59, 130, 246] }, // puzzle
                { x: xMid, y: yMid, w: xAxis.right - xMid, h: yAxis.bottom - yMid, base: [245, 158, 11] }, // caballo
                { x: xAxis.left, y: yMid, w: xMid - xAxis.left, h: yAxis.bottom - yMid, base: [239, 68, 68] } // perro
            ];
            cuadrantes.forEach(q => {
                const grad = ctx.createLinearGradient(q.x, q.y, q.x + q.w, q.y + q.h);
                grad.addColorStop(0, `rgba(${q.base[0]},${q.base[1]},${q.base[2]},0.04)`);
                grad.addColorStop(1, `rgba(${q.base[0]},${q.base[1]},${q.base[2]},0.13)`);
                ctx.fillStyle = grad;
                ctx.fillRect(q.x, q.y, q.w, q.h);
            });

            // Líneas divisorias finas, color sutil
            ctx.strokeStyle = 'rgba(148,163,184,0.35)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(xMid, yAxis.top);
            ctx.lineTo(xMid, yAxis.bottom);
            ctx.moveTo(xAxis.left, yMid);
            ctx.lineTo(xAxis.right, yMid);
            ctx.stroke();
            ctx.setLineDash([]);

            // Labels de cuadrante en las esquinas INTERNAS, pegadas a las
            // dos líneas divisorias. Tipografía editorial uppercase, color
            // saturado del cuadrante.
            const padding = 12;
            const labels = [
                { x: xMid + padding, y: yAxis.top + padding, text: 'ESTRELLAS', color: '#047857', align: 'left', baseline: 'top' },
                { x: xMid - padding, y: yAxis.top + padding, text: 'PUZZLES', color: '#1d4ed8', align: 'right', baseline: 'top' },
                { x: xMid + padding, y: yAxis.bottom - padding, text: 'CABALLOS', color: '#b45309', align: 'left', baseline: 'bottom' },
                { x: xMid - padding, y: yAxis.bottom - padding, text: 'PERROS', color: '#b91c1c', align: 'right', baseline: 'bottom' }
            ];
            ctx.font = '700 11px Inter, system-ui, -apple-system, sans-serif';
            labels.forEach(l => {
                ctx.fillStyle = l.color;
                ctx.textAlign = l.align;
                ctx.textBaseline = l.baseline;
                ctx.fillText(l.text, l.x, l.y);
            });
        }
    };

    scatterChart = new window.Chart(canvas, {
        type: 'scatter',
        data: { datasets: puntos },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 8, right: 16, bottom: 8, left: 8 } },
            onClick: (evt, elements) => {
                if (!elements || elements.length === 0) return;
                const el = elements[0];
                const punto = puntos[el.datasetIndex]?.data?.[el.index];
                if (punto?.plato) emitirClickPlato(punto.plato);
            },
            onHover: (evt, elements) => {
                const target = evt?.native?.target;
                if (target) target.style.cursor = elements?.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleFont: { weight: 700, size: 13 },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        title: (items) => items?.[0]?.raw?.nombre || '',
                        label: (ctx) => {
                            const p = ctx.raw;
                            return [
                                `Vendidas:  ${Math.round(p.x)} ud`,
                                `Margen:    ${cm(p.y?.toFixed(2))}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Popularidad (unidades vendidas)', font: { weight: 600, size: 12 }, color: '#374151' },
                    grid: { color: 'rgba(15,23,42,0.04)' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                },
                y: {
                    title: { display: true, text: 'Rentabilidad (margen €)', font: { weight: 600, size: 12 }, color: '#374151' },
                    grid: { color: 'rgba(15,23,42,0.04)' },
                    ticks: { color: '#6b7280', font: { size: 11 } }
                }
            }
        },
        plugins: [quadrantPlugin]
    });
}

/**
 * Renderiza la matriz BCG v2 (scatter + 4 listas) en su host propio.
 *
 * @param {Array} data - response de /analysis/menu-engineering (cada plato con clasificacion)
 */
export function renderMatrizBCG(data) {
    const host = ensureHost();
    if (!host || !Array.isArray(data)) return;
    ocultarLegacy();

    // Promedios para que `clasificacionDePlato` funcione cuando el backend
    // no entregue la propiedad (caso raro de respuesta degradada).
    const platosConVentas = data.filter(p => (p.popularidad || 0) > 0);
    const promedios = {
        popularidad: platosConVentas.length > 0
            ? platosConVentas.reduce((s, p) => s + (p.popularidad || 0), 0) / platosConVentas.length
            : 0,
        margen: platosConVentas.length > 0
            ? platosConVentas.reduce((s, p) => s + (p.margen || 0), 0) / platosConVentas.length
            : 0
    };

    const grupos = {};
    CATEGORIAS.forEach(c => { grupos[c] = []; });
    data.forEach(p => {
        const cat = clasificacionDePlato(p, promedios);
        if (grupos[cat]) grupos[cat].push(p);
    });
    // Ordenar cada grupo por popularidad descendente
    Object.values(grupos).forEach(arr => arr.sort((a, b) => (b.popularidad || 0) - (a.popularidad || 0)));

    host.innerHTML = `
        <header class="bcg2-header">
            <div>
                <h3 class="bcg2-title">Matriz BCG · Ingeniería de Menú</h3>
                <p class="bcg2-subtitle">Cada plato según popularidad y rentabilidad</p>
            </div>
            <div class="bcg2-header-actions">
                <div class="bcg2-legend">
                    ${CATEGORIAS.map(c => `
                        <span class="bcg2-legend-item" style="--cat-color:${COLORES[c]};">
                            <span class="bcg2-legend-dot"></span>${LABELS[c]}
                        </span>
                    `).join('')}
                </div>
                <button type="button" class="bcg2-info-btn" data-action="bcg-info" aria-label="Qué es la Matriz BCG">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <span>¿Qué es esto?</span>
                </button>
            </div>
        </header>
        <div class="bcg2-scatter-wrap">
            <canvas id="${SCATTER_CANVAS_ID}"></canvas>
        </div>
        <div class="bcg2-cuadrantes-grid">
            ${CATEGORIAS.map(c => renderListaCuadrante(c, grupos[c])).join('')}
        </div>
    `;

    // Bind click en items de lista
    host.querySelectorAll('.bcg2-item[data-plato-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.platoId, 10);
            const plato = data.find(p => p.id === id);
            if (plato) emitirClickPlato(plato);
        });
    });

    // Bind botón "¿Qué es esto?"
    host.querySelectorAll('[data-action="bcg-info"]').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); mostrarBcgInfo(); });
    });

    // Render scatter
    const canvas = host.querySelector(`#${SCATTER_CANVAS_ID}`);
    renderScatter(canvas, data, promedios);
}
