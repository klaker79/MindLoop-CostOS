import { escapeHTML } from '../../utils/helpers.js';
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
        window.showToast('Primero añade ingredientes', 'warning');
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
    document.getElementById('form-title-receta').textContent = 'Nueva Receta';
    document.getElementById('btn-text-receta').textContent = 'Guardar';
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

    let optionsHtml = '<option value="">Selecciona ingrediente...</option>';

    // Ingredientes normales
    ingredientesOrdenados.forEach(ing => {
        const precio = parseFloat(ing.precio || 0).toFixed(2);
        const unidad = ing.unidad || 'ud';
        optionsHtml += `<option value="${ing.id}">${escapeHTML(ing.nombre)} (${precio}€/${escapeHTML(unidad)})</option>`;
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
            optionsHtml += `<option value="rec_${rec.id}" data-es-receta="true">🧪 ${escapeHTML(rec.nombre)} (${coste.toFixed(2)}€)</option>`;
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
            <input type="number" step="0.001" min="0" placeholder="Cantidad" 
                class="receta-cantidad"
                style="width: 100%; padding: 12px 12px 12px 35px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px;" 
                onchange="window.calcularCosteReceta()">
        </div>
        
        <!-- MERMA / RENDIMIENTO EN RECETA -->
        <div style="flex: 1; position: relative;" title="% Rendimiento (Merma)">
            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #64748b; pointer-events: none;">%</span>
            <input type="number" step="1" min="1" max="100" placeholder="Rend." value="100"
                class="receta-rendimiento"
                style="width: 100%; padding: 12px 8px 12px 25px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; background: #fffbeb;" 
                onchange="window.calcularCosteReceta()">
        </div>
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
        if (select.value && input.value) {
            const cantidad = parseFloat(input.value || 0);

            // 🧪 Detectar si es una receta base (valor empieza con "rec_")
            if (select.value.startsWith('rec_')) {
                const recetaId = parseInt(select.value.replace('rec_', ''));
                const recetaBase = recetasMap.get(recetaId);
                if (recetaBase && window.calcularCosteRecetaCompleto) {
                    // Calcular coste de la receta base
                    const costeRecetaBase = window.calcularCosteRecetaCompleto(recetaBase);
                    costeTotalLote += costeRecetaBase * cantidad;
                }
            } else {
                // Ingrediente normal
                const ingId = parseInt(select.value);
                // ⚡ Búsqueda O(1) con Maps
                const invItem = inventarioMap.get(ingId);
                const ing = ingredientesMap.get(ingId);

                // Prioridad: precio_medio del inventario (WAP) > precio fijo / cantidad_por_formato
                let precio = 0;
                if (invItem?.precio_medio) {
                    // ✅ PRIMARIO: Usar precio medio del inventario (media de compras)
                    precio = parseFloat(invItem.precio_medio);
                } else if (ing?.precio) {
                    // ⚠️ FALLBACK: precio del formato / cantidad_por_formato
                    const precioFormato = parseFloat(ing.precio);
                    const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;
                    precio = precioFormato / cantidadPorFormato;
                }

                // 🆕 CÁLCULO CON MERMA/RENDIMIENTO
                // Si rendimiento es 80%, el coste aumenta (se divide por 0.8)
                const inputRendimiento = item.querySelector('.receta-rendimiento');
                const rendimiento = inputRendimiento ? parseFloat(inputRendimiento.value) || 100 : 100;
                const factorRendimiento = rendimiento / 100;

                // Evitar división por cero
                const costeReal = factorRendimiento > 0 ? (precio / factorRendimiento) : precio;

                costeTotalLote += costeReal * cantidad;
            }
        }
    });

    // 🔧 FIX: Dividir por porciones para obtener coste POR PORCIÓN
    const porciones = parseInt(document.getElementById('rec-porciones')?.value || 1) || 1;
    const costeTotal = costeTotalLote / porciones;

    const costeDiv = document.getElementById('coste-calculado-form');
    if (costeDiv) {
        costeDiv.style.display = costeTotal > 0 ? 'block' : 'none';
        const costeSpan = document.getElementById('coste-receta-valor');
        if (costeSpan) costeSpan.textContent = costeTotal.toFixed(2) + '€';

        const precioVenta = parseFloat(document.getElementById('rec-precio_venta')?.value || 0);
        const margenSpan = document.getElementById('margen-receta-valor');
        const foodCostSpan = document.getElementById('foodcost-receta-valor');

        if (precioVenta > 0) {
            const margen = ((precioVenta - costeTotal) / precioVenta) * 100;
            const foodCost = (costeTotal / precioVenta) * 100;

            // Colores visibles sobre fondo verde: blanco = bueno, amarillo = ajustado, rojo = malo
            const getColor = fc => (fc <= 33 ? '#ffffff' : fc <= 38 ? '#fde047' : '#fca5a5');

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
    if (!window.recetasVariantes && window.API?.fetch) {
        try {
            window.recetasVariantes = await window.API.fetch('/api/recipes-variants');
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
        const aHasCodigo = a.codigo != null && String(a.codigo).trim() !== '';
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
        <h3>${busqueda || filtroRecetaCategoria !== 'todas' ? 'No encontradas' : 'Aún no hay recetas'}</h3>
      </div>
    `;
        document.getElementById('resumen-recetas').style.display = 'none';
    } else {
        let html = '<table><thead><tr>';
        html +=
            '<th>Cód.</th><th>Plato</th><th>Categoría</th><th>Coste</th><th>Precio</th><th>Margen</th><th>Acciones</th>';
        html += '</tr></thead><tbody>';

        recetasPagina.forEach(rec => {
            const coste = window.calcularCosteRecetaCompleto(rec);
            const margen = rec.precio_venta - coste;
            const pct = rec.precio_venta > 0 ? ((margen / rec.precio_venta) * 100).toFixed(0) : 0;
            const foodCost = rec.precio_venta > 0 ? (coste / rec.precio_venta) * 100 : 100;
            // Badge basado en Food Cost: ≤33% success, ≤38% warning, >38% danger
            const badgeClass =
                foodCost <= 33
                    ? 'badge-success'
                    : foodCost <= 38
                        ? 'badge-warning'
                        : 'badge-danger';

            // 🍷 Para bebidas, buscar código de la variante BOTELLA
            let codigoMostrar = rec.codigo || '';
            if ((rec.categoria?.toLowerCase() === 'bebidas' || rec.categoria?.toLowerCase() === 'bebida') && window.recetasVariantes) {
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
            html += `<td>${coste.toFixed(2)} €</td>`;
            html += `<td>${rec.precio_venta ? parseFloat(rec.precio_venta).toFixed(2) : '0.00'} €</td>`;
            html += `<td><span class="badge ${badgeClass}">${margen.toFixed(2)} € (${pct}%)</span></td>`;
            html += `<td><div class="actions">`;
            html += `<button class="icon-btn view" onclick="window.verEscandallo(${rec.id})" title="Ver Escandallo">📊</button>`;
            // Botón de variantes solo para bebidas (botella/copa)
            if (rec.categoria?.toLowerCase() === 'bebidas' || rec.categoria?.toLowerCase() === 'bebida') {
                html += `<button class="icon-btn" onclick="window.gestionarVariantesReceta(${rec.id})" title="Variantes (Botella/Copa)" style="color: #7C3AED;">🍷</button>`;
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
                ← Anterior
            </button>
            <span style="font-size: 14px; color: #475569;">
                Página <strong>${paginaRecetasActual}</strong> de <strong>${totalPages}</strong>
            </span>
            <button onclick="window.cambiarPaginaRecetas(1)" 
                ${paginaRecetasActual === totalPages ? 'disabled' : ''} 
                style="padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${paginaRecetasActual === totalPages ? '#f1f5f9' : 'white'}; color: ${paginaRecetasActual === totalPages ? '#94a3b8' : '#475569'}; cursor: ${paginaRecetasActual === totalPages ? 'not-allowed' : 'pointer'}; font-weight: 500;">
                Siguiente →
            </button>
        </div>`;

        container.innerHTML = html;

        const resumenEl = document.getElementById('resumen-recetas');
        if (resumenEl) {
            resumenEl.innerHTML = `
              <div>Total: <strong>${recetas.length}</strong></div>
              <div>Filtradas: <strong>${filtradas.length}</strong></div>
              <div>Mostrando: <strong>${startIndex + 1}-${Math.min(endIndex, totalItems)}</strong></div>
              <button onclick="window.mostrarCostTracker()" style="margin-left: auto; background: linear-gradient(135deg, #7C3AED, #5B21B6); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                📊 Seguimiento de Costes
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
    const inventarioMap = new Map((window.inventarioCompleto || []).map(inv => [inv.ingrediente_id, inv]));

    // Pre-calcular coste de cada receta UNA SOLA VEZ
    const costesCalculados = new Map();
    recetas.forEach(rec => {
        const porciones = parseInt(rec.porciones) || 1;
        const costeLote = (rec.ingredientes || []).reduce((sum, item) => {
            const ing = ingredientesMap.get(item.ingredienteId);
            if (!ing) return sum;

            // 🔧 FIX: Priorizar precio_medio del inventario (WAP)
            const invItem = inventarioMap.get(item.ingredienteId);
            let precioUnitario = 0;
            if (invItem?.precio_medio) {
                precioUnitario = parseFloat(invItem.precio_medio);
            } else {
                const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
                precioUnitario = parseFloat(ing.precio) / cantidadFormato;
            }

            // 🆕 CÁLCULO CON MERMA (Rendimiento)
            const rendimiento = parseFloat(item.rendimiento) || 100;
            const factorRendimiento = rendimiento / 100;
            const costeReal = factorRendimiento > 0 ? (precioUnitario / factorRendimiento) : precioUnitario;

            return sum + (costeReal * parseFloat(item.cantidad));
        }, 0);
        costesCalculados.set(rec.id, costeLote / porciones);
    });

    const columnas = [
        { header: 'ID', key: 'id' },
        { header: 'Código', value: rec => rec.codigo || `REC-${String(rec.id).padStart(4, '0')}` },
        { header: 'Nombre', key: 'nombre' },
        { header: 'Categoría', key: 'categoria' },
        { header: 'Precio Venta (€)', value: rec => parseFloat(rec.precio_venta || 0).toFixed(2) },
        {
            header: 'Coste (€)',
            value: rec => costesCalculados.get(rec.id).toFixed(2),
        },
        {
            header: 'Margen (€)',
            value: rec => {
                const coste = costesCalculados.get(rec.id);
                return (parseFloat(rec.precio_venta || 0) - coste).toFixed(2);
            },
        },
        {
            header: 'Margen (%)',
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
        { header: 'Porciones', key: 'porciones' },
        { header: 'Nº Ingredientes', value: rec => (rec.ingredientes || []).length },
    ];

    if (
        typeof window.exportarAExcel === 'function' &&
        typeof window.getRestaurantNameForFile === 'function'
    ) {
        window.exportarAExcel(recetas, `Recetas_${window.getRestaurantNameForFile()}`, columnas);
    }
}
