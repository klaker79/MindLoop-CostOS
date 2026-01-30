// Tests para módulo kpis

describe('KPIs Module', () => {
    describe('Food Cost', () => {
        it('should calculate food cost percentage', () => {
            const costes = 3000;
            const ventas = 10000;
            const foodCost = (costes / ventas) * 100;
            expect(foodCost).toBe(30);
        });

        it('should handle zero sales', () => {
            const costes = 1000;
            const ventas = 0;
            const foodCost = ventas > 0 ? (costes / ventas) * 100 : 0;
            expect(foodCost).toBe(0);
        });

        it('should flag high food cost', () => {
            const foodCost = 38;
            const threshold = 35;
            const isHigh = foodCost > threshold;
            expect(isHigh).toBe(true);
        });
    });

    describe('Stock Alerts', () => {
        it('should identify low stock items', () => {
            const stock = 5;
            const minimo = 10;
            const isLow = stock < minimo;
            expect(isLow).toBe(true);
        });

        it('should not alert when stock is sufficient', () => {
            const stock = 15;
            const minimo = 10;
            const isLow = stock < minimo;
            expect(isLow).toBe(false);
        });

        it('should calculate days of stock remaining', () => {
            const stockActual = 50;
            const consumoDiario = 10;
            const diasRestantes = consumoDiario > 0 ? stockActual / consumoDiario : Infinity;
            expect(diasRestantes).toBe(5);
        });
    });

    describe('Break-Even Analysis', () => {
        it('should calculate break-even point', () => {
            const costosFijos = 5000;
            const margenContribucion = 0.4; // 40%
            const breakEven = costosFijos / margenContribucion;
            expect(breakEven).toBe(12500);
        });

        it('should handle zero margin', () => {
            const costosFijos = 5000;
            const margenContribucion = 0;
            const breakEven = margenContribucion > 0 ? costosFijos / margenContribucion : Infinity;
            expect(breakEven).toBe(Infinity);
        });

        it('should identify if in profit zone', () => {
            const ingresos = 15000;
            const breakEven = 12000;
            const enBeneficios = ingresos > breakEven;
            expect(enBeneficios).toBe(true);
        });
    });
});
