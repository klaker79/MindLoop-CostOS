/**
 * Consejos inteligentes de las 3 palancas del Punto de Equilibrio.
 *
 * NO son plantillas: leen los datos reales del restaurante (platos de
 * menu-engineering + el snapshot del break-even) y adaptan el texto, el
 * tono y la PRIORIDAD a la situación concreta:
 *   - Food cost: nombra los platos que más suben la media.
 *   - Margen: nombra los Caballos (populares con margen justo) donde subir precio.
 *   - Gastos fijos: recuerda los olvidados + impacto real de recortar.
 *   - Prioridad: marca "empieza por aquí" en la palanca de mayor impacto.
 *
 * Determinista y puro (sin DOM, sin fetch) → testable y sin riesgo de que
 * la IA se invente nada. La misma filosofía que los Principios de Omnes.
 */

import { cm } from '../../utils/helpers.js';

function num(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}
function ud(p) {
    return num(p.popularidad ?? p.cantidad_vendida);
}
const fmtInt = (n) => Math.round(n).toLocaleString('es-ES');

/** Platos que más tiran del food cost medio: se venden Y tienen food cost alto. */
function topFoodOffenders(platos) {
    return platos
        .filter(p => ud(p) > 0 && num(p.foodCost) > 40)
        .sort((a, b) => (num(b.foodCost) * ud(b)) - (num(a.foodCost) * ud(a)))
        .slice(0, 2);
}

/** Caballos: populares pero con margen justo → candidatos a subir 30-50 cts. */
function topCaballos(platos) {
    return platos
        .filter(p => p.clasificacion === 'caballo' && ud(p) > 0)
        .sort((a, b) => ud(b) - ud(a))
        .slice(0, 2);
}

function listaNombres(arr, conFood) {
    return arr
        .map(p => conFood ? `"${p.nombre}" (${Math.round(num(p.foodCost))}%)` : `"${p.nombre}"`)
        .join(' y ');
}

/**
 * @param {Object} snap   - snapshot de computeBreakeven (estado 'ok').
 * @param {Array}  platos - array de /analysis/menu-engineering.
 * @returns {{ prioridad:'food'|'margen'|'gastos', margen:Tip, gastos:Tip, food:Tip }}
 *   Tip = { tono:'ok'|'warn'|'bad', titulo:string, texto:string }
 */
export function construirConsejos(snap, platos) {
    const lista = Array.isArray(platos) ? platos : [];
    const p = snap.palancas || {};
    const be = snap.breakevenPlatosMes || 0;

    // ── Food cost ─────────────────────────────────────────────────────
    const offenders = topFoodOffenders(lista);
    let food;
    if (snap.foodCostMedio <= 30) {
        food = {
            tono: 'ok',
            titulo: 'Food cost bajo control',
            texto: `Tu food cost medio (${snap.foodCostMedio.toFixed(0)}%) está excelente. Esta palanca ya la tienes fina — vigila que siga así.`
        };
    } else if (offenders.length) {
        food = {
            tono: snap.foodCostMedio > 40 ? 'bad' : 'warn',
            titulo: 'Ataca los que más suben el food cost',
            texto: `Tu food cost medio es ${snap.foodCostMedio.toFixed(0)}%. Los que más lo tiran: ${listaNombres(offenders, true)}. Ajusta su escandallo o proveedor y tu objetivo baja a ${fmtInt(p.platosSiFood2)} platos al mes.`
        };
    } else {
        food = {
            tono: snap.foodCostMedio > 35 ? 'warn' : 'ok',
            titulo: 'Baja el food cost',
            texto: `Tu food cost medio es ${snap.foodCostMedio.toFixed(0)}%. Bajarlo 2 puntos suma ~${cm(snap.ticketMedio * 0.02)}/plato de margen → objetivo a ${fmtInt(p.platosSiFood2)} platos al mes. Mira los Perros de la Matriz BCG.`
        };
    }

    // ── Margen ────────────────────────────────────────────────────────
    const caballos = topCaballos(lista);
    let margen;
    if (caballos.length) {
        margen = {
            tono: 'warn',
            titulo: 'Sube 30-50 cts donde no se nota',
            texto: `Tus más vendidos con margen justo: ${listaNombres(caballos, false)} (Caballos del BCG). Subir 30-50 cts ahí casi no se nota; con +1 € de margen tu objetivo baja de ${fmtInt(be)} a ${fmtInt(p.platosSiMargenMas1)} platos al mes.`
        };
    } else {
        margen = {
            tono: 'ok',
            titulo: 'Sube el margen',
            texto: `Escandalla bien y ajusta precios en bebidas, cafés y postres. Con +1 € de margen por plato tu objetivo baja de ${fmtInt(be)} a ${fmtInt(p.platosSiMargenMas1)} platos al mes.`
        };
    }

    // ── Gastos fijos (sin culpable por plato) ─────────────────────────
    const gastos = {
        tono: 'warn',
        titulo: 'Revisa lo que no ves',
        texto: `Tus gastos fijos son ${cm(snap.gastosFijosMes)}/mes. Revisa los que se cuelan (cuota de autónomo, préstamo, softwares que no usas): cada 500 €/mes menos son ${fmtInt(p.reduccionGastosMenos500)} platos al mes que ya no tienes que vender.`
    };

    // ── Prioridad: dónde empezar ──────────────────────────────────────
    let prioridad;
    if (snap.foodCostMedio > 38) prioridad = 'food';
    else if (caballos.length) prioridad = 'margen';
    else prioridad = 'gastos';

    return { prioridad, margen, gastos, food };
}

/**
 * Pregunta que se manda a Omnes al pulsar el botón. Se pasa por JS directo
 * (closure), NUNCA por un atributo HTML: el texto lleva números y signos y,
 * si se metía en data-omnes-q="...", una comilla lo truncaba (bug Iker
 * 2026-07-08: la pregunta llegaba cortada en "...NO mezcles" y Omnes decía
 * "el mensaje se cortó"). Sin comillas ASCII, por si acaso. Números
 * etiquetados por periodo (mensual vs diario) para que Omnes no los mezcle.
 */
export function construirPreguntaOmnes(snap) {
    return [
        'Estos son mis números del punto de equilibrio (mantén SIEMPRE el periodo al citarlos; no mezcles «al mes» con «al día» en la misma cifra):',
        `- Punto de equilibrio MENSUAL: ${snap.breakevenPlatosMes} platos al mes.`,
        `- Equivalente DIARIO: ${snap.platosDia} platos al día (${cm(snap.ventasEquilibrioDia)} de ventas al día).`,
        `- Food cost medio (global, últimos 90 días): ${Number(snap.foodCostMedio).toFixed(1)}%.`,
        `- Gastos fijos operativos: ${cm(snap.gastosFijosMes)} al mes.`,
        '¿Cuáles son las 2-3 acciones más concretas para bajar mi punto de equilibrio, según mis platos? Dímelo con nombres de platos concretos.'
    ].join('\n');
}
