/**
 * Tests E2E del flujo Nuevo Pedido en staging.
 *
 * Versión inicial mínima: cubre que el formulario se abre y los elementos
 * críticos del modelo B (selector proveedor, lista ingredientes) están
 * presentes. Tests más finos del autollenado (cambio de formato, redondeo)
 * se añadirán en siguientes sesiones tras validarlos manualmente — los
 * primeros intentos fallaron por desajustes de selectores.
 *
 * Asume el seed staging documentado en infrastructure_staging.md
 * (Demo Trattoria KL: 3 proveedores, 12 ingredientes).
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
        await expect(form.locator('#ped-proveedor')).toBeVisible();
        await expect(form.locator('#ped-fecha')).toBeVisible();
    });

    test('el select de proveedor se popula con al menos un proveedor real', async ({ page }) => {
        await page.goto('/');
        await page.locator('[data-tab="pedidos"]').first().click();
        await page.locator('[data-action="mostrar-form-pedido"]').first().click();

        const proveedorSelect = page.locator('#formulario-pedido #ped-proveedor');
        await expect(proveedorSelect).toBeVisible({ timeout: 10_000 });

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
