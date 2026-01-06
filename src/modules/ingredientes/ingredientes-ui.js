/**
 * Módulo de Ingredientes - UI
 * Funciones de renderizado e interfaz de usuario
 * 
 * SEGURIDAD: Usa escapeHTML para prevenir XSS en datos de usuario
 */

import { showToast } from '../../ui/toast.js';
import { getElement, setElementHTML, hideElement, showElement } from '../../utils/dom-helpers.js';

/**
 * Escapa texto plano para uso en HTML (previene XSS)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto seguro para HTML
 */
function escapeHTML(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Variables para paginación y filtros
let paginaActualIngredientes = 1;
const ITEMS_POR_PAGINA = 25;
let filtroCategoria = 'todas';

// Variable local para ingrediente siendo editado
let editandoIngredienteId = null;

/**
 * Obtiene todas las categorías únicas de ingredientes
 */
function obtenerCategorias() {
    const ingredientes = window.ingredientes || [];
    const categorias = new Set();
    ingredientes.forEach(ing => {
        if (ing.categoria) {
            categorias.add(ing.categoria);
        }
    });
    return Array.from(categorias).sort();
}

/**
 * Renderiza los filtros por familia (alimento/bebida)
 */
function renderizarFiltrosCategorias(container) {
    let html =
        '<div class="filtros-ingredientes" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; align-items: center;">';
    html += '<span style="font-weight: 600; color: #64748b; margin-right: 8px;">Filtrar:</span>';

    // Botón "Todas"
    html += `<button class="filtro-btn ${filtroCategoria === 'todas' ? 'active' : ''}" onclick="window.filtrarPorCategoria('todas')">🔍 Todas</button>`;

    // Filtros basados en campo 'familia' del formulario
    html += `<button class="filtro-btn grupo ${filtroCategoria === 'alimento' ? 'active' : ''}" onclick="window.filtrarPorCategoria('alimento')" style="background: #dcfce7; border-color: #22c55e; color: #166534;">🥬 Alimentos</button>`;
    html += `<button class="filtro-btn grupo ${filtroCategoria === 'bebida' ? 'active' : ''}" onclick="window.filtrarPorCategoria('bebida')" style="background: #dbeafe; border-color: #3b82f6; color: #1e40af;">🍺 Bebidas</button>`;
    html += `<button class="filtro-btn grupo ${filtroCategoria === 'suministro' ? 'active' : ''}" onclick="window.filtrarPorCategoria('suministro')" style="background: #fef3c7; border-color: #f59e0b; color: #92400e;">🧹 Suministros</button>`;

    html += '</div>';

    // Añadir estilos para los filtros
    html += `<style>
        .filtro-btn {
            padding: 8px 16px;
            border: 2px solid #e2e8f0;
            background: white;
            border-radius: 20px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
        }
        .filtro-btn:hover {
            border-color: #667eea;
            background: #f8fafc;
        }
        .filtro-btn.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-color: transparent;
        }
        .filtro-btn.grupo {
            font-weight: 600;
        }
        .paginacion {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 12px;
        }
        .paginacion button {
            padding: 8px 16px;
            border: 1px solid #e2e8f0;
            background: white;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .paginacion button:hover:not(:disabled) {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        .paginacion button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .paginacion .pagina-info {
            font-weight: 600;
            color: #64748b;
            padding: 0 16px;
        }
    </style>`;

    return html;
}

/**
 * Filtra por categoría
 */
window.filtrarPorCategoria = function (categoria) {
    filtroCategoria = categoria;
    paginaActualIngredientes = 1;
    renderizarIngredientes();
};

/**
 * Cambia de página
 */
window.cambiarPaginaIngredientes = function (direccion) {
    paginaActualIngredientes += direccion;
    if (paginaActualIngredientes < 1) paginaActualIngredientes = 1;
    renderizarIngredientes();
};

window.irAPaginaIngredientes = function (pagina) {
    paginaActualIngredientes = pagina;
    renderizarIngredientes();
};

/**
 * Renderiza la lista de ingredientes en la tabla
 */
export function renderizarIngredientes() {
    const busqueda = getElement('busqueda-ingredientes')?.value?.toLowerCase() || '';
    const rawIngredientes = window.ingredientes;
    const ingredientes = Array.isArray(rawIngredientes) ? rawIngredientes : [];

    // ⚡ OPTIMIZACIÓN: Actualizar maps si están desactualizados
    if (window.dataMaps) {
        window.dataMaps.updateIfStale();
    }

    // Filtrar por búsqueda y familia
    let filtrados = ingredientes.filter(ing => {
        // ⚡ OPTIMIZACIÓN: Búsqueda O(1) en lugar de O(n)
        const nombreProv = window.dataMaps
            ? window.dataMaps.getNombreProveedor(ing.proveedor_id).toLowerCase()
            : 'sin proveedor';
        const familiaIng = (ing.familia || 'alimento').toLowerCase();
        const matchBusqueda =
            ing.nombre.toLowerCase().includes(busqueda) ||
            nombreProv.includes(busqueda) ||
            familiaIng.includes(busqueda);

        if (!matchBusqueda) return false;

        // Filtrar por familia (alimento/bebida)
        if (filtroCategoria === 'todas') return true;

        // Comparar directamente con el valor de familia
        return familiaIng === filtroCategoria;
    });

    const container = getElement('tabla-ingredientes');
    if (!container) return;

    // Calcular paginación
    const totalItems = filtrados.length;
    const totalPaginas = Math.ceil(totalItems / ITEMS_POR_PAGINA);
    if (paginaActualIngredientes > totalPaginas)
        paginaActualIngredientes = Math.max(1, totalPaginas);

    const inicio = (paginaActualIngredientes - 1) * ITEMS_POR_PAGINA;
    const fin = inicio + ITEMS_POR_PAGINA;
    const paginados = filtrados.slice(inicio, fin);

    if (filtrados.length === 0) {
        container.innerHTML =
            renderizarFiltrosCategorias() +
            `
      <div class="empty-state">
        <div class="icon">📦</div>
        <h3>${busqueda || filtroCategoria !== 'todas' ? 'No encontrados' : 'Aún no hay ingredientes'}</h3>
        <p>${busqueda ? 'Prueba otra búsqueda' : filtroCategoria !== 'todas' ? 'No hay ingredientes en esta categoría' : 'Añade tu primer ingrediente'}</p>
      </div>
    `;
        const resumen = getElement('resumen-ingredientes');
        if (resumen) resumen.style.display = 'none';
    } else {
        let html = renderizarFiltrosCategorias();

        html += '<table><thead><tr>';
        html +=
            '<th>Ingrediente</th><th>Familia</th><th>Proveedor</th><th>Precio</th><th>Stock</th><th>Stock Mínimo</th><th>Acciones</th>';
        html += '</tr></thead><tbody>';

        // ⚡ OPTIMIZACIÓN: Array.map + join en lugar de concatenación en bucle
        const rows = paginados.map(ing => {
            const stockActual = parseFloat(ing.stock_actual) || 0;
            const stockMinimo = parseFloat(ing.stock_minimo) || 0;
            const stockBajo = stockMinimo > 0 && stockActual <= stockMinimo;
            const familia = ing.familia || 'alimento';
            const familiaBadge = familia === 'bebida' ? 'badge-info' : familia === 'suministro' ? 'badge-warning' : 'badge-success';
            const familiaLabel = familia === 'bebida' ? '🍺 Bebida' : familia === 'suministro' ? '🧹 Suministro' : '🥬 Alimento';

            // ⚡ Búsqueda O(1) del proveedor
            const nombreProv = window.dataMaps
                ? window.dataMaps.getNombreProveedor(ing.proveedor_id)
                : 'Sin proveedor';

            // 💰 ACTUALIZADO: Usar precio_medio del inventario (basado en compras)
            const invItem = window.inventarioCompleto?.find(i => i.id === ing.id);
            const precioMedio = invItem?.precio_medio ? parseFloat(invItem.precio_medio) : null;
            const precioBase = parseFloat(ing.precio) || 0;
            const precioMostrar = precioMedio !== null ? precioMedio : precioBase;
            const diferencia = precioMedio !== null ? ((precioMedio - precioBase) / precioBase * 100) : 0;

            // Indicador visual si el precio_medio difiere del precio base
            let precioHtml = '';
            if (precioMedio !== null && Math.abs(diferencia) > 1) {
                const colorDif = diferencia > 0 ? '#ef4444' : '#10B981';
                const iconDif = diferencia > 0 ? '↑' : '↓';
                precioHtml = `<span style="font-weight: 600;">${precioMostrar.toFixed(2)} €/${ing.unidad}</span>
                    <br><small style="color: ${colorDif};">${iconDif} ${Math.abs(diferencia).toFixed(0)}% vs base</small>`;
            } else {
                precioHtml = precioMostrar ? `${precioMostrar.toFixed(2)} €/${ing.unidad}` : '-';
            }

            // Detectar si está inactivo
            const esInactivo = ing.activo === false;
            const rowStyle = esInactivo ? 'opacity: 0.5; background: #fef2f2;' : '';
            const toggleBtn = esInactivo
                ? `<button class="icon-btn" onclick="window.toggleIngredienteActivo(${ing.id}, true)" title="Activar ingrediente" style="color: #22c55e;">✅</button>`
                : `<button class="icon-btn" onclick="window.toggleIngredienteActivo(${ing.id}, false)" title="Desactivar ingrediente" style="color: #f59e0b;">⏸️</button>`;

            return `<tr style="${rowStyle}">
                <td><strong>${escapeHTML(ing.nombre)}</strong>${esInactivo ? '<br><small style="color:#ef4444;">⚠️ Inactivo</small>' : ''}</td>
                <td><span class="badge ${familiaBadge}">${familiaLabel}</span></td>
                <td>${escapeHTML(nombreProv)}</td>
                <td>${precioHtml}</td>
                <td>${ing.stock_actual
                    ? `<span class="stock-badge ${stockBajo ? 'stock-low' : 'stock-ok'}">${ing.stock_actual} ${ing.unidad}</span>${stockBajo && ing.stock_minimo ? ' ⚠️' : ''}`
                    : '-'
                }
                </td>
                <td>${ing.stock_minimo ? parseFloat(ing.stock_minimo) + ' ' + ing.unidad : '-'}</td>
                <td>
                    <button class="icon-btn" onclick="window.verEvolucionPrecio(${ing.id})" title="Ver evolución de precio" style="color: #3b82f6;">📈</button>
                    <button class="icon-btn" onclick="window.gestionarProveedoresIngrediente(${ing.id})" title="Gestionar proveedores" style="color: #8b5cf6;">🏢</button>
                    <button class="icon-btn edit" onclick="window.editarIngrediente(${ing.id})" title="Editar">✏️</button>
                    ${toggleBtn}
                    <button class="icon-btn delete" onclick="window.eliminarIngrediente(${ing.id})" title="Eliminar">🗑️</button>
                </td>
            </tr>`;
        });

        html += rows.join('');

        html += '</tbody></table>';

        // Añadir paginación si hay más de una página
        if (totalPaginas > 1) {
            html += '<div class="paginacion">';
            html += `<button onclick="window.cambiarPaginaIngredientes(-1)" ${paginaActualIngredientes <= 1 ? 'disabled' : ''}>◀ Anterior</button>`;

            // Mostrar números de página
            for (let i = 1; i <= totalPaginas; i++) {
                if (
                    i === 1 ||
                    i === totalPaginas ||
                    (i >= paginaActualIngredientes - 2 && i <= paginaActualIngredientes + 2)
                ) {
                    html += `<button onclick="window.irAPaginaIngredientes(${i})" style="${i === paginaActualIngredientes ? 'background: #667eea; color: white; border-color: #667eea;' : ''}">${i}</button>`;
                } else if (
                    i === paginaActualIngredientes - 3 ||
                    i === paginaActualIngredientes + 3
                ) {
                    html += '<span style="padding: 0 8px;">...</span>';
                }
            }

            html += `<button onclick="window.cambiarPaginaIngredientes(1)" ${paginaActualIngredientes >= totalPaginas ? 'disabled' : ''}>Siguiente ▶</button>`;
            html += `<span class="pagina-info">${inicio + 1}-${Math.min(fin, totalItems)} de ${totalItems}</span>`;
            html += '</div>';
        }

        container.innerHTML = html;

        const resumen = getElement('resumen-ingredientes');
        if (resumen) {
            resumen.innerHTML = `
            <div>Total: <strong>${ingredientes.length}</strong></div>
            <div>Filtrados: <strong>${filtrados.length}</strong></div>
            <div>Mostrando: <strong>${paginados.length}</strong></div>
          `;
            resumen.style.display = 'flex';
        }
    }
}

/**
 * Muestra el formulario para añadir ingrediente
 */
export function mostrarFormularioIngrediente() {
    actualizarSelectProveedores();
    const form = getElement('formulario-ingrediente');
    if (form) {
        form.style.display = 'block';
        const input = getElement('ing-nombre');
        if (input) input.focus();
    }
}

/**
 * Cierra el formulario de ingrediente
 */
export function cerrarFormularioIngrediente() {
    const form = getElement('formulario-ingrediente');
    if (form) {
        form.style.display = 'none';
        const formElement = form.querySelector('form');
        if (formElement) formElement.reset();
    }

    editandoIngredienteId = null;

    const title = getElement('form-title-ingrediente');
    if (title) title.textContent = 'Nuevo Ingrediente';

    const btn = getElement('btn-text-ingrediente');
    if (btn) btn.textContent = 'Añadir';
}

/**
 * Actualiza el select de proveedores
 */
function actualizarSelectProveedores() {
    const select = getElement('ing-proveedor-select');
    if (!select) return;

    const proveedores = window.proveedores || [];
    // ⚡ OPTIMIZACIÓN: Una sola operación DOM con map+join
    const options = proveedores.map(prov =>
        `<option value="${prov.id}">${prov.nombre}</option>`
    ).join('');
    select.innerHTML = '<option value="">Sin proveedor</option>' + options;
}

/**
 * Helper: Obtiene nombre del proveedor por ID
 */
function getNombreProveedor(proveedorId, proveedores = null) {
    const provs = proveedores || window.proveedores || [];
    const prov = provs.find(p => p.id === proveedorId);
    return prov ? prov.nombre : 'Sin proveedor';
}

/**
 * Exporta ingredientes a Excel
 */
export function exportarIngredientes() {
    if (typeof window.exportarAExcel !== 'function') {
        showToast('Exportación no disponible', 'error');
        return;
    }

    const columnas = [
        { header: 'Nombre', key: 'nombre' },
        { header: 'Categoría', key: 'categoria' },
        {
            header: 'Proveedor',
            value: ing => {
                const prov = (window.proveedores || []).find(p => p.id === ing.proveedor_id);
                return prov ? prov.nombre : 'Sin proveedor';
            },
        },
        { header: 'Precio (€)', value: ing => parseFloat(ing.precio || 0).toFixed(2) },
        { header: 'Unidad', key: 'unidad' },
        { header: 'Stock Actual', value: ing => parseFloat(ing.stock_actual || 0).toFixed(2) },
        { header: 'Stock Mínimo', value: ing => parseFloat(ing.stock_minimo || 0).toFixed(2) },
    ];

    window.exportarAExcel(window.ingredientes || [], 'Ingredientes_CostOS', columnas);
}

// Exponer función para compatibilidad
export function getEditandoIngredienteId() {
    return editandoIngredienteId;
}

export function setEditandoIngredienteId(id) {
    editandoIngredienteId = id;
}
