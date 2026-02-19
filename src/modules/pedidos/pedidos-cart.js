/**
 * Pedidos Cart Module - Carrito de Pedidos estilo Amazon
 * Permite añadir ingredientes al carrito y confirmar cuando esté listo
 */

// Estado del carrito (persistido en localStorage)
let carrito = [];
let carritoProveedorId = null;
let carritoFecha = null;

/**
 * Clave de localStorage aislada por restaurante (multi-tenant).
 * Evita que el carrito de un restaurante aparezca en otro al cambiar de cuenta.
 */
function getCartKey() {
    return `pedidoCarrito_${window.restauranteId || 'default'}`;
}

/**
 * Inicializa el carrito desde localStorage
 */
function initCarrito() {
    try {
        const saved = localStorage.getItem(getCartKey());
        if (saved) {
            const data = JSON.parse(saved);
            carrito = data.items || [];
            carritoProveedorId = data.proveedorId || null;
            carritoFecha = data.fecha || null;
        }
    } catch (e) {
        console.error('Error cargando carrito:', e);
        carrito = [];
        carritoProveedorId = null;
    }
    actualizarBadgeCarrito();
}

/**
 * Guarda el carrito en localStorage
 */
function guardarCarrito() {
    // Capturar fecha del formulario si está abierto
    const fechaInput = document.getElementById('ped-fecha');
    if (fechaInput && fechaInput.value) {
        carritoFecha = fechaInput.value;
    }
    localStorage.setItem(getCartKey(), JSON.stringify({
        items: carrito,
        proveedorId: carritoProveedorId,
        fecha: carritoFecha,
        updatedAt: new Date().toISOString()
    }));
    actualizarBadgeCarrito();
}

/**
 * Actualiza el badge del carrito en el sidebar
 */
function actualizarBadgeCarrito() {
    const badge = document.getElementById('carrito-badge');
    if (badge) {
        const count = carrito.length;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

/**
 * Añade un ingrediente al carrito
 * @param {number} ingredienteId - ID del ingrediente
 * @param {number} cantidad - Cantidad a pedir
 * @param {number} proveedorId - ID del proveedor
 * @param {number} precioProveedor - Precio específico del proveedor (opcional)
 * @param {boolean} esUnidadSuelta - Si es compra por unidad (botella) en lugar de formato (caja)
 */
window.agregarAlCarrito = function (ingredienteId, cantidad = 1, proveedorId = null, precioProveedor = null, esUnidadSuelta = false) {
    const ing = window.ingredientes.find(i => i.id === ingredienteId);
    if (!ing) {
        window.showToast('Ingrediente no encontrado', 'error');
        return;
    }

    // Determinar proveedor
    const provId = proveedorId || ing.proveedor_id || ing.proveedorId;

    // ⚠️ CRÍTICO: Obtener el precio correcto del proveedor
    let precioFormato = precioProveedor; // Primero usar precio pasado como parámetro
    // 🆕 Si es compra por unidad suelta (botella), marcar como unitario
    let precioYaEsUnitario = esUnidadSuelta; // Flag para indicar si el precio ya está por unidad

    if (!precioFormato && provId && window.ingredientesProveedores) {
        // Buscar precio del proveedor en ingredientes_proveedores (datos en memoria)
        const rel = window.ingredientesProveedores.find(
            ip => ip.ingrediente_id === ingredienteId && ip.proveedor_id === provId
        );
        if (rel && rel.precio) {
            precioFormato = parseFloat(rel.precio);
            precioYaEsUnitario = true; // El precio de ingredientes_proveedores YA está por unidad
            console.log(`💰 Precio de proveedor ${provId} para ${ing.nombre}: ${precioFormato}€/unidad`);
        }
    }

    // Fallback: usar precio del ingrediente
    if (!precioFormato) {
        precioFormato = parseFloat(ing.precio || 0);
    }

    // Si el carrito está vacío, establecer el proveedor
    if (carrito.length === 0) {
        carritoProveedorId = provId;
    }
    // Si el proveedor es diferente, avisar
    else if (carritoProveedorId && provId && carritoProveedorId !== provId) {
        const provActual = window.proveedores.find(p => p.id === carritoProveedorId);
        const provNuevo = window.proveedores.find(p => p.id === provId);
        if (!confirm(`El carrito tiene productos de "${provActual?.nombre || 'otro proveedor'}". ¿Quieres añadir "${ing.nombre}" de "${provNuevo?.nombre || 'otro proveedor'}"?\n\nNota: Se creará un pedido separado si continúas.`)) {
            return;
        }
        // Permitir mezclar, se ordenarán por proveedor al confirmar
    }

    // Verificar si ya existe en el carrito
    const existente = carrito.find(item => item.ingredienteId === ingredienteId);
    if (existente) {
        existente.cantidad += cantidad;
        window.showToast(`📦 ${ing.nombre}: +${cantidad} (Total: ${existente.cantidad})`, 'success');
    } else {
        carrito.push({
            ingredienteId: ingredienteId,
            nombre: ing.nombre,
            cantidad: cantidad,
            unidad: ing.unidad || 'ud',
            precio: precioFormato,  // Usar precio del proveedor
            proveedorId: provId,
            formatoCompra: ing.formato_compra,
            cantidadPorFormato: ing.cantidad_por_formato,
            precioYaEsUnitario: precioYaEsUnitario // Si true, no dividir por cantidadPorFormato
        });
        window.showToast(`🛒 ${ing.nombre} añadido al carrito`, 'success');
    }

    guardarCarrito();
};

/**
 * Elimina un item del carrito
 */
window.eliminarDelCarrito = function (ingredienteId) {
    carrito = carrito.filter(item => item.ingredienteId !== ingredienteId);
    if (carrito.length === 0) {
        carritoProveedorId = null;
    }
    guardarCarrito();
    renderizarCarrito();
};

/**
 * Actualiza la cantidad de un item del carrito
 */
window.actualizarCantidadCarrito = function (ingredienteId, nuevaCantidad) {
    const item = carrito.find(i => i.ingredienteId === ingredienteId);
    if (item) {
        item.cantidad = parseFloat(nuevaCantidad) || 0;
        if (item.cantidad <= 0) {
            window.eliminarDelCarrito(ingredienteId);
        } else {
            guardarCarrito();
        }
    }
};

/**
 * Vacía todo el carrito
 */
window.vaciarCarrito = function () {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;

    carrito = [];
    carritoProveedorId = null;
    guardarCarrito();
    renderizarCarrito();
    window.showToast('🗑️ Carrito vaciado', 'info');
};

/**
 * Abre el modal del carrito
 */
window.abrirCarrito = function () {
    const modal = document.getElementById('modal-carrito');
    if (modal) {
        modal.classList.add('active');
        renderizarCarrito();
    }
};

/**
 * Cierra el modal del carrito
 */
window.cerrarCarrito = function () {
    const modal = document.getElementById('modal-carrito');
    if (modal) modal.classList.remove('active');
};

/**
 * Cierra el carrito y abre el formulario de nuevo pedido para seguir comprando
 */
window.seguirComprando = function () {
    window.cerrarCarrito();
    // Mostrar formulario de nuevo pedido
    if (typeof window.mostrarFormularioPedido === 'function') {
        window.mostrarFormularioPedido();
    } else {
        // Fallback: mostrar el formulario directamente
        const form = document.getElementById('formulario-pedido');
        if (form) form.style.display = 'block';
    }
};

/**
 * Renderiza el contenido del carrito
 */
function renderizarCarrito() {
    const contenedor = document.getElementById('carrito-contenido');
    if (!contenedor) return;

    if (carrito.length === 0) {
        contenedor.innerHTML = `
      <div style="text-align: center; padding: 50px; color: #94A3B8;">
        <div style="font-size: 64px; margin-bottom: 20px;">🛒</div>
        <h3 style="margin: 0; color: #64748B;">Carrito vacío</h3>
        <p style="margin-top: 10px;">Añade ingredientes desde la lista o el inventario</p>
      </div>
    `;
        document.getElementById('carrito-total').textContent = '0.00 €';
        return;
    }

    // Agrupar por proveedor
    const porProveedor = {};
    let total = 0;

    carrito.forEach(item => {
        const provId = item.proveedorId || 0;
        if (!porProveedor[provId]) {
            const prov = window.proveedores.find(p => p.id === provId);
            porProveedor[provId] = {
                nombre: prov?.nombre || 'Sin proveedor',
                items: []
            };
        }
        porProveedor[provId].items.push(item);
        // 🆕 CORREGIDO: Si el precio ya es unitario (compra por botella), multiplicar directamente
        if (item.precioYaEsUnitario) {
            // Compra por unidad: cantidad × precio unitario
            total += item.cantidad * item.precio;
        } else {
            // Compra por formato: cantidad / cantidadPorFormato × precio formato
            const cantFormato = parseFloat(item.cantidadPorFormato) || 1;
            total += (item.cantidad / cantFormato) * item.precio;
        }
    });

    let html = '';

    Object.entries(porProveedor).forEach(([provId, data]) => {
        html += `
      <div style="margin-bottom: 20px;">
        <h4 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 12px;">
          📦 ${data.nombre}
        </h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px; text-align: left;">Ingrediente</th>
              <th style="padding: 10px; text-align: center; width: 120px;">Cantidad</th>
              <th style="padding: 10px; text-align: right;">Precio</th>
              <th style="padding: 10px; text-align: right;">Subtotal</th>
              <th style="padding: 10px; width: 50px;"></th>
            </tr>
          </thead>
          <tbody>
    `;

        data.items.forEach(item => {
            // 🆕 CORREGIDO: Si el precio ya es unitario (compra por botella), multiplicar directamente
            let subtotal;
            if (item.precioYaEsUnitario) {
                // Compra por unidad
                subtotal = item.cantidad * item.precio;
            } else {
                // Compra por formato
                const cantFormato = parseFloat(item.cantidadPorFormato) || 1;
                subtotal = (item.cantidad / cantFormato) * item.precio;
            }
            html += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px;">
            <strong>${item.nombre}</strong>
            ${item.formatoCompra ? `<br><small style="color:#64748b;">📦 ${item.formatoCompra}</small>` : ''}
          </td>
          <td style="padding: 12px; text-align: center;">
            <input type="number" value="${item.cantidad}" min="0.01" step="0.01"
              style="width: 70px; padding: 6px; border: 1px solid #ddd; border-radius: 6px; text-align: center;"
              onchange="window.actualizarCantidadCarrito(${item.ingredienteId}, this.value)">
            <span style="color: #64748b; font-size: 12px;">${item.unidad}</span>
          </td>
          <td style="padding: 12px; text-align: right;">${item.precio.toFixed(2)} €</td>
          <td style="padding: 12px; text-align: right; font-weight: bold;">${subtotal.toFixed(2)} €</td>
          <td style="padding: 12px; text-align: center;">
            <button onclick="window.eliminarDelCarrito(${item.ingredienteId})"
              style="background: #fee2e2; border: none; color: #dc2626; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
              🗑️
            </button>
          </td>
        </tr>
      `;
        });

        html += `</tbody></table></div>`;
    });

    contenedor.innerHTML = html;
    document.getElementById('carrito-total').textContent = total.toFixed(2) + ' €';
}

/**
 * Confirma el carrito y crea los pedidos
 */
window.confirmarCarrito = async function () {
    if (carrito.length === 0) {
        window.showToast('El carrito está vacío', 'warning');
        return;
    }

    if (!confirm(`¿Crear pedido con ${carrito.length} ingredientes?`)) return;

    window.showLoading();

    try {
        // Agrupar por proveedor para crear pedidos separados
        const porProveedor = {};
        carrito.forEach(item => {
            const provId = item.proveedorId || 0;
            if (!porProveedor[provId]) {
                porProveedor[provId] = [];
            }
            porProveedor[provId].push(item);
        });

        let pedidosCreados = 0;

        for (const [provId, items] of Object.entries(porProveedor)) {
            /**
             * ⚠️ CRITICAL - FÓRMULA DE PRECIO UNITARIO ⚠️
             * Si precioYaEsUnitario = true: el precio YA es por unidad (viene de ingredientes_proveedores)
             * Si precioYaEsUnitario = false: el precio es por formato, hay que dividir por cantidad_por_formato
             */
            const ingredientes = items.map(item => {
                const cantFormato = parseFloat(item.cantidadPorFormato) || 1;
                // Si el precio ya es unitario (de ingredientes_proveedores), usarlo directamente
                // Si no, dividir por cantidadPorFormato
                const precioUnitario = item.precioYaEsUnitario
                    ? item.precio
                    : item.precio / cantFormato;
                return {
                    ingredienteId: item.ingredienteId,
                    ingrediente_id: item.ingredienteId,
                    cantidad: item.cantidad,
                    precioUnitario: precioUnitario,      // precio POR UNIDAD
                    precio_unitario: precioUnitario,
                    precio: item.precioYaEsUnitario ? item.precio * cantFormato : item.precio, // precio por formato
                    cantidadPorFormato: cantFormato
                };
            });

            /**
             * ⚠️ CRITICAL - TOTAL DEBE COINCIDIR CON renderizarCarrito() ⚠️
             * Si precioYaEsUnitario = true: cantidad × precio (compra unitaria)
             * Si precioYaEsUnitario = false: (cantidad / cantidadPorFormato) × precio (compra por formato)
             */
            const total = items.reduce((sum, item) => {
                if (item.precioYaEsUnitario) {
                    return sum + (item.cantidad * item.precio);
                }
                const cantFormato = parseFloat(item.cantidadPorFormato) || 1;
                return sum + ((item.cantidad / cantFormato) * item.precio);
            }, 0);

            const pedido = {
                proveedorId: parseInt(provId) || null,
                proveedor_id: parseInt(provId) || null,
                fecha: carritoFecha || document.getElementById('ped-fecha')?.value || new Date().toISOString().split('T')[0],
                estado: 'pendiente',
                ingredientes: ingredientes,
                total: total
            };

            await window.api.createPedido(pedido);
            pedidosCreados++;
        }

        // Limpiar carrito
        carrito = [];
        carritoProveedorId = null;
        carritoFecha = null;
        guardarCarrito();

        // Recargar datos
        window.pedidos = await window.api.getPedidos();
        window.renderizarPedidos();

        window.hideLoading();
        window.cerrarCarrito();
        window.showToast(`✅ ${pedidosCreados} pedido(s) creado(s)`, 'success');

        // Navegar a pedidos
        if (typeof window.showTab === 'function') {
            window.showTab('pedidos');
        }

    } catch (error) {
        window.hideLoading();
        console.error('Error creando pedidos:', error);
        window.showToast('Error creando pedidos: ' + error.message, 'error');
    }
};

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', initCarrito);

// Exponer funciones
window.initCarrito = initCarrito;
window.actualizarBadgeCarrito = actualizarBadgeCarrito;
