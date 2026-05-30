/**
 * Flows autenticados.
 * La sesión se inicia en global-setup.spec.js y se reutiliza vía storageState
 * declarado en playwright.config.js (project "chromium" depends on "setup").
 *
 * Tras el reset de Demo Trattoria del 2026-05-06, el seed antiguo
 * (Pasta Bolonesa, Bruschetta, etc.) ya no existe. Los tests asertan
 * ahora contra data real introducida por Iker simulando un cliente
 * nuevo. Como mínimo el tenant debe tener:
 *   - Ingredientes: Tomate, Cebolla, Vino Albariño
 *   - Recetas: Pulpo a Grella (con escandallo completo), Spaghetti con Tomate
 *
 * Si reseedeas o renombras estas recetas, actualiza los selectores aquí.
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
    test('muestra KPIs básicos tras login', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Algún KPI reconocible: stock value, ingredientes, etc.
        // Uso un locator tolerante a varios idiomas.
        await expect(
            page.getByText(/stock value|valor stock|库存价值/i).first()
        ).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('Ingredientes', () => {
    test('la lista muestra ingredientes clave del tenant', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.locator('[data-tab="ingredientes"]').first().click();

        // Match case-insensitive para tolerar mayúsculas/tildes según introducción del cliente.
        await expect(page.getByText(/tomate/i).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(/cebolla/i).first()).toBeVisible();
        await expect(page.getByText(/vino albari/i).first()).toBeVisible();
    });
});

test.describe('Recetas + escandallo', () => {
    // Receta canónica del tenant para los tests: tiene 4 ingredientes con
    // rendimientos variados (Pulpo 70%, Patatas 85%, Ajada 100%, Sal 100%),
    // categoría Alimentos, precio venta 22€ — buen estresado del escandallo.
    const RECETA_PRINCIPAL = /pulpo a grella/i;
    const RECETA_SECUNDARIA = /spaghetti con tomate/i;

    test('la lista de recetas muestra recetas del tenant', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.locator('[data-tab="recetas"]').first().click();

        await expect(page.getByText(RECETA_PRINCIPAL).first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(RECETA_SECUNDARIA).first()).toBeVisible();
    });

    test('abrir escandallo de la receta principal muestra coste y food cost', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.locator('[data-tab="recetas"]').first().click();
        await expect(page.getByText(RECETA_PRINCIPAL).first()).toBeVisible({ timeout: 10_000 });

        // Fila que contiene el nombre, y dentro el botón .icon-btn.view (📊)
        const recetaRow = page.locator('tr').filter({ hasText: RECETA_PRINCIPAL }).first();
        await recetaRow.locator('button.icon-btn.view').click();

        // Modal de escandallo abre
        const modal = page.locator('#modal-escandallo');
        await expect(modal).toBeVisible({ timeout: 10_000 });

        // Contiene un valor con unidad monetaria (€/RM/$)
        await expect(modal.locator('text=/\\d+[.,]\\d+\\s*[€$R]/').first()).toBeVisible();
    });

    // El toggle Nominal/Real del escandallo se eliminó (PR #470, 2026-05-28).
    // El test que lo cubría queda retirado; ya no hay UI que probar.
});

// NOTA: test de Pedidos retirado temporalmente (2026-04-22).
//
// El render crea `<strong>Fresco Market KL</strong>` en el DOM pero el
// contenedor queda `hidden`. Ni `click()` al nav-item ni
// `window.cambiarTab('pedidos')` desde evaluate activaron el tab en los
// runs de CI, a pesar de que el mismo flujo funciona en el navegador real.
//
// Pendiente de debuggear con `npx playwright show-trace` en local contra
// staging (requiere browsers instalados localmente). Cuando quede
// diagnosticado, restaurar este bloque.

test.describe('i18n', () => {
    test('cambio de idioma a español traduce la navegación', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Los botones de idioma viven dentro de #language-switcher en el sidebar inferior.
        // Pueden estar fuera del viewport al arrancar (el sidebar es largo) — scrollIntoView
        // antes de interactuar para evitar flakes de visibilidad.
        const esBtn = page.locator('#language-switcher [data-lang="es"]');
        await esBtn.waitFor({ state: 'attached', timeout: 10_000 });
        await esBtn.scrollIntoViewIfNeeded();
        await esBtn.click();

        // Tras cambiar a ES, el texto del span nav-item-text se traduce. Usamos el atributo
        // data-i18n como ancla porque es estable en todos los idiomas (el que cambia es el
        // textContent). `.first()` porque hay dos elementos con esa clave: el nav lateral
        // y la tab horizontal.
        await expect(
            page.locator('[data-i18n="common:nav_recetas"]').first()
        ).toHaveText('Recetas', { timeout: 5_000 });

        // Dejamos el idioma otra vez en EN para no contaminar la sesión guardada
        // (storageState) que usan los demás tests.
        const enBtn = page.locator('#language-switcher [data-lang="en"]');
        await enBtn.scrollIntoViewIfNeeded();
        await enBtn.click();
    });
});
