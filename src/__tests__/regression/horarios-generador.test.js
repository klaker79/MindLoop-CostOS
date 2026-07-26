/**
 * @jest-environment node
 *
 * Guard de regresión — bug 2026-07-26.
 *
 * El generador de horarios tenía la plantilla de La Nave 5 escrita a mano en el
 * código (`nombreLower.includes('bea')`, `'fran'`, `'laura'`…), y el filtro
 * COCINA/SALA usaba listas de nombres. Consecuencias en CUALQUIER tenant:
 *
 *  1. Un empleado con 1 día libre fijo recibía ADEMÁS un patrón inventado de 2
 *     días (`patrones[empIndex % 4]`) porque el `else` exigía `length >= 2`.
 *     Los dos se acumulaban → 3 días libres con 1 configurado (JUAN, 32h/40h).
 *  2. `horas_contrato` no se leía nunca: turno fijo de 8h para todos.
 *  3. Un "Fran" de otro restaurante heredaba el horario del Fran de La Nave 5,
 *     y un "JUAN" aparecía en SALA aunque su ficha dijera Cocina.
 *
 * Fix: las reglas salen SOLO de la ficha (dias_libres_fijos, horas_contrato,
 * puesto). Este test falla si alguien vuelve a cablear un nombre propio.
 */
import { readFileSync } from 'fs';

const RUTA = 'src/modules/horarios/horarios.js';
const src = readFileSync(RUTA, 'utf8');

/** Extrae el cuerpo de una función del fuente para poder ejecutarla aislada. */
function extraerFuncion(nombre) {
    const inicio = src.indexOf(`function ${nombre}(`);
    if (inicio === -1) throw new Error(`Función no encontrada en ${RUTA}: ${nombre}`);
    let profundidad = 0;
    for (let i = src.indexOf('{', inicio); i < src.length; i++) {
        if (src[i] === '{') profundidad++;
        else if (src[i] === '}') {
            profundidad--;
            if (profundidad === 0) return src.slice(inicio, i + 1);
        }
    }
    throw new Error(`Cuerpo sin cerrar: ${nombre}`);
}

const sandbox = new Function(`
    const DESCANSO_SEMANAL_MINIMO = 2;
    const HORA_ENTRADA_DEFECTO = '10:00';
    const JORNADA_MIN_HORAS = 2;
    const JORNADA_MAX_HORAS = 12;
    ${extraerFuncion('calcularDiasLibresSemana')}
    ${extraerFuncion('normalizarHora')}
    ${extraerFuncion('sumarMinutos')}
    ${extraerFuncion('calcularTurnoDiario')}
    return { calcularDiasLibresSemana, normalizarHora, sumarMinutos, calcularTurnoDiario };
`)();

const { calcularDiasLibresSemana, normalizarHora, calcularTurnoDiario } = sandbox;

const duracionHoras = (inicio, fin) => {
    const [hi, mi] = inicio.split(':').map(Number);
    const [hf, mf] = fin.split(':').map(Number);
    return ((hf * 60 + mf) - (hi * 60 + mi)) / 60;
};

describe('Generador de horarios — sin nombres cableados', () => {
    const NOMBRES_PROHIBIDOS = ['bea', 'fran', 'laura', 'lola', 'javi', 'iker', 'perol', 'lorena', 'guille'];

    test.each(NOMBRES_PROHIBIDOS)('no hay reglas por el nombre "%s"', (nombre) => {
        const patron = new RegExp(`includes\\(\\s*['"\`]${nombre}`, 'i');
        expect(src).not.toMatch(patron);
    });

    test('el filtro de departamento usa `puesto`, no listas de nombres', () => {
        expect(src).not.toMatch(/const\s+(COCINA|SALA)\s*=\s*\[/);
        expect(src).toMatch(/emp\.puesto\s*\|\|\s*''\)\.toLowerCase\(\)\s*===\s*filtroDepartamento/);
    });

    test('el generador lee horas_contrato de la ficha', () => {
        expect(src).toMatch(/calcularTurnoDiario\(emp\.horas_contrato/);
    });

    test('ya no existe el patrón rotativo inventado que ignoraba la ficha', () => {
        expect(src).not.toMatch(/patrones\[empIndex\s*%\s*patrones\.length\]/);
    });
});

describe('Días libres — los fijos cuentan DENTRO del cupo, no se suman', () => {
    // El caso exacto del bug: 1 día libre fijo (Martes) → deben salir 2, no 3.
    test.each([0, 1, 2, 3])('un solo fijo (Mar) da 2 días libres — semana %i', (semana) => {
        for (let empIndex = 0; empIndex < 4; empIndex++) {
            const libres = calcularDiasLibresSemana([2], empIndex, semana);
            expect(libres).toHaveLength(2);
            expect(libres).toContain(2);
        }
    });

    test('con 2 fijos no añade un tercero', () => {
        for (let semana = 0; semana < 4; semana++) {
            expect(calcularDiasLibresSemana([0, 6], 0, semana)).toEqual([0, 6]);
        }
    });

    test('respeta plantillas de muchos días libres (p. ej. solo trabaja sábado)', () => {
        const libres = calcularDiasLibresSemana([0, 1, 2, 3, 4, 5], 0, 0);
        expect(libres).toEqual([0, 1, 2, 3, 4, 5]);
        expect(libres).not.toContain(6);
    });

    test('sin días fijos asigna 2 libres consecutivos', () => {
        for (let empIndex = 0; empIndex < 7; empIndex++) {
            const [a, b] = calcularDiasLibresSemana([], empIndex, 0);
            const distancia = Math.abs(a - b);
            expect(distancia === 1 || distancia === 6).toBe(true);
        }
    });

    test('reparte: no todos los empleados libran los mismos días', () => {
        const combinaciones = new Set();
        for (let empIndex = 0; empIndex < 5; empIndex++) {
            combinaciones.add(calcularDiasLibresSemana([], empIndex, 0).join(','));
        }
        expect(combinaciones.size).toBeGreaterThan(1);
    });

    test('aguanta datos corruptos en dias_libres_fijos', () => {
        for (const basura of [null, undefined, [], ['2'], [9, -1, 3], ['x']]) {
            const libres = calcularDiasLibresSemana(basura, 0, 0);
            expect(libres.length).toBeGreaterThanOrEqual(2);
            expect(libres.every(d => Number.isInteger(d) && d >= 0 && d <= 6)).toBe(true);
        }
    });
});

describe('Turno diario — reparte las horas de contrato', () => {
    test.each([[40, 8], [20, 4], [30, 6], [35, 7], [37.5, 7.5]])(
        'contrato %ph en 5 días → jornada de %ph', (contrato, esperadas) => {
            const turno = calcularTurnoDiario(contrato, 5);
            expect(duracionHoras(turno.hora_inicio, turno.hora_fin)).toBeCloseTo(esperadas, 2);
        });

    test('el total semanal nunca supera el contrato', () => {
        for (const contrato of [40, 24, 32, 38, 21]) {
            const turno = calcularTurnoDiario(contrato, 5);
            const total = duracionHoras(turno.hora_inicio, turno.hora_fin) * 5;
            expect(total).toBeLessThanOrEqual(contrato);
            expect(contrato - total).toBeLessThan(0.1); // menos de 6 min de desvío
        }
    });

    test('acota la jornada a un máximo razonable', () => {
        const turno = calcularTurnoDiario(40, 1);
        expect(duracionHoras(turno.hora_inicio, turno.hora_fin)).toBeLessThanOrEqual(12);
    });

    test('sin días de trabajo no genera turno', () => {
        expect(calcularTurnoDiario(40, 0)).toBeNull();
    });

    test('horas_contrato vacío cae a 40h', () => {
        for (const vacio of [null, undefined, 0, '']) {
            const turno = calcularTurnoDiario(vacio, 5);
            expect(duracionHoras(turno.hora_inicio, turno.hora_fin)).toBeCloseTo(8, 2);
        }
    });
});

describe('Hora de entrada — sale de la ficha, no del nombre', () => {
    test('el generador pasa emp.hora_entrada a calcularTurnoDiario', () => {
        expect(src).toMatch(/calcularTurnoDiario\(emp\.horas_contrato,\s*diasTrabajo,\s*emp\.hora_entrada\)/);
    });

    test('la hora de la ficha manda sobre el defecto', () => {
        // El caso que antes estaba cableado como `if (includes('fran'))`
        const turno = calcularTurnoDiario(40, 5, '11:30');
        expect(turno.hora_inicio).toBe('11:30');
        expect(turno.hora_fin).toBe('19:30');
    });

    test('sin hora en la ficha entra a las 10:00 (comportamiento previo)', () => {
        for (const vacio of [null, undefined, '']) {
            const turno = calcularTurnoDiario(40, 5, vacio);
            expect(turno.hora_inicio).toBe('10:00');
            expect(turno.hora_fin).toBe('18:00');
        }
    });

    test('acepta el HH:MM:SS que devuelve Postgres para columnas TIME', () => {
        const turno = calcularTurnoDiario(40, 5, '11:30:00');
        expect(turno.hora_inicio).toBe('11:30');
        expect(turno.hora_fin).toBe('19:30');
    });

    test('normalizarHora limpia la entrada y cae al defecto con basura', () => {
        expect(normalizarHora('9:05')).toBe('09:05');
        expect(normalizarHora('23:59:59')).toBe('23:59');
        for (const basura of [null, undefined, '', 'abc', '24:00', '10:60', '10']) {
            expect(normalizarHora(basura)).toBe('10:00');
        }
    });

    test('un turno que cruza medianoche no rompe el formato', () => {
        const turno = calcularTurnoDiario(60, 5, '23:00'); // 12h (tope) desde las 23:00
        expect(turno.hora_fin).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        expect(turno.hora_fin).toBe('11:00');
    });
});
