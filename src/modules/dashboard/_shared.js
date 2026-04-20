/**
 * Dashboard shared helpers
 * ------------------------
 * Utilities used by multiple KPI modules. Pure DOM helpers, no state.
 * State (current period) lives in _state.js.
 */

// 💀 Skeleton placeholders
export const SKELETON_SPAN = '<span class="skeleton skeleton-number" data-skeleton>⠀</span>';
export const SKELETON_ROW = '<div class="skeleton skeleton-row" data-skeleton></div>';

export function showSkeletonIn(el, type = 'number') {
    if (!el) return;
    if (type === 'number') {
        el.innerHTML = SKELETON_SPAN;
    } else if (type === 'rows') {
        el.innerHTML = (SKELETON_ROW + SKELETON_ROW + SKELETON_ROW);
    }
}

/**
 * Have we loaded enough initial data to render meaningful KPIs?
 * Used as a gate to show skeletons until data arrives.
 */
export function isDataLoaded() {
    const ings = window.ingredientes || [];
    const recs = window.recetas || [];
    return ings.length > 0 || recs.length > 0;
}

/**
 * Resuelve {desde, hasta} ISO (YYYY-MM-DD) para consultas agregadas de backend
 * según el período del dashboard. `hasta` es EXCLUSIVE.
 *
 *   hoy    → [hoy, mañana)
 *   semana → [lunes, siguiente lunes)
 *   mes    → [día 1 del mes, día 1 del mes siguiente)
 */
export function rangoPeriodo(periodo) {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const add = (d, days) => { const c = new Date(d); c.setDate(c.getDate() + days); return c; };
    if (periodo === 'hoy') {
        return { desde: iso(today), hasta: iso(add(today, 1)) };
    }
    if (periodo === 'semana') {
        const dow = today.getDay(); // 0=Sun..6=Sat
        const diffToMonday = (dow + 6) % 7;
        const monday = add(today, -diffToMonday);
        return { desde: iso(monday), hasta: iso(add(monday, 7)) };
    }
    // default: mes actual
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return { desde: iso(firstOfMonth), hasta: iso(firstOfNext) };
}
