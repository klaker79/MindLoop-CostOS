/**
 * Dashboard sintético del módulo Análisis.
 *
 * Renderiza arriba de la matriz BCG una franja con:
 *   - Filtro de periodo (Histórico / Mes / Trimestre / Año).
 *   - 4 cards con conteos por categoría + descripción corta + icono.
 *   - Donut de distribución porcentual (canvas Chart.js).
 *
 * Se monta dentro del contenedor `#analisis-dashboard-sintetico` que el
 * orchestrator inserta al inicio de `#analisis-contenido`. Si el contenedor
 * no existe (cliente con caché vieja), no falla — simplemente no renderiza.
 */

import { renderIcono, COLORES, LABELS, DESCRIPCIONES } from './iconos.js';
import { getPeriodo, setPeriodo, refrescarTodo } from './analisis-state.js';

const CATEGORIAS = ['estrella', 'puzzle', 'caballo', 'perro'];

const PERIODO_OPCIONES = [
    { tipo: 'historico', label: 'Histórico' },
    { tipo: 'mes', label: 'Mes' },
    { tipo: 'trimestre', label: 'Trimestre' },
    { tipo: 'anio', label: 'Año' }
];

let donutChart = null;

/**
 * Renderiza la franja con filtro + cards + donut.
 *
 * @param {HTMLElement} parent - contenedor donde insertar
 * @param {object} datos - { counts: { estrella, puzzle, caballo, perro } }
 * @param {(newPeriodo: string) => void} onPeriodoChange - callback al cambiar filtro
 */
export function renderDashboardSintetico(parent, datos = { counts: {} }, onPeriodoChange = null) {
    if (!parent) return;

    const counts = datos.counts || {};
    const total = CATEGORIAS.reduce((s, c) => s + (counts[c] || 0), 0);
    const periodoActivo = getPeriodo().tipo;

    const cardsHTML = CATEGORIAS.map(cat => {
        const n = counts[cat] || 0;
        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
        return `
        <div class="ans-card" data-cat="${cat}" style="border-left:4px solid ${COLORES[cat]};">
            <div class="ans-card__icon">${renderIcono(cat, { size: 36 })}</div>
            <div class="ans-card__body">
                <div class="ans-card__label">${LABELS[cat]}</div>
                <div class="ans-card__value">${n}</div>
                <div class="ans-card__pct">${pct}% de la carta</div>
            </div>
            <div class="ans-card__hint">${DESCRIPCIONES[cat]}</div>
        </div>`;
    }).join('');

    const periodoHTML = PERIODO_OPCIONES.map(o => `
        <button type="button" class="ans-periodo-btn ${o.tipo === periodoActivo ? 'is-active' : ''}"
                data-periodo="${o.tipo}">${o.label}</button>
    `).join('');

    parent.innerHTML = `
        <div class="ans-toolbar">
            <div class="ans-periodo-group" role="tablist">${periodoHTML}</div>
            <button type="button" class="ans-refresh-btn" data-action="refrescar" title="Refrescar datos">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refrescar
            </button>
        </div>
        <div class="ans-grid">
            <div class="ans-cards">${cardsHTML}</div>
            <div class="ans-donut-wrap">
                <canvas id="ans-donut-chart" width="180" height="180"></canvas>
                <div class="ans-donut-total">
                    <div class="ans-donut-total__value">${total}</div>
                    <div class="ans-donut-total__label">platos</div>
                </div>
            </div>
        </div>
    `;

    // Bind filtro periodo
    parent.querySelectorAll('.ans-periodo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const nuevoTipo = btn.dataset.periodo;
            if (nuevoTipo === getPeriodo().tipo) return;
            setPeriodo(nuevoTipo);
            if (typeof onPeriodoChange === 'function') onPeriodoChange(nuevoTipo);
        });
    });

    // Bind refrescar
    const refreshBtn = parent.querySelector('[data-action="refrescar"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            await refrescarTodo();
            if (typeof onPeriodoChange === 'function') onPeriodoChange(getPeriodo().tipo);
            refreshBtn.disabled = false;
        });
    }

    // Render donut (solo si Chart.js está disponible y hay datos)
    if (total > 0 && typeof window.Chart === 'function') {
        const ctx = parent.querySelector('#ans-donut-chart');
        if (donutChart) { donutChart.destroy(); donutChart = null; }
        if (ctx) {
            donutChart = new window.Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: CATEGORIAS.map(c => LABELS[c]),
                    datasets: [{
                        data: CATEGORIAS.map(c => counts[c] || 0),
                        backgroundColor: CATEGORIAS.map(c => COLORES[c]),
                        borderWidth: 0,
                        cutout: '70%'
                    }]
                },
                options: {
                    responsive: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (item) => `${item.label}: ${item.parsed} platos`
                            }
                        }
                    },
                    animation: { duration: 400 }
                }
            });
        }
    }
}

/**
 * Wrapper que extrae counts del array que devuelve `/menu-engineering`.
 */
export function contarCategorias(menuEngineeringData) {
    const counts = { estrella: 0, puzzle: 0, caballo: 0, perro: 0 };
    if (!Array.isArray(menuEngineeringData)) return counts;
    menuEngineeringData.forEach(p => {
        if (p.clasificacion && counts[p.clasificacion] !== undefined) {
            counts[p.clasificacion]++;
        }
    });
    return counts;
}
