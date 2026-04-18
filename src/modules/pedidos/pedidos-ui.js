import { escapeHTML, cm } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';
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
/**
 * Muestra el formulario de nuevo pedido
 */
export function mostrarFormularioPedido() {
    if ((window.proveedores || []).length === 0) {
        window.showToast(t('pedidos:need_suppliers_first'), 'warning');
        window.cambiarTab('proveedores');
        return;
    }

    // Cargar select de proveedores (ordenados alfabéticamente)
    const select = document.getElementById('ped-proveedor');
    if (select) {
        // ⚡ OPTIMIZACIÓN: Una sola operación DOM con map+join + ordenación A-Z
        const proveedoresOrdenados = [...(window.proveedores || [])].sort((a, b) =>
            (a.nombre || '').localeCompare(b.nombre || '')
        );
        const options = proveedoresOrdenados.map(prov =>
            `<option value="${prov.id}">${prov.nombre}</option>`
        ).join('');
        select.innerHTML = `<option value="">${t('pedidos:form_select_supplier')}</option>` + options;

        // Añadir listener para mostrar/ocultar campo detalle mercado (guard to prevent accumulation)
        if (!select._hasCampoDetalleListener) {
            select.addEventListener('change', mostrarCampoDetalleMercado);
            select._hasCampoDetalleListener = true;
        }
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
    const proveedor = (window.proveedores || []).find(p => p.id === proveedorId);

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

    // Limpiar lista de ingredientes del pedido
    const listaIngredientes = document.getElementById('lista-ingredientes-pedido');
    if (listaIngredientes) listaIngredientes.innerHTML = '';

    // Resetear IVA y totales
    const ivaInput = document.getElementById('ped-iva');
    if (ivaInput) ivaInput.value = '0';

    const subtotalDiv = document.getElementById('total-pedido-subtotal');
    if (subtotalDiv) subtotalDiv.textContent = cm(0);

    const ivaDiv = document.getElementById('total-pedido-iva');
    if (ivaDiv) ivaDiv.textContent = cm(0);

    const totalDiv = document.getElementById('total-pedido');
    if (totalDiv) totalDiv.textContent = cm(0);
    const totalForm = document.getElementById('total-pedido-form');
    if (totalForm) totalForm.style.display = 'none';
    const totalValue = document.getElementById('total-pedido-value');
    if (totalValue) totalValue.textContent = cm(0);

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
        container.innerHTML = `<div style="padding: 12px; color: #64748b; font-style: italic;">${t('pedidos:no_ingredients_system')}</div>`;
        container.style.display = 'block';
        return;
    }

    let html = '';
    ingredientesMatch.forEach(ing => {
        const provId = ing.proveedor_id || ing.proveedorId;
        const prov = provId ? (window.proveedores || []).find(p => p.id === provId) : null;
        const provNombre = prov ? prov.nombre : t('pedidos:detail_no_supplier');

        html += `<div onclick="window.seleccionarIngredienteParaPedido(${ing.id})"
            style="padding: 12px; cursor: pointer; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;"
            onmouseover="this.style.background='#f1f5f9'"
            onmouseout="this.style.background='white'">
            <span style="font-weight: 500;">${escapeHTML(ing.nombre)}</span>
            <span style="font-size: 12px; color: ${provId ? '#10b981' : '#f59e0b'}; background: ${provId ? '#f0fdf4' : '#fffbeb'}; padding: 4px 8px; border-radius: 4px;">
                ${provId ? '📦 ' + escapeHTML(provNombre) : `⚠️ ${t('pedidos:detail_no_supplier')}`}
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
        const proveedoresAPI = await window.API?.fetch(`/ingredients/${ingredienteId}/suppliers`);
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
        window.showToast(t('pedidos:no_supplier_assigned', { name: ing.nombre }), 'warning');
        return;
    }

    let proveedorSeleccionado;

    if (proveedores.length === 1) {
        // Solo un proveedor, seleccionar automáticamente
        proveedorSeleccionado = proveedores[0];
    } else {
        // Múltiples proveedores, preguntar al usuario
        const opciones = proveedores.map((p, i) => `${i + 1}. ${p.nombre} (${cm(parseFloat(p.precio || 0))})`).join('\n');
        const respuesta = prompt(`${ing.nombre} tiene ${proveedores.length} proveedores:\n\n${opciones}\n\nEscribe el número del proveedor que quieres usar:`);

        if (!respuesta) return;

        const idx = parseInt(respuesta) - 1;
        if (isNaN(idx) || idx < 0 || idx >= proveedores.length) {
            window.showToast(t('pedidos:invalid_selection'), 'error');
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

    window.showToast(t('pedidos:supplier_selected', { name: proveedorSeleccionado.nombre }), 'success');
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
        if ((window.ingredientes || []).length === 0) {
            if (containerWrapper) containerWrapper.style.display = 'none';
            window.showToast(t('pedidos:no_ingredients_system'), 'warning');
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
        window.showToast(t('pedidos:no_ingredients_supplier'), 'warning');
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
        ingredientesDisponibles = (window.ingredientes || []).filter(ing => provIngSet.has(ing.id));
    }

    const container = document.getElementById('lista-ingredientes-pedido');
    if (!container) return;

    const rowId = `pedido-row-${Date.now()}`;
    const div = document.createElement('div');
    div.className = 'ingrediente-item';
    div.id = rowId;
    div.style.cssText =
        'display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap;';

    let opciones = `<option value="">${t('pedidos:form_select_supplier')}</option>`;
    ingredientesDisponibles.forEach(ing => {
        // Guardar datos del formato en data attributes
        const formatoInfo = ing.formato_compra && ing.cantidad_por_formato
            ? `data-formato="${escapeHTML(ing.formato_compra)}" data-cantidad-formato="${escapeHTML(String(ing.cantidad_por_formato))}"`
            : '';
        opciones += `<option value="${ing.id}" ${formatoInfo} data-unidad="${escapeHTML(ing.unidad || 'ud')}" data-precio="${parseFloat(ing.precio || 0)}">${escapeHTML(ing.nombre)} (${cm(parseFloat(ing.precio || 0))}/${escapeHTML(ing.unidad || 'ud')})</option>`;
    });

    // Para compras del mercado: mostrar campo de precio editable
    const precioInputStyle = esCompraMercado
        ? 'flex: 1; padding: 8px; border: 2px solid #10b981; border-radius: 6px; background: #f0fdf4;'
        : 'flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;';

    div.innerHTML = `
      <select style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.onIngredientePedidoChange(this, '${rowId}')">${opciones}</select>
      <div id="${rowId}-formato-container" style="display: none; flex: 0.8;">
        <select id="${rowId}-formato-select" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; width: 100%;" onchange="window.calcularTotalPedido()">
        </select>
      </div>
      <input type="number" placeholder="${t('pedidos:placeholder_quantity')}" step="0.01" min="0" class="cantidad-input" style="width: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; text-align: center;" oninput="window.calcularTotalPedido()">
      <input type="number" placeholder="${t('pedidos:placeholder_price_unit')}" step="0.01" min="0" class="precio-input" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; text-align: right; ${esCompraMercado ? 'border-color: #10b981; background: #f0fdf4;' : ''}" oninput="window.calcularTotalPedido()">
      <button type="button" class="btn-update-price" onclick="window.actualizarPrecioIngrediente(this)" title="${t('pedidos:btn_update_price') || 'Update ingredient price'}" style="background: none; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 6px; cursor: pointer; font-size: 11px; color: #6366f1; display: none;" >💾</button>
      <span id="${rowId}-subtotal" style="min-width: 70px; font-weight: 600; color: #059669; text-align: right;">${cm(0)}</span>
      <span id="${rowId}-conversion" style="font-size: 10px; color: #64748b; min-width: 70px;"></span>
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
        // Mostrar selector de formato - CAJA + UNIDAD suelta
        formatoContainer.style.display = 'block';

        // Calcular precio por unidad (precio del formato / cantidad por formato)
        const precioUnidad = precioGeneral > 0 && parseFloat(cantidadFormato) > 1
            ? (precioGeneral / parseFloat(cantidadFormato)).toFixed(2)
            : precioGeneral.toFixed(2);

        formatoSelect.innerHTML = `
            <option value="formato" data-multiplicador="${cantidadFormato}" data-formato-mult="${cantidadFormato}" data-precio-formato="${precioGeneral}">${escapeHTML(formato)} (${cantidadFormato} ${unidad})</option>
            <option value="unidad" data-multiplicador="1" data-formato-mult="1" data-precio-unidad="${precioUnidad}">${escapeHTML(unidad)} (unidad suelta ~${cm(precioUnidad)})</option>
        `;
        formatoSelect.value = 'formato';

        // Listener para cambiar precio automáticamente según formato seleccionado
        formatoSelect.onchange = function () {
            const selectedOpt = this.options[this.selectedIndex];
            const precioInputEl = this.closest('.ingrediente-item')?.querySelector('.precio-input');
            if (precioInputEl) {
                if (this.value === 'unidad') {
                    precioInputEl.value = selectedOpt.dataset.precioUnidad || '';
                    precioInputEl.style.borderColor = '#f59e0b';
                    precioInputEl.style.background = '#fffbeb';
                } else {
                    precioInputEl.value = selectedOpt.dataset.precioFormato || '';
                    precioInputEl.style.borderColor = '#ddd';
                    precioInputEl.style.background = 'white';
                }
            }
            window.calcularTotalPedido();
        };
    } else if (formatoContainer) {
        formatoContainer.style.display = 'none';
    }

    if (conversionSpan) {
        conversionSpan.textContent = '';
    }

    // Pre-rellenar precio del ingrediente (sin llamada API que falla con 401)
    if (precioInput && ingId) {
        precioInput.value = precioGeneral > 0 ? precioGeneral.toFixed(2) : '';
        // Store original price to detect changes
        precioInput.dataset.originalPrice = precioInput.value;
        precioInput.dataset.ingId = ingId;
        // Show update button when price differs from original
        precioInput.addEventListener('input', function () {
            const btn = this.closest('.ingrediente-item')?.querySelector('.btn-update-price');
            if (btn) {
                const changed = this.value && this.dataset.originalPrice && this.value !== this.dataset.originalPrice;
                btn.style.display = changed ? 'inline-block' : 'none';
            }
        });
    }

    window.calcularTotalPedido();
}

/**
 * Updates the ingredient's price in the database when the user clicks 💾
 */
export async function actualizarPrecioIngrediente(btnElement) {
    const row = btnElement.closest('.ingrediente-item');
    if (!row) return;
    const precioInput = row.querySelector('.precio-input');
    const selectEl = row.querySelector('select');
    if (!precioInput || !selectEl) return;

    const ingId = parseInt(precioInput.dataset.ingId);
    const newPrice = parseFloat(precioInput.value);
    const ingName = selectEl.options[selectEl.selectedIndex]?.text?.split(' (')[0] || 'Ingredient';

    if (!ingId || isNaN(newPrice) || newPrice <= 0) return;

    if (!confirm(t('pedidos:update_price_confirm', { name: ingName, price: cm(newPrice) }))) return;

    try {
        await window.api.updateIngrediente(ingId, { precio: newPrice });
        // Refresh ingredient data so the new price is visible everywhere
        const ing = (window.ingredientes || []).find(i => i.id === ingId);
        if (ing) ing.precio = newPrice;
        // Also update the option's data-precio for this row
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        if (selectedOpt) selectedOpt.dataset.precio = newPrice;
        precioInput.dataset.originalPrice = precioInput.value;
        btnElement.style.display = 'none';
        precioInput.style.borderColor = '#10b981';
        setTimeout(() => { precioInput.style.borderColor = '#ddd'; }, 2000);
        // Refresh ingredients list so the price is visible in Ingredientes tab too
        if (typeof window.renderizarIngredientes === 'function') window.renderizarIngredientes();
        window.showToast(t('pedidos:update_price_success', { name: ingName }), 'success');
    } catch (error) {
        window.showToast(t('pedidos:update_price_error', { message: error.message }), 'error');
    }
}

// Exponer al window
window.onIngredientePedidoChange = onIngredientePedidoChange;
window.actualizarPrecioIngrediente = actualizarPrecioIngrediente;

/**
 * Calcula el total del pedido
 * ⚡ OPTIMIZACIÓN: Usa Map O(1) en lugar de .find() O(n)
 * 🆕 Ahora maneja formato de compra con conversión automática
 */
export function calcularTotalPedido() {
    const items = document.querySelectorAll('#lista-ingredientes-pedido .ingrediente-item');
    let subtotalBase = 0;

    // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez, no .find() O(n) por cada item
    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));

    items.forEach(item => {
        const select = item.querySelector('select');
        const cantidadInputEl = item.querySelector('.cantidad-input');
        const formatoSelect = item.querySelector('select[id$="-formato-select"]');
        const conversionSpan = item.querySelector('span[id$="-conversion"]');
        const subtotalSpan = item.querySelector('span[id$="-subtotal"]');

        let subtotalLinea = 0;

        if (select && select.value && cantidadInputEl && cantidadInputEl.value) {
            const ing = ingMap.get(parseInt(select.value)); // O(1) lookup
            if (ing) {
                const cantidadInput = parseFloat(cantidadInputEl.value || 0);

                // Obtener multiplicador del formato (1 si es unidad base)
                let formatoMult = 1;
                let usandoFormato = false;
                if (formatoSelect && formatoSelect.parentElement?.style.display !== 'none') {
                    const selectedFormatoOption = formatoSelect.options[formatoSelect.selectedIndex];
                    formatoMult = parseFloat(selectedFormatoOption?.dataset?.formatoMult) || 1;
                    usandoFormato = formatoSelect.value === 'formato' && formatoMult && formatoMult !== 1;
                }

                // Cantidad real en unidad base (para stock)
                const cantidadReal = usandoFormato ? cantidadInput * formatoMult : cantidadInput;

                // Mostrar conversión si hay multiplicador > 1
                if (conversionSpan && usandoFormato) {
                    conversionSpan.textContent = `= ${cantidadReal.toFixed(0)} ${ing.unidad || 'ud'}`;
                    conversionSpan.style.color = '#10b981';
                    conversionSpan.style.fontWeight = '600';
                } else if (conversionSpan) {
                    conversionSpan.textContent = '';
                }

                // Usar el precio del campo de texto
                const precioInput = item.querySelector('.precio-input');
                const precioManual = precioInput ? parseFloat(precioInput.value || 0) : 0;
                const precioIngrediente = precioManual > 0 ? precioManual : parseFloat(ing.precio || 0);

                if (usandoFormato) {
                    // 💰 El precio del ingrediente YA ES el precio del FORMATO (caja, bote, garrafa)
                    // Solo multiplicar por la cantidad de formatos comprados
                    subtotalLinea = precioIngrediente * cantidadInput;
                } else {
                    // Compra por unidad base directamente
                    subtotalLinea = precioIngrediente * cantidadInput;
                }

                subtotalBase += subtotalLinea;
            }
        }

        // Actualizar subtotal de esta línea
        if (subtotalSpan) {
            subtotalSpan.textContent = cm(subtotalLinea);
        }
    });

    // Obtener IVA del campo (si existe)
    const ivaInput = document.getElementById('ped-iva');
    const ivaPorcentaje = ivaInput ? parseFloat(ivaInput.value || 0) : 0;
    const ivaImporte = subtotalBase * (ivaPorcentaje / 100);
    const totalConIva = subtotalBase + ivaImporte;

    // Actualizar displays
    const subtotalDiv = document.getElementById('total-pedido-subtotal');
    if (subtotalDiv) subtotalDiv.textContent = cm(subtotalBase);

    const ivaDiv = document.getElementById('total-pedido-iva');
    if (ivaDiv) ivaDiv.textContent = cm(ivaImporte);

    const totalDiv = document.getElementById('total-pedido');
    if (totalDiv) totalDiv.textContent = cm(totalConIva);

    const totalForm = document.getElementById('total-pedido-form');
    if (totalForm) {
        totalForm.style.display = subtotalBase > 0 ? 'block' : 'none';
        const valorSpan = document.getElementById('total-pedido-value');
        if (valorSpan) valorSpan.textContent = cm(totalConIva);
    }

    return totalConIva;
}

/**
 * Renderiza la tabla de pedidos
 * ⚡ OPTIMIZACIÓN: Pre-build Map de proveedores para lookups O(1)
 */
export function renderizarPedidos() {
    const container = document.getElementById('tabla-pedidos');
    const filtro = document.getElementById('filtro-estado-pedido')?.value || 'todos';
    const busqueda = (document.getElementById('busqueda-pedidos')?.value || '').trim().toLowerCase();

    let pedidosFiltrados = window.pedidos || [];
    if (filtro !== 'todos') {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.estado === filtro);
    }

    if (busqueda) {
        const provMapBusq = new Map((window.proveedores || []).map(p => [p.id, (p.nombre || '').toLowerCase()]));
        pedidosFiltrados = pedidosFiltrados.filter(p => {
            const provNombre = provMapBusq.get(p.proveedorId || p.proveedor_id) || '';
            const fechaStr = typeof p.fecha === 'string' && p.fecha.length === 10 ? p.fecha + 'T12:00:00' : p.fecha;
            const fechaES = p.fecha ? new Date(fechaStr).toLocaleDateString('es-ES') : '';
            const fechaISO = p.fecha ? (typeof p.fecha === 'string' ? p.fecha.slice(0, 10) : new Date(p.fecha).toISOString().slice(0, 10)) : '';
            return provNombre.includes(busqueda)
                || fechaES.includes(busqueda)
                || fechaISO.includes(busqueda);
        });
    }

    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📦</div>
        <h3>${t('pedidos:empty_no_orders')}</h3>
      </div>
    `;
        return;
    }

    // ⚡ OPTIMIZACIÓN: Crear Map O(1) una vez, no .find() O(n) por cada pedido
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));

    let html = '<table><thead><tr>';
    html +=
        `<th>ID</th><th>${t('pedidos:col_date')}</th><th>${t('pedidos:col_supplier')}</th><th>Items</th><th>Total</th><th>${t('pedidos:col_status')}</th><th>${t('ingredientes:col_actions')}</th>`;
    html += '</tr></thead><tbody>';

    pedidosFiltrados.forEach(ped => {
        const provId = ped.proveedorId || ped.proveedor_id;
        const prov = provMap.get(provId);
        const fechaStr = typeof ped.fecha === 'string' && ped.fecha.length === 10 ? ped.fecha + 'T12:00:00' : ped.fecha;
        const fecha = new Date(fechaStr).toLocaleDateString('es-ES');
        const esCompraMercado = ped.es_compra_mercado;

        html += '<tr>';
        html += `<td>#${ped.id}</td>`;
        html += `<td>${fecha}</td>`;

        // Proveedor + detalle mercado
        if (esCompraMercado && ped.detalle_mercado) {
            html += `<td>${escapeHTML(prov ? prov.nombre : t('pedidos:detail_no_supplier'))}<br><small style="color:#10b981;">📍 ${escapeHTML(ped.detalle_mercado)}</small></td>`;
        } else {
            html += `<td>${escapeHTML(prov ? prov.nombre : t('pedidos:detail_no_supplier'))}</td>`;
        }

        // Items: descripción para mercado, count para normal
        if (esCompraMercado && ped.descripcion_mercado) {
            html += `<td><small style="color:#64748b;">${escapeHTML(ped.descripcion_mercado)}</small></td>`;
        } else {
            html += `<td>${ped.ingredientes?.length || 0}</td>`;
        }

        // 🔧 FIX: Mostrar total_recibido si el pedido está recibido, si no el total original
        const totalMostrar = ped.estado === 'recibido' && ped.total_recibido ? ped.total_recibido : ped.total;
        html += `<td>${cm(parseFloat(totalMostrar || 0))}</td>`;

        const estadoClass = ped.estado === 'recibido' ? 'badge-success' : 'badge-warning';
        const estadoTexto = ped.estado === 'recibido' ? t('pedidos:status_received') : t('pedidos:status_pending');
        html += `<td><span class="badge ${estadoClass}">${estadoTexto}</span></td>`;

        html += `<td><div class="actions">`;
        html += `<button type="button" class="icon-btn view" onclick="window.verDetallesPedido(${ped.id})" title="${t('pedidos:btn_view_details')}">👁️</button>`;

        if (ped.estado === 'pendiente') {
            html += `<button type="button" class="icon-btn edit" onclick="window.abrirModalEditarPedido(${ped.id})" title="Editar pedido pendiente">✏️</button>`;
            html += `<button type="button" class="icon-btn success" onclick="window.marcarPedidoRecibido(${ped.id})" title="${t('pedidos:btn_receive')}">➡️</button>`;
        }

        if (ped.estado === 'recibido') {
            html += `<button type="button" class="icon-btn" onclick="window.repetirPedido(${ped.id})" title="Repeat order" style="color: #6366f1;">🔄</button>`;
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
        { header: t('pedidos:export_col_order_date'), value: p => { const f = typeof p.fecha === 'string' && p.fecha.length === 10 ? p.fecha + 'T12:00:00' : p.fecha; return new Date(f).toLocaleDateString('es-ES'); } },
        {
            header: t('pedidos:col_supplier'),
            value: p => {
                const prov = provMap.get(p.proveedorId);
                return prov ? prov.nombre : t('pedidos:detail_no_supplier');
            },
        },
        { header: t('pedidos:col_status'), key: 'estado' },
        { header: t('pedidos:export_col_num_ingredients'), value: p => (p.ingredientes || []).length },
        { header: t('pedidos:export_col_total'), value: p => parseFloat(p.total || 0).toFixed(2) },
        { header: t('pedidos:export_col_total_received'), value: p => parseFloat(p.total_recibido || 0).toFixed(2) },
        {
            header: t('pedidos:export_col_reception_date'),
            value: p =>
                p.fecha_recepcion ? new Date(p.fecha_recepcion).toLocaleDateString('es-ES') : '-',
        },
    ];

    window.exportarAExcel(window.pedidos, `Pedidos_${window.getRestaurantNameForFile()}`, columnas);
}
