/**
 * GUARD — el TOTAL MES de gastos fijos de la "Cuenta de Resultados Diaria"
 * (tabla P&L del Diario, legacy inventario-masivo.js) debe ser
 *
 *     gastosFijosDia × dias.length   (nº de días MOSTRADOS = columnas)
 *
 * y NUNCA recalcularse por otra vía (días de calendario transcurridos, mes
 * entero…). Historia (2026-07-08): se cambió a días de calendario y el TOTAL
 * dejó de cuadrar con la suma de las columnas (La Nave 5: 396€ en vez de
 * 5.610€); antes de eso, con el mes entero, salía una pérdida falsa de
 * −29.582€. Cada columna diaria YA resta su gasto fijo → el total debe sumar
 * exactamente lo que se ve.
 *
 * El gráfico "Beneficio neto por día" (modales.js) está blindado aparte por
 * pnl-diario-calc.test.js (función pura). Este guard cubre la TABLA.
 */
import fs from 'fs';
import path from 'path';

describe('guard: TOTAL de gastos fijos del P&L = gastosFijosDia × dias.length', () => {
    const src = fs.readFileSync(
        path.resolve('src/legacy/inventario-masivo.js'),
        'utf8'
    );

    test('la fórmula del total sigue siendo × dias.length', () => {
        expect(src).toMatch(/totalGastosFijosMostrados = gastosFijosDia \* dias\.length/);
    });

    test('NO vuelve el prorrateo a días de calendario ni al mes entero', () => {
        expect(src).not.toMatch(/totalGastosFijosMostrados\s*=\s*gastosFijosDia\s*\*\s*diasEnMes/);
        expect(src).not.toMatch(/totalGastosFijosMostrados\s*=\s*gastosFijosDia\s*\*\s*Math\.min/);
    });

    test('el gráfico del Diario usa el puente a la función pura testeada', () => {
        const modales = fs.readFileSync(path.resolve('src/legacy/modales.js'), 'utf8');
        expect(modales).toContain('window.mlComputeBeneficioNetoDiario');
    });
});
