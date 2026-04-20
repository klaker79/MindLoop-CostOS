# CLAUDE.md — MindLoop CostOS Frontend

## Critical Rules

1. **App is in PRODUCTION** — La Caleta 102 uses it daily. Do not break anything.
2. **No features without explicit permission.** Stability > new features.
3. **Run `npm run lint` before every commit.** ESLint blocks bugs in CI.
4. **After CSS/JS changes, update cache-busting query strings** in `index.html`.

## Architecture

- **SPA monolítica** — `index.html` has 3236 lines, all sections in one file
- **Vanilla JS + Vite** — ESM imports, no framework
- **Modules pattern** — `*-crud.js` (data) + `*-ui.js` (render). 24 module folders under `src/modules/`
- **Stores** — Zustand for state management (8 stores in `src/stores/`: auth, ingredient, order, recipe, sale, supplier, ui, index registry)
- **Legacy code** — `src/legacy/` uses `window.*` globals — don't touch unless necessary
- **API client** — `src/api/client.js` centralizes all API calls

### Módulos grandes: orchestrator + submódulos (refactor 2026-04-20)

Dos módulos antes monolíticos ahora son orchestrators delgados con submódulos de responsabilidad única. Añadir KPIs o features de chat NUEVOS debe hacerse como un archivo aparte en la subcarpeta correspondiente, no inflando el orchestrator.

- **`src/modules/dashboard/`** — `dashboard.js` (201 líneas) orquesta; 10 KPIs viven en `kpis/`:
  `fecha-actual.js`, `pedidos.js`, `stock-bajo.js`, `valor-stock.js`, `cambios-precio.js`, `personal-hoy.js`, `sparklines.js`, `forecast.js`, `food-cost.js`, `ingresos.js`. Helpers compartidos en `_shared.js` (`showSkeletonIn`, `isDataLoaded`, `rangoPeriodo`).
- **`src/modules/chat/`** — `chat-widget.js` (258 líneas) monta UI y engancha eventos. Lógica dividida en:
  `chat-state.js` (sesión + historial + keys tenant-scoped + `CHAT_CONFIG`), `chat-messages.js` (add/send/render + quick buttons), `chat-actions.js` (TTS + voice dispatcher `executeAction`), `chat-context.js` (payload para n8n legacy), `chat-markdown.js` (parser markdown→HTML), `chat-pdf.js` (export A4, expone `window.exportMessageToPDF`), `chat-styles.js` (CSS inyectado).

## CSS Rules

- `polish.css` loads AFTER `main.css` — it has priority
- Use CSS variables (`--bg-primary`, `--bg-card`, etc.) for theming
- Many JS files use inline `background: white` — override with `[data-theme="dark"] [style*="background: white"]`
- `background: rgba(255,255,255,0.98)` ≠ `background: white` — use class selectors for dashboard cards

## What NOT to Touch

- **`src/legacy/`** — relaxed ESLint rules, uses window globals, fragile
- **Inline styles in template literals** — fix with CSS overrides, not by rewriting all JS templates
- **Deploy workflow** (`static.yml`) — pushes directly to GitHub Pages, no build step

## Testing

```bash
npm test              # Jest + jsdom (24 test suites, 447 tests, baseline 2026-04-20)
npm run lint          # ESLint (0 errors required)
npm run build         # Vite build
```

## Deploy

Push to `main` → GitHub Actions → GitHub Pages (`https://app.mindloop.cloud`)
No build step in production — Vite is dev-only. Files served as static.

## Critical Business Rules

### Price Priority (same in ALL modules)
1. `precio_medio_compra` from inventarioCompleto (real purchase average from albaranes)
2. `precio_medio` from inventarioCompleto (configured price / formato)
3. `precio / cantidad_por_formato` from ingrediente (fallback)

**IMPORTANT:** All recipe cost calculations MUST use `getIngredientUnitPrice()` from `src/utils/cost-calculator.js`.
Never inline the price logic — always call the shared function to guarantee consistency.

**EXCEPTION:** `performance.js` memoized calc uses only `precio_medio` (not `precio_medio_compra`) because it's used for stock valuation, not recipe costing.

**⛔ STABILITY WARNING (baseline 2026-04-09):**
Full audit verified ALL 10 tabs + dashboard + chat are consistent. 7 modules use `getIngredientUnitPrice()`.
DO NOT:
- Add inline price calculations in any module
- Change price priority without updating ALL 7 modules + backend + chat n8n
- Use `calcularCosteRecetaMemoizado` for food cost display (it ignores purchase prices)
- Deploy formula changes without verifying: escandallo = cost tracker = P&L = dashboard = analysis ranking
If numbers don't match between modules → it's a BUG. Fix before deploying.

### Food Cost Thresholds (unified)
- Food: ≤30% excellent (green), 31-35% target (blue), 36-40% watch (orange), >40% alert (red)
- Wine variants: target 45% — `recetas-variantes.js` uses 40/50 thresholds intentionally
- Margin equivalents: ≥67% green, 62-66% yellow, <62% red

### Stock
- Frontend owns stock via `bulkAdjustStock` (delta-based, atomic)
- Pedido reception: `cantidadRecibida` **en unidades base** (la multiplicación por formato ya se aplicó al crear el pedido en pedidos-crud.js:75). Multiplicar otra vez = duplicación (bug 2026-04-15 ya corregido).
- Format selector in compras-pendientes: default = ×1 (matches backend)
- Guard anti-doble-click en recepción (pedidos-recepcion.js): `isConfirmingReception` flag + botón disabled. NO quitar.

### Map Keys
- `window.inventarioCompleto` items have `.id` (NOT `.ingrediente_id`)
- When creating Maps from inventarioCompleto, always use `inv.id` as key

### DOM Safety
- Always null-check `document.getElementById()` before accessing `.style`, `.textContent`, etc.
- Use optional chaining or guard: `const el = document.getElementById('x'); if (el) el.textContent = '...';`
