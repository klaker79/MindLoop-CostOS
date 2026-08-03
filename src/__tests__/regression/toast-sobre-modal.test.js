/**
 * @jest-environment node
 *
 * Guard de regresión — LOS AVISOS SE PERDÍAN DETRÁS DE LOS MODALES (2026-08-03).
 *
 * `.modal` tiene `z-index: 999999 !important` y `.toast-container` tenía 9999.
 * Resultado: cualquier aviso lanzado con un modal abierto se pintaba DETRÁS del
 * overlay y el usuario no lo veía nunca.
 *
 * Cómo se manifestó: Iker, confirmando el carrito desde el móvil. El camino de
 * ÉXITO hace `cerrarCarrito()` ANTES del toast, así que el "pedido creado" sí se
 * veía; pero el `catch` NO cierra el modal, y el toast de ERROR quedaba tapado.
 * Le dabas a "Crear Pedido", fallaba, y en pantalla no pasaba nada. En móvil el
 * toast va a `top:12px`, justo bajo la cabecera del modal: tapado del todo.
 *
 * Afecta a TODA la app, no solo al carrito: cada error dentro de un modal
 * (recepción, escandallo, ingredientes…) era invisible. Un bug que no se ve
 * cuesta días de diagnóstico a ciegas.
 */
import { readFileSync } from 'fs';

const css = readFileSync('styles/main.css', 'utf8');

function zIndexDe(selector) {
    const re = new RegExp(`(^|\\})\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'm');
    const bloque = css.match(re);
    if (!bloque) return null;
    const z = bloque[2].match(/z-index:\s*(\d+)/);
    return z ? parseInt(z[1], 10) : null;
}

describe('los avisos se ven por encima de los modales', () => {
    test('ambas reglas existen (si no, este guard no vigila nada)', () => {
        expect(zIndexDe('.toast-container')).not.toBeNull();
        expect(zIndexDe('.modal')).not.toBeNull();
    });

    test('el toast va por encima del modal', () => {
        expect(zIndexDe('.toast-container')).toBeGreaterThan(zIndexDe('.modal'));
    });

    // El overlay cubre la pantalla entera, así que "por encima" no es opcional:
    // con menos z-index el aviso queda literalmente detrás de un velo negro.
    test('el modal sigue siendo un overlay a pantalla completa', () => {
        const bloque = css.match(/(^|\})\s*\.modal\s*\{([^}]*)\}/m)[2];
        expect(bloque).toMatch(/position:\s*fixed/);
        expect(bloque).toMatch(/width:\s*100%/);
    });
});
