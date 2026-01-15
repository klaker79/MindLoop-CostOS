/**
 * Quick Merma Module - MEJORADO
 * Permite registrar múltiples mermas/pérdidas de producto
 * 
 * @module modules/inventario/merma-rapida
 */

// Array para almacenar las líneas de merma
let lineasMerma = [];
let contadorLineas = 0;

/**
 * Muestra el modal de control de mermas mejorado
 */
export function mostrarModalMermaRapida() {
    // Reset estado
    lineasMerma = [];
    contadorLineas = 0;

    // Actualizar fecha
    const fechaDiv = document.getElementById('merma-fecha-actual');
    if (fechaDiv) {
        const hoy = new Date();
        fechaDiv.innerHTML = `Semana del ${hoy.toLocaleDateString('es-ES')}<br>📅 ${hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    }

    // Poblar selector de responsables (empleados)
    const selectResponsable = document.getElementById('merma-responsable');
    if (selectResponsable) {
        const empleados = window.empleados || [];
        let html = '<option value="">Selecciona responsable...</option>';
        empleados.forEach(emp => {
            html += `<option value="${emp.id}">${emp.nombre}</option>`;
        });
        // Si no hay empleados, añadir opción manual
        if (empleados.length === 0) {
            html += '<option value="manual">Registrar manualmente</option>';
        }
        selectResponsable.innerHTML = html;
    }

    // Limpiar contenedor de líneas
    const container = document.getElementById('merma-lineas-container');
    if (container) {
        container.innerHTML = '';
    }

    // Añadir primera línea vacía
    agregarLineaMerma();

    // Ocultar resumen
    const resumen = document.getElementById('merma-resumen');
    if (resumen) resumen.style.display = 'none';

    // Mostrar modal
    document.getElementById('modal-merma-rapida')?.classList.add('active');
}

/**
 * Genera el HTML de las opciones de ingredientes
 */
function getIngredientesOptionsHtml() {
    const ingredientes = (window.ingredientes || []).sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );

    let html = '<option value="">Selecciona producto...</option>';
    ingredientes.forEach(ing => {
        const stock = parseFloat(ing.stockActual || 0).toFixed(2);
        html += `<option value="${ing.id}" data-unidad="${ing.unidad || 'ud'}" data-stock="${stock}" data-precio="${ing.precio || 0}" data-formato="${ing.cantidad_por_formato || 1}">${ing.nombre} (${stock} ${ing.unidad || 'ud'})</option>`;
    });
    return html;
}

/**
 * Añade una nueva línea de merma al formulario
 */
export function agregarLineaMerma() {
    const container = document.getElementById('merma-lineas-container');
    if (!container) return;

    const index = contadorLineas++;

    const lineaHtml = `
    <div class="merma-linea" data-index="${index}" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; align-items: center;">
            <!-- Producto -->
            <select class="merma-producto" onchange="window.actualizarLineaMerma(${index})" 
                style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;">
                ${getIngredientesOptionsHtml()}
            </select>
            
            <!-- Cantidad -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="number" class="merma-cantidad" step="0.001" min="0" placeholder="0.00"
                    onchange="window.actualizarLineaMerma(${index})" oninput="window.actualizarLineaMerma(${index})"
                    style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;">
                <span class="merma-unidad" style="color: #64748b; font-size: 12px; min-width: 25px;">ud</span>
            </div>
            
            <!-- Motivo -->
            <select class="merma-motivo" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px;">
                <option value="caduco">📅 Caducado</option>
                <option value="nevera">🌡️ Nevera</option>
                <option value="falta_venta">📉 Falta venta</option>
                <option value="mal_estado">🦠 Mal estado</option>
                <option value="accidente">💥 Accidente</option>
                <option value="otro">📝 Otro</option>
            </select>
            
            <!-- Valor + Eliminar -->
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="merma-valor" style="font-weight: 600; color: #dc2626; min-width: 60px; text-align: right;">0.00€</span>
                <button type="button" onclick="window.eliminarLineaMerma(${index})" 
                    style="background: #fee2e2; color: #dc2626; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 16px;">×</button>
            </div>
        </div>
    </div>
    `;

    container.insertAdjacentHTML('beforeend', lineaHtml);
    actualizarResumenMermas();
}

/**
 * Actualiza una línea de merma (valor calculado)
 */
export function actualizarLineaMerma(index) {
    const linea = document.querySelector(`.merma-linea[data-index="${index}"]`);
    if (!linea) return;

    const select = linea.querySelector('.merma-producto');
    const cantidadInput = linea.querySelector('.merma-cantidad');
    const unidadSpan = linea.querySelector('.merma-unidad');
    const valorSpan = linea.querySelector('.merma-valor');

    const selectedOption = select.options[select.selectedIndex];
    const unidad = selectedOption?.dataset?.unidad || 'ud';
    const precio = parseFloat(selectedOption?.dataset?.precio || 0);
    const formato = parseFloat(selectedOption?.dataset?.formato || 1);
    const cantidad = parseFloat(cantidadInput.value) || 0;

    // Actualizar unidad
    unidadSpan.textContent = unidad;

    // Calcular precio unitario y valor de pérdida
    const precioUnitario = precio / formato;
    const valor = precioUnitario * cantidad;
    valorSpan.textContent = valor.toFixed(2) + '€';

    actualizarResumenMermas();
}

/**
 * Elimina una línea de merma
 */
export function eliminarLineaMerma(index) {
    const linea = document.querySelector(`.merma-linea[data-index="${index}"]`);
    if (linea) {
        linea.remove();
        actualizarResumenMermas();
    }
}

/**
 * Actualiza el resumen total de mermas
 */
function actualizarResumenMermas() {
    const lineas = document.querySelectorAll('.merma-linea');
    let totalProductos = 0;
    let totalPerdida = 0;

    lineas.forEach(linea => {
        const select = linea.querySelector('.merma-producto');
        const cantidad = parseFloat(linea.querySelector('.merma-cantidad')?.value) || 0;
        const valorText = linea.querySelector('.merma-valor')?.textContent || '0.00€';
        const valor = parseFloat(valorText.replace('€', '')) || 0;

        if (select.value && cantidad > 0) {
            totalProductos++;
            totalPerdida += valor;
        }
    });

    const resumenDiv = document.getElementById('merma-resumen');
    const detalleDiv = document.getElementById('merma-resumen-detalle');
    const totalDiv = document.getElementById('merma-total-perdida');

    if (totalProductos > 0) {
        resumenDiv.style.display = 'block';
        detalleDiv.textContent = `${totalProductos} producto${totalProductos > 1 ? 's' : ''} afectado${totalProductos > 1 ? 's' : ''}`;
        totalDiv.textContent = totalPerdida.toFixed(2) + '€';
    } else {
        resumenDiv.style.display = 'none';
    }
}

/**
 * Confirma y ejecuta el registro de múltiples mermas
 */
export async function confirmarMermasMultiples() {
    const responsableId = document.getElementById('merma-responsable')?.value;
    const lineas = document.querySelectorAll('.merma-linea');

    // Recolectar datos de todas las líneas válidas
    const mermasARegistrar = [];

    lineas.forEach(linea => {
        const select = linea.querySelector('.merma-producto');
        const ingredienteId = parseInt(select.value);
        const cantidad = parseFloat(linea.querySelector('.merma-cantidad')?.value) || 0;
        const motivo = linea.querySelector('.merma-motivo')?.value || 'otro';
        const medida = linea.querySelector('.merma-medida')?.value || 'tirar';
        const valorText = linea.querySelector('.merma-valor')?.textContent || '0.00€';
        const valor = parseFloat(valorText.replace('€', '')) || 0;

        if (ingredienteId && cantidad > 0) {
            mermasARegistrar.push({
                ingredienteId,
                cantidad,
                motivo,
                medidaCorrectora: medida,
                valorPerdida: valor
            });
        }
    });

    if (mermasARegistrar.length === 0) {
        window.showToast?.('Añade al menos un producto con cantidad', 'warning');
        return;
    }

    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        let totalPerdida = 0;
        let productosAfectados = [];

        // Procesar cada merma
        for (const merma of mermasARegistrar) {
            const ingrediente = (window.ingredientes || []).find(i => i.id === merma.ingredienteId);
            if (!ingrediente) continue;

            const stockActual = parseFloat(ingrediente.stockActual || 0);
            const nuevoStock = Math.max(0, stockActual - merma.cantidad);

            // Actualizar stock del ingrediente
            await window.api.updateIngrediente(merma.ingredienteId, {
                ...ingrediente,
                stockActual: nuevoStock
            });

            totalPerdida += merma.valorPerdida;
            productosAfectados.push(ingrediente.nombre);

            // Log para auditoría
            console.log('📝 Merma registrada:', {
                ingrediente: ingrediente.nombre,
                cantidad: merma.cantidad,
                motivo: merma.motivo,
                medidaCorrectora: merma.medidaCorrectora,
                valorPerdida: merma.valorPerdida,
                stockAnterior: stockActual,
                stockNuevo: nuevoStock,
                responsableId,
                fecha: new Date().toISOString()
            });
        }

        // Recargar datos
        window.ingredientes = await window.api.getIngredientes();

        // Actualizar UI
        if (typeof window.renderizarIngredientes === 'function') window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();
        if (typeof window.actualizarDashboardExpandido === 'function') window.actualizarDashboardExpandido();

        if (typeof window.hideLoading === 'function') window.hideLoading();

        // Cerrar modal
        document.getElementById('modal-merma-rapida')?.classList.remove('active');

        // Mostrar confirmación
        window.showToast?.(
            `✅ ${mermasARegistrar.length} merma${mermasARegistrar.length > 1 ? 's' : ''} registrada${mermasARegistrar.length > 1 ? 's' : ''}: ${totalPerdida.toFixed(2)}€ pérdida`,
            'success'
        );

    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error registrando mermas:', error);
        window.showToast?.('Error registrando mermas: ' + error.message, 'error');
    }
}

// Mantener compatibilidad con función anterior
export async function confirmarMermaRapida() {
    return confirmarMermasMultiples();
}
