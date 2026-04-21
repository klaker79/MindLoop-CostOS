/**
 * Smoke tests — verifican que la app siquiera carga.
 * No requieren login ni datos seed. Si estos fallan, algo muy gordo va mal.
 */
import { test, expect } from '@playwright/test';

test.describe('Smoke — home y backend', () => {
    test('la home responde y muestra la página de login', async ({ page }) => {
        await page.goto('/');

        await expect(page).toHaveTitle(/MindLoop|CostOS/i);

        // Email y password input presentes
        await expect(page.getByPlaceholder(/your@email\.com|email/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in|iniciar sesi[oó]n|登录/i })).toBeVisible();
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
