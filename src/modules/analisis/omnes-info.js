/**
 * Modal informativo del bloque Principios de Omnes.
 *
 * Se abre desde el botón "?" del header de Omnes. Explica al cliente,
 * sin jerga técnica, qué es cada principio, por qué importa y qué
 * hacer cuando aparece en rojo o ámbar.
 *
 * Namespace: .oinfo-
 */

const MODAL_ID = 'omnes-info-modal';

let escListener = null;

function bindEsc(close) {
    escListener = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escListener);
}
function unbindEsc() {
    if (escListener) document.removeEventListener('keydown', escListener);
    escListener = null;
}

export function mostrarOmnesInfo() {
    document.getElementById(MODAL_ID)?.remove();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99998;
        background: rgba(15, 23, 42, 0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        animation: oinfo-fade 0.18s ease-out;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes oinfo-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes oinfo-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
            #${MODAL_ID} .oinfo-modal {
                background: white;
                border-radius: 16px;
                width: 100%;
                max-width: 720px;
                max-height: 88vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
                animation: oinfo-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #${MODAL_ID} .oinfo-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                padding: 22px 28px 16px;
                border-bottom: 1px solid #f1f5f9;
            }
            #${MODAL_ID} .oinfo-tag {
                display: inline-flex; align-items: center; gap: 6px;
                background: linear-gradient(135deg, #7c3aed, #3b82f6);
                color: white;
                padding: 4px 10px;
                border-radius: 999px;
                font-size: 10px; font-weight: 700;
                text-transform: uppercase; letter-spacing: 0.5px;
                margin-bottom: 8px;
            }
            #${MODAL_ID} .oinfo-title {
                margin: 0; font-size: 22px; font-weight: 700; color: #111827;
            }
            #${MODAL_ID} .oinfo-subtitle {
                margin: 6px 0 0; font-size: 14px; color: #6b7280;
            }
            #${MODAL_ID} .oinfo-close {
                background: transparent; border: none; cursor: pointer;
                color: #6b7280; padding: 4px; font-size: 24px; line-height: 1;
                border-radius: 8px;
            }
            #${MODAL_ID} .oinfo-close:hover { background: #f3f4f6; color: #111827; }
            #${MODAL_ID} .oinfo-body {
                padding: 20px 28px 24px; overflow-y: auto;
            }
            #${MODAL_ID} .oinfo-intro {
                font-size: 14px; color: #374151; line-height: 1.6;
                margin: 0 0 22px;
            }
            #${MODAL_ID} .oinfo-principle {
                border-left: 4px solid var(--p-color, #7c3aed);
                background: color-mix(in srgb, var(--p-color, #7c3aed) 4%, white);
                border-radius: 12px;
                padding: 16px 18px;
                margin-bottom: 16px;
            }
            #${MODAL_ID} .oinfo-principle__head {
                display: flex; align-items: center; gap: 10px;
                margin-bottom: 6px;
            }
            #${MODAL_ID} .oinfo-principle__num {
                background: var(--p-color, #7c3aed);
                color: white;
                width: 26px; height: 26px;
                border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-weight: 700; font-size: 13px;
            }
            #${MODAL_ID} .oinfo-principle__title {
                margin: 0; font-size: 16px; font-weight: 700; color: #111827;
            }
            #${MODAL_ID} .oinfo-principle__rule {
                font-size: 13px; color: #1f2937;
                background: white; border: 1px solid #e5e7eb;
                border-radius: 8px; padding: 10px 12px; margin: 8px 0 10px;
                font-style: italic;
            }
            #${MODAL_ID} .oinfo-principle__rule strong { font-style: normal; }
            #${MODAL_ID} .oinfo-principle p {
                margin: 6px 0; font-size: 13px; color: #374151; line-height: 1.55;
            }
            #${MODAL_ID} .oinfo-principle__label {
                font-weight: 700; color: #111827;
            }
            #${MODAL_ID} .oinfo-principle ul {
                margin: 6px 0 0; padding-left: 18px;
                font-size: 13px; color: #374151; line-height: 1.6;
            }
            #${MODAL_ID} .oinfo-principle li { margin-bottom: 2px; }
            #${MODAL_ID} .oinfo-foot {
                margin-top: 18px;
                padding: 14px 16px;
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
            }
            #${MODAL_ID} .oinfo-foot h4 {
                margin: 0 0 8px; font-size: 13px; font-weight: 700;
                color: #111827; text-transform: uppercase; letter-spacing: 0.4px;
            }
            #${MODAL_ID} .oinfo-foot p {
                margin: 4px 0; font-size: 13px; color: #374151; line-height: 1.55;
            }
            #${MODAL_ID} .oinfo-semaforo {
                display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;
            }
            #${MODAL_ID} .oinfo-chip {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 4px 10px; border-radius: 999px;
                font-size: 11px; font-weight: 700;
            }
            #${MODAL_ID} .oinfo-chip--ok { background: #d1fae5; color: #047857; }
            #${MODAL_ID} .oinfo-chip--warn { background: #fef3c7; color: #92400e; }
            #${MODAL_ID} .oinfo-chip--bad { background: #fee2e2; color: #b91c1c; }
            #${MODAL_ID} .oinfo-footer-actions {
                display: flex; justify-content: flex-end; gap: 8px;
                padding: 14px 28px; background: #fafafa;
                border-top: 1px solid #f1f5f9;
                border-radius: 0 0 16px 16px;
            }
            #${MODAL_ID} .oinfo-btn {
                background: linear-gradient(135deg, #7c3aed, #3b82f6);
                color: white; border: none;
                padding: 9px 18px; border-radius: 8px;
                font-weight: 700; font-size: 14px; cursor: pointer;
            }
            #${MODAL_ID} .oinfo-btn:hover { transform: translateY(-1px); }
        </style>
        <div class="oinfo-modal" role="dialog" aria-modal="true" aria-labelledby="oinfo-title">
            <div class="oinfo-header">
                <div>
                    <span class="oinfo-tag">Análisis de carta</span>
                    <h2 class="oinfo-title" id="oinfo-title">Principios de Omnes</h2>
                    <p class="oinfo-subtitle">Tres reglas para saber si tu carta está bien diseñada como conjunto.</p>
                </div>
                <button type="button" class="oinfo-close" data-action="close" aria-label="Cerrar">×</button>
            </div>
            <div class="oinfo-body">
                <p class="oinfo-intro">
                    Henri Omnes era un consultor francés que analizó cientos de cartas de restaurante.
                    Descubrió que <strong>los clientes no eligen al azar</strong>: si la carta está bien
                    construida, eligen lo que tú quieres que elijan. Si está mal, eligen lo que les hace
                    dudar — que suele ser lo peor para tu margen. De ahí salieron tres reglas.
                </p>

                <div class="oinfo-principle" style="--p-color: #ef4444;">
                    <div class="oinfo-principle__head">
                        <span class="oinfo-principle__num">1</span>
                        <h3 class="oinfo-principle__title">Dispersión de precios</h3>
                    </div>
                    <div class="oinfo-principle__rule">
                        Tu plato <strong>más caro</strong> no debería costar más de <strong>2,5 veces</strong> el más barato.
                    </div>
                    <p><span class="oinfo-principle__label">Ejemplo:</span> si las bravas valen 6&nbsp;€, el plato más caro no debería pasar de 15&nbsp;€.</p>
                    <p><span class="oinfo-principle__label">Por qué importa:</span> cuando hay un salto enorme (de 6&nbsp;€ a 28&nbsp;€), la carta pierde coherencia y la decisión del cliente se dispersa. Suele acabar refugiándose en lo más barato o en lo más conocido, no en lo que tú quieres venderle.</p>
                    <p><span class="oinfo-principle__label">Qué hacer si está alta:</span></p>
                    <ul>
                        <li>Quita 1 o 2 platos del extremo caro (o muévelos a sugerencias del día).</li>
                        <li>Sube 50 cts – 1&nbsp;€ los más baratos: no se nota y reduce la brecha.</li>
                    </ul>
                </div>

                <div class="oinfo-principle" style="--p-color: #38bdf8;">
                    <div class="oinfo-principle__head">
                        <span class="oinfo-principle__num">2</span>
                        <h3 class="oinfo-principle__title">Amplitud de gama</h3>
                    </div>
                    <div class="oinfo-principle__rule">
                        Reparte tu carta en tres tramos: <strong>25%</strong> gama baja, <strong>50%</strong> media, <strong>25%</strong> alta.
                    </div>
                    <p><span class="oinfo-principle__label">Ejemplo:</span> con 12 principales, lo ideal son 3 baratos, 6 medios y 3 caros.</p>
                    <p><span class="oinfo-principle__label">Por qué importa:</span> el cliente medio quiere "algo del medio". Si la mayoría de la carta es cara, tiende a pedir lo más barato. Si es barata, regalas margen. Con el 50% al medio, la decisión es fácil y cae donde tú ganas.</p>
                    <p><span class="oinfo-principle__label">Qué hacer si está desbalanceada:</span></p>
                    <ul>
                        <li>Demasiados caros → mete 2-3 opciones de gama media.</li>
                        <li>Demasiados baratos → sube precios o quita los que menos rotan.</li>
                    </ul>
                </div>

                <div class="oinfo-principle" style="--p-color: #6366f1;">
                    <div class="oinfo-principle__head">
                        <span class="oinfo-principle__num">3</span>
                        <h3 class="oinfo-principle__title">Relación calidad-precio</h3>
                    </div>
                    <div class="oinfo-principle__rule">
                        El precio medio de lo que <strong>realmente piden</strong> tus clientes debe parecerse al precio medio de tu carta. Ratio entre <strong>0,95 y 1,05</strong>.
                    </div>
                    <p><span class="oinfo-principle__label">Ejemplo:</span> carta con precio medio 14&nbsp;€ y clientes que piden de media 13,80&nbsp;€ → ratio 0,98. Equilibrado.</p>
                    <p><span class="oinfo-principle__label">Por qué importa:</span> es el más revelador. Te dice <strong>dónde está cayendo realmente el dinero</strong> vs dónde tú creías que iba.</p>
                    <p><span class="oinfo-principle__label">Cómo leerlo:</span></p>
                    <ul>
                        <li><strong>Ratio bajo</strong> (&lt; 0,95): los clientes piden lo barato. Sube precios medios un 5-7%, o quita 1-2 baratos.</li>
                        <li><strong>Ratio alto</strong> (&gt; 1,05): los clientes piden lo caro. Mete más opciones medias para no perder al cliente prudente.</li>
                    </ul>
                </div>

                <div class="oinfo-foot">
                    <h4>Cómo leer las tarjetas en la app</h4>
                    <p>Cada principio tiene una etiqueta de color con un semáforo simple:</p>
                    <div class="oinfo-semaforo">
                        <span class="oinfo-chip oinfo-chip--ok">● Equilibrada — bien</span>
                        <span class="oinfo-chip oinfo-chip--warn">● Desbalance — margen de mejora</span>
                        <span class="oinfo-chip oinfo-chip--bad">● Muy desbalanceada — ajustar ya</span>
                    </div>
                    <p style="margin-top:10px;">Debajo de las tres tarjetas verás una <strong>recomendación global</strong> en una frase: te dice qué tocar primero si quieres notar resultados en 4 semanas.</p>
                </div>

                <div class="oinfo-foot" style="margin-top:12px;">
                    <h4>Omnes vs Matriz BCG</h4>
                    <p>Los dos métodos conviven en esta pestaña y se complementan:</p>
                    <ul>
                        <li><strong>Matriz BCG</strong> (Estrella / Puzzle / Caballo / Perro) → te dice qué hacer con <strong>cada plato concreto</strong>.</li>
                        <li><strong>Principios de Omnes</strong> → te dice si <strong>tu carta como conjunto</strong> está bien construida.</li>
                    </ul>
                    <p>BCG es el bisturí. Omnes es el espejo.</p>
                </div>
            </div>
            <div class="oinfo-footer-actions">
                <button type="button" class="oinfo-btn" data-action="close">Entendido</button>
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
    window.mlOmnesInfo = mostrarOmnesInfo;
}
