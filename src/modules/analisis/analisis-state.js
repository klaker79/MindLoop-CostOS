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
 * Devuelve el food cost canónico GLOBAL (comida + bebida) del MISMO endpoint
 * que usa el KPI del dashboard y Omnes (/analytics/pnl-breakdown), para el rango
 * {desde, hasta} que se le pase (el break-even usa una VENTANA MÓVIL de 90 días,
 * no el histórico). Se calcula como (cogs_food + cogs_beverage) / (ing_food +
 * ing_beverage) × 100 — EXACTAMENTE la misma fórmula que Omnes (fc_total), para
 * que el food cost del Punto de Equilibrio sea el MISMO número que Omnes para ese
 * mismo periodo. Un punto de equilibrio va sobre TODA la facturación (comida +
 * bebida) → el food cost correcto es el global. null si falla.
 * @param {Object} [opts] - { desde, hasta } ISO. Si faltan, usa todo el histórico.
 */
export async function getFoodCostCanonical({ force = false, desde, hasta } = {}) {
    if (!desde || !hasta) {
        const hoy = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
        desde = '2000-01-01';
        hasta = iso(manana);
    }
    // La cache lleva el RANGO como clave: si otro consumidor pide otro periodo,
    // no puede recibir el número cacheado de un rango distinto (auditoría
    // 2026-07-09 — antes la cache ignoraba desde/hasta).
    const rangoKey = `${desde}|${hasta}`;
    if (!force && !isExpired(state.pnl) && state.pnl.key === rangoKey) return state.pnl.data;
    try {
        const resp = await apiClient.get(`/analytics/pnl-breakdown?desde=${desde}&hasta=${hasta}`);
        // Global = (COGS comida + COGS bebida) / (ingresos comida + ingresos
        // bebida). MISMA base que Omnes (excluye 'otros', no vendido a cliente).
        const f = resp?.food || {};
        const b = resp?.beverage || {};
        const cogs = (parseFloat(f.cogs) || 0) + (parseFloat(b.cogs) || 0);
        const ing = (parseFloat(f.ingresos) || 0) + (parseFloat(b.ingresos) || 0);
        const val = ing > 0 ? Math.round((cogs / ing) * 1000) / 10 : null; // 1 decimal, como Omnes
        state.pnl = { data: val, ts: Date.now(), key: rangoKey };
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
