/**
 * Modal informativo del bloque Punto de Equilibrio.
 *
 * Explica al dueño, sin jerga, qué es el punto de equilibrio ("número de
 * supervivencia"), cómo se calcula y las tres palancas para moverlo.
 * Mismo esqueleto que omnes-info.js (namespace .oinfo-), acento verde.
 */

const MODAL_ID = 'breakeven-info-modal';

let escListener = null;

function bindEsc(close) {
    escListener = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escListener);
}
function unbindEsc() {
    if (escListener) document.removeEventListener('keydown', escListener);
    escListener = null;
}

export function mostrarBreakevenInfo() {
    document.getElementById(MODAL_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99998;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        animation: beinfo-fade 0.18s ease-out;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes beinfo-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes beinfo-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            #${MODAL_ID} .oinfo-modal {
                background: white; border-radius: 16px; width: 100%;
                max-width: 720px; max-height: 88vh; overflow: hidden;
                display: flex; flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
                animation: beinfo-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #${MODAL_ID} .oinfo-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                gap: 16px; padding: 22px 28px 16px; border-bottom: 1px solid #f1f5f9;
            }
            #${MODAL_ID} .oinfo-tag {
                display: inline-flex; align-items: center; gap: 6px;
                background: linear-gradient(135deg, #0f766e, #10b981);
                color: white; padding: 4px 10px; border-radius: 999px;
                font-size: 10px; font-weight: 700; text-transform: uppercase;
                letter-spacing: 0.5px; margin-bottom: 8px;
            }
            #${MODAL_ID} .oinfo-title { margin: 0; font-size: 22px; font-weight: 700; color: #111827; }
            #${MODAL_ID} .oinfo-subtitle { margin: 6px 0 0; font-size: 14px; color: #6b7280; }
            #${MODAL_ID} .oinfo-close {
                background: transparent; border: none; cursor: pointer;
                color: #6b7280; padding: 4px; font-size: 24px; line-height: 1; border-radius: 8px;
            }
            #${MODAL_ID} .oinfo-close:hover { background: #f3f4f6; color: #111827; }
            #${MODAL_ID} .oinfo-body { padding: 20px 28px 24px; overflow-y: auto; }
            #${MODAL_ID} .oinfo-intro { font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 22px; }
            #${MODAL_ID} .oinfo-formula {
                background: #0f172a; color: #e2e8f0; border-radius: 12px;
                padding: 16px 18px; margin: 0 0 22px; font-size: 14px; line-height: 1.7; text-align: center;
            }
            #${MODAL_ID} .oinfo-formula strong { color: #10b981; }
            #${MODAL_ID} .oinfo-principle {
                border-left: 4px solid var(--p-color, #10b981);
                background: color-mix(in srgb, var(--p-color, #10b981) 5%, white);
                border-radius: 12px; padding: 16px 18px; margin-bottom: 16px;
            }
            #${MODAL_ID} .oinfo-principle__head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
            #${MODAL_ID} .oinfo-principle__num {
                background: var(--p-color, #10b981); color: white;
                width: 26px; height: 26px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-weight: 700; font-size: 13px;
            }
            #${MODAL_ID} .oinfo-principle__title { margin: 0; font-size: 16px; font-weight: 700; color: #111827; }
            #${MODAL_ID} .oinfo-principle p { margin: 6px 0; font-size: 13px; color: #374151; line-height: 1.55; }
            #${MODAL_ID} .oinfo-principle__label { font-weight: 700; color: #111827; }
            #${MODAL_ID} .oinfo-foot {
                margin-top: 18px; padding: 14px 16px; background: #f9fafb;
                border: 1px solid #e5e7eb; border-radius: 12px;
            }
            #${MODAL_ID} .oinfo-foot h4 {
                margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #111827;
                text-transform: uppercase; letter-spacing: 0.4px;
            }
            #${MODAL_ID} .oinfo-foot p { margin: 4px 0; font-size: 13px; color: #374151; line-height: 1.55; }
            #${MODAL_ID} .oinfo-footer-actions {
                display: flex; justify-content: flex-end; gap: 8px; padding: 14px 28px;
                background: #fafafa; border-top: 1px solid #f1f5f9; border-radius: 0 0 16px 16px;
            }
            #${MODAL_ID} .oinfo-btn {
                background: linear-gradient(135deg, #0f766e, #10b981); color: white; border: none;
                padding: 9px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;
            }
            #${MODAL_ID} .oinfo-btn:hover { transform: translateY(-1px); }
        </style>
        <div class="oinfo-modal" role="dialog" aria-modal="true" aria-labelledby="beinfo-title">
            <div class="oinfo-header">
                <div>
                    <span class="oinfo-tag">Los números de verdad</span>
                    <h2 class="oinfo-title" id="beinfo-title">Punto de Equilibrio</h2>
                    <p class="oinfo-subtitle">El número que te dice cuánto necesitas vender para no perder dinero.</p>
                </div>
                <button type="button" class="oinfo-close" data-action="close" aria-label="Cerrar">×</button>
            </div>
            <div class="oinfo-body">
                <p class="oinfo-intro">
                    Un restaurante puede estar <strong>lleno y perder dinero</strong>. Facturar mucho no
                    significa ganar: significa mover dinero. El punto de equilibrio es la línea que separa
                    perder de ganar — el <strong>número de supervivencia</strong>. Por debajo, pones dinero
                    de tu bolsillo. Por encima, cada plato es beneficio de verdad.
                </p>

                <div class="oinfo-formula">
                    Punto de equilibrio =
                    <strong>Gastos fijos del mes</strong> ÷ <strong>Margen que deja cada plato</strong>
                    <br>= cuántos platos tienes que vender al mes para no perder.
                </div>

                <p class="oinfo-intro" style="margin-bottom:16px;">
                    CosteOS lo calcula con tus números reales: tus gastos fijos de verdad y el margen medio
                    de tus platos <strong>ponderado por lo que se vende de verdad</strong> (no una media teórica).
                    Y lo traduce a lo que sientes en la barra: <strong>ventas y platos al día</strong>.
                    Si no llegas, tienes tres palancas para moverlo:
                </p>

                <div class="oinfo-principle" style="--p-color: #10b981;">
                    <div class="oinfo-principle__head">
                        <span class="oinfo-principle__num">1</span>
                        <h3 class="oinfo-principle__title">Sube el margen por plato</h3>
                    </div>
                    <p>Escandalla bien, controla la merma, compra mejor y ajusta precios donde no duele (bebidas, cafés, postres). Cada euro más de margen baja tu punto de equilibrio.</p>
                    <p><span class="oinfo-principle__label">En la app:</span> mira los <strong>Perros</strong> y <strong>Caballos</strong> de la Matriz BCG — ahí está el margen escondido.</p>
                </div>

                <div class="oinfo-principle" style="--p-color: #f59e0b;">
                    <div class="oinfo-principle__head">
                        <span class="oinfo-principle__num">2</span>
                        <h3 class="oinfo-principle__title">Baja los gastos fijos</h3>
                    </div>
                    <p>Aquí es donde casi todos se equivocan: se olvidan de la <strong>cuota de autónomo</strong>, la del <strong>préstamo</strong> y el goteo de <strong>suscripciones</strong> (TPV, reservas, softwares que no usas). Si no los cuentas, tu punto de equilibrio real es más alto de lo que crees.</p>
                    <p><span class="oinfo-principle__label">En la app:</span> mételos todos en <strong>Configuración → Gastos fijos</strong> para que el número sea honesto.</p>
                </div>

                <div class="oinfo-principle" style="--p-color: #3b82f6;">
                    <div class="oinfo-principle__head">
                        <span class="oinfo-principle__num">3</span>
                        <h3 class="oinfo-principle__title">Trae más clientes (con los números bien)</h3>
                    </div>
                    <p>Venta sugerida, que repitan, reseñas. Pero es la última palanca a propósito: traer gente con el margen mal es pisar el acelerador hacia la pared. Primero cuadra el margen y los gastos; luego llena.</p>
                </div>

                <div class="oinfo-foot">
                    <h4>Cómo leer el bloque</h4>
                    <p>El número grande es <strong>lo que necesitas facturar al día</strong> para no perder. Debajo verás el equivalente en platos al día y al mes.</p>
                    <p>Si tienes un mes cargado en el Diario, la barra te dice <strong>a qué % del objetivo vas</strong> y cuántos platos te faltan.</p>
                    <p><em>Nota:</em> la traducción a "por día" asume ~26 días de servicio al mes. El número mensual es exacto; el diario es la foto para el día a día.</p>
                </div>
            </div>
            <div class="oinfo-footer-actions">
                <button type="button" class="oinfo-btn" data-action="close">Entendido</button>
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
    window.mlBreakevenInfo = mostrarBreakevenInfo;
}
