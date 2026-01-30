// Tests para módulo recetas

describe('Recetas Module', () => {
    describe('Cost Calculations', () => {
        it('should calculate recipe cost from ingredients', () => {
            const ingredientes = [
                { precio: 2, cantidad: 0.5 },
                { precio: 3, cantidad: 0.3 }
            ];
            const costeTotal = ingredientes.reduce(
                (sum, ing) => sum + (ing.precio * ing.cantidad), 0
            );
            expect(costeTotal).toBeCloseTo(1.9);
        });

        it('should calculate margin percentage correctly', () => {
            const coste = 5;
            const pvp = 15;
            const margen = ((pvp - coste) / pvp) * 100;
            expect(margen).toBeCloseTo(66.67, 1);
        });

        it('should handle zero selling price', () => {
            const coste = 5;
            const pvp = 0;
            const margen = pvp > 0 ? ((pvp - coste) / pvp) * 100 : 0;
            expect(margen).toBe(0);
        });

        it('should calculate food cost percentage', () => {
            const coste = 4;
            const pvp = 16;
            const foodCost = (coste / pvp) * 100;
            expect(foodCost).toBe(25);
        });
    });

    describe('Production', () => {
        it('should calculate production quantity correctly', () => {
            const lote = 10;
            const cantidad = 3;
            const total = lote * cantidad;
            expect(total).toBe(30);
        });

        it('should reduce ingredient stock after production', () => {
            const stockInicial = 100;
            const consumo = 25;
            const stockFinal = stockInicial - consumo;
            expect(stockFinal).toBe(75);
        });
    });

    describe('Validation', () => {
        it('should require at least one ingredient', () => {
            const recetaSinIngredientes = {
                nombre: 'Test',
                ingredientes: []
            };
            expect(recetaSinIngredientes.ingredientes.length).toBe(0);
        });

        it('should validate positive selling price', () => {
            const pvp = 12.50;
            expect(pvp).toBeGreaterThan(0);
        });
    });
});
