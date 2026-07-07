/**
 * @jest-environment node
 *
 * Guard de regresión — móvil "Nuevo Pedido" + sidebar colapsado (2026-07-07).
 *
 * 1. Si el usuario colapsó el sidebar en desktop (.app.sidebar-collapsed), esas
 *    reglas (mayor especificidad) ganaban a las del móvil: contenido estrujado
 *    con margin-left:70px y sidebar de solo-iconos al abrir con ☰ (captura de
 *    Iker 07-07). En móvil el colapsado debe quedar neutralizado.
 * 2. La fila de ingrediente de "Nuevo Pedido" (display:flex inline + inputs de
 *    60/70px) era un revoltijo en 390px. En móvil se apila como tarjeta SIN
 *    tocar el contrato DOM de guardarPedido/calcularTotalPedido (.cantidad-input,
 *    .precio-input, select[id$="-formato-select"], etc.).
 */
import { readFileSync } from 'fs';

const css = readFileSync('styles/main.css', 'utf8');
// Solo el bloque móvil (a partir del primer @media 768 grande)
const movil = css.slice(css.indexOf('@media (max-width: 768px)'));

describe('Móvil — sidebar colapsado neutralizado (guard)', () => {
    test('margin-left del contenido vuelve a 0 aunque haya .sidebar-collapsed', () => {
        expect(movil).toMatch(/\.app\.sidebar-collapsed \.app-content\s*\{\s*margin-left:\s*0\s*!important/);
    });
    test('el sidebar recupera su ancho completo en móvil', () => {
        expect(movil).toMatch(/\.app\.sidebar-collapsed \.sidebar\s*\{\s*width:\s*var\(--sidebar-width\)\s*!important/);
    });
    test('los textos del menú vuelven a verse (no solo-iconos)', () => {
        expect(movil).toMatch(/\.app\.sidebar-collapsed \.nav-item-text\s*\{[\s\S]{0,80}display:\s*block\s*!important/);
    });
});

describe('Móvil — Nuevo Pedido en tarjetas (guard)', () => {
    test('la fila de ingrediente se apila: select/buscador a ancho completo', () => {
        expect(movil).toMatch(/#lista-ingredientes-pedido \.ingrediente-item > \.select-search-input,[\s\S]{0,300}flex:\s*1 1 100% !important/);
    });
    test('cantidad (dentro de .qty-stepper) y precio con target táctil (min-height 44px)', () => {
        // F2: la .cantidad-input pasó a vivir dentro de .qty-stepper (steppers +/−).
        expect(movil).toMatch(/\.qty-stepper > \.cantidad-input[\s\S]{0,200}min-height:\s*44px/);
        expect(movil).toMatch(/> \.precio-input[\s\S]{0,200}min-height:\s*44px/);
    });
    test('el botón eliminar es absoluto (no rompe el flujo de la tarjeta)', () => {
        expect(movil).toMatch(/#lista-ingredientes-pedido \.ingrediente-item > button\s*\{[\s\S]{0,120}position:\s*absolute/);
    });
    test('NO se renombran las clases del contrato DOM (guardarPedido las lee)', () => {
        // El CSS móvil referencia las clases canónicas — si alguien las renombra
        // en pedidos-ui.js sin actualizar aquí, este test recuerda el contrato.
        const ui = readFileSync('src/modules/pedidos/pedidos-ui.js', 'utf8');
        for (const cls of ['cantidad-input', 'precio-input', 'precio-unidad-label', 'ingrediente-item']) {
            expect(ui).toContain(cls);
        }
    });
});
