/**
 * Auto-detección de alérgenos por nombre. SOLO sugerencias (el usuario confirma).
 * Verifica cobertura básica de hostelería ES + trampas (falsos positivos).
 */
import { detectarAlergenos } from '@modules/ingredientes/alergenos-deteccion.js';

const det = (n) => detectarAlergenos(n);

describe('detectarAlergenos — cobertura', () => {
    test('harina/trigo → gluten', () => {
        expect(det('Harina de trigo')).toEqual(['gluten']);
        expect(det('PAN RALLADO')).toEqual(['gluten']);
    });
    test('mariscos', () => {
        expect(det('Gambas peladas')).toEqual(['crustaceos']);
        expect(det('Langostinos')).toEqual(['crustaceos']);
        expect(det('Almejas')).toEqual(['moluscos']);
        expect(det('Mejillones')).toEqual(['moluscos']);
        expect(det('Calamares')).toEqual(['moluscos']);
        expect(det('Pulpo a la gallega')).toEqual(['moluscos']);
    });
    test('pescado', () => {
        expect(det('Merluza fresca')).toEqual(['pescado']);
        expect(det('Bacalao')).toEqual(['pescado']);
    });
    test('lácteos', () => {
        expect(det('Leche entera')).toEqual(['lacteos']);
        expect(det('Queso manchego')).toEqual(['lacteos']);
        expect(det('Nata para montar')).toEqual(['lacteos']);
    });
    test('frutos de cáscara', () => {
        expect(det('Nueces')).toEqual(['frutos_cascara']);
        expect(det('Almendra molida')).toEqual(['frutos_cascara']);
    });
    test('sulfitos / soja / sésamo / huevos', () => {
        expect(det('Vino tinto')).toEqual(['sulfitos']);
        expect(det('Huevos camperos')).toEqual(['huevos']);
        expect(det('Tahini')).toEqual(['sesamo']);
    });
    test('combinados', () => {
        // salsa de soja suele llevar trigo → soja + gluten
        expect(det('Salsa de soja').sort()).toEqual(['gluten', 'soja']);
    });
});

describe('detectarAlergenos — trampas (sin falsos positivos)', () => {
    test('"panga" NO dispara gluten (pan por subcadena)', () => {
        expect(det('Panga')).toEqual(['pescado']);
        expect(det('Panga')).not.toContain('gluten');
    });
    test('leche vegetal NO es lácteo', () => {
        expect(det('Leche de coco')).toEqual([]);
        expect(det('Bebida de avena')).not.toContain('lacteos');
    });
    test('mantequilla de cacahuete → cacahuetes, NO lácteos', () => {
        const r = det('Mantequilla de cacahuete');
        expect(r).toContain('cacahuetes');
        expect(r).not.toContain('lacteos');
    });
    test('ingredientes sin alérgeno → vacío', () => {
        expect(det('Tomate')).toEqual([]);
        expect(det('Pimiento rojo')).toEqual([]);
        expect(det('')).toEqual([]);
    });
});
