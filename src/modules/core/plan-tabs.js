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
 * El tier sale de `plan_tier`, que es SU PROPIA columna, separada del plan de
 * facturación (2026-07-30). Antes se leía de `plan`, y esa columna hacía dos
 * trabajos a la vez: marcar a un cliente como Lite (`plan='lite'`) le rompía el
 * periodo de prueba, porque el control de suscripción deja pasar por
 * `plan='trial'` con trial vigente. Había que ponerle `plan_status='active'` a
 * mano, o sea tratarlo como si ya pagara: vender Lite con trial era imposible.
 * Ahora un cliente puede estar en trial Y ver el paquete Lite a la vez.
 *
 * Se mantiene el respaldo a `plan` para los tenants marcados antes de la
 * migración, y para que un despliegue de frontend nuevo contra un backend que
 * todavía no devuelva `plan_tier` no destape pestañas de golpe.
 *
 * Añadir un paquete nuevo = una entrada más en PLAN_TABS.
 *
 * @module modules/core/plan-tabs
 */

/**
 * Tier efectivo del restaurante: `plan_tier` y, si no está, `plan`.
 * @returns {string} en minúsculas, o '' si no hay plan cargado
 */
function tierActual() {
    const p = window._planData;
    return (p?.plan_tier || p?.plan || '').toString().toLowerCase();
}

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
    const tier = tierActual();
    const allowed = PLAN_TABS[tier];
    if (!allowed) return; // plan normal → no tocar nada
    const permit = new Set(allowed);

    // Ocultar las entradas no permitidas, en las DOS navegaciones:
    //   .nav-item  → el sidebar de escritorio
    //   .smm-item  → el menú "Más" del móvil, que es una lista aparte porque en
    //                móvil el sidebar completo se oculta por CSS.
    // Si solo se filtrara una, un cliente Lite vería en el teléfono pestañas que
    // no ha comprado (o al revés, le faltarían en el escritorio).
    document.querySelectorAll('.nav-item[data-tab], .smm-item[data-tab]').forEach((el) => {
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
    const tier = tierActual();
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
