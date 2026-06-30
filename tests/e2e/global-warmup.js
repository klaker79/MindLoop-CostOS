/**
 * Warmup global de staging — se ejecuta UNA vez antes de toda la suite E2E
 * (via `globalSetup` en playwright.config.js).
 *
 * Problema que resuelve: el backend/frontend de staging corre en Dokploy y
 * (a) puede estar escalado a 0 fuera de horario (cold-start), o (b) estar
 * redeployándose justo cuando se mergea un PR — el mismo merge que dispara la
 * E2E dispara el redeploy de staging, así que la suite arranca mientras el
 * contenedor reinicia y todos los `page.goto`/`request.get` dan Timeout ANTES
 * de cargar nada de la app (no es un bug de código, es la carrera con el deploy).
 *
 * Aquí ESPERAMOS ACTIVAMENTE a que staging responda 200 antes de arrancar los
 * tests, con una ventana lo bastante larga (~3 min) para cubrir un redeploy
 * completo. En cuanto responde 200, seguimos de inmediato (caso normal: rápido).
 *
 * Best-effort: NUNCA lanza. Si staging sigue caído tras la ventana, los tests
 * lo reportarán con su propio error claro — el warmup no debe enmascararlo.
 */
import { request } from '@playwright/test';

const STAGING_URL = process.env.STAGING_URL || 'https://staging.mindloop.cloud';
const STAGING_API_URL = process.env.STAGING_API_URL || 'https://staging-api.mindloop.cloud';

// Ventana total de espera por URL (cubre un redeploy de Dokploy).
// 2026-06-13: subido 180s → 300s. El build del Dockerfile de staging-api +
// arranque puede pasar de 3 min; con 180s el warmup se rendía y los tests
// corrían contra el contenedor aún reiniciando (falso rojo recurrente en cada
// PR que sigue a un merge a develop, que es justo lo que dispara el redeploy).
// perTryMs = timeout de cada intento; gapMs = pausa entre intentos fallidos
// para repartir los reintentos a lo largo de la ventana.
const MAX_WAIT_MS = 300_000;
const PER_TRY_MS = 10_000;
const GAP_MS = 5_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function warm(ctx, url) {
    const deadline = Date.now() + MAX_WAIT_MS;
    let intento = 0;
    while (Date.now() < deadline) {
        intento++;
        try {
            const res = await ctx.get(url, { timeout: PER_TRY_MS });
            if (res.ok()) {
                console.log(`[warmup] ${url} caliente (HTTP ${res.status()}, intento ${intento})`);
                return true;
            }
            console.log(`[warmup] ${url} -> HTTP ${res.status()} (intento ${intento})`);
        } catch (e) {
            console.log(`[warmup] ${url} aún no responde (intento ${intento}): ${e.message}`);
        }
        if (Date.now() + GAP_MS < deadline) await sleep(GAP_MS);
    }
    console.log(`[warmup] ${url} sigue sin responder tras ~${Math.round(MAX_WAIT_MS / 1000)}s — la suite continúa igualmente`);
    return false;
}

export default async function globalWarmup() {
    console.log('[warmup] Esperando a que staging responda 200 (cold-start o redeploy en curso)...');
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
