/**
 * Pedidos UI Module
 * Funciones de interfaz de usuario para pedidos
 * 
 * SEGURIDAD: Usa escapeHTML para prevenir XSS en datos de usuario
 */

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
/**
 * Muestra el formulario de nuevo pedido
 */
export function mostrarFormularioPedido() {
    if (window.proveedores.length === 0) {
        window.showToast('Primero añade proveedores', 'warning');
        window.cambiarTab('proveedores');
        return;
    }

    // Cargar select de proveedores (ordenados alfabéticamente)
    const select = document.getElementById('ped-proveedor');
    if (select) {
        // ⚡ OPTIMIZACIÓN: Una sola operación DOM con map+join + ordenación A-Z
        const proveedoresOrdenados = [...window.proveedores].sort((a, b) =>
            (a.nombre || '').localeCompare(b.nombre || '')
        );
        const options = proveedoresOrdenados.map(prov =>
            `<option value="${prov.id}">${prov.nombre}</option>`
        ).join('');
        select.innerHTML = '<option value="">Seleccionar proveedor...</option>' + options;

        // Añadir listener para mostrar/ocultar campo detalle mercado
        select.addEventListener('change', mostrarCampoDetalleMercado);
    }

    // Ocultar campo detalle mercado al inicio
    const campoDetalle = document.getElementById('campo-detalle-mercado');
    if (campoDetalle) campoDetalle.style.display = 'none';

    document.getElementById('formulario-pedido').style.display = 'block';
    window.cargarIngredientesPedido();
    document.getElementById('ped-proveedor').focus();
}

/**
 * Muestra u oculta el campo de detalle cuando es "Compras Mercado"
 */
function mostrarCampoDetalleMercado() {
    const select = document.getElementById('ped-proveedor');
    const campoDetalle = document.getElementById('campo-detalle-mercado');

    if (!select || !campoDetalle) return;

    const proveedorId = parseInt(select.value);
    const proveedor = window.proveedores.find(p => p.id === proveedorId);

    // Mostrar campo si es "Compras Mercado" (buscar por nombre)
    const esCompasMercado = proveedor && proveedor.nombre.toLowerCase().includes('mercado');

    campoDetalle.style.display = esCompasMercado ? 'block' : 'none';

    // Limpiar campo si se oculta
    if (!esCompasMercado) {
        const input = document.getElementById('ped-detalle-mercado');
        if (input) input.value = '';
    }
}

/**
 * Cierra el formulario de pedido
 */
export function cerrarFormularioPedido() {
    document.getElementById('formulario-pedido').style.display = 'none';
    document.querySelector('#formulario-pedido form').reset();
    window.editandoPedidoId = null;
    // Limpiar búsqueda de ingrediente
    const sugerencias = document.getElementById('sugerencias-ingrediente-pedido');
    if (sugerencias) sugerencias.style.display = 'none';
}

/**
 * Busca ingredientes para el pedido y muestra sugerencias
 * Al seleccionar uno, auto-selecciona el proveedor
 */
window.buscarIngredienteParaPedido = function (query) {
    const container = document.getElementById('sugerencias-ingrediente-pedido');
    if (!container) return;

    if (!query || query.length < 2) {
        container.style.display = 'none';
        return;
    }

    const queryLower = query.toLowerCase();
    const ingredientesMatch = (window.ingredientes || []).filter(ing =>
        ing.nombre.toLowerCase().includes(queryLower)
    ).slice(0, 10); // Máximo 10 sugerencias

    if (ingredientesMatch.length === 0) {
        container.innerHTML = '<div style="padding: 12px; color: #64748b; font-style: italic;">No se encontraron ingredientes</div>';
        container.style.display = 'block';
        return;
    }

    let html = '';
    ingredientesMatch.forEach(ing => {
        const provId = ing.proveedor_id || ing.proveedorId;
        const prov = provId ? (window.proveedores || []).find(p => p.id === provId) : null;
        const provNombre = prov ? prov.nombre : 'Sin proveedor';

        html += `<div onclick="window.seleccionarIngredienteParaPedido(${ing.id})" 
            style="padding: 12px; cursor: pointer; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;"
            onmouseover="this.style.background='#f1f5f9'" 
            onmouseout="this.style.background='white'">
            <span style="font-weight: 500;">${escapeHTML(ing.nombre)}</span>
            <span style="font-size: 12px; color: ${provId ? '#10b981' : '#f59e0b'}; background: ${provId ? '#f0fdf4' : '#fffbeb'}; padding: 4px 8px; border-radius: 4px;">
                ${provId ? '📦 ' + escapeHTML(provNombre) : '⚠️ Sin proveedor'}
            </span>
        </div>`;
    });

    container.innerHTML = html;
    container.style.display = 'block';
    container.style.background = 'white';
    container.style.border = '1px solid #e2e8f0';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
};

/**
 * Selecciona un ingrediente y auto-selecciona su proveedor
 * Si tiene múltiples proveedores, pregunta cuál usar
 */
window.seleccionarIngredienteParaPedido = async function (ingredienteId) {
    const ing = (window.ingredientes || []).find(i => i.id === ingredienteId);
    if (!ing) return;

    // Ocultar sugerencias
    const container = document.getElementById('sugerencias-ingrediente-pedido');
    if (container) container.style.display = 'none';

    // Limpiar input de búsqueda
    const inputBuscar = document.getElementById('ped-buscar-ingrediente');
    if (inputBuscar) inputBuscar.value = ing.nombre;

    // Buscar proveedores de este ingrediente
    let proveedores = [];

    try {
        // Primero buscar en la tabla de relación ingrediente_proveedores
        const proveedoresAPI = await window.API?.fetch(`/api/ingredients/${ingredienteId}/suppliers`);
        if (Array.isArray(proveedoresAPI) && proveedoresAPI.length > 0) {
            proveedores = proveedoresAPI.map(p => {
                const provInfo = (window.proveedores || []).find(pr => pr.id === p.proveedor_id);
                return {
                    id: p.proveedor_id,
                    nombre: provInfo ? provInfo.nombre : `Proveedor #${p.proveedor_id}`,
                    precio: p.precio
                };
            });
        }
    } catch (e) {
        console.log('No se pudo obtener proveedores del API');
    }

    // Si no hay en la tabla de relación, usar el proveedor principal
    if (proveedores.length === 0 && (ing.proveedor_id || ing.proveedorId)) {
        const provId = ing.proveedor_id || ing.proveedorId;
        const prov = (window.proveedores || []).find(p => p.id === provId);
        if (prov) {
            proveedores = [{ id: provId, nombre: prov.nombre, precio: ing.precio }];
        }
    }

    if (proveedores.length === 0) {
        window.showToast(`${ing.nombre} no tiene proveedor asignado. Selecciona uno manualmente.`, 'warning');
        return;
    }

    let proveedorSeleccionado;

    if (proveedores.length === 1) {
        // Solo un proveedor, seleccionar automáticamente
        proveedorSeleccionado = proveedores[0];
    } else {
        // Múltiples proveedores, preguntar al usuario
        const opciones = proveedores.map((p, i) => `${i + 1}. ${p.nombre} (${parseFloat(p.precio || 0).toFixed(2)}€)`).join('\n');
        const respuesta = prompt(`${ing.nombre} tiene ${proveedores.length} proveedores:\n\n${opciones}\n\nEscribe el número del proveedor que quieres usar:`);

        if (!respuesta) return;

        const idx = parseInt(respuesta) - 1;
        if (isNaN(idx) || idx < 0 || idx >= proveedores.length) {
            window.showToast('Selección inválida', 'error');
            return;
        }

        proveedorSeleccionado = proveedores[idx];
    }

    // Seleccionar el proveedor en el dropdown
    const selectProveedor = document.getElementById('ped-proveedor');
    if (selectProveedor) {
        selectProveedor.value = proveedorSeleccionado.id;
        // Disparar evento change para cargar ingredientes
        selectProveedor.dispatchEvent(new Event('change'));
    }

    window.showToast(`Proveedor seleccionado: ${proveedorSeleccionado.nombre}`, 'success');
};

/**
 * Carga lista de ingredientes según el proveedor seleccionado
 * 🏪 Para "Compras Mercado": muestra TODOS los ingredientes
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
    const esCompraMercado = proveedor && proveedor.nombre.toLowerCase().includes('mercado');

    // 🏪 Para compras del mercado: mostrar TODOS los ingredientes
    if (esCompraMercado) {
        if (window.ingredientes.length === 0) {
            if (containerWrapper) containerWrapper.style.display = 'none';
            window.showToast('No hay ingredientes en el sistema', 'warning');
            return;
        }
        // Mostrar contenedor de ingredientes
        if (containerWrapper) containerWrapper.style.display = 'block';
        if (container) container.innerHTML = '';
        // Agregar primera fila de ingrediente
        window.agregarIngredientePedido();
        return;
    }

    // Pedido normal: mostrar solo ingredientes del proveedor
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
 * 🆕 Ahora soporta formato de compra con conversión automática
 * 🏪 Para "Compras Mercado": muestra TODOS los ingredientes
 */
export function agregarIngredientePedido() {
    const proveedorId = parseInt(document.getElementById('ped-proveedor')?.value);
    if (!proveedorId) return;

    const proveedor = window.proveedores.find(p => p.id === proveedorId);
    const esCompraMercado = proveedor && proveedor.nombre.toLowerCase().includes('mercado');

    let ingredientesDisponibles;

    if (esCompraMercado) {
        // 🏪 Compras del mercado: mostrar TODOS los ingredientes
        ingredientesDisponibles = window.ingredientes || [];
    } else {
        // Pedido normal: mostrar solo ingredientes del proveedor
        if (!proveedor || !proveedor.ingredientes) return;
        const provIngSet = new Set(proveedor.ingredientes);
        ingredientesDisponibles = window.ingredientes.filter(ing => provIngSet.has(ing.id));
    }

    const container = document.getElementById('lista-ingredientes-pedido');
    if (!container) return;

    const rowId = `pedido-row-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'ingrediente-item';
    div.id = rowId;
    div.style.cssText =
        'display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap;';

    let opciones = '<option value="">Seleccionar...</option>';
    ingredientesDisponibles.forEach(ing => {
        // Guardar datos del formato en data attributes
        const formatoInfo = ing.formato_compra && ing.cantidad_por_formato
            ? `data-formato="${escapeHTML(ing.formato_compra)}" data-cantidad-formato="${escapeHTML(String(ing.cantidad_por_formato))}"`
            : '';
        opciones += `<option value="${ing.id}" ${formatoInfo} data-unidad="${escapeHTML(ing.unidad || 'ud')}" data-precio="${parseFloat(ing.precio || 0)}">${escapeHTML(ing.nombre)} (${parseFloat(ing.precio || 0).toFixed(2)}€/${escapeHTML(ing.unidad || 'ud')})</option>`;
    });

    // Para compras del mercado: mostrar campo de precio editable
    const precioInputStyle = esCompraMercado
        ? 'flex: 1; padding: 8px; border: 2px solid #10b981; border-radius: 6px; background: #f0fdf4;'
        : 'flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;';

    div.innerHTML = `
      <select style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.onIngredientePedidoChange(this, '${rowId}')">${opciones}</select>
      <div id="${rowId}-formato-container" style="display: none; flex: 1;">
        <select id="${rowId}-formato-select" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; width: 100%;" onchange="window.calcularTotalPedido()">
        </select>
      </div>
      <input type="number" placeholder="Cantidad" step="0.01" min="0" class="cantidad-input" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" oninput="window.calcularTotalPedido()">
      <input type="number" placeholder="€/ud" step="0.01" min="0" class="precio-input" style="${precioInputStyle}" oninput="window.calcularTotalPedido()">
      <span id="${rowId}-conversion" style="font-size: 11px; color: #64748b; min-width: 60px;"></span>
      <button type="button" onclick="this.parentElement.remove(); window.calcularTotalPedido()" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">×</button>
    `;

    container.appendChild(div);
}

/**
 * Maneja el cambio de ingrediente seleccionado en pedido
 * Muestra selector de formato si el ingrediente lo tiene definido
 * 🆕 Pre-rellena el precio con el del proveedor específico
 */
export function onIngredientePedidoChange(selectElement, rowId) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const formatoContainer = document.getElementById(`${rowId}-formato-container`);
    const formatoSelect = document.getElementById(`${rowId}-formato-select`);
    const conversionSpan = document.getElementById(`${rowId}-conversion`);
    const precioInput = selectElement.parentElement?.querySelector('.precio-input');

    const formato = selectedOption?.dataset?.formato;
    const cantidadFormato = selectedOption?.dataset?.cantidadFormato;
    const unidad = selectedOption?.dataset?.unidad || 'ud';
    const ingId = parseInt(selectedOption?.value);
    const precioGeneral = parseFloat(selectedOption?.dataset?.precio || 0);

    if (formato && cantidadFormato && formatoContainer && formatoSelect) {
        // Mostrar selector de formato - SOLO el formato, sin opción de kg
        formatoContainer.style.display = 'block';
        formatoSelect.innerHTML = `
            <option value="formato" data-multiplicador="${cantidadFormato}" data-formato-mult="${cantidadFormato}">${escapeHTML(formato)} (${cantidadFormato} ${unidad})</option>
        `;
        formatoSelect.value = 'formato';
    } else if (formatoContainer) {
        formatoContainer.style.display = 'none';
    }

    if (conversionSpan) {
        conversionSpan.textContent = '';
    }

    // Pre-rellenar precio del ingrediente (sin llamada API que falla con 401)
    if (precioInput && ingId) {
        // Usar el precio del ingrediente directamente
        precioInput.value = precioGeneral > 0 ? precioGeneral.toFixed(2) : '';
    }

    window.calcularTotalPedido();
}

// Exponer al window
window.onIngredientePedidoChange = onIngredientePedidoChange;

/**
 * Calcula el total del pedido
 * ⚡ OPTIMIZACIÓN: Usa Map O(1) en lugar de .find() O(n)
 * 🆕 Ahora maneja formato de compra con conversión automática
 */
export function calcularTotalPedido() {
    const items = document.querySelectorAll('#lista-ingredientes-pedido .ingrediente-item');
    let total = 0;

    // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez, no .find() O(n) por cada item
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    items.forEach(item => {
        const select = item.querySelector('select');
        const input = item.querySelector('input[type="number"]');
        const formatoSelect = item.querySelector('select[id$="-formato-select"]');
        const conversionSpan = item.querySelector('span[id$="-conversion"]');

        if (select && select.value && input && input.value) {
            const ing = ingMap.get(parseInt(select.value)); // O(1) lookup
            if (ing) {
                const cantidadInput = parseFloat(input.value || 0);

                // Obtener multiplicador del formato (1 si es unidad base)
                let multiplicador = 1;
                let formatoMult = 1; // Multiplicador del formato (siempre, para calcular precio/kg)
                let usandoFormato = false;
                if (formatoSelect && formatoSelect.parentElement?.style.display !== 'none') {
                    const selectedFormatoOption = formatoSelect.options[formatoSelect.selectedIndex];
                    multiplicador = parseFloat(selectedFormatoOption?.dataset?.multiplicador) || 1;
                    formatoMult = parseFloat(selectedFormatoOption?.dataset?.formatoMult) || 1;
                    usandoFormato = formatoSelect.value === 'formato' && formatoMult && formatoMult !== 1;
                }

                // Cantidad real en unidad base (para stock)
                const cantidadReal = usandoFormato ? cantidadInput * formatoMult : cantidadInput;

                // Mostrar conversión si hay multiplicador > 1
                if (conversionSpan && usandoFormato) {
                    conversionSpan.textContent = `= ${cantidadReal.toFixed(2)} ${ing.unidad || 'ud'}`;
                    conversionSpan.style.color = '#10b981';
                    conversionSpan.style.fontWeight = '600';
                } else if (conversionSpan) {
                    conversionSpan.textContent = '';
                }

                // 💰 CORREGIDO: Usar el precio del campo de texto (que el usuario puede editar)
                // Si no hay precio en el campo, usar el precio del ingrediente
                const precioInput = item.querySelector('.precio-input');
                const precioManual = precioInput ? parseFloat(precioInput.value || 0) : 0;
                const precioIngrediente = precioManual > 0 ? precioManual : parseFloat(ing.precio || 0);

                if (usandoFormato) {
                    // Compra por formato (lote): precio_por_unidad × cantidad_por_formato × cantidad_lotes
                    // Ej: 0.40€/botella × 12 bots/lote × 1 lote = 4.80€
                    total += precioIngrediente * formatoMult * cantidadInput;
                } else {
                    // Compra por unidad base (kg, botella) directamente
                    total += precioIngrediente * cantidadInput;
                }
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
 * ⚡ OPTIMIZACIÓN: Pre-build Map de proveedores para lookups O(1)
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

    // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez, no .find() O(n) por cada pedido
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));

    let html = '<table><thead><tr>';
    html +=
        '<th>ID</th><th>Fecha</th><th>Proveedor</th><th>Items</th><th>Total</th><th>Estado</th><th>Acciones</th>';
    html += '</tr></thead><tbody>';

    pedidosFiltrados.forEach(ped => {
        const provId = ped.proveedorId || ped.proveedor_id;
        const prov = provMap.get(provId);
        const fecha = new Date(ped.fecha).toLocaleDateString('es-ES');
        const esCompraMercado = ped.es_compra_mercado;

        html += '<tr>';
        html += `<td>#${ped.id}</td>`;
        html += `<td>${fecha}</td>`;

        // Proveedor + detalle mercado
        if (esCompraMercado && ped.detalle_mercado) {
            html += `<td>${escapeHTML(prov ? prov.nombre : 'Sin proveedor')}<br><small style="color:#10b981;">📍 ${escapeHTML(ped.detalle_mercado)}</small></td>`;
        } else {
            html += `<td>${escapeHTML(prov ? prov.nombre : 'Sin proveedor')}</td>`;
        }

        // Items: descripción para mercado, count para normal
        if (esCompraMercado && ped.descripcion_mercado) {
            html += `<td><small style="color:#64748b;">${escapeHTML(ped.descripcion_mercado)}</small></td>`;
        } else {
            html += `<td>${ped.ingredientes?.length || 0}</td>`;
        }

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
 * ⚡ OPTIMIZACIÓN: Pre-build Map de proveedores para evitar N+1
 */
export function exportarPedidos() {
    // ⚡ OPTIMIZACIÓN: Crear Map una vez antes del loop
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));

    const columnas = [
        { header: 'ID', key: 'id' },
        { header: 'Fecha Pedido', value: p => new Date(p.fecha).toLocaleDateString('es-ES') },
        {
            header: 'Proveedor',
            value: p => {
                const prov = provMap.get(p.proveedorId);
                return prov ? prov.nombre : 'Sin proveedor';
            },
        },
        { header: 'Estado', key: 'estado' },
        { header: 'Nº Ingredientes', value: p => (p.ingredientes || []).length },
        { header: 'Total (€)', value: p => parseFloat(p.total || 0).toFixed(2) },
        { header: 'Total Recibido (€)', value: p => parseFloat(p.total_recibido || 0).toFixed(2) },
        {
            header: 'Fecha Recepción',
            value: p =>
                p.fecha_recepcion ? new Date(p.fecha_recepcion).toLocaleDateString('es-ES') : '-',
        },
    ];

    window.exportarAExcel(window.pedidos, `Pedidos_${window.getRestaurantNameForFile()}`, columnas);
}
