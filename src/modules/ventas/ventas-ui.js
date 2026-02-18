import { escapeHTML } from '../../utils/helpers.js';
/**
 * Ventas UI Module
 * Funciones de interfaz de usuario para ventas
 * 
 * SEGURIDAD: Usa escapeHTML para prevenir XSS en datos de usuario
 */

/**
 * Escapa texto plano para uso en HTML (previene XSS)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto seguro para HTML
 */
/**
 * Renderiza la tabla de ventas
 */
export async function renderizarVentas() {
    try {
        // Poblar select de recetas para nueva venta - ordenadas alfabéticamente
        const select = document.getElementById('venta-receta');
        const recetas = window.recetas || [];
        const recetasOrdenadas = [...recetas].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        );
        if (select) {
            const options = recetasOrdenadas.map(r => {
                const precio = parseFloat(r.precio_venta) || 0;
                return `<option value="${r.id}" data-search="${escapeHTML(r.nombre.toLowerCase())}">${escapeHTML(r.nombre)} - ${precio.toFixed(2)}€</option>`;
            }).join('');
            select.innerHTML = '<option value="">Selecciona un plato...</option>' + options;
        }

        // Añadir buscador si no existe
        const searchInput = document.getElementById('busqueda-venta-receta');
        if (!searchInput && select) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'busqueda-venta-receta';
            input.placeholder = '🔍 Buscar plato...';
            input.style.cssText = 'width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 6px;';
            input.oninput = function () {
                const term = this.value.toLowerCase();
                Array.from(select.options).forEach(opt => {
                    if (opt.value === '') return; // Skip placeholder
                    const match = opt.dataset.search?.includes(term) || false;
                    opt.style.display = match || term === '' ? '' : 'none';
                });
            };
            select.parentElement.insertBefore(input, select);
        }

        // ⚡ Usar caché para render instantáneo, luego refrescar en background
        let ventas;
        if (window._ventasCache) {
            ventas = window._ventasCache;
        } else {
            ventas = await window.api.getSales();
            window._ventasCache = ventas;
        }
        // Refrescar caché en background (sin bloquear render)
        window.api.getSales().then(fresh => { window._ventasCache = fresh; }).catch(() => { });
        const container = document.getElementById('tabla-ventas');

        if (ventas.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="icon">💰</div>
          <h3>No hay ventas registradas</h3>
        </div>
      `;
            return;
        }

        // Agrupar por fecha (usando locale string como clave visual)
        const ventasPorFecha = {};
        const fechaISO = {}; // Mapa: locale string → ISO string para sort correcto
        ventas.forEach(v => {
            const dateObj = new Date(v.fecha);
            const fecha = dateObj.toLocaleDateString('es-ES');
            if (!ventasPorFecha[fecha]) {
                ventasPorFecha[fecha] = [];
                fechaISO[fecha] = v.fecha; // Guardar ISO original para sorting
            }
            ventasPorFecha[fecha].push(v);
        });

        let html = '<table style="width:100%;border-collapse:collapse;"><tbody>';

        // 🔒 P0-4 FIX: Ordenar por fecha ISO original, no por DD/MM/YYYY string
        Object.keys(ventasPorFecha)
            .sort((a, b) => new Date(fechaISO[b]) - new Date(fechaISO[a]))
            .forEach(fecha => {
                const ventasDia = ventasPorFecha[fecha];
                const totalDia = ventasDia.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);

                html += `<tr style="background:#F8FAFC;"><td colspan="6" style="padding:12px 16px;font-weight:600;color:#1E293B;border-bottom:1px solid #E2E8F0;">${fecha} - Total: ${totalDia.toFixed(2)}€</td></tr>`;

                ventasDia.forEach(v => {
                    const hora = new Date(v.fecha).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                    html += `<tr><td style="padding:8px 16px 8px 32px;color:#64748B;">${fecha}</td><td style="padding:8px 16px;color:#64748B;">${hora}</td><td style="padding:8px 16px;color:#1E293B;">${escapeHTML(v.receta_nombre || '')}</td><td style="padding:8px 16px;text-align:center;color:#64748B;">${v.cantidad}</td><td style="padding:8px 16px;text-align:right;"><strong style="color:#1E293B;">${parseFloat(v.total).toFixed(2)}€</strong></td><td style="padding:8px 16px;text-align:center;"><button class="icon-btn delete" onclick="window.eliminarVenta(${v.id})" title="Eliminar">🗑️</button></td></tr>`;
                });
            });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error renderizando ventas:', error);
        window.showToast('Error cargando ventas', 'error');
    }
}

/**
 * Exporta ventas a Excel
 */
export function exportarVentas() {
    window.api.getSales().then(ventas => {
        const columnas = [
            { header: 'ID', key: 'id' },
            { header: 'Fecha', value: v => new Date(v.fecha).toLocaleDateString('es-ES') },
            {
                header: 'Hora',
                value: v =>
                    new Date(v.fecha).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
            },
            {
                header: 'Código Receta',
                value: v => {
                    const rec = (window.recetas || []).find(r => r.id === v.receta_id);
                    return rec?.codigo || `REC-${String(v.receta_id).padStart(4, '0')}`;
                },
            },
            {
                header: 'Descripción',
                value: v =>
                    v.receta_nombre ||
                    (window.recetas || []).find(r => r.id === v.receta_id)?.nombre ||
                    'Desconocida',
            },
            { header: 'Cantidad', key: 'cantidad' },
            {
                header: 'Precio Unitario (€)',
                value: v => parseFloat(v.precio_unitario || 0).toFixed(2),
            },
            { header: 'Total (€)', value: v => parseFloat(v.total || 0).toFixed(2) },
        ];

        window.exportarAExcel(ventas, `Ventas_${window.getRestaurantNameForFile()}`, columnas);
    });
}

/**
 * Carga las variantes de una receta cuando se selecciona en el formulario de venta
 * Solo muestra el selector si la receta tiene variantes (ej: bebidas con copa/botella)
 */
export async function cargarVariantesVenta(recetaId) {
    console.log('🍷 cargarVariantesVenta llamada con recetaId:', recetaId);

    const container = document.getElementById('venta-variante-container');
    const select = document.getElementById('venta-variante');

    console.log('🍷 Container:', container, 'Select:', select);

    if (!container || !select) {
        console.warn('🍷 Container o select no encontrados');
        return;
    }

    // Si no hay receta seleccionada, ocultar
    if (!recetaId) {
        container.style.display = 'none';
        select.innerHTML = '<option value="">Sin variante (unidad completa)</option>';
        return;
    }

    try {
        // Obtener variantes de la receta desde API
        console.log('🍷 Fetching variants from API...');
        const apiFunc = window.API?.fetch || window.api?.fetch;
        if (!apiFunc) {
            console.error('🍷 API.fetch no disponible');
            return;
        }

        const variantes = await apiFunc(`/api/recipes/${recetaId}/variants`);
        console.log('🍷 Variantes recibidas:', variantes);

        if (!Array.isArray(variantes) || variantes.length === 0) {
            console.log('🍷 Sin variantes, ocultando selector');
            container.style.display = 'none';
            select.innerHTML = '<option value="">Sin variante (unidad completa)</option>';
            return;
        }

        // Mostrar selector y poblar opciones
        console.log('🍷 Mostrando selector con', variantes.length, 'variantes');
        container.style.display = 'block';
        let html = '<option value="">Sin variante (unidad completa)</option>';
        variantes.forEach(v => {
            html += `<option value="${v.id}" data-factor="${v.factor}" data-precio="${v.precio_venta}">
                ${escapeHTML(v.nombre)} - ${parseFloat(v.precio_venta).toFixed(2)}€ (${v.factor}x)
            </option>`;
        });
        select.innerHTML = html;
    } catch (error) {
        console.error('🍷 Error cargando variantes:', error);
        container.style.display = 'none';
    }
}

// Exponer globalmente
window.cargarVariantesVenta = cargarVariantesVenta;
