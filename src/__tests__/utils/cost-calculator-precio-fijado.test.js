/**
 * precio_fijado (override manual) en getIngredientUnitPrice (frontend).
 * Debe espejar el backend: si el ingrediente tiene precio_fijado=true, usar el
 * precio manual (precio/cpf) e ignorar la media de compras. Flag false/ausente
 * → comportamiento actual (la media manda) → backward-compatible.
 */
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';

describe('getIngredientUnitPrice — precio_fijado', () => {
    test('fijado=true → usa precio/cpf manual, ignora precio_medio_compra', () => {
        const inv = { precio_medio_compra: 2.0 };
        const ing = { precio_fijado: true, precio: 1.15, cantidad_por_formato: 1 };
        expect(getIngredientUnitPrice(inv, ing)).toBeCloseTo(1.15, 4);
    });

    test('fijado=true con cpf>1 → precio/cpf', () => {
        const inv = { precio_medio_compra: 2.0 };
        const ing = { precio_fijado: true, precio: 6, cantidad_por_formato: 6 };
        expect(getIngredientUnitPrice(inv, ing)).toBeCloseTo(1.0, 4);
    });

    test('no fijado → media de compras (comportamiento actual)', () => {
        const inv = { precio_medio_compra: 2.0 };
        const ing = { precio_fijado: false, precio: 1.15, cantidad_por_formato: 1 };
        expect(getIngredientUnitPrice(inv, ing)).toBeCloseTo(2.0, 4);
    });

    test('sin flag → media (backward-compatible)', () => {
        const inv = { precio_medio_compra: 2.0 };
        const ing = { precio: 1.15, cantidad_por_formato: 1 };
        expect(getIngredientUnitPrice(inv, ing)).toBeCloseTo(2.0, 4);
    });

    test('flag en el invItem también lo respeta', () => {
        const inv = { precio_medio_compra: 2.0, precio_fijado: true };
        const ing = { precio: 1.15, cantidad_por_formato: 1 };
        expect(getIngredientUnitPrice(inv, ing)).toBeCloseTo(1.15, 4);
    });

    test('fijado pero precio inválido → cae a la media (defensivo)', () => {
        const inv = { precio_medio_compra: 2.0 };
        const ing = { precio_fijado: true, precio: 0, cantidad_por_formato: 1 };
        expect(getIngredientUnitPrice(inv, ing)).toBeCloseTo(2.0, 4);
    });
});
