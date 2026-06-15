/**
 * Tests del constructor de pregunta para "Pregúntale a Omnes" desde un aviso.
 * buildOmnesQuestion convierte un aviso del feed en una pregunta de chat,
 * limpiando el texto (que viene escapado a HTML por i18next) y eligiendo la
 * frase de seguimiento según la categoría.
 */
import { buildOmnesQuestion, limpiarTextoAviso } from './omnes-avisos.js';

const FRASES = {
    prefix: 'Sobre este aviso: ',
    recetas: '¿Por qué no renta y qué precio me recomiendas?',
    stock: '¿Cuánto debería pedir?',
    precio: '¿Por qué ha subido?',
    frescura: '¿Qué hago para no perderlo?',
    sobrestock: '¿Cómo reduzco este stock?',
    default: 'Explícamelo y dame un plan.',
};

describe('limpiarTextoAviso', () => {
    test('quita etiquetas HTML', () => {
        expect(limpiarTextoAviso('PULPO <b>bajo</b> de stock')).toBe('PULPO bajo de stock');
    });
    test('decodifica entidades comunes (i18next escapa & < > \' ")', () => {
        expect(limpiarTextoAviso('Aceite &amp; Sal subió a 3&#39;50')).toBe("Aceite & Sal subió a 3'50");
    });
    test('colapsa espacios y recorta', () => {
        expect(limpiarTextoAviso('  hola   mundo  ')).toBe('hola mundo');
    });
    test('entrada no-string → cadena vacía', () => {
        expect(limpiarTextoAviso(null)).toBe('');
        expect(limpiarTextoAviso(undefined)).toBe('');
    });

    test('sanitización completa: decodificar entidades NO debe reintroducir etiquetas', () => {
        // &lt;script&gt; al decodificar se vuelve <script>; el resultado final
        // NO debe contener "<script" (CodeQL: incomplete multi-character sanitization).
        const out = limpiarTextoAviso('hola &lt;script&gt;alert(1)&lt;/script&gt; mundo');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('</script');
    });

    test('sanitización completa: tags anidados/partidos no sobreviven', () => {
        expect(limpiarTextoAviso('a <scr<script>ipt> b')).not.toContain('<script');
    });
});

describe('buildOmnesQuestion', () => {
    test('usa el prefix + texto limpio + frase de la categoría', () => {
        const aviso = { categoria: 'stock', texto: 'CEBOLLA por debajo del mínimo' };
        expect(buildOmnesQuestion(aviso, FRASES)).toBe(
            'Sobre este aviso: "CEBOLLA por debajo del mínimo". ¿Cuánto debería pedir?'
        );
    });

    test('categoría desconocida → frase default', () => {
        const aviso = { categoria: 'otra', texto: 'algo' };
        expect(buildOmnesQuestion(aviso, FRASES)).toBe(
            'Sobre este aviso: "algo". Explícamelo y dame un plan.'
        );
    });

    test('limpia el HTML del texto del aviso', () => {
        const aviso = { categoria: 'precio', texto: 'El <b>ACEITE</b> subió un 30&#37;' };
        const q = buildOmnesQuestion(aviso, FRASES);
        expect(q).toContain('El ACEITE subió un 30%');
        expect(q).not.toContain('<b>');
    });

    test('aviso sin texto no revienta', () => {
        expect(buildOmnesQuestion({ categoria: 'stock' }, FRASES)).toBe(
            'Sobre este aviso: "". ¿Cuánto debería pedir?'
        );
    });
});
