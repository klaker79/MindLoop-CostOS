/**
 * Tests defensivos del bloque "IVA del albarán" en el modal de recepción
 * de pedido (Migration 013, 2026-06-06).
 *
 * Reglas críticas:
 *   - El IVA del albarán es SOLO display. NO se envía al backend.
 *   - NO afecta a precio_medio_compra, food cost, COGS, ni a ninguna
 *     fórmula crítica.
 *   - El proveedor puede tener iva_pct configurado (autorelleno) o null.
 *   - Total con IVA = totalRecibido × (1 + iva/100). Clamp 0-100.
 *
 * Sin estos tests, alguien podría:
 *   - Hacer que el IVA se sume al precio_unitario al confirmar la recepción
 *     (catastrófico: food cost mentiría).
 *   - Romper el cálculo del total con IVA (cuadre roto con el albarán).
 *   - Eliminar el clamp y permitir un IVA negativo o > 100.
 */

import { jest } from '@jest/globals';

// Mock cm/helpers para no arrastrar la cadena de imports que lleva a
// `import.meta.env` (constants.js) — Jest no resuelve esa sintaxis ESM
// sin transformer adicional. El test solo necesita un cm() simple que
// produzca un string con el número detectable por regex.
jest.unstable_mockModule('../../src/utils/helpers.js', () => ({
    cm: (n) => `${Number(n).toFixed(2)} €`,
    getDateLocale: () => 'es-ES',
    escapeHTML: (s) => String(s ?? ''),
    formatQuantity: (n) => String(n ?? '')
}));

// Mock i18n (también transitivo) para evitar inicialización completa.
jest.unstable_mockModule('@/i18n/index.js', () => ({ t: (k) => k }));

// Mock store de ingredientes — no se usa en estos tests.
jest.unstable_mockModule('../../src/stores/ingredientStore.js', () => ({
    default: { getState: () => ({}) }
}));

// Dynamic import tras los mocks (patrón ESM Jest).
let actualizarTotalConIva;
beforeAll(async () => {
    ({ actualizarTotalConIva } = await import('../../src/modules/pedidos/pedidos-recepcion.js'));
});

// Helper: monta el DOM mínimo del modal de recepción para los tests.
function setupModalDOM(totalRecibidoStr = '0,00 €') {
    document.body.innerHTML = `
        <div id="modal-recibir-pedido">
            <span id="modal-rec-resumen-recibido">${totalRecibidoStr}</span>
            <input type="number" id="modal-rec-iva-pct" value="">
            <span id="modal-rec-resumen-con-iva">0.00 €</span>
        </div>
    `;
}

describe('actualizarTotalConIva — cálculo de display', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    test('sin IVA (input vacío) → total con IVA = total recibido', () => {
        setupModalDOM('100,00 €');
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        expect(out).toMatch(/100/);
    });

    test('IVA 10% sobre 100 → 110', () => {
        setupModalDOM('100,00 €');
        document.getElementById('modal-rec-iva-pct').value = '10';
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        expect(out).toMatch(/110/);
    });

    test('IVA 21% sobre 1000 → 1210', () => {
        setupModalDOM('1000,00 €');
        document.getElementById('modal-rec-iva-pct').value = '21';
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        // Aceptamos formato 1.210 o 1210 (separador miles según locale)
        expect(out.replace(/[^\d]/g, '')).toContain('121000');
    });

    test('IVA negativo se clampa a 0 (no resta del total)', () => {
        setupModalDOM('100,00 €');
        document.getElementById('modal-rec-iva-pct').value = '-50';
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        expect(out).toMatch(/100/);
    });

    test('IVA > 100 se clampa a 100 (no permite duplicar mucho)', () => {
        setupModalDOM('50,00 €');
        document.getElementById('modal-rec-iva-pct').value = '999';
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        // 50 × 2 = 100
        expect(out).toMatch(/100/);
    });

    test('IVA decimal (10.5%) sobre 200 → 221', () => {
        setupModalDOM('200,00 €');
        document.getElementById('modal-rec-iva-pct').value = '10.5';
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        expect(out).toMatch(/221/);
    });

    test('si no hay span de salida, no rompe (DOM mínimo)', () => {
        document.body.innerHTML = '<input id="modal-rec-iva-pct" value="10">';
        expect(() => actualizarTotalConIva()).not.toThrow();
    });

    test('total recibido con separador de miles (cm format) se lee bien', () => {
        // Algunos locales muestran "1.234,56" — el parser debe llegar a 1234.56
        setupModalDOM('1.234,56 €');
        document.getElementById('modal-rec-iva-pct').value = '0';
        actualizarTotalConIva();
        const out = document.getElementById('modal-rec-resumen-con-iva').textContent;
        // 1.234,56 sin IVA — comprobamos que NO se interpretó como "1.23456"
        expect(out.replace(/[^\d]/g, '')).toContain('123456');
    });
});

describe('IVA del albarán — NO debe contaminar el body que se envía al backend', () => {
    /**
     * Test de invariante: el endpoint PUT /api/orders/:id NO debe recibir
     * el campo iva_pct ni un total_con_iva. El IVA es solo display.
     *
     * Como no podemos espiar fetch directamente sin levantar todo el módulo,
     * verificamos que la función actualizarTotalConIva no muta el DOM más
     * allá del span de salida.
     */
    afterEach(() => { document.body.innerHTML = ''; });

    test('actualizarTotalConIva no toca el span de Total Recibido (no contamina)', () => {
        setupModalDOM('100,00 €');
        document.getElementById('modal-rec-iva-pct').value = '21';
        actualizarTotalConIva();
        const totalRec = document.getElementById('modal-rec-resumen-recibido').textContent;
        // Debe seguir mostrando 100 (no 121).
        expect(totalRec).toMatch(/100/);
    });

    test('actualizarTotalConIva no muta el valor del input IVA', () => {
        setupModalDOM('100,00 €');
        const inp = document.getElementById('modal-rec-iva-pct');
        inp.value = '21';
        actualizarTotalConIva();
        expect(inp.value).toBe('21');
    });
});
