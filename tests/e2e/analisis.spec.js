/**
 * E2E del módulo Análisis (Ingeniería de Menú + Principios de Omnes).
 *
 * La sesión se inicia en global-setup. Estos tests asumen que el tenant
 * de staging (Demo Trattoria KL) tiene al menos:
 *   - 2-3 recetas activas con ventas suficientes para que /menu-engineering
 *     devuelva datos y la matriz BCG pinte algo.
 *   - precios coherentes para que /analysis/omnes devuelva los 3 cálculos.
 *
 * Si el seed staging se vacía y los tests fallan, no es un bug del módulo —
 * es seed insuficiente. Reseedear y reintentar.
 */
import { test, expect } from '@playwright/test';

test.describe('Análisis · Matriz BCG y Omnes', () => {
    test('la pestaña Análisis carga con título BCG y bloque Omnes', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-tab="analisis"]').first().click();

        // Dashboard sintético (4 cards categoría) — primera línea del módulo
        await expect(page.locator('#analisis-dashboard-sintetico')).toBeVisible({ timeout: 15_000 });

        // Matriz BCG v2 — título visible
        await expect(page.locator('#analisis-matriz-bcg-v2')).toBeVisible();
        await expect(page.getByText(/Matriz BCG/i).first()).toBeVisible();

        // Bloque Omnes
        await expect(page.locator('#analisis-omnes')).toBeVisible();
        await expect(page.getByText(/Principios de Omnes/i).first()).toBeVisible();
    });

    test('cambiar el periodo recarga BCG y Omnes', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-tab="analisis"]').first().click();

        await expect(page.locator('#analisis-omnes')).toBeVisible({ timeout: 15_000 });

        // Filtro periodo del dashboard sintético — buscar botón "Mes"
        const mesBtn = page.locator('.ans-periodo-btn').filter({ hasText: /^Mes$/i }).first();
        if (await mesBtn.count() > 0) {
            await mesBtn.click();
            // El módulo debería repintar — esperar a que el bloque siga visible
            await expect(page.locator('#analisis-omnes')).toBeVisible();
        }
    });

    test('el botón "¿Qué es esto?" de Omnes abre el modal explicativo', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-tab="analisis"]').first().click();

        await expect(page.locator('#analisis-omnes')).toBeVisible({ timeout: 15_000 });

        // Botón dentro del bloque Omnes
        await page.locator('#analisis-omnes').getByRole('button', { name: /qué es esto/i }).click();

        // El modal aparece con título
        await expect(page.locator('#omnes-info-modal')).toBeVisible();
        await expect(page.getByText(/Principios de Omnes/i).first()).toBeVisible();

        // Cierra con el botón "Entendido"
        await page.locator('#omnes-info-modal').getByRole('button', { name: /entendido/i }).click();
        await expect(page.locator('#omnes-info-modal')).toBeHidden();
    });

    test('el botón "¿Qué es esto?" de la Matriz BCG abre su modal explicativo', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-tab="analisis"]').first().click();

        await expect(page.locator('#analisis-matriz-bcg-v2')).toBeVisible({ timeout: 15_000 });

        await page.locator('#analisis-matriz-bcg-v2').getByRole('button', { name: /qué es esto/i }).click();

        await expect(page.locator('#bcg-info-modal')).toBeVisible();
        // El modal debe contener al menos las 4 categorías
        const modal = page.locator('#bcg-info-modal');
        await expect(modal.getByText(/Estrellas/i).first()).toBeVisible();
        await expect(modal.getByText(/Puzzles/i).first()).toBeVisible();
        await expect(modal.getByText(/Caballos/i).first()).toBeVisible();
        await expect(modal.getByText(/Perros/i).first()).toBeVisible();

        await modal.getByRole('button', { name: /entendido/i }).click();
        await expect(page.locator('#bcg-info-modal')).toBeHidden();
    });

    test('click en un plato del BCG abre el modal drill-down con Coach IA', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-tab="analisis"]').first().click();

        await expect(page.locator('#analisis-matriz-bcg-v2')).toBeVisible({ timeout: 15_000 });

        // Buscar el primer plato clicable en cualquier cuadrante
        const primerPlato = page.locator('.bcg2-item[data-plato-id]').first();
        const hayPlatos = await primerPlato.count();
        test.skip(hayPlatos === 0, 'No hay platos en la matriz BCG (seed vacío)');

        await primerPlato.click();

        // El modal drill-down (apm-) aparece
        await expect(page.locator('#plato-modal, [class*="apm-"]').first()).toBeVisible({ timeout: 5_000 });

        // Debería tener el botón Coach IA
        await expect(page.getByRole('button', { name: /coach/i }).first()).toBeVisible();
    });

    test('las cards de Omnes muestran su tip de consejo cuando hay datos', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-tab="analisis"]').first().click();

        const omnes = page.locator('#analisis-omnes');
        await expect(omnes).toBeVisible({ timeout: 15_000 });

        // Esperar al render (cards reemplazan al skeleton)
        await expect(omnes.locator('.oms-card').first()).toBeVisible();

        // Al menos una card debería tener un tip — buscar el bloque oms-tip
        const tips = omnes.locator('.oms-tip');
        await expect(tips.first()).toBeVisible();
    });
});
