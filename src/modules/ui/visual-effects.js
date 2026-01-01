/**
 * Visual Effects Module
 * Premium animations and visual enhancements for the dashboard
 * 
 * @module modules/ui/visual-effects
 */

/**
 * Animates a number counter from 0 to target value
 * @param {HTMLElement} element - Element to animate
 * @param {number} target - Target value
 * @param {string} suffix - Suffix to add (€, %, etc)
 * @param {number} duration - Animation duration in ms
 */
export function animateCounter(element, target, suffix = '', duration = 1000) {
    if (!element) return;

    const start = 0;
    const startTime = performance.now();
    const isInteger = Number.isInteger(target) || suffix === '%';

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out-cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const current = start + (target - start) * easeOut;
        element.textContent = (isInteger ? Math.round(current) : current.toFixed(0)) + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/**
 * Renders a mini sparkline chart inside an element
 * @param {HTMLElement} container - Container to render in
 * @param {number[]} data - Array of values
 * @param {string} color - Line color
 */
export function renderSparkline(container, data, color = '#10B981') {
    if (!container || !data || data.length < 2) return;

    // Normalize data
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const width = 60;
    const height = 24;
    const padding = 2;

    // Calculate points
    const points = data.map((value, index) => {
        const x = padding + (index / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    // Determine trend
    const trend = data[data.length - 1] > data[0] ? 'up' : 'down';
    const trendColor = trend === 'up' ? '#10B981' : '#EF4444';

    // Create SVG
    container.innerHTML = `
        <svg width="${width}" height="${height}" style="display: block;">
            <defs>
                <linearGradient id="sparkGradient-${container.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${trendColor};stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:${trendColor};stop-opacity:0" />
                </linearGradient>
            </defs>
            <polygon 
                points="${padding},${height - padding} ${points} ${width - padding},${height - padding}" 
                fill="url(#sparkGradient-${container.id})"
            />
            <polyline 
                points="${points}" 
                fill="none" 
                stroke="${trendColor}" 
                stroke-width="1.5" 
                stroke-linecap="round" 
                stroke-linejoin="round"
            />
            <circle 
                cx="${width - padding}" 
                cy="${height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}" 
                r="2" 
                fill="${trendColor}"
            />
        </svg>
    `;
}

/**
 * Gets historical data for a KPI (last 7 days)
 * ⚡ OPTIMIZACIÓN: Agrupar ventas por fecha una sola vez en lugar de filtrar 7 veces
 * @param {string} type - KPI type: 'ingresos', 'ventas', etc
 * @returns {number[]} Array of values
 */
export function getHistoricalData(type) {
    const ventas = window.ventas || [];
    const today = new Date();
    const days = 7;
    const values = [];

    // ⚡ OPTIMIZACIÓN: Agrupar ventas por fecha UNA VEZ usando Map (O(n))
    // En lugar de filtrar 7 veces (7×O(n) = O(7n))
    const ventasPorFecha = new Map();
    ventas.forEach(v => {
        const ventaDate = (v.fecha || '').split('T')[0];
        if (!ventasPorFecha.has(ventaDate)) {
            ventasPorFecha.set(ventaDate, []);
        }
        ventasPorFecha.get(ventaDate).push(v);
    });

    // Ahora iterar por días con lookup O(1)
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const dayVentas = ventasPorFecha.get(dateStr) || [];

        if (type === 'ingresos') {
            const total = dayVentas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
            values.push(total);
        } else if (type === 'ventas') {
            values.push(dayVentas.length);
        }
    }

    // If all zeros, return mock data for visual appeal
    if (values.every(v => v === 0)) {
        return [10, 15, 12, 18, 14, 20, 22];
    }

    return values;
}

/**
 * Initializes all visual effects on the dashboard
 */
export function initVisualEffects() {
    // This will be called after KPIs are updated to add sparklines
    console.log('Visual effects initialized');
}

/**
 * Updates KPIs with animations and sparklines
 */
export function updateKPIsWithAnimation() {
    // Animate Ingresos
    const ingresosEl = document.getElementById('kpi-ingresos');
    if (ingresosEl) {
        const value = parseFloat(ingresosEl.textContent) || 0;
        if (value > 0) {
            animateCounter(ingresosEl, value, '€', 1200);
        }
    }

    // Animate Pedidos
    const pedidosEl = document.getElementById('kpi-pedidos');
    if (pedidosEl) {
        const value = parseInt(pedidosEl.textContent) || 0;
        if (value > 0) {
            animateCounter(pedidosEl, value, '', 800);
        }
    }

    // Animate Stock
    const stockEl = document.getElementById('kpi-stock');
    if (stockEl) {
        const value = parseInt(stockEl.textContent) || 0;
        animateCounter(stockEl, value, '', 800);
    }

    // Animate Margen
    const margenEl = document.getElementById('kpi-margen');
    if (margenEl) {
        const value = parseInt(margenEl.textContent) || 0;
        if (value > 0) {
            animateCounter(margenEl, value, '%', 1000);
        }
    }
}
