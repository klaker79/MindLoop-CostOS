/**
 * Cada casa habla SOLO con su propia API.
 *
 * El dominio de la API de producción estaba escrito a mano como fallback en
 * DOCE sitios del código. Consecuencia real, verificada en el bundle que servía
 * staging.mindloop.cloud: el frontend de staging llevaba dentro la URL de la
 * API de La Nave 5. Bastaba que `window.API_CONFIG` no estuviera definido en el
 * momento equivocado para que staging llamara a producción. Hoy lo frena el
 * CORS (403) — pero el CORS es la última red, no la primera.
 *
 * La regla que fijan estos tests:
 *  1. El dominio de una API solo puede existir en UN archivo: app-config.js.
 *  2. Ahí vive un mapa dominio→API: cada casa conoce únicamente a la suya.
 *  3. Una casa desconocida NO cae a producción: devuelve vacío y canta en
 *     consola. Mejor romperse a la vista que cruzar de casa en silencio.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const raizSrc = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ⚠️ NO se importa app-config aquí: cualquier módulo que toque import.meta.env
// en su ámbito de módulo revienta bajo Jest (el polyfill de setup-esm no llega
// a los import.meta de otros módulos — es el mismo motivo por el que authStore
// es autocontenido). El mapa se extrae del FUENTE y se valida como dato.
const fuenteConfig = readFileSync(join(raizSrc, 'config', 'app-config.js'), 'utf8');

/** Extrae el objeto API_POR_CASA del fuente, entrada a entrada. */
function mapaDelFuente() {
    const bloque = fuenteConfig.match(/API_POR_CASA = Object\.freeze\(\{([\s\S]*?)\}\)/);
    if (!bloque) throw new Error('No existe API_POR_CASA en app-config.js (¿renombrado?)');
    const mapa = {};
    for (const [, casa, api] of bloque[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
        mapa[casa] = api;
    }
    return mapa;
}
const API_POR_CASA = mapaDelFuente();

/** Todos los .js de src/, menos los tests. */
function archivosJs(dir) {
    const out = [];
    for (const nombre of readdirSync(dir)) {
        const p = join(dir, nombre);
        if (statSync(p).isDirectory()) {
            if (nombre === '__tests__' || nombre === 'node_modules') continue;
            out.push(...archivosJs(p));
        } else if (nombre.endsWith('.js') && !nombre.endsWith('.test.js')) {
            out.push(p);
        }
    }
    return out;
}

/** Quita comentarios: la historia del porqué puede citar dominios. */
function sinComentarios(fuente) {
    return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('El dominio de cada API vive en UN solo archivo', () => {
    const DOMINIOS_API = ['lacaleta-api.mindloop.cloud', 'staging-api.mindloop.cloud', 'lite-api.mindloop.cloud'];

    test.each(DOMINIOS_API)('%s solo aparece en app-config.js', (dominio) => {
        const culpables = [];
        for (const archivo of archivosJs(raizSrc)) {
            if (archivo.replace(/\\/g, '/').endsWith('config/app-config.js')) continue;
            if (sinComentarios(readFileSync(archivo, 'utf8')).includes(dominio)) {
                culpables.push(archivo.slice(raizSrc.length));
            }
        }
        expect(culpables).toEqual([]);
    });

    test('hay archivos que revisar (sanity check del recorredor)', () => {
        expect(archivosJs(raizSrc).length).toBeGreaterThan(50);
    });
});

describe('El mapa dominio → API', () => {
    test('cada casa apunta a la suya, sin cruces', () => {
        expect(API_POR_CASA).toEqual({
            'app.mindloop.cloud': 'https://lacaleta-api.mindloop.cloud',
            'staging.mindloop.cloud': 'https://staging-api.mindloop.cloud',
            'lite.mindloop.cloud': 'https://lite-api.mindloop.cloud',
        });
    });

    test('staging NUNCA apunta a la API de producción', () => {
        // El test del mapa completo ya lo cubre, pero esta línea es la que
        // importa: que quede escrita como afirmación propia.
        expect(API_POR_CASA['staging.mindloop.cloud']).not.toContain('lacaleta-api');
    });

    test('una casa desconocida no cae a producción: cae a vacío', () => {
        // Estructural (el módulo no se puede importar bajo Jest, ver arriba):
        // después de consultar el mapa, la función canta el error y devuelve
        // cadena vacía — no un dominio.
        const funcion = fuenteConfig.slice(
            fuenteConfig.indexOf('function apiBaseSegunCasa'),
            fuenteConfig.indexOf('export const appConfig')
        );
        expect(funcion).toContain("return '';");
        expect(funcion).toContain('console.error');
        // Y entre el `if (API_POR_CASA[casa])` y el final no hay ningún otro
        // dominio como salida de emergencia.
        const trasMapa = funcion.slice(funcion.indexOf('if (API_POR_CASA[casa])'));
        expect(trasMapa.replace(/console\.error\([\s\S]*?\);/, '')).not.toContain('mindloop.cloud');
    });
});

describe('authStore ya no lleva dominios de ninguna casa', () => {
    const fuente = sinComentarios(readFileSync(join(raizSrc, 'stores', 'authStore.js'), 'utf8'));

    test('sin URL de producción escrita a mano', () => {
        expect(fuente).not.toContain('lacaleta-api.mindloop.cloud');
    });

    test('lee la fuente única cuando no hay variable de entorno', () => {
        expect(fuente).toContain('window.API_CONFIG');
    });
});

describe('Los legacy fallan a la vista, no cruzan de casa', () => {
    test.each(['legacy/app-core.js', 'legacy/inventario-masivo.js', 'legacy/modales.js'])(
        '%s usa la fuente única con fallback vacío',
        (rel) => {
            const fuente = sinComentarios(readFileSync(join(raizSrc, rel), 'utf8'));
            expect(fuente).not.toContain('lacaleta-api.mindloop.cloud');
            // El patrón correcto sigue presente (no se ha borrado la llamada, solo
            // el dominio del fallback).
            expect(fuente).toContain("window.API_CONFIG?.baseUrl ?? ''");
        }
    );
});
