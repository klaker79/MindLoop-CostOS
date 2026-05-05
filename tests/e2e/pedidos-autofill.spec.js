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

    test('el select de proveedor tiene al menos las opciones del seed', async ({ page }) => {
        await page.goto('/');
        await page.locator('[data-tab="pedidos"]').first().click();
        await page.locator('[data-action="mostrar-form-pedido"]').first().click();

        const proveedorSelect = page.locator('#formulario-pedido #ped-proveedor');
        await expect(proveedorSelect).toBeVisible({ timeout: 10_000 });

        // El seed de Demo Trattoria KL tiene 3 proveedores + el placeholder = 4 opciones mínimas
        const optCount = await proveedorSelect.locator('option').count();
        expect(optCount).toBeGreaterThanOrEqual(4);
    });
});
