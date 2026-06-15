import { t } from '@/i18n/index.js';
import { escapeHTML, getDateLocale } from '../../utils/helpers.js';
import { construirAvisos, buildOmnesQuestion } from './omnes-avisos.js';
import { filtrarVisibles, dismissAviso } from './omnes-dismiss.js';

/**
 * 🦉 Omnes — Feed de avisos proactivos (antes "Inteligencia").
 *
 * Omnes pone la voz; el sistema pone los números. Todos los avisos son
 * DETERMINISTAS (reglas con umbral sobre datos reales) → sin ruido ni errores.
 */

// ========== API ==========
async function fetchIntelligence(endpoint) {
    try {
        // fix M6: el fallback necesita /api al final (igual que getApiUrl() que devuelve baseUrl+'/api')
        const apiBase = window.getApiUrl ? window.getApiUrl() : 'https://lacaleta-api.mindloop.cloud/api';

        // 🔒 SECURITY: Dual-mode auth — cookie + in-memory Bearer (NOT localStorage)
        const headers = { 'Content-Type': 'application/json' };
        const token = typeof window !== 'undefined' ? window.authToken : null;
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const response = await fetch(`${apiBase}/intelligence/${endpoint}`, {
            method: 'GET',
            credentials: 'include',
            headers
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        console.error(`Error fetching ${endpoint}:`, err);
        return null;
    }
}

// ========== ESTILOS ==========
const INTEL_STYLES = `
<style id="intel-styles">
.omnes-wrap {
    background: radial-gradient(1200px 600px at 50% -10%, #1e1b4b 0%, #0f172a 45%, #0b1120 100%);
    min-height: 100vh;
    padding: 28px 24px 60px;
    color: #e2e8f0;
}
.omnes-hero {
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 26px 28px;
    margin-bottom: 26px;
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(56,189,248,0.06));
    border: 1px solid rgba(129,140,248,0.25);
    box-shadow: 0 20px 60px -30px rgba(99,102,241,0.7);
    position: relative;
    overflow: hidden;
}
.omnes-hero::after {
    content: "";
    position: absolute; inset: 0;
    background: radial-gradient(400px 200px at 12% 30%, rgba(129,140,248,0.25), transparent 70%);
    pointer-events: none;
}
.omnes-owl {
    width: 104px; height: 104px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 3px solid rgba(129,140,248,0.55);
    box-shadow: 0 0 0 6px rgba(99,102,241,0.12), 0 12px 36px -8px rgba(99,102,241,0.8);
    background: #0b1120;
}
.omnes-hero-text { z-index: 1; flex: 1; min-width: 0; }
.omnes-hero-text h1 {
    margin: 0;
    font-size: 2.3rem;
    line-height: 1.05;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, #c7d2fe, #818cf8 55%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
.omnes-tagline { color: #a5b4fc; font-size: 0.95rem; margin-top: 4px; font-weight: 500; }
.omnes-updated { color: #64748b; font-size: 0.75rem; margin-top: 8px; }
.omnes-hero-actions { z-index: 1; display: flex; flex-direction: column; gap: 10px; align-items: flex-end; }
.omnes-refresh {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff; border: none;
    padding: 9px 16px; border-radius: 10px;
    cursor: pointer; font-weight: 600; font-size: 0.85rem;
    white-space: nowrap;
}
.omnes-refresh:hover { filter: brightness(1.1); }
.omnes-summary { display: flex; gap: 10px; flex-wrap: wrap; }
.omnes-chip {
    padding: 6px 13px; border-radius: 999px;
    font-size: 0.8rem; font-weight: 700;
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid transparent;
}
.omnes-chip.crit { background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.4); }
.omnes-chip.aten { background: rgba(249,115,22,0.15); color: #fdba74; border-color: rgba(249,115,22,0.4); }
.omnes-chip.ok { background: rgba(34,197,94,0.15); color: #86efac; border-color: rgba(34,197,94,0.4); }

.omnes-feed { display: flex; flex-direction: column; gap: 24px; max-width: 940px; }

/* Sección (grupo de avisos del mismo tipo) */
.omnes-sec { display: flex; flex-direction: column; gap: 10px; }
.omnes-sec-head {
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; user-select: none;
    padding: 2px;
}
.omnes-sec-ic {
    width: 34px; height: 34px; flex-shrink: 0;
    border-radius: 10px; font-size: 17px;
    display: flex; align-items: center; justify-content: center;
}
.omnes-sec-title {
    font-size: 0.78rem; font-weight: 800; letter-spacing: 1px;
    text-transform: uppercase; color: #cbd5e1;
}
.omnes-sec-count {
    font-size: 0.72rem; font-weight: 700; color: #94a3b8;
    background: rgba(148,163,184,0.14);
    padding: 2px 9px; border-radius: 999px;
}
.omnes-sec-chevron { margin-left: auto; color: #64748b; font-size: 12px; transition: transform .18s ease; }
.omnes-sec.collapsed .omnes-sec-chevron { transform: rotate(-90deg); }
.omnes-sec-body { display: flex; flex-direction: column; gap: 10px; }
.omnes-sec.collapsed .omnes-sec-body { display: none; }

/* Tarjeta de aviso */
.omnes-card {
    position: relative;
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px 14px 18px;
    border-radius: 14px;
    background: rgba(30,41,59,0.66);
    border: 1px solid rgba(148,163,184,0.10);
    border-left: 3px solid #64748b;
    transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
}
.omnes-card:hover { transform: translateY(-1px); background: rgba(30,41,59,0.9); box-shadow: 0 14px 40px -24px rgba(0,0,0,0.9); }
.omnes-card.critico { border-left-color: #ef4444; }
.omnes-card.atencion { border-left-color: #f59e0b; }
.omnes-card.oportunidad { border-left-color: #22c55e; }
.omnes-card-dismiss {
    position: absolute;
    top: 7px; right: 8px;
    background: transparent; border: none;
    color: #64748b; font-size: 12px; line-height: 1;
    cursor: pointer; padding: 3px 6px; border-radius: 6px; z-index: 2;
}
.omnes-card-dismiss:hover { color: #e2e8f0; background: rgba(255,255,255,0.08); }
.omnes-card-body { flex: 1; min-width: 0; padding-right: 14px; }
.omnes-card-text { font-size: 0.92rem; color: #e2e8f0; line-height: 1.45; }
.omnes-card-cta {
    flex-shrink: 0; align-self: center;
    background: rgba(99,102,241,0.18);
    color: #c7d2fe;
    border: 1px solid rgba(129,140,248,0.35);
    padding: 8px 14px; border-radius: 10px;
    cursor: pointer; font-weight: 600; font-size: 0.82rem;
    white-space: nowrap;
}
.omnes-card-cta:hover { background: rgba(99,102,241,0.32); color: #fff; }
.omnes-card-actions { flex-shrink: 0; display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.omnes-card-ask {
    background: rgba(56,189,248,0.12);
    color: #7dd3fc;
    border: 1px solid rgba(56,189,248,0.35);
    padding: 7px 12px; border-radius: 10px;
    cursor: pointer; font-weight: 600; font-size: 0.8rem;
    white-space: nowrap;
}
.omnes-card-ask:hover { background: rgba(56,189,248,0.26); color: #fff; }

.omnes-empty {
    text-align: center; padding: 60px 24px;
    max-width: 520px; margin: 0 auto;
    color: #94a3b8;
}
.omnes-empty-owl {
    width: 88px; height: 88px; border-radius: 50%;
    object-fit: cover; margin-bottom: 16px; opacity: 0.9;
    border: 2px solid rgba(34,197,94,0.4);
}
.omnes-empty h2 { color: #86efac; margin: 0 0 6px; font-size: 1.4rem; }
.omnes-loading { text-align: center; padding: 70px 20px; color: #94a3b8; }
.omnes-loading-owl {
    width: 80px; height: 80px; border-radius: 50%; object-fit: cover;
    margin-bottom: 16px; animation: omnesPulse 1.4s ease-in-out infinite;
    border: 2px solid rgba(129,140,248,0.5);
}
@keyframes omnesPulse { 0%,100% { opacity: .55; transform: scale(.97);} 50% { opacity: 1; transform: scale(1.03);} }

@media (max-width: 640px) {
    .omnes-hero { flex-direction: column; text-align: center; }
    .omnes-hero-actions { align-items: center; }
    .omnes-card { flex-wrap: wrap; }
    .omnes-card-actions { width: 100%; flex-direction: row; }
    .omnes-card-cta, .omnes-card-ask { flex: 1; }
}
</style>
`;

const OWL_SRC = '/images/omnes.png';
// Si la foto no carga, degradamos a emoji 🦉 (mismo patrón que el avatar del chat).
const OWL_FALLBACK = `onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🦉',style:'font-size:64px;line-height:1'}))"`;

// ========== RENDER ==========
// Secciones del feed (orden fijo de arriba a abajo). Cada aviso trae `categoria`.
const SECCIONES = [
    { cat: 'recetas',    emoji: '📉', bg: 'rgba(239,68,68,0.16)',  titleKey: 'omnes_sec_recetas' },
    { cat: 'stock',      emoji: '📦', bg: 'rgba(245,158,11,0.16)', titleKey: 'omnes_sec_stock' },
    { cat: 'frescura',   emoji: '🧊', bg: 'rgba(34,211,238,0.16)', titleKey: 'omnes_sec_frescura' },
    { cat: 'precio',     emoji: '📈', bg: 'rgba(168,85,247,0.16)', titleKey: 'omnes_sec_precio' },
    { cat: 'sobrestock', emoji: '🗄️', bg: 'rgba(100,116,139,0.18)', titleKey: 'omnes_sec_sobrestock' },
];

// Frases i18n para "Pregúntale a Omnes" (resueltas al pintar, no en módulo).
function frasesOmnes() {
    return {
        prefix: t('inteligencia:omnes_ask_prefix'),
        recetas: t('inteligencia:omnes_ask_recetas'),
        stock: t('inteligencia:omnes_ask_stock'),
        precio: t('inteligencia:omnes_ask_precio'),
        frescura: t('inteligencia:omnes_ask_frescura'),
        sobrestock: t('inteligencia:omnes_ask_sobrestock'),
        default: t('inteligencia:omnes_ask_default'),
    };
}

function renderAvisoCard(a) {
    // a.texto / a.cta.label vienen de t(): i18next ya escapa los valores interpolados
    // (escapeValue:true) → HTML seguro. a.cta.tipo es literal fijo y a.cta.id un número.
    const cta = a.cta
        ? `<button class="omnes-card-cta" onclick="window.omnesIr('${a.cta.tipo}', ${a.cta.id})">${a.cta.label} →</button>`
        : '';
    // "Pregúntale a Omnes": deep-link al chat con una pregunta sobre este aviso.
    const pregunta = buildOmnesQuestion(a, frasesOmnes());
    const ask = `<button class="omnes-card-ask" type="button" data-omnes-ask="${escapeHTML(pregunta)}" title="${escapeHTML(t('inteligencia:omnes_ask_btn'))}">🦉 ${escapeHTML(t('inteligencia:omnes_ask_btn'))}</button>`;
    return `
        <div class="omnes-card ${a.nivel}" data-aviso-id="${escapeHTML(a.id)}" data-cat="${escapeHTML(a.categoria || '')}">
            <button class="omnes-card-dismiss" type="button" data-dismiss-id="${escapeHTML(a.id)}" title="${escapeHTML(t('inteligencia:omnes_dismiss'))}" aria-label="${escapeHTML(t('inteligencia:omnes_dismiss'))}">✕</button>
            <div class="omnes-card-body"><div class="omnes-card-text">${a.texto}</div></div>
            <div class="omnes-card-actions">${cta}${ask}</div>
        </div>
    `;
}

function renderSeccion(sec, avisosCat) {
    return `
        <section class="omnes-sec" data-cat="${sec.cat}">
            <header class="omnes-sec-head" data-sec-toggle>
                <span class="omnes-sec-ic" style="background:${sec.bg};">${sec.emoji}</span>
                <span class="omnes-sec-title">${escapeHTML(t('inteligencia:' + sec.titleKey))}</span>
                <span class="omnes-sec-count">${avisosCat.length}</span>
                <span class="omnes-sec-chevron">▾</span>
            </header>
            <div class="omnes-sec-body">${avisosCat.map(renderAvisoCard).join('')}</div>
        </section>
    `;
}

// Agrupa los avisos por categoría y los pinta en secciones (orden de SECCIONES).
function renderFeed(avisos) {
    const porCat = {};
    avisos.forEach(a => { (porCat[a.categoria] = porCat[a.categoria] || []).push(a); });
    const secs = SECCIONES
        .filter(s => porCat[s.cat] && porCat[s.cat].length)
        .map(s => renderSeccion(s, porCat[s.cat]))
        .join('');
    return `<div class="omnes-feed">${secs}</div>`;
}

function renderEmpty() {
    return `
        <div class="omnes-empty">
            <img class="omnes-empty-owl" src="${OWL_SRC}" alt="Omnes" ${OWL_FALLBACK}>
            <h2>${escapeHTML(t('inteligencia:omnes_empty_title'))}</h2>
            <div>${escapeHTML(t('inteligencia:omnes_empty_sub'))}</div>
        </div>
    `;
}

// ========== MAIN ==========
async function renderizarInteligencia() {
    const container = document.getElementById('content-inteligencia');
    if (!container) return;

    if (!document.getElementById('intel-styles')) {
        document.head.insertAdjacentHTML('beforeend', INTEL_STYLES);
    }

    container.innerHTML = `
        <div class="omnes-wrap">
            <div class="omnes-loading">
                <img class="omnes-loading-owl" src="${OWL_SRC}" alt="Omnes" ${OWL_FALLBACK}>
                <div>${escapeHTML(t('inteligencia:omnes_loading'))}</div>
            </div>
        </div>`;

    let avisos = [];
    try {
        avisos = await construirAvisos({
            fetchIntelligence,
            ingredientes: window.ingredientes,
            pedidos: window.pedidos,
        });
    } catch (err) {
        console.error('[Omnes] error construyendo avisos:', err);
    }

    avisos = filtrarVisibles(avisos); // quitar los que el usuario descartó (tenant-scoped, TTL 7d)
    setBadgeOmnes(avisos.length); // mantener el contador del sidebar en sync

    const nCrit = avisos.filter(a => a.nivel === 'critico').length;
    const nAten = avisos.filter(a => a.nivel === 'atencion').length;
    const time = new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });

    const feed = avisos.length === 0
        ? renderEmpty()
        : renderFeed(avisos);

    container.innerHTML = `
        <div class="omnes-wrap">
            <div class="omnes-hero">
                <img class="omnes-owl" src="${OWL_SRC}" alt="Omnes" ${OWL_FALLBACK}>
                <div class="omnes-hero-text">
                    <h1>${escapeHTML(t('inteligencia:omnes_title'))}</h1>
                    <div class="omnes-tagline">${escapeHTML(t('inteligencia:omnes_tagline'))}</div>
                    <div class="omnes-summary" id="omnes-chips" style="margin-top:12px;">${chipsHTML(nCrit, nAten)}</div>
                    <div class="omnes-updated">${escapeHTML(t('inteligencia:updated_at', { time }))}</div>
                </div>
                <div class="omnes-hero-actions">
                    <button class="omnes-refresh" onclick="window.renderizarInteligencia()">🔄 ${escapeHTML(t('inteligencia:btn_refresh'))}</button>
                </div>
            </div>
            ${feed}
        </div>
    `;
}

// Chips de resumen (crítico / a vigilar / todo en orden). Reutilizable para
// repintar tras descartar un aviso sin recargar toda la pestaña.
function chipsHTML(nCrit, nAten) {
    if (nCrit + nAten === 0) {
        return `<span class="omnes-chip ok">✅ ${escapeHTML(t('inteligencia:omnes_chip_ok'))}</span>`;
    }
    return `
        ${nCrit ? `<span class="omnes-chip crit">🔴 ${t('inteligencia:omnes_chip_crit', { count: nCrit })}</span>` : ''}
        ${nAten ? `<span class="omnes-chip aten">🟠 ${t('inteligencia:omnes_chip_aten', { count: nAten })}</span>` : ''}
    `;
}

// ========== BADGE DEL SIDEBAR (contador de avisos) ==========
// Pinta un contador rojo en la pestaña Omnes (sidebar + tab horizontal) para que
// se vean los avisos pendientes sin entrar. Reusa el MISMO cálculo del feed.
const OMNES_COUNT_STYLE = 'background:#ef4444;color:#fff;border-radius:999px;min-width:18px;height:18px;padding:0 5px;font-size:11px;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;';

function setBadgeOmnes(n) {
    document.querySelectorAll('[data-tab="inteligencia"]').forEach(btn => {
        let b = btn.querySelector('.omnes-count');
        if (n > 0) {
            if (!b) {
                b = document.createElement('span');
                b.className = 'omnes-count';
                b.style.cssText = OMNES_COUNT_STYLE;
                btn.appendChild(b);
            }
            b.textContent = n > 9 ? '9+' : String(n);
            b.style.display = 'inline-flex';
            b.title = n === 1 ? '1 aviso de Omnes' : `${n} avisos de Omnes`;
        } else if (b) {
            b.style.display = 'none';
        }
    });
}

let _omnesBadgeRunning = false;
async function refrescarBadgeOmnes() {
    if (_omnesBadgeRunning) return;
    if (typeof window === 'undefined' || !window.authToken) return; // sin sesión, nada que contar
    _omnesBadgeRunning = true;
    try {
        const avisos = await construirAvisos({
            fetchIntelligence,
            ingredientes: window.ingredientes,
            pedidos: window.pedidos,
        });
        setBadgeOmnes(filtrarVisibles(avisos).length);
    } catch (err) {
        console.error('[Omnes] error refrescando badge:', err);
    } finally {
        _omnesBadgeRunning = false;
    }
}

// Recalcular el badge cada vez que se recargan los datos (mismo evento que el dashboard).
window.addEventListener('dashboard:refresh', refrescarBadgeOmnes);
window.refrescarBadgeOmnes = refrescarBadgeOmnes;

// Listener delegado para descartar avisos (data-attribute en vez de onclick inline,
// para no construir JS a partir de datos interpolados — defensa contra XSS).
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.omnes-card-dismiss');
    if (!btn) return;
    e.stopPropagation();
    window.omnesDescartar(btn.dataset.dismissId);
});

// Listener delegado para plegar/desplegar una sección al pulsar su cabecera.
document.addEventListener('click', (e) => {
    const head = e.target.closest('.omnes-sec-head');
    if (!head) return;
    head.closest('.omnes-sec')?.classList.toggle('collapsed');
});

// Listener delegado para "Pregúntale a Omnes": abre el chat con la pregunta del aviso.
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.omnes-card-ask');
    if (!btn) return;
    e.stopPropagation();
    const q = btn.dataset.omnesAsk || '';
    if (typeof window.preguntarAOmnes === 'function') {
        const ok = window.preguntarAOmnes(q);
        if (!ok) window.showToast?.(t('inteligencia:omnes_ask_unavailable'), 'info');
    }
});

/**
 * El usuario descarta un aviso: lo persiste (tenant-scoped, TTL 7d), quita la
 * tarjeta del DOM y recalcula chips + badge desde lo que queda visible — sin
 * recargar la pestaña (no salta el scroll ni re-fetchea).
 */
window.omnesDescartar = function (id) {
    dismissAviso(id);
    const safeId = (window.CSS && window.CSS.escape) ? window.CSS.escape(id) : id;
    const card = document.querySelector(`.omnes-card[data-aviso-id="${safeId}"]`);
    const sec = card ? card.closest('.omnes-sec') : null;
    if (card) card.remove();

    // Actualizar el contador de la sección, y quitarla si quedó vacía.
    if (sec) {
        const restantes = sec.querySelectorAll('.omnes-card').length;
        if (restantes === 0) {
            sec.remove();
        } else {
            const cnt = sec.querySelector('.omnes-sec-count');
            if (cnt) cnt.textContent = String(restantes);
        }
    }

    const feedEl = document.querySelector('.omnes-feed');
    const quedan = feedEl ? feedEl.querySelectorAll('.omnes-card').length : 0;

    // Repintar chips de resumen del hero
    const chipsEl = document.getElementById('omnes-chips');
    if (chipsEl) {
        const nCrit = document.querySelectorAll('.omnes-card.critico').length;
        const nAten = document.querySelectorAll('.omnes-card.atencion').length;
        chipsEl.innerHTML = chipsHTML(nCrit, nAten);
    }
    setBadgeOmnes(quedan);

    // Si no queda ninguno, mostrar el estado vacío en lugar del feed
    if (feedEl && quedan === 0) {
        feedEl.outerHTML = renderEmpty();
    }
};

/**
 * Deep-link desde un aviso al item concreto (no solo a la pestaña).
 *   receta      → abre la ficha de la receta para ajustar el precio
 *   ingrediente → abre la ficha del ingrediente
 *   pedido      → cambia a Pedidos y añade el ingrediente al carrito
 */
window.omnesIr = function (tipo, id) {
    const itemId = Number(id);
    if (!Number.isFinite(itemId)) return;
    if (tipo === 'receta') {
        window.cambiarTab?.('recetas');
        if (typeof window.editarReceta === 'function') window.editarReceta(itemId);
    } else if (tipo === 'ingrediente') {
        window.cambiarTab?.('ingredientes');
        if (typeof window.editarIngrediente === 'function') window.editarIngrediente(itemId);
    } else if (tipo === 'pedido') {
        window.cambiarTab?.('pedidos');
        if (typeof window.agregarAlCarrito === 'function') window.agregarAlCarrito(itemId, 1);
    }
};

window.renderizarInteligencia = renderizarInteligencia;
