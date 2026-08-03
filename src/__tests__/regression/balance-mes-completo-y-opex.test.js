/**
 * @jest-environment node
 *
 * 🛡️ REGRESIÓN — La pestaña Balance mentía por dos motivos a la vez (2026-08-03).
 *
 * ── BUG 1: mostraba UN DÍA como si fuera el mes ──────────────────────────────
 * `balance/index.js` llamaba a `api.getSales(inicioMes)` creyendo que `fecha`
 * significaba "desde". Pero la ruta hace `AND DATE(v.fecha) = $n`: igualdad
 * EXACTA de día. Balance recibía solo las ventas del día 1 y las pintaba como
 * el mes entero. El filtro cliente (`>= inicioMes`) no lo salvaba: ya solo le
 * había llegado el día 1.
 *   La Nave 5, julio 2026:  3.884,70 €  en vez de  134.604,30 €  (2,9%).
 * FIX: `getSalesRango(desde, hasta)`, que usa los parámetros `desde`/`hasta`.
 *
 * ── BUG 2: sumaba IVA e IRPF al gasto de explotación ─────────────────────────
 * Usaba `calcularTotalGastosFijos`, que suma TODOS los conceptos. El IVA se
 * cobra al cliente y se devuelve; el IRPF se paga sobre el beneficio ya
 * obtenido. Ninguno es coste de explotación.
 *   La Nave 5:  70.983,04 €  en vez de  45.513,58 €  → 25.469,46 €/mes de más,
 *   hundiendo el beneficio neto y disparando el umbral de rentabilidad.
 * FIX: `calcularGastosFijosOperativos`, la MISMA regla que ya usan el Diario y
 * el Punto de Equilibrio — así las tres pantallas cuadran entre sí.
 *
 * Se comprueba sobre el TEXTO porque `modales.js` se carga como <script> plano
 * (index.html, sin type="module") y `balance/index.js` depende de `window`.
 */

import { readFileSync } from 'fs';

const balance = readFileSync('src/modules/balance/index.js', 'utf8');
const client = readFileSync('src/api/client.js', 'utf8');
const modales = readFileSync('src/legacy/modales.js', 'utf8');
const indexHtml = readFileSync('index.html', 'utf8');

describe('Balance — mes completo y gastos de explotación', () => {
    it('1. Balance pide un RANGO, no un día suelto', () => {
        expect(balance).toMatch(/getSalesRango\s*\(/);
        // El bug era exactamente esta llamada: getSales(<día 1 del mes>).
        expect(balance).not.toMatch(/api\.getSales\s*\(\s*inicioMes\s*\)/);
    });

    it('2. el rango va del día 1 al día 1 del mes siguiente', () => {
        expect(balance).toMatch(/inicioMesSiguiente/);
        expect(balance).toMatch(/getSalesRango\s*\(\s*inicioMes\s*,\s*inicioMesSiguiente\s*\)/);
    });

    it('3. el cliente API expone getSalesRango con desde/hasta', () => {
        const fn = client.match(/getSalesRango\s*:\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s{4}\}/);
        expect(fn).not.toBeNull();
        expect(fn[0]).toMatch(/desde=/);
        expect(fn[0]).toMatch(/hasta=/);
    });

    it('4. Balance usa los gastos OPERATIVOS, no el total con IVA/IRPF', () => {
        expect(balance).toMatch(/window\.calcularGastosFijosOperativos/);
        // El opex que alimenta beneficio neto y break-even debe salir de la
        // función operativa; `calcularTotalGastosFijos` solo puede quedar como
        // fallback defensivo, nunca como la vía principal.
        // \r?\n: el fichero está en CRLF.
        const bloque = balance.match(/const\s+opexTotal\s*=[\s\S]{0,600}?;\r?\n/);
        expect(bloque).not.toBeNull();
        const posOperativos = bloque[0].indexOf('calcularGastosFijosOperativos');
        const posTotal = bloque[0].indexOf('calcularTotalGastosFijos');
        expect(posOperativos).toBeGreaterThanOrEqual(0);
        if (posTotal >= 0) expect(posOperativos).toBeLessThan(posTotal);
    });

    it('5. calcularGastosFijosOperativos existe y es alcanzable desde window', () => {
        // Declaración de primer nivel en un <script> clásico → queda en window.
        expect(modales).toMatch(/^async function calcularGastosFijosOperativos\s*\(/m);
        const tag = indexHtml.match(/<script[^>]*src="[^"]*legacy\/modales\.js[^"]*"[^>]*>/);
        expect(tag).not.toBeNull();
        // Si algún día pasa a type="module", las funciones dejan de ser globales
        // y este fix se rompe en silencio. Que el test avise.
        expect(tag[0]).not.toMatch(/type\s*=\s*["']module["']/);
    });

    it('6. calcularGastosFijosOperativos filtra impuestos no operativos', () => {
        const fn = modales.match(/async function calcularGastosFijosOperativos[\s\S]*?\n\}/);
        expect(fn).not.toBeNull();
        // Delega en la regla compartida con el Diario y el Punto de Equilibrio.
        expect(fn[0]).toMatch(/mlSumaGastosOperativos/);
    });
});
