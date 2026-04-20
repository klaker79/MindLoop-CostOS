/**
 * Chat — Voz (TTS) y acciones ejecutables por voz/chat.
 *
 * Mantiene el estado `ttsEnabled` persistido en localStorage. Expone:
 *   - isTtsEnabled() / toggleTts() para el botón del header.
 *   - speakResponse(text) para leer respuestas.
 *   - executeAction(actionData) que interpreta cadenas pipe-delimitadas
 *     (update|add|merma en ingrediente/receta/pedido/venta) y las ejecuta
 *     contra window.api. Todas las mutaciones recargan datos (window.cargarDatos)
 *     y re-renderizan la tabla correspondiente.
 *
 * Formato de `actionData`: tipo|entidad|...campos (ver inline en cada rama).
 */

import { logger } from '../../utils/logger.js';
import { cm } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

let ttsEnabled = localStorage.getItem('ttsEnabled') === 'true';

export function isTtsEnabled() {
    return ttsEnabled;
}

/**
 * Alterna el flag TTS y lo persiste. Devuelve el nuevo valor.
 */
export function toggleTts() {
    ttsEnabled = !ttsEnabled;
    localStorage.setItem('ttsEnabled', ttsEnabled);
    return ttsEnabled;
}

/**
 * Lee `text` con SpeechSynthesis si TTS está activado y el navegador lo soporta.
 * Cancela cualquier audio previo y elige voz en el idioma activo.
 */
export function speakResponse(text) {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const currentLang = window.getCurrentLanguage?.() || 'es';
    utterance.lang = currentLang === 'en' ? 'en-US' : 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(currentLang));
    if (matchedVoice) utterance.voice = matchedVoice;

    speechSynthesis.speak(utterance);
}

/**
 * Ejecuta una acción del chat.
 * Formato: tipo|entidad|campo|valor (ej: "update|ingrediente|PULPO|precio|25")
 */
export async function executeAction(actionData) {
    try {
        const parts = actionData.split('|');
        const action = parts[0];
        const entity = parts[1];
        const name = parts[2];
        const field = parts[3];
        const value = parts[4];

        if (action === 'update' && entity === 'ingrediente') {
            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(name.toLowerCase())
            );
            if (!ing) {
                logger.error('Ingrediente no encontrado:', name);
                return false;
            }

            // Stock usa ajuste atómico (delta); precio vía updateIngrediente.
            if (field === 'stock') {
                const stockActual = parseFloat(ing.stock_actual ?? ing.stockActual ?? 0);
                const nuevoValor = parseFloat(value);
                const delta = nuevoValor - stockActual;
                await window.api.adjustStock(ing.id, delta, 'chat_voice');
            } else if (field === 'precio') {
                await window.api.updateIngrediente(ing.id, { precio: parseFloat(value) });
            }

            await window.cargarDatos();
            window.renderizarIngredientes?.();

            // Si el formulario de edición está abierto para este ingrediente, actualiza sus inputs.
            if (window.editandoIngredienteId === ing.id) {
                const ingredienteActualizado = window.ingredientes?.find(i => i.id === ing.id);
                if (ingredienteActualizado) {
                    if (field === 'precio') {
                        document.getElementById('ing-precio').value = ingredienteActualizado.precio;
                    }
                    if (field === 'stock') {
                        document.getElementById('ing-stock').value =
                            ingredienteActualizado.stock_actual;
                    }
                }
            }

            window.showToast?.(`${ing.nombre} actualizado: ${field} = ${value}`, 'success');
            return true;
        } else if (action === 'update' && entity === 'receta') {
            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(name.toLowerCase())
            );
            if (!rec) {
                logger.error('Receta no encontrada:', name);
                return false;
            }

            const updates = { ...rec };
            if (field === 'precio' || field === 'precio_venta')
                updates.precio_venta = parseFloat(value);

            await window.api.updateReceta(rec.id, updates);
            await window.cargarDatos();
            window.renderizarRecetas?.();

            if (window.editandoRecetaId === rec.id) {
                const recetaActualizada = window.recetas?.find(r => r.id === rec.id);
                if (recetaActualizada) {
                    if (field === 'precio' || field === 'precio_venta') {
                        document.getElementById('rec-precio_venta').value =
                            recetaActualizada.precio_venta;
                    }
                    window.calcularCosteReceta?.();
                }
            }

            window.showToast?.(`${rec.nombre} actualizado: precio = ${cm(value)}`, 'success');
            return true;
        } else if (action === 'update' && entity === 'receta_ingrediente') {
            // update|receta_ingrediente|RECETA|INGREDIENTE|cantidad|VALOR
            const recetaNombre = parts[2];
            const ingredienteNombre = parts[3];
            const nuevaCantidad = parseFloat(parts[5]);

            if (isNaN(nuevaCantidad)) {
                logger.error('Cantidad inválida:', parts[5]);
                return false;
            }

            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(recetaNombre.toLowerCase())
            );
            if (!rec) {
                logger.error('Receta no encontrada:', recetaNombre);
                return false;
            }

            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(ingredienteNombre.toLowerCase())
            );
            if (!ing) {
                logger.error('Ingrediente no encontrado:', ingredienteNombre);
                return false;
            }

            const ingredienteIdx = rec.ingredientes?.findIndex(
                item => item.ingredienteId === ing.id
            );
            if (ingredienteIdx === -1 || ingredienteIdx === undefined) {
                logger.error('El ingrediente no está en la receta');
                return false;
            }

            // Copia inmutable del array de ingredientes.
            const nuevosIngredientes = [...rec.ingredientes];
            nuevosIngredientes[ingredienteIdx] = {
                ...nuevosIngredientes[ingredienteIdx],
                cantidad: nuevaCantidad,
            };

            const recetaActualizada = {
                ...rec,
                ingredientes: nuevosIngredientes,
            };

            await window.api.updateReceta(rec.id, recetaActualizada);
            await window.cargarDatos();
            window.renderizarRecetas?.();
            window.calcularCosteReceta?.();
            window.showToast?.(`${rec.nombre}: ${ing.nombre} ahora = ${nuevaCantidad}`, 'success');
            return true;
        }

        // add|ingrediente|NOMBRE|precio|VALOR|unidad|UNIDAD
        if (action === 'add' && entity === 'ingrediente') {
            const nombre = parts[2];
            const precio = parseFloat(parts[4]) || 0;
            const unidad = parts[6] || 'kg';

            await window.api.createIngrediente({
                nombre: nombre.toUpperCase(),
                precio: precio,
                unidad: unidad,
                stock_actual: 0,
                stock_minimo: 0,
                proveedor_id: null
            });

            await window.cargarDatos();
            window.renderizarIngredientes?.();
            window.showToast?.(`✅ Ingrediente ${nombre} creado a ${cm(precio)}/${unidad}`, 'success');
            speakResponse(`Ingrediente ${nombre} añadido correctamente`);
            return true;
        }

        // merma|ingrediente|NOMBRE|cantidad|VALOR
        if (action === 'merma' && entity === 'ingrediente') {
            const nombre = parts[2];
            const cantidad = parseFloat(parts[4]) || 0;

            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(nombre.toLowerCase())
            );
            if (!ing) {
                logger.error('Ingrediente no encontrado:', nombre);
                window.showToast?.(`Ingrediente ${nombre} no encontrado`, 'error');
                return false;
            }

            // Backend POST /api/mermas descuenta stock (simétrico con DELETE que lo restaura).
            if (window.API?.fetch) {
                await window.API.fetch('/api/mermas', {
                    method: 'POST',
                    body: JSON.stringify({
                        mermas: [{
                            ingredienteId: ing.id,
                            ingredienteNombre: ing.nombre,
                            cantidad: cantidad,
                            unidad: ing.unidad || 'ud',
                            valorPerdida: 0,
                            motivo: 'Chat/Voz',
                            nota: t('chat:note_registered_via_chat'),
                            responsableId: null
                        }]
                    })
                });
            }

            await window.cargarDatos();
            window.renderizarIngredientes?.();
            window.showToast?.(`📉 Merma registrada: -${cantidad} ${ing.unidad} de ${ing.nombre}`, 'success');
            speakResponse(`Merma de ${cantidad} ${ing.unidad} de ${ing.nombre} registrada`);
            return true;
        }

        // add|pedido|PROVEEDOR|ingrediente|NOMBRE|cantidad|VALOR|precio|PRECIO
        if (action === 'add' && entity === 'pedido') {
            const proveedorNombre = parts[2];
            const ingredienteNombre = parts[4];
            const cantidad = parseFloat(parts[6]) || 0;
            const precio = parseFloat(parts[8]) || 0;

            const proveedor = window.proveedores?.find(p =>
                p.nombre.toLowerCase().includes(proveedorNombre.toLowerCase())
            );

            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(ingredienteNombre.toLowerCase())
            );
            if (!ing) {
                window.showToast?.(`Ingrediente ${ingredienteNombre} no encontrado`, 'error');
                return false;
            }

            await window.api.createPedido({
                proveedor_id: proveedor?.id || null,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'pendiente',
                items: [{
                    ingrediente_id: ing.id,
                    cantidad: cantidad,
                    precio_unitario: precio || ing.precio
                }],
                total: cantidad * (precio || ing.precio)
            });

            await window.cargarDatos();
            window.renderizarPedidos?.();
            window.showToast?.(`📦 Pedido creado: ${cantidad} ${ing.unidad} de ${ing.nombre}`, 'success');
            speakResponse(`Pedido de ${cantidad} ${ing.unidad} de ${ing.nombre} creado`);
            return true;
        }

        // add|venta|RECETA|cantidad|VALOR
        if (action === 'add' && entity === 'venta') {
            const recetaNombre = parts[2];
            const cantidad = parseInt(parts[4]) || 1;

            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(recetaNombre.toLowerCase())
            );
            if (!rec) {
                window.showToast?.(`Receta ${recetaNombre} no encontrada`, 'error');
                return false;
            }

            const precioVenta = parseFloat(rec.precio_venta) || 0;
            const total = cantidad * precioVenta;

            await window.api.createSale({
                receta_id: rec.id,
                fecha: new Date().toISOString().split('T')[0],
                cantidad: cantidad,
                precio_unitario: precioVenta,
                total: total
            });

            await window.cargarDatos();
            window.renderizarVentas?.();
            window.showToast?.(`💰 Venta registrada: ${cantidad}x ${rec.nombre} = ${cm(total)}`, 'success');
            speakResponse(`Venta de ${cantidad} ${rec.nombre} registrada por ${total.toFixed(2)} euros`);
            return true;
        }

        logger.warn('Acción no reconocida:', actionData);
        return false;
    } catch (error) {
        logger.error('Error ejecutando acción:', error);
        window.showToast?.('Error: ' + error.message, 'error');
        return false;
    }
}
