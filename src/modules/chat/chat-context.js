/**
 * Chat — Detección de pestaña activa y snapshot de contexto para el agente.
 *
 * `getCurrentTab` devuelve el nombre normalizado (sin acentos/minúsculas) de la
 * pestaña activa. `getCurrentTabContext` construye el payload grande con
 * ingredientes/recetas/proveedores/ventas/empleados/horarios/diario que se envía
 * al endpoint legacy de n8n. El backend de Claude ignora este snapshot (usa sus
 * propias tools), pero seguimos construyéndolo porque el fallback n8n aún lo
 * necesita si `appConfig.chat.backend !== 'claude'`.
 *
 * Lee solo `window.*` (ingredientes, recetas, proveedores, ventas, empleados,
 * horarios, inventarioCompleto, datosResumenMensual, calcularCosteRecetaCompleto).
 */

import { logger } from '../../utils/logger.js';

export function getCurrentTab() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        return activeTab.textContent
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
    return 'dashboard';
}

export function getCurrentTabContext() {
    const tab = getCurrentTab();
    const context = { tab };

    try {
        // Gastos fijos: el backend de Claude ya expone obtener_gastos/resumen_pyg
        // con desglose por categoría. Enviar un snapshot aquí sería redundante y
        // además corría el riesgo de mostrar solo las 4 categorías hardcoded.
        context.gastosFijos = { total: 0 };

        if (window.ingredientes && Array.isArray(window.ingredientes)) {
            let valorTotalStock = 0;
            context.ingredientes = window.ingredientes.map(i => {
                const stock = parseFloat(i.stock_actual) || parseFloat(i.stock_virtual) || 0;
                const precio = parseFloat(i.precio_medio_compra) || parseFloat(i.precio_medio) || parseFloat(i.precio) || 0;
                valorTotalStock += stock * precio;
                return {
                    nombre: i.nombre,
                    precio: precio,
                    unidad: i.unidad || 'kg',
                    stock: stock,
                };
            });
            context.totalIngredientes = window.ingredientes.length;
            context.valorTotalStock = Math.round(valorTotalStock * 100) / 100;
            context.stockBajo = window.ingredientes.filter(
                i => parseFloat(i.stock_actual) === 0 || (i.stock_minimo > 0 && parseFloat(i.stock_actual) <= parseFloat(i.stock_minimo))
            ).length;
        }

        if (window.recetas && Array.isArray(window.recetas)) {
            context.recetas = window.recetas.slice(0, 15).map(r => {
                const coste = window.calcularCosteRecetaCompleto
                    ? window.calcularCosteRecetaCompleto(r)
                    : 0;
                const precioVenta = parseFloat(r.precio_venta) || 0;
                const foodCost = precioVenta > 0 ? (coste / precioVenta) * 100 : 0;
                const margen = precioVenta > 0 ? ((precioVenta - coste) / precioVenta) * 100 : 0;

                const ingredientesDetalle = (r.ingredientes || []).map(item => {
                    const ing = window.ingredientes?.find(i => i.id === item.ingredienteId);
                    const invItem = window.inventarioCompleto?.find(i => i.id === item.ingredienteId);
                    // Prioridad: precio_medio_compra > precio_medio > precio/cpf
                    let precioUd = 0;
                    if (invItem?.precio_medio_compra) {
                        precioUd = parseFloat(invItem.precio_medio_compra);
                    } else if (invItem?.precio_medio) {
                        precioUd = parseFloat(invItem.precio_medio);
                    } else if (ing?.precio) {
                        const cpf = parseFloat(ing.cantidad_por_formato) || 1;
                        precioUd = parseFloat(ing.precio) / cpf;
                    }
                    const cantidad = parseFloat(item.cantidad) || 0;
                    return {
                        nombre: ing?.nombre || 'Desconocido',
                        cantidad: cantidad,
                        unidad: ing?.unidad || 'kg',
                        precioUd: precioUd,
                        coste: Math.round(precioUd * cantidad * 100) / 100,
                    };
                });

                return {
                    nombre: r.nombre,
                    categoria: r.categoria,
                    coste: Math.round(coste * 100) / 100,
                    precioVenta: precioVenta,
                    foodCost: Math.round(foodCost * 10) / 10,
                    margen: Math.round(margen * 10) / 10,
                    ingredientes: ingredientesDetalle,
                };
            });
            context.totalRecetas = window.recetas.length;
            context.recetasFoodCostAlto = context.recetas.filter(r => r.foodCost > 40).length;
        }

        if (window.proveedores && Array.isArray(window.proveedores)) {
            context.proveedores = window.proveedores.map(p => ({
                id: p.id,
                nombre: p.nombre,
                telefono: p.telefono || '',
                email: p.email || '',
            }));
            context.totalProveedores = window.proveedores.length;
        }

        if (window.ingredientes && window.proveedores) {
            const ingredientesConProveedores = window.ingredientes
                .filter(ing => ing.proveedores && Array.isArray(ing.proveedores) && ing.proveedores.length > 0)
                .map(ing => {
                    const proveedoresNombres = ing.proveedores.map(p => {
                        const prov = window.proveedores.find(pr => pr.id === p.proveedor_id);
                        return prov ? prov.nombre : 'Desconocido';
                    });
                    return {
                        ingrediente: ing.nombre,
                        numProveedores: ing.proveedores.length,
                        proveedores: proveedoresNombres.join(', '),
                    };
                });

            context.ingredientesMultiplesProveedores = ingredientesConProveedores.filter(i => i.numProveedores >= 2);
            context.totalIngredientesConMultiplesProveedores = context.ingredientesMultiplesProveedores.length;

            context.ingredientesSinProveedor = window.ingredientes
                .filter(ing => !ing.proveedores || ing.proveedores.length === 0)
                .filter(ing => !ing.proveedor_id && !ing.proveedorId)
                .map(ing => ing.nombre)
                .slice(0, 20);
        }

        if (window.ventas && Array.isArray(window.ventas)) {
            const hoy = new Date().toISOString().split('T')[0];
            const ventasHoy = window.ventas.filter(v => v.fecha === hoy);
            const totalVentasHoy = ventasHoy.reduce(
                (sum, v) => sum + (parseFloat(v.total) || 0),
                0
            );
            context.ventas = {
                hoy: Math.round(totalVentasHoy * 100) / 100,
                totalRegistros: window.ventas.length,
            };
        }

        if (window.empleados && Array.isArray(window.empleados)) {
            context.empleados = window.empleados.map(e => ({
                id: e.id,
                nombre: e.nombre,
                puesto: e.puesto || '',
            }));
            context.totalEmpleados = window.empleados.length;
        }

        if (window.horarios && Array.isArray(window.horarios)) {
            const hoyISO = new Date().toISOString().split('T')[0];
            const horariosHoy = window.horarios.filter(h => {
                const fechaH = h.fecha.includes('T') ? h.fecha.split('T')[0] : h.fecha;
                return fechaH === hoyISO;
            });
            context.horariosHoy = horariosHoy.map(h => {
                const emp = window.empleados?.find(e => e.id === h.empleado_id);
                return {
                    empleado: emp?.nombre || 'Desconocido',
                    turno: h.turno,
                    horaInicio: h.hora_inicio,
                    horaFin: h.hora_fin,
                };
            });
            const idsTrabajan = new Set(horariosHoy.map(h => h.empleado_id));
            context.trabajanHoy = (window.empleados || [])
                .filter(e => idsTrabajan.has(e.id))
                .map(e => e.nombre);
            context.libranHoy = (window.empleados || [])
                .filter(e => !idsTrabajan.has(e.id))
                .map(e => e.nombre);
        }

        if (window.datosResumenMensual) {
            const resumen = window.datosResumenMensual;
            context.diario = {
                dias: resumen.dias || [],
                totalCompras: resumen.compras?.total || 0,
                totalIngresos: resumen.ventas?.totalIngresos || 0,
                totalCostes: resumen.ventas?.totalCostes || 0,
                beneficioBruto: resumen.ventas?.beneficioBruto || 0,
                foodCost: resumen.resumen?.foodCost || 0,
                margenPromedio: resumen.resumen?.margenPromedio || 0,
            };

            if (resumen.ventas?.recetas) {
                const datosPorDia = {};
                for (const [, recetaData] of Object.entries(resumen.ventas.recetas)) {
                    for (const [fecha, diaData] of Object.entries(recetaData.dias || {})) {
                        if (!datosPorDia[fecha]) {
                            datosPorDia[fecha] = { ingresos: 0, costes: 0, vendidas: 0 };
                        }
                        datosPorDia[fecha].ingresos += diaData.ingresos || 0;
                        datosPorDia[fecha].costes += diaData.coste || 0;
                        datosPorDia[fecha].vendidas += diaData.vendidas || 0;
                    }
                }
                context.diario.porDia = Object.entries(datosPorDia)
                    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                    .slice(0, 7)
                    .map(([fecha, data]) => ({
                        fecha,
                        ingresos: Math.round(data.ingresos * 100) / 100,
                        costes: Math.round(data.costes * 100) / 100,
                        margenBruto: Math.round((data.ingresos - data.costes) * 100) / 100,
                        foodCost: data.ingresos > 0 ? Math.round((data.costes / data.ingresos) * 1000) / 10 : 0,
                        vendidas: data.vendidas
                    }));
            }
        }
    } catch (e) {
        logger.warn('Error obteniendo contexto:', e);
    }

    return context;
}
