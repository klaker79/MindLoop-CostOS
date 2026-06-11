/**
 * Módulo de Ingredientes - CRUD
 * Operaciones de crear, editar y eliminar ingredientes
 */

import { showToast } from '../../ui/toast.js';
import { getElement, getInputValue } from '../../utils/dom-helpers.js';
import { escapeHTML, formatQuantity } from '../../utils/helpers.js';
import { calcularPreviewPrecioUnidad } from './precio-unidad-preview.js';
import { detectarAlergenos } from './alergenos-deteccion.js';
import { setEditandoIngredienteId } from './ingredientes-ui.js';

// 🆕 En cuanto el usuario toca un checkbox de alérgeno a mano, dejamos de
// auto-sugerir por el nombre (no le pisamos su decisión). Listener delegado
// único (los checkboxes son estáticos en index.html). Un cambio PROGRAMÁTICO
// (chk.checked = x) NO dispara 'change', así que esto solo se activa con clic.
if (typeof document !== 'undefined') {
    document.addEventListener('change', (e) => {
        if (e.target?.classList?.contains('ing-alergeno')) window._alergenosManual = true;
    });
}

/**
 * Pre-marca los alérgenos sugeridos según el NOMBRE del ingrediente. Solo
 * mientras el usuario no haya tocado los checkboxes a mano (window._alergenosManual).
 * SOLO sugerencia — el usuario confirma. Llamada con oninput desde #ing-nombre.
 */
export function sugerirAlergenosPorNombre() {
    if (window._alergenosManual) return;
    const nombre = getInputValue('ing-nombre');
    const sugeridos = detectarAlergenos(nombre);
    const set = new Set(sugeridos);
    document.querySelectorAll('.ing-alergeno').forEach(chk => {
        chk.checked = set.has(chk.value); // programático → no marca _alergenosManual
    });
    const hint = getElement('ing-alergenos-hint');
    if (hint) hint.style.display = sugeridos.length ? 'block' : 'none';
}
// 🆕 Zustand store para gestión de estado
import ingredientStore from '../../stores/ingredientStore.js';
// 🆕 Validación centralizada
import { validateIngrediente, showValidationErrors } from '../../utils/validation.js';
import { t } from '@/i18n/index.js';

/**
 * Guarda un ingrediente (crear o actualizar)
 */
let _guardandoIngrediente = false; // 🔒 FIX: Prevenir doble submit
export async function guardarIngrediente(event) {
    event.preventDefault();

    // 🔒 FIX: Prevenir múltiples clicks
    if (_guardandoIngrediente) {
        console.warn('⚠️ Operación en curso, ignorando click duplicado');
        return;
    }
    _guardandoIngrediente = true;
    // 🔒 FIX F3: Deshabilitar botón visualmente para feedback al usuario
    const submitBtn = document.querySelector('#formulario-ingrediente button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    // 🔒 FIX CRÍTICO: Solo incluir stock si el campo tiene valor
    // Antes: stockActual: parseFloat(x) || 0 → convertía vacío a 0
    // Ahora: undefined si está vacío → backend preserva valor actual
    const stockActualValue = getInputValue('ing-stockActual');
    const stockMinimoValue = getInputValue('ing-stockMinimo');

    const ingrediente = {
        nombre: getInputValue('ing-nombre'),
        proveedorId: getInputValue('ing-proveedor-select') || null,
        precio: parseFloat(getInputValue('ing-precio')) || 0,
        unidad: getInputValue('ing-unidad'),
        familia: getInputValue('ing-familia') || 'alimento',
        // 🔒 H2 FIX: Clampar rendimiento a rango válido (1-100%)
        rendimiento: Math.max(1, Math.min(100, parseFloat(getInputValue('ing-rendimiento')) || 100)),
        // Solo enviar si tiene valor, undefined = backend preserva actual
        stock_actual: stockActualValue !== '' ? parseFloat(stockActualValue) : undefined,
        stock_minimo: stockMinimoValue !== '' ? parseFloat(stockMinimoValue) : undefined,
        formato_compra: getInputValue('ing-formato-compra') || null,
        // 🔒 FIX: Solo enviar cantidad_por_formato si el usuario la editó explícitamente
        // undefined = no cambiar, null = borrar intencionalmente
        cantidad_por_formato: getInputValue('ing-cantidad-formato')
            ? parseFloat(getInputValue('ing-cantidad-formato'))
            : undefined,
        // 🆕 Alérgenos UE: array de códigos de los checkboxes marcados.
        alergenos: Array.from(document.querySelectorAll('.ing-alergeno:checked')).map(c => c.value),
    };

    // 🆕 Validación centralizada (reemplaza validación manual)
    const validation = validateIngrediente(ingrediente);
    if (!validation.valid) {
        showValidationErrors(validation.errors);
        _guardandoIngrediente = false;
        // 🔒 FIX: rehabilitar el botón al fallar la validación. Antes se quedaba
        // disabled (gris) tras un guardado bloqueado y solo se recuperaba recargando.
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    // 🆕 Detección de duplicado por nombre (2026-06-08). Iker se chocó hoy con
    // 2 PATATAS distintas: el descuento de stock se aplicó al ingrediente
    // "fantasma" sin que el usuario se diese cuenta. Para prevenir el caso
    // raíz, antes de CREAR (no editar) buscamos si ya hay un ingrediente con
    // el mismo nombre normalizado (sin acentos, lowercase, trim). Si lo hay,
    // confirmamos con el usuario antes de duplicar.
    const editandoId_dup = window.editandoIngredienteId;
    if (editandoId_dup === null || editandoId_dup === undefined) {
        const normalizar = (s) => String(s || '')
            .trim()
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '');
        const nombreNorm = normalizar(ingrediente.nombre);
        const duplicado = (window.ingredientes || []).find(i =>
            normalizar(i.nombre) === nombreNorm
        );
        if (duplicado) {
            const proveedorMsg = duplicado.proveedor_nombre
                ? ` (proveedor: ${duplicado.proveedor_nombre})`
                : '';
            const stockMsg = duplicado.stock_actual !== null && duplicado.stock_actual !== undefined
                ? ` con stock ${parseFloat(duplicado.stock_actual)} ${duplicado.unidad || ''}`
                : '';
            const continuar = window.confirm(
                `Ya existe un ingrediente llamado "${duplicado.nombre}"${proveedorMsg}${stockMsg}.\n\n` +
                `Crear otro con el mismo nombre puede fragmentar tu stock y descuentos. ` +
                `Si solo cambia el proveedor, te recomendamos editar el existente y añadir el nuevo proveedor desde su ficha.\n\n` +
                `¿Quieres crear uno NUEVO igualmente?`
            );
            if (!continuar) {
                _guardandoIngrediente = false;
                if (submitBtn) submitBtn.disabled = false;
                return;
            }
        }
    }

    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        const editandoId = window.editandoIngredienteId;
        let ingredienteId;

        // 🔍 DEBUG: Ver qué se envía al backend
        console.log('📤 Guardando ingrediente:', JSON.stringify(ingrediente, null, 2));
        console.log('📤 Stock enviado:', ingrediente.stockActual, '(tipo:', typeof ingrediente.stockActual, ')');

        // 🔒 P0-2 FIX: Capturar datos del ingrediente ANTES del store update
        // El store sincroniza window.ingredientes inmediatamente, así que después
        // de updateIngredient() ya contiene los datos nuevos, no los anteriores.
        const ingredienteAnterior = editandoId !== null
            ? (window.ingredientes || []).find(i => i.id === editandoId)
            : null;

        // 🆕 Usar Zustand store en lugar de window.api
        const store = ingredientStore.getState();

        if (editandoId !== null) {
            console.log('📤 Actualizando ID:', editandoId);
            const result = await store.updateIngredient(editandoId, ingrediente);
            if (!result.success) throw new Error(result.error || 'Error actualizando ingrediente');
            ingredienteId = editandoId;
        } else {
            const result = await store.createIngredient(ingrediente);
            if (!result.success) throw new Error(result.error || 'Error creando ingrediente');
            ingredienteId = result.data.id;
        }

        // Sync bidireccional: Actualizar relación ingrediente-proveedor
        const nuevoProveedorId = ingrediente.proveedorId ? parseInt(ingrediente.proveedorId) : null;

        // Si estamos editando, usar el ingredienteAnterior capturado ANTES del store update
        if (editandoId !== null) {
            const proveedorAnteriorId = ingredienteAnterior?.proveedor_id || ingredienteAnterior?.proveedorId;

            // Si cambió de proveedor, quitar del anterior
            if (proveedorAnteriorId && proveedorAnteriorId !== nuevoProveedorId) {
                const proveedorAnterior = (window.proveedores || []).find(p => p.id === proveedorAnteriorId);
                if (proveedorAnterior && proveedorAnterior.ingredientes) {
                    const nuevaLista = proveedorAnterior.ingredientes.filter(id => id !== editandoId);
                    if (nuevaLista.length !== proveedorAnterior.ingredientes.length) {
                        await window.api.updateProveedor(proveedorAnterior.id, {
                            ...proveedorAnterior,
                            ingredientes: nuevaLista,
                        });
                    }
                }
            }
        }

        // Si se seleccionó un nuevo proveedor, añadir ingrediente a su lista
        if (nuevoProveedorId) {
            const proveedor = (window.proveedores || []).find(p => p.id === nuevoProveedorId);
            if (proveedor) {
                const ingredientesDelProveedor = proveedor.ingredientes || [];
                if (!ingredientesDelProveedor.includes(ingredienteId)) {
                    ingredientesDelProveedor.push(ingredienteId);
                    await window.api.updateProveedor(proveedor.id, {
                        ...proveedor,
                        ingredientes: ingredientesDelProveedor,
                    });
                }
            }
        }

        // 🆕 Auto-asociar proveedor con precio
        // 🔧 FIX: Ejecutar de forma síncrona (await) en lugar de setTimeout
        // El setTimeout causaba condiciones de carrera con otras operaciones
        if (nuevoProveedorId && ingrediente.precio > 0) {
            const idIngrediente = ingredienteId;
            const idProveedor = parseInt(nuevoProveedorId);
            const precioProveedor = parseFloat(ingrediente.precio);

            try {
                const proveedoresAsociados = await window.API.fetch(`/ingredients/${idIngrediente}/suppliers`) || [];
                const yaAsociado = Array.isArray(proveedoresAsociados) && proveedoresAsociados.some(p => p.proveedor_id === idProveedor);

                if (!yaAsociado) {
                    await window.API.fetch(`/ingredients/${idIngrediente}/suppliers`, {
                        method: 'POST',
                        body: JSON.stringify({
                            proveedor_id: idProveedor,
                            precio: precioProveedor,
                            es_proveedor_principal: true,
                        }),
                    });
                    console.log(`✅ Proveedor ${idProveedor} asociado al ingrediente ${idIngrediente}`);
                }
            } catch (err) {
                // No bloqueante - solo warning si falla
                console.warn('Auto-asociar proveedor (no crítico):', err?.message);
            }
        }

        // Recargar proveedores para tener datos actualizados
        window.proveedores = await window.api.getProveedores();

        // ⚡ OPTIMIZACIÓN: Actualización optimista - Recargamos ingredientes e inventario completo
        window.ingredientes = await window.api.getIngredientes();
        // FIX: Sincronizar inventarioCompleto para evitar precios desactualizados en UI
        if (window.api.getInventoryComplete) {
            window.inventarioCompleto = await window.api.getInventoryComplete();
        }

        // Actualizar maps de búsqueda
        if (window.dataMaps) {
            window.dataMaps.ingredientesMap = new Map(window.ingredientes.map(i => [i.id, i]));
        }

        // Invalidar cache de costes de recetas
        if (window.Performance?.invalidarCacheIngredientes) {
            window.Performance.invalidarCacheIngredientes();
        }

        window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        window._forceRecalcStock = true; // Forzar recálculo porque cambió un ingrediente
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();
        if (typeof window.actualizarDashboardExpandido === 'function')
            window.actualizarDashboardExpandido();

        if (typeof window.hideLoading === 'function') window.hideLoading();
        showToast(editandoId ? t('ingredientes:toast_updated') : t('ingredientes:toast_created'), 'success');
        window.cerrarFormularioIngrediente();
    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error:', error);

        // 🔒 FIX: Mensaje amigable para duplicados (409 Conflict)
        if (error.message && (error.message.includes('ya existe') || error.message.includes('409'))) {
            showToast(t('ingredientes:toast_duplicate'), 'warning');
        } else {
            showToast(t('ingredientes:toast_error_saving', { message: error.message }), 'error');
        }
    } finally {
        // 🔒 FIX: Siempre liberar el flag para permitir nuevos guardados
        _guardandoIngrediente = false;
        // 🔒 FIX F3: Re-habilitar botón
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Edita un ingrediente cargando sus datos en el formulario
 */
export function editarIngrediente(id) {
    const ingredientes = window.ingredientes || [];
    const ing = ingredientes.find(i => i.id === id);
    if (!ing) return;

    // Primero actualizar estado de edición
    window.editandoIngredienteId = id;
    setEditandoIngredienteId(id);

    const titleEl = getElement('form-title-ingrediente');
    if (titleEl) titleEl.textContent = t('ingredientes:form_title_edit');

    const btnEl = getElement('btn-text-ingrediente');
    if (btnEl) btnEl.textContent = t('ingredientes:btn_save');

    // Mostrar formulario PRIMERO (esto actualiza el select de proveedores)
    window.mostrarFormularioIngrediente();

    // AHORA rellenar los campos (después de que el select tenga las opciones)
    const nombreEl = getElement('ing-nombre');
    if (nombreEl) nombreEl.value = ing.nombre;

    // Establecer proveedor DESPUÉS de que el select esté poblado
    const provEl = getElement('ing-proveedor-select');
    if (provEl) {
        const provId = ing.proveedor_id || ing.proveedorId || '';
        provEl.value = provId;
        // Si no se seleccionó correctamente, intentar con timeout
        if (provId && provEl.value !== String(provId)) {
            setTimeout(() => {
                provEl.value = provId;
            }, 50);
        }
    }

    const precioEl = getElement('ing-precio');
    if (precioEl) precioEl.value = ing.precio || '';

    // Enriquecer el hint del precio con el PMC actual del ingrediente.
    // El backend recalcula `ing.precio = PMC × cpf` tras cada pedido recibido
    // (businessHelpers.recalcularPrecioPonderado), así que precio / cpf = PMC.
    // Mostrarlo aquí le da al usuario transparencia: ve de dónde sale el número.
    const hintEl = getElement('ing-precio-hint');
    if (hintEl) {
        const precio = parseFloat(ing.precio) || 0;
        const cpf = parseFloat(ing.cantidad_por_formato) > 0 ? parseFloat(ing.cantidad_por_formato) : 1;
        // ing.unidad y ing.formato_compra vienen de input del usuario → escapar antes de inyectar.
        const unidadBase = escapeHTML(ing.unidad || 'ud');
        const formato = escapeHTML(ing.formato_compra || '');
        const pmc = precio / cpf;
        let detalle = '';
        if (precio > 0) {
            if (formato && cpf > 1) {
                detalle = ` Actualmente: <strong>${pmc.toFixed(2)}€/${unidadBase} × ${cpf} = ${precio.toFixed(2)}€/${formato}</strong>.`;
            } else {
                detalle = ` Actualmente: <strong>${precio.toFixed(2)}€/${unidadBase}</strong>.`;
            }
        }
        hintEl.innerHTML = `💡 La app recalcula este precio automáticamente tras cada pedido recibido (precio medio de compras × cantidad por formato).${detalle} Si lo editas a mano, el siguiente pedido lo sobreescribirá.`;
    }

    const unidadEl = getElement('ing-unidad');
    if (unidadEl) unidadEl.value = ing.unidad;

    const stockEl = getElement('ing-stockActual');
    // 🔒 FIX CRÍTICO: Backend devuelve stock_actual, frontend usaba stockActual
    if (stockEl) stockEl.value = ing.stock_actual ?? ing.stockActual ?? '';

    const minEl = getElement('ing-stockMinimo');
    // 🔒 FIX: También usar ambos nombres para stock mínimo
    if (minEl) minEl.value = ing.stock_minimo ?? ing.stockMinimo ?? '';

    // Cargar familia
    const familiaEl = getElement('ing-familia');
    if (familiaEl) familiaEl.value = ing.familia || 'alimento';

    // Cargar rendimiento
    const rendimientoEl = getElement('ing-rendimiento');
    const sliderEl = getElement('ing-rendimiento-slider');
    const valorVisualEl = getElement('ing-rendimiento-val');

    if (rendimientoEl) {
        const val = ing.rendimiento !== undefined && ing.rendimiento !== null ? ing.rendimiento : 100;
        rendimientoEl.value = val;

        // Sincronizar UI del slider
        if (sliderEl) sliderEl.value = val;
        if (valorVisualEl) {
            valorVisualEl.textContent = val + '%';
            valorVisualEl.style.color = val < 50 ? '#ef4444' : val < 80 ? '#f59e0b' : '#10b981';
        }
    }

    // Reinicializar eventos para asegurar que funcionen
    if (window.setupYieldSlider) window.setupYieldSlider();

    // Cargar formato de compra
    const formatoEl = getElement('ing-formato-compra');
    if (formatoEl) formatoEl.value = ing.formato_compra || '';

    const cantFormatoEl = getElement('ing-cantidad-formato');
    // 🔒 FIX: Mostrar el valor aunque sea 0 (solo ocultar si es null/undefined)
    if (cantFormatoEl) cantFormatoEl.value = ing.cantidad_por_formato !== null && ing.cantidad_por_formato !== undefined
        ? ing.cantidad_por_formato
        : '';

    // 🆕 Cargar alérgenos: limpiar todos y marcar los presentes en ing.alergenos.
    const alergenosIng = Array.isArray(ing.alergenos) ? ing.alergenos : [];
    document.querySelectorAll('.ing-alergeno').forEach(chk => {
        chk.checked = alergenosIng.includes(chk.value);
    });
    // En edición ya hay alérgenos guardados → NO auto-sugerir por el nombre
    // (no pisar lo que el usuario validó antes). El hint se oculta.
    window._alergenosManual = true;
    const hintEdit = getElement('ing-alergenos-hint');
    if (hintEdit) hintEdit.style.display = 'none';

    // Refrescar el preview de precio por unidad con los datos cargados.
    actualizarPreviewPrecioUnidad();
}

/**
 * Pinta en vivo, bajo el formato, qué precio por unidad base usará la app y avisa
 * si la combinación es incoherente (cpf>1 sin nombre de formato, o cpf>1 con una
 * unidad "contable" tipo 'unidad'/'botella' que casi siempre debería ser g/ml).
 * Evita el bug mermelada (unidad=unidad + 750 por formato → 0,004 €/unidad).
 * Lógica de cálculo aislada y testeada en precio-unidad-preview.js.
 */
export function actualizarPreviewPrecioUnidad() {
    const el = getElement('ing-precio-unidad-preview');
    if (!el) return;

    const r = calcularPreviewPrecioUnidad({
        precio: getInputValue('ing-precio'),
        cantidadPorFormato: getInputValue('ing-cantidad-formato'),
        formato: getInputValue('ing-formato-compra'),
        unidad: getInputValue('ing-unidad'),
    });

    if (!r.visible) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }

    const moneda = window.currentUser?.moneda || '€';
    const u = escapeHTML(r.unidad);
    const nombreFormato = escapeHTML(r.formato || 'formato');

    let html = '';
    if (r.cpf > 1) {
        html += `<div>Compras <strong>1 ${nombreFormato}</strong> = <strong>${escapeHTML(formatQuantity(r.cpf))} ${u}</strong> por <strong>${r.precio.toFixed(2)} ${escapeHTML(moneda)}</strong></div>`;
    }
    html += `<div style="margin-top:4px;">→ La app usará <strong>${escapeHTML(formatQuantity(r.unitPrice))} ${escapeHTML(moneda)}/${u}</strong> para el coste / food cost</div>`;

    let bg = '#ecfdf5';
    let border = '#10b981';
    if (r.level === 'falta_nombre') {
        bg = '#fef2f2';
        border = '#ef4444';
        html += `<div style="margin-top:6px;font-weight:600;color:#b91c1c;">⚠️ Pon el nombre del formato (ej. BOTE, CAJA) o deja vacía la cantidad por formato si compras por unidad.</div>`;
    } else if (r.level === 'sospechoso') {
        bg = '#fffbeb';
        border = '#f59e0b';
        html += `<div style="margin-top:6px;font-weight:600;color:#92400e;">⚠️ Estás diciendo que <strong>1 ${nombreFormato} = ${escapeHTML(formatQuantity(r.cpf))} ${u}</strong>. Si en realidad es peso/volumen (ej. un bote de 750 g), cambia la <strong>Unidad</strong> a g / ml / kg / l.</div>`;
    }

    el.style.display = 'block';
    el.style.background = bg;
    el.style.borderLeft = `3px solid ${border}`;
    el.innerHTML = html;
}

/**
 * Elimina un ingrediente
 * 🔧 FIX: Añadido lock para prevenir múltiples eliminaciones por clicks rápidos
 */
let _eliminandoIngrediente = false;

export async function eliminarIngrediente(id) {
    // 🔧 FIX: Prevenir múltiples eliminaciones simultáneas
    if (_eliminandoIngrediente) {
        console.warn('⚠️ Eliminación ya en progreso, ignorando click adicional');
        return;
    }

    const confirmar = window.confirm(t('ingredientes:confirm_delete'));
    if (!confirmar) return;

    _eliminandoIngrediente = true;

    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = ingredientStore.getState();
        const result = await store.deleteIngredient(id);
        if (!result.success) throw new Error(result.error || 'Error eliminando ingrediente');

        // El store ya actualiza window.ingredientes automáticamente

        // Actualizar maps de búsqueda
        if (window.dataMaps) {
            window.dataMaps.ingredientesMap.delete(id);
        }

        // Invalidar cache
        if (window.Performance?.invalidarCacheIngredientes) {
            window.Performance.invalidarCacheIngredientes();
        }

        window.renderizarIngredientes();
        if (typeof window.renderizarInventario === 'function') window.renderizarInventario();
        window._forceRecalcStock = true; // Forzar recálculo porque se eliminó ingrediente
        if (typeof window.actualizarKPIs === 'function') window.actualizarKPIs();
        if (typeof window.actualizarDashboardExpandido === 'function')
            window.actualizarDashboardExpandido();

        if (typeof window.hideLoading === 'function') window.hideLoading();
        if (typeof showToast === 'function') {
            showToast(t('ingredientes:toast_deleted'), 'success');
        } else if (typeof window.showToast === 'function') {
            window.showToast(t('ingredientes:toast_deleted'), 'success');
        }
    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error eliminando ingrediente:', error);
        const toastFn = typeof showToast === 'function' ? showToast : window.showToast;
        if (typeof toastFn === 'function') {
            toastFn(t('ingredientes:toast_error_deleting', { message: error.message }), 'error');
        }
    } finally {
        // 🔧 FIX: Liberar lock después de completar (éxito o error)
        _eliminandoIngrediente = false;
    }
}

/**
 * Toggle activo/inactivo ingrediente
 * En lugar de eliminar, desactiva el ingrediente para preservar historial
 */
export async function toggleIngredienteActivo(id, activo) {
    if (typeof window.showLoading === 'function') window.showLoading();

    try {
        const result = await window.API.toggleIngredientActive(id, activo);

        if (!result || result.error) {
            throw new Error(result?.error || 'Error al cambiar estado');
        }

        // Actualizar en array local
        const ing = (window.ingredientes || []).find(i => i.id === id);
        if (ing) {
            ing.activo = activo;
        }

        // Re-renderizar
        window.renderizarIngredientes?.();

        if (typeof window.hideLoading === 'function') window.hideLoading();
        showToast(activo ? t('ingredientes:toast_activated') : t('ingredientes:toast_deactivated'), 'success');
    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('Error toggle activo:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// Exponer globalmente
window.toggleIngredienteActivo = toggleIngredienteActivo;
