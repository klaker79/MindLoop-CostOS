/**
 * @jest-environment node
 *
 * 🛡️ REGRESIÓN — el ajuste de recuento NO es merma del día en el P&L Diario.
 *
 * Incidente en PRODUCCIÓN (La Nave 5, 2026-08-03).
 *
 * Desde que el recuento físico se espeja en `mermas` (lacaleta-api
 * `inventory.routes.js`, PR #449/#859), esa tabla mezcla DOS cosas que no se
 * pueden sumar igual:
 *   a) MERMA REAL del día (caducado, rotura, error de cocina) → sí es coste
 *   b) AJUSTE DE RECUENTO → deriva ACUMULADA de semanas que aflora entera el
 *      día que se cuenta
 *
 * El P&L Diario sumaba las dos. El recuento del 2 de agosto metió
 * **8.977,53 €** de "merma" en un solo día (propano 3.477 €, barriles de
 * cerveza 1.234 € y 1.183 €, girasol 483 €…), dejando el beneficio neto de ese
 * día en **−10.445,71 €** y reventando la tabla.
 *
 * El ajuste se sigue guardando y se ve en la pestaña Mermas y en el panel de
 * diferencia de inventario, que es donde tiene sentido. Lo que ya no hace es
 * fingir que ese dinero se perdió ese día.
 *
 * Se comprueba sobre el TEXTO del fichero porque `inventario-masivo.js` se
 * carga como <script> plano —sin import/export, ver src/main.js:208— y no se
 * puede importar desde Jest.
 */

import { readFileSync } from 'fs';

const src = readFileSync('src/legacy/inventario-masivo.js', 'utf8');

describe('P&L Diario — los ajustes de recuento no cuentan como merma del día', () => {
    it('define el helper esAjusteDeRecuento', () => {
        expect(src).toMatch(/function\s+esAjusteDeRecuento\s*\(/);
    });

    it('cubre los DOS motivos que genera el flujo de recuento', () => {
        // 'Error de Inventario'  → default del recuento manual (app-core.js)
        // 'Ajuste de inventario' → subida de inventario físico por Excel
        const lista = src.match(/MOTIVOS_AJUSTE_RECUENTO\s*=\s*\[([^\]]*)\]/);
        expect(lista).not.toBeNull();
        const contenido = lista[1].toLowerCase();
        expect(contenido).toContain('error de inventario');
        expect(contenido).toContain('ajuste de inventario');
    });

    it('aplica el filtro al construir mermasPorDia', () => {
        // El guard debe estar ANTES de acumular el valor en el día.
        const bloque = src.match(/const\s+mermasPorDia\s*=\s*\{\}[\s\S]{0,1600}?mermasPorDia\[fecha\]\s*\+=/);
        expect(bloque).not.toBeNull();
        expect(bloque[0]).toMatch(/esAjusteDeRecuento\s*\(\s*m\.motivo\s*\)/);
    });

    it('el helper se comporta bien (se evalúa de verdad, no es solo un grep)', () => {
        const lista = src.match(/const\s+MOTIVOS_AJUSTE_RECUENTO\s*=\s*\[[^\]]*\];/)[0];
        const fn = src.match(/function\s+esAjusteDeRecuento\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)[0];
        const esAjuste = new Function(`${lista}\n${fn}\nreturn esAjusteDeRecuento;`)();

        // Ajustes de recuento → FUERA del P&L
        expect(esAjuste('Error de Inventario')).toBe(true);
        expect(esAjuste('Ajuste de inventario')).toBe(true);
        // La BD guarda el motivo tal cual lo manda el front: normalizar importa.
        expect(esAjuste('  ERROR DE INVENTARIO  ')).toBe(true);

        // Mermas reales → siguen contando como coste del día
        expect(esAjuste('Caducado')).toBe(false);
        expect(esAjuste('Caduco')).toBe(false);
        expect(esAjuste('Accidente')).toBe(false);
        expect(esAjuste('rotura cadena de frío')).toBe(false);
        expect(esAjuste('Error Cocina')).toBe(false);
        expect(esAjuste('deterioro')).toBe(false);
        expect(esAjuste('error de preparación')).toBe(false);
        expect(esAjuste('')).toBe(false);
        expect(esAjuste(null)).toBe(false);
        expect(esAjuste(undefined)).toBe(false);
    });
});
