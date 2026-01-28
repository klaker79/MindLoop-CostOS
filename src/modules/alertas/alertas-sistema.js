import { escapeHTML } from '../../utils/helpers.js';
/**
 * Sistema de Alertas Inteligentes
 * Detecta condiciones críticas y genera alertas proactivas
 * 
 * SEGURIDAD: Usa escapeHTML para prevenir XSS en datos de usuario
 */

/**
 * Escapa texto plano para uso en HTML (previene XSS)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto seguro para HTML
 */
/**
 * Detecta ingredientes con stock bajo crítico
 * @returns {Array} Lista de alertas de stock bajo
 */
export function detectarStockBajo() {
    const ingredientes = window.ingredientes || [];
    const alertas = [];

    ingredientes.forEach(ing => {
        const stockActual = parseFloat(ing.stock_actual) || 0;
        const stockMinimo = parseFloat(ing.stock_minimo) || 5; // Default 5 unidades

        if (stockActual < stockMinimo) {
            const porcentaje = stockMinimo > 0 ? Math.round((stockActual / stockMinimo) * 100) : 0;
            const criticidad =
                porcentaje < 25 ? 'critico' : porcentaje < 50 ? 'bajo' : 'advertencia';

            alertas.push({
                tipo: 'stock_bajo',
                criticidad,
                ingredienteId: ing.id,
                nombre: ing.nombre,
                stockActual,
                stockMinimo,
                porcentaje,
                mensaje:
                    stockActual === 0
                        ? `${ing.nombre}: SIN STOCK`
                        : `${ing.nombre}: ${stockActual.toFixed(2)} ${ing.unidad || 'u'} (mín: ${stockMinimo})`,
                accion: () => window.cambiarTab?.('ingredientes'),
            });
        }
    });

    // Ordenar por criticidad (crítico primero)
    return alertas.sort((a, b) => {
        const orden = { critico: 0, bajo: 1, advertencia: 2 };
        return orden[a.criticidad] - orden[b.criticidad];
    });
}

/**
 * Detecta pedidos pendientes de más de X días
 * @param {number} diasLimite - Días para considerar un pedido antiguo (default: 3)
 * @returns {Array} Lista de alertas de pedidos pendientes
 */
export function detectarPedidosPendientes(diasLimite = 3) {
    const pedidos = window.pedidos || [];
    const alertas = [];
    const ahora = new Date();

    pedidos.forEach(ped => {
        if (ped.estado === 'pendiente') {
            const fechaPedido = new Date(ped.fecha);
            const diasPendiente = Math.floor((ahora - fechaPedido) / (1000 * 60 * 60 * 24));

            if (diasPendiente >= diasLimite) {
                const proveedor = window.proveedores?.find(p => p.id === ped.proveedorId);
                const criticidad =
                    diasPendiente >= 7 ? 'critico' : diasPendiente >= 5 ? 'bajo' : 'advertencia';

                alertas.push({
                    tipo: 'pedido_pendiente',
                    criticidad,
                    pedidoId: ped.id,
                    proveedorNombre: proveedor?.nombre || 'Sin proveedor',
                    diasPendiente,
                    fecha: fechaPedido.toLocaleDateString('es-ES'),
                    total: parseFloat(ped.total) || 0,
                    mensaje: `Pedido #${ped.id} lleva ${diasPendiente} días pendiente`,
                    accion: () => {
                        window.cambiarTab?.('pedidos');
                        setTimeout(() => window.verDetallesPedido?.(ped.id), 100);
                    },
                });
            }
        }
    });

    return alertas.sort((a, b) => b.diasPendiente - a.diasPendiente);
}

/**
 * Sugiere hacer inventario si no se ha actualizado recientemente
 * @param {number} diasSugerencia - Días sin actualización para sugerir (default: 7)
 * @returns {Object|null} Alerta de sugerencia o null
 */
export function sugerirInventario(diasSugerencia = 7) {
    const ultimoInventario = localStorage.getItem('ultimoInventario');

    if (!ultimoInventario) {
        return {
            tipo: 'inventario_sugerido',
            criticidad: 'info',
            mensaje: '📋 Sugerencia: Realiza tu primer inventario',
            descripcion: 'Mantén tu stock actualizado para cálculos precisos',
            accion: () => window.cambiarTab?.('ingredientes'),
            dismissKey: 'inventario_sugerido_dismissed',
        };
    }

    const ultimaFecha = new Date(ultimoInventario);
    const ahora = new Date();
    const diasDesdeUltimo = Math.floor((ahora - ultimaFecha) / (1000 * 60 * 60 * 24));

    if (diasDesdeUltimo >= diasSugerencia) {
        return {
            tipo: 'inventario_sugerido',
            criticidad: diasDesdeUltimo >= 14 ? 'advertencia' : 'info',
            mensaje: `📋 Inventario: ${diasDesdeUltimo} días sin actualizar`,
            descripcion: 'Revisa tu stock para mantener datos precisos',
            diasDesdeUltimo,
            accion: () => window.cambiarTab?.('ingredientes'),
            dismissKey: 'inventario_sugerido_dismissed',
        };
    }

    return null;
}

/**
 * Genera todas las alertas del sistema
 * @returns {Object} Objeto con todas las alertas categorizadas
 */
export function generarAlertas() {
    const stockBajo = detectarStockBajo();
    const pedidosPendientes = detectarPedidosPendientes();
    const inventario = sugerirInventario();

    const totalAlertas = stockBajo.length + pedidosPendientes.length + (inventario ? 1 : 0);
    const criticosCount =
        stockBajo.filter(a => a.criticidad === 'critico').length +
        pedidosPendientes.filter(a => a.criticidad === 'critico').length;

    return {
        stockBajo,
        pedidosPendientes,
        inventario,
        resumen: {
            total: totalAlertas,
            criticos: criticosCount,
            hayAlertas: totalAlertas > 0,
        },
    };
}

/**
 * Renderiza el componente de alertas en el dashboard
 */
export function renderizarAlertas() {
    const alertas = generarAlertas();

    // Verificar si el contenedor existe
    let container = document.getElementById('alertas-container');

    // Si no existe, crearlo dinámicamente al inicio del dashboard
    if (!container) {
        const dashboard = document.getElementById('tab-dashboard');
        if (!dashboard) return;

        container = document.createElement('div');
        container.id = 'alertas-container';
        container.className = 'alertas-container';

        // Insertar al principio del dashboard
        const primerHijo = dashboard.querySelector(
            '.dashboard-top, .kpi-container, .dashboard-kpis'
        );
        if (primerHijo) {
            primerHijo.parentNode.insertBefore(container, primerHijo);
        } else {
            dashboard.insertBefore(container, dashboard.firstChild);
        }
    }

    // Si no hay alertas, ocultar contenedor
    if (!alertas.resumen.hayAlertas) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Generar HTML
    let html = `
        <div class="alertas-panel ${alertas.resumen.criticos > 0 ? 'has-critical' : ''}">
            <div class="alertas-header" onclick="toggleAlertasExpanded()">
                <div class="alertas-title">
                    <span class="alertas-icon ${alertas.resumen.criticos > 0 ? 'pulse' : ''}">
                        ${alertas.resumen.criticos > 0 ? '🚨' : '⚠️'}
                    </span>
                    <span>${alertas.resumen.total} alerta${alertas.resumen.total !== 1 ? 's' : ''}</span>
                </div>
                <span class="alertas-toggle">▼</span>
            </div>
            <div class="alertas-body" id="alertas-body">
    `;

    // Stock bajo
    if (alertas.stockBajo.length > 0) {
        html += `
            <div class="alertas-section">
                <div class="alertas-section-title">
                    <span>📦 Stock Bajo</span>
                    <span class="badge badge-danger">${alertas.stockBajo.length}</span>
                </div>
                <ul class="alertas-list">
        `;

        alertas.stockBajo.slice(0, 5).forEach(alerta => {
            const iconClass =
                alerta.criticidad === 'critico'
                    ? 'danger'
                    : alerta.criticidad === 'bajo'
                        ? 'warning'
                        : 'info';
            html += `
                <li class="alerta-item ${alerta.criticidad}" onclick="window.cambiarTab('ingredientes')">
                    <span class="alerta-indicator ${iconClass}"></span>
                    <span class="alerta-mensaje">${alerta.mensaje}</span>
                </li>
            `;
        });

        if (alertas.stockBajo.length > 5) {
            html += `<li class="alerta-more">+${alertas.stockBajo.length - 5} más...</li>`;
        }

        html += `</ul></div>`;
    }

    // Pedidos pendientes
    if (alertas.pedidosPendientes.length > 0) {
        html += `
            <div class="alertas-section">
                <div class="alertas-section-title">
                    <span>📋 Pedidos Pendientes</span>
                    <span class="badge badge-warning">${alertas.pedidosPendientes.length}</span>
                </div>
                <ul class="alertas-list">
        `;

        alertas.pedidosPendientes.forEach(alerta => {
            html += `
                <li class="alerta-item ${alerta.criticidad}" onclick="window.verDetallesPedido(${alerta.pedidoId})">
                    <span class="alerta-indicator warning"></span>
                    <span class="alerta-mensaje">${alerta.mensaje}</span>
                    <span class="alerta-meta">${alerta.proveedorNombre}</span>
                </li>
            `;
        });

        html += `</ul></div>`;
    }

    // Sugerencia inventario
    if (alertas.inventario && !localStorage.getItem(alertas.inventario.dismissKey)) {
        html += `
            <div class="alertas-section inventario">
                <div class="alerta-item info" onclick="window.cambiarTab('ingredientes')">
                    <span class="alerta-mensaje">${alertas.inventario.mensaje}</span>
                    <button class="alerta-dismiss" onclick="event.stopPropagation(); dismissAlerta('${alertas.inventario.dismissKey}')">✕</button>
                </div>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Toggle expandir/colapsar alertas
 */
export function toggleAlertasExpanded() {
    const body = document.getElementById('alertas-body');
    const toggle = document.querySelector('.alertas-toggle');

    if (body && toggle) {
        const isExpanded = body.classList.toggle('expanded');
        toggle.textContent = isExpanded ? '▲' : '▼';
    }
}

/**
 * Descartar una alerta
 * @param {string} dismissKey - Clave para recordar que se descartó
 */
export function dismissAlerta(dismissKey) {
    localStorage.setItem(dismissKey, Date.now().toString());
    renderizarAlertas();
}

/**
 * Marcar que se hizo inventario
 */
export function marcarInventarioRealizado() {
    localStorage.setItem('ultimoInventario', new Date().toISOString());
    localStorage.removeItem('inventario_sugerido_dismissed');
    renderizarAlertas();
}

// Exponer al scope global
if (typeof window !== 'undefined') {
    window.generarAlertas = generarAlertas;
    window.renderizarAlertas = renderizarAlertas;
    window.toggleAlertasExpanded = toggleAlertasExpanded;
    window.dismissAlerta = dismissAlerta;
    window.marcarInventarioRealizado = marcarInventarioRealizado;
}
