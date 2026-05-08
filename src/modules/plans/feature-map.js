/**
 * Mapping de features → plan mínimo requerido.
 *
 * Cada clave es un identificador semántico de la función. Cada valor es
 * el plan más bajo que la incluye.
 *
 * Cómo se usa:
 *   - Botones del DOM marcan su feature con `data-feature="smart_order"`.
 *   - `feature-gating.js` los escanea, lee el plan del usuario actual
 *     desde window._planData, y si no llega, los marca como
 *     `.locked-feature` (corona + click paywall).
 *
 * Reglas:
 *   - Plan 'starter' = 1 (núcleo operativo).
 *   - Plan 'pro' / 'profesional' = 2 (alias).
 *   - Plan 'trial' = 2 (acceso a profesional/pro durante 14 días).
 *   - Plan 'premium' = 3.
 *
 * Niveles coherentes con backend planGate.js (lacaleta-api).
 *
 * Mapeo NO exhaustivo: solo features que ya tienen botón en la UI.
 * En esta primera fase aplicamos SOLO `smart_order` para validar el
 * patrón end-to-end. Cuando esté validado, ampliamos.
 */

export const FEATURE_REQUIREMENTS = {
    // === Pedidos === (activadas 2026-05-08, sesión Anais)
    smart_order: 'pro',
    carrito_inteligente: 'pro',
    importar_pedidos: 'pro',
    transferencias: 'pro',
    repetir_pedido: 'pro',
    pedido_pdf: 'pro',
    pedido_whatsapp: 'pro',

    // === Pendientes — pestaña a pestaña ===
    // exportar_excel: 'pro',
    // grafica_evolucion_precio: 'pro',
    // multi_proveedor_ingrediente: 'pro',
    // pnl_diario: 'pro',
    // ranking_rentabilidad: 'pro',
    // comparativa_mensual: 'pro',
    // ingenieria_menu_bcg: 'premium',
    // recomendaciones_inteligentes: 'premium',
    // frescura_stock: 'premium',
    // revision_precios: 'premium',
    // forecast_ventas: 'premium',
    // chat_ia: 'premium',
    // horarios_empleados: 'premium',
    // audit_log: 'premium',
};

// Niveles numéricos. Coherente con backend planGate.js.
export const PLAN_LEVELS = {
    starter: 1,
    trial: 2,
    profesional: 2,
    pro: 2,
    premium: 3,
};

/**
 * @param {string} feature
 * @returns {string|null} plan mínimo requerido, o null si la feature no
 *                        requiere plan (acceso libre).
 */
export function getRequiredPlan(feature) {
    return FEATURE_REQUIREMENTS[feature] || null;
}
