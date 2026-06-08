/**
 * Help Modal — videos tutoriales de YouTube por pestaña.
 *
 * Inserta un botón "?" en el header (top-bar) de cada pestaña que tenga
 * entrada en HELP_VIDEOS. Al pulsarlo, abre un modal con:
 *
 *   - Si la entry trae `videos: [...]` → reproductor + lista de miniaturas
 *     clickables debajo. El usuario elige libremente qué vídeo ver.
 *   - Si la entry trae solo `videoId` → reproductor único.
 *   - Si la entry trae solo `playlistId` → reproductor con cola embebida.
 *
 * Inicialización: llamar `mountHelpModal()` una vez al cargar la app.
 * Es idempotente: si ya está montado, no duplica el modal.
 */
import { HELP_VIDEOS } from './help-config.js';

const MODAL_ID = 'help-modal-overlay';
const BTN_CLASS = 'help-modal-btn';

function videoEmbedSrc(videoId) {
    // youtube-nocookie.com — privacy-enhanced. Mismas funcionalidades de embed.
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`;
}

function playlistEmbedSrc(playlistId) {
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&rel=0`;
}

function thumbUrl(videoId) {
    // mqdefault: 320x180 — ligero y suficiente para grid de miniaturas.
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

function ensureModalNode() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0, 0, 0, 0.75);
        display: none; align-items: center; justify-content: center;
        padding: 20px;
    `;
    modal.innerHTML = `
        <div class="help-modal-content" style="
            background: #1e293b; border-radius: 14px; overflow: hidden;
            width: 100%; max-width: 960px; max-height: 90vh;
            display: flex; flex-direction: column;
            position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
            <button class="help-modal-close" aria-label="Cerrar"
                style="position: absolute; top: 12px; right: 12px; z-index: 2;
                       background: rgba(0,0,0,0.6); color: white; border: none;
                       width: 36px; height: 36px; border-radius: 50%;
                       font-size: 22px; cursor: pointer; line-height: 1;">×</button>
            <div class="help-modal-player" style="aspect-ratio: 16/9; width: 100%; background: black;">
                <iframe class="help-modal-iframe"
                    src="" frameborder="0" allowfullscreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    style="width: 100%; height: 100%; border: 0; display: block;"></iframe>
            </div>
            <div class="help-modal-list"
                style="padding: 14px 16px; overflow-y: auto; max-height: 220px;
                       display: none; gap: 12px; flex-wrap: wrap;
                       border-top: 1px solid rgba(255,255,255,0.08);"></div>
        </div>
    `;

    // Cerrar al pulsar fuera del contenido del modal o el botón ×.
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('help-modal-close')) {
            closeHelpModal();
        }
    });

    // Cerrar con ESC.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeHelpModal();
        }
    });

    document.body.appendChild(modal);
    return modal;
}

/**
 * Pinta la lista de miniaturas debajo del iframe. Click en una miniatura
 * cambia el src del iframe para reproducir ese vídeo.
 */
function renderVideoList(modal, videos) {
    const list = modal.querySelector('.help-modal-list');
    const iframe = modal.querySelector('.help-modal-iframe');
    list.innerHTML = '';
    list.style.display = 'flex';

    videos.forEach((v, idx) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'help-modal-list-item';
        item.dataset.videoId = v.videoId;
        item.style.cssText = `
            display: flex; gap: 10px; align-items: center;
            padding: 6px; border-radius: 8px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
            color: #e2e8f0; cursor: pointer; text-align: left;
            min-width: 220px; flex: 1 1 220px;
            transition: background 0.15s, border-color 0.15s;
        `;
        item.innerHTML = `
            <img src="${thumbUrl(v.videoId)}" alt=""
                style="width: 96px; height: 54px; object-fit: cover;
                       border-radius: 4px; flex-shrink: 0;">
            <span style="font-size: 13px; line-height: 1.3;">${v.title || `Vídeo ${idx + 1}`}</span>
        `;
        item.addEventListener('click', () => {
            iframe.src = videoEmbedSrc(v.videoId);
            // Marcar el activo
            list.querySelectorAll('.help-modal-list-item').forEach(b => {
                b.style.borderColor = b === item ? '#6366f1' : 'rgba(255,255,255,0.06)';
                b.style.background = b === item ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)';
            });
        });
        list.appendChild(item);
    });

    // Marcar el primero como activo (es el que arranca por defecto).
    const first = list.querySelector('.help-modal-list-item');
    if (first) {
        first.style.borderColor = '#6366f1';
        first.style.background = 'rgba(99,102,241,0.15)';
    }
}

export function openTabHelp(tabKey) {
    const entry = HELP_VIDEOS[tabKey];
    if (!entry) return;

    // Placeholder: pestaña que reserva el botón "Ver tutorial" pero aún no
    // tiene vídeo grabado. Mostramos un toast en lugar de abrir un modal
    // vacío. Cuando Iker grabe el vídeo, basta con cambiar `placeholder: true`
    // por `videoId: 'XXX'` en help-config.js.
    if (entry.placeholder && !entry.videoId && !entry.playlistId && !(Array.isArray(entry.videos) && entry.videos.length)) {
        const msg = '🎬 Vídeo tutorial en preparación — próximamente disponible';
        if (window.showToast) window.showToast(msg, 'info');
        else alert(msg);
        return;
    }

    const modal = ensureModalNode();
    const iframe = modal.querySelector('.help-modal-iframe');
    const list = modal.querySelector('.help-modal-list');

    // Reset list por si abrimos otra pestaña con otra forma de entry
    list.innerHTML = '';
    list.style.display = 'none';

    if (Array.isArray(entry.videos) && entry.videos.length > 0) {
        // Lista de vídeos: arrancar con el primero, mostrar miniaturas
        iframe.src = videoEmbedSrc(entry.videos[0].videoId);
        renderVideoList(modal, entry.videos);
    } else if (entry.videoId) {
        iframe.src = videoEmbedSrc(entry.videoId);
    } else if (entry.playlistId) {
        iframe.src = playlistEmbedSrc(entry.playlistId);
    } else {
        return; // entry inválida
    }

    modal.style.display = 'flex';
}

export function closeHelpModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.style.display = 'none';
    // Resetear el iframe para detener la reproducción del video.
    const iframe = modal.querySelector('.help-modal-iframe');
    if (iframe) iframe.src = '';
}

function injectButtonInTab(tabKey) {
    if (!HELP_VIDEOS[tabKey]) return;

    const tabContent = document.getElementById(`tab-${tabKey}`);
    if (!tabContent) return;

    const topBar = tabContent.querySelector('.top-bar');
    if (!topBar) return;

    // Evitar duplicados al re-montar.
    if (topBar.querySelector(`.${BTN_CLASS}`)) return;

    // 2026-06-08: en lugar de inyectar 2 botones separados ("🎬 Ver tutorial"
    // y "ℹ️ Cómo funcionan"), inyectamos UN solo dropdown "? Ayuda" que
    // agrupa ambas opciones. Patrón Notion: menos saturación visual.
    const wrapper = document.createElement('div');
    wrapper.className = `ad-wrapper ${BTN_CLASS}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary ad-trigger ad-help-trigger';
    btn.setAttribute('aria-label', 'Ayuda de esta pestaña');
    btn.title = 'Ayuda · tutorial y cómo funciona esta pestaña';
    btn.innerHTML = '?';

    const menu = document.createElement('div');
    menu.className = 'ad-menu ad-menu--left';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
        <button type="button" role="menuitem" class="help-menu-tutorial">
            <span class="ad-icon">🎬</span>
            <span>Ver tutorial en video</span>
        </button>
        <button type="button" role="menuitem" class="help-menu-info">
            <span class="ad-icon">ℹ️</span>
            <span>Cómo funciona esta sección</span>
        </button>
    `;

    menu.querySelector('.help-menu-tutorial').addEventListener('click', () => openTabHelp(tabKey));
    menu.querySelector('.help-menu-info').addEventListener('click', () => {
        if (typeof window !== 'undefined' && typeof window.openInfoTab === 'function') {
            window.openInfoTab(tabKey);
        }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(menu);

    // El wrapper (.ad-wrapper) es lo que se inyecta — contiene botón "?"
    // + menú colgante. Lo tratamos como un único nodo desde el DOM padre.
    const injectable = wrapper;

    // Mismos 4 casos de antes (Ingredientes/Recetas → div flex existente;
    // Proveedores → botones sueltos; Inventario → div hermano; etc).
    const directDivs = Array.from(topBar.children).filter(c => c.tagName === 'DIV');
    const directButtons = Array.from(topBar.children).filter(c => c.tagName === 'BUTTON');

    if (directButtons.length > 0) {
        // Caso 2: agrupar botón(es) suelto(s) + el nuevo en un grupo.
        const group = document.createElement('div');
        group.style.cssText = 'display: flex; gap: 10px; align-items: center;';
        directButtons.forEach(b => group.appendChild(b));
        group.appendChild(injectable);
        topBar.appendChild(group);
    } else if (directDivs.length > 1) {
        // Caso 1: usar el wrapper de acciones existente.
        directDivs[directDivs.length - 1].appendChild(injectable);
    } else {
        // Caso 3: buscar div hermano siguiente con botones (patrón Inventario).
        const siblingActions = tabContent.querySelector('.top-bar + div');
        if (siblingActions && siblingActions.querySelector('button')) {
            siblingActions.appendChild(injectable);
        } else {
            // Caso 4: append simple al top-bar.
            topBar.appendChild(injectable);
        }
    }
}

export function mountHelpModal() {
    ensureModalNode();
    Object.keys(HELP_VIDEOS).forEach(injectButtonInTab);
    // 2026-06-08: tras inyectar los dropdowns "? Ayuda", montamos el binding
    // de toggle/cierre. mountActionDropdowns es idempotente — si los wrappers
    // ya están bindeados los salta.
    if (typeof window !== 'undefined' && typeof window.mountActionDropdowns === 'function') {
        window.mountActionDropdowns();
    }
}

// Exponer para uso desde inline handlers o consola si fuera útil.
if (typeof window !== 'undefined') {
    window.openTabHelp = openTabHelp;
    window.closeHelpModal = closeHelpModal;
}
