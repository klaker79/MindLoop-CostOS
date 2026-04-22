/**
 * escandallo-numeric.test.js — Precisión numérica del escandallo.
 *
 * Pins the arithmetic contract between:
 *   - `getIngredientUnitPrice()`  (priority precio_medio_compra > precio_medio > precio/cpf)
 *   - `calculateIngredientCost()` (yield-adjusted cost: price / (yield/100) * qty)
 *   - `calculateBatchCost()`      (sum across all lines)
 *
 * Si alguna fórmula drifta (ej. alguien invierte el yield factor o mete cpf a
 * ciegas en el cálculo del coste), el escandallo visible al usuario deja de
 * coincidir con el P&L backend → regresión que este test detecta.
 *
 * Casos basados en datos reales de La Nave 5 (España, €) y Stefania KL (Malasia, RM).
 */
import {
    getIngredientUnitPrice,
    getIngredientNominalPrice,
    calculateIngredientCost,
    calculateBatchCost,
} from '../../utils/cost-calculator.js';

describe('getIngredientUnitPrice — prioridad de precios', () => {
    test('1ª prioridad: precio_medio_compra (real, desde albaranes)', () => {
        const inv = { precio_medio_compra: 5.5, precio_medio: 4 };
        const ing = { precio: 10, cantidad_por_formato: 2 };
        expect(getIngredientUnitPrice(inv, ing)).toBe(5.5);
    });

    test('2ª prioridad: precio_medio cuando no hay precio_medio_compra', () => {
        const inv = { precio_medio: 4 };
        const ing = { precio: 10, cantidad_por_formato: 2 };
        expect(getIngredientUnitPrice(inv, ing)).toBe(4);
    });

    test('3ª prioridad: precio / cantidad_por_formato', () => {
        const ing = { precio: 12, cantidad_por_formato: 6 };
        expect(getIngredientUnitPrice(null, ing)).toBe(2);
    });

    test('cpf = 0 o NaN → fallback a cpf = 1', () => {
        expect(getIngredientUnitPrice(null, { precio: 10, cantidad_por_formato: 0 })).toBe(10);
        expect(getIngredientUnitPrice(null, { precio: 10 })).toBe(10);
    });

    test('sin datos → 0 (nunca lanza)', () => {
        expect(getIngredientUnitPrice(null, null)).toBe(0);
        expect(getIngredientUnitPrice({}, {})).toBe(0);
    });

    test('precio_medio_compra = 0 se trata como ausente → fallback', () => {
        const inv = { precio_medio_compra: 0, precio_medio: 4 };
        expect(getIngredientUnitPrice(inv, null)).toBe(4);
    });
});

describe('getIngredientNominalPrice — standard cost (user-defined)', () => {
    test('precio / cpf sin considerar precio_medio_compra', () => {
        const ing = { precio: 20, cantidad_por_formato: 4 };
        expect(getIngredientNominalPrice(ing)).toBe(5);
    });

    test('independiente del inventario', () => {
        // Aunque precio_medio_compra sea 100, nominal ignora y usa precio/cpf
        const ing = { precio: 10, cantidad_por_formato: 2 };
        expect(getIngredientNominalPrice(ing)).toBe(5);
    });

    test('sin precio → 0', () => {
        expect(getIngredientNominalPrice(null)).toBe(0);
        expect(getIngredientNominalPrice({})).toBe(0);
    });
});

describe('calculateIngredientCost — yield-adjusted', () => {
    test('yield 100% (sin mermas) → price × quantity', () => {
        expect(calculateIngredientCost(2, 5, 100)).toBe(10);
    });

    test('yield 50% (rendimiento medio) → doble coste', () => {
        // Ejemplo: 1kg mejillones cruda rinde 0.5kg de carne
        // Precio inicial 10€/kg → coste real 20€/kg
        expect(calculateIngredientCost(10, 1, 50)).toBe(20);
    });

    test('yield 200% (expansión, ej arroz) → mitad de coste', () => {
        // Caso hipotético
        expect(calculateIngredientCost(10, 1, 200)).toBe(5);
    });

    test('yield default = 100% si se omite', () => {
        expect(calculateIngredientCost(3, 2)).toBe(6);
    });

    test('yield 0 o negativo → tratado como 100 (evita división por cero)', () => {
        expect(calculateIngredientCost(5, 2, 0)).toBe(10);
        expect(calculateIngredientCost(5, 2, -10)).toBe(10);
    });

    test('cantidad 0 → coste 0', () => {
        expect(calculateIngredientCost(100, 0, 50)).toBe(0);
    });
});

describe('calculateBatchCost — suma total de un escandallo', () => {
    test('suma simple de 3 líneas sin mermas', () => {
        const items = [
            { price: 2, quantity: 5 },       // 10
            { price: 1.5, quantity: 4 },     // 6
            { price: 10, quantity: 0.3 },    // 3
        ];
        expect(calculateBatchCost(items)).toBe(19);
    });

    test('mezcla de yields distintos (caso realista)', () => {
        // Receta pulpo a la gallega (España €)
        const items = [
            { price: 20, quantity: 0.2, yield: 50 },  // pulpo 40%: 0.2kg * 40€ = 8 (yield 50% dobla)
            { price: 1.5, quantity: 0.05, yield: 100 }, // pimentón: 0.075
            { price: 0.5, quantity: 0.1, yield: 100 },  // sal aceite: 0.05
        ];
        const total = calculateBatchCost(items);
        // 8 + 0.075 + 0.05 = 8.125
        expect(total).toBeCloseTo(8.125, 3);
    });

    test('array vacío → 0', () => {
        expect(calculateBatchCost([])).toBe(0);
    });

    test('items con price/quantity undefined → tratados como 0', () => {
        expect(calculateBatchCost([{ }, { price: 5 }, { quantity: 2 }])).toBe(0);
    });
});

describe('Escandallo end-to-end — precio unitario → coste línea → coste total', () => {
    test('Receta de 2 ingredientes con mermas y precio_medio_compra', () => {
        // Ingrediente 1: mejillón, 200g en receta, yield 40%, precio_medio_compra 8€/kg
        const ing1 = { precio: 10, cantidad_por_formato: 1 };
        const inv1 = { precio_medio_compra: 8 };
        const precio1 = getIngredientUnitPrice(inv1, ing1);
        expect(precio1).toBe(8);
        // yield 40%: factor 0.4 → coste por unidad 20€/kg × 0.2kg = 4€
        const coste1 = calculateIngredientCost(precio1, 0.2, 40);
        expect(coste1).toBeCloseTo(4, 4);

        // Ingrediente 2: aceite, 30ml=0.03L, yield 100%, sin precio_medio_compra
        const ing2 = { precio: 20, cantidad_por_formato: 5 };  // 4€/L
        const precio2 = getIngredientUnitPrice(null, ing2);
        expect(precio2).toBe(4);
        const coste2 = calculateIngredientCost(precio2, 0.03, 100);
        expect(coste2).toBeCloseTo(0.12, 4);

        // Total
        const batch = calculateBatchCost([
            { price: precio1, quantity: 0.2, yield: 40 },
            { price: precio2, quantity: 0.03, yield: 100 },
        ]);
        expect(batch).toBeCloseTo(4.12, 4);
    });
});
