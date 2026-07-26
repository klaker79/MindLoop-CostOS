/**
 * Reglas de jornada de hostelería — turno seguido y PARTIDO.
 *
 * Espejo de `src/utils/jornada.js` del backend: las mismas reglas a los dos
 * lados para que lo que pinta la rejilla coincida con lo que valida la API.
 *
 * Convenios:
 * - Horas como 'HH:MM'. La API ya las devuelve normalizadas, pero aceptamos
 *   'HH:MM:SS' por si acaso.
 * - Si `fin <= inicio`, el tramo cruza medianoche: 20:00-00:00 son 4h.
 *   En hostelería esto no es el caso raro, es el de todos los días.
 */

export const MINUTOS_DIA = 1440;
export const DESCANSO_ENTRE_JORNADAS_H = 12;
export const MAX_HORAS_TRAMO = 12;
export const MAX_HORAS_DIA = 12;

/** 'HH:MM' → minutos desde medianoche. null si no es una hora válida. */
export function aMinutos(hora) {
    const m = String(hora ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

/** minutos → 'HH:MM' (da la vuelta al pasar de medianoche). */
export function aHora(minutos) {
    const t = ((minutos % MINUTOS_DIA) + MINUTOS_DIA) % MINUTOS_DIA;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Normaliza a 'HH:MM'; si no hay valor válido devuelve `defecto`. */
export function normalizarHora(valor, defecto = null) {
    const min = aMinutos(valor);
    return min === null ? defecto : aHora(min);
}

/** Duración de un tramo en minutos, contando el cruce de medianoche. */
export function duracionTramoMin(inicio, fin) {
    const ini = aMinutos(inicio);
    const f = aMinutos(fin);
    if (ini === null || f === null) return null;
    return f > ini ? f - ini : f + MINUTOS_DIA - ini;
}

/** Duración de un tramo en horas decimales. */
export function duracionTramoHoras(inicio, fin) {
    const min = duracionTramoMin(inicio, fin);
    return min === null ? null : min / 60;
}

/** Suma las horas de una lista de tramos, ignorando los incompletos. */
export function horasDeTramos(tramos) {
    return (tramos || []).reduce((total, t) => {
        const h = duracionTramoHoras(t.hora_inicio, t.hora_fin);
        return total + (h === null ? 0 : h);
    }, 0);
}

/** ¿Se pisan dos tramos del mismo día? */
export function tramosSolapan(a, b) {
    const iniA = aMinutos(a.hora_inicio);
    const iniB = aMinutos(b.hora_inicio);
    const durA = duracionTramoMin(a.hora_inicio, a.hora_fin);
    const durB = duracionTramoMin(b.hora_inicio, b.hora_fin);
    if (iniA === null || iniB === null || durA === null || durB === null) return false;
    return iniA < iniB + durB && iniB < iniA + durA;
}

/**
 * Valida los tramos de un día.
 * @returns {{ valid: boolean, error?: string, horas?: number }}
 */
export function validarDia(tramos) {
    const lista = (tramos || []).filter(t => t && t.hora_inicio && t.hora_fin);
    if (lista.length === 0) return { valid: true, horas: 0 };
    if (lista.length > 2) return { valid: false, error: 'max_slots' };

    for (const t of lista) {
        const horas = duracionTramoHoras(t.hora_inicio, t.hora_fin);
        if (horas === null) return { valid: false, error: 'invalid_time' };
        if (horas > MAX_HORAS_TRAMO) return { valid: false, error: 'slot_too_long' };
    }

    if (lista.length === 2 && tramosSolapan(lista[0], lista[1])) {
        return { valid: false, error: 'slots_overlap' };
    }

    const horas = horasDeTramos(lista);
    if (horas > MAX_HORAS_DIA) return { valid: false, error: 'day_too_long' };

    return { valid: true, horas };
}

/**
 * Descanso entre el fin de una jornada y el inicio de la siguiente (12h).
 * Es el fallo típico del partido: cerrar a las 00:00 y entrar a las 09:00.
 * @returns {{ cumple: boolean, horas: number|null }}
 */
export function comprobarDescansoEntreJornadas(tramosDia, tramosDiaSiguiente) {
    const hoy = (tramosDia || []).filter(t => t && t.hora_inicio && t.hora_fin);
    const manana = (tramosDiaSiguiente || []).filter(t => t && t.hora_inicio && t.hora_fin);
    if (hoy.length === 0 || manana.length === 0) return { cumple: true, horas: null };

    const finHoy = Math.max(...hoy.map(t => aMinutos(t.hora_inicio) + duracionTramoMin(t.hora_inicio, t.hora_fin)));
    const inicioManana = MINUTOS_DIA + Math.min(...manana.map(t => aMinutos(t.hora_inicio)));
    const horas = (inicioManana - finHoy) / 60;

    return { cumple: horas >= DESCANSO_ENTRE_JORNADAS_H, horas };
}

/**
 * Tramos de un día a partir de la plantilla de la ficha, repartiendo
 * `minutosJornada`. Si la ficha define las horas de fin, mandan ellas: el chef
 * sabe mejor que el reparto automático a qué hora se cierra la cocina.
 */
export function tramosDesdePlantilla(plantilla, minutosJornada) {
    const p = plantilla || {};
    const partido = p.jornada_tipo === 'partido';
    const inicio1 = normalizarHora(p.tramo1_inicio ?? p.hora_entrada, '10:00');

    if (!partido) {
        const fin1 = normalizarHora(p.tramo1_fin) || aHora(aMinutos(inicio1) + minutosJornada);
        return [{ tramo: 1, hora_inicio: inicio1, hora_fin: fin1 }];
    }

    const inicio2 = normalizarHora(p.tramo2_inicio, '20:00');
    const fin1Ficha = normalizarHora(p.tramo1_fin);
    const fin2Ficha = normalizarHora(p.tramo2_fin);

    if (fin1Ficha && fin2Ficha) {
        return [
            { tramo: 1, hora_inicio: inicio1, hora_fin: fin1Ficha },
            { tramo: 2, hora_inicio: inicio2, hora_fin: fin2Ficha }
        ];
    }

    const mitad = Math.floor(minutosJornada / 2);
    return [
        { tramo: 1, hora_inicio: inicio1, hora_fin: aHora(aMinutos(inicio1) + mitad) },
        { tramo: 2, hora_inicio: inicio2, hora_fin: aHora(aMinutos(inicio2) + (minutosJornada - mitad)) }
    ];
}

/** Etiqueta corta de un día para la rejilla: "12:00-16:00 · 20:00-00:00". */
export function etiquetaTramos(tramos) {
    return (tramos || [])
        .filter(t => t && t.hora_inicio && t.hora_fin)
        .sort((a, b) => (a.tramo || 1) - (b.tramo || 1))
        .map(t => `${normalizarHora(t.hora_inicio)}-${normalizarHora(t.hora_fin)}`)
        .join(' · ');
}
