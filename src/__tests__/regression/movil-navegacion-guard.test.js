/**
 * @jest-environment node
 *
 * Guard de regresión — auditoría móvil 2026-07-06 (Fase 1).
 *
 * En móvil el sidebar es off-canvas (translateX) y se abre con el hamburguesa.
 * Bugs corregidos que este guard impide reintroducir:
 *   1. cambiarTab() NO cerraba el sidebar → tras tocar una pestaña el menú se
 *      quedaba abierto tapando todo el contenido.
 *   2. El CSS de .sidebar-overlay existía pero el ELEMENTO no estaba en el DOM
 *      (CSS muerto) → sin oscurecido y sin "tocar fuera para cerrar".
 *   3. El z-index del overlay debe quedar POR DEBAJO del sidebar (100) o lo tapa.
 *   4. Los inputs móviles a <16px provocan zoom automático en iOS.
 *   5. Toda tabla en móvil hereda min-width:650px; sin display:block+overflow-x
 *      las tablas sin wrapper desbordan el viewport sin scroll posible.
 */
import { readFileSync } from 'fs';

const core = readFileSync('src/modules/core/core.js', 'utf8');
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('styles/main.css', 'utf8');

describe('Móvil Fase 1 — navegación (guard)', () => {
    test('cambiarTab cierra el sidebar (.open) al navegar', () => {
        const fn = core.slice(core.indexOf('export function cambiarTab'));
        expect(fn).toMatch(/getElementById\('sidebar'\)\?\.classList\.remove\('open'\)/);
    });

    test('el elemento #sidebar-overlay existe en el DOM como hermano tras el aside', () => {
        expect(html).toMatch(/<\/aside>[\s\S]{0,400}class="sidebar-overlay"/);
        // y cierra el sidebar al tocarlo
        expect(html).toMatch(/sidebar-overlay[\s\S]{0,200}classList\.remove\('open'\)/);
    });

    test('overlay: oculto por defecto y z-index por debajo del sidebar', () => {
        expect(css).toMatch(/\.sidebar-overlay\s*\{\s*display:\s*none/);
        // dentro del bloque de overlay móvil, z-index 99 (sidebar es 100)
        const overlayBlock = css.slice(css.indexOf('.sidebar.open ~ .sidebar-overlay'));
        const zMatch = overlayBlock.slice(0, 500).match(/z-index:\s*(\d+)/);
        expect(zMatch).not.toBeNull();
        expect(parseInt(zMatch[1])).toBeLessThan(100);
    });
});

describe('Móvil Fase 1 — tablas e inputs (guard)', () => {
    test('las tablas en móvil son auto-scrollables (display:block + overflow-x)', () => {
        // Debe existir junto al min-width:650px del bloque @media 768
        const idx = css.indexOf('min-width: 650px !important');
        expect(idx).toBeGreaterThan(-1);
        const tablaBlock = css.slice(idx, idx + 900);
        expect(tablaBlock).toMatch(/display:\s*block/);
        expect(tablaBlock).toMatch(/overflow-x:\s*auto/);
    });

    test('inputs de formularios/modales a 16px en móvil (anti-zoom iOS)', () => {
        expect(css).toMatch(/\.modal-content input,[\s\S]{0,200}font-size:\s*16px\s*!important/);
    });

    test('el chip ⌘K se oculta en móvil', () => {
        expect(css).toMatch(/\.gs-kbd-hint\s*\{\s*display:\s*none/);
    });
});
