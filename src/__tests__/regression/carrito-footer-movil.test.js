/**
 * @jest-environment node
 *
 * Guard de regresión — "le doy a Crear Pedido y no se crea" (móvil, 2026-08-03).
 *
 * El pie del carrito agrupa tres botones en un `<div style="display:flex">` SIN
 * `flex-wrap`. Sus hijos son flex items con el `min-width:auto` por defecto, así
 * que no encogen por debajo de su texto:
 *
 *     "🗑️ Vaciar" + "➕ Añadir más productos" + "✅ Crear Pedido(s)"  ≈ 470 px
 *     ancho útil de un móvil de 360 px                                ≈ 330 px
 *
 * El sobrante NO produce scroll horizontal, porque `#modal-carrito .modal-content`
 * es `overflow:hidden` — se RECORTA. El botón principal quedaba fuera del alcance
 * del dedo y el pedido no se creaba nunca.
 *
 * Verificado antes de tocar nada: la API creaba el pedido sin problema (POST
 * /api/orders → 201 con el payload exacto del carrito) y en la BD no quedaba ni
 * una fila del intento → la petición jamás salía del navegador.
 */
import { readFileSync } from 'fs';

const css = readFileSync('styles/theme-editorial.css', 'utf8');
const cart = readFileSync('src/modules/pedidos/pedidos-cart.js', 'utf8');

// El bloque de reglas del carrito, sin comentarios (que citan el bug y darían
// falsos positivos a las aserciones de texto).
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('el pie del carrito cabe en un móvil', () => {
    test('el grupo de botones envuelve en vez de desbordar', () => {
        const regla = cssCode.match(
            /#modal-carrito\s+\.carrito-footer\s*>\s*div:last-child\s*\{[^}]*\}/
        );
        expect(regla).not.toBeNull();
        expect(regla[0]).toMatch(/flex-wrap:\s*wrap/);
        // Sin esto un flex item no baja de su ancho de contenido y sigue desbordando.
        expect(regla[0]).toMatch(/min-width:\s*0/);
    });

    test('en móvil los botones van apilados y a lo ancho', () => {
        const movil = cssCode.match(/@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?\n\}/g) || [];
        const bloque = movil.find(b => b.includes('#modal-carrito .carrito-footer'));
        expect(bloque).toBeDefined();
        expect(bloque).toMatch(/flex-direction:\s*column/);
        expect(bloque).toMatch(/flex:\s*1\s+1\s+100%/);
    });

    // `overflow:hidden` es lo que convierte el desbordamiento en un botón
    // inalcanzable en vez de en una barra con scroll. Es deliberado (mantiene el
    // footer fijo), así que el guard documenta la dependencia: si alguien lo
    // quita, estas reglas dejan de ser imprescindibles pero tampoco estorban.
    test('el modal sigue recortando (por eso hace falta lo de arriba)', () => {
        const modal = cssCode.match(/#modal-carrito\s+\.modal-content\s*\{[^}]*\}/);
        expect(modal).not.toBeNull();
        expect(modal[0]).toMatch(/overflow:\s*hidden/);
    });
});

describe('crear un pedido nunca falla en silencio', () => {
    // Estaba FUERA del try: si petaba, el error subía sin catch, dejaba
    // `isConfirmingCart` en true (botón muerto hasta recargar) y no salía toast.
    test('showLoading se llama dentro del try', () => {
        const cuerpo = cart.slice(cart.indexOf('window.confirmarCarrito'));
        const tryIdx = cuerpo.indexOf('try {');
        const loadIdx = cuerpo.indexOf('window.showLoading()');
        expect(tryIdx).toBeGreaterThan(-1);
        expect(loadIdx).toBeGreaterThan(tryIdx);
    });

    test('el guard anti-doble-click se libera siempre', () => {
        const cuerpo = cart.slice(cart.indexOf('window.confirmarCarrito'));
        expect(cuerpo).toMatch(/finally\s*\{[^}]*isConfirmingCart\s*=\s*false/);
    });

    // Si el usuario cancela el confirm() no debe quedarse bloqueado: el guard
    // tiene que activarse DESPUÉS de preguntar, no antes.
    test('el guard se activa después del confirm, no antes', () => {
        const cuerpo = cart.slice(cart.indexOf('window.confirmarCarrito'));
        expect(cuerpo.indexOf('isConfirmingCart = true')).toBeGreaterThan(cuerpo.indexOf('confirm('));
    });
});
