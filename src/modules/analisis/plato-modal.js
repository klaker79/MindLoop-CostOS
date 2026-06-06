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

            <section class="apm-section" style="padding: 16px 24px 20px; border-top: 1px solid #f3f4f6;">
                <h3 class="apm-section-title" style="font-size: 11px; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;
                        margin: 0 0 12px;">Acciones recomendadas</h3>
                <ul class="apm-acciones" style="margin: 0; padding-left: 18px; color: #374151;
                        font-size: 14px; line-height: 1.6;">${accionesHTML}</ul>
            </section>

            <footer class="apm-footer" style="display: flex; gap: 8px; justify-content: flex-end;
                        padding: 16px 24px; border-top: 1px solid #f3f4f6; background: #fafafa;
                        border-radius: 0 0 18px 18px;">
                <button class="apm-btn apm-btn--ghost" type="button" data-action="cerrar"
                        style="background: transparent; border: 1px solid #e5e7eb; padding: 9px 16px;
                               border-radius: 8px; font-weight: 600; color: #374151;
                               cursor: pointer; font-size: 14px;">Cerrar</button>
                <button class="apm-btn apm-btn--primary" type="button" data-action="ver-escandallo"
                        style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white;
                               border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700;
                               cursor: pointer; font-size: 14px;
                               box-shadow: 0 2px 4px rgba(124,58,237,0.3);">Ver escandallo →</button>
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
