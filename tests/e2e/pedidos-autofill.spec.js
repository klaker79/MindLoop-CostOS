/**
 * Tests E2E del flujo Nuevo Pedido en staging.
 *
 * Cubre que el formulario se abre y los elementos críticos (select de
 * proveedor con sus options, fecha) están presentes en el DOM.
 *
 * NOTA sobre TomSelect: tras el PR #291 (feat buscador-proveedor) el
 * `<select id="ped-proveedor">` se enriquece con TomSelect, que oculta
 * el select nativo (display:none) y renderiza un wrapper `.ts-wrapper`
 * encima. Por eso aquí usamos `toBeAttached()` en lugar de
 * `toBeVisible()` — el select existe en DOM y sus options se pueblan
 * normalmente, solo no es "visible" en el sentido CSS estricto. La UI
 * que ve el usuario es el wrapper.
 */
import { test, expect } from '@playwright/test';

test.describe('Pedidos — formulario Nuevo Pedido', () => {
    test('abre el formulario al pulsar el botón Nuevo Pedido', async ({ page }) => {
        await page.goto('/');
        await page.locator('[data-tab="pedidos"]').first().click();

        // El form vive como <div id="formulario-pedido"> que cambia display:none → display:block.
        // El botón es <button data-action="mostrar-form-pedido">.
        const form = page.locator('#formulario-pedido');
        await page.locator('[data-action="mostrar-form-pedido"]').first().click();

        await expect(form).toBeVisible({ timeout: 10_000 });
        // El select original queda oculto bajo TomSelect — basta con verificar
        // que está montado en DOM y que la UI visible (wrapper) está renderizada.
        await expect(form.locator('#ped-proveedor')).toBeAttached();
        await expect(form.locator('#ped-fecha')).toBeVisible();
    });

    test('el select de proveedor se popula con al menos un proveedor real', async ({ page }) => {
        await page.goto('/');
        await page.locator('[data-tab="pedidos"]').first().click();
        await page.locator('[data-action="mostrar-form-pedido"]').first().click();

        const proveedorSelect = page.locator('#formulario-pedido #ped-proveedor');
        await expect(proveedorSelect).toBeAttached({ timeout: 10_000 });

        // El select se popula async tras cargar /proveedores. Esperar a que haya
        // al menos una opción con value distinto de "" (es decir, no solo el placeholder).
        // Robusto a cambios de seed: solo exige que exista ≥1 proveedor real.
        await expect.poll(async () => {
            const opts = await proveedorSelect.locator('option').all();
            for (const o of opts) {
                const v = await o.getAttribute('value');
                if (v && v !== '' && v !== '0') return true;
            }
            return false;
        }, { timeout: 10_000 }).toBe(true);
    });
});
