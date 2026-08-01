/**
 * @jest-environment node
 *
 * Guard de regresión — hallazgo 2026-08-01 (segunda capa del problema "Caduco").
 *
 * El modal que reparte la diferencia del recuento físico prellenaba cada línea con
 * `motivo: 'Caduco'` cuando faltaba stock. Una diferencia de recuento NO es
 * caducidad: es lo que falta y no sabes por qué (merma no apuntada, error de
 * escandallo, mal pesaje en recepción, venta sin registrar…).
 *
 * En La Nave 5 generó 196 registros de "Caduco", entre ellos un ÚNICO ajuste de
 * −12.991 guantes y otro de −8.001 toallitas. El informe de mermas llegó a decir
 * ~4.726 € de verdura tirada que nunca se tiró.
 *
 * Además, el <select> ofrecía `value="Error Inventario"` mientras el prellenado
 * usaba `'Error de Inventario'`: al no casar ninguna opción, el navegador
 * seleccionaba la primera —"Caduco"— y el usuario veía un motivo distinto del
 * que se guardaba.
 *
 * Fix: default neutro 'Error de Inventario' en las tres vías (falta stock, sobra
 * stock y añadir línea) y el value del <select> unificado.
 */
import { readFileSync } from 'fs';

const src = readFileSync('src/legacy/app-core.js', 'utf8');

// Bloque del modal de reparto: desde mostrarModalConfirmarMermas hasta la DEFINICIÓN
// de removeSplit (`= `). Ojo: `window.removeSplit(` aparece antes dentro del HTML que
// pinta cada fila, así que cortar por el nombre a secas dejaría addSplit fuera.
const inicio = src.indexOf('window.mostrarModalConfirmarMermas');
const fin = src.indexOf('window.removeSplit =');
const modal = src.slice(inicio, fin);

describe('Recuento físico — la diferencia no se etiqueta como caducidad', () => {
    test('el bloque del modal existe (si no, este guard no vigila nada)', () => {
        expect(inicio).toBeGreaterThan(-1);
        expect(fin).toBeGreaterThan(inicio);
    });

    test('NINGÚN prellenado usa Caduco por defecto', () => {
        expect(modal).not.toMatch(/motivo:\s*'Caduco'/);
    });

    test('las tres vías prellenan con el motivo neutro', () => {
        // falta stock, sobra stock y addSplit.
        const defaults = modal.match(/motivo:\s*'Error de Inventario'/g) || [];
        expect(defaults.length).toBe(3);
    });

    test('el value del desplegable casa con el prellenado', () => {
        // Si no casan, el navegador cae en la primera opción (Caduco) y el usuario
        // ve un motivo distinto del que se guarda.
        expect(modal).toMatch(/<option value="Error de Inventario"/);
        expect(modal).not.toMatch(/<option value="Error Inventario"/);
    });

    test('Caduco sigue disponible como opción elegible a mano', () => {
        // No se trata de prohibirlo: si algo caducó de verdad, hay que poder decirlo.
        expect(modal).toMatch(/<option value="Caduco"/);
    });
});
