/**
 * Preview de precio por unidad base al configurar un ingrediente.
 * Caza configuraciones incoherentes antes de guardar (bug mermelada 2026-06-10).
 */
import { calcularPreviewPrecioUnidad } from '@modules/ingredientes/precio-unidad-preview.js';

describe('calcularPreviewPrecioUnidad', () => {
    test('sin precio → no visible', () => {
        expect(calcularPreviewPrecioUnidad({ precio: 0, unidad: 'kg' }).visible).toBe(false);
        expect(calcularPreviewPrecioUnidad({ precio: '', unidad: 'kg' }).visible).toBe(false);
    });

    test('por unidad simple (sin formato): precio = precio por unidad, nivel ok', () => {
        const r = calcularPreviewPrecioUnidad({ precio: 3, unidad: 'unidad' });
        expect(r.visible).toBe(true);
        expect(r.unitPrice).toBe(3);
        expect(r.level).toBe('ok');
    });

    test('formato correcto en gramos: BOTE 750 g a 3 € → 0,004 €/g, nivel ok', () => {
        const r = calcularPreviewPrecioUnidad({
            precio: 3, cantidadPorFormato: 750, formato: 'BOTE', unidad: 'g'
        });
        expect(r.unitPrice).toBeCloseTo(0.004, 6);
        expect(r.level).toBe('ok');
    });

    test('cpf>1 SIN nombre de formato → nivel falta_nombre', () => {
        const r = calcularPreviewPrecioUnidad({
            precio: 3, cantidadPorFormato: 750, formato: '', unidad: 'g'
        });
        expect(r.level).toBe('falta_nombre');
    });

    // EL CASO DE IKER: unidad=unidad + 750 por formato → 0,004 €/unidad (absurdo).
    test('cpf>1 con unidad "contable" (unidad) → nivel sospechoso', () => {
        const r = calcularPreviewPrecioUnidad({
            precio: 3, cantidadPorFormato: 750, formato: 'BOTE', unidad: 'unidad'
        });
        expect(r.unitPrice).toBeCloseTo(0.004, 6);
        expect(r.level).toBe('sospechoso');
    });

    test('botella/docena con cpf>1 también sospechoso', () => {
        expect(calcularPreviewPrecioUnidad({ precio: 8, cantidadPorFormato: 6, formato: 'CAJA', unidad: 'botella' }).level).toBe('sospechoso');
        expect(calcularPreviewPrecioUnidad({ precio: 12, cantidadPorFormato: 12, formato: 'CAJA', unidad: 'docena' }).level).toBe('sospechoso');
    });

    test('cpf=1 (o vacío) no divide y no es sospechoso', () => {
        const r = calcularPreviewPrecioUnidad({ precio: 3, cantidadPorFormato: 1, unidad: 'unidad' });
        expect(r.cpf).toBe(1);
        expect(r.unitPrice).toBe(3);
        expect(r.level).toBe('ok');
    });

    test('formato real en litros (no contable) con cpf>1 es ok (garrafa)', () => {
        const r = calcularPreviewPrecioUnidad({
            precio: 20, cantidadPorFormato: 5, formato: 'GARRAFA', unidad: 'l'
        });
        expect(r.unitPrice).toBe(4);
        expect(r.level).toBe('ok');
    });
});
