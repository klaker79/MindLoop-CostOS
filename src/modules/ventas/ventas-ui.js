import { escapeHTML, cm, getDateLocale } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';
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
                return `<option value="${r.id}" data-search="${escapeHTML(r.nombre.toLowerCase())}">${escapeHTML(r.nombre)} - ${cm(precio)}</option>`;
            }).join('');
            select.innerHTML = `<option value="">${t('ventas:placeholder_select_dish')}</option>` + options;
        }

        // Añadir buscador si no existe
        const searchInput = document.getElementById('busqueda-venta-receta');
        if (!searchInput && select) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'busqueda-venta-receta';
            input.placeholder = `🔍 ${t('ventas:placeholder_search_dish')}`;
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
          <h3>${t('ventas:empty_none_yet')}</h3>
        </div>
      `;
            return;
        }

        // 🔒 Auditoría Capa 7 (S9 / A5-M6): la KEY de agrupamiento usa ISO YYYY-MM-DD
        // (estable entre tenants/locales). Antes usaba `toLocaleDateString('es-ES')` que
        // colapsaba mal cuando dos sesiones distintas pintaban el mismo día con locale
        // distinto. El display sigue formateado al locale del usuario.
        const dateLocale = getDateLocale();
        const ventasPorFecha = {};
        const fechaISO = {}; // Mapa: ISO date → ISO timestamp (para sort y display)
        ventas.forEach(v => {
            const dateObj = new Date(v.fecha);
            const isoKey = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD estable
            if (!ventasPorFecha[isoKey]) {
                ventasPorFecha[isoKey] = [];
                fechaISO[isoKey] = v.fecha;
            }
            ventasPorFecha[isoKey].push(v);
        });

        let html = '<table style="width:100%;border-collapse:collapse;"><tbody>';

        // 🔒 P0-4 FIX: Ordenar por fecha ISO original, no por DD/MM/YYYY string
        Object.keys(ventasPorFecha)
            .sort((a, b) => new Date(fechaISO[b]) - new Date(fechaISO[a]))
            .forEach(isoKey => {
                const ventasDia = ventasPorFecha[isoKey];
                const totalDia = ventasDia.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
                const fechaDisplay = new Date(fechaISO[isoKey]).toLocaleDateString(dateLocale);

                html += `<tr style="background:#F8FAFC;"><td colspan="6" style="padding:12px 16px;font-weight:600;color:#1E293B;border-bottom:1px solid #E2E8F0;">${fechaDisplay} - ${t('common:label_total')}: ${cm(totalDia)}</td></tr>`;

                ventasDia.forEach(v => {
                    const hora = new Date(v.fecha).toLocaleTimeString(dateLocale, {
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                    html += `<tr><td style="padding:8px 16px 8px 32px;color:#64748B;">${fechaDisplay}</td><td style="padding:8px 16px;color:#64748B;">${hora}</td><td style="padding:8px 16px;color:#1E293B;">${escapeHTML(v.receta_nombre || '')}</td><td style="padding:8px 16px;text-align:center;color:#64748B;">${v.cantidad}</td><td style="padding:8px 16px;text-align:right;"><strong style="color:#1E293B;">${cm(parseFloat(v.total))}</strong></td><td style="padding:8px 16px;text-align:center;"><button class="icon-btn delete" onclick="window.eliminarVenta(${v.id})" title="${t('common:btn_delete')}">🗑️</button></td></tr>`;
                });
            });

        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error renderizando ventas:', error);
        window.showToast(t('ventas:error_loading'), 'error');
    }
}

/**
 * Exporta ventas a Excel
 */
export function exportarVentas() {
    window.api.getSales().then(ventas => {
        const columnas = [
            { header: 'ID', key: 'id' },
            // 🔒 Auditoría Capa 7 (S9): locale dinámico también en exports
            { header: t('ventas:col_date'), value: v => new Date(v.fecha).toLocaleDateString(getDateLocale()) },
            {
                header: t('ventas:col_time'),
                value: v =>
                    new Date(v.fecha).toLocaleTimeString(getDateLocale(), {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
            },
            {
                header: t('ventas:col_recipe_code'),
                value: v => {
                    const rec = (window.recetas || []).find(r => r.id === v.receta_id);
                    return rec?.codigo || `REC-${String(v.receta_id).padStart(4, '0')}`;
                },
            },
            {
                header: t('ventas:col_description'),
                value: v =>
                    v.receta_nombre ||
                    (window.recetas || []).find(r => r.id === v.receta_id)?.nombre ||
                    t('ventas:unknown_recipe'),
            },
            { header: t('ventas:col_quantity'), key: 'cantidad' },
            {
                header: t('ventas:col_unit_price_eur'),
                value: v => parseFloat(v.precio_unitario || 0).toFixed(2),
            },
            { header: t('ventas:col_total_eur'), value: v => parseFloat(v.total || 0).toFixed(2) },
        ];

        window.exportarAExcel(ventas, `${t('ventas:export_filename')}_${window.getRestaurantNameForFile()}`, columnas);
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
        select.innerHTML = `<option value="">${t('ventas:no_variant')}</option>`;
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
            select.innerHTML = `<option value="">${t('ventas:no_variant')}</option>`;
            return;
        }

        // Mostrar selector y poblar opciones.
        // 🔒 Si la receta TIENE variantes, NO ofrecemos la opción vacía "Sin variante":
        // durante 90 días (enero-abril 2026) 274 ventas de vinos se guardaron con
        // factor=1 (botella entera) porque el personal dejaba el dropdown en la
        // opción vacía por defecto. Forzar seleccionar una variante real elimina
        // esa fuga. Auto-seleccionamos la de MENOR factor (ej: copa 0.2) como
        // default conservador: descontar menos stock por error > descontar más.
        console.log('🍷 Mostrando selector con', variantes.length, 'variantes');
        container.style.display = 'block';
        const variantesOrdenadas = [...variantes].sort(
            (a, b) => (parseFloat(a.factor) || 1) - (parseFloat(b.factor) || 1)
        );
        let html = '';
        variantesOrdenadas.forEach(v => {
            html += `<option value="${v.id}" data-factor="${v.factor}" data-precio="${v.precio_venta}">
                ${escapeHTML(v.nombre)} - ${cm(parseFloat(v.precio_venta))} (${v.factor}x)
            </option>`;
        });
        select.innerHTML = html;
        // Auto-selección: primera (menor factor). Si el usuario quiere otra, clickea.
        if (variantesOrdenadas[0]) select.value = String(variantesOrdenadas[0].id);
    } catch (error) {
        console.error('🍷 Error cargando variantes:', error);
        container.style.display = 'none';
    }
}

// Exponer globalmente
window.cargarVariantesVenta = cargarVariantesVenta;
