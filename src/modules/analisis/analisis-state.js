/**
 * Estado compartido del módulo Análisis.
 *
 * Mantiene el periodo activo y cachea los datos del backend para que
 * el dashboard sintético, la matriz BCG y el módulo Omnes no hagan
 * tres llamadas separadas por el mismo periodo.
 *
 * Cache se invalida cuando:
 *   - cambia el periodo
 *   - el usuario pulsa "Refrescar"
 *   - pasa más de 5 minutos desde la última carga (por si dejas el
 *     navegador abierto y vuelves al rato).
 */

import { api, apiClient } from '../../api/client.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const state = {
    periodo: { tipo: 'historico', desde: null, hasta: null },
    menuEngineering: { data: null, ts: 0 },
    omnes: { data: null, ts: 0 },
    // Food cost canónico (COGS/ingresos) del mismo endpoint que el KPI del
    // dashboard, para que el food cost del Punto de Equilibrio sea IDÉNTICO.
    pnl: { data: null, ts: 0 },
    // Medias del menú (precio, foodCost, margen, popularidad) calculadas
    // a partir del último BCG cargado. Las usa el modal drill-down para
    // generar recomendaciones reales por plato.
    medias: null
};

const listeners = new Set();

function isExpired(entry) {
    return !entry.data || (Date.now() - entry.ts) > CACHE_TTL_MS;
}

function notify() {
    listeners.forEach(fn => {
        try { fn(state); } catch (e) { console.warn('analisis listener error', e); }
    });
}

/**
 * Calcula `desde`/`hasta` ISO (YYYY-MM-DD, hasta exclusivo) según el tipo.
 * `hasta` es siempre día siguiente a hoy (exclusivo).
 */
function rangoDelTipo(tipo) {
    const hoy = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const sum = (d, days) => { const c = new Date(d); c.setDate(c.getDate() + days); return c; };
    const hasta = sum(hoy, 1);
    if (tipo === 'mes') {
        return { desde: iso(sum(hoy, -30)), hasta: iso(hasta) };
    }
    if (tipo === 'trimestre') {
        return { desde: iso(sum(hoy, -90)), hasta: iso(hasta) };
    }
    if (tipo === 'anio') {
        return { desde: iso(sum(hoy, -365)), hasta: iso(hasta) };
    }
    // 'historico' → null (backend usa todo)
    return { desde: null, hasta: null };
}

/**
 * Cambia el periodo activo. `tipo` ∈ 'historico'|'mes'|'trimestre'|'anio'|'custom'.
 * Si tipo === 'custom', desde/hasta vienen del caller.
 */
export function setPeriodo(tipo, customDesde = null, customHasta = null) {
    if (tipo === 'custom') {
        state.periodo = { tipo, desde: customDesde, hasta: customHasta };
    } else {
        const rango = rangoDelTipo(tipo);
        state.periodo = { tipo, ...rango };
    }
    // Invalida cache
    state.menuEngineering = { data: null, ts: 0 };
    state.omnes = { data: null, ts: 0 };
    state.pnl = { data: null, ts: 0 };
    notify();
}

export function getPeriodo() {
    return { ...state.periodo };
}

/**
 * Guarda las medias calculadas del menú en el state. Las invoca el
 * orchestrator después de cargar el BCG, para que el modal drill-down
 * pueda generar recomendaciones reales sin recalcular.
 */
export function setMedias(medias) {
    state.medias = medias;
}

export function getMedias() {
    return state.medias;
}

/**
 * Devuelve datos de menu-engineering. Si están en cache válida, los devuelve.
 * Si no, fetch al backend y los guarda en cache.
 */
export async function getMenuEngineering({ force = false } = {}) {
    if (!force && !isExpired(state.menuEngineering)) {
        return state.menuEngineering.data;
    }
    const { desde, hasta } = state.periodo;
    const data = await api.getMenuEngineering(desde && hasta ? { desde, hasta } : undefined);
    state.menuEngineering = { data, ts: Date.now() };
    return data;
}

/**
 * Devuelve datos de Principios de Omnes. Mismo patrón de cache.
 */
export async function getOmnes({ force = false } = {}) {
    if (!force && !isExpired(state.omnes)) {
        return state.omnes.data;
    }
    const { desde, hasta } = state.periodo;
    const data = await api.getOmnes(desde && hasta ? { desde, hasta } : undefined);
    state.omnes = { data, ts: Date.now() };
    return data;
}

/**
 * Devuelve el food cost canónico (COGS/ingresos) del MISMO endpoint que usa el
 * KPI del dashboard (/analytics/pnl-breakdown → food.food_cost_pct), para el
 * periodo activo de Análisis. Así el food cost del Punto de Equilibrio es el
 * mismo número que en el resto de la app. Devuelve null si falla (el break-even
 * cae entonces a su cálculo propio COGS/ingresos desde menu-engineering).
 */
export async function getFoodCostCanonical({ force = false } = {}) {
    if (!force && !isExpired(state.pnl)) return state.pnl.data;
    // SIEMPRE el MES EN CURSO (no el periodo de Análisis): un punto de equilibrio
    // debe reflejar el food cost de AHORA, no el histórico (que arrastra periodos
    // con otros precios). Y así coincide con el KPI mensual del dashboard.
    const hoy = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const desde = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    const hasta = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1));
    try {
        const resp = await apiClient.get(`/analytics/pnl-breakdown?desde=${desde}&hasta=${hasta}`);
        const fc = parseFloat(resp?.food?.food_cost_pct);
        const val = Number.isFinite(fc) && fc > 0 ? fc : null;
        state.pnl = { data: val, ts: Date.now() };
        return val;
    } catch (e) {
        console.warn('[analisis] pnl-breakdown (food cost canónico) falló:', e?.message);
        return null;
    }
}

/**
 * Fuerza refresh de TODOS los datos del módulo (recarga BCG + Omnes).
 */
export async function refrescarTodo() {
    state.menuEngineering = { data: null, ts: 0 };
    state.omnes = { data: null, ts: 0 };
    state.pnl = { data: null, ts: 0 };
    notify();
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Exponer en window para que el legacy app-core pueda compartir el estado
// durante la migración (D2-D5).
if (typeof window !== 'undefined') {
    window.__analisisState = {
        setPeriodo, getPeriodo, getMenuEngineering, getOmnes, refrescarTodo, subscribe,
        setMedias, getMedias
    };
}
