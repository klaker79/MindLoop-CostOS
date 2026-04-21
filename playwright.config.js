/**
 * Playwright configuration for MindLoop CostOS E2E tests.
 *
 * Targets the staging environment by default (https://staging.mindloop.cloud).
 * Credentials and URLs are read from environment variables — in CI they come
 * from GitHub Secrets, locally you can export STAGING_URL, STAGING_API_URL,
 * STAGING_TEST_EMAIL and STAGING_TEST_PASSWORD.
 *
 * Run:
 *   npm run e2e           # headless against STAGING_URL
 *   npm run e2e:ui        # Playwright UI mode (interactive)
 *   npm run e2e:report    # open the last HTML report
 */
import { defineConfig, devices } from '@playwright/test';

const STAGING_URL = process.env.STAGING_URL || 'https://staging.mindloop.cloud';
const IS_CI = !!process.env.CI;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: IS_CI,
    retries: IS_CI ? 2 : 0,
    workers: IS_CI ? 1 : undefined,
    reporter: [
        ['html', { open: 'never' }],
        ['list']
    ],
    timeout: 30_000,
    expect: { timeout: 5_000 },

    use: {
        baseURL: STAGING_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: IS_CI ? 'retain-on-failure' : 'off',
        actionTimeout: 10_000,
        navigationTimeout: 15_000
    },

    projects: [
        // 1) Setup project: hace login una vez y guarda la sesión en disco.
        {
            name: 'setup',
            testMatch: /global-setup\.spec\.js/
        },

        // 2) Tests autenticados: reutilizan la sesión del setup.
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.auth/user.json'
            },
            dependencies: ['setup'],
            testIgnore: [/global-setup\.spec\.js/, /auth-anon\.spec\.js/, /smoke\.spec\.js/]
        },

        // 3) Tests anónimos (login KO, página de login): sin storageState.
        {
            name: 'chromium-anon',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /auth-anon\.spec\.js|smoke\.spec\.js/
        }

        // Firefox/WebKit se añadirán cuando la suite sea estable.
    ]
});
