/**
 * Global setup — hace login una vez y guarda la sesión en disco.
 * Los demás tests reutilizan la sesión vía `storageState` (ver playwright.config.js).
 *
 * Si cambian las credenciales en GitHub Secrets, este setup volverá a hacer login
 * automáticamente en la próxima run — no hace falta regenerar nada a mano.
 */
import { test as setup, expect } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const AUTH_FILE = 'playwright/.auth/user.json';

setup('authenticate as Demo Trattoria KL', async ({ page }) => {
    const email = process.env.STAGING_TEST_EMAIL;
    const password = process.env.STAGING_TEST_PASSWORD;

    if (!email || !password) {
        throw new Error(
            'Missing STAGING_TEST_EMAIL or STAGING_TEST_PASSWORD env vars. ' +
            'In CI they come from GitHub Secrets; locally export them before `npm run e2e`.'
        );
    }

    await page.goto('/');

    // Rellena el formulario de login anclado al #login-form para evitar colisiones
    // con los forms de forgot-password y registro (todos usan el mismo placeholder).
    const loginForm = page.locator('#login-form');
    await loginForm.locator('#login-email').fill(email);
    await loginForm.locator('#login-password').fill(password);
    await loginForm.locator('button[type="submit"]').click();

    // Primer check: el login se completó y el form desaparece. Si el backend es lento
    // o rechaza las credenciales, este assertion lo detecta antes que el siguiente —
    // con un mensaje de error más claro en los logs.
    await expect(loginForm).not.toBeVisible({ timeout: 20_000 });

    // Segundo check: el dashboard ya tiene su sidebar navegable.
    await expect(page.locator('[data-tab="ingredientes"]').first()).toBeVisible({ timeout: 15_000 });

    // Asegura que el directorio existe y persiste la sesión
    const dir = dirname(AUTH_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await page.context().storageState({ path: AUTH_FILE });
});
