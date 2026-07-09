/**
 * Alérgenos de receta: heredados de ingredientes/subrecetas ∪ extra del plato.
 * Blinda la Opción A 2026-07-09 (recetas.alergenos_extra): los extra SUMAN,
 * nunca quitan un heredado; getAlergenosHeredados excluye los extra del nivel
 * superior para que la UI distinga heredado vs añadido a mano.
 */
import { getAlergenosReceta, getAlergenosHeredados } from '../../modules/ingredientes/alergenos.js';

// Ingredientes: 1 harina (gluten), 2 gamba (crustaceos), 3 sin alérgenos.
const ingMap = new Map([
    [1, { id: 1, alergenos: ['gluten'] }],
    [2, { id: 2, alergenos: ['crustaceos'] }],
    [3, { id: 3, alergenos: [] }],
]);

describe('getAlergenosReceta / getAlergenosHeredados', () => {
    test('hereda de los ingredientes (unión ordenada, sin duplicados)', () => {
        const receta = { id: 10, ingredientes: [{ ingredienteId: 1 }, { ingredienteId: 2 }, { ingredienteId: 3 }] };
        expect(getAlergenosReceta(receta, ingMap, new Map())).toEqual(['crustaceos', 'gluten']);
        expect(getAlergenosHeredados(receta, ingMap, new Map())).toEqual(['crustaceos', 'gluten']);
    });

    test('los extra del plato SE SUMAN a los heredados', () => {
        const receta = { id: 10, ingredientes: [{ ingredienteId: 1 }], alergenos_extra: ['sesamo'] };
        expect(getAlergenosReceta(receta, ingMap, new Map())).toEqual(['gluten', 'sesamo']);
        // Heredados NO incluye el extra del nivel superior.
        expect(getAlergenosHeredados(receta, ingMap, new Map())).toEqual(['gluten']);
    });

    test('un extra que ya está heredado no duplica', () => {
        const receta = { id: 10, ingredientes: [{ ingredienteId: 1 }], alergenos_extra: ['gluten'] };
        expect(getAlergenosReceta(receta, ingMap, new Map())).toEqual(['gluten']);
    });

    test('extras inválidos/basura se descartan', () => {
        const receta = { id: 10, ingredientes: [{ ingredienteId: 1 }], alergenos_extra: ['inventado', 'GLUTEN', 'sesamo', ''] };
        // 'GLUTEN' (mayúsculas) no es código canónico → se descarta; ya viene 'gluten' heredado.
        expect(getAlergenosReceta(receta, ingMap, new Map())).toEqual(['gluten', 'sesamo']);
    });

    test('subreceta con trazas contamina al plato padre', () => {
        // Subreceta 20 usa gamba (crustaceos) y declara traza de sésamo.
        const sub = { id: 20, ingredientes: [{ ingredienteId: 2 }], alergenos_extra: ['sesamo'] };
        const recetasMap = new Map([[20, sub]]);
        // Plato padre usa harina (gluten) + subreceta 20 (id 100020).
        const receta = { id: 10, ingredientes: [{ ingredienteId: 1 }, { ingredienteId: 100020 }] };
        // Heredados del padre = gluten + (crustaceos + sesamo de la subreceta).
        expect(getAlergenosReceta(receta, ingMap, recetasMap)).toEqual(['crustaceos', 'gluten', 'sesamo']);
        expect(getAlergenosHeredados(receta, ingMap, recetasMap)).toEqual(['crustaceos', 'gluten', 'sesamo']);
    });

    test('alergenos_extra ausente o no-array no rompe', () => {
        const receta = { id: 10, ingredientes: [{ ingredienteId: 1 }] };
        expect(getAlergenosReceta(receta, ingMap, new Map())).toEqual(['gluten']);
        const raro = { id: 11, ingredientes: [{ ingredienteId: 1 }], alergenos_extra: 'sesamo' };
        expect(getAlergenosReceta(raro, ingMap, new Map())).toEqual(['gluten']);
    });
});
