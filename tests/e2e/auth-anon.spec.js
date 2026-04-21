/**
 * Tests de login sin sesión previa.
 * Arranca sin storageState — cada test parte de una página limpia.
 */
import { test, expect } from '@playwright/test';

test.describe('Auth (anónimo)', () => {
    test('password incorrecta muestra mensaje de error', async ({ page }) => {
        const email = process.env.STAGING_TEST_EMAIL;
        if (!email) test.skip(true, 'STAGING_TEST_EMAIL no configurado');

        await page.goto('/');

        const loginForm = page.locator('#login-form');
        await loginForm.locator('#login-email').fill(email);
        await loginForm.locator('#login-password').fill('this-password-is-definitely-wrong-12345');
        await loginForm.locator('button[type="submit"]').click();

        // No entrar al dashboard es la señal clave. Hay DOS elementos con data-tab="ingredientes"
        // (uno en el nav lateral y otro en las tabs horizontales) — .first() evita la strict
        // mode violation que tendría lugar antes incluso del check de visibilidad.
        await expect(page.locator('[data-tab="ingredientes"]').first()).not.toBeVisible({ timeout: 5_000 });
        await expect(loginForm).toBeVisible();
    });
});
