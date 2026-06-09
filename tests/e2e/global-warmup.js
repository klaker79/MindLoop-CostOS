/**
 * Warmup global de staging — se ejecuta UNA vez antes de toda la suite E2E
 * (via `globalSetup` en playwright.config.js).
 *
 * Problema que resuelve: el backend/frontend de staging corre en Dokploy y
 * puede estar escalado a 0 fuera de horario. El primer request lo despierta,
 * pero el cold-start tarda más que el navigationTimeout y tumbaba el nightly
 * con `page.goto Timeout exceeded` ANTES de cargar nada de la app (no era un
 * bug de código, era infra fría).
 *
 * Aquí lo despertamos con reintentos antes de que arranquen los tests, para
 * que el primer `page.goto`/`request.get` real llegue a una instancia caliente.
 *
 * Best-effort: NUNCA lanza. Si staging está genuinamente caído, los tests lo
 * reportarán con su propio error claro — el warmup no debe enmascararlo.
 */
import { request } from '@playwright/test';

const STAGING_URL = process.env.STAGING_URL || 'https://staging.mindloop.cloud';
const STAGING_API_URL = process.env.STAGING_API_URL || 'https://staging-api.mindloop.cloud';

async function warm(ctx, url, attempts = 5, perTryMs = 15_000) {
    for (let i = 1; i <= attempts; i++) {
        try {
            const res = await ctx.get(url, { timeout: perTryMs });
            if (res.ok()) {
                console.log(`[warmup] ${url} caliente (HTTP ${res.status()}, intento ${i})`);
                return true;
            }
            console.log(`[warmup] ${url} -> HTTP ${res.status()} (intento ${i})`);
        } catch (e) {
            console.log(`[warmup] ${url} aún frío (intento ${i}): ${e.message}`);
        }
    }
    console.log(`[warmup] ${url} sigue sin responder tras ${attempts} intentos — la suite continúa igualmente`);
    return false;
}

export default async function globalWarmup() {
    console.log('[warmup] Calentando staging (Dokploy puede estar escalado a 0)...');
    const ctx = await request.newContext();
    try {
        await Promise.all([
            warm(ctx, STAGING_URL),
            warm(ctx, STAGING_API_URL),
        ]);
    } finally {
        await ctx.dispose();
    }
}
