/**
 * E2E del flujo del botón "📊 Informe" del chat-widget.
 *
 * Cubre:
 *   1. El botón aparece en el header del chat cuando chat_addon=true
 *   2. Click → popover con 6 opciones de mes (curso + 5 cerrados)
 *   3. Click en una opción → fetch al endpoint + nueva pestaña con HTML
 *
 * Stub del endpoint /api/chat/informe-mensual/html para NO gastar tokens
 * Claude en cada run. Verificamos que el frontend lo invoca correctamente
 * y maneja la respuesta — no la calidad del HTML real (que ya tienen unit
 * tests + snapshots en backend).
 *
 * Si chat_addon NO está activo en el tenant de staging, el botón no
 * aparece y los tests se skip-ean automáticamente (test.skip dinámico).
 */
import { test, expect } from '@playwright/test';

const STUB_HTML = `<!DOCTYPE html>
<html><head><title>Informe Stub</title></head>
<body><h1 id="informe-test-ok">Informe stub OK</h1></body></html>`;

test.describe('Chat — botón Informe del mes', () => {
    test.beforeEach(async ({ page }) => {
        // Stub: cualquier request al endpoint del informe → HTML mínimo.
        // Evita gastar tokens Anthropic en cada run de CI nightly.
        await page.route('**/api/chat/informe-mensual/html*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: STUB_HTML
            });
        });
    });

    test('el botón "Informe" aparece en el header del chat', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // El FAB del chat solo monta si chat_addon=true para el tenant.
        // Si no aparece en 5s, skip (tenant de staging sin add-on activo).
        const fab = page.locator('#chat-fab');
        const fabVisible = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
        test.skip(!fabVisible, 'chat-fab no presente — tenant sin chat_addon activado');

        await fab.click();
        const informeBtn = page.locator('#chat-informe');
        await expect(informeBtn).toBeVisible({ timeout: 5_000 });
        await expect(informeBtn).toHaveText(/Informe/i);
    });

    test('click en el botón abre popover con 6 opciones de mes', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const fab = page.locator('#chat-fab');
        const fabVisible = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
        test.skip(!fabVisible, 'chat-fab no presente');

        await fab.click();
        await page.locator('#chat-informe').click();

        const menu = page.locator('#chat-informe-menu');
        await expect(menu).toBeVisible();

        const items = menu.locator('.chat-informe-menu-item');
        await expect(items).toHaveCount(6);

        // El primero es "Mes en curso", el segundo lleva "Recién cerrado"
        await expect(items.first().locator('.chat-informe-menu-label'))
            .toContainText(/curso|current/i);
        await expect(items.nth(1).locator('.chat-informe-menu-sub'))
            .toContainText(/recién cerrado|just closed/i);
    });

    test('seleccionar un mes abre pestaña nueva con el HTML del informe', async ({ page, context }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const fab = page.locator('#chat-fab');
        const fabVisible = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
        test.skip(!fabVisible, 'chat-fab no presente');

        await fab.click();
        await page.locator('#chat-informe').click();

        // Esperamos a que se abra una página nueva al hacer click en el item
        const newPagePromise = context.waitForEvent('page', { timeout: 15_000 });
        // Click en "Mes en curso" (el primero) — más rápido que esperar 5 meses cerrados
        await page.locator('#chat-informe-menu-item, .chat-informe-menu-item').first().click();

        const newPage = await newPagePromise;
        await newPage.waitForLoadState('domcontentloaded', { timeout: 10_000 });

        // El stub devolvió HTML con #informe-test-ok
        await expect(newPage.locator('#informe-test-ok')).toBeVisible();
        await newPage.close();
    });

    test('click fuera del popover lo cierra', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const fab = page.locator('#chat-fab');
        const fabVisible = await fab.isVisible({ timeout: 5_000 }).catch(() => false);
        test.skip(!fabVisible, 'chat-fab no presente');

        await fab.click();
        await page.locator('#chat-informe').click();

        const menu = page.locator('#chat-informe-menu');
        await expect(menu).toBeVisible();

        // Click en un área neutra (cuerpo del chat-messages) — fuera del popover
        await page.locator('#chat-messages').click({ position: { x: 50, y: 50 } });
        await expect(menu).not.toBeVisible({ timeout: 3_000 });
    });
});
