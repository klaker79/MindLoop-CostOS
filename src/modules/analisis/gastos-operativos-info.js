/**
 * Modal discreto: "¿Por qué el P&L no cuenta el IVA ni algunos impuestos?"
 *
 * Se abre desde un ⓘ pequeño junto al P&L (Cuenta de Resultados) y junto a la
 * tarjeta de gastos fijos del Punto de Equilibrio. Explica en segundo plano qué
 * gastos SÍ cuentan (de explotación) y cuáles NO (impuestos no operativos) y por
 * qué — sin cargar la pantalla.
 *
 * Registra window.mlGastosOperativosInfo para que el legacy (Diario) lo llame.
 */

const MODAL_ID = 'gastos-operativos-info-modal';

let escListener = null;
function bindEsc(close) { escListener = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', escListener); }
function unbindEsc() { if (escListener) document.removeEventListener('keydown', escListener); escListener = null; }

export function mostrarGastosOperativosInfo() {
    document.getElementById(MODAL_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99998;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 24px; animation: goinfo-fade 0.18s ease-out;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes goinfo-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes goinfo-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            #${MODAL_ID} .goinfo-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 560px; max-height: 88vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); animation: goinfo-pop 0.22s cubic-bezier(0.34,1.56,0.64,1); }
            #${MODAL_ID} .goinfo-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 20px 24px 14px; border-bottom: 1px solid #f1f5f9; }
            #${MODAL_ID} .goinfo-title { margin: 0; font-size: 19px; font-weight: 700; color: #111827; }
            #${MODAL_ID} .goinfo-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
            #${MODAL_ID} .goinfo-close { background: transparent; border: none; cursor: pointer; color: #6b7280; padding: 4px; font-size: 24px; line-height: 1; border-radius: 8px; }
            #${MODAL_ID} .goinfo-close:hover { background: #f3f4f6; color: #111827; }
            #${MODAL_ID} .goinfo-body { padding: 18px 24px 22px; overflow-y: auto; font-size: 14px; color: #374151; line-height: 1.55; }
            #${MODAL_ID} .goinfo-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 6px 0 16px; }
            #${MODAL_ID} .goinfo-col { border-radius: 12px; padding: 12px 14px; }
            #${MODAL_ID} .goinfo-col--si { background: #ecfdf5; border: 1px solid #a7f3d0; }
            #${MODAL_ID} .goinfo-col--no { background: #fef2f2; border: 1px solid #fecaca; }
            #${MODAL_ID} .goinfo-col h4 { margin: 0 0 6px; font-size: 13px; font-weight: 700; }
            #${MODAL_ID} .goinfo-col--si h4 { color: #047857; }
            #${MODAL_ID} .goinfo-col--no h4 { color: #b91c1c; }
            #${MODAL_ID} .goinfo-col ul { margin: 0; padding-left: 16px; font-size: 12.5px; color: #374151; }
            #${MODAL_ID} .goinfo-col li { margin-bottom: 2px; }
            #${MODAL_ID} .goinfo-test { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; font-size: 13px; }
            #${MODAL_ID} .goinfo-test strong { color: #111827; }
            #${MODAL_ID} .goinfo-note { margin: 12px 0 0; font-size: 12.5px; color: #6b7280; }
            #${MODAL_ID} .goinfo-foot { display: flex; justify-content: flex-end; padding: 12px 24px; background: #fafafa; border-top: 1px solid #f1f5f9; }
            #${MODAL_ID} .goinfo-btn { background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
            @media (max-width: 520px) { #${MODAL_ID} .goinfo-lists { grid-template-columns: 1fr; } }
        </style>
        <div class="goinfo-modal" role="dialog" aria-modal="true">
            <div class="goinfo-header">
                <div>
                    <h2 class="goinfo-title">Qué cuenta como gasto fijo</h2>
                    <p class="goinfo-sub">Por qué el P&L y el punto de equilibrio no cuentan el IVA ni algunos impuestos.</p>
                </div>
                <button type="button" class="goinfo-close" data-action="close" aria-label="Cerrar">×</button>
            </div>
            <div class="goinfo-body">
                <p style="margin:0 0 10px;">En el <strong>P&L (beneficio)</strong> y en el <strong>punto de equilibrio</strong> contamos tus <strong>gastos de explotación</strong>: lo que pagas por tener el negocio abierto, vendas o no.</p>
                <div class="goinfo-lists">
                    <div class="goinfo-col goinfo-col--si">
                        <h4>✅ Sí cuentan</h4>
                        <ul>
                            <li>Alquiler, nóminas, Seguridad Social</li>
                            <li>Suministros, seguros, préstamo</li>
                            <li><strong>IAE</strong>, IBI, tasas, licencias</li>
                        </ul>
                    </div>
                    <div class="goinfo-col goinfo-col--no">
                        <h4>❌ No cuentan</h4>
                        <ul>
                            <li><strong>IVA</strong>: lo cobras y lo devuelves; no es tuyo</li>
                            <li><strong>IRPF</strong> / <strong>Sociedades</strong>: se pagan sobre el beneficio</li>
                        </ul>
                    </div>
                </div>
                <div class="goinfo-test">
                    <strong>La regla fácil:</strong> si mañana no vendes ni un café, ¿lo seguirías pagando? El alquiler y el IAE, sí (cuentan). El IVA y Sociedades, no (no cuentan).
                </div>
                <p class="goinfo-note">Tus impuestos siguen en tu lista de gastos fijos, la ves y la editas igual. Solo se dejan fuera de estos indicadores para que reflejen la realidad económica del restaurante.</p>
            </div>
            <div class="goinfo-foot">
                <button type="button" class="goinfo-btn" data-action="close">Entendido</button>
            </div>
        </div>
    `;

    const close = () => { unbindEsc(); overlay.remove(); };
    document.body.appendChild(overlay);
    bindEsc(close);
    overlay.querySelectorAll('[data-action="close"]').forEach(btn => btn.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

if (typeof window !== 'undefined') {
    window.mlGastosOperativosInfo = mostrarGastosOperativosInfo;
}
