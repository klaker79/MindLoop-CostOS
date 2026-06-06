/**
 * Modal drill-down por plato (D4).
 *
 * Escucha el evento `analisis:plato-click` que emite la matriz BCG v2
 * (scatter o lista) y abre un modal con:
 *   - Icono grande de la categoría + label + descripción corta.
 *   - Métricas: ventas, popularidad %, precio venta, coste, margen, food cost.
 *   - Acciones recomendadas (5-8 bullets contextuales).
 *   - CTA "Ver escandallo" (navega a Recetas y enfoca la receta).
 *   - Cierre: X, click fuera o tecla Esc.
 *
 * Cero dependencias de Chart.js para el mini-chart por ahora — se
 * añadirá en iteración posterior cuando haya endpoint de evolución
 * temporal por receta. Hoy mostramos las métricas estáticas que ya
 * trae /menu-engineering.
 */

import { renderIcono, COLORES, LABELS, DESCRIPCIONES } from './iconos.js';
import { accionesRecomendadas } from './acciones-recomendadas.js';
import { generarRecomendaciones } from './recomendaciones-plato.js';
import { escapeHTML, cm } from '../../utils/helpers.js';

const MODAL_ID = 'analisis-plato-modal';

function fmtNumero(n, decimals = 2) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toFixed(decimals);
}

function fmtEntero(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '0';
    return String(Math.round(Number(n)));
}

function cerrarModal() {
    const m = document.getElementById(MODAL_ID);
    if (m) m.remove();
    document.removeEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
    if (e.key === 'Escape') cerrarModal();
}

function navegarAReceta(idReceta) {
    cerrarModal();
    // Cambiar a la pestaña Recetas (patrón ya usado por otros módulos).
    if (typeof window.cambiarTab === 'function') {
        window.cambiarTab('recetas');
    } else {
        const btn = document.querySelector('[data-tab="recetas"]');
        if (btn) btn.click();
    }
    // Pequeño delay para que la pestaña Recetas pinte antes de scroll.
    setTimeout(() => {
        const fila = document.querySelector(`[data-receta-id="${idReceta}"]`);
        if (fila) fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
}

/**
 * Construye el prompt para el Coach IA basado en los datos del plato.
 * Pre-rellena el input del chat y abre el widget. NO envía automáticamente
 * — el cliente revisa el mensaje y pulsa enter cuando quiera.
 */
function consultarCoachIA(plato) {
    const nombre = plato.nombre || 'el plato';
    const cat = plato.clasificacion || 'sin clasificar';
    const linea = [];
    if (plato.precio_venta) linea.push(`precio venta ${cm(Number(plato.precio_venta).toFixed(2))}`);
    if (plato.coste !== null && plato.coste !== undefined) linea.push(`coste ${cm(Number(plato.coste).toFixed(2))}`);
    if (plato.foodCost !== null && plato.foodCost !== undefined) linea.push(`food cost ${Number(plato.foodCost).toFixed(1)}%`);
    if (plato.margen !== null && plato.margen !== undefined) linea.push(`margen ${cm(Number(plato.margen).toFixed(2))}`);
    if (plato.popularidad !== null && plato.popularidad !== undefined) linea.push(`${Math.round(plato.popularidad)} ventas en el periodo`);
    const metricas = linea.join(', ');
    // Prompt explícitamente analítico — pide a Claude que NO emita
    // marcadores [ACTION:...] para evitar que el chat muestre botones
    // "Confirmar/Cancelar" que ejecutarían cambios en BBDD. Esto es solo
    // un análisis-asesoramiento, no una orden de modificar datos.
    const prompt = `Análisis (no ejecutar cambios, no emitir [ACTION:...]).\n\nPlato: "${nombre}". Clasificación BCG: ${cat.toUpperCase()}. Métricas: ${metricas}.\n\nDame solo asesoramiento estratégico para mejorar este plato en las próximas 4 semanas: qué hacer con el precio, con el coste, con la promoción y con la posición en carta. No propongas registrar ventas, ni actualizar precios automáticamente, ni añadir pedidos — solo recomendaciones para que yo decida y aplique manualmente después.`;

    cerrarModal();
    setTimeout(() => {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // Ajustar altura del textarea si el chat lo redimensiona en input.
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }
        if (typeof window.toggleChat === 'function') {
            window.toggleChat(true);
        } else {
            // Fallback: click en el FAB del chat
            const fab = document.querySelector('#chat-fab, .chat-fab');
            if (fab) fab.click();
        }
        // Foco en input para que el usuario pulse enter
        setTimeout(() => {
            const i = document.getElementById('chat-input');
            if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
        }, 200);
    }, 150);
}

/**
 * Abre el modal con los datos del plato.
 *
 * @param {object} plato - item del array de /menu-engineering. Debe traer
 *   id, nombre, clasificacion, precio_venta, coste, margen, foodCost,
 *   popularidad, cantidad_vendida, total_ventas. Si faltan, se muestran '—'.
 */
export function abrirModalPlato(plato) {
    if (!plato || !plato.id) return;
    cerrarModal(); // limpia si había uno abierto

    const cat = plato.clasificacion || 'perro';
    const color = COLORES[cat] || '#6b7280';

    // A) Recomendaciones REALES por plato (con números del plato + medias del menú)
    const medias = (typeof window !== 'undefined' && window.__analisisState?.getMedias?.())
        || { precio: 0, foodCost: 0, margen: 0, popularidad: 0, totalPlatos: 0 };
    const recomendacionesReales = generarRecomendaciones(plato, medias);
    const recomendacionesHTML = recomendacionesReales.map(a => `<li>${escapeHTML(a)}</li>`).join('');

    // B) Acciones genéricas por categoría (catálogo Excel Ingeniería de Menús)
    const acciones = accionesRecomendadas(cat);
    const accionesHTML = acciones.map(a => `<li>${escapeHTML(a)}</li>`).join('');

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99998;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: ans-modal-fade 0.18s ease-out;
    `;
    overlay.innerHTML = `
        <style>
            @keyframes ans-modal-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes ans-modal-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        </style>
        <div class="apm-modal" role="dialog" aria-modal="true" aria-labelledby="apm-title"
             style="background: white; border-radius: 18px; max-width: 580px; width: 100%;
                    max-height: 90vh; overflow-y: auto;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
                    animation: ans-modal-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);">
            <header class="apm-header" style="display: grid; grid-template-columns: auto 1fr auto;
                            gap: 16px; align-items: center; padding: 24px 24px 16px;
                            border-bottom: 1px solid #f3f4f6;">
                <span class="apm-icon" style="color: ${color}; display: inline-flex;">
                    ${renderIcono(cat, { size: 56 })}
                </span>
                <div>
                    <div class="apm-cat-label" style="font-size: 11px; font-weight: 700;
                                color: ${color}; text-transform: uppercase;
                                letter-spacing: 0.5px;">${LABELS[cat]}</div>
                    <h2 id="apm-title" style="margin: 4px 0 2px; font-size: 22px;
                                font-weight: 700; color: #111827;">${escapeHTML(plato.nombre)}</h2>
                    <p style="margin: 0; font-size: 13px; color: #6b7280;">${DESCRIPCIONES[cat]}</p>
                </div>
                <button class="apm-close" type="button" aria-label="Cerrar"
                        style="background: transparent; border: none; font-size: 26px;
                               color: #9ca3af; cursor: pointer; padding: 4px 10px;
                               line-height: 1;">×</button>
            </header>

            <section class="apm-section" style="padding: 20px 24px;">
                <h3 class="apm-section-title" style="font-size: 11px; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;
                        margin: 0 0 12px;">Métricas</h3>
                <div class="apm-metrics-grid" style="display: grid;
                        grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div class="apm-metric">
                        <div class="apm-metric__label">Ventas</div>
                        <div class="apm-metric__value">${fmtEntero(plato.cantidad_vendida || plato.popularidad)}</div>
                    </div>
                    <div class="apm-metric">
                        <div class="apm-metric__label">Precio venta</div>
                        <div class="apm-metric__value">${cm(fmtNumero(plato.precio_venta))}</div>
                    </div>
                    <div class="apm-metric">
                        <div class="apm-metric__label">Coste</div>
                        <div class="apm-metric__value">${cm(fmtNumero(plato.coste))}</div>
                    </div>
                    <div class="apm-metric">
                        <div class="apm-metric__label">Margen contribución</div>
                        <div class="apm-metric__value" style="color:${color};">${cm(fmtNumero(plato.margen))}</div>
                    </div>
                    <div class="apm-metric">
                        <div class="apm-metric__label">Food cost</div>
                        <div class="apm-metric__value">${fmtNumero(plato.foodCost, 1)}%</div>
                    </div>
                    <div class="apm-metric">
                        <div class="apm-metric__label">Total ingresos</div>
                        <div class="apm-metric__value">${cm(fmtNumero(plato.total_ventas))}</div>
                    </div>
                </div>
            </section>

            <section class="apm-section" style="padding: 16px 24px 8px; border-top: 1px solid #f3f4f6;">
                <h3 class="apm-section-title" style="font-size: 11px; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;
                        margin: 0 0 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};"></span>
                    Recomendaciones para este plato
                </h3>
                <ul class="apm-acciones" style="margin: 0; padding-left: 18px; color: #374151;
                        font-size: 14px; line-height: 1.65;">${recomendacionesHTML}</ul>
            </section>

            <section class="apm-section apm-section--secondary" style="padding: 4px 24px 20px;">
                <details style="margin-top: 12px;">
                    <summary style="cursor: pointer; font-size: 11px; font-weight: 700;
                            text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af;
                            user-select: none;">Acciones genéricas para ${LABELS[cat]}</summary>
                    <ul class="apm-acciones" style="margin: 10px 0 0; padding-left: 18px;
                            color: #6b7280; font-size: 13px; line-height: 1.6;">${accionesHTML}</ul>
                </details>
            </section>

            <footer class="apm-footer" style="display: flex; gap: 8px; justify-content: space-between;
                        align-items: center; padding: 16px 24px; border-top: 1px solid #f3f4f6;
                        background: #fafafa; border-radius: 0 0 18px 18px; flex-wrap: wrap;">
                <button class="apm-btn apm-btn--coach" type="button" data-action="coach-ia"
                        style="background: white; border: 1px solid #e5e7eb;
                               padding: 9px 14px; border-radius: 8px; font-weight: 600;
                               color: #6d28d9; cursor: pointer; font-size: 13px;
                               display: inline-flex; align-items: center; gap: 6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                    Consulta al Coach IA
                </button>
                <div style="display: flex; gap: 8px;">
                    <button class="apm-btn apm-btn--ghost" type="button" data-action="cerrar"
                            style="background: transparent; border: 1px solid #e5e7eb; padding: 9px 16px;
                                   border-radius: 8px; font-weight: 600; color: #374151;
                                   cursor: pointer; font-size: 14px;">Cerrar</button>
                    <button class="apm-btn apm-btn--primary" type="button" data-action="ver-escandallo"
                            style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white;
                                   border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700;
                                   cursor: pointer; font-size: 14px;
                                   box-shadow: 0 2px 4px rgba(124,58,237,0.3);">Ver escandallo →</button>
                </div>
            </footer>
        </div>
    `;

    document.body.appendChild(overlay);

    // Bind cierre
    overlay.querySelector('.apm-close')?.addEventListener('click', cerrarModal);
    overlay.querySelector('[data-action="cerrar"]')?.addEventListener('click', cerrarModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarModal(); });

    // Bind escandallo
    overlay.querySelector('[data-action="ver-escandallo"]')?.addEventListener('click', () => navegarAReceta(plato.id));

    // Bind Coach IA (B)
    overlay.querySelector('[data-action="coach-ia"]')?.addEventListener('click', () => consultarCoachIA(plato));

    // Tecla Esc
    document.addEventListener('keydown', onKeyDown);
}

// Auto-registro: escucha el evento que emite la matriz BCG v2.
if (typeof window !== 'undefined') {
    window.addEventListener('analisis:plato-click', (e) => {
        const plato = e?.detail?.plato;
        if (plato) abrirModalPlato(plato);
    });
    window.abrirModalPlato = abrirModalPlato;
}
