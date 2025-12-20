/**
 * Pedidos CRUD Module
 * Funciones de crear, editar, eliminar y recibir pedidos
 */

/**
 * Guarda un nuevo pedido
 * @param {Event} event - Evento del formulario
 */
export async function guardarPedido(event) {
    event.preventDefault();

    const checks = document.querySelectorAll('#lista-ingredientes-pedido input[type="checkbox"]:checked');
    const ingredientesPedido = [];

    checks.forEach(cb => {
        const cantidadInput = document.querySelector(`input.cantidad-pedido[data-ing-id="${cb.value}"]`);
        if (cantidadInput && cantidadInput.value) {
            ingredientesPedido.push({
                ingredienteId: parseInt(cb.value),
                cantidad: parseFloat(cantidadInput.value),
                precio_unitario: window.ingredientes.find(i => i.id === parseInt(cb.value))?.precio || 0
            });
        }
    });

    if (ingredientesPedido.length === 0) {
        window.showToast('Selecciona al menos un ingrediente', 'warning');
        return;
    }

    const pedido = {
        proveedorId: parseInt(document.getElementById('ped-proveedor').value),
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        ingredientes: ingredientesPedido,
        total: window.calcularTotalPedido()
    };

    window.showLoading();

    try {
        await window.api.createPedido(pedido);
        await window.cargarDatos();
        window.renderizarPedidos();
        window.hideLoading();
        window.showToast('Pedido creado', 'success');
        window.cerrarFormularioPedido();
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error guardando pedido: ' + error.message, 'error');
    }
}

/**
 * Elimina un pedido
 * @param {number} id - ID del pedido
 */
export async function eliminarPedido(id) {
    const ped = window.pedidos.find(p => p.id === id);
    if (!ped) return;

    if (!confirm(`¿Eliminar el pedido #${id}?`)) return;

    window.showLoading();

    try {
        await window.api.deletePedido(id);
        await window.cargarDatos();
        window.renderizarPedidos();
        window.hideLoading();
        window.showToast('Pedido eliminado', 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error eliminando pedido: ' + error.message, 'error');
    }
}

/**
 * Marca un pedido como recibido (abre modal)
 * @param {number} id - ID del pedido
 */
export function marcarPedidoRecibido(id) {
    window.pedidoRecibiendoId = id;
    const ped = window.pedidos.find(p => p.id === id);
    if (!ped) return;

    const container = document.getElementById('modal-recibir-ingredientes');
    let html = '';

    ped.ingredientes.forEach(item => {
        const ing = window.ingredientes.find(i => i.id === item.ingredienteId);
        if (ing) {
            html += `
        <div style="display:flex;gap:10px;margin:10px 0;align-items:center;">
          <span style="flex:1;">${ing.nombre}</span>
          <span style="width:80px;text-align:right;">Pedido: ${item.cantidad}</span>
          <input type="number" step="0.01" min="0" value="${item.cantidad}" 
                 data-ing-id="${ing.id}" data-precio="${ing.precio}"
                 class="cantidad-recibida" 
                 style="width:100px;padding:5px;">
          <span style="width:60px;text-align:right;">${ing.unidad}</span>
        </div>
      `;
        }
    });

    container.innerHTML = html;
    document.getElementById('modal-recibir').classList.add('active');
}

/**
 * Cierra el modal de recibir pedido
 */
export function cerrarModalRecibirPedido() {
    document.getElementById('modal-recibir').classList.remove('active');
    window.pedidoRecibiendoId = null;
}

/**
 * Confirma la recepción del pedido (actualiza stock)
 */
export async function confirmarRecepcionPedido() {
    if (window.pedidoRecibiendoId === null) return;

    const inputs = document.querySelectorAll('.cantidad-recibida');
    const ped = window.pedidos.find(p => p.id === window.pedidoRecibiendoId);

    window.showLoading();

    try {
        let totalRecibido = 0;

        // Actualizar stock de cada ingrediente
        for (const input of inputs) {
            const ingId = parseInt(input.dataset.ingId);
            const cantidadRecibida = parseFloat(input.value) || 0;
            const precio = parseFloat(input.dataset.precio) || 0;

            totalRecibido += cantidadRecibida * precio;

            const ing = window.ingredientes.find(i => i.id === ingId);
            if (ing) {
                const nuevoStock = (ing.stockActual || 0) + cantidadRecibida;
                await window.api.updateIngrediente(ingId, {
                    ...ing,
                    stockActual: nuevoStock
                });
            }
        }

        // Marcar pedido como recibido
        await window.api.updatePedido(window.pedidoRecibiendoId, {
            ...ped,
            estado: 'recibido',
            fecha_recepcion: new Date().toISOString(),
            total_recibido: totalRecibido
        });

        await window.cargarDatos();
        window.renderizarPedidos();
        window.renderizarIngredientes();
        window.hideLoading();
        cerrarModalRecibirPedido();
        window.showToast('Pedido recibido, stock actualizado', 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error recibiendo pedido: ' + error.message, 'error');
    }
}

/**
 * Muestra detalles de un pedido en modal
 * @param {number} pedidoId - ID del pedido
 */
export function verDetallesPedido(pedidoId) {
    window.pedidoViendoId = pedidoId;
    const ped = window.pedidos.find(p => p.id === pedidoId);
    if (!ped) return;

    const prov = window.proveedores.find(p => p.id === ped.proveedorId);

    document.getElementById('modal-pedido-id').textContent = `#${ped.id}`;
    document.getElementById('modal-pedido-proveedor').textContent = prov ? prov.nombre : 'Sin proveedor';
    document.getElementById('modal-pedido-fecha').textContent = new Date(ped.fecha).toLocaleString('es-ES');
    document.getElementById('modal-pedido-estado').textContent = ped.estado;
    document.getElementById('modal-pedido-estado').className = `badge ${ped.estado === 'recibido' ? 'badge-success' : 'badge-warning'}`;

    let html = '<table><thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>';

    ped.ingredientes.forEach(item => {
        const ing = window.ingredientes.find(i => i.id === item.ingredienteId);
        if (ing) {
            const subtotal = item.cantidad * item.precio_unitario;
            html += `<tr>`;
            html += `<td>${ing.nombre}</td>`;
            html += `<td>${item.cantidad} ${ing.unidad}</td>`;
            html += `<td>${parseFloat(item.precio_unitario || 0).toFixed(2)}€</td>`;
            html += `<td>${subtotal.toFixed(2)}€</td>`;
            html += `</tr>`;
        }
    });

    html += '</tbody></table>';
    document.getElementById('modal-pedido-ingredientes').innerHTML = html;
    document.getElementById('modal-pedido-total').textContent = parseFloat(ped.total || 0).toFixed(2) + '€';

    if (ped.fecha_recepcion) {
        document.getElementById('modal-pedido-recepcion').textContent = new Date(ped.fecha_recepcion).toLocaleString('es-ES');
        document.getElementById('modal-pedido-total-recibido').textContent = parseFloat(ped.total_recibido || 0).toFixed(2) + '€';
    } else {
        document.getElementById('modal-pedido-recepcion').textContent = 'Pendiente';
        document.getElementById('modal-pedido-total-recibido').textContent = '-';
    }

    document.getElementById('modal-ver-pedido').classList.add('active');
}

/**
 * Cierra el modal de ver pedido
 */
export function cerrarModalVerPedido() {
    document.getElementById('modal-ver-pedido').classList.remove('active');
    window.pedidoViendoId = null;
}

/**
 * Descarga PDF del pedido actual
 */
export function descargarPedidoPDF() {
    if (window.pedidoViendoId === null) return;

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const pedido = window.pedidos.find(p => p.id === window.pedidoViendoId);
    const prov = window.proveedores.find(p => p.id === pedido.proveedorId);

    // Crear HTML para imprimir
    let html = `
    <html>
    <head>
      <title>Pedido #${pedido.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #7c3aed; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #7c3aed; color: white; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Pedido #${pedido.id}</h1>
      <p><strong>Restaurante:</strong> ${currentUser.nombre || 'La Caleta'}</p>
      <p><strong>Proveedor:</strong> ${prov ? prov.nombre : 'Sin proveedor'}</p>
      <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString('es-ES')}</p>
      <p><strong>Estado:</strong> ${pedido.estado}</p>
      <table>
        <thead>
          <tr><th>Ingrediente</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr>
        </thead>
        <tbody>
  `;

    pedido.ingredientes.forEach(item => {
        const ing = window.ingredientes.find(i => i.id === item.ingredienteId);
        if (ing) {
            const subtotal = item.cantidad * item.precio_unitario;
            html += `
        <tr>
          <td>${ing.nombre}</td>
          <td>${item.cantidad} ${ing.unidad}</td>
          <td>${parseFloat(item.precio_unitario || 0).toFixed(2)}€</td>
          <td>${subtotal.toFixed(2)}€</td>
        </tr>
      `;
        }
    });

    html += `
        </tbody>
      </table>
      <div class="total">Total: ${parseFloat(pedido.total || 0).toFixed(2)}€</div>
    </body>
    </html>
  `;

    // Abrir en nueva ventana para imprimir
    const ventana = window.open('', '', 'width=800,height=600');
    ventana.document.write(html);
    ventana.document.close();
    ventana.print();
}
