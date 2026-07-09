import { escapeHTML, cm, getDateLocale, formatQuantity } from '../../utils/helpers.js';
import { validarDesvioPrecio } from '../../utils/precio-validator.js';
import { renderRequirementBanner, removeRequirementBanner } from '../../components/domain/RequirementBanner.js';
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
        // Destruir TomSelect previo si lo hay (al reabrir modal con diff proveedores)
        if (select.tomselect) select.tomselect.destroy();

        // ⚡ OPTIMIZACIÓN: Una sola operación DOM con map+join + ordenación A-Z
        const proveedoresOrdenados = [...(window.proveedores || [])].sort((a, b) =>
            (a.nombre || '').localeCompare(b.nombre || '')
        );
        const options = proveedoresOrdenados.map(prov =>
            `<option value="${prov.id}">${escapeHTML(prov.nombre)}</option>`
        ).join('');
        select.innerHTML = `<option value="">${t('pedidos:form_select_supplier')}</option>` + options;

        // Añadir listener para mostrar/ocultar campo detalle mercado (guard to prevent accumulation)
        if (!select._hasCampoDetalleListener) {
            select.addEventListener('change', mostrarCampoDetalleMercado);
            select._hasCampoDetalleListener = true;
        }

        // Input "Buscar..." encima del <select> nativo que filtra por substring.
        // Mismo patrón que en recetas — sin TomSelect, sin race conditions.
        import('../../utils/select-with-search.js').then(({ attachSelectSearch }) => {
            attachSelectSearch(select, { placeholder: 'Buscar proveedor...' });
        }).catch(() => {});
    }

    // Ocultar campo detalle mercado al inicio
    const campoDetalle = document.getElementById('campo-detalle-mercado');
    if (campoDetalle) campoDetalle.style.display = 'none';

    document.getElementById('formulario-pedido').style.display = 'block';
    window.cargarIngredientesPedido();
    const selProv = document.getElementById('ped-proveedor');
    if (selProv?.tomselect) selProv.tomselect.focus();
    else selProv?.focus();
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

    // Limpiar campo si se oculta (id real: ped-mercado-puesto — fix auditoría 2026-07-02,
    // antes apuntaba a 'ped-detalle-mercado' y el puesto quedaba obsoleto al cambiar proveedor)
    if (!esCompasMercado) {
        const input = document.getElementById('ped-mercado-puesto');
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

    // Seleccionar el proveedor en el dropdown (select nativo HTML5).
    // El dispatch de 'change' dispara cargarIngredientesPedido → agregarIngredientePedido,
    // que crea sincrónicamente la primera fila vacía del carrito.
    const selectProveedor = document.getElementById('ped-proveedor');
    if (selectProveedor) {
        selectProveedor.value = proveedorSeleccionado.id;
        selectProveedor.dispatchEvent(new Event('change'));
    }

    // Autoseleccionar el ingrediente buscado en la primera fila del carrito (ex-PR #490).
    // Antes la app solo seleccionaba el proveedor y el desplegable del ingrediente
    // quedaba vacío → el cliente confundía variedades del mismo proveedor (p.ej.
    // Estrella Galicia normal vs 1906 — incidente La Nave 5 2026-06-01).
    const primeraFila = document.querySelector('#lista-ingredientes-pedido .ingrediente-item');
    if (primeraFila) {
        const selectIng = primeraFila.querySelector('select');
        if (selectIng && Array.from(selectIng.options).some(o => o.value === String(ing.id))) {
            selectIng.value = String(ing.id);
            selectIng.dispatchEvent(new Event('change'));
        }
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

    // 🆕 Autorelleno IVA habitual del proveedor (Migration 013 ya alimentaba el
    // modal de recepción; aquí lo extendemos al modal de NUEVO pedido). Si el
    // proveedor no tiene iva_pct configurado, dejamos 0 (placeholder).
    const ivaInput = document.getElementById('ped-iva');
    if (ivaInput && proveedor) {
        const ivaHabitual = (proveedor.iva_pct !== null && proveedor.iva_pct !== undefined) ? proveedor.iva_pct : 0;
        ivaInput.value = ivaHabitual;
        if (typeof window.calcularTotalPedido === 'function') window.calcularTotalPedido();
    }

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
/**
 * Steppers +/− de cantidad (móvil). Sube/baja en pasos de 1 la .cantidad-input
 * de la misma línea y recalcula el total. No altera el contrato DOM (la
 * .cantidad-input sigue existiendo; solo queda dentro de .qty-stepper).
 */
window.pedidoStep = function pedidoStep(btn, delta) {
    const input = btn.parentElement?.querySelector('.cantidad-input');
    if (!input) return;
    const actual = parseFloat(input.value) || 0;
    const siguiente = Math.max(0, Math.round((actual + delta) * 100) / 100);
    input.value = siguiente;
    window.calcularTotalPedido();
};

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
    // width:100% asegura que la fila ocupe todo el contenedor —
    // sin esto la fila se quedaba en el ancho mínimo de sus hijos,
    // dejando espacio en blanco a la derecha (regresión visible
    // tras eliminar el botón 💾 en adc13a2).
    div.style.cssText =
        'display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; flex-wrap: wrap; width: 100%; box-sizing: border-box;';

    let opciones = `<option value="">${t('pedidos:form_select_ingredient')}</option>`;
    // Orden alfabético en el desplegable para que sea más fácil encontrar el ingrediente
    const ingredientesOrdenados = [...ingredientesDisponibles].sort((a, b) =>
        (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' })
    );
    ingredientesOrdenados.forEach(ing => {
        // Guardar datos del formato en data attributes
        const formatoInfo = ing.formato_compra && ing.cantidad_por_formato
            ? `data-formato="${escapeHTML(ing.formato_compra)}" data-cantidad-formato="${escapeHTML(String(ing.cantidad_por_formato))}"`
            : '';
        // Label del dropdown: mostrar SIEMPRE €/unidad-base para que el cliente
        // pueda comparar con el escandallo (que también va en unidades base).
        // Si el ingrediente tiene formato (CAJA 6 botellas, GARRAFA 5 l...), el
        // `ing.precio` es el precio del FORMATO; dividimos por cpf para obtener
        // el precio real por unidad base. Antes mostraba "80€/botella" cuando
        // realmente era 80€/CAJA — engañaba al cliente (Iker, 2026-06-08).
        const precioFormato = parseFloat(ing.precio || 0);
        const cpf = parseFloat(ing.cantidad_por_formato) > 0 ? parseFloat(ing.cantidad_por_formato) : 1;
        const precioPorUnidadBase = precioFormato / cpf;
        const unidadBase = ing.unidad || 'ud';
        opciones += `<option value="${ing.id}" ${formatoInfo} data-unidad="${escapeHTML(unidadBase)}" data-precio="${precioFormato}">${escapeHTML(ing.nombre)} (${cm(precioPorUnidadBase)}/${escapeHTML(unidadBase)})</option>`;
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
      <span class="qty-stepper" style="display: inline-flex; align-items: center; gap: 4px;">
        <button type="button" class="qty-btn" tabindex="-1" aria-label="menos" onclick="window.pedidoStep(this, -1)">−</button>
        <input type="number" placeholder="${t('pedidos:placeholder_quantity')}" step="0.01" min="0" class="cantidad-input" style="width: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; text-align: center;" oninput="window.calcularTotalPedido()">
        <button type="button" class="qty-btn" tabindex="-1" aria-label="más" onclick="window.pedidoStep(this, 1)">+</button>
      </span>
      <input type="number" placeholder="${t('pedidos:placeholder_price_unit')}" step="0.01" min="0" class="precio-input" style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; text-align: right; ${esCompraMercado ? 'border-color: #10b981; background: #f0fdf4;' : ''}" oninput="window.calcularTotalPedido()">
      <span class="precio-unidad-label" style="font-size: 11px; color: #64748b; align-self: center; min-width: 55px;"></span>
      <span id="${rowId}-subtotal" style="min-width: 70px; font-weight: 600; color: #059669; text-align: right;">${cm(0)}</span>
      <span id="${rowId}-conversion" style="font-size: 12px; color: #64748b; min-width: 110px; text-align: center;"></span>
      ${window.comidaPersonalActiva === true ? `
      <label class="personal-check" title="${escapeHTML(t('pedidos:personal_tooltip'))}" style="display: flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; cursor: pointer; user-select: none; align-self: center; white-space: nowrap;">
        <input type="checkbox" class="personal-input" onchange="this.closest('.ingrediente-item').querySelector('.personal-qty').style.display=this.checked?'inline-block':'none'" style="cursor: pointer; accent-color: #8b5cf6; width: 15px; height: 15px;">
        🍽️ ${escapeHTML(t('pedidos:personal_label'))}
      </label>
      <input type="number" step="0.01" min="0" class="personal-qty" placeholder="${escapeHTML(t('pedidos:personal_qty_ph'))}" title="${escapeHTML(t('pedidos:personal_qty_tooltip'))}" style="display: none; width: 58px; padding: 6px; border: 1px solid #8b5cf6; border-radius: 6px; text-align: center; align-self: center;">` : ''}
      <button type="button" onclick="this.parentElement.remove(); window.calcularTotalPedido()" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">×</button>
      <div id="${rowId}-precio-warning" style="display: none; flex-basis: 100%; margin-top: 6px; padding: 8px 12px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; color: #92400e; font-size: 12px; font-weight: 600;"></div>
    `;

    container.appendChild(div);

    // Input "Buscar..." encima del <select> nativo que filtra por substring.
    // Mismo patrón que en recetas — sin TomSelect, sin race conditions.
    import('../../utils/select-with-search.js').then(({ attachSelectSearch }) => {
        const ingSelect = div.querySelector('select');
        if (ingSelect) attachSelectSearch(ingSelect, { placeholder: 'Buscar ingrediente...' });
    }).catch(() => {});
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

    // Label dinámico de unidad del input precio (€/CAJA vs €/botella)
    const precioUnidadLabel = selectElement.parentElement?.querySelector('.precio-unidad-label');

    if (formato && cantidadFormato && formatoContainer && formatoSelect) {
        // Mostrar selector de formato - CAJA + UNIDAD suelta
        formatoContainer.style.display = 'block';

        // Calcular precio por unidad (precio del formato / cantidad por formato)
        const precioUnidad = precioGeneral > 0 && parseFloat(cantidadFormato) > 1
            ? (precioGeneral / parseFloat(cantidadFormato)).toFixed(2)
            : precioGeneral.toFixed(2);

        // Formatear cpf para display: NUMERIC(10,3) llega de pg como "30.000",
        // que en es-ES se LEE como "treinta mil" (punto = separador de miles).
        // Bug reportado por Iker 2026-05-12 con BARRIL (30 L) mostrándose como
        // "30.000 l". Solución: parseFloat + toLocaleString sin agrupación.
        const cpfDisplay = formatQuantity(cantidadFormato);
        formatoSelect.innerHTML = `
            <option value="formato" data-multiplicador="${cantidadFormato}" data-formato-mult="${cantidadFormato}" data-precio-formato="${precioGeneral}">${escapeHTML(formato)} (${cpfDisplay} ${unidad})</option>
            <option value="unidad" data-multiplicador="1" data-formato-mult="1" data-precio-unidad="${precioUnidad}">${escapeHTML(unidad)} (unidad suelta ~${cm(precioUnidad)})</option>
        `;
        formatoSelect.value = 'formato';

        // Inicializar label: por defecto formato seleccionado = formato (CAJA)
        if (precioUnidadLabel) precioUnidadLabel.textContent = `€/${formato}`;

        // Listener para cambiar precio automáticamente según formato seleccionado.
        // Si tenemos guardada la "última compra al proveedor" (modelo B) la usamos
        // como base, así no perdemos el autollenado del backend al cambiar formato.
        // Sin última compra, fallback a la lógica antigua basada en ing.precio.
        formatoSelect.onchange = function () {
            const selectedOpt = this.options[this.selectedIndex];
            const item = this.closest('.ingrediente-item');
            const precioInputEl = item?.querySelector('.precio-input');
            const labelEl = item?.querySelector('.precio-unidad-label');
            const ultimaCompraBtl = parseFloat(item?.dataset.ultimaCompraBtl) || 0;
            const cpf = parseFloat(cantidadFormato) || 1;
            if (precioInputEl) {
                if (this.value === 'unidad') {
                    // Input en €/unidad-base: usar última compra si existe; si no, precioUnidad fallback
                    const valor = ultimaCompraBtl > 0
                        ? ultimaCompraBtl
                        : parseFloat(selectedOpt.dataset.precioUnidad || 0);
                    precioInputEl.value = valor > 0 ? valor.toFixed(2) : '';
                    precioInputEl.style.borderColor = '#f59e0b';
                    precioInputEl.style.background = '#fffbeb';
                } else {
                    // Input en €/formato (CAJA): última compra × cpf, o precioFormato fallback
                    const valor = ultimaCompraBtl > 0
                        ? ultimaCompraBtl * cpf
                        : parseFloat(selectedOpt.dataset.precioFormato || 0);
                    precioInputEl.value = valor > 0 ? valor.toFixed(2) : '';
                    precioInputEl.style.borderColor = '#ddd';
                    precioInputEl.style.background = 'white';
                }
            }
            if (labelEl) labelEl.textContent = this.value === 'unidad' ? `€/${unidad}` : `€/${formato}`;
            window.calcularTotalPedido();
        };
    } else if (formatoContainer) {
        formatoContainer.style.display = 'none';
        // Sin formato → precio del input está siempre en €/unidad
        if (precioUnidadLabel) precioUnidadLabel.textContent = `€/${unidad}`;
    }

    if (conversionSpan) {
        conversionSpan.textContent = '';
    }

    // 🆕 Pre-rellenar precio con prioridad "última compra primero" (modelo B):
    //   1. Última compra a ese proveedor en precios_compra_diarios (refleja realidad)
    //   2. ingredientes_proveedores.precio (acuerdo configurado, fallback)
    //   3. ing.precio (fallback final, equivalente al comportamiento anterior)
    //
    // Razón: la realidad reciente es mejor predictor que un acuerdo teórico.
    // Si el proveedor cambia precios (descuentos, promociones), la última
    // compra refleja lo que está pasando ahora. El precio configurado queda
    // como red de seguridad para ingredientes que aún no se han comprado.
    //
    // Importante: el frontend mantiene la cadena `getIngredientUnitPrice` para
    // CÁLCULOS (food cost, P&L, etc.). Esto solo afecta al VALOR INICIAL del
    // input visible — el usuario puede editarlo manualmente.
    if (precioInput && ingId) {
        // Fallback inmediato (ing.precio) para no dejar el campo vacío
        precioInput.value = precioGeneral > 0 ? precioGeneral.toFixed(2) : '';

        const proveedorId = parseInt(document.getElementById('ped-proveedor')?.value);
        if (proveedorId) {
            // Aplicar precio configurado como mejora intermedia (sincrónico,
            // mientras esperamos la última compra). Si no hay última compra,
            // este queda como definitivo.
            const rel = (window.ingredientesProveedores || []).find(
                ip => ip.ingrediente_id === ingId && ip.proveedor_id === proveedorId
            );
            const tieneConfigurado = rel && parseFloat(rel.precio) > 0;
            if (tieneConfigurado) {
                // rel.precio (ingredientes_proveedores.precio) está en €/UNIDAD-BASE
                // (€/kg). Si el input está en modo FORMATO (CAJA), hay que expresarlo
                // en €/formato = €base × cpf, EXACTAMENTE como la rama de "última
                // compra" de abajo. Antes ponía el €/base crudo en el campo €/CAJA →
                // 1 caja de 3 kg salía a 16,09 € en vez de 48,27 € (bug detectado por
                // Iker probando la propagación de formato, 2026-07-09).
                const cpfCfg = parseFloat(cantidadFormato) || 1;
                const enFormatoCfg = (formatoSelect?.value === 'formato') && cpfCfg > 1;
                const valorCfg = enFormatoCfg
                    ? parseFloat(rel.precio) * cpfCfg
                    : parseFloat(rel.precio);
                precioInput.value = valorCfg.toFixed(2);
                _setHintLastPurchase(selectElement, null, 'configurado');
            }

            // Prioridad 1: última compra a ese proveedor (asíncrono — gana sobre configurado).
            // El backend almacena precio_unitario en €/unidad-base (€/btl, €/kg).
            // Lo guardamos en dataset.ultimaCompraBtl para que el handler de cambio
            // de formato lo respete (multiplicando × cpf si formato=CAJA, o tal cual
            // si formato=unidad).
            _fetchLastPurchase(ingId, proveedorId).then(last => {
                const stillSelected = parseInt(selectElement.value) === ingId;
                if (!stillSelected) return;
                if (last && last.precio_unitario > 0) {
                    const item = selectElement.closest('.ingrediente-item');
                    // Calcular precio_unitario sin pérdida de redondeo: el backend
                    // guarda precio_unitario redondeado a 4 decimales, pero `total`
                    // y `cantidad_comprada` son los valores REALES del pedido. Si
                    // están disponibles, recalcular total/cantidad evita el redondeo
                    // (ej: pedido 50€/6 botellas → precio_unitario guardado 8.33 →
                    // 8.33×6 = 49,98 ❌. Usando total/cantidad: 50/6 = 8,3333... × 6
                    // = 50,00 ✓).
                    const totalReal = parseFloat(last.total) || 0;
                    const cantidadReal = parseFloat(last.cantidad) || 0;
                    const precioBtl = (totalReal > 0 && cantidadReal > 0)
                        ? totalReal / cantidadReal
                        : parseFloat(last.precio_unitario);
                    if (item) item.dataset.ultimaCompraBtl = String(precioBtl);
                    // Aplicar al input según el formato actualmente seleccionado.
                    const formatoActual = formatoSelect?.value;
                    const cpf = parseFloat(cantidadFormato) || 1;
                    let valor = precioBtl;
                    if (formatoActual === 'formato' && cpf > 1) {
                        valor = precioBtl * cpf;
                    }
                    precioInput.value = valor.toFixed(2);
                    _setHintLastPurchase(selectElement, last.fecha, 'ultima');
                }
                // Si no hay última compra y tampoco hay configurado, dejamos el
                // fallback ing.precio que ya se aplicó arriba.
            }).catch(() => { /* fallback(s) ya aplicado(s) */ });
        }
    }

    window.calcularTotalPedido();
}

/**
 * Llama al endpoint backend que devuelve la última compra de un ingrediente
 * a un proveedor concreto. Devuelve {precio_unitario, fecha, ...} o null.
 */
async function _fetchLastPurchase(ingredienteId, proveedorId) {
    if (!window.apiClient) return null;
    try {
        return await window.apiClient.get(
            `/daily/purchases/last?ingredienteId=${ingredienteId}&proveedorId=${proveedorId}`
        );
    } catch {
        return null;
    }
}

/**
 * Muestra un hint debajo del input precio indicando de dónde viene el valor:
 *   - 'configurado': precio fijo configurado en ingredientes_proveedores
 *   - 'ultima': última compra real (con fecha)
 *   - null: limpia el hint
 */
function _setHintLastPurchase(selectElement, fecha, tipo) {
    const item = selectElement.closest('.ingrediente-item');
    if (!item) return;
    let hint = item.querySelector('.precio-fuente-hint');
    if (!hint) {
        hint = document.createElement('small');
        hint.className = 'precio-fuente-hint';
        hint.style.cssText = 'flex-basis: 100%; color: #64748b; font-size: 11px; margin-top: 2px;';
        item.appendChild(hint);
    }
    if (tipo === 'configurado') {
        hint.textContent = (window.t || (k => k))('pedidos:price_source_configured') || 'Precio configurado para este proveedor';
    } else if (tipo === 'ultima' && fecha) {
        const f = String(fecha).slice(0, 10);
        const tpl = (window.t || (k => k))('pedidos:price_source_last_purchase') || 'Última compra a este proveedor ({{date}})';
        hint.textContent = tpl.replace('{{date}}', f);
    } else {
        hint.textContent = '';
    }
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

                // 🆕 Preview inequivoco de lo que se guardara en el stock.
                // Fix B1 (incidente 2026-04-22): antes del cambio, el span era 10px
                // gris y pasaba desapercibido. Ahora se muestra destacado, y si la
                // cantidad final es absurda (>100 unidades base) se pinta de rojo
                // con ⚠️ para que el usuario pare antes de guardar.
                if (conversionSpan && usandoFormato) {
                    const unidadTxt = ing.unidad || 'ud';
                    const esAbsurdo = cantidadReal > 100;
                    conversionSpan.textContent = esAbsurdo
                        ? `⚠️ ${cantidadReal.toFixed(0)} ${unidadTxt}`
                        : `➜ ${cantidadReal.toFixed(0)} ${unidadTxt}`;
                    conversionSpan.style.color = esAbsurdo ? '#dc2626' : '#10b981';
                    conversionSpan.style.fontWeight = '700';
                    conversionSpan.style.fontSize = '12px';
                    conversionSpan.style.background = esAbsurdo ? '#fee2e2' : '#ecfdf5';
                    conversionSpan.style.padding = '2px 6px';
                    conversionSpan.style.borderRadius = '4px';
                    conversionSpan.style.whiteSpace = 'nowrap';
                    conversionSpan.title = esAbsurdo
                        ? `Cantidad inusualmente alta: se añadirán ${cantidadReal.toFixed(0)} ${unidadTxt} al stock. Revisa cantidad y formato antes de guardar.`
                        : `Se añadirán ${cantidadReal.toFixed(0)} ${unidadTxt} al stock`;
                } else if (conversionSpan) {
                    conversionSpan.textContent = '';
                    conversionSpan.style.background = '';
                    conversionSpan.style.padding = '';
                    conversionSpan.style.color = '';
                    conversionSpan.title = '';
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

                // ⚠️ Validación de desvío de subtotal: avisa al usuario si el
                // subtotal del item difiere mucho del esperado según la config del
                // ingrediente. Sirve para pillar errores de unidad (60 huevos a
                // 0,25 € → subtotal 15 € cuando esperado 180 €) o cambios bruscos
                // de precio (subida del proveedor).
                const warningDiv = document.getElementById(`${item.id}-precio-warning`);
                if (warningDiv) {
                    const aviso = validarDesvioPrecio(ing, cantidadReal, subtotalLinea);
                    if (aviso) {
                        warningDiv.textContent = aviso.mensaje;
                        warningDiv.style.display = 'block';
                    } else {
                        warningDiv.textContent = '';
                        warningDiv.style.display = 'none';
                    }
                }
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

    // 🚦 Gating suave: sin proveedores no puedes crear pedidos. Banner ámbar arriba
    // del tab. Se quita solo cuando hay >=1 proveedor.
    const tabPedidos = document.getElementById('tab-pedidos');
    const totalProveedores = (window.proveedores || []).length;
    if (tabPedidos && totalProveedores === 0) {
        renderRequirementBanner(tabPedidos, {
            id: 'gating-pedidos-sin-proveedores',
            message: 'Necesitas al menos un proveedor para registrar pedidos. Crea uno desde la pestaña Proveedores.',
            ctaLabel: 'Ir a Proveedores',
            ctaTab: 'proveedores'
        });
    } else {
        removeRequirementBanner('gating-pedidos-sin-proveedores');
    }

    let pedidosFiltrados = window.pedidos || [];
    if (filtro !== 'todos') {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.estado === filtro);
    }

    if (busqueda) {
        const provMapBusq = new Map((window.proveedores || []).map(p => [p.id, (p.nombre || '').toLowerCase()]));
        pedidosFiltrados = pedidosFiltrados.filter(p => {
            const provNombre = provMapBusq.get(p.proveedorId || p.proveedor_id) || '';
            const fechaStr = typeof p.fecha === 'string' && p.fecha.length === 10 ? p.fecha + 'T12:00:00' : p.fecha;
            // 🔒 Auditoría Capa 7 (S9): búsqueda usa locale del usuario (era 'es-ES' fijo)
            const fechaLocal = p.fecha ? new Date(fechaStr).toLocaleDateString(getDateLocale()) : '';
            const fechaISO = p.fecha ? (typeof p.fecha === 'string' ? p.fecha.slice(0, 10) : new Date(p.fecha).toISOString().slice(0, 10)) : '';
            return provNombre.includes(busqueda)
                || fechaLocal.includes(busqueda)
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
        // 🔒 Auditoría Capa 7 (S9): locale dinámico
        const fecha = new Date(fechaStr).toLocaleDateString(getDateLocale());
        const esCompraMercado = ped.es_compra_mercado;

        // 📱 Labels para vista móvil (tarjetas) — usan las MISMAS strings que el <thead>.
        // Si data-label se ignora en desktop no afecta a nada; en móvil el CSS lo muestra.
        const lblDate = t('pedidos:col_date');
        const lblSupplier = t('pedidos:col_supplier');
        const lblStatus = t('pedidos:col_status');
        const lblActions = t('ingredientes:col_actions');

        html += '<tr>';
        html += `<td data-label="ID">#${ped.id}</td>`;
        html += `<td data-label="${lblDate}">${fecha}</td>`;

        // Proveedor + detalle mercado
        if (esCompraMercado && ped.detalle_mercado) {
            html += `<td data-label="${lblSupplier}">${escapeHTML(prov ? prov.nombre : t('pedidos:detail_no_supplier'))}<br><small style="color:#10b981;">📍 ${escapeHTML(ped.detalle_mercado)}</small></td>`;
        } else {
            html += `<td data-label="${lblSupplier}">${escapeHTML(prov ? prov.nombre : t('pedidos:detail_no_supplier'))}</td>`;
        }

        // Items: descripción para mercado, count para normal
        if (esCompraMercado && ped.descripcion_mercado) {
            html += `<td data-label="Items"><small style="color:#64748b;">${escapeHTML(ped.descripcion_mercado)}</small></td>`;
        } else {
            html += `<td data-label="Items">${ped.ingredientes?.length || 0}</td>`;
        }

        // 🔧 FIX: Mostrar total_recibido si el pedido está recibido, si no el total original
        const totalMostrar = ped.estado === 'recibido' && ped.total_recibido ? ped.total_recibido : ped.total;
        html += `<td data-label="Total">${cm(parseFloat(totalMostrar || 0))}</td>`;

        const estadoClass = ped.estado === 'recibido' ? 'badge-success' : 'badge-warning';
        const estadoTexto = ped.estado === 'recibido' ? t('pedidos:status_received') : t('pedidos:status_pending');
        html += `<td data-label="${lblStatus}"><span class="badge ${estadoClass}">${estadoTexto}</span></td>`;

        html += `<td data-label="${lblActions}"><div class="actions">`;
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
        // 🔒 Auditoría Capa 7 (S9): locale dinámico también en export Excel
        { header: t('pedidos:export_col_order_date'), value: p => { const f = typeof p.fecha === 'string' && p.fecha.length === 10 ? p.fecha + 'T12:00:00' : p.fecha; return new Date(f).toLocaleDateString(getDateLocale()); } },
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
                p.fecha_recepcion ? new Date(p.fecha_recepcion).toLocaleDateString(getDateLocale()) : '-',
        },
    ];

    window.exportarAExcel(window.pedidos, `Pedidos_${window.getRestaurantNameForFile()}`, columnas);
}
