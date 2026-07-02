/**
 * @jest-environment node
 *
 * Guard de regresión — bug 2026-07-02.
 *
 * En "Merma Rápida", la fila usa una rejilla `grid-template-columns`. La primera
 * columna era `1fr`, que NO encoge por debajo de su contenido. Con los nombres de
 * ingrediente largos de La Nave 5 ("5262 - MAELOC DULCE 24B 33CL…"), la columna
 * del producto se estiraba a ~730px y empujaba **Cantidad** y **Motivo** fuera del
 * borde derecho del modal (max-width 800px). Estaban en el DOM pero invisibles →
 * la jefa de cocina no podía registrar mermas.
 *
 * Fix: `minmax(0, 1fr)` en la columna + `min-width: 0` en el <select> del producto.
 * Este test FALLA si alguien reintroduce el `1fr` pelado o quita el `min-width:0`.
 * Aplica a agregarLineaMerma() y agregarLineaMermaConDatos().
 */
import { readFileSync } from 'fs';

const src = readFileSync('src/modules/inventario/merma-rapida.js', 'utf8');

describe('Merma Rápida — rejilla de la fila (guard anti-overflow)', () => {
    test('NO usa `1fr 80px 110px 90px` pelado (el patrón que causó el bug)', () => {
        expect(src).not.toMatch(/grid-template-columns:\s*1fr\s+80px\s+110px\s+90px/);
    });

    test('usa `minmax(0, 1fr) 80px 110px 90px` en las 2 filas', () => {
        const matches = src.match(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+80px\s+110px\s+90px/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    test('el <select> del producto lleva `min-width: 0` para poder encoger', () => {
        const matches = src.match(/class="merma-producto"[\s\S]{0,220}?min-width:\s*0/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
});
