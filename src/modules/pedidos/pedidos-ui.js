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
 * Carga lista de ingredientes con checkboxes para pedido
 */
export function cargarIngredientesPedido() {
    const container = document.getElementById('lista-ingredientes-pedido');
    if (window.ingredientes.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Primero añade ingredientes</p>';
        return;
    }

    let html = '';
    window.ingredientes.forEach(ing => {
        html += `
      <div class="ingrediente-check">
        <input type="checkbox" id="ing-${ing.id}" value="${ing.id}" onchange="window.calcularTotalPedido()">
        <label for="ing-${ing.id}">${ing.nombre} (${ing.precio}€/${ing.unidad})</label>
        <input type="number" step="0.01" min="0" placeholder="Cantidad" disabled 
               data-ing-id="${ing.id}" class="cantidad-pedido" onchange="window.calcularTotalPedido()">
      </div>
    `;
    });
    container.innerHTML = html;

    // Enable cantidad input cuando se marca checkbox
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const cantidadInput = container.querySelector(`input.cantidad-pedido[data-ing-id="${e.target.value}"]`);
            if (cantidadInput) {
                cantidadInput.disabled = !e.target.checked;
                if (!e.target.checked) cantidadInput.value = '';
            }
        });
    });
}

/**
 * Agrega un ingrediente al pedido (alternativa simplificada)
 */
export function agregarIngredientePedido() {
    // Versión simplificada - la UI principal usa cargarIngredientesPedido
    window.calcularTotalPedido();
}

/**
 * Calcula el total del pedido
 */
export function calcularTotalPedido() {
    const checks = document.querySelectorAll('#lista-ingredientes-pedido input[type="checkbox"]:checked');
    let total = 0;

    checks.forEach(cb => {
        const cantidadInput = document.querySelector(`input.cantidad-pedido[data-ing-id="${cb.value}"]`);
        if (cantidadInput && cantidadInput.value) {
            const ing = window.ingredientes.find(i => i.id === parseInt(cb.value));
            if (ing) {
                total += parseFloat(ing.precio || 0) * parseFloat(cantidadInput.value || 0);
            }
        }
    });

    const totalDiv = document.getElementById('total-pedido');
    if (totalDiv) {
        totalDiv.textContent = total.toFixed(2) + '€';
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
            html += `<button type="button" class="icon-btn success" onclick="window.marcarPedidoRecibido(${ped.id})" title="Recibir">✅</button>`;
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

    window.exportarAExcel(window.pedidos, 'Pedidos_LaCaleta', columnas);
}
