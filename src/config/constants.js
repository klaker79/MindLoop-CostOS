/**
 * Constantes de Configuración - MindLoop CostOS
 *
 * Valores configurables de la aplicación centralizados.
 * Modificar aquí afecta toda la aplicación.
 *
 * @module config/constants
 */

// ============================================
// STOCK Y ALERTAS
// ============================================

/**
 * Umbral de alerta de stock bajo (0-1)
 * 0.2 = 20% del stock mínimo requerido
 */
export const STOCK_WARNING_THRESHOLD = parseFloat(
    import.meta.env.VITE_STOCK_WARNING_THRESHOLD || '0.2'
);

/**
 * Niveles de alerta de stock
 */
export const STOCK_LEVELS = {
    CRITICAL: 0.1,  // 10% - Crítico
    LOW: 0.2,       // 20% - Bajo
    MEDIUM: 0.5,    // 50% - Medio
    GOOD: 1.0       // 100% - Bien
};

// ============================================
// CACHE Y PERFORMANCE
// ============================================

/**
 * TTL (Time To Live) para diferentes caches en milisegundos
 */
export const CACHE_TTL = {
    // 5 minutos para recetas (cálculos costosos)
    RECIPES: parseInt(import.meta.env.VITE_CACHE_TTL_RECIPES || '300000'),

    // 1 minuto para KPIs (datos que cambian frecuentemente)
    KPI: parseInt(import.meta.env.VITE_CACHE_TTL_KPI || '60000'),

    // 10 minutos para ingredientes (datos más estáticos)
    INGREDIENTS: 600000,

    // 15 minutos para proveedores (datos muy estáticos)
    PROVIDERS: 900000
};

/**
 * Configuración de debouncing para búsquedas (ms)
 */
export const DEBOUNCE_DELAY = {
    SEARCH: 300,      // Búsquedas en inputs
    AUTOCOMPLETE: 150, // Autocomplete más rápido
    RESIZE: 150       // Eventos de resize
};

// ============================================
// PAGINACIÓN
// ============================================

/**
 * Tamaños de página para diferentes vistas
 */
export const PAGE_SIZE = {
    DEFAULT: 20,
    INGREDIENTS: 20,
    RECIPES: 15,
    SALES: 30,
    ORDERS: 25
};

// ============================================
// FORMATOS Y LOCALES
// ============================================

/**
 * Configuración de locale para formatos
 */
export const LOCALE = {
    DEFAULT: 'es-ES',
    CURRENCY: 'EUR',
    DATE_FORMAT: 'DD/MM/YYYY',
    DATETIME_FORMAT: 'DD/MM/YYYY HH:mm'
};

/**
 * Opciones de formateo de moneda
 */
export const CURRENCY_FORMAT_OPTIONS = {
    style: 'currency',
    currency: LOCALE.CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
};

// ============================================
// VALIDACIONES
// ============================================

/**
 * Límites de validación
 */
export const VALIDATION = {
    // Longitud mínima de búsqueda antes de trigger
    MIN_SEARCH_LENGTH: 2,

    // Precio máximo permitido para ingredientes
    MAX_INGREDIENT_PRICE: 9999.99,

    // Stock máximo permitido
    MAX_STOCK: 999999,

    // Cantidad mínima de decimales para costes
    COST_DECIMALS: 2,

    // Margen mínimo recomendado (%)
    MIN_RECOMMENDED_MARGIN: 30
};

// ============================================
// UI Y NOTIFICACIONES
// ============================================

/**
 * Duración de toasts (ms)
 */
export const TOAST_DURATION = {
    SUCCESS: 3000,
    ERROR: 5000,
    WARNING: 4000,
    INFO: 3000
};

/**
 * Colores de estado
 */
export const STATUS_COLORS = {
    SUCCESS: '#10b981',
    ERROR: '#ef4444',
    WARNING: '#f59e0b',
    INFO: '#3b82f6',
    PRIMARY: '#667eea',
    SECONDARY: '#764ba2'
};

// ============================================
// ROLES Y PERMISOS
// ============================================

/**
 * Roles de usuario
 */
export const USER_ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    STAFF: 'staff',
    VIEWER: 'viewer'
};

/**
 * Permisos por rol
 */
export const PERMISSIONS = {
    [USER_ROLES.ADMIN]: ['read', 'write', 'delete', 'export', 'manage_users'],
    [USER_ROLES.MANAGER]: ['read', 'write', 'export'],
    [USER_ROLES.STAFF]: ['read', 'write'],
    [USER_ROLES.VIEWER]: ['read']
};

// ============================================
// ESTADOS DE ENTIDADES
// ============================================

/**
 * Estados de pedidos
 */
export const ORDER_STATUS = {
    PENDING: 'pendiente',
    CONFIRMED: 'confirmado',
    IN_TRANSIT: 'en_transito',
    DELIVERED: 'entregado',
    CANCELLED: 'cancelado'
};

/**
 * Estados de ventas
 */
export const SALE_STATUS = {
    DRAFT: 'borrador',
    COMPLETED: 'completada',
    REFUNDED: 'reembolsada'
};

// ============================================
// CATEGORÍAS
// ============================================

/**
 * Categorías de ingredientes
 */
export const INGREDIENT_CATEGORIES = {
    VEGETABLES: 'verduras',
    MEATS: 'carnes',
    FISH: 'pescados',
    DAIRY: 'lacteos',
    GRAINS: 'cereales',
    SPICES: 'especias',
    BEVERAGES: 'bebidas',
    OTHER: 'otros'
};

/**
 * Unidades de medida
 */
export const UNITS = {
    WEIGHT: ['kg', 'g', 'mg'],
    VOLUME: ['l', 'ml', 'cl'],
    COUNT: ['ud', 'docena'],
    CUSTOM: ['ración', 'pizca', 'al gusto']
};

// ============================================
// CONFIGURACIÓN DE REPORTES
// ============================================

/**
 * Configuración de exportación
 */
export const EXPORT_CONFIG = {
    // Formato de fecha en archivos exportados
    FILE_DATE_FORMAT: 'YYYY-MM-DD',

    // Nombre de empresa por defecto en PDFs
    DEFAULT_COMPANY_NAME: 'MindLoop CostOS',

    // Máximo de filas en Excel antes de warning
    MAX_EXCEL_ROWS: 10000
};

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * Flags para activar/desactivar features
 */
export const FEATURES = {
    ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',
    ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    ENABLE_PERFORMANCE_MONITORING: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING !== 'false',
    ENABLE_CHATBOT: true,
    ENABLE_EXPORT_PDF: true,
    ENABLE_EXPORT_EXCEL: true
};

// ============================================
// APP INFO
// ============================================

/**
 * Información de la aplicación
 */
export const APP_INFO = {
    NAME: import.meta.env.VITE_APP_NAME || 'MindLoop CostOS',
    VERSION: import.meta.env.VITE_APP_VERSION || '2.0.0',
    ENV: import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'production',
    BUILD_DATE: new Date().toISOString()
};

// ============================================
// DEFAULTS
// ============================================

/**
 * Valores por defecto para nuevas entidades
 */
export const DEFAULTS = {
    INGREDIENT: {
        stock: 0,
        stockMin: 5,
        precio: 0,
        categoria: INGREDIENT_CATEGORIES.OTHER
    },
    RECIPE: {
        raciones: 1,
        margen: 30
    },
    SALE: {
        cantidad: 1,
        status: SALE_STATUS.COMPLETED
    }
};
