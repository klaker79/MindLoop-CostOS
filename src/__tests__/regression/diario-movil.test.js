/**
 * El Diario tiene que seguir siendo usable en el móvil.
 *
 * Estuvo bloqueado: compartía con Análisis e Inteligencia un cartel de "Mejor
 * en ordenador" que ocultaba TODO el contenido de la pestaña por debajo de
 * 768px. Se metió ahí por parecido —tablas anchas— pero el Diario es distinto:
 * sus cuatro tablas ya se construyen con la primera columna FIJA dentro de un
 * contenedor con scroll, o sea que se leen como una hoja de cálculo en el
 * teléfono. Y en Lite es una de las ocho pestañas que se venden.
 *
 * Estos tests fijan las dos mitades:
 *  - que nadie vuelva a taparlo (ni de rebote, añadiendo #tab-diario a la
 *    regla de ocultar),
 *  - y que la primera columna siga siendo fija, que es lo ÚNICO que hace
 *    legible una tabla de 31 columnas en una pantalla de 6 pulgadas.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const css = readFileSync(join(raiz, 'styles', 'main.css'), 'utf8');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const legacy = readFileSync(join(raiz, 'src', 'legacy', 'inventario-masivo.js'), 'utf8');

/** Extrae el cuerpo de una función por nombre, contando llaves. */
function cuerpoDeFuncion(src, nombre) {
    const i = src.indexOf(`function ${nombre}(`);
    if (i === -1) throw new Error(`No existe la función ${nombre} (¿renombrada?)`);
    const abre = src.indexOf('{', i);
    let nivel = 0;
    for (let p = abre; p < src.length; p++) {
        if (src[p] === '{') nivel++;
        else if (src[p] === '}' && --nivel === 0) return src.slice(abre, p + 1);
    }
    throw new Error(`Llaves sin cerrar en ${nombre}`);
}

/** Las reglas que ocultan el contenido de una pestaña tras el cartel. */
function reglasQueOcultanContenido() {
    return css.match(/#tab-[a-z]+\.active > \*:not\(\.desktop-only-banner\)[^{]*\{[^}]*\}/g) || [];
}

describe('El Diario no está bloqueado en el móvil', () => {
    test('ninguna regla de "solo escritorio" oculta el contenido del Diario', () => {
        const reglas = reglasQueOcultanContenido().join('\n');
        expect(reglas).not.toContain('#tab-diario');
    });

    test('el selector que muestra el cartel tampoco menciona al Diario', () => {
        const mostrar = css.match(/#tab-[a-z]+\.active \.desktop-only-banner[\s\S]*?\{/g) || [];
        expect(mostrar.join('\n')).not.toContain('#tab-diario');
    });

    test('la pestaña Diario no lleva cartel de "Mejor en ordenador" en el HTML', () => {
        const desde = html.indexOf('id="tab-diario"');
        expect(desde).toBeGreaterThan(-1);
        // Hasta el arranque de la siguiente pestaña, que es donde acaba esta.
        const hasta = html.indexOf('id="tab-', desde + 10);
        const seccion = html.slice(desde, hasta === -1 ? html.length : hasta);
        expect(seccion).not.toContain('class="desktop-only-banner"');
    });
});

describe('Análisis e Inteligencia SIGUEN bloqueadas (no romper lo que sí estaba bien)', () => {
    test.each(['#tab-analisis', '#tab-inteligencia'])('%s sigue oculto en móvil', (tab) => {
        expect(reglasQueOcultanContenido().join('\n')).toContain(tab);
    });

    test.each(['tab-analisis', 'tab-inteligencia'])('%s conserva su cartel en el HTML', (tab) => {
        const desde = html.indexOf(`id="${tab}"`);
        expect(desde).toBeGreaterThan(-1);
        const hasta = html.indexOf('id="tab-', desde + 10);
        const seccion = html.slice(desde, hasta === -1 ? html.length : hasta);
        expect(seccion).toContain('class="desktop-only-banner"');
    });
});

describe('Las tablas del Diario mantienen la primera columna fija', () => {
    // Sin esto, arrastrar de lado pierde de vista de QUÉ fila son los números:
    // una rejilla de cifras sin etiqueta no dice nada.
    const RENDERERS = [
        'renderizarTablaComprasDiarias',
        'renderizarTablaVentasDiarias',
        'renderizarTablaProveedoresDiarios',
        'renderizarTablaPLDiario',
    ];

    test.each(RENDERERS)('%s fija la etiqueta de fila', (nombre) => {
        const cuerpo = cuerpoDeFuncion(legacy, nombre);
        expect(cuerpo).toMatch(/position:\s*sticky;\s*left:\s*0/);
    });

    test.each(RENDERERS)('%s pinta cabecera Y filas fijas, no solo una de las dos', (nombre) => {
        const cuerpo = cuerpoDeFuncion(legacy, nombre);
        const veces = (cuerpo.match(/position:\s*sticky;\s*left:\s*0/g) || []).length;
        expect(veces).toBeGreaterThanOrEqual(2);
    });

    test('la celda fija lleva fondo propio: si no, el texto de debajo se ve al desplazar', () => {
        for (const nombre of RENDERERS) {
            const cuerpo = cuerpoDeFuncion(legacy, nombre);
            const fijas = cuerpo.match(/position:\s*sticky;\s*left:\s*0;[^"]*/g) || [];
            expect(fijas.length).toBeGreaterThan(0);
            for (const decl of fijas) {
                expect(decl).toMatch(/background/);
            }
        }
    });
});

describe('Los contenedores de tabla permiten el arrastre lateral', () => {
    test.each([
        'tabla-compras-diarias',
        'tabla-ventas-diarias',
        'tabla-proveedores-diarios',
        'tabla-pl-diario',
    ])('%s tiene overflow', (id) => {
        const i = html.indexOf(`id="${id}"`);
        expect(i).toBeGreaterThan(-1);
        const etiqueta = html.slice(i, html.indexOf('>', i));
        expect(etiqueta).toMatch(/overflow:\s*auto/);
    });
});
