import { escapeHTML, cm } from '../../utils/helpers.js';
import { calculateIngredientCost, getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { FOOD_COST_THRESHOLDS } from '../../utils/food-cost-thresholds.js';
import { t } from '@/i18n/index.js';
/**
 * Recetas UI Module
 * Funciones de interfaz de usuario para recetas
 * 
 * SEGURIDAD: Usa escapeHTML para prevenir XSS en datos de usuario
 */

/**
 * Escapa texto plano para uso en HTML (previene XSS)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto seguro para HTML
 */
/**
 * Muestra el formulario de nueva receta
 */
export function mostrarFormularioReceta() {
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];
    if (ingredientes.length === 0) {
        window.showToast(t('recetas:need_ingredients_first'), 'warning');
        window.cambiarTab('ingredientes');
        if (typeof window.mostrarFormularioIngrediente === 'function') {
            window.mostrarFormularioIngrediente();
        }
        return;
    }
    document.getElementById('formulario-receta').style.display = 'block';
    window.agregarIngredienteReceta();
    document.getElementById('rec-nombre').focus();
}

/**
 * Cierra el formulario de receta y resetea campos
 */
export function cerrarFormularioReceta() {
    document.getElementById('formulario-receta').style.display = 'none';
    document.querySelector('#formulario-receta form').reset();
    document.getElementById('lista-ingredientes-receta').innerHTML = '';
    document.getElementById('coste-calculado-form').style.display = 'none';
    window.editandoRecetaId = null;

    // Limpiar campos del formulario
    document.getElementById('rec-nombre').value = '';
    document.getElementById('rec-codigo').value = '';
    document.getElementById('rec-categoria').value = 'alimentos';
    document.getElementById('rec-precio_venta').value = '';
    document.getElementById('rec-porciones').value = '1';
    document.getElementById('lista-ingredientes-receta').innerHTML = '';
    document.getElementById('form-title-receta').textContent = t('recetas:form_title_new');
    document.getElementById('btn-text-receta').textContent = t('recetas:btn_save');
}

/**
 * Agrega una fila de ingrediente en el formulario de receta
 * 🧪 ACTUALIZADO: Incluye recetas base como ingredientes seleccionables
 */
export function agregarIngredienteReceta() {
    const lista = document.getElementById('lista-ingredientes-receta');
    const item = document.createElement('div');
    item.className = 'ingrediente-item';

    // Estilos profesionales mejorados
    item.style.cssText = `
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
        padding: 16px;
        background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        border-left: 4px solid #7c3aed;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        transition: all 0.2s ease;
    `;

    // Hover effect via JavaScript
    item.onmouseenter = () => {
        item.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.15)';
        item.style.borderLeftColor = '#a855f7';
    };
    item.onmouseleave = () => {
        item.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.04)';
        item.style.borderLeftColor = '#7c3aed';
    };

    // Ordenar ingredientes alfabéticamente
    const ingredientesOrdenados = [...(window.ingredientes || [])].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );

    let optionsHtml = `<option value="">${t('recetas:select_ingredient')}</option>`;

    // Ingredientes normales
    ingredientesOrdenados.forEach(ing => {
        const precio = parseFloat(ing.precio || 0).toFixed(2);
        const unidad = ing.unidad || 'ud';
        optionsHtml += `<option value="${ing.id}">${escapeHTML(ing.nombre)} (${cm(precio)}/${escapeHTML(unidad)})</option>`;
    });

    // 🧪 Añadir recetas base como ingredientes seleccionables
    const recetasBase = (window.recetas || []).filter(r =>
        r.categoria?.toLowerCase() === 'base' || r.categoria?.toLowerCase() === 'preparación base'
    );

    if (recetasBase.length > 0) {
        optionsHtml += '<option disabled>── Preparaciones Base ──</option>';
        recetasBase.forEach(rec => {
            // Calcular coste de la receta base
            const coste = window.calcularCosteRecetaCompleto ?
                window.calcularCosteRecetaCompleto(rec) : 0;
            // Usar ID negativo para distinguir de ingredientes normales
            optionsHtml += `<option value="rec_${rec.id}" data-es-receta="true">🧪 ${escapeHTML(rec.nombre)} (${cm(coste)})</option>`;
        });
    }

    item.innerHTML = `
        <div style="flex: 2; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px; pointer-events: none;">🥬</span>
            <select style="
                width: 100%;
                padding: 12px 12px 12px 40px;
                border: 2px solid #e2e8f0;
                border-radius: 10px;
                font-size: 14px;
                background: white;
                cursor: pointer;
                transition: border-color 0.2s;
                appearance: none;
                background-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%236b7280%22><path d=%22M7 10l5 5 5-5z%22/></svg>');
                background-repeat: no-repeat;
                background-position: right 12px center;
                background-size: 20px;
            " onfocus="this.style.borderColor='#7c3aed'" onblur="this.style.borderColor='#e2e8f0'" 
            onchange="
                const ingId = parseInt(this.value);
                const ing = (window.ingredientes || []).find(i => i.id === ingId);
                const row = this.closest('.ingrediente-item');
                const rendInput = row.querySelector('.receta-rendimiento');
                if (ing && rendInput) {
                    rendInput.value = ing.rendimiento !== undefined && ing.rendimiento !== null ? ing.rendimiento : 100;
                }
                window.calcularCosteReceta();
            ">
                ${optionsHtml}
            </select>
        </div>
        <div style="flex: 1.5; position: relative;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #94a3b8; pointer-events: none;">📏</span>
            <input type="number" step="0.001" min="0" placeholder="${t('recetas:placeholder_quantity')}"
                class="receta-cantidad"
                style="width: 100%; padding: 12px 12px 12px 35px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px;" 
                onchange="window.calcularCosteReceta()">
        </div>
        
        <!-- MERMA / RENDIMIENTO EN RECETA -->
        <div style="flex: 1; position: relative;" title="% Rendimiento (Merma)">
            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #64748b; pointer-events: none;">%</span>
            <input type="number" step="1" min="1" max="100" placeholder="${t('recetas:placeholder_yield')}" value="100"
                class="receta-rendimiento"
                style="width: 100%; padding: 12px 8px 12px 25px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #fffbeb;" 
                onchange="window.calcularCosteReceta()">
        </div>
        <span class="receta-coste-linea" title="Coste de este ingrediente (cantidad × precio / rendimiento)" style="
            min-width: 72px;
            text-align: right;
            font-weight: 700;
            font-size: 13px;
            color: #059669;
            background: #ecfdf5;
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid #a7f3d0;
            white-space: nowrap;
        ">—</span>
        <button type="button" onclick="this.parentElement.remove(); window.calcularCosteReceta();"
            style="
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
                border: none;
                padding: 12px 14px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s;
                box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
            " onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">
            ✕
        </button>
    `;

    lista.appendChild(item);
}

/**
 * Calcula el coste total de la receta desde ingredientes seleccionados
 * 💰 ACTUALIZADO: Usa precio_medio del inventario (basado en compras)
 * 🧪 ACTUALIZADO: Soporta recetas base como ingredientes
 */
export function calcularCosteReceta() {
    const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
    let costeTotalLote = 0;
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];
    const inventario = Array.isArray(window.inventarioCompleto) ? window.inventarioCompleto : [];
    const recetas = Array.isArray(window.recetas) ? window.recetas : [];

    // ⚡ OPTIMIZACIÓN: Crear Maps O(1) una vez, no .find() O(n) por cada item
    const inventarioMap = new Map(inventario.map(i => [i.id, i]));
    const ingredientesMap = new Map(ingredientes.map(i => [i.id, i]));
    const recetasMap = new Map(recetas.map(r => [r.id, r]));

    items.forEach(item => {
        const select = item.querySelector('select');
        const input = item.querySelector('input');
        // 🆕 Span para mostrar el coste de esta línea (cantidad × precio / rendimiento).
        // Se actualiza siempre, incluso cuando la fila no tiene datos válidos (pone "—").
        const costeLineaSpan = item.querySelector('.receta-coste-linea');
        let costeLinea = 0;

        if (select.value && input.value) {
            const cantidad = parseFloat(input.value || 0);

            // 🧪 Detectar si es una receta base (valor empieza con "rec_")
            if (select.value.startsWith('rec_')) {
                const recetaId = parseInt(select.value.replace('rec_', ''));
                const recetaBase = recetasMap.get(recetaId);
                if (recetaBase && window.calcularCosteRecetaCompleto) {
                    // Calcular coste de la receta base
                    const costeRecetaBase = window.calcularCosteRecetaCompleto(recetaBase);
                    costeLinea = costeRecetaBase * cantidad;
                    costeTotalLote += costeLinea;
                }
            } else {
                // Ingrediente normal
                const ingId = parseInt(select.value);
                // ⚡ Búsqueda O(1) con Maps
                const invItem = inventarioMap.get(ingId);
                const ing = ingredientesMap.get(ingId);

                // 💰 Precio unitario: función centralizada (precio_medio_compra > precio_medio > precio/cpf)
                const precio = getIngredientUnitPrice(invItem, ing);

                // 🆕 CÁLCULO CON MERMA/RENDIMIENTO (refactorizado a utilidad pura)
                const inputRendimiento = item.querySelector('.receta-rendimiento');
                const rendimiento = inputRendimiento ? parseFloat(inputRendimiento.value) || 100 : 100;

                // Usar la función "anclada" para el cálculo
                costeLinea = calculateIngredientCost(precio, cantidad, rendimiento);
                costeTotalLote += costeLinea;
            }
        }

        // Actualizar el span de coste de la linea (vacio si no hay datos)
        if (costeLineaSpan) {
            costeLineaSpan.textContent = costeLinea > 0 ? cm(costeLinea) : '—';
        }
    });

    // 🔧 FIX: Dividir por porciones para obtener coste POR PORCIÓN
    const porciones = parseInt(document.getElementById('rec-porciones')?.value || 1) || 1;
    const costeTotal = costeTotalLote / porciones;

    const costeDiv = document.getElementById('coste-calculado-form');
    if (costeDiv) {
        costeDiv.style.display = costeTotal > 0 ? 'block' : 'none';
        const costeSpan = document.getElementById('coste-receta-valor');
        if (costeSpan) costeSpan.textContent = cm(costeTotal);

        const precioVenta = parseFloat(document.getElementById('rec-precio_venta')?.value || 0);
        const margenSpan = document.getElementById('margen-receta-valor');
        const foodCostSpan = document.getElementById('foodcost-receta-valor');

        if (precioVenta > 0) {
            const margen = ((precioVenta - costeTotal) / precioVenta) * 100;
            const foodCost = (costeTotal / precioVenta) * 100;

            // Umbrales unificados 30/35/40 (ver utils/food-cost-thresholds.js y CLAUDE.md).
            // Sobre fondo verde: verde claro = excelente, blanco = target, amarillo = watch, rojo = alert.
            const { EXCELLENT_MAX, TARGET_MAX, WATCH_MAX } = FOOD_COST_THRESHOLDS;
            const getColor = fc => (fc <= EXCELLENT_MAX ? '#bbf7d0' : fc <= TARGET_MAX ? '#ffffff' : fc <= WATCH_MAX ? '#fde047' : '#fca5a5');

            // Actualizar Margen
            if (margenSpan) {
                margenSpan.textContent = margen.toFixed(1) + '%';
                margenSpan.style.color = getColor(foodCost);
            }

            // Actualizar Food Cost
            if (foodCostSpan) {
                foodCostSpan.textContent = foodCost.toFixed(1) + '%';
                foodCostSpan.style.color = getColor(foodCost);
            }
        }
    }

    // Sync price simulator if visible
    actualizarPrecioSugerido();

    return costeTotal;
}

/**
 * Renderiza la tabla de recetas
 */
// Variable para almacenar el filtro de categoría activo
let filtroRecetaCategoria = 'todas';

// Variable para la página actual de recetas
let paginaRecetasActual = 1;

// Función para cambiar de página
window.cambiarPaginaRecetas = function (delta) {
    paginaRecetasActual += delta;
    renderizarRecetas();
    // Scroll al inicio de la tabla
    document.getElementById('tabla-recetas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
window.filtrarRecetasPorCategoria = function (categoria) {
    filtroRecetaCategoria = categoria;
    paginaRecetasActual = 1; // Reset a página 1 al cambiar filtro

    // Actualizar estilos de botones
    const botones = document.querySelectorAll('#filtros-recetas .filter-btn');
    botones.forEach(btn => {
        const btnCategoria = btn.dataset.filter;
        if (btnCategoria === categoria) {
            btn.classList.add('active');
            btn.style.background = btnCategoria === 'todas' ? '#f1f5f9' :
                btnCategoria === 'alimentos' ? '#22c55e' :
                    btnCategoria === 'base' ? '#7c3aed' : '#3b82f6';
            btn.style.color = btnCategoria === 'todas' ? '#475569' : 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'white';
            btn.style.color = btnCategoria === 'alimentos' ? '#22c55e' :
                btnCategoria === 'bebida' ? '#3b82f6' :
                    btnCategoria === 'base' ? '#7c3aed' : '#475569';
        }
    });

    renderizarRecetas();
};

export async function renderizarRecetas() {
    // 🍷 Cargar variantes si no están cargadas (para mostrar códigos TPV)
    if (!Array.isArray(window.recetasVariantes) && window.API?.fetch) {
        try {
            const result = await window.API.fetch('/api/recipes-variants');
            window.recetasVariantes = Array.isArray(result) ? result : [];
        } catch (e) {
            console.warn('No se pudieron cargar variantes:', e);
            window.recetasVariantes = [];
        }
    }

    const busquedaEl = document.getElementById('busqueda-recetas');
    const busqueda = busquedaEl?.value?.toLowerCase() || '';
    const recetas = Array.isArray(window.recetas) ? window.recetas : [];

    const filtradas = recetas.filter(r => {
        // Filtro de búsqueda
        const matchBusqueda = r.nombre.toLowerCase().includes(busqueda) ||
            (r.codigo && r.codigo.toString().includes(busqueda));

        // Filtro de categoría
        const matchCategoria = filtroRecetaCategoria === 'todas' ||
            r.categoria?.toLowerCase() === filtroRecetaCategoria.toLowerCase() ||
            (filtroRecetaCategoria === 'bebida' && r.categoria?.toLowerCase() === 'bebidas') ||
            (filtroRecetaCategoria === 'alimentos' && r.categoria?.toLowerCase() === 'alimentos') ||
            (filtroRecetaCategoria === 'base' && r.categoria?.toLowerCase() === 'base');

        return matchBusqueda && matchCategoria;
    }).sort((a, b) => {
        // Ordenar: con código primero, luego alfabético
        // Verificar null/undefined ANTES de convertir a string
        // eslint-disable-next-line eqeqeq -- intentional: != null checks both null and undefined
        const aHasCodigo = a.codigo != null && String(a.codigo).trim() !== '';
        // eslint-disable-next-line eqeqeq -- intentional: != null checks both null and undefined
        const bHasCodigo = b.codigo != null && String(b.codigo).trim() !== '';

        if (aHasCodigo && !bHasCodigo) return -1;
        if (!aHasCodigo && bHasCodigo) return 1;

        // Si ambos tienen código, ordenar por código
        if (aHasCodigo && bHasCodigo) {
            return String(a.codigo).localeCompare(String(b.codigo));
        }

        // Si ninguno tiene código, ordenar por nombre
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });

    const container = document.getElementById('tabla-recetas');
    if (!container) return;

    // === PAGINACIÓN ===
    const ITEMS_PER_PAGE = 25;
    const totalItems = filtradas.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

    // Asegurar página válida
    if (paginaRecetasActual > totalPages) paginaRecetasActual = totalPages;
    if (paginaRecetasActual < 1) paginaRecetasActual = 1;

    const startIndex = (paginaRecetasActual - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const recetasPagina = filtradas.slice(startIndex, endIndex);

    if (filtradas.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">👨‍🍳</div>
        <h3>${busqueda || filtroRecetaCategoria !== 'todas' ? t('recetas:empty_not_found') : t('recetas:empty_none_yet')}</h3>
      </div>
    `;
        document.getElementById('resumen-recetas').style.display = 'none';
    } else {
        let html = '<table><thead><tr>';
        html +=
            `<th>${t('recetas:export_col_code')}</th><th>${t('recetas:export_col_name')}</th><th>${t('recetas:export_col_category')}</th><th>${t('recetas:escandallo_cost')}</th><th>${t('recetas:export_col_sale_price')}</th><th>${t('recetas:escandallo_margin')}</th><th>${t('ingredientes:col_actions')}</th>`;
        html += '</tr></thead><tbody>';

        recetasPagina.forEach(rec => {
            const coste = window.calcularCosteRecetaCompleto(rec);
            const margen = rec.precio_venta - coste;
            const pct = rec.precio_venta > 0 ? ((margen / rec.precio_venta) * 100).toFixed(0) : 0;
            const foodCost = rec.precio_venta > 0 ? (coste / rec.precio_venta) * 100 : 100;
            // Badge basado en Food Cost: ≤35% success, ≤40% warning, >40% danger
            const badgeClass =
                foodCost <= 35
                    ? 'badge-success'
                    : foodCost <= 40
                        ? 'badge-warning'
                        : 'badge-danger';

            // 🍷 Para bebidas, buscar código de la variante BOTELLA
            let codigoMostrar = rec.codigo || '';
            if ((rec.categoria?.toLowerCase() === 'bebidas' || rec.categoria?.toLowerCase() === 'bebida') && Array.isArray(window.recetasVariantes)) {
                const varianteBotella = window.recetasVariantes.find(v =>
                    v.receta_id === rec.id && v.nombre?.toUpperCase() === 'BOTELLA'
                );
                if (varianteBotella?.codigo) {
                    codigoMostrar = varianteBotella.codigo;
                }
            }

            html += '<tr>';
            html += `<td><span style="color:#666;font-size:12px;">${escapeHTML(codigoMostrar || '-')}</span></td>`;
            html += `<td><strong>${escapeHTML(rec.nombre)}</strong></td>`;
            const categoriaLower = (rec.categoria || 'alimentos').toLowerCase();
            const esBebida = categoriaLower === 'bebida' || categoriaLower === 'bebidas';
            const esBase = categoriaLower === 'base';
            const categoriaBadge = esBase ? 'badge-purple' : esBebida ? 'badge-info' : 'badge-success';
            html += `<td><span class="badge ${categoriaBadge}">${escapeHTML(rec.categoria)}</span></td>`;
            html += `<td>${cm(coste)}</td>`;
            html += `<td>${cm(rec.precio_venta || 0)}</td>`;
            html += `<td><span class="badge ${badgeClass}">${cm(margen)} (${pct}%)</span></td>`;
            html += `<td><div class="actions">`;
            html += `<button class="icon-btn view" onclick="window.verEscandallo(${rec.id})" title="${t('recetas:btn_view_escandallo')}">📊</button>`;
            // Botón de variantes solo para bebidas (botella/copa)
            if (rec.categoria?.toLowerCase() === 'bebidas' || rec.categoria?.toLowerCase() === 'bebida') {
                html += `<button class="icon-btn" onclick="window.gestionarVariantesReceta(${rec.id})" title="${t('recetas:btn_variants')}" style="color: #7C3AED;">🍷</button>`;
            }
            html += `<button class="icon-btn produce" onclick="window.abrirModalProducir(${rec.id})">⬇️</button>`;
            html += `<button class="icon-btn edit" onclick="window.editarReceta(${rec.id})">✏️</button>`;
            html += `<button class="icon-btn delete" onclick="window.eliminarReceta(${rec.id})">🗑️</button>`;
            html += '</div></td>';

            html += '</tr>';
        });

        html += '</tbody></table>';

        // === CONTROLES DE PAGINACIÓN ===
        html += `
        <div style="display: flex; justify-content: center; align-items: center; gap: 16px; padding: 20px 0; border-top: 1px solid #e2e8f0; margin-top: 16px;">
            <button onclick="window.cambiarPaginaRecetas(-1)" 
                ${paginaRecetasActual === 1 ? 'disabled' : ''} 
                style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${paginaRecetasActual === 1 ? '#f1f5f9' : 'white'}; color: ${paginaRecetasActual === 1 ? '#94a3b8' : '#475569'}; cursor: ${paginaRecetasActual === 1 ? 'not-allowed' : 'pointer'}; font-weight: 500;">
                ${t('recetas:pagination_prev')}
            </button>
            <span style="font-size: 14px; color: #475569;">
                <strong>${paginaRecetasActual}</strong> / <strong>${totalPages}</strong>
            </span>
            <button onclick="window.cambiarPaginaRecetas(1)" 
                ${paginaRecetasActual === totalPages ? 'disabled' : ''} 
                style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${paginaRecetasActual === totalPages ? '#f1f5f9' : 'white'}; color: ${paginaRecetasActual === totalPages ? '#94a3b8' : '#475569'}; cursor: ${paginaRecetasActual === totalPages ? 'not-allowed' : 'pointer'}; font-weight: 500;">
                ${t('recetas:pagination_next')}
            </button>
        </div>`;

        container.innerHTML = html;

        const resumenEl = document.getElementById('resumen-recetas');
        if (resumenEl) {
            resumenEl.innerHTML = `
              <div>${t('recetas:summary_total', { count: recetas.length })}</div>
              <div>${t('recetas:summary_filtered', { count: filtradas.length })}</div>
              <div>${t('recetas:summary_showing', { count: `${startIndex + 1}-${Math.min(endIndex, totalItems)}` })}</div>
              <button onclick="window.mostrarCostTracker()" style="margin-left: auto; background: linear-gradient(135deg, #7C3AED, #5B21B6); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                📊 ${t('recetas:btn_cost_tracking')}
              </button>
            `;
            resumenEl.style.display = 'flex';
        }
    }
}

/**
 * Exporta recetas a Excel
 */
export function exportarRecetas() {
    const recetas = Array.isArray(window.recetas) ? window.recetas : [];
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];

    // ⚡ OPTIMIZACIÓN: Crear Maps O(1) una vez
    const ingredientesMap = new Map(ingredientes.map(i => [i.id, i]));
    const inventarioMap = new Map((window.inventarioCompleto || []).map(inv => [inv.id, inv]));

    // Pre-calcular coste de cada receta UNA SOLA VEZ
    const costesCalculados = new Map();
    recetas.forEach(rec => {
        const porciones = parseInt(rec.porciones) || 1;
        const costeLote = (rec.ingredientes || []).reduce((sum, item) => {
            const ing = ingredientesMap.get(item.ingredienteId);
            if (!ing) return sum;

            // 💰 Precio unitario: función centralizada (precio_medio_compra > precio_medio > precio/cpf)
            const invItem = inventarioMap.get(item.ingredienteId);
            const precioUnitario = getIngredientUnitPrice(invItem, ing);

            // Rendimiento: priorizar el de la receta, fallback al ingrediente base
            let rendimiento = parseFloat(item.rendimiento);
            if (!rendimiento) {
                rendimiento = ing?.rendimiento ? parseFloat(ing.rendimiento) : 100;
            }
            const factorRendimiento = rendimiento / 100;
            const costeReal = factorRendimiento > 0 ? (precioUnitario / factorRendimiento) : precioUnitario;

            return sum + (costeReal * parseFloat(item.cantidad));
        }, 0);
        costesCalculados.set(rec.id, costeLote / porciones);
    });

    const columnas = [
        { header: 'ID', key: 'id' },
        { header: t('recetas:export_col_code'), value: rec => rec.codigo || `REC-${String(rec.id).padStart(4, '0')}` },
        { header: t('recetas:export_col_name'), key: 'nombre' },
        { header: t('recetas:export_col_category'), key: 'categoria' },
        { header: t('recetas:export_col_sale_price'), value: rec => parseFloat(rec.precio_venta || 0).toFixed(2) },
        {
            header: t('recetas:export_col_cost'),
            value: rec => costesCalculados.get(rec.id).toFixed(2),
        },
        {
            header: t('recetas:export_col_margin_eur'),
            value: rec => {
                const coste = costesCalculados.get(rec.id);
                return (parseFloat(rec.precio_venta || 0) - coste).toFixed(2);
            },
        },
        {
            header: t('recetas:export_col_margin_pct'),
            value: rec => {
                const coste = costesCalculados.get(rec.id);
                const margen =
                    rec.precio_venta > 0
                        ? ((parseFloat(rec.precio_venta) - coste) / parseFloat(rec.precio_venta)) *
                        100
                        : 0;
                return margen.toFixed(1) + '%';
            },
        },
        { header: t('recetas:export_col_servings'), key: 'porciones' },
        { header: t('recetas:export_col_num_ingredients'), value: rec => (rec.ingredientes || []).length },
    ];

    if (
        typeof window.exportarAExcel === 'function' &&
        typeof window.getRestaurantNameForFile === 'function'
    ) {
        window.exportarAExcel(recetas, `Recetas_${window.getRestaurantNameForFile()}`, columnas);
    }
}

/**
 * 🧮 Simulador de Precio: actualiza precio sugerido en tiempo real
 * Lee el coste actual del panel y el food cost deseado del slider/input.
 * Formula: precioSugerido = coste / (foodCostDeseado / 100)
 * 
 * NOTA: Esta función es ADDITIVE — no modifica calcularCosteReceta ni ningún estado existente.
 */
export function actualizarPrecioSugerido() {
    const slider = document.getElementById('simulador-foodcost-slider');
    const input = document.getElementById('simulador-foodcost-input');
    const precioSpan = document.getElementById('precio-sugerido-valor');
    if (!slider || !input || !precioSpan) return;

    // Sync slider ↔ input (determine which one triggered the event)
    const activeEl = document.activeElement;
    if (activeEl === slider) {
        input.value = slider.value;
    } else if (activeEl === input) {
        // Clamp input value to valid range for the slider
        const val = Math.min(99, Math.max(1, parseInt(input.value) || 30));
        slider.value = Math.min(60, Math.max(20, val));
    }

    const foodCostDeseado = parseFloat(input.value) || 30;

    // Read current cost from the panel (already calculated by calcularCosteReceta)
    const costeText = document.getElementById('coste-receta-valor')?.textContent || '0';
    const coste = parseFloat(costeText.replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;

    if (coste <= 0 || foodCostDeseado <= 0) {
        precioSpan.textContent = '—';
        return;
    }

    const precioSugerido = coste / (foodCostDeseado / 100);
    precioSpan.textContent = cm(precioSugerido);
}

/**
 * 🧮 Aplica el precio sugerido al campo rec-precio_venta
 * y recalcula food cost + margen automáticamente.
 */
export function aplicarPrecioSugerido() {
    const precioText = document.getElementById('precio-sugerido-valor')?.textContent || '';
    const precio = parseFloat(precioText.replace(/[^0-9.,-]/g, '').replace(',', '.'));

    if (!precio || precio <= 0) return;

    const precioInput = document.getElementById('rec-precio_venta');
    if (precioInput) {
        precioInput.value = precio.toFixed(2);
        // Trigger recalculation of food cost and margin
        window.calcularCosteReceta?.();
    }
}
