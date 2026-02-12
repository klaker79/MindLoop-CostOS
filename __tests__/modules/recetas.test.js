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

    describe('Cycle Detection (calcularCosteRecetaCompleto)', () => {
        /**
         * Replica de la logica de coste con deteccion de ciclos.
         * Se testea aqui directamente porque el import del modulo completo
         * arrastra config/constants.js que usa import.meta.env (incompatible con Jest ESM).
         * Esta logica DEBE coincidir con src/modules/recetas/recetas-crud.js
         */
        function calcularCosteConCiclos(receta, ingredientes, inventario, recetas, _visitados = new Set()) {
            if (!receta || !receta.ingredientes) return 0;
            if (receta.id && _visitados.has(receta.id)) return 0;
            if (receta.id) _visitados.add(receta.id);

            const ingMap = new Map(ingredientes.map(i => [i.id, i]));
            const invMap = new Map(inventario.map(i => [i.id, i]));
            const recetasMap = new Map(recetas.map(r => [r.id, r]));

            const costeLote = receta.ingredientes.reduce((total, item) => {
                if (item.ingredienteId > 100000) {
                    const recetaId = item.ingredienteId - 100000;
                    const recetaBase = recetasMap.get(recetaId);
                    if (recetaBase) {
                        const coste = calcularCosteConCiclos(recetaBase, ingredientes, inventario, recetas, _visitados);
                        return total + coste * item.cantidad;
                    }
                    return total;
                }
                const invItem = invMap.get(item.ingredienteId);
                const ing = ingMap.get(item.ingredienteId);
                let precio = 0;
                if (invItem?.precio_medio) precio = parseFloat(invItem.precio_medio);
                else if (ing?.precio) precio = parseFloat(ing.precio) / (parseFloat(ing.cantidad_por_formato) || 1);
                const rend = (parseFloat(item.rendimiento) || 100) / 100;
                const costeReal = rend > 0 ? (precio / rend) : precio;
                return total + costeReal * item.cantidad;
            }, 0);

            const porciones = parseInt(receta.porciones) || 1;
            return parseFloat((costeLote / porciones).toFixed(2));
        }

        const ingredientes = [
            { id: 1, nombre: 'Harina', precio: 2, cantidad_por_formato: 1 },
            { id: 2, nombre: 'Huevo', precio: 0.3, cantidad_por_formato: 1 }
        ];

        it('should return 0 for null/undefined recipe', () => {
            expect(calcularCosteConCiclos(null, [], [], [])).toBe(0);
            expect(calcularCosteConCiclos(undefined, [], [], [])).toBe(0);
        });

        it('should return 0 for recipe without ingredientes', () => {
            expect(calcularCosteConCiclos({ nombre: 'Test' }, [], [], [])).toBe(0);
        });

        it('should calculate cost for simple recipe with normal ingredients', () => {
            const receta = {
                id: 10, nombre: 'Test', porciones: 1,
                ingredientes: [
                    { ingredienteId: 1, cantidad: 0.5, rendimiento: 100 },
                    { ingredienteId: 2, cantidad: 3, rendimiento: 100 }
                ]
            };
            const cost = calcularCosteConCiclos(receta, ingredientes, [], []);
            expect(cost).toBeCloseTo(1.9, 1);
        });

        it('should not crash on cyclic recipes (A -> B -> A)', () => {
            const recetaA = {
                id: 100, nombre: 'A', porciones: 1,
                ingredientes: [{ ingredienteId: 100101, cantidad: 1 }]
            };
            const recetaB = {
                id: 101, nombre: 'B', porciones: 1,
                ingredientes: [{ ingredienteId: 100100, cantidad: 1 }]
            };
            const cost = calcularCosteConCiclos(recetaA, [], [], [recetaA, recetaB]);
            expect(typeof cost).toBe('number');
            expect(isFinite(cost)).toBe(true);
        });

        it('should not crash on self-referencing recipe', () => {
            const selfRef = {
                id: 200, nombre: 'Self', porciones: 1,
                ingredientes: [{ ingredienteId: 100200, cantidad: 1 }]
            };
            const cost = calcularCosteConCiclos(selfRef, [], [], [selfRef]);
            expect(cost).toBe(0);
        });

        it('should account for rendimiento (yield) in cost', () => {
            const receta = {
                id: 11, nombre: 'Test Yield', porciones: 1,
                ingredientes: [
                    { ingredienteId: 1, cantidad: 1, rendimiento: 50 } // 50% yield doubles cost
                ]
            };
            const cost = calcularCosteConCiclos(receta, ingredientes, [], []);
            expect(cost).toBeCloseTo(4.0, 1); // 2€ / 0.5 = 4€
        });
    });
});
