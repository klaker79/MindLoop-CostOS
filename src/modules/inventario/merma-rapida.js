/**
 * Quick Merma Module - MEJORADO
 * Permite registrar múltiples mermas/pérdidas de producto
 * 
 * @module modules/inventario/merma-rapida
 */

import { escapeHTML } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

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
        fechaDiv.innerHTML = `${t('inventario:merma_week_of', { date: hoy.toLocaleDateString('es-ES') })}<br>📅 ${hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    }

    // Poblar selector de responsables (empleados)
    const selectResponsable = document.getElementById('merma-responsable');
    if (selectResponsable) {
        const empleados = window.empleados || [];
        let html = `<option value="">${t('inventario:merma_select_responsible')}</option>`;
        empleados.forEach(emp => {
            html += `<option value="${emp.id}">${emp.nombre}</option>`;
        });
        // Si no hay empleados, añadir opción manual
        if (empleados.length === 0) {
            html += `<option value="manual">${t('inventario:merma_register_manually')}</option>`;
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

    let html = `<option value="">${t('inventario:merma_select_product')}</option>`;
    ingredientes.forEach(ing => {
        const stock = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0).toFixed(2);
        html += `<option value="${ing.id}" data-unidad="${escapeHTML(ing.unidad || 'ud')}" data-stock="${stock}" data-precio="${ing.precio || 0}" data-formato="${ing.cantidad_por_formato || 1}">${escapeHTML(ing.nombre)} (${stock} ${escapeHTML(ing.unidad || 'ud')})</option>`;
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
                <option value="Caduco">📅 ${t('inventario:merma_reason_expired')}</option>
                <option value="Invitacion">🎁 ${t('inventario:merma_reason_invitation')}</option>
                <option value="Accidente">💥 ${t('inventario:merma_reason_accident')}</option>
                <option value="Error Cocina">👨‍🍳 ${t('inventario:merma_reason_kitchen_error')}</option>
                <option value="Error Inventario">📊 ${t('inventario:merma_reason_count_error')}</option>
                <option value="Otros">📝 ${t('inventario:merma_reason_other')}</option>
            </select>

            <!-- Valor + Eliminar -->
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                <span class="merma-valor" style="font-weight: 600; color: #dc2626; font-size: 13px; width: 55px; text-align: right;">0.00€</span>
                <button type="button" onclick="window.eliminarLineaMerma(${index})"
                    style="background: #fee2e2; color: #dc2626; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 14px; flex-shrink: 0;">×</button>
            </div>
        </div>
        <!-- Nota opcional -->
        <input type="text" class="merma-nota" placeholder="${t('inventario:merma_note_placeholder')}"
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

    // 🔒 P1-2 FIX: Guard against formato=0 (division by zero → Infinity)
    const precioUnitario = formato > 0 ? (precio / formato) : precio;
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
        detalleDiv.textContent = t('inventario:merma_products_affected', { count: totalProductos });
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
        window.showToast?.(t('inventario:merma_min_one_product'), 'warning');
        return;
    }

    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        // 🔒 FIX CRÍTICO: Recargar ingredientes ANTES de procesar mermas
        // Evita usar datos stale si el usuario acaba de editar el stock
        console.log('🔄 Recargando ingredientes antes de procesar mermas...');
        if (window.api?.getIngredientes) {
            window.ingredientes = await window.api.getIngredientes();
            console.log('✅ Ingredientes actualizados:', window.ingredientes.length);
        }

        let totalPerdida = 0;
        let productosAfectados = [];

        // Preparar datos para enviar al backend
        const mermasParaBackend = [];

        // 🔒 FIX CRÍTICO: Tracking de actualizaciones para manejar fallos parciales
        const actualizacionesExitosas = [];
        const actualizacionesFallidas = [];

        // fix C4: preparar datos primero — NO marcar éxito hasta que el backend confirme
        for (const merma of mermasARegistrar) {
            const ingrediente = (window.ingredientes || []).find(i => i.id === merma.ingredienteId);
            if (!ingrediente) {
                actualizacionesFallidas.push({
                    id: merma.ingredienteId,
                    nombre: `ID ${merma.ingredienteId}`,
                    error: t('inventario:merma_ingredient_not_found')
                });
                continue;
            }

            const cantidadMerma = parseFloat(merma.cantidad) || 0;

            // Validar cantidad
            if (isNaN(cantidadMerma) || cantidadMerma < 0) {
                actualizacionesFallidas.push({
                    id: ingrediente.id,
                    nombre: ingrediente.nombre,
                    error: t('inventario:merma_invalid_quantity', { value: merma.cantidad })
                });
                continue;
            }

            console.log(`📉 Merma preparada: ${ingrediente.nombre} - Cantidad: ${cantidadMerma}`);

            totalPerdida += merma.valorPerdida;
            productosAfectados.push(ingrediente.nombre);

            // Añadir a array para backend (se envía todo junto)
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
        }

        // 🔒 Si hubo fallos en la preparación, notificar al usuario (ingredientes no encontrados, etc.)
        if (actualizacionesFallidas.length > 0 && mermasParaBackend.length === 0) {
            const fallidos = actualizacionesFallidas.map(a => `${a.nombre}: ${a.error}`).join('\n');

            if (typeof window.hideLoading === 'function') window.hideLoading();

            alert(
                `⚠️ ${t('inventario:merma_alert_no_prepare')}\n\n` +
                `❌ Errores:\n${fallidos}`
            );
            return;
        }

        // fix C4: enviar SIEMPRE al backend — sin guard opcional
        // El éxito se marca DESPUÉS de que la API confirme, no antes
        if (mermasParaBackend.length > 0) {
            await window.API.fetch('/api/mermas', {
                method: 'POST',
                body: JSON.stringify({ mermas: mermasParaBackend })
            });
            console.log('✅ Mermas guardadas en servidor');

            // Marcar como exitosas solo tras confirmación del backend
            for (const m of mermasParaBackend) {
                actualizacionesExitosas.push({
                    id: m.ingredienteId,
                    nombre: m.ingredienteNombre,
                    cantidadMerma: m.cantidad
                });
            }
        }

        // Si algunos ingredientes no se encontraron, notificar (las mermas válidas SÍ se guardaron)
        if (actualizacionesFallidas.length > 0) {
            const exitosos = actualizacionesExitosas.map(a => a.nombre).join(', ');
            const fallidos = actualizacionesFallidas.map(a => `${a.nombre}: ${a.error}`).join('\n');

            console.error('⚠️ MERMA PARCIAL:', {
                exitosos: actualizacionesExitosas,
                fallidos: actualizacionesFallidas,
                fecha: new Date().toISOString()
            });

            alert(
                `⚠️ ${t('inventario:merma_alert_partial')}\n\n` +
                `✅ ${t('inventario:merma_alert_saved')}: ${exitosos || t('inventario:merma_alert_none')}\n\n` +
                `❌ ${t('inventario:merma_alert_prepare_failed')}:\n${fallidos}\n\n` +
                t('inventario:merma_alert_register_manually')
            );
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
            t('inventario:merma_success_count', { count: mermasARegistrar.length, total: totalPerdida.toFixed(2) }),
            'success'
        );

    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error registrando mermas:', error);
        window.showToast?.(t('inventario:merma_error', { message: error.message }), 'error');
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
        window.showToast?.(t('inventario:merma_images_only'), 'warning');
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
            window.showToast?.(t('inventario:merma_no_products_detected'), 'warning');
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

        window.showToast?.(t('inventario:merma_products_detected', { count: response.mermas.length }), 'success');

    } catch (error) {
        console.error('Error procesando imagen:', error);
        window.showToast?.(t('inventario:merma_image_error') + ': ' + error.message, 'error');
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
                <option value="Caduco" ${motivoNormalizado === 'caduco' ? 'selected' : ''}>📅 ${t('inventario:merma_reason_expired')}</option>
                <option value="Invitacion" ${motivoNormalizado === 'invitacion' ? 'selected' : ''}>🎁 ${t('inventario:merma_reason_invitation')}</option>
                <option value="Accidente" ${motivoNormalizado === 'accidente' ? 'selected' : ''}>💥 ${t('inventario:merma_reason_accident')}</option>
                <option value="Error Cocina" ${motivoNormalizado === 'error_cocina' ? 'selected' : ''}>👨‍🍳 ${t('inventario:merma_reason_kitchen_error')}</option>
                <option value="Error Inventario" ${motivoNormalizado === 'error_inventario' ? 'selected' : ''}>📊 ${t('inventario:merma_reason_count_error')}</option>
                <option value="Otros" ${motivoNormalizado === 'otros' ? 'selected' : ''}>📝 ${t('inventario:merma_reason_other')}</option>
            </select>
            
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                <span class="merma-valor" style="font-weight: 600; color: #dc2626; font-size: 13px; width: 55px; text-align: right;">0.00€</span>
                <button type="button" onclick="window.eliminarLineaMerma(${index})" 
                    style="background: #fee2e2; color: #dc2626; border: none; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 14px; flex-shrink: 0;">×</button>
            </div>
        </div>
        ${!ingredienteEncontrado ? `<div style="margin-top: 6px; font-size: 10px; color: #92400e;">⚠️ ${t('inventario:merma_not_found_warning', { product: merma.producto })}</div>` : ''}
        <input type="text" class="merma-nota" placeholder="${t('inventario:merma_note_placeholder')}"
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
