/**
 * El P&L del móvil dice lo MISMO que el del ordenador.
 *
 * En el teléfono la Cuenta de Resultados se enseña en una columna (total del
 * periodo) en vez de en 31. Eso es un cambio de forma, no de fondo: si el móvil
 * calculara por su cuenta, un día diría 3.720 € y el ordenador 3.690 €, y a
 * partir de ahí no te puedes fiar de ninguno de los dos.
 *
 * Por eso el módulo del móvil no tiene fórmulas propias: reutiliza
 * `computeBeneficioNetoDiario`, el mismo cálculo puro y testeado que usan la
 * tabla del escritorio y el gráfico de "Beneficio neto por día".
 *
 * Estos tests fijan justamente eso.
 */
import { totalesPeriodo, construirDiasInput, htmlPLMovil } from '@modules/balance/pl-movil.js';
import { computeBeneficioNetoDiario } from '@modules/analisis/pnl-diario-calc.js';

const DIAS = ['2026-07-01', '2026-07-02', '2026-07-03'];
const MAPAS = {
    ingresos: { '2026-07-01': 1000, '2026-07-02': 800, '2026-07-03': 0 },
    costes: { '2026-07-01': 300, '2026-07-02': 250, '2026-07-03': 0 },
    mermas: { '2026-07-02': 20 },
    comida: { '2026-07-01': 15 },
    extra: { '2026-07-02': 60 },
};
const GF_DIA = 100;   // gasto fijo repartido por día

describe('Los totales del periodo', () => {
    const t = totalesPeriodo(DIAS, MAPAS, GF_DIA);

    test('suman cada componente sobre los días mostrados', () => {
        expect(t.ingresos).toBe(1800);
        expect(t.costes).toBe(550);
        expect(t.margenBruto).toBe(1250);
        expect(t.mermas).toBe(20);
        expect(t.comida).toBe(15);
        expect(t.extra).toBe(60);
    });

    test('el gasto fijo del periodo es el del día × días MOSTRADOS', () => {
        // Nunca por días de calendario: ese fue el bug del 2026-07-08, que hacía
        // que el total no fuera la suma de las columnas.
        expect(t.gastosFijos).toBe(300);
    });

    test('el beneficio neto sale del cálculo compartido, no de una suma propia', () => {
        const referencia = computeBeneficioNetoDiario(construirDiasInput(DIAS, MAPAS), GF_DIA);
        expect(t.beneficioNeto).toBe(referencia.beneficioRealTotal);
    });

    test('⛔ INVARIANTE: el total es SIEMPRE la suma de los días', () => {
        // Es la misma regla que protege a la tabla del escritorio. Si el móvil la
        // rompiera, enseñaría un total que no cuadra con sus propias líneas.
        const suma = t.porDia.reduce((a, d) => a + d.beneficio, 0);
        expect(suma).toBeCloseTo(t.beneficioNeto, 10);
    });

    test('el margen se expresa sobre ingresos, y sin ventas no se inventa', () => {
        expect(t.margenPct).toBeCloseTo((1250 / 1800) * 100, 10);
        const vacio = totalesPeriodo(['2026-07-01'], { ingresos: {}, costes: {} }, 0);
        expect(vacio.margenPct).toBeNull();
    });
});

describe('Un día sin movimiento sigue costando dinero', () => {
    test('el día cerrado carga con su gasto fijo', () => {
        const t = totalesPeriodo(DIAS, MAPAS, GF_DIA);
        const dia3 = t.porDia.find(d => d.dia === '2026-07-03');
        expect(dia3.beneficio).toBe(-GF_DIA);
        expect(dia3.activo).toBe(false);
    });

    test('un día con solo mermas cuenta como día con movimiento', () => {
        const t = totalesPeriodo(['2026-07-05'], { mermas: { '2026-07-05': 30 } }, 0);
        expect(t.porDia[0].activo).toBe(true);
        expect(t.porDia[0].beneficio).toBe(-30);
    });
});

describe('construirDiasInput', () => {
    test('rellena con 0 los conceptos que no aparecen en los mapas', () => {
        const [d] = construirDiasInput(['2026-07-01'], { ingresos: { '2026-07-01': 50 } });
        expect(d).toMatchObject({ ingresos: 50, costos: 0, merma: 0, comida: 0, extra: 0 });
    });

    test('aguanta mapas ausentes sin reventar', () => {
        expect(() => construirDiasInput(['2026-07-01'], {})).not.toThrow();
        expect(() => construirDiasInput(undefined, undefined)).not.toThrow();
    });
});

describe('El HTML que se pinta', () => {
    const html = htmlPLMovil({ dias: DIAS, mapas: MAPAS, gastosFijosDia: GF_DIA, periodo: 'todo el mes' });

    test('lleva el contenedor que el CSS usa para enseñarlo solo en móvil', () => {
        expect(html).toContain('id="pl-movil"');
    });

    test('no monta ninguna tabla: eso es lo que se venía a evitar', () => {
        expect(html).not.toMatch(/<table/i);
    });

    test('enseña las líneas que cuentan la historia del periodo', () => {
        for (const linea of ['INGRESOS', 'MARGEN BRUTO', 'GASTOS FIJOS', 'BENEFICIO NETO']) {
            expect(html).toContain(linea);
        }
    });

    test('las líneas opcionales solo salen si tienen importe', () => {
        // Un P&L con "Mermas 0,00 €" y "Personal extra 0,00 €" es ruido.
        const limpio = htmlPLMovil({
            dias: ['2026-07-01'],
            mapas: { ingresos: { '2026-07-01': 100 }, costes: {} },
            gastosFijosDia: 0,
        });
        expect(limpio).not.toContain('Mermas');
        expect(limpio).not.toContain('Personal extra');
        expect(html).toContain('Mermas');
    });

    test('sin días con movimiento lo dice, en vez de dejar un hueco', () => {
        const vacio = htmlPLMovil({ dias: ['2026-07-01'], mapas: {}, gastosFijosDia: 0 });
        expect(vacio).toContain('Ningún día de este periodo tuvo movimiento');
    });
});
