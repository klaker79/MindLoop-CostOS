/**
 * @jest-environment node
 *
 * Guard de regresión — Móvil Fase 2 (2026-07-07). Cubre:
 *  1. Recepción de pedidos → tarjetas: la tabla tiene id #tabla-recepcion y sus
 *     td llevan data-label (pedidos-recepcion.js), y el CSS card-view existe.
 *  2. Recetas y Proveedores → tarjetas: td con data-label + CSS.
 *  3. Nuevo Pedido: steppers +/− (window.pedidoStep + .qty-stepper envolviendo
 *     la .cantidad-input, que NO se renombra) ocultos en escritorio.
 *  4. Chat: usa dvh (teclado no tapa el input).
 *  5. Safe-area: viewport-fit=cover + env(safe-area-inset-*).
 */
import { readFileSync } from 'fs';

const css = readFileSync('styles/main.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const recepcion = readFileSync('src/modules/pedidos/pedidos-recepcion.js', 'utf8');
const recetas = readFileSync('src/modules/recetas/recetas-ui.js', 'utf8');
const proveedores = readFileSync('src/modules/proveedores/proveedores-ui.js', 'utf8');
const pedidosUi = readFileSync('src/modules/pedidos/pedidos-ui.js', 'utf8');
const chat = readFileSync('src/modules/chat/chat-styles.js', 'utf8');

describe('F2 — recepción de pedidos en tarjetas', () => {
    test('la tabla de recepción tiene id #tabla-recepcion', () => {
        expect(html).toContain('id="tabla-recepcion"');
    });
    test('las filas de recepción llevan data-label', () => {
        expect(recepcion).toMatch(/<td data-label="\$\{lRecIng\}"/);
        expect(recepcion).toMatch(/<td data-label="\$\{lRecEst\}"/);
    });
    test('CSS card-view de recepción (thead oculto + td::before)', () => {
        expect(css).toMatch(/#tabla-recepcion thead\s*\{\s*display:\s*none/);
        expect(css).toMatch(/#tabla-recepcion td::before[\s\S]{0,60}attr\(data-label\)/);
    });
});

describe('F2 — Recetas y Proveedores en tarjetas', () => {
    test('recetas: td con data-label', () => {
        expect(recetas).toMatch(/<td data-label="\$\{lblNom\}"/);
    });
    test('proveedores: td con data-label', () => {
        expect(proveedores).toMatch(/<td data-label="\$\{lblNom\}"/);
    });
    test('CSS card-view recetas+proveedores', () => {
        expect(css).toMatch(/#tabla-recetas td::before,\s*#tabla-proveedores td::before/);
    });
});

describe('F2 — Nuevo Pedido steppers', () => {
    test('window.pedidoStep existe y ajusta la .cantidad-input', () => {
        expect(pedidosUi).toMatch(/window\.pedidoStep\s*=/);
        expect(pedidosUi).toMatch(/querySelector\('\.cantidad-input'\)/);
    });
    test('la .cantidad-input sigue existiendo (contrato) dentro de .qty-stepper', () => {
        expect(pedidosUi).toMatch(/class="qty-stepper"[\s\S]{0,400}class="cantidad-input"/);
    });
    test('los botones del stepper están ocultos en escritorio (.qty-btn display:none base)', () => {
        expect(css).toMatch(/\.qty-btn\s*\{\s*display:\s*none/);
    });
});

describe('F2 — chat dvh + safe-area', () => {
    test('chat usa dvh (no solo vh)', () => {
        expect(chat).toMatch(/dvh/);
    });
    test('en móvil la ventana del chat se ancla por los DOS lados (no se sale)', () => {
        // Antes solo anclaba a la derecha con un width que desbordaba y cortaba
        // el texto por la izquierda (bug 07-07). left+right+width:auto lo impide.
        // Acotamos al bloque .chat-window dentro del @media 480.
        const media = chat.slice(chat.indexOf('@media (max-width: 480px)'));
        const cwStart = media.indexOf('.chat-window');
        const bloque = media.slice(cwStart, media.indexOf('}', cwStart));
        expect(bloque).toMatch(/left:\s*10px/);
        expect(bloque).toMatch(/right:\s*10px/);
        expect(bloque).toMatch(/width:\s*auto/);
    });
    test('viewport-fit=cover en el meta', () => {
        expect(html).toMatch(/viewport-fit=cover/);
    });
    test('safe-area en hamburguesa (env inset)', () => {
        expect(css).toMatch(/\.mobile-menu-toggle[\s\S]{0,200}env\(safe-area-inset-top/);
    });
});
