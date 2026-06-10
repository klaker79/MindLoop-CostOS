/**
 * Recuento de inventario — lógica de reconciliación (la parte crítica).
 *
 * calcularAjustesDesde decide, para cada ingrediente contado:
 *   - contar MENOS que el sistema → MERMA ("Ajuste de inventario")
 *   - contar MÁS/IGUAL           → SUBIDA (consolidateStock) / igual
 *   - no contado                 → se ignora
 * Cada ingrediente cae en UNA sola vía (sin doble conteo). Mismo criterio que el
 * import Excel. Estos tests blindan que un cambio futuro no rompa el reparto.
 */
import { calcularAjustesDesde } from '@modules/inventario/recuento.js';

const ITEMS = [
    { id: 1, nombre: 'PULPO', unidad: 'kg', familia: 'pescado', stockSistema: 10, precio: 20 },
    { id: 2, nombre: 'CALABACIN', unidad: 'kg', familia: 'verdura', stockSistema: 16, precio: 5 },
    { id: 3, nombre: 'LIMON', unidad: 'kg', familia: 'fruta', stockSistema: 4, precio: 2 },
    { id: 4, nombre: 'PERAS', unidad: 'kg', familia: 'fruta', stockSistema: 2, precio: 3 },
];

describe('recuento — calcularAjustesDesde (reconciliación)', () => {
    test('contar MENOS que el sistema → merma con cantidad y valor correctos', () => {
        const { mermas, subidas, igual } = calcularAjustesDesde(ITEMS, { 1: 7 }, 'X');
        expect(subidas).toHaveLength(0);
        expect(igual).toBe(0);
        expect(mermas).toHaveLength(1);
        // PULPO: 10 → 7 = merma de 3 kg × 20 €/kg = 60 €
        expect(mermas[0]).toMatchObject({
            ingredienteId: 1, cantidad: 3, valorPerdida: 60, motivo: 'Ajuste de inventario'
        });
    });

    test('contar MÁS que el sistema → subida con stock_real al valor contado', () => {
        const { mermas, subidas } = calcularAjustesDesde(ITEMS, { 2: 20 }, 'X');
        expect(mermas).toHaveLength(0);
        expect(subidas).toEqual([expect.objectContaining({ id: 2, stock_real: 20 })]);
    });

    test('contar IGUAL que el sistema → ni merma ni subida', () => {
        const { mermas, subidas, igual } = calcularAjustesDesde(ITEMS, { 3: 4 }, 'X');
        expect(mermas).toHaveLength(0);
        expect(subidas).toHaveLength(0);
        expect(igual).toBe(1);
    });

    test('no contado → se ignora (no entra en ningún bucket)', () => {
        const { mermas, subidas, igual } = calcularAjustesDesde(ITEMS, {}, 'X');
        expect(mermas).toHaveLength(0);
        expect(subidas).toHaveLength(0);
        expect(igual).toBe(0);
    });

    test('contar 0 con stock 2 → merma de 2 (valor 2×precio)', () => {
        const { mermas } = calcularAjustesDesde(ITEMS, { 4: 0 }, 'X'); // PERAS 2kg @3
        expect(mermas[0]).toMatchObject({ ingredienteId: 4, cantidad: 2, valorPerdida: 6 });
    });

    test('cada ingrediente cae en UNA sola vía (sin doble conteo)', () => {
        const conteos = { 1: 7, 2: 20, 3: 4, 4: 1 }; // merma, subida, igual, merma
        const { mermas, subidas, igual } = calcularAjustesDesde(ITEMS, conteos, 'X');
        const procesados = mermas.length + subidas.length + igual;
        const contados = Object.values(conteos).filter(Number.isFinite).length;
        expect(procesados).toBe(contados); // 4
        const ids = [...mermas.map(m => m.ingredienteId), ...subidas.map(s => s.id)];
        expect(new Set(ids).size).toBe(ids.length); // ningún id repetido
    });

    test('valorPerdida se redondea a 2 decimales', () => {
        const its = [{ id: 9, nombre: 'X', unidad: 'kg', stockSistema: 1, precio: 7.333 }];
        const { mermas } = calcularAjustesDesde(its, { 9: 0 }, 'X');
        expect(mermas[0].valorPerdida).toBe(7.33);
    });
});
