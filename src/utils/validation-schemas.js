/**
 * Validation Schemas for CRUD Operations
 *
 * Validates data before sending to API to prevent
 * malformed or malicious data from reaching the backend.
 *
 * @module utils/validation-schemas
 */

/**
 * Validates that a value is a non-empty string
 * @param {any} value
 * @param {string} fieldName
 * @returns {{ valid: boolean, error?: string }}
 */
function requireString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return { valid: false, error: `${fieldName} es obligatorio` };
    }
    return { valid: true };
}

/**
 * Validates that a value is a positive number
 * @param {any} value
 * @param {string} fieldName
 * @param {{ allowZero?: boolean, required?: boolean }} options
 * @returns {{ valid: boolean, error?: string }}
 */
function requirePositiveNumber(value, fieldName, { allowZero = true, required = false } = {}) {
    if (value === undefined || value === null || value === '') {
        if (required) {
            return { valid: false, error: `${fieldName} es obligatorio` };
        }
        return { valid: true };
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
        return { valid: false, error: `${fieldName} debe ser un numero valido` };
    }
    if (!allowZero && num === 0) {
        return { valid: false, error: `${fieldName} no puede ser cero` };
    }
    if (num < 0) {
        return { valid: false, error: `${fieldName} no puede ser negativo` };
    }
    return { valid: true };
}

/**
 * Validates that a value is a valid ID (positive integer or UUID string)
 * @param {any} value
 * @param {string} fieldName
 * @returns {{ valid: boolean, error?: string }}
 */
function requireId(value, fieldName) {
    if (value === undefined || value === null) {
        return { valid: false, error: `${fieldName} es obligatorio` };
    }
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return { valid: true };
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return { valid: true };
    }
    return { valid: false, error: `${fieldName} no es un ID valido` };
}

/**
 * Runs multiple validations and returns combined result
 * @param {Array<{ valid: boolean, error?: string }>} checks
 * @returns {{ valid: boolean, errors: string[] }}
 */
function runValidations(checks) {
    const errors = checks
        .filter(c => !c.valid)
        .map(c => c.error);
    return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes a string by trimming whitespace and removing control characters
 * @param {string} value
 * @returns {string}
 */
function sanitizeString(value) {
    if (typeof value !== 'string') return value;
    // Remove control characters except newlines and tabs
    // eslint-disable-next-line no-control-regex
    return value.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitizes all string fields in an object
 * @param {object} data
 * @returns {object}
 */
function sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(item =>
                typeof item === 'object' ? sanitizeData(item) : item
            );
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ============ Entity-specific validators ============

/**
 * Validate ingredient data for create/update
 * @param {object} data
 * @param {boolean} isUpdate - true if updating existing record
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
export function validateIngredientData(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Datos de ingrediente invalidos'], sanitized: data };
    }

    const checks = [];

    if (!isUpdate) {
        checks.push(requireString(data.nombre, 'Nombre'));
    } else if (data.nombre !== undefined) {
        checks.push(requireString(data.nombre, 'Nombre'));
    }

    if (data.precio !== undefined) {
        checks.push(requirePositiveNumber(data.precio, 'Precio'));
    }
    if (data.stock_actual !== undefined) {
        checks.push(requirePositiveNumber(data.stock_actual, 'Stock actual'));
    }
    if (data.stock_minimo !== undefined) {
        checks.push(requirePositiveNumber(data.stock_minimo, 'Stock minimo'));
    }

    const result = runValidations(checks);
    return { ...result, sanitized: sanitizeData(data) };
}

/**
 * Validate recipe data for create/update
 * @param {object} data
 * @param {boolean} isUpdate
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
export function validateRecipeData(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Datos de receta invalidos'], sanitized: data };
    }

    const checks = [];

    if (!isUpdate) {
        checks.push(requireString(data.nombre, 'Nombre'));
    } else if (data.nombre !== undefined) {
        checks.push(requireString(data.nombre, 'Nombre'));
    }

    if (data.precio_venta !== undefined) {
        checks.push(requirePositiveNumber(data.precio_venta, 'Precio de venta'));
    }
    if (data.rendimiento !== undefined) {
        checks.push(requirePositiveNumber(data.rendimiento, 'Rendimiento', { allowZero: false }));
    }

    const result = runValidations(checks);
    return { ...result, sanitized: sanitizeData(data) };
}

/**
 * Validate order data for create/update
 * @param {object} data
 * @param {boolean} isUpdate
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
export function validateOrderData(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Datos de pedido invalidos'], sanitized: data };
    }

    const checks = [];

    if (!isUpdate && data.proveedor_id !== undefined) {
        checks.push(requireId(data.proveedor_id, 'Proveedor'));
    }

    if (data.total !== undefined) {
        checks.push(requirePositiveNumber(data.total, 'Total'));
    }

    const result = runValidations(checks);
    return { ...result, sanitized: sanitizeData(data) };
}

/**
 * Validate sale data for create
 * @param {object} data
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
export function validateSaleData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Datos de venta invalidos'], sanitized: data };
    }

    const checks = [];

    if (data.recetaId !== undefined || data.receta_id !== undefined) {
        const recetaId = data.recetaId || data.receta_id;
        checks.push(requireId(recetaId, 'Receta'));
    }
    if (data.cantidad !== undefined) {
        checks.push(requirePositiveNumber(data.cantidad, 'Cantidad', { allowZero: false }));
    }

    const result = runValidations(checks);
    return { ...result, sanitized: sanitizeData(data) };
}

/**
 * Validate supplier data for create/update
 * @param {object} data
 * @param {boolean} isUpdate
 * @returns {{ valid: boolean, errors: string[], sanitized: object }}
 */
export function validateSupplierData(data, isUpdate = false) {
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Datos de proveedor invalidos'], sanitized: data };
    }

    const checks = [];

    if (!isUpdate) {
        checks.push(requireString(data.nombre, 'Nombre'));
    } else if (data.nombre !== undefined) {
        checks.push(requireString(data.nombre, 'Nombre'));
    }

    const result = runValidations(checks);
    return { ...result, sanitized: sanitizeData(data) };
}
