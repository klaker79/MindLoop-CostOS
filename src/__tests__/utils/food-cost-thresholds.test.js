/**
 * food-cost-thresholds.test.js
 *
 * Los umbrales de food cost son 30/35/40 (ver CLAUDE.md de ambos repos).
 * Este test fija el contrato para que ningún módulo vuelva a divergir
 * (pasó con 28/33/38 en recetas-ui.js y 33/38 en cost-tracker leyenda).
 */

import {
    FOOD_COST_THRESHOLDS,
    WINE_COST_THRESHOLDS,
    classifyFoodCost,
    foodCostColor,
} from '../../utils/food-cost-thresholds.js';

describe('food-cost-thresholds — contrato de umbrales unificados', () => {
    test('umbrales food cost = 30/35/40', () => {
        expect(FOOD_COST_THRESHOLDS.EXCELLENT_MAX).toBe(30);
        expect(FOOD_COST_THRESHOLDS.TARGET_MAX).toBe(35);
        expect(FOOD_COST_THRESHOLDS.WATCH_MAX).toBe(40);
    });

    test('umbrales vinos = 40/45/50', () => {
        expect(WINE_COST_THRESHOLDS.EXCELLENT_MAX).toBe(40);
        expect(WINE_COST_THRESHOLDS.TARGET_MAX).toBe(45);
        expect(WINE_COST_THRESHOLDS.WATCH_MAX).toBe(50);
    });

    test('son inmutables (Object.freeze)', () => {
        expect(Object.isFrozen(FOOD_COST_THRESHOLDS)).toBe(true);
        expect(Object.isFrozen(WINE_COST_THRESHOLDS)).toBe(true);
    });
});

describe('classifyFoodCost', () => {
    test('≤30 → excellent (incluye 0 y bordes)', () => {
        expect(classifyFoodCost(0)).toBe('excellent');
        expect(classifyFoodCost(15)).toBe('excellent');
        expect(classifyFoodCost(30)).toBe('excellent');
    });

    test('31..35 → target', () => {
        expect(classifyFoodCost(30.5)).toBe('target');
        expect(classifyFoodCost(33)).toBe('target');
        expect(classifyFoodCost(35)).toBe('target');
    });

    test('36..40 → watch', () => {
        expect(classifyFoodCost(35.5)).toBe('watch');
        expect(classifyFoodCost(38)).toBe('watch');
        expect(classifyFoodCost(40)).toBe('watch');
    });

    test('>40 → alert', () => {
        expect(classifyFoodCost(40.5)).toBe('alert');
        expect(classifyFoodCost(50)).toBe('alert');
        expect(classifyFoodCost(200)).toBe('alert');
    });

    test('valores inválidos → unknown', () => {
        expect(classifyFoodCost(null)).toBe('unknown');
        expect(classifyFoodCost(undefined)).toBe('unknown');
        expect(classifyFoodCost(NaN)).toBe('unknown');
        expect(classifyFoodCost('abc')).toBe('unknown');
    });

    test('coerce strings numéricas', () => {
        expect(classifyFoodCost('25')).toBe('excellent');
        expect(classifyFoodCost('38')).toBe('watch');
    });
});

describe('foodCostColor', () => {
    test('devuelve paleta correcta por categoría', () => {
        expect(foodCostColor(20)).toBe('#059669');  // excellent
        expect(foodCostColor(33)).toBe('#10B981');  // target
        expect(foodCostColor(38)).toBe('#F59E0B');  // watch
        expect(foodCostColor(50)).toBe('#EF4444');  // alert
        expect(foodCostColor(null)).toBe('#9CA3AF'); // unknown
    });
});
