/**
 * Mapping de features → plan mínimo requerido.
 *
 * Cada clave es un identificador semántico de la función. Cada valor es
 * el plan más bajo que la incluye.
 *
 * Cómo se usa:
 *   - Botones del DOM marcan su feature con `data-feature="smart_order"`.
 *   - `feature-gating.js` los escanea, lee el plan del usuario actual
 *     desde authStore, y si no llega, los marca como `.locked-feature`
 *     (corona + click paywall).
 *
 * Reglas:
 *   - Plan 'starter' = 1 (núcleo operativo).
 *   - Plan 'pro' (alias 'profesional' en backend) = 2.
 *   - Plan 'premium' = 3.
 *   - Plan 'trial' = acceso a profesional/pro durante 14 días.
 *
 * Mapeo NO exhaustivo: solo features que ya tienen un botón en la UI y
 * decisión cerrada con Anais (2026-05-08). El resto se irá añadiendo
 * pestaña a pestaña.
 */

export const FEATURE_REQUIREMENTS = {
    // === PEDIDOS ===
    smart_order: 'pro',
    repetir_pedido: 'pro',
    autollenado_ultima_compra: 'pro',
    carrito_inteligente: 'pro',
    pedido_pdf: 'pro',
    pedido_whatsapp: 'pro',

    // === RECETAS ===
    variantes_receta: 'pro',
    cost_tracker: 'pro',
    escandallo_toggle_real: 'pro',

    // === IMPORT/EXPORT ===
    importar_excel: 'pro',
    exportar_excel: 'pro',
    importar_ventas_tpv: 'pro',
    inventario_masivo_excel: 'pro',

    // === INGREDIENTES ===
    grafica_evolucion_precio: 'pro',
    multi_proveedor_ingrediente: 'pro',

    // === DASHBOARD KPIs ===
    kpi_valor_stock: 'pro',
    kpi_cambios_precio: 'pro',
    kpi_top_proveedores: 'pro',
    kpi_personal_hoy: 'premium',
    kpi_proyeccion: 'premium',

    // === DIARIO / P&L ===
    pnl_diario: 'pro',
    breakeven: 'premium',

    // === ANÁLISIS ===
    ranking_rentabilidad: 'pro',
    comparativa_mensual: 'pro',
    food_cost_categorico: 'pro',
    ingenieria_menu_bcg: 'premium',
    recomendaciones_inteligentes: 'premium',

    // === INTELIGENCIA (pestaña) ===
    frescura_stock: 'premium',
    revision_precios: 'premium',
    cambios_precio_anomalos: 'premium',
    forecast_ventas: 'premium',
    alertas_stock_critico: 'pro',

    // === HORARIOS ===
    horarios_empleados: 'premium',
    coste_laboral: 'premium',

    // === CHAT IA ===
    chat_ia: 'premium',

    // === CONFIGURACIÓN ===
    audit_log: 'premium',
    integraciones_tpv: 'premium',
    multi_tenant_switch: 'premium',
    api_tokens: 'premium', // Enterprise / addon en realidad
};

// Niveles numéricos. Coherente con backend planGate.js:
//   starter < trial = profesional/pro < premium
export const PLAN_LEVELS = {
    starter: 1,
    trial: 2,
    profesional: 2,
    pro: 2, // alias UI-friendly
    premium: 3,
};

/**
 * @param {string} feature - clave de FEATURE_REQUIREMENTS
 * @returns {string|null} plan mínimo, o null si la feature no requiere plan
 */
export function getRequiredPlan(feature) {
    return FEATURE_REQUIREMENTS[feature] || null;
}
