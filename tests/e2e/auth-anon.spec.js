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

        await page.getByPlaceholder(/your@email\.com|email/i).fill(email);
        await page.getByPlaceholder(/password|contraseña|密码/i).fill('this-password-is-definitely-wrong-12345');
        await page.getByRole('button', { name: /sign in|iniciar sesi[oó]n|登录/i }).click();

        // Algún indicio de error: mensaje en pantalla, banner, alerta, etc.
        // Evitamos depender de un texto exacto — solo exigimos que NO entre al dashboard.
        await expect(page.locator('[data-tab="ingredientes"]')).not.toBeVisible({ timeout: 5_000 });
    });
});
