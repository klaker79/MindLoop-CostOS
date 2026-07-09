/**
 * GUARD — al añadir a un pedido un ingrediente que se compra por FORMATO (caja)
 * y cuyo proveedor tiene precio configurado en `ingredientes_proveedores.precio`
 * (que está en €/UNIDAD-BASE), el input de precio, cuando está en modo formato,
 * debe mostrar €/formato = €base × cpf.
 *
 * Bug real (Iker 2026-07-09, probando la propagación de formato de la volandeira):
 * 1 caja de 3 kg a 16,09 €/kg salía en el pedido a 16,09 €/CAJA (debía ser
 * 48,27 €). La rama "configurado" ponía el €/base crudo en el campo €/CAJA,
 * mientras la rama "última compra" sí multiplicaba por el cpf.
 *
 * (1) Blinda la MATEMÁTICA con la función pura formatoDesdeBase (€base×cpf).
 * (2) Blinda que la rama "configurado" del formulario de pedidos sigue
 *     multiplicando por el cpf (no vuelve a poner rel.precio crudo).
 */
import fs from 'fs';
import path from 'path';
import { formatoDesdeBase } from '@modules/pedidos/formato-utils.js';

describe('precio configurado del proveedor en modo formato (€base × cpf)', () => {
    test('matemática: 16,09 €/kg con caja de 3 kg = 48,27 €/caja', () => {
        const r = formatoDesdeBase(0, 16.09, 3);
        expect(r.precio).toBeCloseTo(48.27, 2);
    });

    test('caja de 750 g a 0,004 €/g = 3 €/bote (caso mermelada histórico)', () => {
        expect(formatoDesdeBase(0, 0.004, 750).precio).toBeCloseTo(3, 6);
    });

    test('guard: la rama "configurado" de pedidos-ui multiplica rel.precio por el cpf en modo formato', () => {
        const src = fs.readFileSync(
            path.resolve('src/modules/pedidos/pedidos-ui.js'),
            'utf8'
        );
        // Debe existir el ajuste a €/formato para el precio configurado (no el
        // rel.precio crudo). Aceptamos la forma inline `rel.precio) * cpf`.
        expect(src).toMatch(/enFormatoCfg[\s\S]{0,120}parseFloat\(rel\.precio\) \* cpfCfg/);
        // Y NO debe volver la asignación cruda directa al input.
        expect(src).not.toMatch(/precioInput\.value = parseFloat\(rel\.precio\)\.toFixed\(2\);/);
    });
});
