/**
 * Módulo de Ingredientes - UI
 * Funciones de renderizado e interfaz de usuario
 */

import { showToast } from '../ui/toast.js';
import { getElement, setElementHTML, hideElement, showElement } from '../utils/dom-helpers.js';

// Variable local para ingrediente siendo editado
let editandoIngredienteId = null;

/**
 * Renderiza la lista de ingredientes en la tabla
 */
export function renderizarIngredientes() {
    const busqueda = getElement('busqueda-ingredientes')?.value?.toLowerCase() || '';
    const ingredientes = window.ingredientes || [];
    const proveedores = window.proveedores || [];

    const filtrados = ingredientes.filter(ing => {
        const nombreProv = getNombreProveedor(ing.proveedor_id, proveedores).toLowerCase();
        return ing.nombre.toLowerCase().includes(busqueda) || nombreProv.includes(busqueda);
    });

    const container = getElement('tabla-ingredientes');
    if (!container) return;

    if (filtrados.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        <h3>${busqueda ? 'No encontrados' : 'Aún no hay ingredientes'}</h3>
        <p>${busqueda ? 'Prueba otra búsqueda' : 'Añade tu primer ingrediente'}</p>
      </div>
    `;
        const resumen = getElement('resumen-ingredientes');
        if (resumen) resumen.style.display = 'none';
    } else {
        let html = '<table><thead><tr>';
        html += '<th>Ingrediente</th><th>Proveedor</th><th>Precio</th><th>Stock</th><th>Stock Mínimo</th>';
        html += '</tr></thead><tbody>';

        filtrados.forEach(ing => {
            const stockActual = parseFloat(ing.stock_actual) || 0;
            const stockMinimo = parseFloat(ing.stock_minimo) || 0;
            const stockBajo = stockMinimo > 0 && stockActual <= stockMinimo;

            html += '<tr>';
            html += `<td><strong style="cursor: pointer;" onclick="window.editarIngrediente(${ing.id})">${ing.nombre}</strong></td>`;
            html += `<td>${getNombreProveedor(ing.proveedor_id, proveedores)}</td>`;
            html += `<td>${ing.precio ? parseFloat(ing.precio).toFixed(2) + ' €/' + ing.unidad : '-'}</td>`;
            html += `<td>`;
            if (ing.stock_actual) {
                html += `<span class="stock-badge ${stockBajo ? 'stock-low' : 'stock-ok'}">${ing.stock_actual} ${ing.unidad}</span>`;
                if (stockBajo && ing.stock_minimo) html += ` ⚠️`;
            } else {
                html += '-';
            }
            html += `</td>`;
            html += `<td>${ing.stock_minimo ? parseFloat(ing.stock_minimo) + ' ' + ing.unidad : '-'}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        const resumen = getElement('resumen-ingredientes');
        if (resumen) {
            resumen.innerHTML = `
        <div>Total: <strong>${ingredientes.length}</strong></div>
        <div>Mostrando: <strong>${filtrados.length}</strong></div>
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
    select.innerHTML = '<option value="">Sin proveedor</option>';
    proveedores.forEach(prov => {
        select.innerHTML += `<option value="${prov.id}">${prov.nombre}</option>`;
    });
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
            header: 'Proveedor', value: (ing) => {
                const prov = (window.proveedores || []).find(p => p.id === ing.proveedor_id);
                return prov ? prov.nombre : 'Sin proveedor';
            }
        },
        { header: 'Precio (€)', value: (ing) => parseFloat(ing.precio || 0).toFixed(2) },
        { header: 'Unidad', key: 'unidad' },
        { header: 'Stock Actual', value: (ing) => parseFloat(ing.stock_actual || 0).toFixed(2) },
        { header: 'Stock Mínimo', value: (ing) => parseFloat(ing.stock_minimo || 0).toFixed(2) }
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
