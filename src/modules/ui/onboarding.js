/**
 * Onboarding Tour Module
 * Step-by-step guide for new users
 * 
 * @module modules/ui/onboarding
 */

const STORAGE_KEY = 'mindloop_onboarding_complete';

// Tour steps configuration
const tourSteps = [
    {
        target: '#kpi-ingresos',
        title: '💰 Dashboard de KPIs',
        content: 'Aquí ves el resumen de tu negocio: ingresos, pedidos, stock bajo y margen promedio.',
        position: 'bottom'
    },
    {
        target: '#tab-btn-ingredientes',
        title: '📦 Ingredientes',
        content: 'Gestiona tus ingredientes, precios y proveedores. El stock se actualiza automáticamente.',
        position: 'top'
    },
    {
        target: '#tab-btn-recetas',
        title: '👨‍🍳 Recetas y Escandallo',
        content: 'Crea recetas con cálculo automático de coste. Exporta fichas técnicas en PDF.',
        position: 'top'
    },
    {
        target: '#tab-btn-ventas',
        title: '💵 Ventas',
        content: 'Registra ventas diarias. El stock de ingredientes se descuenta automáticamente.',
        position: 'top'
    },
    {
        target: '#global-search-container',
        title: '🔍 Búsqueda Rápida',
        content: 'Pulsa ⌘K (o Ctrl+K) para buscar cualquier cosa: ingredientes, recetas, pedidos...',
        position: 'bottom'
    }
];

let currentStep = 0;
let overlay = null;
let tooltip = null;

/**
 * Checks if user has completed onboarding
 */
export function isOnboardingComplete() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Marks onboarding as complete
 */
export function completeOnboarding() {
    localStorage.setItem(STORAGE_KEY, 'true');
}

/**
 * Resets onboarding to show again
 */
export function resetOnboarding() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Starts the onboarding tour
 */
export function startTour() {
    currentStep = 0;
    createOverlay();
    showStep(currentStep);
}

/**
 * Creates the overlay element
 */
function createOverlay() {
    // Remove existing
    removeOverlay();

    // Create overlay
    overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.innerHTML = `
        <style>
            #onboarding-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                pointer-events: none;
            }
            .onboarding-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.6);
                pointer-events: auto;
            }
            .onboarding-highlight {
                position: absolute;
                box-shadow: 0 0 0 9999px rgba(0,0,0,0.6);
                border-radius: 8px;
                z-index: 10001;
                pointer-events: none;
                transition: all 0.3s ease;
            }
            .onboarding-tooltip {
                position: absolute;
                background: white;
                border-radius: 12px;
                padding: 20px;
                max-width: 320px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                z-index: 10002;
                pointer-events: auto;
                animation: tooltipFadeIn 0.3s ease;
            }
            @keyframes tooltipFadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .onboarding-tooltip h4 {
                margin: 0 0 10px 0;
                font-size: 16px;
                color: #1E293B;
            }
            .onboarding-tooltip p {
                margin: 0 0 16px 0;
                font-size: 14px;
                color: #64748B;
                line-height: 1.5;
            }
            .onboarding-tooltip .buttons {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .onboarding-tooltip .step-counter {
                font-size: 12px;
                color: #94A3B8;
            }
            .onboarding-tooltip .btn-group {
                display: flex;
                gap: 10px;
            }
            .onboarding-tooltip button {
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            .onboarding-tooltip .btn-skip {
                background: transparent;
                border: none;
                color: #94A3B8;
            }
            .onboarding-tooltip .btn-skip:hover {
                color: #64748B;
            }
            .onboarding-tooltip .btn-next {
                background: linear-gradient(135deg, #667eea, #764ba2);
                border: none;
                color: white;
            }
            .onboarding-tooltip .btn-next:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .onboarding-arrow {
                position: absolute;
                width: 0;
                height: 0;
                border: 10px solid transparent;
            }
            .onboarding-arrow.top {
                bottom: -20px;
                left: 50%;
                transform: translateX(-50%);
                border-top-color: white;
            }
            .onboarding-arrow.bottom {
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                border-bottom-color: white;
            }
        </style>
        <div class="onboarding-backdrop"></div>
    `;

    document.body.appendChild(overlay);
}

/**
 * Shows a specific step
 */
function showStep(index) {
    const step = tourSteps[index];
    if (!step) {
        finishTour();
        return;
    }

    const target = document.querySelector(step.target);
    if (!target) {
        // Skip to next if target not found
        nextStep();
        return;
    }

    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
        const rect = target.getBoundingClientRect();

        // Create/update highlight
        let highlight = overlay.querySelector('.onboarding-highlight');
        if (!highlight) {
            highlight = document.createElement('div');
            highlight.className = 'onboarding-highlight';
            overlay.appendChild(highlight);
        }

        highlight.style.top = (rect.top - 8) + 'px';
        highlight.style.left = (rect.left - 8) + 'px';
        highlight.style.width = (rect.width + 16) + 'px';
        highlight.style.height = (rect.height + 16) + 'px';

        // Create tooltip
        showTooltip(step, rect);
    }, 300);
}

/**
 * Shows tooltip for current step
 */
function showTooltip(step, targetRect) {
    // Remove existing tooltip
    const existingTooltip = overlay.querySelector('.onboarding-tooltip');
    if (existingTooltip) existingTooltip.remove();

    tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';

    const isLastStep = currentStep === tourSteps.length - 1;

    tooltip.innerHTML = `
        <div class="onboarding-arrow ${step.position}"></div>
        <h4>${step.title}</h4>
        <p>${step.content}</p>
        <div class="buttons">
            <span class="step-counter">${currentStep + 1} de ${tourSteps.length}</span>
            <div class="btn-group">
                <button class="btn-skip" onclick="window.skipOnboarding()">Saltar</button>
                <button class="btn-next" onclick="window.nextOnboardingStep()">${isLastStep ? '¡Listo!' : 'Siguiente →'}</button>
            </div>
        </div>
    `;

    overlay.appendChild(tooltip);

    // Position tooltip
    const tooltipRect = tooltip.getBoundingClientRect();
    let top, left;

    if (step.position === 'bottom') {
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    } else {
        top = targetRect.top - tooltipRect.height - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    }

    // Keep within viewport
    left = Math.max(20, Math.min(left, window.innerWidth - tooltipRect.width - 20));
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipRect.height - 20));

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
}

/**
 * Moves to next step
 */
function nextStep() {
    currentStep++;
    if (currentStep >= tourSteps.length) {
        finishTour();
    } else {
        showStep(currentStep);
    }
}

/**
 * Skips the tour
 */
function skipTour() {
    finishTour();
}

/**
 * Finishes the tour
 */
function finishTour() {
    completeOnboarding();
    removeOverlay();

    // Show success toast
    if (typeof window.showToast === 'function') {
        window.showToast('¡Tour completado! Ya conoces lo básico.', 'success');
    }
}

/**
 * Removes overlay and tooltip
 */
function removeOverlay() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
}

/**
 * Initializes onboarding (checks if should show)
 */
export function initOnboarding() {
    // Expose functions globally
    window.startTour = startTour;
    window.resetOnboarding = resetOnboarding;
    window.nextOnboardingStep = nextStep;
    window.skipOnboarding = skipTour;

    // Check if first time
    if (!isOnboardingComplete()) {
        // Show tour after a delay (let app load first)
        setTimeout(() => {
            startTour();
        }, 2500);
    }
}

export default {
    startTour,
    resetOnboarding,
    isOnboardingComplete,
    initOnboarding
};
