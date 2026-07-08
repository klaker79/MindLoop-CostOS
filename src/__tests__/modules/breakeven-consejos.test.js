/**
 * Consejos inteligentes de las palancas del Punto de Equilibrio.
 * Verifica que leen los datos reales (culpables por plato) y priorizan bien.
 */
import { construirConsejos } from '@modules/analisis/breakeven-consejos.js';

const snapBase = {
    breakevenPlatosMes: 560,
    platosDia: 22,
    ventasEquilibrioDia: 464.7,
    margenPonderado: 11.96,
    ticketMedio: 21.5,
    foodCostMedio: 42,
    gastosFijosMes: 6700,
    palancas: {
        platosSiMargenMas1: 517,
        reduccionMargenMas1: 43,
        platosSiGastosMenos500: 519,
        reduccionGastosMenos500: 41,
        platosSiFood2: 541,
        reduccionFood2: 19
    }
};

describe('construirConsejos — culpables reales', () => {
    const platos = [
        { nombre: 'Croquetas', foodCost: 55, margen: 4, popularidad: 300, clasificacion: 'caballo' },
        { nombre: 'Ensaladilla', foodCost: 48, margen: 5, popularidad: 200, clasificacion: 'caballo' },
        { nombre: 'Solomillo', foodCost: 28, margen: 18, popularidad: 150, clasificacion: 'estrella' },
        { nombre: 'Flan', foodCost: 20, margen: 6, popularidad: 10, clasificacion: 'perro' }
    ];

    test('food cost: nombra los platos que más lo tiran (por food·ventas)', () => {
        const c = construirConsejos(snapBase, platos);
        expect(c.food.texto).toContain('Croquetas');
        expect(c.food.texto).toContain('55%');
        expect(c.food.tono).toBe('bad'); // medio 42 > 40
        expect(c.food.texto).toContain('541'); // objetivo tras -2pts
    });

    test('margen: nombra los Caballos como candidatos a subir precio', () => {
        const c = construirConsejos(snapBase, platos);
        expect(c.margen.texto).toContain('Croquetas');
        expect(c.margen.texto).toContain('Caballos');
        expect(c.margen.texto).toContain('517');
    });

    test('prioridad = food cuando el food cost medio es alto (>38)', () => {
        const c = construirConsejos(snapBase, platos);
        expect(c.prioridad).toBe('food');
    });
});

describe('construirConsejos — adaptación por situación', () => {
    const platosSanos = [
        { nombre: 'Ostras', foodCost: 25, margen: 15, popularidad: 400, clasificacion: 'estrella' },
        { nombre: 'Pulpo', foodCost: 22, margen: 20, popularidad: 300, clasificacion: 'estrella' }
    ];

    test('food cost bajo → tono ok y sin culpables', () => {
        const snap = { ...snapBase, foodCostMedio: 26 };
        const c = construirConsejos(snap, platosSanos);
        expect(c.food.tono).toBe('ok');
        expect(c.food.titulo).toMatch(/control/i);
    });

    test('sin caballos y food ok → prioridad = gastos', () => {
        const snap = { ...snapBase, foodCostMedio: 28 };
        const c = construirConsejos(snap, platosSanos);
        expect(c.prioridad).toBe('gastos');
        expect(c.margen.tono).toBe('ok'); // sin caballos → consejo genérico
    });

    test('food medio y con caballos → prioridad = margen', () => {
        const conCaballo = [
            { nombre: 'Torreznos', foodCost: 34, margen: 6, popularidad: 500, clasificacion: 'caballo' }
        ];
        const snap = { ...snapBase, foodCostMedio: 33 };
        const c = construirConsejos(snap, conCaballo);
        expect(c.prioridad).toBe('margen');
    });

    test('robusto sin platos', () => {
        const c = construirConsejos(snapBase, []);
        expect(c.prioridad).toBe('food'); // food alto manda aunque no haya culpables nombrables
        expect(typeof c.gastos.texto).toBe('string');
    });
});
