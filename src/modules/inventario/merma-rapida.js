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
        const stock = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0).toFixed(2);
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
    <div class="merma-linea" data-index="${index}" style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 80px 110px 90px; gap: 8px; align-items: center;">
            <!-- Producto -->
            <select class="merma-producto" onchange="window.actualizarLineaMerma(${index})" 
                style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                ${getIngredientesOptionsHtml()}
            </select>
            
            <!-- Cantidad -->
            <div style="display: flex; align-items: center; gap: 3px;">
                <input type="number" class="merma-cantidad" step="0.001" min="0" placeholder="0"
                    onchange="window.actualizarLineaMerma(${index})" oninput="window.actualizarLineaMerma(${index})"
                    style="width: 50px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; text-align: right;">
                <span class="merma-unidad" style="color: #64748b; font-size: 11px; min-width: 20px;">ud</span>
            </div>
            
            <!-- Motivo -->
            <select class="merma-motivo" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
                <option value="Caduco">📅 Caduco</option>
                <option value="Invitacion">🎁 Invitación</option>
                <option value="Accidente">💥 Accidente</option>
                <option value="Error Cocina">👨‍🍳 Error Cocina</option>
                <option value="Error Inventario">📊 Error Conteo</option>
                <option value="Otros">📝 Otros</option>
            </select>
            
            <!-- Valor + Eliminar -->
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                <span class="merma-valor" style="font-weight: 600; color: #dc2626; font-size: 13px; width: 55px; text-align: right;">0.00€</span>
                <button type="button" onclick="window.eliminarLineaMerma(${index})" 
                    style="background: #fee2e2; color: #dc2626; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 14px; flex-shrink: 0;">×</button>
            </div>
        </div>
        <!-- Nota opcional -->
        <input type="text" class="merma-nota" placeholder="📝 Nota (opcional)..."
            style="width: 100%; margin-top: 6px; padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; color: #64748b;">
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
        const motivo = linea.querySelector('.merma-motivo')?.value || 'Otros';
        const nota = linea.querySelector('.merma-nota')?.value || '';
        const medida = linea.querySelector('.merma-medida')?.value || 'tirar';
        const valorText = linea.querySelector('.merma-valor')?.textContent || '0.00€';
        const valor = parseFloat(valorText.replace('€', '')) || 0;

        if (ingredienteId && cantidad > 0) {
            mermasARegistrar.push({
                ingredienteId,
                cantidad,
                motivo,
                nota,
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

        // Preparar datos para enviar al backend
        const mermasParaBackend = [];

        // 🔒 FIX CRÍTICO: Tracking de actualizaciones para manejar fallos parciales
        const actualizacionesExitosas = [];
        const actualizacionesFallidas = [];

        // Procesar cada merma SECUENCIALMENTE con tracking
        for (const merma of mermasARegistrar) {
            const ingrediente = (window.ingredientes || []).find(i => i.id === merma.ingredienteId);
            if (!ingrediente) {
                actualizacionesFallidas.push({
                    id: merma.ingredienteId,
                    nombre: `ID ${merma.ingredienteId}`,
                    error: 'Ingrediente no encontrado'
                });
                continue;
            }

            const stockActualValue = parseFloat(ingrediente.stock_actual ?? ingrediente.stockActual ?? 0);
            const cantidadMerma = parseFloat(merma.cantidad) || 0;

            // Validar cantidad
            if (isNaN(cantidadMerma) || cantidadMerma < 0) {
                actualizacionesFallidas.push({
                    id: ingrediente.id,
                    nombre: ingrediente.nombre,
                    error: `Cantidad inválida: ${merma.cantidad}`
                });
                continue;
            }

            const nuevoStock = Math.max(0, stockActualValue - cantidadMerma);

            try {
                console.log(`📉 Merma: ${ingrediente.nombre} - Stock anterior: ${stockActualValue}, Restando: ${cantidadMerma}, Nuevo stock: ${nuevoStock}`);

                await window.api.updateIngrediente(merma.ingredienteId, {
                    nombre: ingrediente.nombre,
                    unidad: ingrediente.unidad,
                    precio: ingrediente.precio,
                    proveedor_id: ingrediente.proveedor_id || ingrediente.proveedorId,
                    familia: ingrediente.familia,
                    formato_compra: ingrediente.formato_compra,
                    cantidad_por_formato: ingrediente.cantidad_por_formato,
                    stock_minimo: ingrediente.stock_minimo ?? ingrediente.stockMinimo,
                    stock_actual: nuevoStock
                });

                // Trackear éxito
                actualizacionesExitosas.push({
                    id: ingrediente.id,
                    nombre: ingrediente.nombre,
                    stockAnterior: stockActualValue,
                    stockNuevo: nuevoStock,
                    cantidadMerma
                });

                totalPerdida += merma.valorPerdida;
                productosAfectados.push(ingrediente.nombre);

                // Añadir a array para backend
                mermasParaBackend.push({
                    ingredienteId: merma.ingredienteId,
                    ingredienteNombre: ingrediente.nombre,
                    cantidad: cantidadMerma,
                    unidad: ingrediente.unidad || 'ud',
                    valorPerdida: merma.valorPerdida,
                    motivo: merma.motivo,
                    nota: merma.nota || '',
                    responsableId: parseInt(responsableId) || null
                });

                // Log para auditoría
                console.log('📝 Merma registrada:', {
                    ingrediente: ingrediente.nombre,
                    cantidad: cantidadMerma,
                    motivo: merma.motivo,
                    medidaCorrectora: merma.medidaCorrectora,
                    valorPerdida: merma.valorPerdida,
                    stockAnterior: stockActualValue,
                    stockNuevo: nuevoStock,
                    responsableId,
                    fecha: new Date().toISOString()
                });

            } catch (itemError) {
                actualizacionesFallidas.push({
                    id: ingrediente.id,
                    nombre: ingrediente.nombre,
                    error: itemError.message
                });
                console.error(`❌ Error registrando merma de ${ingrediente.nombre}:`, itemError);
            }
        }

        // 🔒 FIX: Si hubo fallos parciales, notificar al usuario
        if (actualizacionesFallidas.length > 0) {
            const exitosos = actualizacionesExitosas.map(a => a.nombre).join(', ');
            const fallidos = actualizacionesFallidas.map(a => `${a.nombre}: ${a.error}`).join('\n');

            console.error('⚠️ MERMA PARCIAL:', {
                exitosos: actualizacionesExitosas,
                fallidos: actualizacionesFallidas,
                fecha: new Date().toISOString()
            });

            if (typeof window.hideLoading === 'function') window.hideLoading();

            alert(
                `⚠️ ATENCIÓN: Merma parcialmente registrada\n\n` +
                `✅ Stock actualizado: ${exitosos || 'ninguno'}\n\n` +
                `❌ Falló registrar:\n${fallidos}\n\n` +
                `Las mermas exitosas ya se aplicaron. Revisa los errores y registra las faltantes manualmente.`
            );
        }

        // Enviar mermas EXITOSAS al backend para KPI
        if (mermasParaBackend.length > 0 && window.API?.fetch) {
            try {
                await window.API.fetch('/api/mermas', {
                    method: 'POST',
                    body: JSON.stringify({ mermas: mermasParaBackend })
                });
                console.log('✅ Mermas guardadas en servidor para KPI');
            } catch (apiError) {
                console.warn('⚠️ Mermas aplicadas localmente pero no guardadas en servidor:', apiError.message);
            }
        }

        // Recargar datos
        window.ingredientes = await window.api.getIngredientes();

        // Actualizar UI
        if (typeof window.renderizarIngredientes === 'function') window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        window._forceRecalcStock = true; // Forzar recálculo porque se registró merma
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

/**
 * Procesa una foto de mermas arrastrada (drag & drop)
 */
export async function procesarFotoMerma(event) {
    event.preventDefault();

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
        window.showToast?.('Solo se permiten imágenes', 'warning');
        return;
    }

    await procesarImagenMerma(file);
}

/**
 * Procesa una foto seleccionada con input file
 */
export async function procesarFotoMermaInput(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    await procesarImagenMerma(file);
}

/**
 * Procesa la imagen y llama a la API de IA
 */
async function procesarImagenMerma(file) {
    // Mostrar loading
    const dropzone = document.getElementById('merma-dropzone');
    const contentDiv = document.getElementById('merma-dropzone-content');
    const loadingDiv = document.getElementById('merma-dropzone-loading');

    if (contentDiv) contentDiv.style.display = 'none';
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (dropzone) dropzone.style.borderColor = '#3b82f6';

    try {
        // Convertir imagen a base64
        const base64 = await fileToBase64(file);
        const imageBase64 = base64.split(',')[1]; // Quitar el prefijo data:image/...

        // Llamar a la API
        const response = await window.API.fetch('/api/parse-merma-image', {
            method: 'POST',
            body: JSON.stringify({
                imageBase64,
                mediaType: file.type
            })
        });

        if (!response.success || !response.mermas || response.mermas.length === 0) {
            window.showToast?.('No se pudieron detectar productos en la imagen', 'warning');
            resetDropzone();
            return;
        }

        // Limpiar líneas existentes
        const container = document.getElementById('merma-lineas-container');
        if (container) container.innerHTML = '';
        contadorLineas = 0;

        // Añadir líneas detectadas
        for (const merma of response.mermas) {
            agregarLineaMermaConDatos(merma);
        }

        window.showToast?.(`✅ ${response.mermas.length} productos detectados`, 'success');

    } catch (error) {
        console.error('Error procesando imagen:', error);
        window.showToast?.('Error procesando imagen: ' + error.message, 'error');
    }

    resetDropzone();
}

/**
 * Resetea la zona de drop a su estado original
 */
function resetDropzone() {
    const dropzone = document.getElementById('merma-dropzone');
    const contentDiv = document.getElementById('merma-dropzone-content');
    const loadingDiv = document.getElementById('merma-dropzone-loading');

    if (contentDiv) contentDiv.style.display = 'block';
    if (loadingDiv) loadingDiv.style.display = 'none';
    if (dropzone) {
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = '#f8fafc';
    }
}

/**
 * Convierte un archivo a base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Añade una línea de merma con datos precargados
 */
function agregarLineaMermaConDatos(merma) {
    const container = document.getElementById('merma-lineas-container');
    if (!container) return;

    const index = contadorLineas++;

    // Buscar ingrediente por nombre similar
    const ingredientes = window.ingredientes || [];
    let ingredienteEncontrado = null;
    const nombreBuscado = (merma.producto || '').toLowerCase();

    for (const ing of ingredientes) {
        if (ing.nombre.toLowerCase().includes(nombreBuscado) ||
            nombreBuscado.includes(ing.nombre.toLowerCase())) {
            ingredienteEncontrado = ing;
            break;
        }
    }

    // Mapear motivo (para fotos procesadas con IA)
    const motivoMap = {
        'caducado': 'caduco',
        'caduco': 'caduco',
        'invitacion': 'invitacion',
        'accidente': 'accidente',
        'error cocina': 'error_cocina',
        'error conteo': 'error_inventario',
        'error inventario': 'error_inventario',
        'otros': 'otros'
    };
    const motivoNormalizado = motivoMap[merma.motivo?.toLowerCase()] || 'otro';

    const lineaHtml = `
    <div class="merma-linea" data-index="${index}" style="background: ${ingredienteEncontrado ? '#f0fdf4' : '#fef3c7'}; border: 1px solid ${ingredienteEncontrado ? '#86efac' : '#fde68a'}; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 80px 110px 90px; gap: 8px; align-items: center;">
            <select class="merma-producto" onchange="window.actualizarLineaMerma(${index})" 
                style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                ${getIngredientesOptionsHtml()}
            </select>
            
            <div style="display: flex; align-items: center; gap: 3px;">
                <input type="number" class="merma-cantidad" step="0.001" min="0" value="${merma.cantidad || 0}"
                    onchange="window.actualizarLineaMerma(${index})" oninput="window.actualizarLineaMerma(${index})"
                    style="width: 50px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; text-align: right;">
                <span class="merma-unidad" style="color: #64748b; font-size: 11px; min-width: 20px;">${merma.unidad || 'ud'}</span>
            </div>
            
            <select class="merma-motivo" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px;">
                <option value="Caduco" ${motivoNormalizado === 'caduco' ? 'selected' : ''}>📅 Caduco</option>
                <option value="Invitacion" ${motivoNormalizado === 'invitacion' ? 'selected' : ''}>🎁 Invitación</option>
                <option value="Accidente" ${motivoNormalizado === 'accidente' ? 'selected' : ''}>💥 Accidente</option>
                <option value="Error Cocina" ${motivoNormalizado === 'error_cocina' ? 'selected' : ''}>👨‍🍳 Error Cocina</option>
                <option value="Error Inventario" ${motivoNormalizado === 'error_inventario' ? 'selected' : ''}>📊 Error Conteo</option>
                <option value="Otros" ${motivoNormalizado === 'otros' ? 'selected' : ''}>📝 Otros</option>
            </select>
            
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                <span class="merma-valor" style="font-weight: 600; color: #dc2626; font-size: 13px; width: 55px; text-align: right;">0.00€</span>
                <button type="button" onclick="window.eliminarLineaMerma(${index})" 
                    style="background: #fee2e2; color: #dc2626; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 14px; flex-shrink: 0;">×</button>
            </div>
        </div>
        ${!ingredienteEncontrado ? `<div style="margin-top: 6px; font-size: 10px; color: #92400e;">⚠️ No se encontró "${merma.producto}" - selecciona manualmente</div>` : ''}
        <input type="text" class="merma-nota" placeholder="📝 Nota (opcional)..."
            style="width: 100%; margin-top: 6px; padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; color: #64748b;">
    </div>
    `;

    container.insertAdjacentHTML('beforeend', lineaHtml);

    // Seleccionar el ingrediente si se encontró
    if (ingredienteEncontrado) {
        const linea = document.querySelector(`.merma-linea[data-index="${index}"]`);
        const select = linea?.querySelector('.merma-producto');
        if (select) {
            select.value = ingredienteEncontrado.id;
            actualizarLineaMerma(index);
        }
    }

    actualizarResumenMermas();
}
