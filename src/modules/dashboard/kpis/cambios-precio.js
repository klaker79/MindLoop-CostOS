/**
 * KPI — Cambios de Precio (sidebar del dashboard).
 *
 * Para cada ingrediente, compara el precio del último pedido recibido con
 * el anterior. Ordena las bajadas primero y muestra el top 10.
 *
 * Actualiza #lista-cambios-precio.
 */

import { escapeHTML, cm } from '../../../utils/helpers.js';
import { ingredientStore } from '../../../stores/ingredientStore.js';
import { t } from '@/i18n/index.js';

export function renderKpiCambiosPrecio() {
    const listaCambiosEl = document.getElementById('lista-cambios-precio');
    if (!listaCambiosEl) return;

    try {
        const pedidos = window.pedidos || [];
        const pedidosRecibidos = pedidos
            .filter(p => p.estado === 'recibido' && p.ingredientes?.length > 0)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        if (pedidosRecibidos.length === 0) {
            listaCambiosEl.innerHTML = `
                <div style="color: #64748B; text-align: center; padding: 20px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
                    ${t('dashboard:no_price_changes_hint')}
                </div>
            `;
            return;
        }

        // Agrupar precios por ingrediente de los últimos 30 pedidos recibidos
        const preciosPorIngrediente = {};
        pedidosRecibidos.slice(0, 30).forEach(pedido => {
            (pedido.ingredientes || []).forEach(item => {
                const ingId = item.ingredienteId || item.ingrediente_id;
                const precio = parseFloat(item.precioReal || item.precio_unitario || item.precio || 0);
                const fecha = pedido.fecha;
                if (!preciosPorIngrediente[ingId]) preciosPorIngrediente[ingId] = [];
                preciosPorIngrediente[ingId].push({ precio, fecha });
            });
        });

        // Calcular cambios: último precio vs anterior, solo si difieren >0,01
        const cambios = [];
        const ingredientes = ingredientStore.getState().ingredients;
        const ingMap = new Map(ingredientes.map(i => [i.id, i]));

        Object.entries(preciosPorIngrediente).forEach(([ingId, precios]) => {
            if (precios.length < 2) return;
            const ultimoPrecio = precios[0].precio;
            const anteriorPrecio = precios[1].precio;
            const ing = ingMap.get(parseInt(ingId));
            if (ing && anteriorPrecio > 0 && Math.abs(ultimoPrecio - anteriorPrecio) > 0.01) {
                const cambio = ((ultimoPrecio - anteriorPrecio) / anteriorPrecio) * 100;
                cambios.push({
                    nombre: ing.nombre,
                    ultimoPrecio, anteriorPrecio, cambio,
                    unidad: ing.unidad
                });
            }
        });

        cambios.sort((a, b) => a.cambio - b.cambio);

        if (cambios.length === 0) {
            listaCambiosEl.innerHTML = `
                <div style="color: #64748B; text-align: center; padding: 20px 0;">
                    <div style="font-size: 24px; margin-bottom: 8px;">✅</div>
                    ${t('dashboard:no_price_changes')}
                </div>
            `;
            return;
        }

        listaCambiosEl.innerHTML = cambios.slice(0, 10).map(c => {
            const esBajada = c.cambio < 0;
            const color = esBajada ? '#10B981' : '#EF4444';
            const flecha = esBajada ? '↓' : '↑';
            const bg = esBajada ? '#F0FDF4' : '#FEF2F2';
            return `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${bg}; border-radius: 8px; margin-bottom: 8px;">
                    <span style="font-size: 18px; color: ${color};">${flecha}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(c.nombre)}</div>
                        <div style="font-size: 11px; color: #64748B;">
                            ${cm(c.anteriorPrecio)} → ${cm(c.ultimoPrecio)}/${escapeHTML(c.unidad)}
                        </div>
                    </div>
                    <div style="font-weight: 700; color: ${color}; font-size: 12px; white-space: nowrap;">
                        ${c.cambio > 0 ? '+' : ''}${c.cambio.toFixed(1)}%
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Error calculando cambios de precio:', e);
    }
}
