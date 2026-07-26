/**
 * @jest-environment node
 *
 * Guards de regresión del módulo de horarios.
 *
 * 2026-07-26 (a) — El generador tenía la plantilla de La Nave 5 escrita a mano
 * en el código (`nombreLower.includes('bea')`, `'fran'`…) y el filtro
 * COCINA/SALA usaba listas de nombres. En CUALQUIER tenant eso provocaba:
 * días libres duplicados (1 en la ficha → 3 reales), `horas_contrato` ignorado
 * y reglas heredadas por llamarse parecido.
 *
 * 2026-07-26 (b) — El modelo sólo admitía UN turno por empleado y día
 * (UNIQUE(empleado_id, fecha) + una sola hora de entrada), así que el turno
 * PARTIDO —la norma en hostelería— era imposible. Ahora el día son tramos.
 *
 * Este fichero falla si alguien vuelve a cablear un nombre propio o si el
 * generador deja de mirar la ficha del empleado.
 */
import { readFileSync } from 'fs';
import {
    horasDeTramos,
    validarDia,
    tramosDesdePlantilla,
    comprobarDescansoEntreJornadas
} from '../../modules/horarios/jornada.js';

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

// Ejecuta las funciones puras del módulo inyectándoles sus dependencias reales
// de jornada.js — así el test valida el código que corre en producción.
const sandbox = new Function('tramosDesdePlantilla', `
    const DESCANSO_SEMANAL_MINIMO = 2;
    const JORNADA_MIN_HORAS = 2;
    const JORNADA_MAX_HORAS = 12;
    ${extraerFuncion('calcularDiasLibresSemana')}
    ${extraerFuncion('minutosJornadaDiaria')}
    ${extraerFuncion('calcularTurnoDiario')}
    return { calcularDiasLibresSemana, minutosJornadaDiaria, calcularTurnoDiario };
`)(tramosDesdePlantilla);

const { calcularDiasLibresSemana, minutosJornadaDiaria, calcularTurnoDiario } = sandbox;

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

    test('el generador pasa la ficha entera (contrato + plantilla) al turno', () => {
        expect(src).toMatch(/calcularTurnoDiario\(emp,\s*diasTrabajo\)/);
    });

    test('ya no existe el patrón rotativo inventado que ignoraba la ficha', () => {
        expect(src).not.toMatch(/patrones\[empIndex\s*%\s*patrones\.length\]/);
    });
});

describe('Días libres — los fijos cuentan DENTRO del cupo, no se suman', () => {
    // El caso del bug: 1 día libre fijo (Martes) → deben salir 2, no 3.
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

describe('Jornada diaria — reparte las horas de contrato', () => {
    test.each([[40, 480], [20, 240], [30, 360], [35, 420], [37.5, 450]])(
        'contrato %ph en 5 días → %p min/día', (contrato, esperados) => {
            expect(minutosJornadaDiaria(contrato, 5)).toBe(esperados);
        });

    test('el total semanal nunca supera el contrato', () => {
        for (const contrato of [40, 24, 32, 38, 21]) {
            const total = (minutosJornadaDiaria(contrato, 5) * 5) / 60;
            expect(total).toBeLessThanOrEqual(contrato);
            expect(contrato - total).toBeLessThan(0.1);
        }
    });

    test('acota la jornada a un máximo razonable', () => {
        expect(minutosJornadaDiaria(40, 1)).toBeLessThanOrEqual(12 * 60);
    });

    test('sin días de trabajo no genera turno', () => {
        expect(minutosJornadaDiaria(40, 0)).toBeNull();
        expect(calcularTurnoDiario({ horas_contrato: 40 }, 0)).toEqual([]);
    });

    test('horas_contrato vacío cae a 40h', () => {
        for (const vacio of [null, undefined, 0, '']) {
            expect(minutosJornadaDiaria(vacio, 5)).toBe(480);
        }
    });
});

describe('Turno PARTIDO — la norma en hostelería', () => {
    test('jornada seguida genera UN tramo', () => {
        const t = calcularTurnoDiario(
            { horas_contrato: 40, jornada_tipo: 'seguido', tramo1_inicio: '10:00' }, 5);
        expect(t).toHaveLength(1);
        expect(t[0]).toEqual({ tramo: 1, hora_inicio: '10:00', hora_fin: '18:00' });
    });

    test('jornada partida genera DOS tramos que suman el día', () => {
        const t = calcularTurnoDiario({
            horas_contrato: 40, jornada_tipo: 'partido',
            tramo1_inicio: '12:00', tramo2_inicio: '20:00'
        }, 5);
        expect(t).toHaveLength(2);
        expect(t[0]).toEqual({ tramo: 1, hora_inicio: '12:00', hora_fin: '16:00' });
        expect(t[1]).toEqual({ tramo: 2, hora_inicio: '20:00', hora_fin: '00:00' });
        expect(horasDeTramos(t)).toBeCloseTo(8, 3);
    });

    test('las horas de la ficha mandan sobre el reparto automático', () => {
        const t = calcularTurnoDiario({
            horas_contrato: 40, jornada_tipo: 'partido',
            tramo1_inicio: '13:00', tramo1_fin: '16:30',
            tramo2_inicio: '20:00', tramo2_fin: '00:30'
        }, 5);
        expect(t[0].hora_fin).toBe('16:30');
        expect(t[1].hora_fin).toBe('00:30');
        expect(horasDeTramos(t)).toBeCloseTo(8, 3);
    });

    test('un tramo que cierra pasada la medianoche cuenta bien las horas', () => {
        expect(horasDeTramos([{ hora_inicio: '20:00', hora_fin: '00:00' }])).toBeCloseTo(4, 3);
        expect(horasDeTramos([{ hora_inicio: '20:00', hora_fin: '00:30' }])).toBeCloseTo(4.5, 3);
    });

    test('lo que genera la plantilla siempre es un día válido', () => {
        for (const contrato of [20, 30, 40, 45]) {
            for (const tipo of ['seguido', 'partido']) {
                const t = calcularTurnoDiario({
                    horas_contrato: contrato, jornada_tipo: tipo,
                    tramo1_inicio: '12:00', tramo2_inicio: '20:00'
                }, 5);
                expect(validarDia(t).valid).toBe(true);
            }
        }
    });

    test('rechaza tramos solapados', () => {
        const r = validarDia([
            { hora_inicio: '12:00', hora_fin: '18:00' },
            { hora_inicio: '16:00', hora_fin: '22:00' }
        ]);
        expect(r.valid).toBe(false);
        expect(r.error).toBe('slots_overlap');
    });
});

describe('Descanso legal entre jornadas (12h)', () => {
    test('cerrar a las 00:00 y entrar a las 09:00 NO cumple', () => {
        const r = comprobarDescansoEntreJornadas(
            [{ hora_inicio: '20:00', hora_fin: '00:00' }],
            [{ hora_inicio: '09:00', hora_fin: '17:00' }]
        );
        expect(r.cumple).toBe(false);
        expect(r.horas).toBeCloseTo(9, 1);
    });

    test('cerrar a las 00:00 y entrar a las 12:00 SÍ cumple', () => {
        const r = comprobarDescansoEntreJornadas(
            [{ hora_inicio: '20:00', hora_fin: '00:00' }],
            [{ hora_inicio: '12:00', hora_fin: '16:00' }]
        );
        expect(r.cumple).toBe(true);
    });

    test('el partido clásico encadenado día tras día cumple', () => {
        const partido = [
            { hora_inicio: '12:00', hora_fin: '16:00' },
            { hora_inicio: '20:00', hora_fin: '00:00' }
        ];
        expect(comprobarDescansoEntreJornadas(partido, partido).cumple).toBe(true);
    });

    test('la rejilla avisa del descanso corto', () => {
        expect(src).toMatch(/diasSinDescanso/);
        expect(src).toMatch(/horarios:rest_warning/);
    });
});
