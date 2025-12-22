/**
 * Pedidos UI Module
 * Funciones de interfaz de usuario para pedidos
 */

/**
 * Muestra el formulario de nuevo pedido
 */
export function mostrarFormularioPedido() {
    if (window.proveedores.length === 0) {
        window.showToast('Primero añade proveedores', 'warning');
        window.cambiarTab('proveedores');
        return;
    }

    // Cargar select de proveedores
    const select = document.getElementById('ped-proveedor');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
        window.proveedores.forEach(prov => {
            select.innerHTML += `<option value="${prov.id}">${prov.nombre}</option>`;
        });
    }

    document.getElementById('formulario-pedido').style.display = 'block';
    window.cargarIngredientesPedido();
    document.getElementById('ped-proveedor').focus();
}

/**
 * Cierra el formulario de pedido
 */
export function cerrarFormularioPedido() {
    document.getElementById('formulario-pedido').style.display = 'none';
    document.querySelector('#formulario-pedido form').reset();
    window.editandoPedidoId = null;
}

/**
 * Carga lista de ingredientes según el proveedor seleccionado
 */
export function cargarIngredientesPedido() {
    const proveedorId = parseInt(document.getElementById('ped-proveedor')?.value);
    const containerWrapper = document.getElementById('container-ingredientes-pedido');
    const container = document.getElementById('lista-ingredientes-pedido');

    if (!proveedorId) {
        if (containerWrapper) containerWrapper.style.display = 'none';
        return;
    }

    const proveedor = window.proveedores.find(p => p.id === proveedorId);
    if (!proveedor || !proveedor.ingredientes || proveedor.ingredientes.length === 0) {
        if (containerWrapper) containerWrapper.style.display = 'none';
        window.showToast('Este proveedor no tiene ingredientes asignados', 'warning');
        return;
    }

    // Mostrar contenedor
    if (containerWrapper) containerWrapper.style.display = 'block';
    if (container) container.innerHTML = '';

    // Agregar primera fila de ingrediente
    window.agregarIngredientePedido();
}

/**
 * Agrega una fila de ingrediente al pedido
 */
export function agregarIngredientePedido() {
    const proveedorId = parseInt(document.getElementById('ped-proveedor')?.value);
    if (!proveedorId) return;

    const proveedor = window.proveedores.find(p => p.id === proveedorId);
    if (!proveedor || !proveedor.ingredientes) return;

    const ingredientesProveedor = window.ingredientes.filter(ing =>
        proveedor.ingredientes.includes(ing.id)
    );

    const container = document.getElementById('lista-ingredientes-pedido');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ingrediente-item';
    div.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;';

    let opciones = '<option value="">Seleccionar...</option>';
    ingredientesProveedor.forEach(ing => {
        opciones += `<option value="${ing.id}">${ing.nombre} (${parseFloat(ing.precio || 0).toFixed(2)}€/${ing.unidad})</option>`;
    });

    div.innerHTML = `
      <select style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.calcularTotalPedido()">${opciones}</select>
      <input type="number" placeholder="Cantidad" step="0.01" min="0" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" oninput="window.calcularTotalPedido()">
      <button type="button" onclick="this.parentElement.remove(); window.calcularTotalPedido()" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">×</button>
    `;

    container.appendChild(div);
}

/**
 * Calcula el total del pedido
 */
export function calcularTotalPedido() {
    const items = document.querySelectorAll('#lista-ingredientes-pedido .ingrediente-item');
    let total = 0;

    items.forEach(item => {
        const select = item.querySelector('select');
        const input = item.querySelector('input[type="number"]');
        if (select && select.value && input && input.value) {
            const ing = window.ingredientes.find(i => i.id === parseInt(select.value));
            if (ing) {
                total += parseFloat(ing.precio || 0) * parseFloat(input.value || 0);
            }
        }
    });

    // Actualizar display del total
    const totalDiv = document.getElementById('total-pedido');
    if (totalDiv) totalDiv.textContent = total.toFixed(2) + '€';

    const totalForm = document.getElementById('total-pedido-form');
    if (totalForm) {
        totalForm.style.display = total > 0 ? 'block' : 'none';
        const valorSpan = document.getElementById('total-pedido-value');
        if (valorSpan) valorSpan.textContent = total.toFixed(2) + ' €';
    }

    return total;
}

/**
 * Renderiza la tabla de pedidos
 */
export function renderizarPedidos() {
    const container = document.getElementById('tabla-pedidos');
    const filtro = document.getElementById('filtro-estado-pedido')?.value || 'todos';

    let pedidosFiltrados = window.pedidos;
    if (filtro !== 'todos') {
        pedidosFiltrados = window.pedidos.filter(p => p.estado === filtro);
    }

    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        <h3>No hay pedidos</h3>
      </div>
    `;
        return;
    }

    let html = '<table><thead><tr>';
    html += '<th>ID</th><th>Fecha</th><th>Proveedor</th><th>Items</th><th>Total</th><th>Estado</th><th>Acciones</th>';
    html += '</tr></thead><tbody>';

    pedidosFiltrados.forEach(ped => {
        const prov = window.proveedores.find(p => p.id === ped.proveedorId);
        const fecha = new Date(ped.fecha).toLocaleDateString('es-ES');

        html += '<tr>';
        html += `<td>#${ped.id}</td>`;
        html += `<td>${fecha}</td>`;
        html += `<td>${prov ? prov.nombre : 'Sin proveedor'}</td>`;
        html += `<td>${ped.ingredientes?.length || 0}</td>`;
        html += `<td>${parseFloat(ped.total || 0).toFixed(2)}€</td>`;

        const estadoClass = ped.estado === 'recibido' ? 'badge-success' : 'badge-warning';
        html += `<td><span class="badge ${estadoClass}">${ped.estado}</span></td>`;

        html += `<td><div class="actions">`;
        html += `<button type="button" class="icon-btn view" onclick="window.verDetallesPedido(${ped.id})" title="Ver detalles">👁️</button>`;

        if (ped.estado === 'pendiente') {
            html += `<button type="button" class="icon-btn success" onclick="window.marcarPedidoRecibido(${ped.id})" title="Recibir">➡️</button>`;
        }

        html += `<button type="button" class="icon-btn delete" onclick="window.eliminarPedido(${ped.id})">🗑️</button>`;
        html += '</div></td>';
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Exporta pedidos a Excel
 */
export function exportarPedidos() {
    const columnas = [
        { header: 'ID', key: 'id' },
        { header: 'Fecha Pedido', value: (p) => new Date(p.fecha).toLocaleDateString('es-ES') },
        {
            header: 'Proveedor', value: (p) => {
                const prov = window.proveedores.find(pr => pr.id === p.proveedorId);
                return prov ? prov.nombre : 'Sin proveedor';
            }
        },
        { header: 'Estado', key: 'estado' },
        { header: 'Nº Ingredientes', value: (p) => (p.ingredientes || []).length },
        { header: 'Total (€)', value: (p) => parseFloat(p.total || 0).toFixed(2) },
        { header: 'Total Recibido (€)', value: (p) => parseFloat(p.total_recibido || 0).toFixed(2) },
        { header: 'Fecha Recepción', value: (p) => p.fecha_recepcion ? new Date(p.fecha_recepcion).toLocaleDateString('es-ES') : '-' }
    ];

    window.exportarAExcel(window.pedidos, `Pedidos_${window.getRestaurantNameForFile()}`, columnas);
}
