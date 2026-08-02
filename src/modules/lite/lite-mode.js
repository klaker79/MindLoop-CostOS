/**
 * 🪶 Modo LITE — la casa Lite es "lo justo".
 *
 * DECISIÓN DE PRODUCTO (Iker, 2026-08-02): Lite NO lleva chat inteligente.
 * Sí lleva OCR, y sí lleva el informe mensual — pero como ENTREGABLE de un
 * botón, no como conversación.
 *
 *   · Lite       → un informe al mes.
 *   · App grande → además, Omnes con su cuota de consultas.
 *
 * Son productos distintos: uno es un entregable, el otro es poder preguntar lo
 * que quieras cuando quieras. Por eso el informe no canibaliza a Omnes y sí
 * justifica la diferencia de precio.
 *
 * ⚠️ ESTO ES LA CAPA VISIBLE, NO EL CORTE. El corte de verdad está en el
 * servidor: `lite-api` arranca con CHAT_ENABLED=false y ni siquiera monta el
 * router del chat (`routes/index.js`). Esconder un botón no impide que alguien
 * con sesión llame a la API y nos gaste los tokens; por eso el backend manda y
 * esto solo evita que el usuario vea puertas que no llevan a ningún sitio.
 *
 * Se hace ocultando en vez de borrando el HTML a propósito: la rama `lite` se
 * sincroniza de vez en cuando con `develop`, y un index.html mutilado daría
 * conflicto en cada actualización. Ocultar es reversible y no toca el markup.
 */

import { t } from '@/i18n/index.js';

/** Todo lo que da acceso a Omnes en la interfaz. */
const SELECTORES_OMNES = [
    '[data-tab="inteligencia"]',      // botón del menú lateral y pestaña superior
    '#tab-btn-inteligencia',
    '#tab-inteligencia',              // el contenido de la pestaña
    '#chat-addon-container',          // la tarjeta de alta del addon en Configuración
];

/** Oculta un elemento sin romper nada si no existe (el HTML cambia entre ramas). */
function ocultar(el) {
    if (!el) return false;
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    return true;
}

/**
 * Quita de la vista todo rastro de Omnes. Devuelve cuántos elementos ocultó,
 * para poder verificarlo desde consola sin abrir el inspector.
 */
export function ocultarOmnes(doc = document) {
    let n = 0;
    SELECTORES_OMNES.forEach(sel => {
        doc.querySelectorAll(sel).forEach(el => { if (ocultar(el)) n++; });
    });
    return n;
}

/**
 * Tarjeta del informe mensual para el Dashboard.
 *
 * Un botón, no una caja de texto: el cliente pide su informe y se lo lleva.
 * Abre en pestaña nueva porque el backend devuelve HTML listo para imprimir o
 * guardar como PDF desde el propio navegador.
 */
export function construirTarjetaInforme() {
    const div = document.createElement('div');
    div.id = 'lite-informe-mensual';
    div.style.marginTop = '16px';
    div.innerHTML = `
        <div class="dashboard-card" style="background:white; border-radius:16px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.08); border:1px solid #f1f5f9;">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <div style="width:44px; height:44px; background:linear-gradient(135deg,#DCFCE7,#BBF7D0); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px;">📄</div>
                <div style="flex:1; min-width:200px;">
                    <h3 style="margin:0; font-size:15px; font-weight:700; color:#1E293B;">${t('dashboard:lite_informe_titulo')}</h3>
                    <p style="margin:2px 0 0; font-size:12px; color:#64748B;">${t('dashboard:lite_informe_subtitulo')}</p>
                </div>
                <button type="button" id="btn-lite-informe"
                    style="padding:12px 20px; background:linear-gradient(135deg,#10B981,#059669); color:white; border:none; border-radius:10px; cursor:pointer; font-weight:600; font-size:13px;">
                    ${t('dashboard:lite_informe_boton')}
                </button>
            </div>
        </div>`;
    return div;
}

/**
 * Abre el informe del mes en curso. La URL vieja (`/chat/informe-mensual/html`)
 * sigue funcionando como alias, pero usamos la nueva: en Lite no hay chat, y
 * una ruta que empiece por /chat despistaría a cualquiera que lea los logs.
 */
export function abrirInformeMensual() {
    const base = (typeof window.getApiUrl === 'function' ? window.getApiUrl() : '') || '';
    window.open(`${base}/informes/mensual/html`, '_blank', 'noopener');
}

/**
 * Monta la tarjeta en el Dashboard, detrás de Top Proveedores. Si no encuentra
 * el anclaje (el HTML del dashboard cambia), no monta nada: mejor sin tarjeta
 * que con una tarjeta suelta en mitad de la página.
 */
export function montarInformeMensual(doc = document) {
    if (doc.getElementById('lite-informe-mensual')) return false;   // idempotente
    const proveedores = doc.getElementById('dashboard-proveedores-barras');
    const ancla = proveedores?.closest('div[style*="margin-top"]');
    if (!ancla?.parentNode) return false;

    const tarjeta = construirTarjetaInforme();
    ancla.parentNode.insertBefore(tarjeta, ancla.nextSibling);
    tarjeta.querySelector('#btn-lite-informe')?.addEventListener('click', abrirInformeMensual);
    return true;
}

/** Arranca el modo Lite. Defensivo: si algo falla, la app sigue funcionando. */
export function initLiteMode() {
    try {
        ocultarOmnes();
        montarInformeMensual();
    } catch (e) {
        console.warn('Modo Lite:', e?.message || e);
    }
}

if (typeof window !== 'undefined') {
    window.initLiteMode = initLiteMode;
    window.abrirInformeMensual = abrirInformeMensual;
}
