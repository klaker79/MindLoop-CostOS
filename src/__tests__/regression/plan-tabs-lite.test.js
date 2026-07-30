/**
 * @jest-environment jsdom
 *
 * Contrato del paquete Lite: qué pestañas incluye.
 *
 * Esto no es un detalle técnico, es **qué se está vendiendo**. Ya se torció una
 * vez: el conjunto propuesto llevaba `analisis` y no llevaba `inventario`, e
 * Iker lo corrigió al verlo. Peor todavía, el comentario del código siguió
 * describiendo el conjunto viejo mientras la lista decía otra cosa, y las ramas
 * `lite` y `develop` acabaron con dos definiciones distintas del mismo paquete.
 *
 * La lista de abajo es la confirmada por Iker (2026-07-28). Si este test falla,
 * decide a conciencia: estás cambiando la oferta comercial, no refactorizando.
 */
import { readFileSync } from 'fs';
import { PLAN_TABS, planPermiteTab } from '../../modules/core/plan-tabs.js';

/** Conjunto Lite confirmado. El orden importa: es el del menú. */
const LITE_CONFIRMADO = [
    'ingredientes',
    'recetas',
    'proveedores',
    'pedidos',
    'ventas',
    'inventario',
    'diario',
    'configuracion',
];

/** Pestañas que Lite NO incluye. */
const FUERA_DE_LITE = ['analisis', 'busqueda', 'inteligencia', 'horarios', 'comida-personal'];

describe('Paquete Lite — contrato de pestañas', () => {
    test('incluye exactamente las 8 confirmadas, en orden', () => {
        expect(PLAN_TABS.lite).toEqual(LITE_CONFIRMADO);
    });

    test('inventario SÍ entra (se quitó por error en la primera propuesta)', () => {
        expect(PLAN_TABS.lite).toContain('inventario');
    });

    test('analisis NO entra (Cuenta de Resultados / BCG / punto de equilibrio)', () => {
        expect(PLAN_TABS.lite).not.toContain('analisis');
    });

    test('ninguna pestaña de fuera se cuela', () => {
        for (const tab of FUERA_DE_LITE) {
            expect(PLAN_TABS.lite).not.toContain(tab);
        }
    });

    test('todas las pestañas del paquete existen de verdad en el menú', () => {
        // Un nombre mal escrito en PLAN_TABS no da error: simplemente esa
        // pestaña nunca se muestra, y el cliente Lite se queda sin ella.
        const html = readFileSync('index.html', 'utf8');
        const reales = new Set(
            [...html.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1])
        );
        for (const tab of PLAN_TABS.lite) {
            expect([...reales]).toContain(tab);
        }
    });

    describe('planPermiteTab', () => {
        afterEach(() => { delete window._planData; });

        // ── El caso que motivó separar plan_tier de plan (2026-07-30) ──────────
        // Antes el tier se leía de `plan`, así que marcar a alguien como Lite le
        // rompía el periodo de prueba: el control de suscripción deja pasar por
        // `plan='trial'`, y al pisarlo con 'lite' quedaba bloqueado. Un cliente
        // tiene que poder estar EN TRIAL y ver el paquete Lite a la vez.
        test('trial vigente + paquete Lite: se aplica el tier sin tocar la facturación', () => {
            window._planData = { plan: 'trial', plan_status: 'trialing', plan_tier: 'lite' };
            for (const tab of LITE_CONFIRMADO) expect(planPermiteTab(tab)).toBe(true);
            for (const tab of FUERA_DE_LITE) expect(planPermiteTab(tab)).toBe(false);
        });

        test('plan_tier manda sobre plan', () => {
            // Cliente que paga el plan premium pero contrató el paquete Lite.
            window._planData = { plan: 'premium', plan_status: 'active', plan_tier: 'lite' };
            expect(planPermiteTab('inteligencia')).toBe(false);
            expect(planPermiteTab('inventario')).toBe(true);
        });

        test('sin plan_tier se respeta plan (tenants anteriores a la migración)', () => {
            window._planData = { plan: 'lite' };
            expect(planPermiteTab('analisis')).toBe(false);
            expect(planPermiteTab('diario')).toBe(true);
        });

        test('plan_tier vacío no recorta nada', () => {
            window._planData = { plan: 'trial', plan_status: 'trialing', plan_tier: null };
            for (const tab of FUERA_DE_LITE) expect(planPermiteTab(tab)).toBe(true);
        });

        test('con plan lite, permite las suyas y niega el resto', () => {
            window._planData = { plan: 'lite' };
            for (const tab of LITE_CONFIRMADO) expect(planPermiteTab(tab)).toBe(true);
            for (const tab of FUERA_DE_LITE) expect(planPermiteTab(tab)).toBe(false);
        });

        test('fail-open: sin plan cargado, todo permitido', () => {
            expect(planPermiteTab('inteligencia')).toBe(true);
        });

        test('un plan normal no recorta nada', () => {
            window._planData = { plan: 'premium' };
            for (const tab of FUERA_DE_LITE) expect(planPermiteTab(tab)).toBe(true);
        });
    });
});
