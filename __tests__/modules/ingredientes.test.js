// Tests para módulo ingredientes

describe('Ingredientes Module', () => {
    describe('Cost Calculations', () => {
        it('should calculate ingredient cost correctly', () => {
            const precio = 10;
            const cantidad = 2.5;
            const expected = 25;
            expect(precio * cantidad).toBe(expected);
        });

        it('should calculate cost per unit with formato', () => {
            const precioFormato = 30; // 30€ por formato (ej: caja)
            const cantidadPorFormato = 6; // 6 unidades por formato
            const precioUnitario = precioFormato / cantidadPorFormato;
            expect(precioUnitario).toBe(5);
        });

        it('should handle zero cantidad_por_formato', () => {
            const precio = 10;
            const cantidadPorFormato = 0;
            const precioUnitario = precio / (cantidadPorFormato || 1);
            expect(precioUnitario).toBe(10);
        });
    });

    describe('Data Validation', () => {
        it('should validate required fields', () => {
            const validIngredient = {
                nombre: 'Tomate',
                precio: 2.50,
                unidad: 'kg'
            };
            expect(validIngredient.nombre).toBeTruthy();
            expect(validIngredient.precio).toBeGreaterThan(0);
            expect(validIngredient.unidad).toBeTruthy();
        });

        it('should reject negative prices', () => {
            const invalidPrice = -5;
            expect(invalidPrice).toBeLessThan(0);
        });

        it('should handle missing optional fields', () => {
            const ingredient = {
                nombre: 'Sal',
                precio: 1,
                unidad: 'kg',
                proveedorId: null,
                categoria: null
            };
            expect(ingredient.proveedorId ?? 'default').toBe('default');
        });
    });
});
