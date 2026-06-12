/**
 * 🛡️ GUARDIA ANTI-DRIFT — precio canónico (auditoría 2026-06-12).
 *
 * Regla de CLAUDE.md: TODO cálculo de precio/coste usa getIngredientUnitPrice()
 * de src/utils/cost-calculator.js. Leer `precio_medio_compra` a mano en un
 * módulo es la firma del anti-patrón que rompió la consistencia entre pestañas
 * (incidentes Cost Tracker/Balance cerrados en la auditoría).
 *
 * Este test escanea src/modules + src/stores (sin comentarios) y FALLA si
 * aparece una lectura de `precio_medio_compra` fuera de la whitelist.
 *
 * Si tu PR rompe este test: NO añadas tu archivo a la whitelist — usa
 * getIngredientUnitPrice(invItem, ing). La whitelist es solo para las
 * excepciones documentadas que replican la cascada por motivos históricos.
 */
import fs from 'fs';
import path from 'path';

const ROOTS = ['src/modules', 'src/stores'];

// Excepciones DOCUMENTADAS (cada una con su porqué):
const WHITELIST = new Set([
    // Réplica inline de la cascada canónica (equivalente verificado en auditoría
    // 2026-06-12; candidata a refactor de 1 línea, no a copiar como patrón).
    'src/modules/inventario/recuento.js',
    // Texto del manual del usuario (HTML estático, no es código de cálculo).
    'src/modules/docs/dossier-v24.js',
]);

function stripComments(src) {
    return src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else if (entry.name.endsWith('.js')) out.push(p);
    }
    return out;
}

test('🛡️ ningún módulo lee precio_medio_compra fuera de la whitelist', () => {
    const offenders = [];
    for (const root of ROOTS) {
        for (const file of walk(root)) {
            const rel = file.split(path.sep).join('/');
            if (WHITELIST.has(rel)) continue;
            const code = stripComments(fs.readFileSync(file, 'utf8'));
            if (code.includes('precio_medio_compra')) {
                const line = code.split('\n').findIndex(l => l.includes('precio_medio_compra')) + 1;
                offenders.push(`${rel} (≈línea ${line} sin comentarios)`);
            }
        }
    }
    if (offenders.length > 0) {
        throw new Error(
            'Lectura directa de precio_medio_compra detectada (usa getIngredientUnitPrice):\n  - ' +
            offenders.join('\n  - ')
        );
    }
});

test('🛡️ la whitelist no acumula entradas muertas', () => {
    for (const rel of WHITELIST) {
        expect(fs.existsSync(rel)).toBe(true);
        const code = stripComments(fs.readFileSync(rel, 'utf8'));
        expect(code.includes('precio_medio_compra')).toBe(true);
    }
});
