/**
 * Price Evolution Module
 * Shows price history chart for ingredients based on order data
 * 
 * @module modules/ingredientes/evolucion-precio
 */

let chartEvolucionPrecio = null;

/**
 * Shows price evolution modal for an ingredient
 * @param {number} ingredienteId - ID of the ingredient
 */
export async function verEvolucionPrecio(ingredienteId) {
    const ingrediente = (window.ingredientes || []).find(i => i.id === ingredienteId);
    if (!ingrediente) {
        window.showToast?.('Ingrediente no encontrado', 'error');
        return;
    }

    // Get price history from orders
    const historial = obtenerHistorialPrecios(ingredienteId);

    // Update modal content
    document.getElementById('evolucion-ingrediente-nombre').innerHTML =
        `<strong>${ingrediente.nombre}</strong> - Precio actual: ${parseFloat(ingrediente.precio || 0).toFixed(2)}€/${ingrediente.unidad}`;

    // Calculate summary stats
    const precioActual = parseFloat(ingrediente.precio) || 0;
    let precioMin = precioActual;
    let precioMax = precioActual;
    let precioPromedio = precioActual;

    if (historial.length > 0) {
        const precios = historial.map(h => h.precio);
        precioMin = Math.min(...precios);
        precioMax = Math.max(...precios);
        precioPromedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    }

    const variacion = historial.length > 1
        ? ((historial[historial.length - 1].precio - historial[0].precio) / historial[0].precio * 100)
        : 0;

    // Render summary
    document.getElementById('evolucion-summary').innerHTML = `
        <div style="background: #ecfdf5; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #059669; text-transform: uppercase; font-weight: 600;">Precio Mínimo</div>
            <div style="font-size: 24px; font-weight: 700; color: #047857;">${precioMin.toFixed(2)}€</div>
        </div>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #0284c7; text-transform: uppercase; font-weight: 600;">Promedio</div>
            <div style="font-size: 24px; font-weight: 700; color: #0369a1;">${precioPromedio.toFixed(2)}€</div>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 10px; text-align: center;">
            <div style="font-size: 11px; color: #dc2626; text-transform: uppercase; font-weight: 600;">Precio Máximo</div>
            <div style="font-size: 24px; font-weight: 700; color: #b91c1c;">${precioMax.toFixed(2)}€</div>
        </div>
    `;

    // Render table
    if (historial.length === 0) {
        document.getElementById('evolucion-tabla').innerHTML = `
            <div style="text-align: center; padding: 30px; color: #94a3b8;">
                <div style="font-size: 32px; margin-bottom: 10px;">📦</div>
                <div>No hay historial de compras para este ingrediente.</div>
                <div style="font-size: 12px; margin-top: 5px;">El precio se actualizará automáticamente al recibir pedidos.</div>
            </div>
        `;
    } else {
        let tableHtml = `<table style="width: 100%; font-size: 13px;">
            <thead><tr>
                <th style="padding: 8px; text-align: left;">Fecha</th>
                <th style="padding: 8px; text-align: left;">Proveedor</th>
                <th style="padding: 8px; text-align: right;">Cantidad</th>
                <th style="padding: 8px; text-align: right;">Precio/ud</th>
                <th style="padding: 8px; text-align: right;">Variación</th>
            </tr></thead><tbody>`;

        historial.forEach((h, i) => {
            const variacionItem = i > 0
                ? ((h.precio - historial[i - 1].precio) / historial[i - 1].precio * 100)
                : 0;
            const varColor = variacionItem > 0 ? '#ef4444' : variacionItem < 0 ? '#10b981' : '#64748b';
            const varIcon = variacionItem > 0 ? '↑' : variacionItem < 0 ? '↓' : '—';

            tableHtml += `<tr>
                <td style="padding: 8px;">${formatDate(h.fecha)}</td>
                <td style="padding: 8px;">${h.proveedor}</td>
                <td style="padding: 8px; text-align: right;">${h.cantidad.toFixed(2)}</td>
                <td style="padding: 8px; text-align: right; font-weight: 600;">${h.precio.toFixed(2)}€</td>
                <td style="padding: 8px; text-align: right; color: ${varColor};">${varIcon} ${Math.abs(variacionItem).toFixed(1)}%</td>
            </tr>`;
        });

        tableHtml += '</tbody></table>';
        document.getElementById('evolucion-tabla').innerHTML = tableHtml;
    }

    // Render chart
    renderChart(historial, ingrediente);

    // Show modal
    document.getElementById('modal-evolucion-precio').classList.add('active');
}

/**
 * Gets price history from orders for an ingredient
 * ⚡ OPTIMIZACIÓN: Pre-build Map de proveedores
 */
function obtenerHistorialPrecios(ingredienteId) {
    const pedidos = window.pedidos || [];
    const historial = [];

    // Get received orders sorted by date
    const pedidosRecibidos = pedidos
        .filter(p => p.estado === 'recibido' && p.items)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // ⚡ OPTIMIZACIÓN: Crear Map de proveedores O(1) una vez
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));

    pedidosRecibidos.forEach(pedido => {
        const items = Array.isArray(pedido.items) ? pedido.items : [];
        const item = items.find(i => i.ingrediente_id === ingredienteId || i.ingredienteId === ingredienteId);

        if (item) {
            const cantidad = parseFloat(item.cantidadRecibida || item.cantidad) || 0;
            const precioTotal = parseFloat(item.precioReal || item.precio || item.total) || 0;
            const precioUnitario = cantidad > 0 ? precioTotal / cantidad : precioTotal;

            if (precioUnitario > 0) {
                const proveedor = provMap.get(pedido.proveedorId);
                historial.push({
                    fecha: pedido.fecha,
                    precio: precioUnitario,
                    cantidad: cantidad,
                    proveedor: proveedor?.nombre || 'Proveedor'
                });
            }
        }
    });

    return historial;
}

/**
 * Renders the Chart.js line chart
 */
function renderChart(historial, ingrediente) {
    const ctx = document.getElementById('chart-evolucion-precio');
    if (!ctx) return;

    // Destroy previous chart
    if (chartEvolucionPrecio) {
        chartEvolucionPrecio.destroy();
    }

    const Chart = window.Chart;
    if (!Chart) {
        console.warn('Chart.js not loaded');
        return;
    }

    // Prepare data
    let labels, data;

    if (historial.length === 0) {
        // Show only current price
        labels = ['Actual'];
        data = [parseFloat(ingrediente.precio) || 0];
    } else {
        labels = historial.map(h => formatDate(h.fecha));
        data = historial.map(h => h.precio);
        // Add current price at the end if different from last
        const lastPrice = data[data.length - 1];
        const currentPrice = parseFloat(ingrediente.precio) || 0;
        if (Math.abs(lastPrice - currentPrice) > 0.01) {
            labels.push('Actual');
            data.push(currentPrice);
        }
    }

    chartEvolucionPrecio = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Precio (€/${ingrediente.unidad})`,
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `Precio: ${ctx.parsed.y.toFixed(2)}€/${ingrediente.unidad}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: (value) => value.toFixed(2) + '€'
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Formats date for display
 */
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch {
        return dateStr;
    }
}
