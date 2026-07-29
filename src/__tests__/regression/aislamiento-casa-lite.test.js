/**
 * @jest-environment node
 *
 * Guardián: la casa Lite no habla con la API de otra casa.
 *
 * Bug que previene (2026-07-29): el fallback de `VITE_API_BASE_URL` apuntaba a
 * `lacaleta-api.mindloop.cloud`, la API de PRODUCCIÓN de La Nave 5. Había 8
 * copias más del mismo literal repartidas por los módulos legacy, cada una con
 * su propio `?? 'https://lacaleta-api...'`.
 *
 * Si el build de Lite sale sin la variable — y es fácil: en Dokploy las VITE_*
 * van en "Build-time Variables", no en "Environment Settings", y esa confusión
 * ya ocurrió una vez — el frontend de Lite lee y ESCRIBE contra la base de
 * datos de La Nave 5. Sin error y sin aviso: la app funciona, contra el tenant
 * equivocado.
 *
 * Este test es de RAMA: vive en `lite` y afirma que en `lite` no hay literales
 * de otra casa. En `main` el literal correcto es justo el contrario.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const SRC = 'src';

/** Dominios de API de OTRAS casas. Ninguno debe aparecer en el código de Lite. */
const APIS_DE_OTRAS_CASAS = [
    'lacaleta-api.mindloop.cloud',   // producción — La Nave 5
    'staging-api.mindloop.cloud',    // staging
];

/** Rutas donde el nombre puede aparecer legítimamente (prosa, no una URL usada). */
const EXENTOS = [
    join('src', 'config', 'app-config.js'),   // explica por qué NO se usa
    join('src', 'api', 'client.js'),          // menciona el repo backend
    join('src', 'legacy', 'app-core.js'),     // cita una ruta del repo backend
    join('src', '__tests__'),                 // los propios tests
];

function ficherosJs(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        if (e.isDirectory()) return ficherosJs(p);
        return e.isFile() && p.endsWith('.js') ? [p] : [];
    });
}

/** Solo cuenta si es una URL de verdad (con https://), no una mención en prosa. */
function urlsDeOtraCasa(texto) {
    return APIS_DE_OTRAS_CASAS.filter((d) => texto.includes(`https://${d}`));
}

describe('Aislamiento de la casa Lite', () => {
    test('ningún fichero de src/ usa la URL de la API de otra casa', () => {
        const infractores = [];

        for (const fichero of ficherosJs(SRC)) {
            const rel = relative('.', fichero);
            if (EXENTOS.some((ex) => rel.startsWith(ex))) continue;

            for (const dominio of urlsDeOtraCasa(readFileSync(fichero, 'utf8'))) {
                infractores.push(`  ${rel.replace(/\\/g, '/')} → https://${dominio}`);
            }
        }

        if (infractores.length > 0) {
            throw new Error(
                'La rama lite referencia la API de otra casa:\n\n'
                + infractores.join('\n')
                + '\n\nEn la casa Lite la API es https://lite-api.mindloop.cloud.'
                + '\nUna URL cruzada hace que Lite escriba en la BD del otro tenant sin dar error.'
            );
        }
    });

    test('el fallback de la API en app-config apunta a la casa Lite', () => {
        const cfg = readFileSync('src/config/app-config.js', 'utf8');
        expect(cfg).toMatch(/const API_DE_ESTA_CASA = 'https:\/\/lite-api\.mindloop\.cloud'/);
    });

    test('la CSP de nginx permite la API de la casa Lite', () => {
        const nginx = readFileSync('nginx.conf', 'utf8');
        const connectSrc = nginx.match(/connect-src[^;]*/);
        expect(connectSrc).not.toBeNull();
        // Sin esto el navegador bloquea TODAS las llamadas del front Lite a su API.
        expect(connectSrc[0]).toContain('https://lite-api.mindloop.cloud');
    });

    test('el chat no cae por defecto en el webhook n8n cerrado', () => {
        const cfg = readFileSync('src/config/app-config.js', 'utf8');
        // Solo un "n8n" explícito debe elegir el webhook; el resto → claude.
        expect(cfg).toMatch(/VITE_CHAT_BACKEND === 'n8n' \? 'n8n' : 'claude'/);
    });
});
