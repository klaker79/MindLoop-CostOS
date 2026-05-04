import { escapeHTML } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';
/**
 * Proveedores UI Module
 * Funciones de interfaz de usuario para proveedores
 * 
 * SEGURIDAD: Usa escapeHTML para prevenir XSS en datos de usuario
 */

/**
 * Escapa texto plano para uso en HTML (previene XSS)
 * @param {string} text - Texto a escapar
 * @returns {string} Texto seguro para HTML
 */
/**
 * Muestra el formulario de nuevo proveedor
 */
export function mostrarFormularioProveedor() {
    document.getElementById('formulario-proveedor').style.display = 'block';
    cargarIngredientesProveedor();
    document.getElementById('prov-nombre').focus();
}

/**
 * Cierra el formulario de proveedor
 */
export function cerrarFormularioProveedor() {
    document.getElementById('formulario-proveedor').style.display = 'none';
    document.querySelector('#formulario-proveedor form').reset();
    window.editandoProveedorId = null;
    document.getElementById('form-title-proveedor').textContent = t('proveedores:form_title_new');
    document.getElementById('btn-text-proveedor').textContent = t('proveedores:btn_add');
}

/**
 * Muestra los ingredientes vinculados al proveedor en modo read-only.
 * La fuente de verdad de la relación ingrediente↔proveedor es la pestaña
 * Ingredientes — desde aquí solo se VEN los vinculados, y al click se navega
 * al ingrediente para editar.
 */
export function cargarIngredientesProveedor(seleccionados = []) {
    const container = document.getElementById('lista-ingredientes-proveedor');
    if (!container) return;

    if (!seleccionados || seleccionados.length === 0) {
        container.innerHTML =
            `<p style="color:#999;text-align:center;padding:20px;">${t('proveedores:no_ingredients_assigned')}</p>`;
        return;
    }

    const items = (window.ingredientes || []).filter(ing => seleccionados.includes(ing.id));

    if (items.length === 0) {
        container.innerHTML =
            `<p style="color:#999;text-align:center;padding:20px;">${t('proveedores:no_ingredients_assigned')}</p>`;
        return;
    }

    let html = `
      <p style="color:#64748b;font-size:13px;margin-bottom:12px;">
        ${t('proveedores:linked_readonly_hint')}
      </p>
      <div id="lista-ing-vinculados" style="display:flex;flex-direction:column;gap:6px;">
    `;

    items.forEach(ing => {
        html += `
      <button type="button" class="ing-link-item"
        onclick="window.irAIngredienteDesdeProveedor(${ing.id})"
        style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;text-align:left;transition:background 0.15s;"
        onmouseover="this.style.background='#eef2ff'"
        onmouseout="this.style.background='#f8fafc'">
        <span>${escapeHTML(ing.nombre)}</span>
        <span style="color:#6366f1;font-size:13px;">→</span>
      </button>
    `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Navega a la pestaña Ingredientes y abre el editor del ingrediente.
 * Permite editar el proveedor vinculado desde la fuente de verdad.
 */
export function irAIngredienteDesdeProveedor(ingredienteId) {
    if (window.cerrarFormularioProveedor) window.cerrarFormularioProveedor();
    if (window.cambiarTab) window.cambiarTab('ingredientes');
    setTimeout(() => {
        if (window.editarIngrediente) window.editarIngrediente(ingredienteId);
    }, 200);
}

/**
 * Stub mantenido por compatibilidad con `oninput` del HTML existente. El
 * filtrado original (checkboxes) ya no se usa en la vista read-only.
 */
export function filtrarIngredientesProveedor() {
    /* no-op tras refactor 2026-05-04 */
}

/**
 * Renderiza la tabla de proveedores
 */
export function renderizarProveedores() {
    const busqueda = document.getElementById('busqueda-proveedores')?.value.toLowerCase() || '';
    const filtrados = window.proveedores.filter(
        p =>
            p.nombre.toLowerCase().includes(busqueda) ||
            (p.telefono && p.telefono.includes(busqueda)) ||
            (p.email && p.email.toLowerCase().includes(busqueda))
    );

    const container = document.getElementById('tabla-proveedores');

    if (filtrados.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🚚</div>
        <h3>${busqueda ? t('proveedores:empty_not_found') : t('proveedores:empty_none_yet')}</h3>
      </div>
    `;
        return;
    }

    let html = '<table><thead><tr>';
    html += `<th>${t('proveedores:col_name')}</th><th>${t('proveedores:col_contact')}</th><th>${t('proveedores:col_ingredients')}</th><th>${t('proveedores:col_actions')}</th>`;
    html += '</tr></thead><tbody>';

    filtrados.forEach(prov => {
        const ingredientesCount = prov.ingredientes?.length || 0;

        html += '<tr>';
        html += `<td><strong>${escapeHTML(prov.nombre)}</strong></td>`;
        html += `<td>`;
        if (prov.telefono) html += `📞 ${escapeHTML(prov.telefono)}<br>`;
        if (prov.email) html += `✉️ ${escapeHTML(prov.email)}`;
        html += `</td>`;
        html += `<td>${ingredientesCount} items</td>`;
        html += `<td><div class="actions">`;
        html += `<button class="icon-btn view" onclick="window.verProveedorDetalles(${prov.id})">👁️</button>`;
        html += `<button class="icon-btn edit" onclick="window.editarProveedor(${prov.id})">✏️</button>`;
        html += `<button class="icon-btn delete" onclick="window.eliminarProveedor(${prov.id})">🗑️</button>`;
        html += '</div></td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Muestra detalles de un proveedor en modal
 */
export function verProveedorDetalles(id) {
    const prov = window.proveedores.find(p => p.id === id);
    if (!prov) return;

    const tituloEl = document.getElementById('modal-proveedor-titulo');
    const contenidoEl = document.getElementById('modal-proveedor-contenido');

    if (!tituloEl || !contenidoEl) {
        console.error('Modal de proveedor no encontrado');
        return;
    }

    tituloEl.textContent = prov.nombre;

    let html = '<div style="margin-bottom: 16px;">';
    if (prov.telefono) html += `<p>📞 ${escapeHTML(prov.telefono)}</p>`;
    if (prov.email) html += `<p>✉️ ${escapeHTML(prov.email)}</p>`;
    if (prov.direccion) html += `<p>📍 ${escapeHTML(prov.direccion)}</p>`;
    html += '</div>';

    html += `<h4 style="margin-bottom: 8px;">${t('proveedores:detail_ingredients')}</h4><ul>`;
    if (prov.ingredientes && prov.ingredientes.length > 0) {
        prov.ingredientes.forEach(ingId => {
            const ing = (window.ingredientes || []).find(i => i.id === ingId);
            if (ing) html += `<li>${escapeHTML(ing.nombre)}</li>`;
        });
    } else {
        html += `<li style="color:#999;">${t('proveedores:no_ingredients_assigned')}</li>`;
    }
    html += '</ul>';

    contenidoEl.innerHTML = html;

    document.getElementById('modal-ver-proveedor').classList.add('active');
}

/**
 * Cierra modal de ver proveedor
 */
export function cerrarModalVerProveedor() {
    document.getElementById('modal-ver-proveedor').classList.remove('active');
}
