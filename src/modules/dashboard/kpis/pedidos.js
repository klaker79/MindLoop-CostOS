/**
 * KPI — Pedidos del periodo + badge de pendientes.
 *
 * Lee `window.pedidos`, filtra por periodo seleccionado, cuenta.
 * El subtítulo muestra los pedidos con estado 'pendiente' si los hay.
 */

import { filtrarPorPeriodo } from '../../../utils/helpers.js';
import { animateCounter } from '../../ui/visual-effects.js';
import { t } from '@/i18n/index.js';

export function renderKpiPedidos(periodo) {
    const pedidos = window.pedidos || [];
    const pedidosDelPeriodo = typeof filtrarPorPeriodo === 'function'
        ? filtrarPorPeriodo(pedidos, 'fecha', periodo)
        : pedidos;
    const totalPedidosPeriodo = pedidosDelPeriodo.length;
    const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente').length;

    const pedidosEl = document.getElementById('kpi-pedidos');
    if (pedidosEl) {
        pedidosEl.textContent = totalPedidosPeriodo;
        if (totalPedidosPeriodo > 0) animateCounter(pedidosEl, totalPedidosPeriodo, '', 800);
    }

    const pendientesEl = document.getElementById('kpi-pedidos-pendientes');
    if (pendientesEl) {
        if (pedidosPendientes > 0) {
            pendientesEl.textContent = `⚠️ ${pedidosPendientes} ${t('dashboard:kpi_orders_pending') || 'pendientes'}`;
            pendientesEl.style.display = 'block';
        } else {
            pendientesEl.style.display = 'none';
        }
    }
}
