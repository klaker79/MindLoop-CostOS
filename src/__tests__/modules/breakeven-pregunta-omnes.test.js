/**
 * La pregunta que el botón "Pregúntale a Omnes" manda al chat.
 *
 * Bug real (Iker 2026-07-08): la pregunta iba en un atributo HTML
 * data-omnes-q="..." y una comilla doble del texto lo cerraba antes de
 * tiempo → Omnes recibía la pregunta TRUNCADA ("...NO mezcles") y respondía
 * "el mensaje se cortó". Estos tests blindan que la pregunta esté completa,
 * sin comillas ASCII, y que el código no vuelva al atributo.
 */
import fs from 'fs';
import path from 'path';
import { construirPreguntaOmnes } from '@modules/analisis/breakeven-consejos.js';

const snap = {
    breakevenPlatosMes: 560,
    platosDia: 22,
    ventasEquilibrioDia: 464.7,
    foodCostMedio: 42,
    gastosFijosMes: 6700,
    ventana: { desde: '2026-04-09', hasta: '2026-07-09' }
};

describe('construirPreguntaOmnes', () => {
    const q = construirPreguntaOmnes(snap);

    test('la pregunta está COMPLETA (no truncada): incluye la última frase', () => {
        expect(q).toContain('Punto de equilibrio MENSUAL: 560 platos al mes');
        expect(q).toContain('Equivalente DIARIO: 22 platos al día');
        expect(q).toContain('acciones más concretas para bajar mi punto de equilibrio');
    });

    test('NO contiene comillas dobles ASCII (que romperían un atributo HTML)', () => {
        expect(q).not.toContain('"');
    });

    test('los periodos van etiquetados y separados (mensual vs diario)', () => {
        expect(q).toMatch(/MENSUAL:/);
        expect(q).toMatch(/DIARIO:/);
        expect(q).toContain('no mezcles');
    });

    // Iker 2026-07-08: Omnes citaba platos del HISTÓRICO junto a un break-even
    // de 90 días. La pregunta debe fijar el rango explícito para sus tools.
    test('incluye el rango explícito de 90 días y prohíbe el histórico', () => {
        expect(q).toContain('del 2026-04-09 al 2026-07-09');
        expect(q).toContain('pasa ese rango como desde/hasta');
        expect(q).toContain('NO uses el histórico completo');
    });

    test('sin ventana en el snapshot: fallback que sigue pidiendo 90 días, sin fechas undefined', () => {
        const sinVentana = construirPreguntaOmnes({ ...snap, ventana: undefined });
        expect(sinVentana).toContain('últimos 90 días');
        expect(sinVentana).not.toContain('undefined');
    });
});

describe('guard anti-regresión', () => {
    test('breakeven.js NO vuelve a meter la pregunta en data-omnes-q', () => {
        const src = fs.readFileSync(
            path.resolve('src/modules/analisis/breakeven.js'),
            'utf8'
        );
        expect(src).not.toMatch(/data-omnes-q\s*=/);
    });
});
