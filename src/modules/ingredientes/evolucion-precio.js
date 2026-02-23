/**
 * Price Evolution Module
 * Shows price history chart for ingredients based on order data
 * 
 * @module modules/ingredientes/evolucion-precio
 */

import { escapeHTML } from '../../utils/helpers.js';
import { loadChart } from '../../utils/lazy-vendors.js';

let chartEvolucionPrecio = null;
let currentHistorial = [];
let currentIngrediente = null;
let itemsVisibles = 10; // Mostrar solo últimos 10 por defecto

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

    currentIngrediente = ingrediente;
    itemsVisibles = 10; // Reset al abrir

    // Get price history from orders
    currentHistorial = obtenerHistorialPrecios(ingredienteId);

    // Update modal content
    // 💰 FIX: Calcular precio UNITARIO (precio formato / cantidad_por_formato)
    const cpf = parseFloat(ingrediente.cantidad_por_formato) || 1;
    const precioActual = (parseFloat(ingrediente.precio) || 0) / cpf;

    document.getElementById('evolucion-ingrediente-nombre').innerHTML =
        `<strong>${escapeHTML(ingrediente.nombre)}</strong> - Precio actual: ${precioActual.toFixed(2)}€/${escapeHTML(ingrediente.unidad)}`;

    // Calculate summary stats (incluyendo precio actual)
    let precioMin = precioActual;
    let precioMax = precioActual;
    let precioPromedio = precioActual;

    if (currentHistorial.length > 0) {
        const precios = [...currentHistorial.map(h => h.precio), precioActual];
        precioMin = Math.min(...precios);
        precioMax = Math.max(...precios);
        precioPromedio = precios.reduce((a, b) => a + b, 0) / precios.length;
    }

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

    // Render table with pagination
    renderTablaHistorial();

    // Render chart
    await renderChart(currentHistorial, ingrediente);

    // Show modal
    document.getElementById('modal-evolucion-precio').classList.add('active');
}

/**
 * Renders the table with pagination (last N items)
 */
function renderTablaHistorial() {
    const contenedor = document.getElementById('evolucion-tabla');
    if (!contenedor) return;

    if (currentHistorial.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #94a3b8;">
                <div style="font-size: 32px; margin-bottom: 10px;">📦</div>
                <div>No hay historial de compras para este ingrediente.</div>
                <div style="font-size: 12px; margin-top: 5px;">El precio se actualizará automáticamente al recibir pedidos.</div>
            </div>
        `;
        return;
    }

    // Mostrar solo los últimos N items (más recientes primero)
    const historialOrdenado = [...currentHistorial].reverse(); // Más recientes primero
    const itemsMostrar = historialOrdenado.slice(0, itemsVisibles);
    const hayMas = currentHistorial.length > itemsVisibles;

    let tableHtml = `<table style="width: 100%; font-size: 13px;">
        <thead><tr>
            <th style="padding: 8px; text-align: left;">Fecha</th>
            <th style="padding: 8px; text-align: left;">Proveedor</th>
            <th style="padding: 8px; text-align: right;">Cantidad</th>
            <th style="padding: 8px; text-align: right;">Precio/ud</th>
            <th style="padding: 8px; text-align: right;">Variación</th>
        </tr></thead><tbody>`;

    itemsMostrar.forEach((h, i) => {
        // Calcular variación respecto al anterior (en orden cronológico)
        const idxOriginal = currentHistorial.length - 1 - i;
        const variacionItem = idxOriginal > 0
            ? ((h.precio - currentHistorial[idxOriginal - 1].precio) / currentHistorial[idxOriginal - 1].precio * 100)
            : 0;
        const varColor = variacionItem > 0 ? '#ef4444' : variacionItem < 0 ? '#10b981' : '#64748b';
        const varIcon = variacionItem > 0 ? '↑' : variacionItem < 0 ? '↓' : '—';

        tableHtml += `<tr>
            <td style="padding: 8px;">${formatDate(h.fecha)}</td>
            <td style="padding: 8px;">${escapeHTML(h.proveedor)}</td>
            <td style="padding: 8px; text-align: right;">${h.cantidad.toFixed(2)}</td>
            <td style="padding: 8px; text-align: right; font-weight: 600;">${h.precio.toFixed(2)}€</td>
            <td style="padding: 8px; text-align: right; color: ${varColor};">${varIcon} ${Math.abs(variacionItem).toFixed(1)}%</td>
        </tr>`;
    });

    tableHtml += '</tbody></table>';

    // Añadir botón "Ver más" si hay más items
    if (hayMas) {
        const restantes = currentHistorial.length - itemsVisibles;
        tableHtml += `
            <div style="text-align: center; margin-top: 10px;">
                <button onclick="window.verMasHistorial()" style="padding: 8px 20px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 13px; color: #64748b;">
                    Ver ${Math.min(restantes, 10)} más de ${restantes} restantes
                </button>
            </div>
        `;
    }

    contenedor.innerHTML = tableHtml;
}

/**
 * Shows more items in the table
 */
export function verMasHistorial() {
    itemsVisibles += 10;
    renderTablaHistorial();
}

// Expose to window for onclick
window.verMasHistorial = verMasHistorial;

/**
 * Gets price history from orders for an ingredient
 */
function obtenerHistorialPrecios(ingredienteId) {
    const pedidos = window.pedidos || [];
    const historial = [];

    // Get received orders sorted by date
    const pedidosRecibidos = pedidos
        .filter(p => p.estado === 'recibido' && (p.ingredientes || p.items))
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Build Map de proveedores
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));

    pedidosRecibidos.forEach(pedido => {
        const items = Array.isArray(pedido.ingredientes)
            ? pedido.ingredientes
            : (Array.isArray(pedido.items) ? pedido.items : []);

        const item = items.find(i =>
            i.ingrediente_id === ingredienteId ||
            i.ingredienteId === ingredienteId ||
            parseInt(i.ingrediente_id) === ingredienteId ||
            parseInt(i.ingredienteId) === ingredienteId
        );

        if (item) {
            const cantidad = parseFloat(item.cantidadRecibida || item.cantidad) || 0;

            // precioReal ya es unitario - NO dividir
            let precioUnitario;
            if (item.precioReal !== undefined) {
                precioUnitario = parseFloat(item.precioReal) || 0;
            } else if (item.precioUnitario !== undefined) {
                precioUnitario = parseFloat(item.precioUnitario) || 0;
            } else if (item.precio_unitario !== undefined) {
                precioUnitario = parseFloat(item.precio_unitario) || 0;
            } else if (item.total !== undefined && cantidad > 0) {
                precioUnitario = parseFloat(item.total) / cantidad;
            } else {
                precioUnitario = parseFloat(item.precio) || 0;
            }

            if (precioUnitario > 0) {
                const proveedor = provMap.get(pedido.proveedorId) || provMap.get(pedido.proveedor_id);
                historial.push({
                    fecha: pedido.fecha || pedido.fecha_recepcion,
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
async function renderChart(historial, ingrediente) {
    const ctx = document.getElementById('chart-evolucion-precio');
    if (!ctx) return;

    // Destroy previous chart
    if (chartEvolucionPrecio) {
        chartEvolucionPrecio.destroy();
    }

    await loadChart();
    const Chart = window.Chart;
    if (!Chart) {
        console.warn('Chart.js not loaded');
        return;
    }

    // Prepare data
    let labels, data;

    // 💰 FIX: Usar precio UNITARIO (precio formato / cantidad_por_formato)
    const cpf = parseFloat(ingrediente.cantidad_por_formato) || 1;
    const precioUnitarioActual = (parseFloat(ingrediente.precio) || 0) / cpf;

    if (historial.length === 0) {
        labels = ['Actual'];
        data = [precioUnitarioActual];
    } else {
        labels = historial.map(h => formatDate(h.fecha));
        data = historial.map(h => h.precio);
        // Add current unit price at the end if different from last
        const lastPrice = data[data.length - 1];
        if (Math.abs(lastPrice - precioUnitarioActual) > 0.01) {
            labels.push('Actual');
            data.push(precioUnitarioActual);
        }
    }

    // Premium gradient fill
    const canvasEl = ctx.canvas || ctx;
    const chartCtx2d = canvasEl.getContext ? canvasEl.getContext('2d') : ctx;
    const blueGradient = chartCtx2d.createLinearGradient(0, 0, 0, canvasEl.height || 200);
    blueGradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    blueGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
    blueGradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    chartEvolucionPrecio = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Precio (€/${ingrediente.unidad})`,
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: blueGradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2.5,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointHoverBorderWidth: 3,
                pointHoverBackgroundColor: '#2563EB',
                pointHoverBorderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#E2E8F0',
                    borderColor: 'rgba(59, 130, 246, 0.4)',
                    borderWidth: 1,
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 14, weight: '600' },
                    padding: 14,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `💰 ${ctx.parsed.y.toFixed(2)}€ / ${ingrediente.unidad}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(148, 163, 184, 0.08)',
                        drawBorder: false
                    },
                    border: { display: false },
                    ticks: {
                        callback: (value) => value.toFixed(2) + '€',
                        color: '#94A3B8',
                        font: { size: 11, weight: '500' },
                        padding: 6
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: '#94A3B8',
                        font: { size: 11, weight: '500' },
                        padding: 4
                    }
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
