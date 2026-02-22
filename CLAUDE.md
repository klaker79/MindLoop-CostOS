# CLAUDE.md — MindLoop CostOS Frontend

> Read GEMINI.md for the full project context. This file contains rules specific to AI agents.

## Critical Rules

1. **App is in PRODUCTION** — La Caleta 102 uses it daily. Do not break anything.
2. **No features without explicit permission.** Stability > new features.
3. **Run `npm run lint` before every commit.** ESLint blocks bugs in CI.
4. **After CSS/JS changes, update cache-busting query strings** in `index.html`.

## Architecture

- **SPA monolítica** — `index.html` has ~2942 lines, all sections in one file
- **Vanilla JS + Vite** — ESM imports, no framework
- **Modules pattern** — `*-crud.js` (data) + `*-ui.js` (render)
- **Stores** — Zustand for state management (8 stores in `src/stores/`)
- **Legacy code** — `src/legacy/` uses `window.*` globals — don't touch unless necessary
- **API client** — `src/api/client.js` centralizes all API calls

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
npm test              # Jest + jsdom (10 test files)
npm run lint          # ESLint (0 errors required)
npm run build         # Vite build
```

## Deploy

Push to `main` → GitHub Actions → GitHub Pages (`https://app.mindloop.cloud`)
No build step in production — Vite is dev-only. Files served as static.
