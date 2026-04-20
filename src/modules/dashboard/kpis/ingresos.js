/**
 * KPI — Ingresos por período + card Actividad + plato estrella.
 *
 * Usa ventas del saleStore (hace fetch solo si está vacío). Filtra por período,
 * suma ingresos, cuenta ventas y calcula plato estrella (solo alimentos, excluye
 * pan). Actualiza:
 *   - #kpi-ingresos, #ventas-hoy, #ingresos-hoy, #plato-estrella-hoy
 *   - #actividad-titulo/#actividad-subtitulo (según período)
 *   - #kpi-ingresos-trend (solo para periodo='semana', vs semana anterior)
 *
 * IMPORTANTE: NO sobrescribe window.ventas. Fetch fresh data se hace SOLO desde
 * cargarDatos() al arrancar.
 */

import { filtrarPorPeriodo, compararConSemanaAnterior, cm } from '../../../utils/helpers.js';
import { saleStore } from '../../../stores/saleStore.js';
import { t, getCurrentLanguage } from '@/i18n/index.js';

export async function actualizarKPIsPorPeriodo(periodo) {
    try {
        let ventas = saleStore.getState().sales;

        if (!ventas || ventas.length === 0) {
            await saleStore.getState().fetchSales();
            ventas = saleStore.getState().sales;
            // eslint-disable-next-line no-console
            console.log('📊 Dashboard: Cargando ventas iniciales via store');
        }

        let ventasFiltradas = ventas;
        if (typeof filtrarPorPeriodo === 'function') {
            ventasFiltradas = filtrarPorPeriodo(ventas, 'fecha', periodo);
        }

        const totalIngresos = ventasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

        const kpiIngresos = document.getElementById('kpi-ingresos');
        if (kpiIngresos) {
            kpiIngresos.textContent = cm(totalIngresos, 0);
        }

        const ventasHoyEl = document.getElementById('ventas-hoy');
        if (ventasHoyEl) {
            ventasHoyEl.textContent = ventasFiltradas.length;
        }

        const ingresosHoyEl = document.getElementById('ingresos-hoy');
        if (ingresosHoyEl) {
            ingresosHoyEl.textContent = cm(totalIngresos, 0);
        }

        const platoEstrellaEl = document.getElementById('plato-estrella-hoy');
        if (platoEstrellaEl) {
            const platosCount = {};
            const recetasMap = new Map((window.recetas || []).map(r => [r.id, r]));
            ventasFiltradas.forEach(v => {
                const nombre = v.receta_nombre || v.nombre || t('dashboard:unknown_recipe');
                const recetaId = parseInt(v.receta_id || v.recetaId);
                const receta = recetasMap.get(recetaId);
                const cat = (receta?.categoria || '').toLowerCase();
                if (cat && cat !== 'alimentos') return;
                if (nombre.toLowerCase().startsWith('pan')) return;
                platosCount[nombre] = (platosCount[nombre] || 0) + (parseInt(v.cantidad) || 1);
            });
            const platoEstrella = Object.entries(platosCount).sort((a, b) => b[1] - a[1])[0];
            platoEstrellaEl.textContent = platoEstrella
                ? platoEstrella[0].substring(0, 10)
                : t('dashboard:no_sales');
        }

        const tituloEl = document.getElementById('actividad-titulo');
        const subtituloEl = document.getElementById('actividad-subtitulo');
        if (tituloEl && subtituloEl) {
            const titulos = {
                'hoy': { titulo: t('dashboard:period_today'), subtitulo: t('dashboard:period_today_subtitle') },
                'semana': { titulo: t('dashboard:period_week'), subtitulo: t('dashboard:period_week_subtitle') },
                'mes': {
                    titulo: new Date().toLocaleString(getCurrentLanguage() === 'en' ? 'en-US' : 'es-ES', { month: 'long' }).replace(/^./, c => c.toUpperCase()),
                    subtitulo: t('dashboard:period_month_subtitle')
                }
            };
            const config = titulos[periodo] || titulos['hoy'];
            tituloEl.textContent = config.titulo;
            subtituloEl.textContent = config.subtitulo;
        }

        if (periodo === 'semana' && typeof compararConSemanaAnterior === 'function') {
            const comparativa = compararConSemanaAnterior(ventas, 'fecha', 'total');
            const trendEl = document.getElementById('kpi-ingresos-trend');
            if (trendEl) {
                const signo = comparativa.tendencia === 'up' ? '+' : '';
                trendEl.textContent = `${signo}${comparativa.porcentaje}% vs anterior`;
                const parentEl = trendEl.parentElement;
                if (parentEl) {
                    parentEl.className = `kpi-trend ${comparativa.tendencia === 'up' ? 'positive' : 'negative'}`;
                }
            }
        }
    } catch (error) {
        console.error('Error actualizando KPIs por período:', error);
    }
}
