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
 * Ventana móvil (días hacia atrás) sobre la que se calcula el punto de
 * equilibrio: food cost, ticket y margen. NO se usa el histórico completo (que
 * arrastra precios/carta viejos) — un número de supervivencia debe reflejar la
 * realidad RECIENTE. 90 días = reciente y estable (Iker 2026-07-08).
 */
export const VENTANA_DIAS = 90;

/**
 * Impuestos NO OPERATIVOS: los que NO son coste de explotación y por tanto NO
 * cuentan en el P&L operativo ni en el punto de equilibrio.
 *   - IVA / IGIC: pass-through. Lo cobras al cliente y lo devuelves a Hacienda,
 *     no es un coste tuyo (si no vendes, no lo pagas).
 *   - IRPF (autónomo) / Impuesto de Sociedades: tributos sobre el BENEFICIO —
 *     solo aparecen si ganas. Meterlos en el equilibrio es circular.
 *
 * SÍ cuentan (son gasto fijo de explotación, se pagan por tener el negocio
 * abierto vendas o no, como el alquiler): IAE, IBI, tasas de basura, licencias,
 * seguros… → NO están en esta lista.
 *
 * Regla mnemotécnica (Iker + validación contable 2026-07-08): "si mañana no
 * vendes ni un café, ¿lo seguirías pagando?". Alquiler/seguro/IAE = sí (dentro).
 * IVA/Sociedades/IRPF = no (fuera).
 *
 * Se detecta por PALABRA COMPLETA normalizada (sin acentos, minúsculas) para no
 * dar falsos positivos: "Seguridad Social" NO matchea "sociedades".
 */
const TOKENS_IMPUESTO_NO_OPERATIVO = new Set([
    'iva', 'igic', 'irpf', 'sociedades'
]);

export function esImpuestoNoOperativo(concepto) {
    const norm = String(concepto || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return norm.split(/[^a-z0-9]+/).some(p => p && TOKENS_IMPUESTO_NO_OPERATIVO.has(p));
}

/**
 * Suma los gastos fijos DE EXPLOTACIÓN (operativos): excluye SOLO los impuestos
 * no operativos (IVA/IGIC/IRPF/Sociedades). Es lo que alimenta el P&L y el punto
 * de equilibrio. El IAE, IBI, tasas, licencias, etc. SÍ cuentan.
 * @param {Array} gastos - [{ concepto, monto_mensual }]
 */
export function sumaGastosOperativos(gastos) {
    const arr = Array.isArray(gastos) ? gastos : [];
    return arr.reduce(
        (s, g) => (esImpuestoNoOperativo(g.concepto) ? s : s + (parseFloat(g.monto_mensual) || 0)),
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
 * @param {number} [opts.foodCostCanonical] - food cost % del endpoint canónico
 *   (/analytics/pnl-breakdown, el MISMO que el KPI del dashboard). Si se pasa
 *   (>0 y <100), fija el food cost mostrado Y de él se deriva el margen, para
 *   que todo cuadre con el resto de la app. Si no, se calcula desde el menú.
 * @returns {Object} snapshot con `estado` y los números derivados.
 *   estado ∈ 'ok' | 'sin_gastos' | 'sin_ventas' | 'sin_margen'
 */
export function computeBreakeven({ platos, gastosFijosMes, diasServicio = DIAS_SERVICIO_MES_DEFAULT, foodCostCanonical } = {}) {
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

    const ticketMedio = sumTicket / unidades;       // € de venta por plato

    // Food cost + margen de contribución:
    //   - Con food cost CANÓNICO (mismo endpoint que el KPI del dashboard): ese
    //     es EL food cost (cuadra en toda la app) y de él sale el margen
    //     (contribución = ticket × (1 − foodCost)).
    //   - Sin él: se calcula desde el menú como COGS/ingresos (coste total ÷
    //     ventas totales) — método correcto, NO media de % ponderada por unidad.
    const fcCanon = num(foodCostCanonical);
    let foodCostMedio, margenPonderado;
    if (fcCanon > 0 && fcCanon < 100) {
        foodCostMedio = fcCanon;
        margenPonderado = ticketMedio * (1 - fcCanon / 100);
    } else {
        margenPonderado = sumMargen / unidades;
        foodCostMedio = sumTicket > 0 ? ((sumTicket - sumMargen) / sumTicket) * 100 : 0;
    }

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
