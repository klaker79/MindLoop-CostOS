/**
 * Dashboard Module
 * Actualización de KPIs del dashboard
 */

/**
 * Actualiza todos los KPIs del dashboard
 */
export async function actualizarKPIs() {
    try {
        // 1. INGRESOS TOTALES
        const ventas = await window.api.getSales();
        const ingresos = ventas.reduce((sum, v) => sum + parseFloat(v.total), 0);
        const ingresosEl = document.getElementById('kpi-ingresos');
        if (ingresosEl) ingresosEl.textContent = ingresos.toFixed(0) + '€';

        // 2. PEDIDOS ACTIVOS
        const pedidosActivos = window.pedidos.filter(p => p.estado === 'pendiente').length;
        const pedidosEl = document.getElementById('kpi-pedidos');
        if (pedidosEl) pedidosEl.textContent = pedidosActivos;

        // 3. STOCK BAJO
        const stockBajo = window.ingredientes.filter(ing => {
            const stock = parseFloat(ing.stockActual || 0);
            const minimo = parseFloat(ing.stockMinimo || 0);
            return stock < minimo;
        }).length;
        const stockEl = document.getElementById('kpi-stock');
        if (stockEl) stockEl.textContent = stockBajo;

        // 4. MARGEN PROMEDIO
        const recetasConMargen = window.recetas.filter(r => r.precio_venta > 0);
        if (recetasConMargen.length > 0) {
            const margenTotal = recetasConMargen.reduce((sum, rec) => {
                const coste = window.calcularCosteRecetaCompleto ? window.calcularCosteRecetaCompleto(rec) : 0;
                const margen = rec.precio_venta > 0 ? ((rec.precio_venta - coste) / rec.precio_venta * 100) : 0;
                return sum + margen;
            }, 0);
            const margenPromedio = margenTotal / recetasConMargen.length;
            const margenEl = document.getElementById('kpi-margen');
            if (margenEl) margenEl.textContent = Math.round(margenPromedio) + '%';
        }

    } catch (error) {
        console.error('Error actualizando KPIs:', error);
    }
}
