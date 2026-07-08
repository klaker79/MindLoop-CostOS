/**
 * Bloque "Punto de Equilibrio" de la pestaña Análisis.
 *
 * Es el hermano visual de la Matriz BCG y los Principios de Omnes: mismo
 * lenguaje de tarjetas (namespace .oms- reutilizado) + una banda hero con
 * el número grande. Responde a "¿cuánto necesito facturar para no perder?"
 * y ofrece las tres palancas para moverlo (margen, gastos fijos, food cost).
 *
 * Fuente de datos:
 *   - Gastos fijos: GET /gastos-fijos (suma de monto_mensual).
 *   - Margen/ticket/food cost: /analysis/menu-engineering (cacheado en
 *     analisis-state), ponderado por ventas reales en breakeven-calc.js.
 *
 * Expone `window.mlBreakevenGetSnapshot()` para que el mini del Diario
 * (legacy) consuma EXACTAMENTE el mismo cálculo → los números cuadran.
 */

import { api } from '../../api/client.js';
import { getMenuEngineering } from './analisis-state.js';
import { computeBreakeven, DIAS_SERVICIO_MES_DEFAULT } from './breakeven-calc.js';
import { construirConsejos, construirPreguntaOmnes } from './breakeven-consejos.js';
import { escapeHTML, cm } from '../../utils/helpers.js';
import { mostrarBreakevenInfo } from './breakeven-info.js';

const HOST_ID = 'analisis-breakeven';

function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    // Debajo de Principios de Omnes (último bloque del módulo nuevo).
    const omnes = document.getElementById('analisis-omnes');
    const bcgV2 = document.getElementById('analisis-matriz-bcg-v2');
    const contenido = document.getElementById('analisis-contenido');
    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'chart-card';
    host.style.marginTop = '16px';
    if (omnes && omnes.parentNode) {
        omnes.parentNode.insertBefore(host, omnes.nextSibling);
    } else if (bcgV2 && bcgV2.parentNode) {
        bcgV2.parentNode.insertBefore(host, bcgV2.nextSibling);
    } else if (contenido) {
        contenido.appendChild(host);
    }
    return host;
}

/** Suma los gastos fijos mensuales desde el backend (defensivo con la forma). */
async function fetchGastosFijosMes() {
    try {
        const raw = await api.getGastosFijos();
        const arr = Array.isArray(raw) ? raw : (raw?.gastos || raw?.data || []);
        return arr.reduce((s, g) => s + (parseFloat(g.monto_mensual) || 0), 0);
    } catch (e) {
        console.warn('[breakeven] error gastos fijos:', e?.message);
        return 0;
    }
}

/**
 * Devuelve el snapshot del punto de equilibrio (mismo cálculo para Análisis
 * y para el mini del Diario). Usa la cache de menu-engineering.
 */
export async function getBreakevenSnapshot() {
    const [gastosFijosMes, platos] = await Promise.all([
        fetchGastosFijosMes(),
        getMenuEngineering().catch(() => [])
    ]);
    return computeBreakeven({ platos, gastosFijosMes, diasServicio: DIAS_SERVICIO_MES_DEFAULT });
}

/**
 * Progreso del mes cargado en el Diario (si `datosResumenMensual` existe).
 * Devuelve null si no hay datos — el hero muestra solo el objetivo.
 */
function progresoDelMes(breakevenPlatosMes, ticketMedio) {
    const drm = typeof window !== 'undefined' ? window.datosResumenMensual : null;
    const recetas = drm?.ventas?.recetas;
    if (!recetas || !breakevenPlatosMes) return null;
    let unidadesMes = 0;
    for (const nombre in recetas) {
        unidadesMes += parseFloat(recetas[nombre]?.totalVendidas) || 0;
    }
    if (unidadesMes <= 0) return null;
    const progreso = Math.min(100, (unidadesMes / breakevenPlatosMes) * 100);
    const faltantesPlatos = Math.max(0, breakevenPlatosMes - unidadesMes);
    return {
        unidadesMes,
        progreso,
        faltantesPlatos,
        faltantesEuros: faltantesPlatos * ticketMedio,
        cubierto: faltantesPlatos <= 0
    };
}

const INFO_BTN_HTML = `
    <button type="button" class="oms-info-btn" data-action="be-info" aria-label="Qué es el punto de equilibrio">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>¿Qué es esto?</span>
    </button>
`;

function headerHTML(subtitulo) {
    return `
        <div class="oms-header">
            <div>
                <h3 class="oms-title">🎯 Punto de Equilibrio</h3>
                <p class="oms-subtitle">${escapeHTML(subtitulo)}</p>
            </div>
            ${INFO_BTN_HTML}
        </div>
    `;
}

function foodCostBadge(pct) {
    if (pct <= 30) return { cls: 'oms-badge--ok', label: 'Excelente' };
    if (pct <= 35) return { cls: 'oms-badge--ok', label: 'En objetivo' };
    if (pct <= 40) return { cls: 'oms-badge--warn', label: 'Vigilar' };
    return { cls: 'oms-badge--bad', label: 'Alto' };
}

function tipHTML(tono, titulo, texto) {
    return `
        <div class="oms-tip oms-tip--${tono}">
            <div class="oms-tip__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
            </div>
            <div class="oms-tip__body">
                <div class="oms-tip__label">${escapeHTML(titulo)}</div>
                <p class="oms-tip__text">${escapeHTML(texto)}</p>
            </div>
        </div>
    `;
}

function heroBandHTML(snap, prog) {
    const platosDiaTxt = snap.platosDia.toLocaleString('es-ES');
    const platosMesTxt = snap.breakevenPlatosMes.toLocaleString('es-ES');

    let tono = 'info';
    if (prog) tono = prog.cubierto ? 'ok' : (prog.progreso >= 60 ? 'warn' : 'bad');

    let progresoHTML = '';
    if (prog) {
        const color = prog.cubierto ? '#10b981' : (prog.progreso >= 60 ? '#f59e0b' : '#ef4444');
        const pie = prog.cubierto
            ? '✅ Gastos fijos cubiertos — a partir de aquí, todo es beneficio.'
            : `Te faltan ${prog.faltantesPlatos.toLocaleString('es-ES')} platos (~${cm(prog.faltantesEuros)}) para cubrir gastos.`;
        progresoHTML = `
            <div class="be-progress">
                <div class="be-progress__head">
                    <span>Mes en curso: <strong>${prog.progreso.toFixed(0)}%</strong> del objetivo</span>
                    <span class="be-progress__count">${prog.unidadesMes.toLocaleString('es-ES')} / ${platosMesTxt} platos</span>
                </div>
                <div class="be-progress__track">
                    <div class="be-progress__fill" style="width:${prog.progreso}%; background:${color};"></div>
                </div>
                <div class="be-progress__foot">${escapeHTML(pie)}</div>
            </div>
        `;
    }

    return `
        <div class="be-hero be-hero--${tono}">
            <div class="be-hero__main">
                <span class="be-hero__eyebrow">Para no perder dinero, necesitas facturar</span>
                <div class="be-hero__number">${cm(snap.ventasEquilibrioDia)}<span class="be-hero__unit">/ día</span></div>
                <div class="be-hero__sub">≈ ${platosDiaTxt} platos al día · ${cm(snap.ventasEquilibrioMes)} al mes (${platosMesTxt} platos) · sobre ${snap.diasServicio} días de servicio</div>
            </div>
            ${progresoHTML}
        </div>
    `;
}

const BADGE_EMPIEZA = '<span class="oms-badge oms-badge--ok">⭐ Empieza por aquí</span>';

function palancasHTML(snap, platos) {
    const c = construirConsejos(snap, platos);
    const fb = foodCostBadge(snap.foodCostMedio);

    return `
        <div class="oms-cards">
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Margen por plato</h4>
                    ${c.prioridad === 'margen' ? BADGE_EMPIEZA : '<span class="oms-badge oms-badge--mute">Palanca</span>'}
                </div>
                <div class="oms-card__value">${cm(snap.margenPonderado)}</div>
                <p class="oms-card__sub">Lo que deja de media cada plato tras su coste (ponderado por ventas reales).</p>
                ${tipHTML(c.margen.tono, c.margen.titulo, c.margen.texto)}
            </div>
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Gastos fijos</h4>
                    ${c.prioridad === 'gastos' ? BADGE_EMPIEZA : '<span class="oms-badge oms-badge--mute">Palanca</span>'}
                </div>
                <div class="oms-card__value">${cm(snap.gastosFijosMes)}<span class="be-unit">/ mes</span></div>
                <p class="oms-card__sub">Alquiler, personal, suministros y los que todos olvidan: cuota de autónomo, préstamo, suscripciones.</p>
                ${tipHTML(c.gastos.tono, c.gastos.titulo, c.gastos.texto)}
            </div>
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Food cost</h4>
                    ${c.prioridad === 'food' ? BADGE_EMPIEZA : `<span class="oms-badge ${fb.cls}">${fb.label}</span>`}
                </div>
                <div class="oms-card__value">${snap.foodCostMedio.toFixed(0)}%</div>
                <p class="oms-card__sub">% de tus ventas que se va en materia prima. Cuanto más bajo, más margen por plato.</p>
                ${tipHTML(c.food.tono, c.food.titulo, c.food.texto)}
            </div>
        </div>
    `;
}

function recomendacionHTML(snap) {
    const texto = `Facturar no es ganar. Tu punto de equilibrio son ${snap.breakevenPlatosMes.toLocaleString('es-ES')} platos al mes (~${snap.platosDia.toLocaleString('es-ES')} al día). A partir de ahí, cada plato es beneficio de verdad — y las tres palancas de arriba te dicen cómo bajar ese número.`;
    return `
        <div class="oms-recom">
            <div class="oms-recom__icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                </svg>
            </div>
            <div class="oms-recom__body">
                <div class="oms-recom__label">Tu número de supervivencia</div>
                <p class="oms-recom__text">${escapeHTML(texto)}</p>
                <button type="button" class="be-omnes-btn" data-action="be-omnes">
                    🦉 Pregúntale a Omnes cómo bajarlo
                </button>
            </div>
        </div>
    `;
}

function estadoVacioHTML(snap) {
    const mapa = {
        sin_gastos: {
            titulo: 'Configura tus gastos fijos',
            texto: 'Para calcular tu punto de equilibrio necesitamos tus gastos fijos mensuales: alquiler, personal, suministros y los que todos olvidan (cuota de autónomo, préstamo, suscripciones). Añádelos en Configuración → Gastos fijos.',
            tono: 'warn'
        },
        sin_ventas: {
            titulo: 'Aún no hay ventas para calcular el margen',
            texto: 'No hay ventas en el periodo seleccionado, así que no podemos calcular el margen medio por plato. Registra ventas o amplía el periodo (mes / trimestre) arriba.',
            tono: 'mute'
        },
        sin_margen: {
            titulo: 'Tus platos no dejan margen de media',
            texto: `De media, cada plato deja ${cm(snap.margenPonderado || 0)}. Sin margen positivo no hay punto de equilibrio posible: revisa costes de escandallo y precios de venta antes de nada.`,
            tono: 'bad'
        }
    };
    const info = mapa[snap.estado] || mapa.sin_ventas;
    return `
        <div class="oms-cards" style="grid-template-columns: 1fr;">
            <div class="oms-card">
                <div class="oms-card__head">
                    <h4 class="oms-card__title">Punto de equilibrio</h4>
                    <span class="oms-badge oms-badge--${info.tono === 'mute' ? 'mute' : (info.tono === 'bad' ? 'bad' : 'warn')}">Sin datos</span>
                </div>
                ${tipHTML(info.tono, info.titulo, info.texto)}
            </div>
        </div>
    `;
}

function bindHandlers(host, pregunta) {
    host.querySelectorAll('[data-action="be-info"]').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); mostrarBreakevenInfo(); });
    });
    // Botón "Pregúntale a Omnes" — deep-link al chat con la pregunta redactada.
    // La pregunta se captura por CLOSURE (no por atributo HTML) para que no la
    // trunque ningún carácter del texto. Si el add-on no está activo,
    // preguntarAOmnes devuelve false y avisamos.
    host.querySelectorAll('[data-action="be-omnes"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const q = pregunta || '¿Cómo puedo bajar mi punto de equilibrio según mis platos?';
            const ok = typeof window.preguntarAOmnes === 'function' && window.preguntarAOmnes(q);
            if (!ok) {
                window.showToast?.('Activa el add-on de Omnes para preguntarle sobre tu punto de equilibrio.', 'info');
            }
        });
    });
}

/**
 * Renderiza el bloque completo. No bloqueante: si algo falla, deja un
 * mensaje pero no rompe el resto del módulo Análisis.
 */
export async function renderBreakeven() {
    const host = ensureHost();
    if (!host) return;
    try {
        const [snap, platos] = await Promise.all([
            getBreakevenSnapshot(),
            getMenuEngineering().catch(() => [])
        ]);
        if (snap.estado !== 'ok') {
            host.innerHTML = headerHTML('Cuánto necesitas facturar para no perder dinero — tu número de supervivencia.') + estadoVacioHTML(snap);
            bindHandlers(host, null);
            return;
        }
        const prog = progresoDelMes(snap.breakevenPlatosMes, snap.ticketMedio);
        host.innerHTML = `
            ${headerHTML('Cuánto necesitas facturar para no perder dinero — tu número de supervivencia.')}
            ${heroBandHTML(snap, prog)}
            ${palancasHTML(snap, platos)}
            ${recomendacionHTML(snap)}
        `;
        bindHandlers(host, construirPreguntaOmnes(snap));
    } catch (err) {
        console.warn('[analisis] breakeven falló:', err?.message);
    }
}

if (typeof window !== 'undefined') {
    window.mlBreakevenGetSnapshot = getBreakevenSnapshot;
    window.mlBreakevenRender = renderBreakeven;
}
