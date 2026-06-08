/**
 * Info modal — sistema unificado de modales "ℹ️ Cómo funcionan" por pestaña.
 *
 * Cada pestaña con entrada en `info-content.json` (i18n del idioma activo)
 * recibe automáticamente un botón "ℹ️ Cómo funcionan" en su barra de
 * acciones. Al pulsarlo, se abre un modal con título + lead + N bloques
 * con bordes coloreados.
 *
 * Para añadir contenido a una pestaña nueva: editar
 * `src/i18n/locales/{lang}/info-content.json` y añadir una entry con la
 * clave de la pestaña (la misma que usa `tab-{key}` en index.html). Sin
 * tocar HTML ni event-bindings. Si una pestaña NO tiene entrada, el
 * botón no aparece — degradación silenciosa.
 *
 * Shape de cada pestaña en el JSON:
 *   {
 *     "title": "ℹ️ Título del modal",
 *     "lead": "Subtítulo / introducción (opcional)",
 *     "blocks": [
 *       { "title": "🗑️ Heading", "body": "Texto...", "color": "blue" }
 *     ]
 *   }
 *
 * Colores soportados: blue (default), amber (warning), green (tip), red.
 */

import { t } from '@/i18n/index.js';

const MODAL_ID = 'info-modal-overlay';
const BTN_CLASS = 'info-modal-btn';

const COLOR_STYLES = {
    blue:  { bg: '#f0f9ff', border: '#0284c7', title: '#0284c7' },
    amber: { bg: '#fffbeb', border: '#f59e0b', title: '#92400e' },
    green: { bg: '#ecfdf5', border: '#10b981', title: '#065f46' },
    red:   { bg: '#fef2f2', border: '#dc2626', title: '#991b1b' }
};

/**
 * Carga el JSON de contenido para el idioma activo. Fallback a 'es' si
 * el idioma no tiene archivo. Cacheado en memoria tras la primera carga.
 */
let _contentCache = null;
let _contentLang = null;

async function loadInfoContent() {
    const lang = (window.getCurrentLanguage?.() || 'es').toLowerCase().split('-')[0];
    if (_contentCache && _contentLang === lang) return _contentCache;
    try {
        // Import dinámico — Vite resuelve el path estático.
        const module = await import(`../../i18n/locales/${lang}/info-content.json`);
        _contentCache = module.default || module;
        _contentLang = lang;
        return _contentCache;
    } catch (err) {
        // Idioma sin archivo → caer a español.
        if (lang !== 'es') {
            const fallback = await import('../../i18n/locales/es/info-content.json');
            _contentCache = fallback.default || fallback;
            _contentLang = 'es';
            return _contentCache;
        }
        console.warn('[info-modal] No se pudo cargar info-content:', err.message);
        return {};
    }
}

function escapeHTML(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureModalNode() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0, 0, 0, 0.55);
        display: none; align-items: center; justify-content: center;
        padding: 20px;
    `;
    modal.innerHTML = `
        <div class="info-modal-content" style="
            background: white; border-radius: 14px;
            width: 100%; max-width: 720px; max-height: 90vh;
            display: flex; flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
            overflow: hidden;
        ">
            <div class="info-modal-header" style="padding: 20px 24px 12px; border-bottom: 1px solid #e2e8f0;">
                <button class="info-modal-close" aria-label="${escapeHTML(t('common:btn_close', 'Cerrar'))}"
                    style="position: absolute; top: 14px; right: 14px;
                           background: none; border: none; font-size: 28px;
                           color: #64748b; cursor: pointer; line-height: 1;">×</button>
                <h2 class="info-modal-title" style="margin: 0; color: #0284c7;
                    display: flex; align-items: center; gap: 10px; font-size: 20px;"></h2>
                <p class="info-modal-lead" style="color: #64748b; margin: 8px 0 0;
                    font-size: 13px; line-height: 1.5;"></p>
            </div>
            <div class="info-modal-body" style="padding: 20px 24px; overflow-y: auto;
                line-height: 1.6; color: #1e293b; font-size: 14px;"></div>
            <div class="info-modal-footer" style="padding: 14px 24px;
                border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
                <button class="btn btn-secondary info-modal-close-btn">${escapeHTML(t('common:btn_close', 'Cerrar'))}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => { modal.style.display = 'none'; };
    modal.querySelector('.info-modal-close').addEventListener('click', close);
    modal.querySelector('.info-modal-close-btn').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.style.display !== 'none') close();
    });

    return modal;
}

function renderBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return '';
    return blocks.map(b => {
        const color = COLOR_STYLES[b.color] || COLOR_STYLES.blue;
        return `
            <div style="margin-bottom: 14px; padding: 12px 14px;
                background: ${color.bg};
                border-left: 3px solid ${color.border};
                border-radius: 6px;">
                <strong style="color: ${color.title};">${escapeHTML(b.title || '')}</strong>
                <br>
                <span>${escapeHTML(b.body || '')}</span>
            </div>
        `;
    }).join('');
}

export async function openInfoTab(tabKey) {
    const content = await loadInfoContent();
    const entry = content[tabKey];
    if (!entry) {
        console.warn(`[info-modal] Sin contenido para pestaña: ${tabKey}`);
        return;
    }
    const modal = ensureModalNode();
    modal.querySelector('.info-modal-title').textContent = entry.title || '';
    const lead = modal.querySelector('.info-modal-lead');
    if (entry.lead) {
        lead.textContent = entry.lead;
        lead.style.display = '';
    } else {
        lead.style.display = 'none';
    }
    modal.querySelector('.info-modal-body').innerHTML = renderBlocks(entry.blocks || []);
    modal.style.display = 'flex';
}

/**
 * Inyecta el botón "ℹ️ Cómo funcionan" en la barra de acciones de la
 * pestaña indicada. Reproduce los 4 casos de help-modal:injectButtonInTab
 * para encajar con cualquier layout (top-bar con botones / div hermano /
 * etc). Idempotente: no duplica si ya está montado.
 */
function injectInfoButton(tabKey) {
    const tabContent = document.getElementById(`tab-${tabKey}`);
    if (!tabContent) return;

    const topBar = tabContent.querySelector('.top-bar');
    if (!topBar) return;

    if (topBar.querySelector(`.${BTN_CLASS}`) ||
        tabContent.querySelector(`.${BTN_CLASS}`)) return;

    const btnLabel = t('common:info_modal_btn', 'ℹ️ Cómo funcionan');
    const btnAria = t('common:info_modal_btn_aria', 'Cómo funciona esta pestaña');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-secondary ${BTN_CLASS}`;
    btn.setAttribute('aria-label', btnAria);
    btn.title = btnAria;
    btn.innerHTML = btnLabel;
    btn.addEventListener('click', () => openInfoTab(tabKey));

    const directDivs = Array.from(topBar.children).filter(c => c.tagName === 'DIV');
    const directButtons = Array.from(topBar.children).filter(c => c.tagName === 'BUTTON');

    if (directButtons.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; gap: 10px; align-items: center;';
        directButtons.forEach(b => wrapper.appendChild(b));
        wrapper.appendChild(btn);
        topBar.appendChild(wrapper);
    } else if (directDivs.length > 1) {
        directDivs[directDivs.length - 1].appendChild(btn);
    } else {
        // Buscar div hermano siguiente con botones (patrón Inventario).
        const siblingActions = tabContent.querySelector('.top-bar + div');
        if (siblingActions && siblingActions.querySelector('button')) {
            siblingActions.appendChild(btn);
        } else {
            topBar.appendChild(btn);
        }
    }
}

export async function mountInfoModal() {
    ensureModalNode();
    // 2026-06-08: ya no inyectamos botón propio "ℹ️ Cómo funcionan" — ahora va
    // dentro del dropdown "? Ayuda" del help-modal junto con el tutorial.
    // Solo preparamos el contenido y exponemos openInfoTab para que el
    // dropdown lo llame.
    await loadInfoContent();
}

// `injectInfoButton` permanece definida arriba para compat / fallback
// futuro pero ya no se invoca desde mountInfoModal.
// eslint-disable-next-line no-unused-vars
const _legacyInjectInfoButton = injectInfoButton;

if (typeof window !== 'undefined') {
    window.addEventListener('languageChanged', async () => {
        _contentCache = null;
        _contentLang = null;
        await loadInfoContent();
    });
    window.openInfoTab = openInfoTab;
}
