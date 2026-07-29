/**
 * modules/core/plan-tabs.js
 * ============================================
 * Paquetes reducidos (tiers) — muestra solo un subconjunto de pestañas del menú
 * según el "tier" del plan del restaurante. Si el plan NO es un tier reducido
 * conocido, no hace nada → todas las pestañas visibles (comportamiento normal).
 *
 * Calcado del patrón ya probado en producción `aplicarGatingComidaPersonal`
 * (modules/comida-personal/comida-personal.js): oculta el nav-item por CSS y, si
 * el usuario está en una pestaña que ha quedado oculta, lo rebota a una permitida.
 * No toca datos ni cálculos: la carga de datos es global e independiente de las
 * pestañas visibles, así que ocultar UI no rompe P&L / dashboard / stock.
 *
 * PROTOTIPO 2026-07-28 (ARAU/Agustina): el tier se lee del string `plan`
 * (window._planData.plan, que viene de /stripe/subscription-status). En el MVP
 * final el tier iría en su propia columna (plan_tier) desacoplada del plan de
 * facturación. Añadir un paquete nuevo = una entrada más en PLAN_TABS.
 *
 * @module modules/core/plan-tabs
 */

/**
 * Mapa tier -> pestañas (data-tab) permitidas. El resto se ocultan.
 * @type {Record<string, string[]>}
 */
export const PLAN_TABS = {
    // "Lite": operativa de costes del día a día. Ocho pestañas, confirmadas por
    // Iker el 2026-07-28 después de verlo funcionando:
    //   ingredientes · recetas · proveedores · pedidos · ventas · inventario ·
    //   diario · configuracion
    //
    // Fuera quedan: analisis (Cuenta de Resultados / BCG / punto de equilibrio),
    // busqueda, inteligencia (Omnes), horarios y comida-personal.
    //
    // ⚠️ El comentario que había aquí decía justo lo contrario que el código
    // ("sin inventario", "con analisis"): era el conjunto que se propuso primero
    // y que Iker corrigió. Si cambias la lista, cambia también este texto — un
    // comentario que miente sobre qué se está vendiendo es peor que no tenerlo.
    lite: ['ingredientes', 'recetas', 'proveedores', 'pedidos', 'ventas', 'inventario', 'diario', 'configuracion'],
};

/**
 * Aplica el gating de pestañas del tier actual. Idempotente y fail-open: si no hay
 * plan cargado o el tier no es reducido, deja todas las pestañas visibles.
 */
export function aplicarGatingPlan() {
    if (typeof document === 'undefined') return;
    const tier = (window._planData?.plan || '').toString().toLowerCase();
    const allowed = PLAN_TABS[tier];
    if (!allowed) return; // plan normal → no tocar nada
    const permit = new Set(allowed);

    // Ocultar los nav-items no permitidos (el sidebar es el mismo en móvil off-canvas).
    document.querySelectorAll('.nav-item[data-tab]').forEach((el) => {
        el.style.display = permit.has(el.dataset.tab) ? '' : 'none';
    });

    // Si la pestaña activa ha quedado oculta, rebotar a la primera permitida.
    const activo = document.querySelector('.tab-content.active');
    const activoTab = activo?.id?.replace(/^tab-/, '');
    if (activoTab && !permit.has(activoTab)) {
        window.cambiarTab?.(allowed[0]);
    }

    // El chat de Omnes (widget flotante) pertenece a la IA (pestaña 'inteligencia').
    // Si el tier no la incluye, ocultar el FAB aunque ya se haya montado (chatStatus
    // es async y puede montarlo antes de que llegue `plan:loaded`).
    if (!permit.has('inteligencia')) {
        const chat = document.getElementById('chat-widget-container');
        if (chat) chat.style.setProperty('display', 'none', 'important');
    }
}

/**
 * ¿El tier del plan actual permite esta pestaña/feature? Los planes normales (sin
 * tier reducido) permiten todo. Se usa también para no montar el widget de chat en
 * tiers que no incluyen la IA (pestaña 'inteligencia').
 * @param {string} tab
 * @returns {boolean}
 */
export function planPermiteTab(tab) {
    const tier = (window._planData?.plan || '').toString().toLowerCase();
    const allowed = PLAN_TABS[tier];
    if (!allowed) return true; // plan normal → todo permitido
    return allowed.includes(tab);
}

if (typeof window !== 'undefined') {
    window.aplicarGatingPlan = aplicarGatingPlan;
    window.planPermiteTab = planPermiteTab;
    // El plan llega async tras el login → reaplicar cuando se emite `plan:loaded`.
    window.addEventListener('plan:loaded', () => aplicarGatingPlan());
}

export default { PLAN_TABS, aplicarGatingPlan, planPermiteTab };
