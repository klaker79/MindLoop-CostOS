/**
 * Generador de recomendaciones REALES para cada plato.
 *
 * Calcula medias del menú (precio, food cost, margen contribución,
 * popularidad) y para cada plato genera 4-6 frases con números
 * concretos basadas en su desviación respecto a la media + la
 * estrategia BCG que toca.
 *
 * Reglas (Jack Miller + Excel Ingeniería de Menús):
 *   ⭐ Estrella   → subir precio gradual, hero en marketing, sugerencia
 *                   del camarero. Proyectar ganancia si se sube precio
 *                   5-10% asumiendo ventas estables.
 *   ❓ Puzzle    → mejorar visibilidad, foto, combos con estrellas,
 *                   medir 4 semanas; si no mejora, evaluar retirada.
 *   🐴 Caballo   → subir precio o reducir coste; calcular cuánto hay
 *                   que ahorrar en coste para igualar margen medio.
 *   🐶 Perro     → retirar / reformular; cuantificar tiempo de cocina
 *                   y espacio que libera.
 *
 * Sólo se generan frases cuando los datos lo permiten — si el plato no
 * tiene ventas, no hablamos de proyección de ganancia. Si su food cost
 * es null, no opinamos sobre el coste.
 */

import { cm } from '../../utils/helpers.js';

const FOOD_COST_TARGET = 35;
const FOOD_COST_ALERTA = 40;

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function fmt(n, decimals = 2) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toFixed(decimals);
}

function fmtInt(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '0';
    return String(Math.round(Number(n)));
}

/**
 * Calcula medias del menú a partir del array que devuelve /menu-engineering.
 * Sólo cuenta platos con datos válidos.
 */
export function calcularMediasMenu(platos) {
    if (!Array.isArray(platos) || platos.length === 0) {
        return { precio: 0, foodCost: 0, margen: 0, popularidad: 0, totalPlatos: 0 };
    }
    let sumaPrecio = 0, sumaFc = 0, sumaMargen = 0, sumaPop = 0;
    let nPrecio = 0, nFc = 0, nMargen = 0, nPop = 0;
    platos.forEach(p => {
        const precio = num(p.precio_venta);
        const fc = num(p.foodCost);
        const margen = num(p.margen);
        const pop = num(p.popularidad ?? p.cantidad_vendida);
        if (precio !== null && precio > 0) { sumaPrecio += precio; nPrecio++; }
        if (fc !== null && fc > 0) { sumaFc += fc; nFc++; }
        if (margen !== null) { sumaMargen += margen; nMargen++; }
        if (pop !== null && pop > 0) { sumaPop += pop; nPop++; }
    });
    return {
        precio: nPrecio > 0 ? sumaPrecio / nPrecio : 0,
        foodCost: nFc > 0 ? sumaFc / nFc : 0,
        margen: nMargen > 0 ? sumaMargen / nMargen : 0,
        popularidad: nPop > 0 ? sumaPop / nPop : 0,
        totalPlatos: platos.length
    };
}

function frasePopularidad(plato, medias) {
    const pop = num(plato.popularidad ?? plato.cantidad_vendida);
    if (pop === null || medias.popularidad === 0) return null;
    const ratio = pop / medias.popularidad;
    if (ratio >= 1.5) {
        return `Vendes ${fmtInt(pop)} unidades, ${fmt(ratio, 1)}× la media del menú (${fmtInt(medias.popularidad)} ud). Es uno de tus platos más demandados.`;
    }
    if (ratio >= 1.0) {
        return `Vendes ${fmtInt(pop)} unidades, ligeramente por encima de la media (${fmtInt(medias.popularidad)} ud).`;
    }
    if (pop === 0) {
        return `No se ha vendido en este periodo. Decide si es estacional o si conviene retirarlo de la carta.`;
    }
    return `Vendes ${fmtInt(pop)} unidades vs media de ${fmtInt(medias.popularidad)}. Por debajo de lo esperado.`;
}

function fraseMargenVsMedia(plato, medias) {
    const margen = num(plato.margen);
    if (margen === null || medias.margen === 0) return null;
    const dif = margen - medias.margen;
    if (Math.abs(dif) < 0.5) {
        return `Margen unitario ${cm(fmt(margen))}, en línea con la media (${cm(fmt(medias.margen))}).`;
    }
    if (dif > 0) {
        return `Margen unitario ${cm(fmt(margen))}, ${cm(fmt(dif))} por encima de la media. Cada venta deja ${cm(fmt(dif))} más que un plato promedio.`;
    }
    return `Margen unitario ${cm(fmt(margen))}, ${cm(fmt(Math.abs(dif)))} por debajo de la media. Cada venta deja menos que el plato promedio.`;
}

function fraseFoodCost(plato) {
    const fc = num(plato.foodCost);
    if (fc === null) return null;
    if (fc <= 30) {
        return `Food cost ${fmt(fc, 1)}%, excelente — muy por debajo del objetivo (${FOOD_COST_TARGET}%). Margen muy sano.`;
    }
    if (fc <= FOOD_COST_TARGET) {
        return `Food cost ${fmt(fc, 1)}%, dentro del objetivo (${FOOD_COST_TARGET}%).`;
    }
    if (fc <= FOOD_COST_ALERTA) {
        return `Food cost ${fmt(fc, 1)}% — por encima del objetivo (${FOOD_COST_TARGET}%). Revisa proveedor o porción del ingrediente más caro.`;
    }
    return `Food cost ${fmt(fc, 1)}% — alerta. Por encima del umbral del ${FOOD_COST_ALERTA}%. Necesita acción urgente: cambiar ingrediente, reducir porción o subir precio.`;
}

function proyectarSubidaPrecio(plato, pct) {
    const precio = num(plato.precio_venta);
    const ventas = num(plato.popularidad ?? plato.cantidad_vendida);
    if (precio === null || precio <= 0 || ventas === null || ventas <= 0) return null;
    const factor = 1 + (pct / 100);
    const precioObjetivo = precio * factor;
    const ganancia = (precioObjetivo - precio) * ventas;
    return { precioObjetivo, ganancia };
}

function frasesEstrella(plato, medias) {
    const frases = [];
    const popF = frasePopularidad(plato, medias);
    const margenF = fraseMargenVsMedia(plato, medias);
    const fcF = fraseFoodCost(plato);
    if (popF) frases.push(popF);
    if (margenF) frases.push(margenF);
    if (fcF) frases.push(fcF);

    // Proyección subida +5% (conservadora para no perder demanda)
    const proy = proyectarSubidaPrecio(plato, 5);
    if (proy) {
        frases.push(`Subiendo a ${cm(fmt(proy.precioObjetivo))} (+5%), si las ventas se mantienen ganas ${cm(fmt(proy.ganancia))} extra en este periodo.`);
    }
    frases.push('Conviértelo en hero de redes sociales y forma al camarero para recomendarlo en cada mesa.');
    return frases;
}

function frasesPuzzle(plato, medias) {
    const frases = [];
    const margenF = fraseMargenVsMedia(plato, medias);
    if (margenF) frases.push(margenF);
    const fcF = fraseFoodCost(plato);
    if (fcF) frases.push(fcF);
    const pop = num(plato.popularidad ?? plato.cantidad_vendida);
    if (pop !== null && medias.popularidad > 0) {
        const gap = medias.popularidad - pop;
        if (gap > 0) {
            frases.push(`Necesitas ${fmtInt(gap)} ventas más para alcanzar la media del menú (${fmtInt(medias.popularidad)} ud). Si lo destacas 4 semanas, ${fmtInt(Math.ceil(gap / 4))} ventas extra por semana lo logran.`);
        }
    }
    frases.push('Mejora descripción y orden en carta. Pide foto profesional si aún no la tiene.');
    frases.push('Crea un combo con tus platos Estrella para empujar pruebas.');
    frases.push('Mide 4 semanas. Si las ventas no suben, evalúa retirarlo y liberar espacio de cocina.');
    return frases;
}

function frasesCaballo(plato, medias) {
    const frases = [];
    const popF = frasePopularidad(plato, medias);
    if (popF) frases.push(popF);
    const margenF = fraseMargenVsMedia(plato, medias);
    if (margenF) frases.push(margenF);
    const fcF = fraseFoodCost(plato);
    if (fcF) frases.push(fcF);

    // Cuantificar cuánto haría falta subir el precio para igualar el margen medio
    const margen = num(plato.margen);
    const precio = num(plato.precio_venta);
    if (margen !== null && precio !== null && medias.margen > margen) {
        const gapMargen = medias.margen - margen;
        const precioNuevo = precio + gapMargen;
        const pctNecesario = Math.round((gapMargen / precio) * 100);
        if (pctNecesario > 0 && pctNecesario < 30) {
            frases.push(`Para igualar el margen medio, subiría a ${cm(fmt(precioNuevo))} (+${pctNecesario}%). Considera una subida gradual del 5-10% y mide impacto en demanda.`);
        }
    }
    frases.push('Renegocia con tu proveedor del ingrediente principal. Pequeña bajada de coste multiplica margen.');
    frases.push('Reduce porción 5-10% sin tocar la percepción. Suele pasar desapercibido y dispara margen.');
    return frases;
}

function frasesPerro(plato, medias) {
    const frases = [];
    const popF = frasePopularidad(plato, medias);
    if (popF) frases.push(popF);
    const margenF = fraseMargenVsMedia(plato, medias);
    if (margenF) frases.push(margenF);
    frases.push('Retira del menú principal: ocupa espacio sin aportar margen ni demanda.');
    frases.push('Si tiene valor sentimental, déjalo como "especial del día" puntual.');
    frases.push('Plantea reformularlo con otro ingrediente principal y reposicionarlo.');
    frases.push('Redirige los recursos liberados (espacio, tiempo de cocina, marketing) a tus platos Estrella.');
    return frases;
}

/**
 * Genera la lista de recomendaciones reales para un plato.
 *
 * @param {object} plato - item de /menu-engineering
 * @param {object} medias - calculadas con calcularMediasMenu()
 * @returns {string[]}
 */
export function generarRecomendaciones(plato, medias) {
    if (!plato) return [];
    const cat = plato.clasificacion || 'perro';
    if (cat === 'estrella') return frasesEstrella(plato, medias);
    if (cat === 'puzzle') return frasesPuzzle(plato, medias);
    if (cat === 'caballo') return frasesCaballo(plato, medias);
    return frasesPerro(plato, medias);
}
