/**
 * Onboarding Spotlight — modal grande centrado + overlay oscuro + flecha
 * animada que apunta al sidebar a la pestaña del paso actual.
 *
 * Diseño UX (Iker 2026-06-03):
 * - Modal centrado, NO se puede ignorar visualmente.
 * - Overlay semi-transparente sobre el resto de la app.
 * - Sidebar: pestaña del paso destacada (100% opacidad + glow); resto atenuado.
 * - Flecha SVG animada apuntando desde el modal al sidebar.
 * - Skippable: "Lo hago después" → cierra y muestra el widget pequeño (OnboardingChecklist).
 * - Click en pestaña destacada → cierra modal y navega.
 *
 * Comportamiento:
 * - Aparece al entrar al dashboard si onboarding incompleto Y NO skip en esta sesión.
 * - Sessionkey `onboarding_spotlight_skipped` evita que reaparezca tras skip hasta
 *   que el cliente cierre sesión.
 *
 * Reutiliza GET /api/onboarding/status del backend.
 */
import { api } from '../../api/client.js';
import { escapeHTML } from '../../utils/helpers.js';

const PASOS = [
    {
        key: 'proveedores',
        emoji: '🚚',
        titulo: 'Crea tu primer proveedor',
        descripcion: 'Quién te abastece. Tarda 30 segundos y desbloquea el resto del flujo.',
        tab: 'proveedores',
        cta: 'Ir a Proveedores'
    },
    {
        key: 'ingredientes',
        emoji: '🥕',
        titulo: 'Añade tus ingredientes',
        descripcion: 'Tu inventario base. Puedes importar Excel o crear uno a uno.',
        tab: 'ingredientes',
        cta: 'Ir a Ingredientes'
    },
    {
        key: 'recetas',
        emoji: '👨‍🍳',
        titulo: 'Crea tus recetas (escandallo)',
        descripcion: 'Aquí nace el food cost real de cada plato.',
        tab: 'recetas',
        cta: 'Ir a Recetas'
    },
    {
        key: 'pedidos',
        emoji: '📋',
        titulo: 'Registra tu primer pedido',
        descripcion: 'Empieza a trackear compras y precios reales.',
        tab: 'pedidos',
        cta: 'Ir a Pedidos'
    }
];

const OVERLAY_ID = 'onboarding-spotlight-overlay';
const STYLE_ID = 'onboarding-spotlight-styles';
// Cooldown corto para evitar reaperturas inmediatas tras cerrar el modal
// con CTA / skip (durante la transición visual). Re-abre al siguiente
// cambio de tab pasados ~1.5s.
let cooldownUntil = 0;

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${OVERLAY_ID} {
            position: fixed; inset: 0; z-index: 99998;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(2px);
            display: flex; align-items: center; justify-content: center;
            animation: spotlight-fade-in 0.3s ease-out;
        }
        @keyframes spotlight-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .spotlight-modal {
            background: white;
            border-radius: 20px;
            padding: 32px;
            max-width: 480px;
            width: calc(100% - 40px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            position: relative;
            animation: spotlight-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes spotlight-pop {
            from { opacity: 0; transform: scale(0.85); }
            to { opacity: 1; transform: scale(1); }
        }
        .spotlight-progress-bar {
            width: 100%; height: 6px; background: #f3f4f6;
            border-radius: 999px; overflow: hidden; margin: 16px 0 24px;
        }
        .spotlight-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #7c3aed, #6d28d9);
            transition: width 0.4s;
        }
        .spotlight-step-counter {
            display: inline-block;
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white; padding: 4px 12px; border-radius: 999px;
            font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .spotlight-emoji {
            font-size: 48px; line-height: 1; margin: 16px 0 8px;
        }
        .spotlight-title {
            font-size: 22px; font-weight: 700; color: #111827;
            margin: 8px 0;
        }
        .spotlight-desc {
            font-size: 15px; color: #6b7280; margin: 0 0 24px;
            line-height: 1.5;
        }
        .spotlight-cta {
            display: block; width: 100%; text-align: center;
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white; border: none; padding: 14px 20px;
            border-radius: 12px; font-weight: 700; font-size: 15px;
            cursor: pointer; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
            transition: transform 0.1s;
        }
        .spotlight-cta:hover { transform: translateY(-1px); }
        .spotlight-cta:active { transform: translateY(0); }
        .spotlight-skip {
            display: block; width: 100%; text-align: center;
            background: transparent; color: #9ca3af; border: none;
            padding: 12px; font-size: 13px; cursor: pointer;
            margin-top: 8px; text-decoration: underline;
        }
        .spotlight-skip:hover { color: #6b7280; }

        /* Sidebar: levantar sobre el overlay para que el highlight no quede
           bajo la capa oscura (stacking context). Las nav-items siguen
           atenuándose por opacity propia. */
        body.spotlight-active .sidebar {
            position: relative;
            z-index: 99999;
        }
        body.spotlight-active .sidebar .nav-item:not(.spotlight-highlight) {
            opacity: 0.25;
            transition: opacity 0.3s;
            pointer-events: none;
        }
        body.spotlight-active .sidebar .nav-item.spotlight-highlight,
        body.spotlight-active .nav-item.spotlight-highlight {
            position: relative;
            opacity: 1 !important;
            transform: scale(1.06);
            background: linear-gradient(135deg, #a855f7, #7c3aed) !important;
            color: white !important;
            border: 2px solid #ffffff !important;
            border-radius: 12px;
            z-index: 100000;
            animation: spotlight-pulse 1.4s ease-in-out infinite;
        }
        body.spotlight-active .nav-item.spotlight-highlight * {
            color: white !important;
        }
        @keyframes spotlight-pulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7),
                            0 0 20px rgba(168, 85, 247, 0.6),
                            0 8px 24px rgba(124, 58, 237, 0.5);
            }
            50% {
                box-shadow: 0 0 0 12px rgba(168, 85, 247, 0),
                            0 0 32px rgba(168, 85, 247, 0.9),
                            0 12px 32px rgba(124, 58, 237, 0.7);
            }
        }

        /* Flecha animada apuntando al sidebar */
        .spotlight-arrow {
            position: fixed;
            z-index: 99999;
            pointer-events: none;
            animation: spotlight-arrow-bounce 1.2s ease-in-out infinite;
        }
        @keyframes spotlight-arrow-bounce {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-12px); }
        }
        .spotlight-arrow svg { display: block; }

        @media (max-width: 768px) {
            .spotlight-arrow { display: none; }
            body.spotlight-active .sidebar .nav-item:not(.spotlight-highlight) {
                opacity: 0.5;
            }
        }
    `;
    document.head.appendChild(style);
}

function highlightSidebarTab(tabKey) {
    document.querySelectorAll('.sidebar .nav-item.spotlight-highlight')
        .forEach(el => el.classList.remove('spotlight-highlight'));
    const target = document.querySelector(`.sidebar .nav-item[data-tab="${tabKey}"]`);
    if (target) target.classList.add('spotlight-highlight');
    return target;
}

function positionArrow(arrowEl, targetEl) {
    if (!arrowEl || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    arrowEl.style.left = (rect.right + 20) + 'px';
    arrowEl.style.top = (rect.top + rect.height / 2 - 24) + 'px';
}

function buildArrowSVG() {
    const arrow = document.createElement('div');
    arrow.className = 'spotlight-arrow';
    arrow.innerHTML = `
        <svg width="80" height="48" viewBox="0 0 80 48" fill="none">
            <path d="M75 24 L15 24 M30 8 L15 24 L30 40"
                  stroke="#7c3aed" stroke-width="5"
                  stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;
    return arrow;
}

function navigateToTab(tab) {
    if (typeof window.cambiarTab === 'function') {
        window.cambiarTab(tab);
    } else {
        const btn = document.querySelector(`[data-tab="${tab}"]`);
        if (btn) btn.click();
    }
}

function closeSpotlight() {
    document.body.classList.remove('spotlight-active');
    document.querySelectorAll('.sidebar .nav-item.spotlight-highlight')
        .forEach(el => el.classList.remove('spotlight-highlight'));
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
}

function bumpCooldown(ms = 1500) {
    cooldownUntil = Date.now() + ms;
}

if (typeof window !== 'undefined') {
    window.__onboardingSpotlightClose = () => { closeSpotlight(); bumpCooldown(); };
    window.__onboardingSpotlightSkip = () => { closeSpotlight(); bumpCooldown(); };
    window.__onboardingSpotlightGo = (tab) => {
        closeSpotlight();
        bumpCooldown();
        navigateToTab(tab);
    };
}

function getCurrentTab() {
    // Pestaña activa: clase 'active' en .tab-content visible
    const activeContent = document.querySelector('.tab-content.active, .tab-content[style*="block"]');
    if (activeContent && activeContent.id?.startsWith('tab-')) {
        return activeContent.id.replace('tab-', '');
    }
    // Fallback: nav-item con clase active
    const activeNav = document.querySelector('.nav-item.active[data-tab]');
    return activeNav?.dataset?.tab || null;
}

function renderModal(status) {
    const pasosWithStatus = PASOS.map(def => {
        const s = (status.pasos || []).find(p => p.key === def.key);
        return { ...def, completado: !!(s && s.completed_at) };
    });
    const completados = pasosWithStatus.filter(p => p.completado).length;
    const total = pasosWithStatus.length;
    const indiceSiguiente = pasosWithStatus.findIndex(p => !p.completado);
    if (indiceSiguiente === -1) return null; // todo completado
    const paso = pasosWithStatus[indiceSiguiente];
    const progresoPct = (completados / total * 100).toFixed(0);

    // Si el cliente ya está en la pestaña del paso pendiente, no apuntamos
    // al sidebar (es donde ya está) — modal sin flecha y CTA distinto.
    const currentTab = getCurrentTab();
    const yaEstaEnPaso = currentTab === paso.tab;

    const target = yaEstaEnPaso ? null : highlightSidebarTab(paso.tab);

    const ctaHtml = yaEstaEnPaso
        ? `<button class="spotlight-cta" onclick="window.__onboardingSpotlightClose()">
                Empezar aquí ✓
           </button>`
        : `<button class="spotlight-cta" onclick="window.__onboardingSpotlightGo('${escapeHTML(paso.tab)}')">
                ${escapeHTML(paso.cta)} →
           </button>`;

    const descAdaptada = yaEstaEnPaso
        ? `Estás en el sitio correcto. ${paso.descripcion}`
        : paso.descripcion;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
        <div class="spotlight-modal" role="dialog" aria-modal="true">
            <span class="spotlight-step-counter">Paso ${completados + 1} de ${total}</span>
            <div class="spotlight-progress-bar">
                <div class="spotlight-progress-fill" style="width:${progresoPct}%"></div>
            </div>
            <div class="spotlight-emoji">${paso.emoji}</div>
            <h2 class="spotlight-title">${escapeHTML(paso.titulo)}</h2>
            <p class="spotlight-desc">${escapeHTML(descAdaptada)}</p>
            ${ctaHtml}
            <button class="spotlight-skip" onclick="window.__onboardingSpotlightSkip()">
                Lo hago yo después
            </button>
        </div>
    `;

    if (target) {
        const arrow = buildArrowSVG();
        overlay.appendChild(arrow);
        document.body.appendChild(overlay);
        document.body.classList.add('spotlight-active');
        positionArrow(arrow, target);
        const reposition = () => positionArrow(arrow, target);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        const observer = new MutationObserver(() => {
            if (!document.getElementById(OVERLAY_ID)) {
                window.removeEventListener('resize', reposition);
                window.removeEventListener('scroll', reposition, true);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true });
    } else {
        document.body.appendChild(overlay);
        document.body.classList.add('spotlight-active');
    }

    return overlay;
}

/**
 * Punto de entrada. Llamar:
 *  - al entrar al dashboard
 *  - tras cambiar de pestaña
 *  - tras crear un proveedor / ingrediente / receta / pedido
 *
 * Decide si abrir el spotlight:
 *  - onboarding completado → no
 *  - dentro del cooldown (1.5s tras cerrar) → no
 *  - ya hay overlay abierto → no duplicar
 */
export async function renderOnboardingSpotlight() {
    if (Date.now() < cooldownUntil) return;
    if (document.getElementById(OVERLAY_ID)) return;

    let status;
    try {
        status = await api.getOnboardingStatus();
    } catch (err) {
        console.warn('[OnboardingSpotlight] status no disponible:', err?.message);
        return;
    }

    if (status.completado) {
        closeSpotlight();
        return;
    }

    injectStyles();
    renderModal(status);
}

if (typeof window !== 'undefined') {
    window.refreshOnboardingSpotlight = renderOnboardingSpotlight;
}
