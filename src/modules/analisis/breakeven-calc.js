/**
 * Cálculo puro del Punto de Equilibrio (break-even).
 *
 * "¿Cuánto necesito facturar para no perder dinero?" — el número de
 * supervivencia del restaurante. Se calcula con:
 *
 *   Punto de equilibrio (platos/mes) = Gastos fijos mensuales
 *                                       ───────────────────────────
 *                                       Margen de contribución medio
 *
 * El margen de contribución es PONDERADO por lo que se vende de verdad
 * (Σ margen·unidades / Σ unidades), no un promedio simple de la carta.
 * Así el número refleja el mix real de ventas, no una media teórica.
 *
 * Este módulo es PURO (sin DOM, sin fetch, sin window) para poder testarlo
 * y para que el mismo cálculo alimente el bloque de Análisis y el mini del
 * Diario — así los números SIEMPRE cuadran entre las dos pantallas.
 */

/** Días de servicio al mes por defecto (restaurante que cierra ~1 día/semana). */
export const DIAS_SERVICIO_MES_DEFAULT = 26;

/**
 * Impuestos que NO son gasto fijo operativo y por tanto NO cuentan para el
 * punto de equilibrio:
 *   - IVA / IGIC: pass-through. Lo cobras al cliente y lo devuelves a Hacienda,
 *     no es un coste tuyo. Además escala con las ventas (no es fijo).
 *   - IRPF / Impuesto de Sociedades: tributos sobre el BENEFICIO — solo pagas si
 *     ganas. Meterlos en el equilibrio es circular.
 *   - IAE / IBI / otros tributos: impuestos, no coste operativo del servicio.
 * Meterlos infla el punto de equilibrio y da un número irreal (caso La Nave 5,
 * 2026-07-08: 45.645€ con impuestos vs 36.073€ operativos reales).
 *
 * Se detecta por PALABRA COMPLETA normalizada (sin acentos, minúsculas) para no
 * dar falsos positivos: "Seguridad Social" NO matchea "sociedades".
 */
const TOKENS_IMPUESTO = new Set([
    'iva', 'igic', 'irpf', 'iae', 'ibi', 'sociedades',
    'impuesto', 'impuestos', 'tributo', 'tributos', 'hacienda'
]);

export function esImpuesto(concepto) {
    const norm = String(concepto || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return norm.split(/[^a-z0-9]+/).some(p => p && TOKENS_IMPUESTO.has(p));
}

/**
 * Suma SOLO los gastos fijos OPERATIVOS (excluye impuestos). Es lo que debe
 * alimentar el punto de equilibrio.
 * @param {Array} gastos - [{ concepto, monto_mensual }]
 */
export function sumaGastosOperativos(gastos) {
    const arr = Array.isArray(gastos) ? gastos : [];
    return arr.reduce(
        (s, g) => (esImpuesto(g.concepto) ? s : s + (parseFloat(g.monto_mensual) || 0)),
        0
    );
}

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

/** Unidades vendidas de un plato. Mismo fallback que recomendaciones-plato.js. */
function unidadesDe(p) {
    return num(p.popularidad ?? p.cantidad_vendida);
}

/**
 * @param {Object} opts
 * @param {Array}  opts.platos          - array de /analysis/menu-engineering
 *                                         (cada uno: { precio_venta, foodCost, margen, popularidad }).
 * @param {number} opts.gastosFijosMes  - suma de gastos fijos mensuales (€).
 * @param {number} [opts.diasServicio]  - días de servicio/mes para la traducción diaria.
 * @returns {Object} snapshot con `estado` y los números derivados.
 *   estado ∈ 'ok' | 'sin_gastos' | 'sin_ventas' | 'sin_margen'
 */
export function computeBreakeven({ platos, gastosFijosMes, diasServicio = DIAS_SERVICIO_MES_DEFAULT } = {}) {
    const gastos = Math.max(0, num(gastosFijosMes));
    const dias = diasServicio > 0 ? diasServicio : DIAS_SERVICIO_MES_DEFAULT;

    if (gastos <= 0) {
        return { estado: 'sin_gastos', gastosFijosMes: 0, diasServicio: dias };
    }

    const lista = Array.isArray(platos) ? platos : [];
    const conVentas = lista.filter(p => unidadesDe(p) > 0);
    const unidades = conVentas.reduce((s, p) => s + unidadesDe(p), 0);

    if (conVentas.length === 0 || unidades <= 0) {
        return { estado: 'sin_ventas', gastosFijosMes: gastos, diasServicio: dias };
    }

    // Ponderados por unidades vendidas (mix real).
    const sumMargen = conVentas.reduce((s, p) => s + num(p.margen) * unidadesDe(p), 0);
    const sumTicket = conVentas.reduce((s, p) => s + num(p.precio_venta) * unidadesDe(p), 0);

    const margenPonderado = sumMargen / unidades;   // € de contribución por plato vendido
    const ticketMedio = sumTicket / unidades;       // € de venta por plato

    // Food cost = COGS / ingresos (coste total ÷ ventas totales), IGUAL que el
    // KPI canónico del dashboard (food-cost.js → /analytics/pnl-breakdown).
    // NO la media de porcentajes ponderada por unidades: eso da otro número
    // (un plato caro con food cost bajo pesa distinto) y no cuadraba con la app.
    // COGS = ingresos − margen (el margen ya es contribución = precio − coste).
    const foodCostMedio = sumTicket > 0 ? ((sumTicket - sumMargen) / sumTicket) * 100 : 0; // %

    if (margenPonderado <= 0) {
        return {
            estado: 'sin_margen',
            gastosFijosMes: gastos,
            diasServicio: dias,
            margenPonderado,
            ticketMedio,
            foodCostMedio
        };
    }

    const breakevenPlatosMes = Math.ceil(gastos / margenPonderado);
    const ventasEquilibrioMes = breakevenPlatosMes * ticketMedio;
    const ventasEquilibrioDia = ventasEquilibrioMes / dias;
    const platosDia = Math.ceil(breakevenPlatosMes / dias);

    // ── Palancas (qué pasa si mueves cada una) ─────────────────────────
    // 1) +1 € de margen por plato.
    const platosSiMargenMas1 = Math.ceil(gastos / (margenPonderado + 1));
    // 2) −500 € de gastos fijos al mes.
    const platosSiGastosMenos500 = Math.max(0, Math.ceil(Math.max(0, gastos - 500) / margenPonderado));
    // 3) −2 puntos de food cost → cada plato deja ~ticket·2% más de margen.
    const margenSiFood2 = margenPonderado + ticketMedio * 0.02;
    const platosSiFood2 = margenSiFood2 > 0 ? Math.ceil(gastos / margenSiFood2) : breakevenPlatosMes;

    return {
        estado: 'ok',
        gastosFijosMes: gastos,
        diasServicio: dias,
        unidades,
        margenPonderado,
        ticketMedio,
        foodCostMedio,
        breakevenPlatosMes,
        ventasEquilibrioMes,
        ventasEquilibrioDia,
        platosDia,
        palancas: {
            platosSiMargenMas1,
            reduccionMargenMas1: Math.max(0, breakevenPlatosMes - platosSiMargenMas1),
            platosSiGastosMenos500,
            reduccionGastosMenos500: Math.max(0, breakevenPlatosMes - platosSiGastosMenos500),
            platosSiFood2,
            reduccionFood2: Math.max(0, breakevenPlatosMes - platosSiFood2)
        }
    };
}
