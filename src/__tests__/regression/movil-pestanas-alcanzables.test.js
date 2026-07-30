/**
 * Qué se puede abrir desde el móvil, y qué NO — a propósito.
 *
 * En móvil el sidebar completo se oculta por CSS
 * (`.sidebar .sidebar-nav { display: none !important }` en mobile-home.css), así
 * que solo hay dos caminos: la barra inferior (Inicio · Pedidos · Recibir · Más)
 * y el menú "Más". Lo que no esté en uno de los dos es inalcanzable desde el
 * teléfono, aunque la pestaña exista y funcione.
 *
 * Eso pasó con el Diario: se le quitó el cartel de "abre en ordenador" para que
 * se viera bien en el móvil, y aun así no había forma de llegar. El arreglo
 * estuvo desplegado sin servir de nada.
 *
 * Este test NO exige que todo lo que se vende esté en el móvil — el móvil es
 * deliberadamente más corto que el escritorio. Lo que fija es la DECISIÓN, para
 * que cambiarla tenga que ser un acto consciente y no un descuido.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PLAN_TABS } from '@modules/core/plan-tabs.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const planTabs = readFileSync(join(raiz, 'src', 'modules', 'core', 'plan-tabs.js'), 'utf8');
const css = readFileSync(join(raiz, 'styles', 'main.css'), 'utf8');

/**
 * Lo que se decidió que se abre desde el teléfono (Iker, 2026-07-30).
 * El móvil se usa de pie en la cocina: se pide, se recibe y se consulta.
 */
const MENU_MOVIL = ['ingredientes', 'recetas', 'proveedores', 'inventario', 'diario', 'configuracion'];
const BARRA_INFERIOR = ['inicio', 'pedidos', 'recibir', 'mas'];

/** Vendidas en Lite pero FUERA del móvil, a propósito. */
const FUERA_DEL_MOVIL_A_PROPOSITO = ['ventas'];

function tabsDelMenuMovil() {
    const i = html.indexOf('class="sidebar-mobile-menu"');
    if (i === -1) throw new Error('No existe el menú "Más" del móvil (¿renombrado?)');
    const fin = html.indexOf('<nav class="sidebar-nav"', i);
    return [...html.slice(i, fin).matchAll(/class="smm-item"\s+data-tab="([\w-]+)"/g)].map(m => m[1]);
}

describe('El menú "Más" del móvil contiene exactamente lo decidido', () => {
    test('ni más ni menos', () => {
        expect(tabsDelMenuMovil()).toEqual(MENU_MOVIL);
    });

    test('la barra inferior sigue teniendo sus cuatro accesos', () => {
        expect([...html.matchAll(/data-mnav="([\w-]+)"/g)].map(m => m[1])).toEqual(BARRA_INFERIOR);
    });

    test('cada entrada declara data-tab, no solo el onclick', () => {
        // Sin `data-tab` el gating por plan no las ve: un cliente Lite acabaría
        // viendo en el móvil pestañas que no ha comprado.
        for (const item of html.match(/class="smm-item"[^>]*>/g) || []) {
            expect(item).toMatch(/data-tab="[\w-]+"/);
        }
    });

    test('el data-tab coincide con la pestaña que abre el onclick', () => {
        const items = [...html.matchAll(/class="smm-item"\s+data-tab="([\w-]+)"\s+onclick="window\.cambiarTab\('([\w-]+)'\)"/g)];
        expect(items.length).toBe(MENU_MOVIL.length);
        for (const [, dataTab, destino] of items) expect(dataTab).toBe(destino);
    });

    test('cada destino existe como pestaña real en el HTML', () => {
        for (const tab of tabsDelMenuMovil()) expect(html).toContain(`id="tab-${tab}"`);
    });

    test('todo lo del menú móvil se vende también en Lite', () => {
        // Al revés no: el móvil es más corto. Pero enseñar en el teléfono algo
        // que Lite no incluye sería vender humo.
        for (const tab of tabsDelMenuMovil()) expect(PLAN_TABS.lite).toContain(tab);
    });

    test.each(FUERA_DEL_MOVIL_A_PROPOSITO)('%s se queda fuera del móvil a propósito', (tab) => {
        // Si alguien la añade, que sea decidiéndolo: este test le obligará a
        // quitarla de esta lista y explicar por qué.
        expect(tabsDelMenuMovil()).not.toContain(tab);
        expect(PLAN_TABS.lite).toContain(tab);   // sí se vende: está en el escritorio
    });
});

describe('El gating por plan filtra las DOS navegaciones', () => {
    test('plan-tabs mira también el menú del móvil', () => {
        // Si solo filtrara `.nav-item`, el menú "Más" enseñaría pestañas no
        // compradas — y como el sidebar de escritorio está oculto en móvil,
        // nadie lo vería fallar hasta que lo encontrara un cliente.
        expect(planTabs).toMatch(/\.smm-item\[data-tab\]/);
    });

    test('sigue filtrando el sidebar de escritorio', () => {
        expect(planTabs).toMatch(/\.nav-item\[data-tab\]/);
    });
});

describe('El móvil no es una copia encogida del escritorio', () => {
    test('el Diario enseña solo el P&L', () => {
        // Las otras tres vistas (Compras, Ventas, Proveedores) y el selector
        // sobran en un teléfono. La lógica que las pinta NO se toca: los
        // números del móvil y los del ordenador salen del mismo sitio.
        expect(css).toMatch(/#tab-diario #vista-combinada\s*\{\s*display: block !important/);
        for (const v of ['vista-compras', 'vista-ventas', 'vista-proveedores']) {
            expect(css).toContain(`#tab-diario #${v}`);
        }
    });

    test('Configuración enseña solo los datos del restaurante', () => {
        // Regla "ocultar todo y volver a mostrar una": una sección nueva nace
        // oculta en el móvil, en vez de colarse por olvido.
        expect(css).toMatch(/#tab-configuracion \.card\s*\{\s*display: none !important/);
        expect(css).toMatch(/#tab-configuracion \.card:has\(#config-restaurante-nombre\)/);
    });

    test('el ancla de esa regla existe en el HTML', () => {
        // Si alguien renombra el id, la regla dejaría de casar y el móvil se
        // quedaría con la Configuración entera oculta, sin avisar.
        expect(html).toContain('id="config-restaurante-nombre"');
    });
});
