/**
 * @jest-environment node
 *
 * La app instalada tiene la identidad de la casa Lite.
 *
 * Bug que previene (2026-07-30): el `manifest.json` y el `theme-color` seguían
 * en los colores del tema anterior (navy #201D47 y morado #667eea) mientras la
 * app es terracota sobre crema. Al instalarla en el móvil, la pantalla de
 * arranque y la barra de estado salían moradas. Ese primer segundo es donde se
 * decide si parece una app de verdad o una web con un icono encima.
 *
 * Este test es de RAMA: en `lite` la identidad es terracota. En `main` los
 * colores correctos son los otros.
 */
import { readFileSync } from 'fs';

const ACENTO = '#b0533a';   // --accent de Lite
const CREMA = '#faf6f1';    // --app-bg de Lite

const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
const html = readFileSync('index.html', 'utf8');

describe('Identidad de la app instalada (casa Lite)', () => {
    test('el manifest usa los colores de Lite, no los del tema anterior', () => {
        expect(manifest.theme_color.toLowerCase()).toBe(ACENTO);
        expect(manifest.background_color.toLowerCase()).toBe(CREMA);
        // Los del tema viejo no deben volver.
        const json = JSON.stringify(manifest).toLowerCase();
        expect(json).not.toContain('#201d47');
        expect(json).not.toContain('#2e2a6e');
    });

    test('el theme-color del HTML coincide con el del manifest', () => {
        const m = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i);
        expect(m).not.toBeNull();
        expect(m[1].toLowerCase()).toBe(manifest.theme_color.toLowerCase());
    });

    test('la barra de estado de iOS no es translúcida sobre fondo claro', () => {
        // Con `black-translucent` iOS pinta la hora en blanco: invisible sobre crema.
        const m = html.match(/apple-mobile-web-app-status-bar-style"\s+content="([^"]+)"/i);
        expect(m).not.toBeNull();
        expect(m[1]).not.toBe('black-translucent');
    });

    test('los iconos son los de Lite y existen en disco', () => {
        const srcs = manifest.icons.map((i) => i.src);
        expect(srcs.every((s) => s.includes('costeos-lite-icon'))).toBe(true);
        for (const s of new Set(srcs)) {
            // No debe romperse el icono: si el fichero no está, la instalación
            // se queda sin icono y Android ni siquiera ofrece instalar.
            expect(() => readFileSync('public' + s)).not.toThrow();
        }
    });

    test('hay un icono maskable (Android recorta el icono a un círculo)', () => {
        expect(manifest.icons.some((i) => String(i.purpose).includes('maskable'))).toBe(true);
    });

    test('apple-touch-icon apunta al icono de Lite', () => {
        // iOS ignora los iconos del manifest para la pantalla de inicio.
        const m = html.match(/rel="apple-touch-icon"\s+href="([^"]+)"/i);
        expect(m).not.toBeNull();
        expect(m[1]).toContain('costeos-lite-icon');
    });

    test('los accesos directos apuntan a acciones que la app sabe atender', () => {
        const acciones = manifest.shortcuts.map((s) => new URL(s.url, 'https://x').searchParams.get('accion'));
        expect(acciones).toEqual(['albaran', 'pedido']);
        // Y el código las atiende de verdad, no son un adorno del manifest.
        const home = readFileSync('src/modules/mobile/mobile-home.js', 'utf8');
        for (const a of acciones) expect(home).toContain(`'${a}'`);
    });
});
