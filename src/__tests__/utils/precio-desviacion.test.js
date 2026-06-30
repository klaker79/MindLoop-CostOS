/**
 * Guard de desviación de precio al recibir un pedido. Si el precio tecleado se
 * desvía demasiado del precio de referencia del ingrediente (media de compras o
 * configurado), avisamos antes de que entre en la media y la "reviente".
 * Umbral por defecto ±70% (un dedazo típico es ×10 o /10; una subida real de
 * proveedor suele quedar por debajo).
 */
import { precioDesviacionSospechosa } from '../../utils/cost-calculator.js';

describe('precioDesviacionSospechosa', () => {
    test('dedazo al alza (50 vs 5 = +900%) → sospechoso', () => {
        const r = precioDesviacionSospechosa(50, 5);
        expect(r.sospechoso).toBe(true);
        expect(r.pct).toBe(900);
    });

    test('dedazo a la baja (0,50 vs 5 = -90%) → sospechoso', () => {
        const r = precioDesviacionSospechosa(0.5, 5);
        expect(r.sospechoso).toBe(true);
        expect(r.pct).toBe(-90);
    });

    test('subida real moderada (+40%) → NO sospechoso', () => {
        expect(precioDesviacionSospechosa(7, 5).sospechoso).toBe(false);
    });

    test('justo en el umbral (+70%) → sospechoso (>=)', () => {
        expect(precioDesviacionSospechosa(8.5, 5).sospechoso).toBe(true);
    });

    test('+80% → sospechoso', () => {
        expect(precioDesviacionSospechosa(9, 5).sospechoso).toBe(true);
    });

    test('sin referencia válida (ref 0) → no se puede comparar → false', () => {
        expect(precioDesviacionSospechosa(50, 0).sospechoso).toBe(false);
    });

    test('precio nuevo inválido (0) → false', () => {
        expect(precioDesviacionSospechosa(0, 5).sospechoso).toBe(false);
    });

    test('umbral configurable', () => {
        expect(precioDesviacionSospechosa(7, 5, 0.30).sospechoso).toBe(true);   // +40% supera 30%
        expect(precioDesviacionSospechosa(7, 5, 0.90).sospechoso).toBe(false);  // +40% no supera 90%
    });
});
