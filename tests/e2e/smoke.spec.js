/**
 * Smoke tests — verifican que la app siquiera carga.
 * No requieren login ni datos seed. Si estos fallan, algo muy gordo va mal.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke — home y backend', () => {
    test('la home responde y muestra la página de login', async ({ page }) => {
        await page.goto('/');

        await expect(page).toHaveTitle(/MindLoop|CostOS/i);

        // Anclar al form del login (#login-form) para evitar el strict mode violation
        // que provoca el que forgot-password y registro tienen inputs con placeholders idénticos.
        const loginForm = page.locator('#login-form');
        await expect(loginForm).toBeVisible();
        await expect(loginForm.locator('#login-email')).toBeVisible();
        await expect(loginForm.locator('#login-password')).toBeVisible();
        await expect(loginForm.locator('button[type="submit"]')).toBeVisible();
    });

    test('el backend staging responde con JSON en /', async ({ request }) => {
        const apiUrl = process.env.STAGING_API_URL || 'https://staging-api.mindloop.cloud';
        const res = await request.get(apiUrl + '/');
        expect(res.status()).toBe(200);

        const body = await res.json();
        expect(body.status).toBe('running');
        expect(body.version).toBeTruthy();
    });
});
