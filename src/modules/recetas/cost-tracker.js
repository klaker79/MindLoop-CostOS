/**
 * Cost Tracker Module
 * Muestra cómo los precios de compra afectan los costes de las recetas
 */

/**
 * Muestra el modal de seguimiento de costes
 */
export function mostrarCostTracker() {
    const modal = document.getElementById('modal-cost-tracker');
    if (!modal) {
        crearModalCostTracker();
    }

    actualizarDatosCostTracker();
    document.getElementById('modal-cost-tracker').classList.add('active');
}

/**
 * Crea el modal de cost tracker si no existe
 */
function crearModalCostTracker() {
    const modalHtml = `
    <div id="modal-cost-tracker" class="modal-overlay">
        <div class="modal-content" style="max-width: 900px; max-height: 85vh;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                    📊 Seguimiento de Costes de Recetas
                </h2>
                <button onclick="window.cerrarCostTracker()" style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
            </div>
            
            <p style="color: #64748B; margin-bottom: 20px;">
                Muestra el coste actual de cada receta basado en el <strong>precio medio de compra</strong> de los ingredientes.
            </p>
            
            <div id="cost-tracker-summary" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                <!-- Resumen se llena dinámicamente -->
            </div>
            
            <div style="overflow-y: auto; max-height: 50vh;">
                <table id="cost-tracker-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #F8FAFC; position: sticky; top: 0;">
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #64748B;">Receta</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">Categoría</th>
                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #64748B;">Coste Actual</th>
                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #64748B;">Precio Venta</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">Food Cost</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600; color: #64748B;">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="cost-tracker-body">
                        <!-- Filas se llenan dinámicamente -->
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #F0F9FF; border-radius: 8px; border-left: 4px solid #3B82F6;">
                <strong>💡 Consejo:</strong> Los costes se actualizan automáticamente según el precio medio de las compras que registras. 
                Si el precio de un ingrediente sube, verás el impacto aquí inmediatamente.
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Actualiza los datos del cost tracker
 */
function actualizarDatosCostTracker() {
    const recetas = window.recetas || [];
    const inventario = window.inventarioCompleto || [];
    const ingredientes = window.ingredientes || [];

    let totalRecetas = recetas.length;
    let recetasRentables = 0;
    let recetasAjustadas = 0;
    let recetasAlerta = 0;

    const tbody = document.getElementById('cost-tracker-body');
    if (!tbody) return;

    let html = '';

    recetas.forEach(receta => {
        // Calcular coste con precio medio
        let costeActual = 0;

        if (receta.ingredientes && Array.isArray(receta.ingredientes)) {
            receta.ingredientes.forEach(item => {
                const ingId = item.ingredienteId || item.ingrediente_id;
                // Buscar precio_medio en inventario
                const invItem = inventario.find(i => i.id === ingId);
                const ing = ingredientes.find(i => i.id === ingId);

                const precio = invItem?.precio_medio
                    ? parseFloat(invItem.precio_medio)
                    : (ing?.precio ? parseFloat(ing.precio) : 0);

                costeActual += precio * parseFloat(item.cantidad || 0);
            });
        }

        const precioVenta = parseFloat(receta.precio_venta || 0);
        const foodCost = precioVenta > 0 ? (costeActual / precioVenta) * 100 : 0;

        // Determinar estado
        let estado, estadoColor, estadoIcon;
        if (foodCost <= 33) {
            estado = 'Rentable';
            estadoColor = '#10B981';
            estadoIcon = '✅';
            recetasRentables++;
        } else if (foodCost <= 38) {
            estado = 'Ajustado';
            estadoColor = '#F59E0B';
            estadoIcon = '⚠️';
            recetasAjustadas++;
        } else {
            estado = 'Alerta';
            estadoColor = '#EF4444';
            estadoIcon = '🚨';
            recetasAlerta++;
        }

        html += `
            <tr style="border-bottom: 1px solid #F1F5F9;">
                <td style="padding: 12px;"><strong>${receta.nombre}</strong></td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: #F1F5F9; padding: 4px 10px; border-radius: 12px; font-size: 12px;">
                        ${receta.categoria || 'Sin categoría'}
                    </span>
                </td>
                <td style="padding: 12px; text-align: right; font-weight: 600;">${costeActual.toFixed(2)} €</td>
                <td style="padding: 12px; text-align: right;">${precioVenta.toFixed(2)} €</td>
                <td style="padding: 12px; text-align: center;">
                    <span style="font-weight: bold; color: ${estadoColor};">${foodCost.toFixed(1)}%</span>
                </td>
                <td style="padding: 12px; text-align: center;">
                    <span style="background: ${estadoColor}15; color: ${estadoColor}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${estadoIcon} ${estado}
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="6" style="padding: 40px; text-align: center; color: #94A3B8;">No hay recetas</td></tr>';

    // Actualizar resumen
    const summary = document.getElementById('cost-tracker-summary');
    if (summary) {
        summary.innerHTML = `
            <div style="padding: 15px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">${recetasRentables}</div>
                <div style="font-size: 12px; opacity: 0.9;">✅ Rentables (&lt;33%)</div>
            </div>
            <div style="padding: 15px; background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">${recetasAjustadas}</div>
                <div style="font-size: 12px; opacity: 0.9;">⚠️ Ajustadas (33-38%)</div>
            </div>
            <div style="padding: 15px; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 28px; font-weight: bold;">${recetasAlerta}</div>
                <div style="font-size: 12px; opacity: 0.9;">🚨 Alerta (&gt;38%)</div>
            </div>
        `;
    }
}

/**
 * Cierra el modal de cost tracker
 */
export function cerrarCostTracker() {
    const modal = document.getElementById('modal-cost-tracker');
    if (modal) modal.classList.remove('active');
}

// Exportar globalmente
if (typeof window !== 'undefined') {
    window.mostrarCostTracker = mostrarCostTracker;
    window.cerrarCostTracker = cerrarCostTracker;
}
