/**
 * Recetas CRUD Module
 * Funciones de creación, edición y eliminación de recetas
 */

// 🆕 Zustand store para gestión de estado
import recipeStore from '../../stores/recipeStore.js';
// 🆕 Validación centralizada
import { validateReceta, showValidationErrors } from '../../utils/validation.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { t } from '@/i18n/index.js';

/**
 * Guarda una receta (nueva o editada)
 * @param {Event} event - Evento del formulario
 */
export async function guardarReceta(event) {
    event.preventDefault();

    const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
    const ingredientesReceta = [];

    items.forEach(item => {
        const select = item.querySelector('select');
        // ⚠️ NO usar item.querySelector('input') — attachSelectSearch inserta
        // un input "🔍 Buscar..." ANTES del select; sería el primer match y
        // siempre estaría vacío → la receta se guardaría con ingredientes
        // vacíos. Mismo bug que en recetas-ui.js:calcularCosteReceta.
        // Detectado 2026-05-12 al investigar el "modal verde que desaparecía".
        const input = item.querySelector('.receta-cantidad');
        if (select.value && input.value) {
            // 🧪 Detectar si es receta base (valor empieza con "rec_")
            if (select.value.startsWith('rec_')) {
                const recetaId = parseInt(select.value.replace('rec_', ''));
                ingredientesReceta.push({
                    ingredienteId: 100000 + recetaId,
                    cantidad: parseFloat(input.value),
                    rendimiento: 100 // Recetas base asumen 100% por ahora
                });
            } else {
                const inputRend = item.querySelector('.receta-rendimiento');
                ingredientesReceta.push({
                    ingredienteId: parseInt(select.value),
                    cantidad: parseFloat(input.value),
                    rendimiento: inputRend ? parseFloat(inputRend.value) || 100 : 100
                });
            }
        }
    });

    const receta = {
        nombre: document.getElementById('rec-nombre').value,
        codigo: document.getElementById('rec-codigo').value,
        categoria: document.getElementById('rec-categoria').value,
        precio_venta: parseFloat(document.getElementById('rec-precio_venta').value) || 0,
        porciones: parseInt(document.getElementById('rec-porciones').value) || 1,
        ingredientes: ingredientesReceta,
    };

    // 🆕 Validación centralizada
    const validation = validateReceta(receta);
    if (!validation.valid) {
        showValidationErrors(validation.errors);
        return;
    }

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = recipeStore.getState();

        if (window.editandoRecetaId !== null) {
            const result = await store.updateRecipe(window.editandoRecetaId, receta);
            if (!result.success) throw new Error(result.error || 'Error actualizando receta');
        } else {
            const result = await store.createRecipe(receta);
            if (!result.success) throw new Error(result.error || 'Error creando receta');
        }

        // El store ya sincroniza window.recetas, pero recargamos datos completos
        await window.cargarDatos();
        window.renderizarRecetas();
        window.hideLoading();
        window.showToast(
            window.editandoRecetaId ? t('recetas:toast_updated') : t('recetas:toast_created'),
            'success'
        );
        window.cerrarFormularioReceta();
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast(t('recetas:toast_error_saving', { message: error.message }), 'error');
    }
}

/**
 * Edita una receta existente
 * @param {number} id - ID de la receta
 */
export function editarReceta(id) {
    const rec = (window.recetas || []).find(r => r.id === id);
    if (!rec) return;

    // 🔒 AUDITORÍA 2026-06-12 (M4): fijar el id ANTES de pintar las líneas, para
    // que el selector de preparaciones base pueda excluir esta misma receta
    // (anti auto-referencia) también en las filas que se renderizan al abrir.
    window.editandoRecetaId = id;

    document.getElementById('rec-nombre').value = rec.nombre;
    document.getElementById('rec-codigo').value = rec.codigo || '';
    document.getElementById('rec-categoria').value = rec.categoria;
    document.getElementById('rec-precio_venta').value = rec.precio_venta;
    document.getElementById('rec-porciones').value = rec.porciones;

    document.getElementById('lista-ingredientes-receta').innerHTML = '';
    rec.ingredientes.forEach(item => {
        // 🧪 Detectar si es receta base (ingredienteId > 100000)
        const initialValue = item.ingredienteId > 100000
            ? `rec_${item.ingredienteId - 100000}`
            : String(item.ingredienteId);

        // CRÍTICO: pasar initialValue para que <option selected> esté en el
        // HTML ANTES de que TomSelect inicialice. TomSelect snapshotea el
        // selectedIndex al iniciar — si no encuentra <option selected> deja
        // el valor en "". Asignar `selectEl.value = X` DESPUÉS NO sincroniza
        // (TomSelect ya tiene su estado interno = ""). Bug observable:
        // wrapper visible vacío + guardado falla "no hay ingredientes".
        window.agregarIngredienteReceta(initialValue);
        const lastItem = document.querySelector(
            '#lista-ingredientes-receta .ingrediente-item:last-child'
        );
        lastItem.querySelector('.receta-cantidad').value = item.cantidad;

        // 🆕 Cargar Rendimiento con fallback al ingrediente original
        const inputRend = lastItem.querySelector('.receta-rendimiento');
        if (inputRend) {
            let rendimiento = item.rendimiento;

            // Si no tiene rendimiento guardado, o es 100 (por defecto),
            // intentar buscar el rendimiento actual del ingrediente base.
            if (!rendimiento) {
                const ingBase = (window.ingredientes || []).find(i => i.id === item.ingredienteId);
                if (ingBase && ingBase.rendimiento) {
                    rendimiento = ingBase.rendimiento;
                }
            }

            inputRend.value = rendimiento || 100;
        }
    });

    window.calcularCosteReceta();
    document.getElementById('form-title-receta').textContent = t('recetas:form_title_edit');
    document.getElementById('btn-text-receta').textContent = t('recetas:btn_save');
    window.mostrarFormularioReceta();
}

/**
 * Elimina una receta
 * @param {number} id - ID de la receta
 */
export async function eliminarReceta(id) {
    const rec = (window.recetas || []).find(r => r.id === id);
    if (!rec) return;

    if (!confirm(t('recetas:confirm_delete', { name: rec.nombre }))) return;

    window.showLoading();

    try {
        // 🆕 Usar Zustand store en lugar de window.api
        const store = recipeStore.getState();
        const result = await store.deleteRecipe(id);
        if (!result.success) throw new Error(result.error || 'Error eliminando receta');

        // El store ya sincroniza window.recetas
        await window.cargarDatos();
        window.renderizarRecetas();
        window.hideLoading();
        window.showToast(t('recetas:toast_deleted'), 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast(t('recetas:toast_error_deleting', { message: error.message }), 'error');
    }
}

/**
 * Calcula el coste completo de una receta
 * 💰 ACTUALIZADO: Usa precio_medio del inventario (basado en compras)
 * @param {Object} receta - Objeto receta
 * @returns {number} Coste total
 */
// ⚡ CACHE: Maps para búsquedas O(1) - se invalidan cuando cambia la referencia del array
let _invMapCache = null;
let _ingMapCache = null;
let _lastInvRef = null;
let _lastIngRef = null;

export function getInvMap() {
    const inv = window.inventarioCompleto || [];
    // Invalidar cache cuando cambia la referencia del array (después de cargarDatos)
    if (!_invMapCache || inv !== _lastInvRef) {
        _invMapCache = new Map(inv.map(i => [i.id, i]));
        _lastInvRef = inv;
    }
    return _invMapCache;
}

export function getIngMap() {
    const ing = window.ingredientes || [];
    // Invalidar cache cuando cambia la referencia del array (después de cargarDatos)
    if (!_ingMapCache || ing !== _lastIngRef) {
        _ingMapCache = new Map(ing.map(i => [i.id, i]));
        _lastIngRef = ing;
    }
    return _ingMapCache;
}

export function calcularCosteRecetaCompleto(receta, _depth = 0, _visited = null) {
    if (!receta || !receta.ingredientes || _depth > 5) return 0;

    // 🔒 AUDITORÍA 2026-06-12 (M4): cortar CICLOS a 0 en la primera repetición,
    // igual que el backend (businessHelpers.js `visited.has → return 0`). Antes
    // una receta auto-referenciada sumaba hasta 5 niveles anidados (coste inflado
    // geométricamente) y FE/BE daban números distintos para el mismo dato corrupto.
    const visited = _visited || new Set();
    if (receta.id !== null && receta.id !== undefined) {
        if (visited.has(receta.id)) return 0;
        visited.add(receta.id);
    }

    // ⚡ OPTIMIZACIÓN: Usar Maps O(1) en lugar de .find() O(n)
    const invMap = getInvMap();
    const ingMap = getIngMap();
    const recetas = window.recetas || [];
    const recetasMap = new Map(recetas.map(r => [r.id, r]));

    const costeTotalLote = receta.ingredientes.reduce((total, item) => {
        // 🧪 Detectar si es receta base (ingredienteId > 100000)
        if (item.ingredienteId > 100000) {
            const recetaId = item.ingredienteId - 100000;
            const recetaBase = recetasMap.get(recetaId);
            if (recetaBase) {
                // Calcular coste recursivamente. Anti-ciclo con COPIA del set por
                // rama (igual que el backend `new Set(visited)`): un "diamante"
                // legítimo (dos subrecetas que usan la misma base) suma bien;
                // solo el ciclo real (A contiene A) corta a 0.
                const costeRecetaBase = calcularCosteRecetaCompleto(recetaBase, _depth + 1, new Set(visited));
                return total + costeRecetaBase * item.cantidad;
            }
            return total;
        }

        // Ingrediente normal
        const invItem = invMap.get(item.ingredienteId);
        const ing = ingMap.get(item.ingredienteId);

        // 💰 Precio unitario: función centralizada (precio_medio_compra > precio_medio > precio/cpf)
        const precio = getIngredientUnitPrice(invItem, ing);

        // 🆕 CÁLCULO CON MERMA (Rendimiento)
        // 🔧 FIX: Fallback al rendimiento del ingrediente base si la receta no lo tiene guardado
        let rendimiento = parseFloat(item.rendimiento);
        if (!rendimiento) {
            if (ing?.rendimiento) {
                rendimiento = parseFloat(ing.rendimiento);
            } else {
                rendimiento = 100;
            }
        }
        const factorRendimiento = rendimiento / 100;
        const costeReal = factorRendimiento > 0 ? (precio / factorRendimiento) : precio;

        return total + costeReal * item.cantidad;
    }, 0);

    // 🔧 FIX: Dividir por porciones para obtener coste POR PORCIÓN
    const porciones = parseInt(receta.porciones) || 1;
    const costePorPorcion = costeTotalLote / porciones;

    // Redondear a 2 decimales para evitar errores de precisión
    return parseFloat(costePorPorcion.toFixed(2));
}

// Producción manual de platos eliminada (2026-05-29): el stock ya se descuenta
// automáticamente al registrar las ventas; el botón manual causaba doble conteo.
