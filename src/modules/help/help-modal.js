/**
 * Help Modal — videos tutoriales de YouTube por pestaña.
 *
 * Inserta un botón "?" en el header (top-bar) de cada pestaña que tenga
 * entrada en HELP_VIDEOS. Al pulsarlo, abre un modal con un iframe de
 * YouTube embebido (video único o playlist completa según el mapping).
 *
 * Inicialización: llamar `mountHelpModal()` una vez al cargar la app.
 * Es idempotente: si ya está montado, no duplica el modal.
 */
import { HELP_VIDEOS } from './help-config.js';

const MODAL_ID = 'help-modal-overlay';
const BTN_CLASS = 'help-modal-btn';

function buildEmbedUrl(entry) {
    // Usamos youtube-nocookie.com — versión privacy-enhanced que no setea
    // cookies de tracking salvo que el usuario interactúe con el video.
    // Mismas funcionalidades de embed que youtube.com.
    if (entry.playlistId) {
        return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(entry.playlistId)}&rel=0`;
    }
    if (entry.videoId) {
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(entry.videoId)}?rel=0`;
    }
    return null;
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
            width: 100%; max-width: 960px; aspect-ratio: 16/9;
            position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
            <button class="help-modal-close" aria-label="Cerrar"
                style="position: absolute; top: 12px; right: 12px; z-index: 2;
                       background: rgba(0,0,0,0.6); color: white; border: none;
                       width: 36px; height: 36px; border-radius: 50%;
                       font-size: 22px; cursor: pointer; line-height: 1;">×</button>
            <iframe class="help-modal-iframe"
                src="" frameborder="0" allowfullscreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style="width: 100%; height: 100%; border: 0;"></iframe>
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

export function openTabHelp(tabKey) {
    const entry = HELP_VIDEOS[tabKey];
    if (!entry) return;

    const url = buildEmbedUrl(entry);
    if (!url) return;

    const modal = ensureModalNode();
    const iframe = modal.querySelector('.help-modal-iframe');
    iframe.src = url;
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

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-secondary ${BTN_CLASS}`;
    btn.setAttribute('aria-label', 'Ver tutorial de esta pestaña');
    btn.title = 'Ver tutorial en video';
    btn.innerHTML = '🎬 Ver tutorial';
    btn.addEventListener('click', () => openTabHelp(tabKey));

    // Localizar el contenedor de acciones del top-bar. En la mayoría de
    // pestañas es un <div> con flex-gap que aloja "Añadir", "Importar",
    // etc. En Proveedores el botón "Añadir Proveedor" está suelto sin
    // wrapper. Cubrimos ambos casos:
    //   1) Si existe un div NO-primero (típicamente con los botones), allí.
    //   2) Si no, al final del propio top-bar (queda al lado del botón
    //      principal "Añadir X").
    const allDivs = topBar.querySelectorAll(':scope > div');
    const actionsContainer = allDivs.length > 1 ? allDivs[allDivs.length - 1] : null;

    if (actionsContainer) {
        actionsContainer.appendChild(btn);
    } else {
        topBar.appendChild(btn);
    }
}

export function mountHelpModal() {
    ensureModalNode();
    Object.keys(HELP_VIDEOS).forEach(injectButtonInTab);
}

// Exponer para uso desde inline handlers o consola si fuera útil.
if (typeof window !== 'undefined') {
    window.openTabHelp = openTabHelp;
    window.closeHelpModal = closeHelpModal;
}
