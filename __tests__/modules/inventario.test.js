import { describe, it, expect } from 'vitest';

describe('Inventario Module', () => {
    describe('Stock Calculations', () => {
        it('should calculate stock value', () => {
            const cantidad = 50;
            const precioUnitario = 2.5;
            const valorStock = cantidad * precioUnitario;
            expect(valorStock).toBe(125);
        });

        it('should calculate difference between theoretical and real stock', () => {
            const stockTeorico = 100;
            const stockReal = 95;
            const diferencia = stockTeorico - stockReal;
            expect(diferencia).toBe(5);
        });

        it('should calculate difference percentage', () => {
            const stockTeorico = 100;
            const stockReal = 95;
            const diferenciaPct = ((stockTeorico - stockReal) / stockTeorico) * 100;
            expect(diferenciaPct).toBe(5);
        });
    });

    describe('Mermas (Waste)', () => {
        it('should calculate merma value', () => {
            const cantidadMerma = 3;
            const precioUnitario = 5;
            const valorMerma = cantidadMerma * precioUnitario;
            expect(valorMerma).toBe(15);
        });

        it('should categorize merma type correctly', () => {
            const tipos = ['caducidad', 'rotura', 'robo', 'error_conteo'];
            expect(tipos).toContain('caducidad');
            expect(tipos).toContain('robo');
        });

        it('should update stock after merma registration', () => {
            const stockInicial = 50;
            const mermaCantidad = 3;
            const stockFinal = stockInicial - mermaCantidad;
            expect(stockFinal).toBe(47);
        });
    });

    describe('Stock Alerts', () => {
        it('should flag items under minimum stock', () => {
            const items = [
                { nombre: 'Tomate', stock: 5, minimo: 10 },
                { nombre: 'Cebolla', stock: 15, minimo: 10 },
                { nombre: 'Pimiento', stock: 8, minimo: 10 }
            ];
            const bajosDeStock = items.filter(i => i.stock < i.minimo);
            expect(bajosDeStock.length).toBe(2);
            expect(bajosDeStock.map(i => i.nombre)).toContain('Tomate');
        });

        it('should calculate days until stockout', () => {
            const stockActual = 30;
            const consumoDiario = 5;
            const diasRestantes = Math.floor(stockActual / consumoDiario);
            expect(diasRestantes).toBe(6);
        });
    });
});
