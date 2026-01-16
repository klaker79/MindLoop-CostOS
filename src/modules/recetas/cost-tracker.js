/**
 * Cost Tracker Module - Premium Edition
 * Seguimiento de Costes de Recetas basado en precios de compra
 */

/**
 * Muestra el modal de seguimiento de costes
 */
export function mostrarCostTracker() {
    // Remover modal existente si existe
    let modal = document.getElementById('modal-cost-tracker');
    if (modal) modal.remove();

    // Crear nuevo modal
    crearModalCostTracker();
    actualizarDatosCostTracker();

    // Mostrar con animación
    setTimeout(() => {
        document.getElementById('modal-cost-tracker').classList.add('active');
    }, 10);
}

/**
 * Crea el modal de cost tracker con diseño premium
 */
function crearModalCostTracker() {
    const modalHtml = `
    <div id="modal-cost-tracker" class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.3s ease;
    ">
        <div style="
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 24px;
            width: 95%;
            max-width: 1100px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
            transform: scale(0.9);
            transition: transform 0.3s ease;
        ">
            <!-- Header con gradiente -->
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 25px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <h2 style="margin: 0; color: white; font-size: 26px; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                        📊 Seguimiento de Costes en Tiempo Real
                    </h2>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                        Los costes se actualizan automáticamente según tus compras
                    </p>
                </div>
                <button onclick="window.cerrarCostTracker()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    font-size: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">✕</button>
            </div>
            
            <!-- Summary Cards -->
            <div style="padding: 25px 30px 15px;">
                <div id="cost-tracker-summary" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>
            
            <!-- Header de tabla FIJO -->
            <div style="padding: 0 30px;">
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <thead>
                        <tr>
                            <th style="width: 22%; padding: 14px 16px; text-align: left; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Receta</th>
                            <th style="width: 12%; padding: 14px 16px; text-align: center; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Categoría</th>
                            <th style="width: 12%; padding: 14px 16px; text-align: right; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Coste</th>
                            <th style="width: 12%; padding: 14px 16px; text-align: right; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Precio</th>
                            <th style="width: 14%; padding: 14px 16px; text-align: right; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Beneficio</th>
                            <th style="width: 13%; padding: 14px 16px; text-align: center; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Food Cost</th>
                            <th style="width: 15%; padding: 14px 16px; text-align: center; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.3); background: #1a1a2e;">Estado</th>
                        </tr>
                    </thead>
                </table>
            </div>
            
            <!-- Body de tabla con SCROLL -->
            <div style="padding: 0 30px 25px; overflow-y: auto; max-height: 45vh;">
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <tbody id="cost-tracker-body">
                        <!-- Se llena dinámicamente -->
                    </tbody>
                </table>
            </div>
            
            <!-- Footer con consejo -->
            <div style="
                padding: 20px 30px;
                background: rgba(0, 0, 0, 0.2);
                border-top: 1px solid rgba(255,255,255,0.1);
            ">
                <div style="display: flex; align-items: center; gap: 12px; color: #94a3b8; font-size: 14px;">
                    <span style="font-size: 20px;">💡</span>
                    <span>Los costes se calculan con el <strong style="color: #a78bfa;">precio medio</strong> de tus últimas compras. Recibe un pedido con precio diferente y verás el impacto aquí.</span>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Añadir estilos de animación
    const style = document.createElement('style');
    style.textContent = `
        #modal-cost-tracker.active {
            opacity: 1 !important;
        }
        #modal-cost-tracker.active > div {
            transform: scale(1) !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Actualiza los datos del cost tracker
 */
function actualizarDatosCostTracker() {
    const recetas = window.recetas || [];
    const inventario = window.inventarioCompleto || [];
    const ingredientes = window.ingredientes || [];

    console.log('📊 Cost Tracker - Datos cargados:', {
        recetas: recetas.length,
        inventario: inventario.length,
        ingredientes: ingredientes.length,
        primeraReceta: recetas[0]
    });

    let recetasRentables = 0;
    let recetasAjustadas = 0;
    let recetasAlerta = 0;
    let totalBeneficio = 0;

    const tbody = document.getElementById('cost-tracker-body');
    if (!tbody) return;

    let html = '';

    // Ordenar por food cost (de más a menos problemático)
    // ⚡ OPTIMIZACIÓN: Crear Maps O(1) en lugar de .find() O(n) 
    const inventarioMap = new Map(inventario.map(i => [i.id, i]));
    const ingredientesMap = new Map(ingredientes.map(i => [i.id, i]));

    const recetasConCoste = recetas.map(receta => {
        let costeActual = 0;

        // Los ingredientes ya vienen como array (verificado con browser debug)
        const recetaIngredientes = Array.isArray(receta.ingredientes)
            ? receta.ingredientes
            : [];

        recetaIngredientes.forEach(item => {
            const ingId = item.ingredienteId || item.ingrediente_id;
            // ⚡ Búsqueda O(1) con Map
            const invItem = inventarioMap.get(ingId);
            const ing = ingredientesMap.get(ingId);

            // 💰 CORREGIDO: Precio unitario = precio_medio, o precio/cantidad_por_formato
            let precio = 0;
            if (invItem?.precio_medio) {
                precio = parseFloat(invItem.precio_medio);
            } else if (ing?.precio) {
                const precioFormato = parseFloat(ing.precio);
                const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;
                precio = precioFormato / cantidadPorFormato;
            }

            costeActual += precio * parseFloat(item.cantidad || 0);
        });

        // precio_venta viene como string "20.00"
        const precioVenta = parseFloat(receta.precio_venta) || 0;
        const foodCost = precioVenta > 0 ? (costeActual / precioVenta) * 100 : 100;
        const beneficio = precioVenta - costeActual;
        const numIngredientes = recetaIngredientes.length;

        return {
            id: receta.id,
            nombre: receta.nombre,
            categoria: receta.categoria,
            costeActual,
            precioVenta,
            foodCost,
            beneficio,
            numIngredientes
        };
    }).sort((a, b) => b.foodCost - a.foodCost);

    recetasConCoste.forEach((receta, idx) => {
        // Debug: log first 3 recipes to see their data
        if (idx < 3) {
            console.log(`📊 Receta ${idx}:`, receta.nombre, '| precio:', receta.precioVenta, '| coste:', receta.costeActual);
        }

        const { costeActual, precioVenta, foodCost, beneficio } = receta;

        // Determinar estado y colores
        let estado, bgColor, textColor, icon;
        if (foodCost <= 33) {
            estado = 'Rentable';
            bgColor = 'rgba(16, 185, 129, 0.2)';
            textColor = '#10B981';
            icon = '✅';
            recetasRentables++;
        } else if (foodCost <= 38) {
            estado = 'Ajustado';
            bgColor = 'rgba(245, 158, 11, 0.2)';
            textColor = '#F59E0B';
            icon = '⚠️';
            recetasAjustadas++;
        } else {
            estado = 'Alerta';
            bgColor = 'rgba(239, 68, 68, 0.2)';
            textColor = '#EF4444';
            icon = '🚨';
            recetasAlerta++;
        }

        totalBeneficio += beneficio;

        // Barra de progreso para food cost
        const barColor = foodCost <= 33 ? '#10B981' : foodCost <= 38 ? '#F59E0B' : '#EF4444';
        const barWidth = Math.min(foodCost, 100);

        // Build recipe name HTML - use white color for maximum visibility on dark background
        const nombreHtml = '<b style="color:#FFFFFF;font-size:15px;display:inline-block">' + (receta.nombre || 'SIN NOMBRE') + '</b>';
        const ingHtml = '<br><small style="color:#9CA3AF">' + receta.numIngredientes + ' ingredientes</small>';

        html += `
            <tr style="background:transparent">
                <td style="width: 22%; padding:16px;border-bottom:1px solid rgba(255,255,255,0.08)">
                    ${nombreHtml}${ingHtml}
                </td>
                <td style="width: 12%; padding: 16px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="background: rgba(139, 92, 246, 0.2); color: #a78bfa; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500;">
                        ${receta.categoria || 'Sin categoría'}
                    </span>
                </td>
                <td style="width: 12%; padding: 16px; text-align: right; color: #F97316; font-weight: 700; font-size: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    ${costeActual.toFixed(2)} €
                </td>
                <td style="width: 12%; padding: 16px; text-align: right; color: #3B82F6; font-weight: 700; font-size: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    ${precioVenta.toFixed(2)} €
                </td>
                <td style="width: 14%; padding: 16px; text-align: right; font-weight: 700; font-size: 15px; color: ${beneficio >= 0 ? '#10B981' : '#EF4444'}; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    ${beneficio >= 0 ? '+' : ''}${beneficio.toFixed(2)} €
                </td>
                <td style="width: 13%; padding: 16px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <span style="font-weight: 700; color: ${textColor}; font-size: 15px;">${foodCost.toFixed(1)}%</span>
                        <div style="width: 60px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                            <div style="width: ${barWidth}%; height: 100%; background: ${barColor}; border-radius: 2px;"></div>
                        </div>
                    </div>
                </td>
                <td style="width: 15%; padding: 16px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="background: ${bgColor}; color: ${textColor}; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                        ${icon} ${estado}
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="7" style="padding: 60px; text-align: center; color: #64748b;">No hay recetas configuradas</td></tr>';

    // Actualizar summary cards
    const summary = document.getElementById('cost-tracker-summary');
    if (summary) {
        summary.innerHTML = `
            <div style="
                background: linear-gradient(145deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
                border: 1px solid rgba(16, 185, 129, 0.3);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
            ">
                <div style="font-size: 36px; font-weight: 800; color: #10B981;">${recetasRentables}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">✅ Rentables</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Food Cost &lt; 33%</div>
            </div>
            <div style="
                background: linear-gradient(145deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%);
                border: 1px solid rgba(245, 158, 11, 0.3);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
            ">
                <div style="font-size: 36px; font-weight: 800; color: #F59E0B;">${recetasAjustadas}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">⚠️ Ajustadas</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Food Cost 33-38%</div>
            </div>
            <div style="
                background: linear-gradient(145deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
            ">
                <div style="font-size: 36px; font-weight: 800; color: #EF4444;">${recetasAlerta}</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">🚨 En Alerta</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Food Cost &gt; 38%</div>
            </div>
            <div style="
                background: linear-gradient(145deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
                border: 1px solid rgba(139, 92, 246, 0.3);
                border-radius: 16px;
                padding: 20px;
                text-align: center;
            ">
                <div style="font-size: 28px; font-weight: 800; color: ${totalBeneficio >= 0 ? '#a78bfa' : '#EF4444'};">${totalBeneficio >= 0 ? '+' : ''}${totalBeneficio.toFixed(0)}€</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">💰 Beneficio Total</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Suma de márgenes</div>
            </div>
        `;
    }
}

/**
 * Cierra el modal de cost tracker
 */
export function cerrarCostTracker() {
    const modal = document.getElementById('modal-cost-tracker');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}
