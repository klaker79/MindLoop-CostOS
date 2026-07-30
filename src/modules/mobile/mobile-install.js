/**
 * modules/mobile/mobile-install.js
 * ============================================
 * Invitación a instalar CosteOS en la pantalla de inicio.
 *
 * La app ya era instalable (manifest + service worker), pero **nadie lo sabía**:
 * no había ninguna pista en pantalla, y añadir una web a la pantalla de inicio
 * no es algo que un hostelero haga por su cuenta. Sin esto, la mayoría se queda
 * usándola dentro del navegador, con su barra de direcciones y sin sensación de
 * app.
 *
 * Dos caminos, porque los sistemas no se comportan igual:
 *  - **Android/Chrome** dispara `beforeinstallprompt`. Lo interceptamos, lo
 *    guardamos y lo lanzamos cuando el usuario pulsa "Instalar": un diálogo
 *    nativo y listo.
 *  - **iOS/Safari** NO tiene ese evento ni forma de instalar por código. Ahí lo
 *    único posible es explicar el gesto: Compartir → Añadir a pantalla de inicio.
 *
 * Reglas para no molestar:
 *  - No se muestra si ya está instalada.
 *  - No se muestra en escritorio.
 *  - No aparece de golpe al abrir: espera unos segundos, para no recibir al
 *    usuario con un cartel antes de que vea la app.
 *  - Si la descarta, no vuelve a salir en 30 días. Si la instala, nunca más.
 *
 * @module modules/mobile/mobile-install
 */

/**
 * Clave SIN scope de tenant a propósito: instalar la app es una decisión del
 * DISPOSITIVO, no del restaurante. Si fuera por tenant, cambiar de cuenta en el
 * mismo móvil volvería a sacar el cartel de una app que ya está instalada.
 * (No está en LEGACY_KEYS_TO_PURGE de tenant-storage, así que no se borra.)
 */
const CLAVE_DESCARTE = 'ml_install_dismissed_at';

/** Días de silencio tras descartar el cartel. */
const DIAS_SILENCIO = 30;

/** Margen antes de aparecer, para no recibir al usuario con un cartel. */
const RETARDO_MS = 8000;

/** ¿La app ya se está ejecutando instalada (sin barra del navegador)? */
export function estaInstalada() {
    if (typeof window === 'undefined') return false;
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
    // iOS no soporta display-mode: standalone; usa esta propiedad no estándar.
    return Boolean(standalone || window.navigator?.standalone);
}

/** ¿Es un iPhone/iPad con Safari? Ahí no existe `beforeinstallprompt`. */
export function esIosSafari(ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
    const esIos = /iPad|iPhone|iPod/.test(ua);
    // Chrome y Firefox en iOS (CriOS/FxiOS) tampoco pueden instalar, pero su
    // menú es distinto; el texto que damos es el de Safari, así que los dejamos
    // fuera para no dar instrucciones equivocadas.
    const esSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return esIos && esSafari;
}

/**
 * ¿Toca enseñar la invitación?
 *
 * Función pura para poder probar la decisión sin navegador.
 *
 * @param {object} o
 * @param {boolean} o.instalada
 * @param {boolean} o.esMovil
 * @param {string|null} o.descartadaEn - epoch ms en texto, o null
 * @param {number} o.ahora - epoch ms
 * @returns {boolean}
 */
export function debeInvitar({ instalada, esMovil, descartadaEn, ahora }) {
    if (instalada) return false;
    if (!esMovil) return false;
    if (!descartadaEn) return true;
    const cuando = Number(descartadaEn);
    if (!Number.isFinite(cuando)) return true;   // valor corrupto → volver a preguntar
    return (ahora - cuando) > DIAS_SILENCIO * 24 * 60 * 60 * 1000;
}

function esMovil() {
    return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)')?.matches;
}

function descartar() {
    try { localStorage.setItem(CLAVE_DESCARTE, String(Date.now())); } catch { /* modo privado */ }
    document.getElementById('ml-install-sheet')?.remove();
}

/**
 * Pinta el cartel. `promptEvent` es el `beforeinstallprompt` guardado; si es
 * null, se muestran las instrucciones de iOS.
 */
function pintar(promptEvent) {
    if (document.getElementById('ml-install-sheet')) return;

    const ov = document.createElement('div');
    ov.id = 'ml-install-sheet';
    ov.style.cssText = [
        'position:fixed', 'left:12px', 'right:12px',
        // Por encima de la barra de navegación inferior y del área segura del iPhone.
        'bottom:calc(76px + env(safe-area-inset-bottom, 0px))',
        'z-index:9500', 'background:#fff', 'border:1px solid #efe1d5',
        'border-radius:16px', 'box-shadow:0 10px 30px rgba(58,34,22,.18)',
        'padding:14px 16px', 'font-size:14px', 'color:#3a2216',
    ].join(';');

    const accion = promptEvent
        ? '<button type="button" data-act="instalar" style="flex:1;background:linear-gradient(135deg,#b0533a,#8c3f2b);color:#fff;border:none;padding:11px 14px;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer;">Instalar</button>'
        : '';

    ov.innerHTML = `
      <div style="display:flex;gap:11px;align-items:flex-start;">
        <div style="flex:0 0 auto;width:38px;height:38px;border-radius:11px;background:#f7e9e1;display:flex;align-items:center;justify-content:center;font-size:20px;">📲</div>
        <div style="flex:1;min-width:0;">
          <b style="display:block;font-size:14.5px;margin-bottom:3px;">Ten CosteOS a mano</b>
          <span style="display:block;font-size:12.5px;line-height:1.45;color:#a07d68;">${promptEvent
        ? 'Añádelo a tu pantalla de inicio y ábrelo como una app, sin el navegador.'
        : 'Pulsa <b>Compartir</b> abajo y elige <b>Añadir a pantalla de inicio</b>.'}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${accion}
        <button type="button" data-act="cerrar" style="flex:${promptEvent ? '0 0 auto' : '1'};background:#fff;color:#a07d68;border:1px solid #efe1d5;padding:11px 14px;border-radius:11px;font-weight:600;font-size:14px;cursor:pointer;">Ahora no</button>
      </div>`;

    ov.addEventListener('click', async (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act === 'cerrar') { descartar(); return; }
        if (act === 'instalar' && promptEvent) {
            ov.remove();
            try {
                promptEvent.prompt();
                await promptEvent.userChoice;
            } catch { /* el navegador puede invalidar el evento; no rompe nada */ }
            // Instale o no, no volvemos a insistir en un tiempo.
            descartar();
        }
    });

    document.body.appendChild(ov);
}

/**
 * Arranca la invitación. No hace nada en escritorio, ni si ya está instalada,
 * ni si el usuario la descartó hace poco.
 */
export function initInstallPrompt() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let descartadaEn = null;
    try { descartadaEn = localStorage.getItem(CLAVE_DESCARTE); } catch { /* modo privado */ }

    if (!debeInvitar({
        instalada: estaInstalada(),
        esMovil: esMovil(),
        descartadaEn,
        ahora: Date.now(),
    })) return;

    // Android/Chrome: el navegador nos cede el control del diálogo de instalación.
    let guardado = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();            // sin esto Chrome pinta su propio aviso
        guardado = e;
        setTimeout(() => pintar(guardado), RETARDO_MS);
    });

    // iOS/Safari: no hay evento posible, así que se explica el gesto a mano.
    if (esIosSafari()) {
        setTimeout(() => { if (!guardado) pintar(null); }, RETARDO_MS);
    }

    // Si la instala, el cartel sobra para siempre.
    window.addEventListener('appinstalled', () => {
        try { localStorage.setItem(CLAVE_DESCARTE, String(Date.now())); } catch { /* no-op */ }
        document.getElementById('ml-install-sheet')?.remove();
    });
}

export default { initInstallPrompt, debeInvitar, estaInstalada, esIosSafari };
