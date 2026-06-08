/**
 * Modal informativo de la Matriz BCG.
 *
 * Patrón gemelo de `omnes-info.js`. Explica al cliente sin jerga
 * técnica qué significan Estrella / Puzzle / Caballo / Perro y qué
 * hacer con cada uno.
 *
 * Namespace: .binfo-
 */

const MODAL_ID = 'bcg-info-modal';

let escListener = null;

function bindEsc(close) {
    escListener = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escListener);
}
function unbindEsc() {
    if (escListener) document.removeEventListener('keydown', escListener);
    escListener = null;
}

export function mostrarBcgInfo() {
    document.getElementById(MODAL_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99998;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        animation: binfo-fade 0.18s ease-out;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes binfo-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes binfo-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            #${MODAL_ID} .binfo-modal {
                background: white; border-radius: 16px; width: 100%;
                max-width: 720px; max-height: 88vh; overflow: hidden;
                display: flex; flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
                animation: binfo-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #${MODAL_ID} .binfo-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                gap: 16px; padding: 22px 28px 16px;
                border-bottom: 1px solid #f1f5f9;
            }
            #${MODAL_ID} .binfo-tag {
                display: inline-flex; align-items: center; gap: 6px;
                background: linear-gradient(135deg, #10b981, #3b82f6);
                color: white; padding: 4px 10px; border-radius: 999px;
                font-size: 10px; font-weight: 700;
                text-transform: uppercase; letter-spacing: 0.5px;
                margin-bottom: 8px;
            }
            #${MODAL_ID} .binfo-title {
                margin: 0; font-size: 22px; font-weight: 700; color: #111827;
            }
            #${MODAL_ID} .binfo-subtitle {
                margin: 6px 0 0; font-size: 14px; color: #6b7280;
            }
            #${MODAL_ID} .binfo-close {
                background: transparent; border: none; cursor: pointer;
                color: #6b7280; padding: 4px; font-size: 24px; line-height: 1;
                border-radius: 8px;
            }
            #${MODAL_ID} .binfo-close:hover { background: #f3f4f6; color: #111827; }
            #${MODAL_ID} .binfo-body { padding: 20px 28px 24px; overflow-y: auto; }
            #${MODAL_ID} .binfo-intro {
                font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 22px;
            }
            #${MODAL_ID} .binfo-grid {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;
            }
            #${MODAL_ID} .binfo-cat {
                border-left: 4px solid var(--cat-color, #10b981);
                background: color-mix(in srgb, var(--cat-color, #10b981) 5%, white);
                border-radius: 12px; padding: 14px 16px;
            }
            #${MODAL_ID} .binfo-cat__head {
                display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
            }
            #${MODAL_ID} .binfo-cat__dot {
                width: 14px; height: 14px; border-radius: 50%;
                background: var(--cat-color); flex-shrink: 0;
            }
            #${MODAL_ID} .binfo-cat__title {
                margin: 0; font-size: 15px; font-weight: 700; color: #111827;
            }
            #${MODAL_ID} .binfo-cat__def {
                font-size: 12px; color: #6b7280; margin: 2px 0 8px;
                text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600;
            }
            #${MODAL_ID} .binfo-cat__action {
                margin: 0; font-size: 13px; color: #1f2937; line-height: 1.5;
            }
            #${MODAL_ID} .binfo-cat__action strong { color: #111827; }
            #${MODAL_ID} .binfo-foot {
                margin-top: 18px; padding: 14px 16px;
                background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px;
            }
            #${MODAL_ID} .binfo-foot h4 {
                margin: 0 0 8px; font-size: 13px; font-weight: 700;
                color: #111827; text-transform: uppercase; letter-spacing: 0.4px;
            }
            #${MODAL_ID} .binfo-foot p {
                margin: 4px 0; font-size: 13px; color: #374151; line-height: 1.55;
            }
            #${MODAL_ID} .binfo-footer-actions {
                display: flex; justify-content: flex-end; gap: 8px;
                padding: 14px 28px; background: #fafafa;
                border-top: 1px solid #f1f5f9;
                border-radius: 0 0 16px 16px;
            }
            #${MODAL_ID} .binfo-btn {
                background: linear-gradient(135deg, #10b981, #3b82f6);
                color: white; border: none;
                padding: 9px 18px; border-radius: 8px;
                font-weight: 700; font-size: 14px; cursor: pointer;
            }
            #${MODAL_ID} .binfo-btn:hover { transform: translateY(-1px); }
            @media (max-width: 640px) {
                #${MODAL_ID} .binfo-grid { grid-template-columns: 1fr; }
            }
        </style>
        <div class="binfo-modal" role="dialog" aria-modal="true">
            <div class="binfo-header">
                <div>
                    <span class="binfo-tag">Ingeniería de menú</span>
                    <h2 class="binfo-title">Matriz BCG</h2>
                    <p class="binfo-subtitle">Cada plato según su popularidad y su rentabilidad. Cuatro grupos, cuatro estrategias.</p>
                </div>
                <button type="button" class="binfo-close" data-action="close" aria-label="Cerrar">×</button>
            </div>
            <div class="binfo-body">
                <p class="binfo-intro">
                    La Matriz BCG aplicada al menú clasifica cada plato cruzando dos ejes: <strong>cuánto se vende</strong> (popularidad) y <strong>cuánto deja</strong> (margen). El resultado son cuatro grupos con una estrategia clara para cada uno.
                </p>

                <div class="binfo-grid">
                    <div class="binfo-cat" style="--cat-color:#10b981;">
                        <div class="binfo-cat__head">
                            <span class="binfo-cat__dot"></span>
                            <h3 class="binfo-cat__title">Estrellas</h3>
                        </div>
                        <p class="binfo-cat__def">Popular · Rentable</p>
                        <p class="binfo-cat__action">Tus líderes. <strong>Protégelos</strong>: mantén calidad, no subas precio sin pensar, dales sitio destacado en la carta. No los toques sin motivo.</p>
                    </div>

                    <div class="binfo-cat" style="--cat-color:#3b82f6;">
                        <div class="binfo-cat__head">
                            <span class="binfo-cat__dot"></span>
                            <h3 class="binfo-cat__title">Puzzles</h3>
                        </div>
                        <p class="binfo-cat__def">Poco popular · Rentable</p>
                        <p class="binfo-cat__action">Ganan bien pero no se venden. <strong>Promociónalos</strong>: posición destacada en carta, recomendación del camarero, foto en redes. Si suben en ventas, pasan a Estrella.</p>
                    </div>

                    <div class="binfo-cat" style="--cat-color:#f59e0b;">
                        <div class="binfo-cat__head">
                            <span class="binfo-cat__dot"></span>
                            <h3 class="binfo-cat__title">Caballos</h3>
                        </div>
                        <p class="binfo-cat__def">Popular · Margen justo</p>
                        <p class="binfo-cat__action">Mucho tráfico, poco margen. <strong>Optimiza coste</strong>: revisa proveedor, ajusta gramaje, sube 30-50 cts el precio. Cuidado al tocarlos — son los que traen al cliente.</p>
                    </div>

                    <div class="binfo-cat" style="--cat-color:#ef4444;">
                        <div class="binfo-cat__head">
                            <span class="binfo-cat__dot"></span>
                            <h3 class="binfo-cat__title">Perros</h3>
                        </div>
                        <p class="binfo-cat__def">Poco popular · Poco margen</p>
                        <p class="binfo-cat__action">Ni vende ni deja. <strong>Candidatos a retirar</strong> de la carta — liberan espacio para platos nuevos. Si tienen valor estratégico (ingrediente local, nombre del local), revísalos antes de quitar.</p>
                    </div>
                </div>

                <div class="binfo-foot">
                    <h4>Cómo se calcula</h4>
                    <p>Para cada plato cruzamos <strong>unidades vendidas en el periodo</strong> (eje horizontal) con <strong>margen unitario en euros</strong> (eje vertical). Los ejes parten por la media de tu carta: lo que cae arriba a la derecha es Estrella, abajo a la izquierda es Perro.</p>
                </div>

                <div class="binfo-foot" style="margin-top:12px;">
                    <h4>Cómo usar la matriz cada mes</h4>
                    <p>1. Mira primero los <strong>Perros</strong>: ¿hay alguno que ya no aporta nada? Quítalo.</p>
                    <p>2. Mira los <strong>Caballos</strong>: ¿puedes apretar coste sin tocar receta? Cada 0,20 € de coste ahorrado en un plato muy vendido suma muchísimo al mes.</p>
                    <p>3. Trabaja un <strong>Puzzle</strong> hacia Estrella: elige uno, dale visibilidad cuatro semanas, mide.</p>
                    <p>4. Las <strong>Estrellas</strong> no se tocan. Solo se cuidan.</p>
                </div>
            </div>
            <div class="binfo-footer-actions">
                <button type="button" class="binfo-btn" data-action="close">Entendido</button>
            </div>
        </div>
    `;

    const close = () => {
        unbindEsc();
        overlay.remove();
    };

    document.body.appendChild(overlay);
    bindEsc(close);

    overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
        btn.addEventListener('click', close);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

if (typeof window !== 'undefined') {
    window.mlBcgInfo = mostrarBcgInfo;
}
