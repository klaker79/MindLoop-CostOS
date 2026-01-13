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

// Variable para recordar el período actual (default: semana)
let periodoVistaActual = 'semana';

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
            fechaTexto.textContent = new Date().toLocaleDateString('es-ES', {
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
            periodoInfo.textContent = `Semana ${periodo.semana} · ${mesCapitalizado} ${periodo.año}`;
        } catch (e) {
            periodoInfo.textContent = new Date().toLocaleDateString('es-ES', {
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
}

/**
 * Actualiza KPIs filtrados por período
 */
async function actualizarKPIsPorPeriodo(periodo) {
    try {
        // Obtener ventas de la API (datos frescos)
        const ventas = await window.api.getSales();
        window.ventas = ventas; // Actualizar global

        // Filtrar por período
        let ventasFiltradas = ventas;
        if (typeof filtrarPorPeriodo === 'function') {
            ventasFiltradas = filtrarPorPeriodo(ventas, 'fecha', periodo);
        }

        const totalVentas = ventasFiltradas.reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

        const kpiIngresos = document.getElementById('kpi-ingresos');
        if (kpiIngresos) {
            kpiIngresos.textContent = totalVentas.toFixed(0) + '€';
        }

        // Actualizar comparativa con período anterior (solo para semana)
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
 * Actualiza todos los KPIs del dashboard
 */
export async function actualizarKPIs() {
    // Inicializar banner de fecha actual
    inicializarFechaActual();

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
        const ingredientes = window.ingredientes || [];
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
        if (stockMsgEl) stockMsgEl.textContent = stockBajo > 0 ? 'Requieren atención' : 'Todo OK';

        // 4. MARGEN PROMEDIO
        const recetas = window.recetas || [];
        const recetasConMargen = recetas.filter(r => r.precio_venta > 0);
        if (recetasConMargen.length > 0) {
            // ⚡ OPTIMIZACIÓN: Usar función memoizada para calcular costes
            const calcularCoste =
                window.Performance?.calcularCosteRecetaMemoizado ||
                window.calcularCosteRecetaCompleto;

            const margenTotal = recetasConMargen.reduce((sum, rec) => {
                const coste = typeof calcularCoste === 'function' ? calcularCoste(rec) : 0;
                const margen =
                    rec.precio_venta > 0
                        ? ((rec.precio_venta - coste) / rec.precio_venta) * 100
                        : 0;
                return sum + margen;
            }, 0);
            const margenPromedio = margenTotal / recetasConMargen.length;
            const margenEl = document.getElementById('kpi-margen');
            if (margenEl) {
                const oldValue = parseInt(margenEl.textContent) || 0;
                margenEl.textContent = Math.round(margenPromedio) + '%';
                // Animate if value changed significantly
                if (Math.abs(oldValue - margenPromedio) > 1) {
                    animateCounter(margenEl, Math.round(margenPromedio), '%', 1000);
                }
            }
        }

        // 5. VALOR STOCK TOTAL (nuevo KPI)
        try {
            let inventario = window.inventarioCompleto || [];

            // Si inventario está vacío, intentar cargarlo
            if (inventario.length === 0 && window.api?.getInventoryComplete) {
                try {
                    inventario = await window.api.getInventoryComplete();
                    window.inventarioCompleto = inventario;
                } catch (loadErr) {
                    console.warn('No se pudo cargar inventario para KPI:', loadErr);
                }
            }

            const valorStockEl = document.getElementById('kpi-valor-stock');
            const itemsStockEl = document.getElementById('kpi-items-stock');

            if (inventario.length > 0) {
                const valorTotal = inventario.reduce((sum, ing) => {
                    const stock = parseFloat(ing.stock_virtual) || 0;
                    // Usar precio_medio si existe, sino calcular precio unitario
                    let precioUnitario = parseFloat(ing.precio_medio) || 0;
                    if (!precioUnitario) {
                        const precioBase = parseFloat(ing.precio) || 0;
                        const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 0;
                        // Si hay formato, dividir precio por cantidad_por_formato
                        precioUnitario = (cantidadFormato > 0) ? precioBase / cantidadFormato : precioBase;
                    }
                    return sum + (stock * precioUnitario);
                }, 0);

                if (valorStockEl) {
                    valorStockEl.textContent = valorTotal.toLocaleString('es-ES', {
                        maximumFractionDigits: 0
                    }) + '€';
                }

                if (itemsStockEl) {
                    itemsStockEl.textContent = inventario.length;
                }
            } else {
                // Si no hay datos, mostrar 0 en vez de dejarlo vacío
                if (valorStockEl) valorStockEl.textContent = '0€';
                if (itemsStockEl) itemsStockEl.textContent = '0';
            }
        } catch (e) {
            console.error('Error calculando valor stock:', e);
            // En caso de error, mostrar indicador
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
                const ingredientes = window.ingredientes || [];
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
                            Sin cambios de precio recientes
                        </div>
                    `;
                }
            } else if (listaCambiosEl) {
                listaCambiosEl.innerHTML = `
                    <div style="color: #64748B; text-align: center; padding: 20px 0;">
                        <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
                        Registra pedidos para ver<br>cambios de precio
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
                const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                const diaHoy = diasSemana[diaSemana];

                // Cargar empleados desde API si no existen
                let empleados = window.empleados || [];
                if (empleados.length === 0) {
                    try {
                        const token = localStorage.getItem('token');
                        const apiBase = getApiUrl();
                        const respEmpleados = await fetch(`${apiBase}/empleados`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        if (respEmpleados.ok) {
                            empleados = await respEmpleados.json();
                            window.empleados = empleados;
                        }
                    } catch (e) {
                        console.warn('No se pudieron cargar empleados:', e);
                    }
                }

                // Cargar horarios de HOY directamente desde API (siempre fresco)
                let horariosHoy = [];
                if (empleados.length > 0) {
                    try {
                        const token = localStorage.getItem('token');
                        const apiBase = getApiUrl();
                        const respHorarios = await fetch(`${apiBase}/horarios?desde=${hoyStr}&hasta=${hoyStr}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        if (respHorarios.ok) {
                            horariosHoy = await respHorarios.json();
                            console.log(`📅 Horarios de hoy (${hoyStr}): ${horariosHoy.length}`);
                        }
                    } catch (e) {
                        console.warn('No se pudieron cargar horarios de hoy:', e);
                    }
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
                                <div style="font-size: 10px; color: #059669; font-weight: 600;">Trabajan</div>
                            </div>
                            <div style="flex: 1; text-align: center; padding: 8px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 8px;">
                                <div style="font-size: 20px; font-weight: 800; color: #D97706;">🏖️ ${libranHoy.length}</div>
                                <div style="font-size: 10px; color: #B45309; font-weight: 600;">Libran</div>
                            </div>
                        </div>
                        <div style="font-size: 11px; max-height: 60px; overflow-y: auto;">
                            ${trabajanHoy.length > 0 ? `<div style="color: #059669; margin-bottom: 4px;"><b>Trabajan:</b> ${trabajanHoy.join(', ')}</div>` : ''}
                            ${libranHoy.length > 0 ? `<div style="color: #B45309;"><b>Libran:</b> ${libranHoy.join(', ')}</div>` : ''}
                        </div>
                    `;
                    personalHoyEl.innerHTML = htmlPersonal;
                } else {
                    personalHoyEl.innerHTML = `
                        <div style="display: flex; gap: 12px;">
                            <div style="flex: 1; text-align: center; padding: 12px; background: linear-gradient(135deg, #F0FDF4, #DCFCE7); border-radius: 10px;">
                                <div style="font-size: 22px; font-weight: 800; color: #10B981;">-</div>
                                <div style="font-size: 11px; color: #059669; font-weight: 600;">Trabajan</div>
                            </div>
                            <div style="flex: 1; text-align: center; padding: 12px; background: linear-gradient(135deg, #FEF3C7, #FDE68A); border-radius: 10px;">
                                <div style="font-size: 22px; font-weight: 800; color: #D97706;">-</div>
                                <div style="font-size: 11px; color: #B45309; font-weight: 600;">Libran</div>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 10px; font-size: 11px; color: #94a3b8;">
                            <a href="#" data-tab="horarios" style="color: #8B5CF6; text-decoration: none;">Ir a Gestión de Personal →</a>
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
            const ventas = window.ventas || [];
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
                    'alta': '📊 Alta confianza (30+ días de datos)',
                    'media': '📊 Confianza media (14-30 días de datos)',
                    'baja': '📊 Baja confianza (7-14 días de datos)',
                    'muy_baja': '📊 Datos limitados (<7 días)',
                    'sin_datos': '📊 Sin datos históricos'
                };
                confianzaEl.textContent = confianzaTextos[forecast.confianza] || 'Basado en historial de ventas';
            }

            // Update week comparison
            const comparativaEl = document.getElementById('forecast-comparativa');
            if (comparativaEl && forecast.comparativaSemana) {
                const comp = forecast.comparativaSemana;
                if (comp.anterior > 0 || comp.actual > 0) {
                    const signo = comp.tendencia === 'up' ? '↑' : comp.tendencia === 'down' ? '↓' : '→';
                    const color = comp.tendencia === 'up' ? '#10B981' : comp.tendencia === 'down' ? '#EF4444' : '#64748B';
                    comparativaEl.innerHTML = `<span style="color: ${color}">${signo} ${comp.porcentaje}%</span> vs semana anterior`;
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
    const ventas = window.ventas || [];
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
        const periodoTexto = dias === 7 ? '7 días' : dias === 30 ? 'mes' : 'trimestre';
        const confianzaTextos = {
            'alta': `📊 Proyección ${periodoTexto} · Alta confianza`,
            'media': `📊 Proyección ${periodoTexto} · Confianza media`,
            'baja': `📊 Proyección ${periodoTexto} · Baja confianza`,
            'muy_baja': `📊 Proyección ${periodoTexto} · Datos limitados`,
            'sin_datos': `📊 Sin datos históricos`
        };
        confianzaEl.textContent = confianzaTextos[forecast.confianza] || `Proyección ${periodoTexto}`;
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
