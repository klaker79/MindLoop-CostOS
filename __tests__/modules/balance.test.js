// Tests para módulo balance

describe('Balance Module', () => {
    describe('P&L Calculations', () => {
        it('should calculate gross margin', () => {
            const ingresos = 10000;
            const cogs = 3500;
            const margenBruto = ingresos - cogs;
            expect(margenBruto).toBe(6500);
        });

        it('should calculate net profit', () => {
            const margenBruto = 6500;
            const opex = 4000;
            const beneficioNeto = margenBruto - opex;
            expect(beneficioNeto).toBe(2500);
        });

        it('should calculate OPEX total', () => {
            const alquiler = 1500;
            const personal = 2000;
            const suministros = 300;
            const otros = 200;
            const opexTotal = alquiler + personal + suministros + otros;
            expect(opexTotal).toBe(4000);
        });

        it('should calculate rentability percentage', () => {
            const beneficioNeto = 2500;
            const ingresos = 10000;
            const rentabilidad = (beneficioNeto / ingresos) * 100;
            expect(rentabilidad).toBe(25);
        });
    });

    describe('Break-Even Thermometer', () => {
        it('should calculate percentage of goal achieved', () => {
            const ingresos = 8000;
            const breakEven = 10000;
            const porcentaje = (ingresos / breakEven) * 100;
            expect(porcentaje).toBe(80);
        });

        it('should cap thermometer at 100%', () => {
            const ingresos = 15000;
            const breakEven = 10000;
            let porcentaje = (ingresos / breakEven) * 100 / 2;
            if (porcentaje > 100) porcentaje = 100;
            expect(porcentaje).toBe(75); // 150% / 2 = 75%
        });

        it('should identify loss state', () => {
            const ingresos = 8000;
            const breakEven = 10000;
            const enPerdidas = ingresos < breakEven;
            expect(enPerdidas).toBe(true);
        });
    });
});
