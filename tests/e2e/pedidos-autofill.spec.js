/**
 * Tests E2E del flujo Nuevo Pedido en staging.
 *
 * Cubre que el formulario se abre y los elementos críticos (select de
 * proveedor con sus options, fecha) están presentes en el DOM.
 *
 * NOTA sobre TomSelect: tras el PR #291 (feat buscador-proveedor) el
 * `<select id="ped-proveedor">` se enriquece con TomSelect, que oculta
 * el select nativo (display:none) y MUEVE las <option> a su propio
 * dropdown `.ts-wrapper`. Por eso aquí:
 *   - usamos `toBeAttached()` en lugar de `toBeVisible()` para el select
 *     (existe pero está display:none),
 *   - validamos la población de proveedores contra `window.proveedores`
 *     (estado global del frontend) en lugar de inspeccionar `option`
 *     dentro del select — TomSelect ya las movió y el select queda vacío
 *     en cuanto inicializa, lo que rompía el test de forma intermitente
 *     según el orden carga-proveedores ↔ init-tomselect.
 */
import { test, expect } from '@playwright/test';

test.describe('Pedidos — formulario Nuevo Pedido', () => {
    test('abre el formulario al pulsar el botón Nuevo Pedido', async ({ page }) => {
        await page.goto('/');
        // Esperar a que la SPA termine la carga inicial (auth + datos + plan).
        // Sin esto, en runs lentos el click al tab Pedidos llega antes de que
        // los handlers estén bindeados.
        await page.waitForLoadState('networkidle');

        await page.locator('[data-tab="pedidos"]').first().click();

        const form = page.locator('#formulario-pedido');
        await page.locator('[data-action="mostrar-form-pedido"]').first().click();

        await expect(form).toBeVisible({ timeout: 15_000 });
        await expect(form.locator('#ped-proveedor')).toBeAttached();
        await expect(form.locator('#ped-fecha')).toBeVisible();
    });

    test('el select de proveedor se popula con al menos un proveedor real', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await page.locator('[data-tab="pedidos"]').first().click();
        await page.locator('[data-action="mostrar-form-pedido"]').first().click();

        // El select sigue en DOM pero TomSelect ya movió sus <option> al wrapper,
        // por lo que `proveedorSelect.locator('option')` puede salir vacío. La
        // verdad funcional vive en el estado global `window.proveedores` que
        // pueblan tanto app-core.js como supplierStore.js tras /proveedores.
        await expect.poll(async () => {
            return await page.evaluate(() =>
                Array.isArray(window.proveedores) && window.proveedores.length > 0
            );
        }, {
            timeout: 15_000,
            message: 'window.proveedores nunca se pobló — staging sin seed o /proveedores caído',
        }).toBe(true);
    });
});
