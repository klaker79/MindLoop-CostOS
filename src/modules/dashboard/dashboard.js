/**
 * Dashboard Module
 * Actualización de KPIs del dashboard con soporte de calendario
 */

import {
    getFechaHoyFormateada,
    getPeriodoActual,
    filtrarPorPeriodo,
    compararConSemanaAnterior,
} from '../../utils/helpers.js';

import {
    animateCounter,
    renderSparkline,
    getHistoricalData
} from '../ui/visual-effects.js';

import { getApiUrl } from '../../config/app-config.js';
import { t, getCurrentLanguage } from '@/i18n/index.js';

// Zustand Stores - acceso directo al estado
import { saleStore } from '../../stores/saleStore.js';
import { ingredientStore } from '../../stores/ingredientStore.js';
import { apiClient } from '../../api/client.js';

// KPI Dashboard v2 - Clean Architecture
import { loadKPIDashboard } from '../../components/domain/KPIDashboard.js';
import { renderQuickActions } from '../../components/domain/QuickActions.js';
import { renderOnboardingBanner } from '../../components/domain/OnboardingBanner.js';

// Variable para recordar el período actual (default: semana)
let periodoVistaActual = 'semana';

// 💀 Skeleton helpers
const SKELETON_SPAN = '<span class="skeleton skeleton-number" data-skeleton>⠀</span>';
const SKELETON_ROW = '<div class="skeleton skeleton-row" data-skeleton></div>';

function showSkeletonIn(el, type = 'number') {
    if (!el) return;
    if (type === 'number') {
        el.innerHTML = SKELETON_SPAN;
    } else if (type === 'rows') {
        el.innerHTML = (SKELETON_ROW + SKELETON_ROW + SKELETON_ROW);
    }
}

function isDataLoaded() {
    const ings = window.ingredientes || [];
    const recs = window.recetas || [];
    return ings.length > 0 || recs.length > 0;
}

/**
 * Inicializa el banner de fecha actual en el dashboard
 */
export function inicializarFechaActual() {
    const fechaTexto = document.getElementById('fecha-hoy-texto');
    const periodoInfo = document.getElementById('periodo-info');

    if (fechaTexto) {
        try {
            const fechaFormateada = getFechaHoyFormateada();
            // Capitalizar primera letra
            fechaTexto.textContent =
                fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
        } catch (e) {
            const fallbackLocale = getCurrentLanguage() === 'en' ? 'en-US' : 'es-ES';
            fechaTexto.textContent = new Date().toLocaleDateString(fallbackLocale, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        }
    }

    if (periodoInfo) {
        try {
            const periodo = getPeriodoActual();
            const mesCapitalizado =
                periodo.mesNombre.charAt(0).toUpperCase() + periodo.mesNombre.slice(1);
            const weekLabel = getCurrentLanguage() === 'en' ? 'Week' : 'Semana';
            periodoInfo.textContent = `${weekLabel} ${periodo.semana} · ${mesCapitalizado} ${periodo.año}`;
        } catch (e) {
            const fallbackLocale2 = getCurrentLanguage() === 'en' ? 'en-US' : 'es-ES';
            periodoInfo.textContent = new Date().toLocaleDateString(fallbackLocale2, {
                month: 'long',
                year: 'numeric',
            });
        }
    }
}

/**
 * Cambia el período de vista y actualiza los KPIs
 */
export function cambiarPeriodoVista(periodo) {
    periodoVistaActual = periodo;

    // Actualizar botones activos
    document.querySelectorAll('.periodo-btn').forEach(btn => {
        if (btn.dataset.periodo === periodo) {
            btn.style.background = '#0ea5e9';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'white';
            btn.style.color = '#0369a1';
        }
    });

    // Actualizar KPIs según período
    actualizarKPIsPorPeriodo(periodo);
    actualizarMargenReal(periodo);
}

/**
 * Actualiza KPIs filtrados por período
 * 🔧 FIX: NO sobrescribir window.ventas - usar datos existentes
 * El fetch de datos frescos debe hacerse SOLO desde cargarDatos()
 * 🔧 FIX-2: Actualiza también el card "Actividad" (ventas, ingresos, estrella)
 */
async function actualizarKPIsPorPeriodo(periodo) {
    try {
        // 🔧 FIX CRÍTICO: Usar datos existentes en lugar de hacer fetch
        let ventas = saleStore.getState().sales;

        // Solo hacer fetch si no hay datos cargados (primera vez)
        if (!ventas || ventas.length === 0) {
            await saleStore.getState().fetchSales();
            ventas = saleStore.getState().sales;
            console.log('📊 Dashboard: Cargando ventas iniciales via store');
        }

        // Filtrar por período
        let ventasFiltradas = ventas;
        if (typeof filtrarPorPeriodo === 'function') {
            ventasFiltradas = filtrarPorPeriodo(ventas, 'fecha', periodo);
        }

        const totalIngresos = ventasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

        // 1. Actualizar KPI top bar (INGRESOS)
        const kpiIngresos = document.getElementById('kpi-ingresos');
        if (kpiIngresos) {
            kpiIngresos.textContent = totalIngresos.toFixed(0) + '€';
        }

        // 2. Actualizar card "Actividad" — ventas count
        const ventasHoyEl = document.getElementById('ventas-hoy');
        if (ventasHoyEl) {
            ventasHoyEl.textContent = ventasFiltradas.length;
        }

        // 3. Actualizar card "Actividad" — ingresos
        const ingresosHoyEl = document.getElementById('ingresos-hoy');
        if (ingresosHoyEl) {
            ingresosHoyEl.textContent = totalIngresos.toFixed(0) + '€';
        }

        // 4. Actualizar card "Actividad" — plato estrella
        const platoEstrellaEl = document.getElementById('plato-estrella-hoy');
        if (platoEstrellaEl) {
            const platosCount = {};
            ventasFiltradas.forEach(v => {
                const nombre = v.receta_nombre || v.nombre || t('dashboard:unknown_recipe');
                platosCount[nombre] = (platosCount[nombre] || 0) + (parseInt(v.cantidad) || 1);
            });
            const platoEstrella = Object.entries(platosCount).sort((a, b) => b[1] - a[1])[0];
            platoEstrellaEl.textContent = platoEstrella
                ? platoEstrella[0].substring(0, 10)
                : t('dashboard:no_sales');
        }

        // 5. Actualizar título del card según período
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

        // 6. Actualizar comparativa con período anterior (solo para semana)
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

/**
 * Calcula margen REAL ponderado por ventas del período
 * Usa ventas reales × coste de ingredientes (no media teórica)
 */
async function actualizarMargenReal(periodo) {
    const margenEl = document.getElementById('kpi-margen');
    const fcBar = document.getElementById('kpi-fc-bar');
    const fcDetail = document.getElementById('kpi-fc-detail');
    if (!margenEl) return;

    try {
        // Obtener ventas del período
        let ventas = saleStore.getState().sales || [];
        if (typeof filtrarPorPeriodo === 'function') {
            ventas = filtrarPorPeriodo(ventas, 'fecha', periodo);
        }

        if (ventas.length === 0) {
            margenEl.textContent = '—';
            if (fcBar) { fcBar.style.width = '0%'; fcBar.style.background = '#E2E8F0'; }
            if (fcDetail) fcDetail.textContent = '';
            return;
        }

        // Calcular Food Cost desde recetas
        const recetas = window.recetas || [];
        const recetasMap = new Map(recetas.map(r => [r.id, r]));
        const calcularCoste =
            window.Performance?.calcularCosteRecetaMemoizado ||
            window.calcularCosteRecetaCompleto;

        let totalIngresos = 0;
        let totalCostesReceta = 0;

        for (const venta of ventas) {
            const ingreso = parseFloat(venta.total) || 0;
            const cantidad = parseInt(venta.cantidad) || 1;
            const recetaId = parseInt(venta.receta_id || venta.recetaId);
            const receta = recetasMap.get(recetaId);

            totalIngresos += ingreso;

            if (receta && typeof calcularCoste === 'function') {
                const costePorcion = calcularCoste(receta) || 0;
                const factor = parseFloat(venta.factor_variante || venta.factorVariante) || 1;
                totalCostesReceta += costePorcion * cantidad * factor;
            }
        }

        // Food Cost % = costes / ingresos × 100
        const foodCost = totalIngresos > 0
            ? (totalCostesReceta / totalIngresos) * 100
            : 0;

        // Mostrar Food Cost como número principal
        margenEl.textContent = Math.round(foodCost) + '%';
        // Color según umbrales de hostelería
        margenEl.style.color = foodCost <= 28 ? '#059669' : foodCost <= 33 ? '#0EA5E9' : foodCost <= 38 ? '#D97706' : '#DC2626';

        // Barra de progreso (máximo visual = 50%)
        if (fcBar) {
            const barWidth = Math.min(foodCost, 50) * 2; // 50% FC = 100% barra
            fcBar.style.width = barWidth + '%';
            fcBar.style.background = foodCost <= 28 ? '#059669' : foodCost <= 33 ? '#0EA5E9' : foodCost <= 38 ? '#D97706' : '#DC2626';
        }

        // Detalle: Food Cost + Margen real
        if (fcDetail) {
            const margenReal = 100 - foodCost;
            fcDetail.textContent = `Food Cost ${Math.round(foodCost)}% · ${t('dashboard:kpi_margin')} ${Math.round(margenReal)}%`;
        }
    } catch (error) {
        console.error('Error calculando food cost:', error);
        margenEl.textContent = '—';
        if (fcBar) fcBar.style.width = '0%';
        if (fcDetail) fcDetail.textContent = '';
    }
}

/**
 * Actualiza todos los KPIs del dashboard
 */
export async function actualizarKPIs() {
    // 💀 Si no hay datos aún, mostrar skeletons y salir
    if (!isDataLoaded()) {
        showSkeletonIn(document.getElementById('kpi-ingresos'));
        showSkeletonIn(document.getElementById('kpi-pedidos'));
        showSkeletonIn(document.getElementById('kpi-stock'));
        showSkeletonIn(document.getElementById('kpi-margen'));
        showSkeletonIn(document.getElementById('ventas-hoy'));
        showSkeletonIn(document.getElementById('ingresos-hoy'));
        showSkeletonIn(document.getElementById('plato-estrella-hoy'));
        showSkeletonIn(document.getElementById('alertas-stock-lista'), 'rows');
        showSkeletonIn(document.getElementById('personal-hoy-lista'), 'rows');
        showSkeletonIn(document.getElementById('lista-cambios-precio'), 'rows');
        console.log('💀 Skeleton loading: esperando datos...');
        return;
    }

    // Crear contenedor de acciones rápidas
    try {
        let actionsContainer = document.getElementById('quick-actions-container');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = 'quick-actions-container';

            const mainContent = document.querySelector('.dashboard-content') ||
                document.querySelector('#dashboard') ||
                document.querySelector('main');
            if (mainContent) {
                mainContent.insertBefore(actionsContainer, mainContent.firstChild);
            }
        }

        renderQuickActions(actionsContainer);
    } catch (e) {
        console.log('QuickActions no disponible:', e.message);
    }

    // Onboarding banner para restaurantes nuevos
    try {
        const dashboardContent = document.querySelector('.dashboard-content') ||
            document.querySelector('#dashboard') ||
            document.querySelector('.main-content') ||
            document.querySelector('main');
        if (dashboardContent) {
            renderOnboardingBanner(dashboardContent);
        }
    } catch (e) {
        console.log('Onboarding banner no disponible:', e.message);
    }

    // Inicializar banner de fecha actual
    inicializarFechaActual();

    // 🔧 DESACTIVADO: KPI Dashboard v2 - Widget duplicado, usuario pidió eliminarlo
    // Este bloque creaba un widget blanco con Ingresos/Coste/Beneficio/Margen/Food Cost/Ventas
    // que aparecía encima del Dashboard "Hoy" existente.
    // Si en el futuro se quiere reactivar, descomentar el bloque siguiente:
    /*
    try {
        let kpiContainer = document.getElementById('kpi-dashboard-container');
        if (!kpiContainer) {
            kpiContainer = document.createElement('div');
            kpiContainer.id = 'kpi-dashboard-container';
            kpiContainer.className = 'kpi-dashboard-wrapper';

            const mainContent = document.querySelector('.dashboard-content') ||
                document.querySelector('#dashboard') ||
                document.querySelector('.main-content') ||
                document.querySelector('main');
            if (mainContent) {
                mainContent.insertBefore(kpiContainer, mainContent.firstChild);
            }
        }

        if (window.API?.getDailyKPIs) {
            loadKPIDashboard(kpiContainer);
        }
    } catch (e) {
        console.log('KPI Dashboard v2 no disponible:', e.message);
    }
    */

    try {
        // 1. INGRESOS TOTALES (usa período actual)
        await actualizarKPIsPorPeriodo(periodoVistaActual);

        // 2. PEDIDOS ACTIVOS
        const pedidos = window.pedidos || [];
        const pedidosActivos = pedidos.filter(p => p.estado === 'pendiente').length;
        const pedidosEl = document.getElementById('kpi-pedidos');
        if (pedidosEl) {
            pedidosEl.textContent = pedidosActivos;
            if (pedidosActivos > 0) animateCounter(pedidosEl, pedidosActivos, '', 800);
        }

        // 3. STOCK BAJO
        const ingredientes = window.ingredientes || ingredientStore.getState().ingredients || [];
        const stockBajo = ingredientes.filter(ing => {
            const stock = parseFloat(ing.stock_actual) || parseFloat(ing.stockActual) || 0;
            const minimo = parseFloat(ing.stock_minimo) || parseFloat(ing.stockMinimo) || 0;
            return minimo > 0 && stock <= minimo;
        }).length;
        const stockEl = document.getElementById('kpi-stock');
        if (stockEl) {
            stockEl.textContent = stockBajo;
            if (stockBajo > 0) animateCounter(stockEl, stockBajo, '', 800);
        }

        const stockMsgEl = document.getElementById('kpi-stock-msg');
        if (stockMsgEl) stockMsgEl.textContent = stockBajo > 0 ? t('dashboard:stock_needs_attention') : t('dashboard:stock_all_ok');

        // 4. MARGEN REAL (basado en ventas reales del período)
        // Usa ventas_diarias_resumen via /balance/mes para margen ponderado por ventas
        await actualizarMargenReal(periodoVistaActual);

        // 5. VALOR STOCK TOTAL - BLINDADO: Solo recalcula con acción explícita
        try {
            const valorStockEl = document.getElementById('kpi-valor-stock');
            const itemsStockEl = document.getElementById('kpi-items-stock');

            // � BLINDADO: Usar valor cacheado si existe, NO recalcular automáticamente
            const cachedData = JSON.parse(sessionStorage.getItem('_stock_value_cache') || 'null');
            const forceRecalc = window._forceRecalcStock === true;
            window._forceRecalcStock = false; // Reset flag

            if (cachedData && !forceRecalc) {
                // Usar valor cacheado
                if (valorStockEl) {
                    valorStockEl.textContent = cachedData.valor.toLocaleString('es-ES', {
                        maximumFractionDigits: 0
                    }) + '€';
                }
                if (itemsStockEl) {
                    itemsStockEl.textContent = cachedData.items;
                }
                console.log('📦 Valor Stock (CACHE):', cachedData.valor.toFixed(2) + '€');
            } else {
                // Calcular y cachear
                const ingredientes = ingredientStore.getState().ingredients;
                const inventario = window.inventarioCompleto || [];
                const invMap = new Map(inventario.map(i => [i.id, i]));

                if (ingredientes.length > 0) {
                    const valorTotal = ingredientes.reduce((sum, ing) => {
                        const stock = parseFloat(ing.stock_actual) || 0;
                        const invItem = invMap.get(ing.id);
                        let precioUnitario = 0;

                        if (invItem?.precio_medio) {
                            precioUnitario = parseFloat(invItem.precio_medio);
                        } else if (ing.precio) {
                            const precioFormato = parseFloat(ing.precio) || 0;
                            const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;
                            precioUnitario = precioFormato / cantidadPorFormato;
                        }

                        return sum + (stock * precioUnitario);
                    }, 0);

                    const itemsConStock = ingredientes.filter(i =>
                        (parseFloat(i.stock_actual) || 0) > 0
                    ).length;

                    // Guardar en caché de sesión
                    sessionStorage.setItem('_stock_value_cache', JSON.stringify({
                        valor: valorTotal,
                        items: itemsConStock,
                        timestamp: Date.now()
                    }));

                    if (valorStockEl) {
                        valorStockEl.textContent = valorTotal.toLocaleString('es-ES', {
                            maximumFractionDigits: 0
                        }) + '€';
                    }

                    if (itemsStockEl) {
                        itemsStockEl.textContent = itemsConStock;
                    }

                    console.log('� Valor Stock (NUEVO):', valorTotal.toFixed(2) + '€', '| Items:', itemsConStock);
                } else {
                    if (valorStockEl) valorStockEl.textContent = '0€';
                    if (itemsStockEl) itemsStockEl.textContent = '0';
                }
            }
        } catch (e) {
            console.error('Error calculando valor stock:', e);
            const valorStockEl = document.getElementById('kpi-valor-stock');
            const itemsStockEl = document.getElementById('kpi-items-stock');
            if (valorStockEl) valorStockEl.textContent = '-';
            if (itemsStockEl) itemsStockEl.textContent = '-';
        }

        // 6. SIDEBAR CAMBIOS DE PRECIO (comparar con último pedido)
        try {
            const pedidos = window.pedidos || [];
            const pedidosRecibidos = pedidos
                .filter(p => p.estado === 'recibido' && p.ingredientes?.length > 0)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            const listaCambiosEl = document.getElementById('lista-cambios-precio');
            if (listaCambiosEl && pedidosRecibidos.length > 0) {
                // Agrupar precios por ingrediente de los últimos pedidos
                const preciosPorIngrediente = {};

                pedidosRecibidos.slice(0, 30).forEach(pedido => {
                    (pedido.ingredientes || []).forEach(item => {
                        const ingId = item.ingredienteId || item.ingrediente_id;
                        const precio = parseFloat(item.precioReal || item.precio_unitario || item.precio || 0);
                        const fecha = pedido.fecha;

                        if (!preciosPorIngrediente[ingId]) {
                            preciosPorIngrediente[ingId] = [];
                        }
                        preciosPorIngrediente[ingId].push({ precio, fecha });
                    });
                });

                // Calcular cambios de precio
                const cambios = [];
                const ingredientes = ingredientStore.getState().ingredients;
                const ingMap = new Map(ingredientes.map(i => [i.id, i]));

                Object.entries(preciosPorIngrediente).forEach(([ingId, precios]) => {
                    if (precios.length >= 2) {
                        const ultimoPrecio = precios[0].precio;
                        const anteriorPrecio = precios[1].precio;
                        const ing = ingMap.get(parseInt(ingId));

                        if (ing && anteriorPrecio > 0 && Math.abs(ultimoPrecio - anteriorPrecio) > 0.01) {
                            const cambio = ((ultimoPrecio - anteriorPrecio) / anteriorPrecio) * 100;
                            cambios.push({
                                nombre: ing.nombre,
                                ultimoPrecio,
                                anteriorPrecio,
                                cambio,
                                unidad: ing.unidad
                            });
                        }
                    }
                });

                // Ordenar: primero las bajadas (negativo), luego las subidas
                cambios.sort((a, b) => a.cambio - b.cambio);

                if (cambios.length > 0) {
                    let html = '';
                    cambios.slice(0, 10).forEach(c => {
                        const esBajada = c.cambio < 0;
                        const color = esBajada ? '#10B981' : '#EF4444';
                        const flecha = esBajada ? '↓' : '↑';
                        const bg = esBajada ? '#F0FDF4' : '#FEF2F2';

                        html += `
                            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${bg}; border-radius: 8px; margin-bottom: 8px;">
                                <span style="font-size: 18px; color: ${color};">${flecha}</span>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.nombre}</div>
                                    <div style="font-size: 11px; color: #64748B;">
                                        ${c.anteriorPrecio.toFixed(2)}€ → ${c.ultimoPrecio.toFixed(2)}€/${c.unidad}
                                    </div>
                                </div>
                                <div style="font-weight: 700; color: ${color}; font-size: 12px; white-space: nowrap;">
                                    ${c.cambio > 0 ? '+' : ''}${c.cambio.toFixed(1)}%
                                </div>
                            </div>
                        `;
                    });
                    listaCambiosEl.innerHTML = html;
                } else {
                    listaCambiosEl.innerHTML = `
                        <div style="color: #64748B; text-align: center; padding: 20px 0;">
                            <div style="font-size: 24px; margin-bottom: 8px;">✅</div>
                            ${t('dashboard:no_price_changes')}
                        </div>
                    `;
                }
            } else if (listaCambiosEl) {
                listaCambiosEl.innerHTML = `
                    <div style="color: #64748B; text-align: center; padding: 20px 0;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
                        ${t('dashboard:no_price_changes_hint')}
                    </div>
                `;
            }
        } catch (e) {
            console.error('Error calculando cambios de precio:', e);
        }

        // 7. PERSONAL HOY (empleados que trabajan / libran)
        try {
            const personalHoyEl = document.getElementById('personal-hoy-lista');
            if (personalHoyEl) {
                // Obtener horarios del día de hoy
                const hoy = new Date();
                const hoyStr = hoy.toISOString().split('T')[0];
                const diaSemana = hoy.getDay(); // 0=domingo, 1=lunes...
                const diasSemana = [t('dashboard:day_domingo'), t('dashboard:day_lunes'), t('dashboard:day_martes'), t('dashboard:day_miercoles'), t('dashboard:day_jueves'), t('dashboard:day_viernes'), t('dashboard:day_sabado')];
                const diaHoy = diasSemana[diaSemana];

                // Cargar empleados y horarios en paralelo (no hay dependencia entre ellos)
                let empleados = window.empleados || [];
                let horariosHoy = [];

                try {
                    if (empleados.length === 0) {
                        // Fetch ambos en paralelo
                        const [empResult, horResult] = await Promise.all([
                            apiClient.get('/empleados'),
                            apiClient.get(`/horarios?desde=${hoyStr}&hasta=${hoyStr}`)
                        ]);
                        empleados = empResult;
                        window.empleados = empleados;
                        horariosHoy = horResult;
                    } else {
                        // Ya tenemos empleados, solo fetch horarios
                        horariosHoy = await apiClient.get(`/horarios?desde=${hoyStr}&hasta=${hoyStr}`);
                    }
                    console.log(`📅 Horarios de hoy (${hoyStr}): ${horariosHoy.length}`);
                } catch (e) {
                    console.warn('No se pudieron cargar empleados/horarios:', e);
                }

                if (empleados.length > 0) {
                    // Filtrar horarios que SÍ son de hoy

                    const empleadosConTurno = new Set(horariosHoy.map(h => h.empleado_id));

                    const trabajanHoy = [];
                    const libranHoy = [];

                    empleados.forEach(emp => {
                        if (empleadosConTurno.has(emp.id)) {
                            trabajanHoy.push(emp.nombre);
                        } else {
                            libranHoy.push(emp.nombre);
                        }
                    });

                    // Mostrar con nombres
                    const htmlPersonal = `
                        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <div style="flex: 1; text-align: center; padding: 8px; background: linear-gradient(135deg, #F0FDF4, #DCFCE7); border-radius: 8px;">
                                <div style="font-size: 20px; font-weight: 800; color: #10B981;">💪 ${trabajanHoy.length}</div>
                                <div style="font-size: 10px; color: #059669; font-weight: 600;">${t('dashboard:staff_working')}</div>
                            </div>
                            <div style="flex: 1; text-align: center; padding: 8px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 8px;">
                                <div style="font-size: 20px; font-weight: 800; color: #D97706;">🏖️ ${libranHoy.length}</div>
                                <div style="font-size: 10px; color: #B45309; font-weight: 600;">${t('dashboard:staff_off')}</div>
                            </div>
                        </div>
                        <div style="font-size: 11px; max-height: 60px; overflow-y: auto;">
                            ${trabajanHoy.length > 0 ? `<div style="color: #059669; margin-bottom: 4px;"><b>${t('dashboard:staff_working')}:</b> ${trabajanHoy.join(', ')}</div>` : ''}
                            ${libranHoy.length > 0 ? `<div style="color: #B45309;"><b>${t('dashboard:staff_off')}:</b> ${libranHoy.join(', ')}</div>` : ''}
                        </div>
                    `;
                    personalHoyEl.innerHTML = htmlPersonal;
                } else {
                    personalHoyEl.innerHTML = `
                        <div style="display: flex; gap: 12px;">
                            <div style="flex: 1; text-align: center; padding: 12px; background: linear-gradient(135deg, #F0FDF4, #DCFCE7); border-radius: 10px;">
                                <div style="font-size: 22px; font-weight: 800; color: #10B981;">-</div>
                                <div style="font-size: 11px; color: #059669; font-weight: 600;">${t('dashboard:staff_working')}</div>
                            </div>
                            <div style="flex: 1; text-align: center; padding: 12px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 10px;">
                                <div style="font-size: 22px; font-weight: 800; color: #D97706;">-</div>
                                <div style="font-size: 11px; color: #B45309; font-weight: 600;">${t('dashboard:staff_off')}</div>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 10px; font-size: 11px; color: #94a3b8;">
                            <a href="#" data-tab="horarios" style="color: #8B5CF6; text-decoration: none;">${t('dashboard:link_staff_management')}</a>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error('Error mostrando personal hoy:', e);
        }

        // Actualizar contador de stock bajo
        const stockCountEl = document.getElementById('kpi-stock-count');
        if (stockCountEl) {
            stockCountEl.textContent = stockBajo;
        }

        // Render sparklines
        const sparklineIngresos = document.getElementById('sparkline-ingresos');
        if (sparklineIngresos) {
            const historicalData = getHistoricalData('ingresos');
            renderSparkline(sparklineIngresos, historicalData);
        }

        // Render forecast chart
        if (typeof window.calcularForecast === 'function') {
            const ventas = saleStore.getState().sales;
            const forecast = window.calcularForecast(ventas, 7);

            // Update forecast total
            const forecastTotalEl = document.getElementById('forecast-total');
            if (forecastTotalEl) {
                forecastTotalEl.textContent = forecast.totalPrediccion.toLocaleString('es-ES') + '€';
            }

            // Update confidence text
            const confianzaEl = document.getElementById('forecast-confianza');
            if (confianzaEl) {
                const confianzaTextos = {
                    'alta': `📊 ${t('dashboard:forecast_high_confidence')}`,
                    'media': `📊 ${t('dashboard:forecast_medium_confidence')}`,
                    'baja': `📊 ${t('dashboard:forecast_low_confidence')}`,
                    'muy_baja': `📊 ${t('dashboard:forecast_limited_data')}`,
                    'sin_datos': `📊 ${t('dashboard:forecast_no_data')}`
                };
                confianzaEl.textContent = confianzaTextos[forecast.confianza] || t('dashboard:forecast_default');
            }

            // Update week comparison
            const comparativaEl = document.getElementById('forecast-comparativa');
            if (comparativaEl && forecast.comparativaSemana) {
                const comp = forecast.comparativaSemana;
                if (comp.anterior > 0 || comp.actual > 0) {
                    const signo = comp.tendencia === 'up' ? '↑' : comp.tendencia === 'down' ? '↓' : '→';
                    const color = comp.tendencia === 'up' ? '#10B981' : comp.tendencia === 'down' ? '#EF4444' : '#64748B';
                    comparativaEl.innerHTML = `<span style="color: ${color}">${signo} ${comp.porcentaje}%</span> ${t('dashboard:vs_prev_week')}`;
                    comparativaEl.style.background = comp.tendencia === 'up' ? '#ECFDF5' : comp.tendencia === 'down' ? '#FEF2F2' : '#F8FAFC';
                } else {
                    comparativaEl.textContent = '';
                }
            }

            // Render chart
            if (typeof window.renderForecastChart === 'function') {
                window.renderForecastChart('chart-forecast', forecast.chartData);
            }

            // Initialize forecast period tabs
            initForecastTabs();
        }

    } catch (error) {
        console.error('Error actualizando KPIs:', error);
    }
}

/**
 * Initialize forecast period tabs with click handlers
 */
function initForecastTabs() {
    const tabs = document.querySelectorAll('.forecast-period-tab');
    if (!tabs.length) return;

    // Only initialize once
    if (window._forecastTabsInitialized) return;
    window._forecastTabsInitialized = true;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const period = parseInt(tab.dataset.period);
            updateForecastPeriod(period);

            // Update tab styles
            tabs.forEach(t => {
                if (t === tab) {
                    t.style.background = '#8B5CF6';
                    t.style.color = 'white';
                    t.style.fontWeight = '600';
                } else {
                    t.style.background = '#f1f5f9';
                    t.style.color = '#64748b';
                    t.style.fontWeight = '500';
                }
            });
        });
    });
}

/**
 * Update forecast for a specific period (7, 30, or 90 days)
 */
function updateForecastPeriod(dias) {
    const ventas = saleStore.getState().sales;
    if (!ventas.length || typeof window.calcularForecast !== 'function') return;

    const forecast = window.calcularForecast(ventas, dias);

    // Update total with period label
    const forecastTotalEl = document.getElementById('forecast-total');
    if (forecastTotalEl) {
        forecastTotalEl.textContent = forecast.totalPrediccion.toLocaleString('es-ES') + '€';
    }

    // Update confidence text with period info
    const confianzaEl = document.getElementById('forecast-confianza');
    if (confianzaEl) {
        const periodoTexto = dias === 7 ? t('dashboard:forecast_7days') : dias === 30 ? t('dashboard:forecast_month') : t('dashboard:forecast_quarter');
        const confianzaTextos = {
            'alta': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_high')}`,
            'media': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_medium')}`,
            'baja': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_low')}`,
            'muy_baja': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_limited')}`,
            'sin_datos': `📊 ${t('dashboard:forecast_no_data')}`
        };
        confianzaEl.textContent = confianzaTextos[forecast.confianza] || t('dashboard:forecast_period_projection', { period: periodoTexto });
    }

    // Re-render chart with new data
    if (typeof window.renderForecastChart === 'function') {
        window.renderForecastChart('chart-forecast', forecast.chartData);
    }
}

// Exponer funciones en window para acceso desde onclick en HTML
if (typeof window !== 'undefined') {
    window.inicializarFechaActual = inicializarFechaActual;
    window.cambiarPeriodoVista = cambiarPeriodoVista;
    window.actualizarKPIsPorPeriodo = actualizarKPIsPorPeriodo;
}

// Escuchar evento de refresh del dashboard
window.addEventListener('dashboard:refresh', () => {
    // Recargar KPIs y gráficos
    const kpiContainer = document.getElementById('kpi-dashboard-container');
    const chartsContainer = document.getElementById('kpi-charts-container');

    if (kpiContainer && typeof loadKPIDashboard === 'function') {
        loadKPIDashboard(kpiContainer);
    }
    if (chartsContainer && typeof window.renderKPICharts === 'function') {
        window.renderKPICharts(chartsContainer);
    }

    // También actualizar los KPIs básicos
    actualizarKPIs();

    // Actualizar widgets expandidos (Stock Bajo lista, Top Recetas, etc.)
    window.actualizarDashboardExpandido?.();
});
