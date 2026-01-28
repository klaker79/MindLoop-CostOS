import { escapeHTML } from '../../utils/helpers.js';
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
    document.getElementById('form-title-proveedor').textContent = 'Nuevo Proveedor';
    document.getElementById('btn-text-proveedor').textContent = 'Añadir';
}

/**
 * Carga lista de ingredientes con checkboxes
 */
export function cargarIngredientesProveedor(seleccionados = []) {
    const container = document.getElementById('lista-ingredientes-proveedor');
    if (window.ingredientes.length === 0) {
        container.innerHTML =
            '<p style="color:#999;text-align:center;padding:20px;">Primero añade ingredientes</p>';
        return;
    }

    let html =
        '<div class="search-box-small"><input type="text" id="buscar-ing-prov" placeholder="Buscar ingrediente..." oninput="window.filtrarIngredientesProveedor()"></div>';
    html += '<div id="lista-ing-checks">';

    window.ingredientes.forEach(ing => {
        const checked = seleccionados.includes(ing.id) ? 'checked' : '';
        html += `
      <div class="ing-check-item">
        <input type="checkbox" id="prov-ing-${ing.id}" value="${ing.id}" ${checked}>
        <label for="prov-ing-${ing.id}">${escapeHTML(ing.nombre)}</label>
      </div>
    `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Filtra ingredientes en el formulario de proveedor
 */
export function filtrarIngredientesProveedor() {
    const busqueda = document.getElementById('buscar-ing-prov')?.value.toLowerCase() || '';
    const items = document.querySelectorAll('.ing-check-item');

    items.forEach(item => {
        const label = item.querySelector('label').textContent.toLowerCase();
        item.style.display = label.includes(busqueda) ? 'flex' : 'none';
    });
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
        <h3>${busqueda ? 'No encontrados' : 'Aún no hay proveedores'}</h3>
      </div>
    `;
        return;
    }

    let html = '<table><thead><tr>';
    html += '<th>Nombre</th><th>Contacto</th><th>Ingredientes</th><th>Acciones</th>';
    html += '</tr></thead><tbody>';

    filtrados.forEach(prov => {
        const ingredientesCount = prov.ingredientes?.length || 0;

        html += '<tr>';
        html += `<td><strong>${prov.nombre}</strong></td>`;
        html += `<td>`;
        if (prov.telefono) html += `📞 ${prov.telefono}<br>`;
        if (prov.email) html += `✉️ ${prov.email}`;
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
    if (prov.telefono) html += `<p>📞 ${prov.telefono}</p>`;
    if (prov.email) html += `<p>✉️ ${prov.email}</p>`;
    if (prov.direccion) html += `<p>📍 ${prov.direccion}</p>`;
    html += '</div>';

    html += '<h4 style="margin-bottom: 8px;">Ingredientes:</h4><ul>';
    if (prov.ingredientes && prov.ingredientes.length > 0) {
        prov.ingredientes.forEach(ingId => {
            const ing = window.ingredientes.find(i => i.id === ingId);
            if (ing) html += `<li>${ing.nombre}</li>`;
        });
    } else {
        html += '<li style="color:#999;">Sin ingredientes asignados</li>';
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
