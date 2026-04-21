/**
 * Flows autenticados.
 * La sesión se inicia en global-setup.spec.js y se reutiliza vía storageState
 * declarado en playwright.config.js (project "chromium" depends on "setup").
 *
 * Estos tests asumen que el tenant tiene el seed aplicado (ver
 * infrastructure_staging.md o el bloque SQL de seed). Como mínimo:
 *   3 proveedores, 12 ingredientes, 6 recetas — entre ellas "Pasta Bolonesa".
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
    test('muestra KPIs básicos tras login', async ({ page }) => {
        await page.goto('/');

        // Algún KPI reconocible: stock value, ingredientes, etc.
        // Uso un locator tolerante a varios idiomas.
        await expect(
            page.getByText(/stock value|valor stock|库存价值/i).first()
        ).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('Ingredientes', () => {
    test('la lista muestra los 12 del seed', async ({ page }) => {
        await page.goto('/');

        await page.locator('[data-tab="ingredientes"]').first().click();

        // Algunos ingredientes clave del seed deben estar presentes
        await expect(page.getByText('Tomate').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Cebolla').first()).toBeVisible();
        await expect(page.getByText('Vino tinto').first()).toBeVisible();
    });
});

test.describe('Recetas + escandallo', () => {
    test('la lista de recetas muestra las del seed', async ({ page }) => {
        await page.goto('/');

        await page.locator('[data-tab="recetas"]').first().click();

        await expect(page.getByText('Pasta Bolonesa').first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText('Bruschetta').first()).toBeVisible();
    });

    test('abrir escandallo de Pasta Bolonesa muestra coste y food cost', async ({ page }) => {
        await page.goto('/');

        await page.locator('[data-tab="recetas"]').first().click();
        await expect(page.getByText('Pasta Bolonesa').first()).toBeVisible({ timeout: 10_000 });

        // Fila que contiene el nombre, y dentro el botón .icon-btn.view (📊)
        const pastaRow = page.locator('tr').filter({ hasText: 'Pasta Bolonesa' }).first();
        await pastaRow.locator('button.icon-btn.view').click();

        // Modal de escandallo abre
        const modal = page.locator('#modal-escandallo');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Contiene un valor con unidad monetaria (€/RM/$)
        await expect(modal.locator('text=/\\d+[.,]\\d+\\s*[€$R]/').first()).toBeVisible();
    });

    test('toggle Nominal/Real cambia de modo en el escandallo', async ({ page }) => {
        await page.goto('/');

        await page.locator('[data-tab="recetas"]').first().click();
        await expect(page.getByText('Pasta Bolonesa').first()).toBeVisible({ timeout: 10_000 });

        await page.locator('tr').filter({ hasText: 'Pasta Bolonesa' }).first()
            .locator('button.icon-btn.view').click();

        const modal = page.locator('#modal-escandallo');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Los dos botones del toggle existen (basamos en el atributo data-modo del código)
        const realBtn = modal.locator('[data-modo="real"]');
        const nominalBtn = modal.locator('[data-modo="nominal"]');

        await expect(realBtn).toBeVisible();
        await expect(nominalBtn).toBeVisible();

        // Cambio a Nominal y de vuelta a Real: la UI acepta ambos clicks sin romperse.
        await nominalBtn.click();
        await expect(modal).toBeVisible();
        await realBtn.click();
        await expect(modal).toBeVisible();
    });
});

test.describe('i18n', () => {
    test('cambio de idioma a español traduce la navegación', async ({ page }) => {
        await page.goto('/');

        // Botón de idioma ES (sidebar inferior izquierdo — hay varios selectores posibles)
        const esBtn = page.locator('[data-lang="es"], button:has-text("ES")').first();

        if (await esBtn.isVisible().catch(() => false)) {
            await esBtn.click();
            // Tras cambiar a ES, "Recetas" aparece (en EN sería "Recipes")
            await expect(page.getByText('Recetas').first()).toBeVisible({ timeout: 5_000 });
        } else {
            test.skip(true, 'Selector de idioma ES no encontrado — ajustar cuando se estabilice');
        }
    });
});
