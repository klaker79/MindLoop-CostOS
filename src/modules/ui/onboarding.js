/**
 * Onboarding Wizard — Premium 4-Step Experience
 * "Crea tu primera receta con food cost en vivo"
 * 
 * Steps:
 *  1. Welcome — Feature highlights
 *  2. Recipe basics — Name, price, category
 *  3. Ingredients — Interactive selection + live food cost gauge
 *  4. Results — Dashboard with KPIs + confetti
 * 
 * @module modules/ui/onboarding
 */

import '../../styles/onboarding-wizard.css';
import { DEMO_INGREDIENTS, DEFAULT_QUANTITIES } from '../../data/onboarding-defaults';

const STORAGE_KEY = 'mindloop_onboarding_complete';

// ─── State ───
let wizardState = {
    currentStep: 0,
    recipe: {
        nombre: '',
        precio_venta: 0,
        categoria: 'principal',
        porciones: 1,
    },
    selectedIngredients: new Map(), // id -> { nombre, precio, unidad, cantidad }
    overlay: null,
};

// ─── Storage helpers ───
export function isOnboardingComplete() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function completeOnboarding() {
    localStorage.setItem(STORAGE_KEY, 'true');
}

export function resetOnboarding() {
    localStorage.removeItem(STORAGE_KEY);
}

export function initOnboarding() {
    if (!isOnboardingComplete()) {
        renderWizard();
    }
}

// ─── Get available ingredients ───
function getIngredients() {
    // Try real data first
    if (window.ingredientes && window.ingredientes.length > 0) {
        return window.ingredientes.slice(0, 12).map(ing => ({
            id: ing.id,
            nombre: ing.nombre,
            precio: parseFloat(ing.precio_medio || ing.precio || 0),
            unidad: ing.unidad || 'kg',
        }));
    }
    return DEMO_INGREDIENTS;
}

// ─── Calculate food cost ───
function calculateFoodCost() {
    let totalCost = 0;
    wizardState.selectedIngredients.forEach(item => {
        totalCost += item.precio * item.cantidad;
    });

    const precioVenta = wizardState.recipe.precio_venta || 1;
    const porciones = wizardState.recipe.porciones || 1;
    const costePorcion = totalCost / porciones;
    const foodCost = precioVenta > 0 ? (costePorcion / precioVenta) * 100 : 0;
    const margen = precioVenta - costePorcion;

    return {
        costTotal: totalCost,
        costePorcion,
        foodCost: Math.min(foodCost, 100),
        margen,
        precioVenta,
    };
}

// ─── Get food cost status ───
function getFoodCostStatus(fc) {
    if (fc <= 0) return { class: 'good', emoji: '⏳', label: 'Añade ingredientes' };
    if (fc < 30) return { class: 'good', emoji: '🟢', label: 'Excelente' };
    if (fc < 40) return { class: 'warning', emoji: '🟡', label: 'Atención' };
    return { class: 'danger', emoji: '🔴', label: 'Crítico' };
}

// ─── Render functions ───

function renderWizard() {
    // Clean previous
    if (wizardState.overlay) wizardState.overlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'wizard-overlay';
    overlay.id = 'onboarding-wizard';

    overlay.innerHTML = `
        <div class="wizard-card">
            <div class="wizard-progress">
                ${[0, 1, 2, 3, 4, 5].map(i => `
                    <div class="wizard-progress-dot ${i === 0 ? 'active' : ''}" data-step="${i}"></div>
                `).join('')}
            </div>
            <div id="wizard-steps-container"></div>
        </div>
    `;

    document.body.appendChild(overlay);
    wizardState.overlay = overlay;
    wizardState.currentStep = 0;
    renderStep(0);
}

function updateProgress(step) {
    if (!wizardState.overlay) return;
    const dots = wizardState.overlay.querySelectorAll('.wizard-progress-dot');
    dots.forEach((dot, i) => {
        dot.className = 'wizard-progress-dot';
        if (i < step) dot.classList.add('completed');
        else if (i === step) dot.classList.add('active');
    });
}

function renderStep(step) {
    const container = document.getElementById('wizard-steps-container');
    if (!container) return;

    updateProgress(step);

    // Animate out
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';

    // ─── Step Navigation ───
    setTimeout(() => {
        switch (step) {
            case 0: container.innerHTML = renderWelcome(); break;
            case 1: container.innerHTML = renderConfiguration(); break; // NEW
            case 2: container.innerHTML = renderPantry(); break;       // NEW
            case 3: container.innerHTML = renderRecipeForm(); break;   // Was 1
            case 4: container.innerHTML = renderIngredients(); break;  // Was 2
            case 5: container.innerHTML = renderResults(); break;      // Was 3
        }

        // Animate in
        requestAnimationFrame(() => {
            container.style.transition = 'all 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        });

        // Bind events
        bindStepEvents(step);
    }, step === 0 ? 0 : 200);
}

// ─── Step 1: Welcome ───
function renderWelcome() {
    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">🍽️</div>
            <h2>Bienvenido a <span class="highlight">CostOS</span></h2>
            <p class="wizard-subtitle">Control de costes en piloto automático.<br>Vamos a crear tu primera receta en 2 minutos.</p>

            <div class="wizard-features">
                <div class="wizard-feature">
                    <span class="wizard-feature-icon">👨‍🍳</span>
                    <span class="wizard-feature-title">Recetas</span>
                    <span class="wizard-feature-desc">Escandallo automático</span>
                </div>
                <div class="wizard-feature">
                    <span class="wizard-feature-icon">📦</span>
                    <span class="wizard-feature-title">Inventario</span>
                    <span class="wizard-feature-desc">Stock en tiempo real</span>
                </div>
                <div class="wizard-feature">
                    <span class="wizard-feature-icon">📊</span>
                    <span class="wizard-feature-title">Análisis</span>
                    <span class="wizard-feature-desc">Márgenes y KPIs</span>
                </div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-primary" id="wizard-start">
                    Crear mi primera receta →
                </button>
            </div>
            <button class="wizard-skip" id="wizard-skip-all">Ya conozco la plataforma</button>
        </div>
    `;
}

// ─── Step 1: Configuration (Costes Fijos) ───
function renderConfiguration() {
    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">⚙️</div>
            <h2>Configura tu <span class="highlight">Negocio</span></h2>
            <p class="wizard-subtitle">Para calcular márgenes reales, necesitamos un par de datos básicos.</p>

            <div class="wizard-form-group">
                <label>Costes Fijos Mensuales (€)</label>
                <div class="wizard-input-hint">Alquiler, luz, agua, nóminas... (Aprox)</div>
                <input type="number" id="wiz-costes-fijos" placeholder="Ej: 4500" min="0" step="100">
            </div>

            <div class="wizard-form-group">
                <label>Margen de Beneficio Objetivo (%)</label>
                <div class="wizard-input-hint">¿Cuánto quieres ganar netamente por plato?</div>
                <div class="wizard-range-wrapper">
                    <input type="range" id="wiz-margen-objetivo" min="5" max="50" value="20" step="1">
                    <span id="wiz-margen-val">20%</span>
                </div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" id="wizard-back-welcome">← Atrás</button>
                <button class="wizard-btn wizard-btn-primary" id="wizard-next-pantry">
                    Siguiente: Despensa →
                </button>
            </div>
            <button class="wizard-skip" id="wizard-skip-config">Saltar configuración</button>
        </div>
    `;
}

function bindConfigurationEvents() {
    const nextBtn = document.getElementById('wizard-next-pantry');
    const backBtn = document.getElementById('wizard-back-welcome');
    const skipBtn = document.getElementById('wizard-skip-config');
    const slider = document.getElementById('wiz-margen-objetivo');
    const sliderVal = document.getElementById('wiz-margen-val');
    const costesInput = document.getElementById('wiz-costes-fijos');

    // Slider logic
    if (slider && sliderVal) {
        slider.addEventListener('input', (e) => {
            sliderVal.textContent = e.target.value + '%';
        });
    }

    // Save & Next
    nextBtn?.addEventListener('click', async () => {
        const costesFijos = parseFloat(costesInput?.value) || 0;
        const margenObjetivo = parseInt(slider?.value) || 20;

        // Guardar configuración (mock o real)
        try {
            if (window.api?.updateConfig) {
                await window.api.updateConfig({ costesFijos, margenObjetivo });
            }
            // Guardar localmente también por si acaso
            localStorage.setItem('mindloop_config_costes', costesFijos);
            localStorage.setItem('mindloop_config_margen', margenObjetivo);
        } catch (e) {
            console.error(e);
        }

        wizardState.currentStep = 2;
        renderStep(2);
    });

    backBtn?.addEventListener('click', () => {
        wizardState.currentStep = 0;
        renderStep(0);
    });

    skipBtn?.addEventListener('click', () => {
        wizardState.currentStep = 2;
        renderStep(2);
    });
}
function renderRecipeForm() {
    const r = wizardState.recipe;
    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">📝</div>
            <h2>Nombra tu <span class="highlight">receta</span></h2>
            <p class="wizard-subtitle">¿Cuál es el plato estrella de tu carta?</p>

            <div class="wizard-recipe-form">
                <div class="wizard-form-group">
                    <label>Nombre del plato</label>
                    <input type="text" id="wiz-nombre" placeholder="Ej: Paella Valenciana" 
                           value="${r.nombre}" autocomplete="off" autofocus>
                </div>
                <div class="wizard-form-row">
                    <div class="wizard-form-group">
                        <label>Precio venta (€)</label>
                        <input type="number" id="wiz-precio" placeholder="18.00" 
                               value="${r.precio_venta || ''}" step="0.5" min="0">
                    </div>
                    <div class="wizard-form-group">
                        <label>Categoría</label>
                        <select id="wiz-categoria">
                            <option value="entrante" ${r.categoria === 'entrante' ? 'selected' : ''}>🥗 Entrante</option>
                            <option value="principal" ${r.categoria === 'principal' ? 'selected' : ''}>🍖 Principal</option>
                            <option value="postre" ${r.categoria === 'postre' ? 'selected' : ''}>🍰 Postre</option>
                            <option value="bebida" ${r.categoria === 'bebida' ? 'selected' : ''}>🥤 Bebida</option>
                            <option value="tapa" ${r.categoria === 'tapa' ? 'selected' : ''}>🍢 Tapa</option>
                        </select>
                    </div>
                </div>
                <div class="wizard-form-row">
                    <div class="wizard-form-group">
                        <label>Porciones por lote</label>
                        <input type="number" id="wiz-porciones" placeholder="1" 
                               value="${r.porciones || 1}" min="1" step="1">
                    </div>
                    <div class="wizard-form-group" style="display:flex;align-items:flex-end;">
                        <div style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.4;padding-bottom:12px;">
                            Si tu receta produce varias raciones, indícalo aquí
                        </div>
                    </div>
                </div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" id="wizard-back">← Atrás</button>
                <button class="wizard-btn wizard-btn-primary" id="wizard-next" disabled>Siguiente →</button>
            </div>
            <button class="wizard-skip" id="wizard-skip-all">Saltar configuración</button>
        </div>
    `;
}

// ─── Step 3: Ingredients + Live Food Cost ───
function renderIngredients() {
    const ingredients = getIngredients();
    const fc = calculateFoodCost();
    const status = getFoodCostStatus(fc.foodCost);

    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">🧑‍🍳</div>
            <h2>Añade los <span class="highlight">ingredientes</span></h2>
            <p class="wizard-subtitle">Selecciona ingredientes y ajusta cantidades. El food cost se calcula al instante.</p>

            <div class="wizard-ingredient-list" id="wiz-ingredients">
                ${ingredients.map(ing => {
        const selected = wizardState.selectedIngredients.has(ing.id);
        const qty = selected
            ? wizardState.selectedIngredients.get(ing.id).cantidad
            : (DEFAULT_QUANTITIES[ing.id] || 0.1);
        return `
                        <div class="wizard-ingredient-row ${selected ? 'selected' : ''}">
                            <input type="checkbox" id="wiz-ing-${ing.id}" data-id="${ing.id}" 
                                   ${selected ? 'checked' : ''}>
                            <label for="wiz-ing-${ing.id}">${ing.nombre}</label>
                            <input type="number" class="wiz-ing-qty" data-id="${ing.id}" 
                                   value="${qty}" step="0.01" min="0.001"
                                   ${!selected ? 'disabled' : ''}>
                            <span style="font-size:11px;color:rgba(255,255,255,0.3);min-width:55px;text-align:right;">
                                ${ing.precio.toFixed(2)}€/${ing.unidad}
                            </span>
                        </div>
                    `;
    }).join('')}
            </div>

            <div class="wizard-foodcost-live ${status.class}" id="wiz-fc-panel">
                <div class="wizard-foodcost-row">
                    <span class="wizard-foodcost-label">Coste total del lote</span>
                    <span class="wizard-foodcost-value" id="wiz-fc-cost">${fc.costTotal.toFixed(2)}€</span>
                </div>
                <div class="wizard-foodcost-row">
                    <span class="wizard-foodcost-label">Coste por porción</span>
                    <span class="wizard-foodcost-value" id="wiz-fc-porcion">${fc.costePorcion.toFixed(2)}€</span>
                </div>
                <div class="wizard-foodcost-row">
                    <span class="wizard-foodcost-label">Food Cost</span>
                    <span class="wizard-foodcost-value" id="wiz-fc-pct">
                        ${status.emoji} ${fc.foodCost.toFixed(1)}%
                    </span>
                </div>
                <div class="wizard-foodcost-bar">
                    <div class="wizard-foodcost-bar-fill ${status.class}" 
                         id="wiz-fc-bar" style="width: ${Math.min(fc.foodCost, 100)}%"></div>
                </div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" id="wizard-back">← Atrás</button>
                <button class="wizard-btn wizard-btn-primary" id="wizard-next" 
                        ${wizardState.selectedIngredients.size === 0 ? 'disabled' : ''}>
                    Ver resultado →
                </button>
            </div>
            <button class="wizard-skip" id="wizard-skip-all">Saltar configuración</button>
        </div>
    `;
}

// ─── Step 4: Results ───
function renderResults() {
    const fc = calculateFoodCost();
    const status = getFoodCostStatus(fc.foodCost);
    const numIngredients = wizardState.selectedIngredients.size;

    let verdictText = '';
    let verdictClass = '';
    if (fc.foodCost < 30) {
        verdictText = `<strong>¡Margen excelente!</strong> Tu food cost del ${fc.foodCost.toFixed(1)}% está en el rango ideal. Este plato genera <strong>${fc.margen.toFixed(2)}€ de margen</strong> por ración.`;
        verdictClass = '';
    } else if (fc.foodCost < 40) {
        verdictText = `<strong>Margen aceptable.</strong> Tu food cost del ${fc.foodCost.toFixed(1)}% está en zona de atención. Revisa si puedes ajustar algún ingrediente para mejorar el margen de <strong>${fc.margen.toFixed(2)}€</strong>.`;
        verdictClass = 'warning';
    } else {
        verdictText = `<strong>¡Cuidado!</strong> Tu food cost del ${fc.foodCost.toFixed(1)}% es alto. Considera aumentar el precio de venta o reducir cantidades. Margen actual: <strong>${fc.margen.toFixed(2)}€</strong>.`;
        verdictClass = 'danger';
    }

    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">🎉</div>
            <h2>Tu receta <span class="highlight">${wizardState.recipe.nombre || 'está lista'}</span></h2>
            <p class="wizard-subtitle">Aquí tienes el análisis completo de costes.</p>

            <div class="wizard-results">
                <div class="wizard-result-card">
                    <span class="icon">💰</span>
                    <span class="value">${fc.costePorcion.toFixed(2)}€</span>
                    <span class="label">Coste / ración</span>
                </div>
                <div class="wizard-result-card highlight">
                    <span class="icon">📊</span>
                    <span class="value">${fc.foodCost.toFixed(1)}%</span>
                    <span class="label">Food Cost</span>
                </div>
                <div class="wizard-result-card">
                    <span class="icon">📈</span>
                    <span class="value">${fc.margen.toFixed(2)}€</span>
                    <span class="label">Margen bruto</span>
                </div>
                <div class="wizard-result-card">
                    <span class="icon">🧂</span>
                    <span class="value">${numIngredients}</span>
                    <span class="label">Ingredientes</span>
                </div>
            </div>

            <div class="wizard-verdict ${verdictClass}">
                <div class="wizard-verdict-text">${verdictText}</div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-success" id="wizard-finish">
                    🚀 Ir al Dashboard
                </button>
            </div>
            <button class="wizard-skip" id="wizard-back-results" style="margin-top:8px;">← Volver a editar</button>
        </div>
    `;
}

// ─── Confetti ───
function launchConfetti() {
    const overlay = wizardState.overlay;
    if (!overlay) return;

    const card = overlay.querySelector('.wizard-card');
    if (!card) return;

    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'wizard-confetti';
    card.appendChild(confettiContainer);

    const colors = ['#8B5CF6', '#a78bfa', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#FFD700'];

    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.className = 'wizard-confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.top = '-10px';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 0.8 + 's';
        piece.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (4 + Math.random() * 6) + 'px';
        confettiContainer.appendChild(piece);
    }

    setTimeout(() => confettiContainer.remove(), 4000);
}

// ─── Event Binding ───
function bindStepEvents(step) {
    // Common: skip button
    const skipBtn = document.getElementById('wizard-skip-all');
    if (skipBtn) skipBtn.addEventListener('click', closeWizard);

    // Common: back button
    const backBtn = document.getElementById('wizard-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            wizardState.currentStep--;
            renderStep(wizardState.currentStep);
        });
    }

    switch (step) {
        case 0: bindWelcomeEvents(); break;
        case 1: bindConfigurationEvents(); break;
        case 2: bindPantryEvents(); break;
        case 3: bindRecipeFormEvents(); break;
        case 4: bindIngredientEvents(); break;
        case 5: bindResultEvents(); break;
    }
}

function bindWelcomeEvents() {
    document.getElementById('wizard-start')?.addEventListener('click', () => {
        wizardState.currentStep = 1;
        renderStep(1);
    });
}

function bindRecipeFormEvents() {
    const nameInput = document.getElementById('wiz-nombre');
    const priceInput = document.getElementById('wiz-precio');
    const catSelect = document.getElementById('wiz-categoria');
    const portionsInput = document.getElementById('wiz-porciones');
    const nextBtn = document.getElementById('wizard-next');

    function validateForm() {
        const name = nameInput?.value.trim() || '';
        const price = parseFloat(priceInput?.value) || 0;
        wizardState.recipe.nombre = name;
        wizardState.recipe.precio_venta = price;
        wizardState.recipe.categoria = catSelect?.value || 'principal';
        wizardState.recipe.porciones = parseInt(portionsInput?.value) || 1;

        if (nextBtn) nextBtn.disabled = !(name.length >= 2 && price > 0);
    }

    nameInput?.addEventListener('input', validateForm);
    priceInput?.addEventListener('input', validateForm);
    catSelect?.addEventListener('change', validateForm);
    portionsInput?.addEventListener('input', validateForm);
    validateForm();

    // Focus name field
    setTimeout(() => nameInput?.focus(), 300);

    nextBtn?.addEventListener('click', () => {
        validateForm();
        if (!nextBtn.disabled) {
            wizardState.currentStep = 2;
            renderStep(2);
        }
    });
}

function bindIngredientEvents() {
    const ingredients = getIngredients();
    const container = document.getElementById('wiz-ingredients');
    const nextBtn = document.getElementById('wizard-next');

    function updateFoodCostDisplay() {
        const fc = calculateFoodCost();
        const status = getFoodCostStatus(fc.foodCost);

        const costEl = document.getElementById('wiz-fc-cost');
        const porcionEl = document.getElementById('wiz-fc-porcion');
        const pctEl = document.getElementById('wiz-fc-pct');
        const barEl = document.getElementById('wiz-fc-bar');
        const panel = document.getElementById('wiz-fc-panel');

        if (costEl) costEl.textContent = fc.costTotal.toFixed(2) + '€';
        if (porcionEl) porcionEl.textContent = fc.costePorcion.toFixed(2) + '€';
        if (pctEl) pctEl.innerHTML = `${status.emoji} ${fc.foodCost.toFixed(1)}%`;
        if (barEl) {
            barEl.style.width = Math.min(fc.foodCost, 100) + '%';
            barEl.className = `wizard-foodcost-bar-fill ${status.class}`;
        }
        if (panel) panel.className = `wizard-foodcost-live ${status.class}`;
        if (nextBtn) nextBtn.disabled = wizardState.selectedIngredients.size === 0;
    }

    if (!container) return;

    // Checkbox changes
    container.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const id = parseInt(e.target.dataset.id);
            const ing = ingredients.find(i => i.id === id);
            if (!ing) return;

            const row = e.target.closest('.wizard-ingredient-row');
            const qtyInput = row?.querySelector('.wiz-ing-qty');

            if (e.target.checked) {
                const qty = parseFloat(qtyInput?.value) || DEFAULT_QUANTITIES[id] || 0.1;
                wizardState.selectedIngredients.set(id, {
                    nombre: ing.nombre,
                    precio: ing.precio,
                    unidad: ing.unidad,
                    cantidad: qty,
                });
                if (qtyInput) qtyInput.disabled = false;
                row?.classList.add('selected');
            } else {
                wizardState.selectedIngredients.delete(id);
                if (qtyInput) qtyInput.disabled = true;
                row?.classList.remove('selected');
            }
            updateFoodCostDisplay();
        }
    });

    // Quantity changes
    container.addEventListener('input', (e) => {
        if (e.target.classList.contains('wiz-ing-qty')) {
            const id = parseInt(e.target.dataset.id);
            const qty = parseFloat(e.target.value) || 0;
            if (wizardState.selectedIngredients.has(id)) {
                wizardState.selectedIngredients.get(id).cantidad = qty;
                updateFoodCostDisplay();
            }
        }
    });

    nextBtn?.addEventListener('click', () => {
        if (wizardState.selectedIngredients.size > 0) {
            wizardState.currentStep = 3;
            renderStep(3);
            // Launch confetti after animation
            setTimeout(launchConfetti, 500);
        }
    });
}

function bindResultEvents() {
    document.getElementById('wizard-finish')?.addEventListener('click', () => {
        // Try to save the recipe to the real database
        saveRecipeToDatabase();
        closeWizard();
    });

    document.getElementById('wizard-back-results')?.addEventListener('click', () => {
        wizardState.currentStep = 2;
        renderStep(2);
    });
}

// ─── Save recipe (best-effort) ───
async function saveRecipeToDatabase() {
    try {
        const ingredientes = [];
        wizardState.selectedIngredients.forEach((item, id) => {
            ingredientes.push({
                ingredienteId: id,
                cantidad: item.cantidad,
            });
        });

        const receta = {
            nombre: wizardState.recipe.nombre,
            categoria: wizardState.recipe.categoria,
            precio_venta: wizardState.recipe.precio_venta,
            porciones: wizardState.recipe.porciones,
            ingredientes,
        };

        // Use the API if available
        if (window.api?.createReceta) {
            await window.api.createReceta(receta);
            window.showToast?.('¡Receta creada! Ya puedes verla en Recetas.', 'success');
            // Reload data
            window.cargarDatos?.();
        }
    } catch (error) {
        console.warn('Could not save onboarding recipe:', error);
        // Don't show error — it's a demo, not critical
    }
}

// ─── Close wizard ───
function closeWizard() {
    completeOnboarding();
    const overlay = wizardState.overlay;
    if (overlay) {
        overlay.classList.add('closing');
        setTimeout(() => {
            overlay.remove();
            wizardState.overlay = null;
            // Reset state for potential re-use
            wizardState.currentStep = 0;
            wizardState.selectedIngredients.clear();
            window.showToast?.('¡Listo! Explora tu dashboard para empezar.', 'success');
        }, 400);
    }
}

// ─── Public API ───
// ─── Step 2: The Pantry (Ingredients) ───
function renderPantry() {
    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">🥦</div>
            <h2>Llena tu <span class="highlight">Despensa</span></h2>
            <p class="wizard-subtitle">¿Qué ingredientes compras habitualmente? Vamos a añadir los básicos.</p>

            <div class="wizard-pantry-options">
                <div class="wizard-feature" id="wiz-load-demo" style="cursor:pointer; text-align:center; padding:30px;">
                    <span class="wizard-feature-icon">✨</span>
                    <span class="wizard-feature-title">Cargar Despensa Demo</span>
                    <span class="wizard-feature-desc">Añade 12 ingredientes básicos (Arroz, Pollo, Aceite...) automáticamente.</span>
                </div>
                
                <div style="margin: 20px 0; text-align: center; color: rgba(255,255,255,0.3); font-size: 12px;">— O AÑADE MANUALMENTE —</div>

                <div class="wizard-form-group">
                    <input type="text" id="wiz-pantry-input" placeholder="Escribe un ingrediente y pulsa Enter (ej: Tomate)" autocomplete="off">
                </div>
                
                <div class="wizard-pantry-tags" id="wiz-pantry-tags">
                   <!-- Tags will appear here -->
                </div>
            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-secondary" id="wizard-back-config">← Atrás</button>
                <button class="wizard-btn wizard-btn-primary" id="wizard-next-recipe" disabled>
                    Siguiente: Crear Receta →
                </button>
            </div>
        </div>
    `;
}

function bindPantryEvents() {
    const loadDemoBtn = document.getElementById('wiz-load-demo');
    const input = document.getElementById('wiz-pantry-input');
    const tagsContainer = document.getElementById('wiz-pantry-tags');
    const nextBtn = document.getElementById('wizard-next-recipe');
    const backBtn = document.getElementById('wizard-back-config');

    // Load available ingredients if any
    const existingIngredients = window.ingredientes || [];
    const addedIngredients = new Set(existingIngredients.map(i => i.nombre));

    function renderTags() {
        tagsContainer.innerHTML = Array.from(addedIngredients).map(name => `
            <span class="wizard-tag">${name} <span class="remove" data-name="${name}">×</span></span>
        `).join('');

        // Update next button
        if (nextBtn) nextBtn.disabled = addedIngredients.size < 3;
    }

    // Manual Add
    input?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const name = input.value.trim();
            if (name && !addedIngredients.has(name)) {

                // Optimistic UI
                addedIngredients.add(name);
                input.value = '';
                renderTags();

                // Background create
                try {
                    if (window.api?.createIngrediente) {
                        const newIng = await window.api.createIngrediente({
                            nombre: name,
                            precio: 0,
                            unidad: 'kg',
                            stockActual: 10 // Default mock stock
                        });
                        // Add to global cache so Step 3 can see it
                        if (window.ingredientes) window.ingredientes.unshift(newIng);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }
    });

    // Remove Tag
    tagsContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove')) {
            const name = e.target.dataset.name;
            addedIngredients.delete(name);
            renderTags();
        }
    });

    // Load Demo
    loadDemoBtn?.addEventListener('click', async () => {
        loadDemoBtn.innerHTML = '<span class="wizard-spinner"></span> Cargando...';

        // Simular carga o llamar API bulk
        const demoData = DEMO_INGREDIENTS; // From top of file

        for (const ing of demoData) {
            addedIngredients.add(ing.nombre);
            // Verify if exists to avoid dupes in real DB
            const exists = (window.ingredientes || []).some(i => i.nombre === ing.nombre);
            if (!exists && window.api?.createIngrediente) {
                try {
                    const newIng = await window.api.createIngrediente({
                        nombre: ing.nombre,
                        precio: ing.precio,
                        unidad: ing.unidad,
                        stockActual: 10
                    });
                    if (window.ingredientes) window.ingredientes.push(newIng);
                } catch (e) { }
            }
        }

        renderTags();
        loadDemoBtn.innerHTML = '<span class="wizard-feature-icon">✅</span> <span class="wizard-feature-title">¡Despensa Cargada!</span>';
        loadDemoBtn.style.background = 'rgba(16, 185, 129, 0.1)';
        loadDemoBtn.style.borderColor = '#10B981';

        setTimeout(() => {
            wizardState.currentStep = 3;
            renderStep(3);
        }, 800);
    });

    nextBtn?.addEventListener('click', () => {
        if (addedIngredients.size >= 3) {
            wizardState.currentStep = 3;
            renderStep(3);
        }
    });

    backBtn?.addEventListener('click', () => {
        wizardState.currentStep = 1;
        renderStep(1);
    });

    renderTags();
}

function renderConfiguration() {
    const r = wizardState.config || { fixedCosts: 1500, targetMargin: 30 };
    return `
        <div class="wizard-step active">
            <div class="wizard-step-icon">⚙️</div>
            <h2>Calibra tu <span class="highlight">Restaurante</span></h2>
            <p class="wizard-subtitle">Para que CostOS calcule tus beneficios reales, necesitamos dos datos clave.</p>

            <div class="wizard-config-form">
                
                <!-- Fixed Costs Slider -->
                <div class="wizard-slider-group">
                    <div class="wizard-slider-header">
                        <label>Costes Fijos Mensuales</label>
                        <span class="wizard-slider-value" id="wiz-costs-val">${r.fixedCosts}€</span>
                    </div>
                    <div class="wizard-slider-container">
                        <input type="range" id="wiz-costs-slider" min="0" max="10000" step="100" value="${r.fixedCosts}">
                        <div class="wizard-slider-track"></div>
                    </div>
                    <p class="wizard-slider-help">Alquiler, luz, agua, internet, salarios fijos...</p>
                </div>

                <!-- Target Margin Slider -->
                <div class="wizard-slider-group">
                    <div class="wizard-slider-header">
                        <label>Margen de Beneficio Objetivo</label>
                        <span class="wizard-slider-value highlight" id="wiz-margin-val">${r.targetMargin}%</span>
                    </div>
                    <div class="wizard-slider-container">
                        <input type="range" id="wiz-margin-slider" min="5" max="90" step="1" value="${r.targetMargin}">
                        <div class="wizard-slider-track"></div>
                    </div>
                    <p class="wizard-slider-help">El porcentaje de beneficio limpio que aspiras ganar por plato.</p>
                </div>

            </div>

            <div class="wizard-actions">
                <button class="wizard-btn wizard-btn-primary" id="wizard-save-config">
                    Guardar y Continuar →
                </button>
            </div>
            <button class="wizard-skip" id="wizard-skip-config" style="margin-top:10px;font-size:12px;">Saltar calibración (usar valores por defecto)</button>
        </div>
    `;
}

function bindConfigurationEvents() {
    const costsSlider = document.getElementById('wiz-costs-slider');
    const costsVal = document.getElementById('wiz-costs-val');
    const marginSlider = document.getElementById('wiz-margin-slider');
    const marginVal = document.getElementById('wiz-margin-val');
    const nextBtn = document.getElementById('wizard-save-config');
    const skipBtn = document.getElementById('wizard-skip-config');

    function updateDisplays() {
        if (costsSlider && costsVal) costsVal.textContent = `${costsSlider.value}€`;
        if (marginSlider && marginVal) marginVal.textContent = `${marginSlider.value}%`;

        // Save to state
        wizardState.config = {
            fixedCosts: parseInt(costsSlider?.value || 1500),
            targetMargin: parseInt(marginSlider?.value || 30)
        };
    }

    costsSlider?.addEventListener('input', updateDisplays);
    marginSlider?.addEventListener('input', updateDisplays);

    nextBtn?.addEventListener('click', async () => {
        nextBtn.innerHTML = '<span class="wizard-spinner"></span> Guardando...';
        nextBtn.disabled = true;

        try {
            // Simulate API call or real call if backend ready
            if (window.api?.saveConfig) {
                await window.api.saveConfig(wizardState.config);
            }
            // Artificial delay for UX
            setTimeout(() => {
                wizardState.currentStep = 2; // Move to Pantry
                renderStep(2);
            }, 600);
        } catch (e) {
            console.error(e);
            wizardState.currentStep = 2; // Fallback
            renderStep(2);
        }
    });

    skipBtn?.addEventListener('click', () => {
        wizardState.currentStep = 2;
        renderStep(2);
    });
}

