/**
 * Componente: QuickActions
 * Panel de acciones rápidas para el dashboard
 */

const _t = window.t || ((k) => k);

/**
 * Renderiza el panel de acciones rápidas
 */
export function renderQuickActions(container, options = {}) {
    if (!container) return;

    const { onRecalculateAll, onExportReport, onCheckAlerts } = options;

    const html = `
        <div class="quick-actions">
            <h3>⚡ Acciones Rápidas</h3>
            <div class="quick-actions__grid">
                <button class="quick-action-btn" id="btn-recalculate-all" title="Recalcular costes de todas las recetas">
                    <span class="quick-action-btn__icon">🔄</span>
                    <span class="quick-action-btn__label">Recalcular Costes</span>
                </button>
                <button class="quick-action-btn" id="btn-export-report" title="Exportar informe mensual">
                    <span class="quick-action-btn__icon">📊</span>
                    <span class="quick-action-btn__label">Exportar Informe</span>
                </button>
                <button class="quick-action-btn" id="btn-check-margins" title="Ver recetas con margen bajo">
                    <span class="quick-action-btn__icon">⚠️</span>
                    <span class="quick-action-btn__label">Revisar Márgenes</span>
                </button>
                <button class="quick-action-btn" id="btn-view-alerts" title="Ver centro de alertas">
                    <span class="quick-action-btn__icon">🔔</span>
                    <span class="quick-action-btn__label">Ver Alertas</span>
                </button>
            </div>
            <div id="action-progress" class="action-progress hidden">
                <div class="action-progress__bar">
                    <div class="action-progress__fill" style="width: 0%"></div>
                </div>
                <span class="action-progress__text">Procesando...</span>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Bind eventos
    document.getElementById('btn-recalculate-all')?.addEventListener('click', () => {
        handleRecalculateAll(container);
    });

    document.getElementById('btn-export-report')?.addEventListener('click', () => {
        if (onExportReport) onExportReport();
        else showToast(_t('common:toast_exporting_report'), 'info');
    });

    document.getElementById('btn-check-margins')?.addEventListener('click', () => {
        showLowMarginRecipes();
    });

    document.getElementById('btn-view-alerts')?.addEventListener('click', () => {
        if (window.showAlertModal) window.showAlertModal();
    });
}

/**
 * Maneja el recálculo de todos los costes
 */
async function handleRecalculateAll(container) {
    const progressDiv = container.querySelector('#action-progress');
    const progressBar = container.querySelector('.action-progress__fill');
    const progressText = container.querySelector('.action-progress__text');
    const btn = container.querySelector('#btn-recalculate-all');

    if (!window.API?.recalculateAllRecipes) {
        showToast(_t('common:toast_fn_unavailable'), 'error');
        return;
    }

    // Mostrar progreso
    progressDiv?.classList.remove('hidden');
    btn.disabled = true;
    btn.querySelector('.quick-action-btn__label').textContent = _t('common:label_processing');

    try {
        progressText.textContent = _t('common:label_recalculating');
        progressBar.style.width = '30%';

        const result = await window.API.recalculateAllRecipes();

        progressBar.style.width = '100%';
        progressText.textContent = _t('common:label_completed');

        const data = result?.data || result;
        const total = data?.total || 0;
        const successful = data?.successful || 0;
        const failed = data?.failed || 0;

        // Mostrar resultado
        setTimeout(() => {
            progressDiv?.classList.add('hidden');
            btn.disabled = false;
            btn.querySelector('.quick-action-btn__label').textContent = _t('common:label_recalculate_costs');

            if (failed > 0) {
                showToast(_t('common:toast_recalc_partial', { successful, total, failed }), 'warning');
            } else {
                showToast(_t('common:toast_recalc_success', { successful }), 'success');
            }

            // Recargar dashboard para mostrar nuevos datos
            if (window.location.hash === '#dashboard' || window.location.hash === '') {
                window.dispatchEvent(new CustomEvent('dashboard:refresh'));
            }
        }, 1000);

    } catch (error) {
        console.error('Error recalculando costes:', error);
        progressDiv?.classList.add('hidden');
        btn.disabled = false;
        btn.querySelector('.quick-action-btn__label').textContent = _t('common:label_recalculate_costs');
        showToast(_t('common:toast_error_recalc', { message: error.message }), 'error');
    }
}

/**
 * Muestra recetas con margen bajo
 */
async function showLowMarginRecipes() {
    if (!window.API?.getTopRecipes) {
        showToast(_t('common:toast_fn_unavailable'), 'error');
        return;
    }

    try {
        // Obtener todas las recetas y filtrar las de margen bajo
        const recipes = await window.API.getRecipes();
        const lowMargin = (recipes || []).filter(r =>
            r.margen_porcentaje !== null && r.margen_porcentaje < 60
        ).sort((a, b) => (a.margen_porcentaje || 0) - (b.margen_porcentaje || 0));

        if (lowMargin.length === 0) {
            showToast(_t('common:toast_all_good_margin'), 'success');
            return;
        }

        // Crear modal con lista
        showLowMarginModal(lowMargin);

    } catch (error) {
        console.error('Error obteniendo recetas:', error);
        showToast(_t('common:toast_error_fetching_recipes'), 'error');
    }
}

/**
 * Muestra modal con recetas de margen bajo
 */
function showLowMarginModal(recipes) {
    let modal = document.getElementById('low-margin-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'low-margin-modal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>⚠️ Recetas con Margen Bajo</h2>
                <button class="modal-close" onclick="document.getElementById('low-margin-modal').style.display='none'">&times;</button>
            </div>
            <div class="modal-body">
                <p class="modal-subtitle">${recipes.length} recetas con margen inferior al 60%</p>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Receta</th>
                            <th>Margen</th>
                            <th>Food Cost</th>
                            <th>Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recipes.slice(0, 20).map(r => `
                            <tr class="${(r.margen_porcentaje || 0) < 50 ? 'row-critical' : 'row-warning'}">
                                <td>${r.nombre}</td>
                                <td><strong>${(r.margen_porcentaje || 0).toFixed(1)}%</strong></td>
                                <td>${(r.food_cost || 0).toFixed(1)}%</td>
                                <td>${(r.precio_venta || 0).toFixed(2)}€</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${recipes.length > 20 ? `<p class="modal-note">Mostrando 20 de ${recipes.length} recetas</p>` : ''}
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });
}

/**
 * Helper para mostrar toast
 */
function showToast(message, type = 'info') {
    if (window.API?.showToast) {
        window.API.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export default { renderQuickActions };
