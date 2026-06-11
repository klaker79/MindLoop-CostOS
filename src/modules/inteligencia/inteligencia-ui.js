import { t } from '@/i18n/index.js';
import { escapeHTML, getDateLocale } from '../../utils/helpers.js';
import { construirAvisos } from './omnes-avisos.js';

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

.omnes-feed { display: flex; flex-direction: column; gap: 12px; max-width: 920px; }
.omnes-card {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 16px 18px;
    border-radius: 16px;
    background: rgba(30,41,59,0.72);
    border: 1px solid rgba(99,102,241,0.15);
    border-left: 4px solid #64748b;
    transition: transform .12s ease, box-shadow .12s ease;
}
.omnes-card:hover { transform: translateY(-1px); box-shadow: 0 14px 40px -22px rgba(0,0,0,0.9); }
.omnes-card.critico { border-left-color: #ef4444; }
.omnes-card.atencion { border-left-color: #f97316; }
.omnes-card.oportunidad { border-left-color: #22c55e; }
.omnes-card-icon {
    width: 44px; height: 44px; flex-shrink: 0;
    border-radius: 12px; font-size: 22px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(15,23,42,0.7);
}
.omnes-card-body { flex: 1; min-width: 0; }
.omnes-card-label {
    font-size: 0.68rem; font-weight: 800; letter-spacing: 0.8px;
    text-transform: uppercase; margin-bottom: 3px;
}
.omnes-card.critico .omnes-card-label { color: #f87171; }
.omnes-card.atencion .omnes-card-label { color: #fb923c; }
.omnes-card.oportunidad .omnes-card-label { color: #4ade80; }
.omnes-card-text { font-size: 0.95rem; color: #e2e8f0; line-height: 1.45; }
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
    .omnes-card-cta { width: 100%; }
}
</style>
`;

const OWL_SRC = '/images/omnes.png';
// Si la foto no carga, degradamos a emoji 🦉 (mismo patrón que el avatar del chat).
const OWL_FALLBACK = `onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🦉',style:'font-size:64px;line-height:1'}))"`;

// ========== RENDER ==========
function renderAvisoCard(a) {
    // a.titulo / a.texto / a.cta.label vienen de t(): i18next ya escapa los valores
    // interpolados (escapeValue:true) → son HTML seguro. Volver a escaparlos haría
    // doble escape (&amp; → &amp;amp;). a.cta.tipo es un literal fijo y a.cta.id un número.
    const label = a.titulo ? `<div class="omnes-card-label">${a.titulo}</div>` : '';
    const cta = a.cta
        ? `<button class="omnes-card-cta" onclick="window.omnesIr('${a.cta.tipo}', ${a.cta.id})">${a.cta.label} →</button>`
        : '';
    return `
        <div class="omnes-card ${a.nivel}">
            <div class="omnes-card-icon">${a.icono || '🦉'}</div>
            <div class="omnes-card-body">
                ${label}
                <div class="omnes-card-text">${a.texto}</div>
            </div>
            ${cta}
        </div>
    `;
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

    const nCrit = avisos.filter(a => a.nivel === 'critico').length;
    const nAten = avisos.filter(a => a.nivel === 'atencion').length;
    const time = new Date().toLocaleTimeString(getDateLocale(), { hour: '2-digit', minute: '2-digit' });

    const chips = avisos.length === 0
        ? `<span class="omnes-chip ok">✅ ${escapeHTML(t('inteligencia:omnes_chip_ok'))}</span>`
        : `
            ${nCrit ? `<span class="omnes-chip crit">🔴 ${t('inteligencia:omnes_chip_crit', { count: nCrit })}</span>` : ''}
            ${nAten ? `<span class="omnes-chip aten">🟠 ${t('inteligencia:omnes_chip_aten', { count: nAten })}</span>` : ''}
        `;

    const feed = avisos.length === 0
        ? renderEmpty()
        : `<div class="omnes-feed">${avisos.map(renderAvisoCard).join('')}</div>`;

    container.innerHTML = `
        <div class="omnes-wrap">
            <div class="omnes-hero">
                <img class="omnes-owl" src="${OWL_SRC}" alt="Omnes" ${OWL_FALLBACK}>
                <div class="omnes-hero-text">
                    <h1>${escapeHTML(t('inteligencia:omnes_title'))}</h1>
                    <div class="omnes-tagline">${escapeHTML(t('inteligencia:omnes_tagline'))}</div>
                    <div class="omnes-summary" style="margin-top:12px;">${chips}</div>
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
