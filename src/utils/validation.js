/**
 * ============================================
 * utils/validation.js - Input Validation
 * ============================================
 *
 * Validación robusta de datos de negocio.
 * Previene datos corruptos y mejora UX con mensajes claros.
 *
 * @author MindLoopIA
 * @version 1.0.0
 */

/**
 * Resultado de validación
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Si la validación pasó
 * @property {string[]} errors - Lista de errores
 * @property {Object} sanitized - Datos sanitizados
 */

/**
 * Valida que un valor no esté vacío
 */
export function isRequired(value, fieldName = 'Campo') {
    if (value === null || value === undefined || value === '') {
        return { valid: false, error: `${fieldName} es obligatorio` };
    }
    if (typeof value === 'string' && value.trim() === '') {
        return { valid: false, error: `${fieldName} es obligatorio` };
    }
    return { valid: true };
}

/**
 * Valida un número dentro de un rango
 */
export function isNumber(value, { min = null, max = null, fieldName = 'Valor' } = {}) {
    const num = parseFloat(value);

    if (isNaN(num)) {
        return { valid: false, error: `${fieldName} debe ser un número válido` };
    }

    if (min !== null && num < min) {
        return { valid: false, error: `${fieldName} debe ser mayor o igual a ${min}` };
    }

    if (max !== null && num > max) {
        return { valid: false, error: `${fieldName} debe ser menor o igual a ${max}` };
    }

    return { valid: true, value: num };
}

/**
 * Valida un número positivo (> 0)
 */
export function isPositive(value, fieldName = 'Valor') {
    return isNumber(value, { min: 0.001, fieldName });
}

/**
 * Valida un número no negativo (>= 0)
 */
export function isNonNegative(value, fieldName = 'Valor') {
    return isNumber(value, { min: 0, fieldName });
}

/**
 * Valida longitud de texto
 */
export function hasLength(value, { min = 0, max = null, fieldName = 'Texto' } = {}) {
    const str = String(value || '');

    if (str.length < min) {
        return { valid: false, error: `${fieldName} debe tener al menos ${min} caracteres` };
    }

    if (max !== null && str.length > max) {
        return { valid: false, error: `${fieldName} debe tener máximo ${max} caracteres` };
    }

    return { valid: true, value: str };
}

/**
 * Valida email
 */
export function isEmail(value, fieldName = 'Email') {
    if (!value) return { valid: true }; // Email puede ser opcional

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        return { valid: false, error: `${fieldName} no es válido` };
    }
    return { valid: true, value: value.toLowerCase().trim() };
}

/**
 * Valida teléfono (formato español)
 */
export function isPhone(value, fieldName = 'Teléfono') {
    if (!value) return { valid: true }; // Puede ser opcional

    // Limpiar y validar
    const cleaned = value.replace(/[\s\-()]/g, '');
    if (!/^(\+34)?[6789]\d{8}$/.test(cleaned) && !/^\d{9,15}$/.test(cleaned)) {
        return { valid: false, error: `${fieldName} no es válido` };
    }
    return { valid: true, value: cleaned };
}

// ============================================
// VALIDADORES DE NEGOCIO
// ============================================

/**
 * Valida datos de ingrediente
 * @param {Object} data - Datos del ingrediente
 * @returns {ValidationResult}
 */
export function validateIngrediente(data) {
    const errors = [];
    const sanitized = {};

    // Nombre (requerido, 1-100 caracteres)
    const nombre = isRequired(data.nombre, 'Nombre');
    if (!nombre.valid) errors.push(nombre.error);
    else {
        const len = hasLength(data.nombre, { min: 1, max: 100, fieldName: 'Nombre' });
        if (!len.valid) errors.push(len.error);
        else sanitized.nombre = data.nombre.trim();
    }

    // Unidad (requerida)
    const unidad = isRequired(data.unidad, 'Unidad');
    if (!unidad.valid) errors.push(unidad.error);
    else sanitized.unidad = data.unidad.trim();

    // Precio (>= 0)
    if (data.precio !== undefined && data.precio !== '') {
        const precio = isNonNegative(data.precio, 'Precio');
        if (!precio.valid) errors.push(precio.error);
        else sanitized.precio = precio.value;
    } else {
        sanitized.precio = 0;
    }

    // Stock actual (>= 0)
    if (data.stock_actual !== undefined && data.stock_actual !== '') {
        const stock = isNonNegative(data.stock_actual, 'Stock actual');
        if (!stock.valid) errors.push(stock.error);
        else sanitized.stock_actual = stock.value;
    }

    // Stock mínimo (>= 0)
    if (data.stock_minimo !== undefined && data.stock_minimo !== '') {
        const stockMin = isNonNegative(data.stock_minimo, 'Stock mínimo');
        if (!stockMin.valid) errors.push(stockMin.error);
        else sanitized.stock_minimo = stockMin.value;
    }

    // Familia (opcional pero si existe debe ser válida)
    if (data.familia) {
        const familiasValidas = ['alimento', 'bebida', 'suministro'];
        if (!familiasValidas.includes(data.familia.toLowerCase())) {
            errors.push('Familia debe ser: alimento, bebida o suministro');
        } else {
            sanitized.familia = data.familia.toLowerCase();
        }
    }

    // Formato compra (opcional)
    if (data.formato_compra) {
        sanitized.formato_compra = data.formato_compra.trim();
    }

    // Cantidad por formato (> 0 si se especifica)
    if (data.cantidad_por_formato !== undefined && data.cantidad_por_formato !== '') {
        const cant = isPositive(data.cantidad_por_formato, 'Cantidad por formato');
        if (!cant.valid) errors.push(cant.error);
        else sanitized.cantidad_por_formato = cant.value;
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? { ...data, ...sanitized } : null
    };
}

/**
 * Valida datos de receta
 * @param {Object} data - Datos de la receta
 * @returns {ValidationResult}
 */
export function validateReceta(data) {
    const errors = [];
    const sanitized = {};

    // Nombre (requerido)
    const nombre = isRequired(data.nombre, 'Nombre de receta');
    if (!nombre.valid) errors.push(nombre.error);
    else {
        const len = hasLength(data.nombre, { min: 1, max: 150, fieldName: 'Nombre' });
        if (!len.valid) errors.push(len.error);
        else sanitized.nombre = data.nombre.trim();
    }

    // Precio venta (> 0)
    if (data.precio_venta !== undefined && data.precio_venta !== '') {
        const precio = isPositive(data.precio_venta, 'Precio de venta');
        if (!precio.valid) errors.push(precio.error);
        else sanitized.precio_venta = precio.value;
    }

    // Porciones (> 0, evita división por cero en cálculos de coste)
    if (data.porciones !== undefined && data.porciones !== '') {
        const porciones = parseFloat(data.porciones);
        if (isNaN(porciones) || porciones <= 0) {
            errors.push('Porciones debe ser mayor a 0');
        } else {
            sanitized.porciones = Math.max(1, Math.round(porciones));
        }
    }

    // Ingredientes (array no vacío)
    if (!Array.isArray(data.ingredientes) || data.ingredientes.length === 0) {
        errors.push('La receta debe tener al menos un ingrediente');
    } else {
        // Validar cada ingrediente
        data.ingredientes.forEach((ing, idx) => {
            if (!ing.ingrediente_id && !ing.ingredienteId) {
                errors.push(`Ingrediente ${idx + 1}: debe seleccionar un ingrediente`);
            }
            if (!ing.cantidad || parseFloat(ing.cantidad) <= 0) {
                errors.push(`Ingrediente ${idx + 1}: cantidad debe ser mayor a 0`);
            }
        });
        if (errors.length === 0) {
            sanitized.ingredientes = data.ingredientes;
        }
    }

    // Categoría (opcional)
    if (data.categoria) {
        sanitized.categoria = data.categoria.trim();
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? { ...data, ...sanitized } : null
    };
}

/**
 * Valida datos de pedido
 * @param {Object} data - Datos del pedido
 * @returns {ValidationResult}
 */
export function validatePedido(data) {
    const errors = [];
    const sanitized = {};

    // Proveedor (requerido)
    if (!data.proveedorId && !data.proveedor_id) {
        errors.push('Debe seleccionar un proveedor');
    } else {
        sanitized.proveedor_id = data.proveedor_id || data.proveedorId;
    }

    // Ingredientes (array no vacío)
    if (!Array.isArray(data.ingredientes) || data.ingredientes.length === 0) {
        errors.push('El pedido debe tener al menos un ingrediente');
    } else {
        data.ingredientes.forEach((ing, idx) => {
            if (!ing.ingredienteId && !ing.ingrediente_id) {
                errors.push(`Item ${idx + 1}: debe seleccionar un ingrediente`);
            }
            if (!ing.cantidad || parseFloat(ing.cantidad) <= 0) {
                errors.push(`Item ${idx + 1}: cantidad debe ser mayor a 0`);
            }
        });
    }

    // Total (>= 0)
    if (data.total !== undefined) {
        const total = isNonNegative(data.total, 'Total');
        if (!total.valid) errors.push(total.error);
        else sanitized.total = total.value;
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? { ...data, ...sanitized } : null
    };
}

/**
 * Valida datos de proveedor
 * @param {Object} data - Datos del proveedor
 * @returns {ValidationResult}
 */
export function validateProveedor(data) {
    const errors = [];
    const sanitized = {};

    // Nombre (requerido)
    const nombre = isRequired(data.nombre, 'Nombre del proveedor');
    if (!nombre.valid) errors.push(nombre.error);
    else sanitized.nombre = data.nombre.trim();

    // Email (opcional pero válido)
    if (data.email) {
        const email = isEmail(data.email);
        if (!email.valid) errors.push(email.error);
        else sanitized.email = email.value;
    }

    // Teléfono (opcional pero válido)
    if (data.telefono) {
        const tel = isPhone(data.telefono);
        if (!tel.valid) errors.push(tel.error);
        else sanitized.telefono = tel.value;
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? { ...data, ...sanitized } : null
    };
}

// ============================================
// HELPERS
// ============================================

/**
 * Muestra errores de validación como toast
 * @param {string[]} errors - Lista de errores
 */
export function showValidationErrors(errors) {
    if (errors.length === 0) return;

    const message = errors.length === 1
        ? errors[0]
        : `${errors.length} errores:\n• ${errors.slice(0, 3).join('\n• ')}${errors.length > 3 ? '\n• ...' : ''}`;

    if (typeof window.showToast === 'function') {
        window.showToast(message, 'error');
    } else {
        alert(message);
    }
}

/**
 * Valida y muestra errores - helper combinado
 * @param {Object} data - Datos a validar
 * @param {string} type - Tipo: 'ingrediente', 'receta', 'pedido', 'proveedor'
 * @returns {ValidationResult}
 */
export function validateAndShow(data, type) {
    const validators = {
        ingrediente: validateIngrediente,
        receta: validateReceta,
        pedido: validatePedido,
        proveedor: validateProveedor
    };

    const validator = validators[type];
    if (!validator) {
        console.error(`Validador no encontrado para tipo: ${type}`);
        return { valid: true, errors: [], sanitized: data };
    }

    const result = validator(data);
    if (!result.valid) {
        showValidationErrors(result.errors);
    }
    return result;
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.Validation = {
        isRequired,
        isNumber,
        isPositive,
        isNonNegative,
        hasLength,
        isEmail,
        isPhone,
        validateIngrediente,
        validateReceta,
        validatePedido,
        validateProveedor,
        showValidationErrors,
        validateAndShow
    };
}

export default {
    isRequired,
    isNumber,
    isPositive,
    isNonNegative,
    hasLength,
    isEmail,
    isPhone,
    validateIngrediente,
    validateReceta,
    validatePedido,
    validateProveedor,
    showValidationErrors,
    validateAndShow
};
