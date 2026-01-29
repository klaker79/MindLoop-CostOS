/**
 * Componente: AlertPanel
 * Panel completo para gestionar alertas
 */

import { formatDate } from '../../utils/helpers.js';

const ALERT_TYPES = {
    low_margin: { label: 'Margen Bajo', icon: '📉' },
    high_food_cost: { label: 'Food Cost Alto', icon: '💰' },
    low_stock: { label: 'Stock Bajo', icon: '📦' },
    price_increase: { label: 'Subida Precio', icon: '📈' },
    cost_deviation: { label: 'Desviación Coste', icon: '⚠️' }
};

const SEVERITY_COLORS = {
    critical: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' }
};

/**
 * Renderiza el panel de alertas
 */
export function renderAlertPanel(alerts, container, options = {}) {
    if (!container) return;

    const { onAcknowledge, onResolve, onNavigate } = options;

    const html = `
        <div class="alert-panel">
            <div class="alert-panel__header">
                <h2>🔔 Centro de Alertas</h2>
                <div class="alert-panel__filters">
                    <select id="alert-filter-type" class="filter-select">
                        <option value="">Todos los tipos</option>
                        ${Object.entries(ALERT_TYPES).map(([key, val]) =>
        `<option value="${key}">${val.icon} ${val.label}</option>`
    ).join('')}
                    </select>
                    <select id="alert-filter-status" class="filter-select">
                        <option value="active">Activas</option>
                        <option value="acknowledged">Vistas</option>
                        <option value="resolved">Resueltas</option>
                        <option value="">Todas</option>
                    </select>
                </div>
            </div>

            <div class="alert-panel__stats">
                <span class="stat stat--critical">
                    🔴 ${alerts.filter(a => a.severity === 'critical' && a.status === 'active').length} críticas
                </span>
                <span class="stat stat--warning">
                    🟡 ${alerts.filter(a => a.severity === 'warning' && a.status === 'active').length} advertencias
                </span>
            </div>

            <div class="alert-panel__list" id="alert-list">
                ${alerts.length === 0
            ? '<div class="alert-panel__empty">✅ No hay alertas activas</div>'
            : alerts.map(alert => renderAlertItem(alert)).join('')
        }
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Bind eventos
    bindAlertEvents(container, { onAcknowledge, onResolve, onNavigate });
    bindFilterEvents(container);
}

function renderAlertItem(alert) {
    const typeInfo = ALERT_TYPES[alert.type] || { label: alert.type, icon: '❓' };
    const colors = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
    const isActive = alert.status === 'active';

    return `
        <div class="alert-item alert-item--${alert.severity} ${!isActive ? 'alert-item--resolved' : ''}"
             data-alert-id="${alert.id}"
             style="background: ${colors.bg}; border-left: 4px solid ${colors.border};">

            <div class="alert-item__icon">${typeInfo.icon}</div>

            <div class="alert-item__content">
                <div class="alert-item__title">${alert.title}</div>
                <div class="alert-item__message">${alert.message || ''}</div>
                <div class="alert-item__meta">
                    <span class="alert-item__type">${typeInfo.label}</span>
                    <span class="alert-item__date">${formatDate ? formatDate(alert.created_at || alert.createdAt) : ''}</span>
                    ${alert.entity_type || alert.entityType ? `
                        <button class="btn-link" data-action="navigate"
                                data-entity-type="${alert.entity_type || alert.entityType}"
                                data-entity-id="${alert.entity_id || alert.entityId}">
                            Ver ${(alert.entity_type || alert.entityType) === 'recipe' ? 'receta' : 'ingrediente'} →
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="alert-item__actions">
                ${isActive ? `
                    <button class="btn-small btn-secondary" data-action="acknowledge" data-alert-id="${alert.id}">
                        👁️ Vista
                    </button>
                    <button class="btn-small btn-primary" data-action="resolve" data-alert-id="${alert.id}">
                        ✅ Resolver
                    </button>
                ` : `
                    <span class="alert-item__status">${alert.status === 'resolved' ? '✅ Resuelta' : '👁️ Vista'}</span>
                `}
            </div>
        </div>
    `;
}

function bindAlertEvents(container, callbacks) {
    container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = btn.dataset.action;
            const alertId = btn.dataset.alertId;

            if (action === 'acknowledge' && callbacks.onAcknowledge) {
                btn.disabled = true;
                btn.textContent = '...';
                await callbacks.onAcknowledge(alertId);
            } else if (action === 'resolve' && callbacks.onResolve) {
                btn.disabled = true;
                btn.textContent = '...';
                await callbacks.onResolve(alertId);
            } else if (action === 'navigate' && callbacks.onNavigate) {
                callbacks.onNavigate(btn.dataset.entityType, btn.dataset.entityId);
            }
        });
    });
}

function bindFilterEvents(container) {
    const typeFilter = container.querySelector('#alert-filter-type');
    const statusFilter = container.querySelector('#alert-filter-status');

    const applyFilters = () => {
        const type = typeFilter?.value || '';
        const status = statusFilter?.value || '';

        // Disparar evento personalizado para recargar
        container.dispatchEvent(new CustomEvent('alert-filter-change', {
            detail: { type, status }
        }));
    };

    typeFilter?.addEventListener('change', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
}

/**
 * Carga y renderiza el panel de alertas
 */
export async function loadAlertPanel(container) {
    if (!container || !window.API) return;

    container.innerHTML = '<div class="loading">Cargando alertas...</div>';

    try {
        const response = await window.API.getActiveAlerts();
        const alerts = response?.data || [];

        renderAlertPanel(alerts, container, {
            onAcknowledge: async (alertId) => {
                await window.API.acknowledgeAlert(alertId);
                loadAlertPanel(container); // Recargar
                if (window.updateAlertBadge) window.updateAlertBadge();
            },
            onResolve: async (alertId) => {
                await window.API.resolveAlert(alertId);
                loadAlertPanel(container); // Recargar
                if (window.updateAlertBadge) window.updateAlertBadge();
            },
            onNavigate: (entityType, entityId) => {
                // Cerrar modal
                if (window.closeAlertModal) window.closeAlertModal();
                // Navegar a la entidad
                if (entityType === 'recipe') {
                    if (window.cambiarTab) window.cambiarTab('recetas');
                } else if (entityType === 'ingredient') {
                    if (window.cambiarTab) window.cambiarTab('ingredientes');
                }
            }
        });

        // Escuchar cambios de filtro
        container.addEventListener('alert-filter-change', async (e) => {
            const { type, status } = e.detail;
            container.innerHTML = '<div class="loading">Filtrando...</div>';

            try {
                // Usar endpoint de historial con filtros
                const params = new URLSearchParams();
                if (type) params.set('type', type);
                if (status) params.set('status', status);

                const response = await window.API.fetch(`/api/v2/alerts/history?${params.toString()}`);
                const filtered = response?.data || [];

                renderAlertPanel(filtered, container, {
                    onAcknowledge: async (alertId) => {
                        await window.API.acknowledgeAlert(alertId);
                        loadAlertPanel(container);
                        if (window.updateAlertBadge) window.updateAlertBadge();
                    },
                    onResolve: async (alertId) => {
                        await window.API.resolveAlert(alertId);
                        loadAlertPanel(container);
                        if (window.updateAlertBadge) window.updateAlertBadge();
                    },
                    onNavigate: (entityType, entityId) => {
                        if (window.closeAlertModal) window.closeAlertModal();
                        if (entityType === 'recipe') {
                            if (window.cambiarTab) window.cambiarTab('recetas');
                        } else if (entityType === 'ingredient') {
                            if (window.cambiarTab) window.cambiarTab('ingredientes');
                        }
                    }
                });
            } catch (error) {
                console.error('Error filtering alerts:', error);
                container.innerHTML = '<div class="error">Error filtrando alertas</div>';
            }
        });

    } catch (error) {
        console.error('Error loading alert panel:', error);
        container.innerHTML = '<div class="error">Error cargando alertas</div>';
    }
}

export default { renderAlertPanel, loadAlertPanel };
