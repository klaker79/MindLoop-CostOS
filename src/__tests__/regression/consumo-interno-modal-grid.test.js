/**
 * @jest-environment node
 *
 * Guard de regresión — misma clase de bug que Merma Rápida (2026-07-02).
 *
 * El modal de Consumo Interno lleva `<select>` con NOMBRES DE RECETA, que en La
 * Nave 5 son largos. Una columna `1fr` pelada NO encoge bajo su contenido: el
 * select se estira y empuja los campos de la derecha (raciones, tipo) fuera del
 * modal — quedan en el DOM pero invisibles, que fue exactamente lo que impidió
 * a la jefa de cocina registrar mermas durante semanas.
 *
 * Regla (CLAUDE.md frontend): en rejillas de modal con select/input de nombres
 * largos → `minmax(0, 1fr)` + `min-width: 0` en el control.
 *
 * Este test FALLA si alguien mete un `1fr` pelado en el modal o en la lista.
 */
import { readFileSync } from 'fs';

const html = readFileSync('index.html', 'utf8');
const js = readFileSync('src/modules/inventario/consumo-interno.js', 'utf8');

// Aísla el bloque del modal para no auditar todo index.html.
const inicio = html.indexOf('id="modal-consumo-interno"');
const modal = inicio === -1 ? '' : html.slice(inicio, html.indexOf('</div>', html.indexOf('ci-historial')));

describe('Consumo Interno — rejillas del modal (guard anti-overflow)', () => {
    test('el modal existe en index.html', () => {
        expect(inicio).toBeGreaterThan(-1);
    });

    test('ninguna rejilla del modal usa `1fr` pelado (debe ser minmax(0, 1fr))', () => {
        const rejillas = modal.match(/grid-template-columns:[^;"]+/g) || [];
        expect(rejillas.length).toBeGreaterThan(0);
        rejillas.forEach(r => {
            // `1fr` solo se acepta dentro de minmax(0, 1fr)
            const sinMinmax = r.replace(/minmax\(\s*0\s*,\s*1fr\s*\)/g, '');
            expect(sinMinmax).not.toMatch(/\b1fr\b/);
        });
    });

    test('los <select> del modal llevan min-width: 0', () => {
        const selects = modal.match(/<select[^>]*>/g) || [];
        expect(selects.length).toBeGreaterThanOrEqual(3); // tipo, plato, empleado
        selects.forEach(s => {
            expect(s).toMatch(/min-width:\s*0/);
        });
    });

    test('la fila del histórico (JS) usa minmax(0,1fr), no `1fr` pelado', () => {
        const rejillas = js.match(/grid-template-columns:[^;`']+/g) || [];
        expect(rejillas.length).toBeGreaterThan(0);
        rejillas.forEach(r => {
            const sinMinmax = r.replace(/minmax\(\s*0\s*,\s*1fr\s*\)/g, '');
            expect(sinMinmax).not.toMatch(/\b1fr\b/);
        });
    });
});
