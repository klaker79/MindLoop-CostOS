/**
 * @jest-environment node
 */
import { calculateIngredientCost, calculateBatchCost } from '../../utils/cost-calculator.js';

describe('Yield Calculation Logic (Anchored)', () => {

    test('Should calculate cost correctly with 100% yield', () => {
        const price = 10;
        const qty = 2;
        const yieldPercent = 100;

        // 10 * 2 = 20
        expect(calculateIngredientCost(price, qty, yieldPercent)).toBe(20);
    });

    test('Should double the cost with 50% yield', () => {
        const price = 10;
        const qty = 1;
        const yieldPercent = 50;

        // Real cost = price / (50/100) = price / 0.5 = price * 2
        // 10 * 2 = 20
        expect(calculateIngredientCost(price, qty, yieldPercent)).toBe(20);
    });

    test('Should increase cost with 80% yield', () => {
        const price = 10;
        const qty = 1;
        const yieldPercent = 80;

        // Real cost = 10 / 0.8 = 12.5
        expect(calculateIngredientCost(price, qty, yieldPercent)).toBe(12.5);
    });

    test('Should handle batch cost calculation', () => {
        const items = [
            { price: 10, quantity: 1, yield: 100 }, // 10
            { price: 10, quantity: 1, yield: 50 },  // 20
        ];

        expect(calculateBatchCost(items)).toBe(30);
    });

    test('Should handle edge case: 0% yield (should treat as 100% to avoid infinity)', () => {
        // Safety mechanism
        expect(calculateIngredientCost(10, 1, 0)).toBe(10);
    });

    test('Should handle null/undefined yield as 100%', () => {
        expect(calculateIngredientCost(10, 1, null)).toBe(10);
        expect(calculateIngredientCost(10, 1, undefined)).toBe(10);
    });
});
