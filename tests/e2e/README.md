# E2E tests (Playwright)

End-to-end tests that drive a real browser against the **staging**
environment (`https://staging.mindloop.cloud`). They never run against
production.

## Why staging, not production

Tests open recipes, toggle modes, create/remove things. Running that
against prod would dirty La Nave 5 and Stefania's data, and a half-failed
test could leave inconsistent state. Staging is the crash-test dummy:
same code as prod, fake data, throw-away environment.

If the tests pass on staging, the same code will behave the same way
on prod once merged — because staging and prod are built from the same
`main` branch with the same Dockerfiles.

## How protection works

```
Pull Request → CI runs Playwright against staging
   ├─ green → PR can be merged → main deploys to prod → prod stays safe
   └─ red   → PR blocked → fix it → push again
```

## Layout

| File | Project | Purpose |
|---|---|---|
| `global-setup.spec.js` | `setup` | Logs in once with `STAGING_TEST_*` credentials, saves the session to `playwright/.auth/user.json` |
| `auth-anon.spec.js` | `chromium-anon` | Wrong password must not reach the dashboard |
| `smoke.spec.js` | `chromium-anon` | Home loads; staging backend `/` returns JSON |
| `flows.spec.js` | `chromium` | Dashboard, ingredients list (12 seed items), recipes list, escandallo modal, Nominal/Real toggle, language switch |

Total: **10 tests**.

## Prerequisites

The staging environment must be up and seeded with the minimum dataset:

- 3 suppliers, 12 ingredients, 6 recipes (including **Pasta Bolonesa**)
- A test user whose email is in `STAGING_TEST_EMAIL` and whose password
  is in `STAGING_TEST_PASSWORD`, with `email_verified = TRUE` in the
  staging DB

See `infrastructure_staging.md` in the project-wide docs for the SQL to
(re)apply the seed.

## Running locally

```bash
# First time only — downloads Chromium (~200 MB)
npm run e2e:install

# Set environment variables (or export them in your shell rc)
export STAGING_URL=https://staging.mindloop.cloud
export STAGING_API_URL=https://staging-api.mindloop.cloud
export STAGING_TEST_EMAIL=...
export STAGING_TEST_PASSWORD=...

# Headless run
npm run e2e

# Interactive UI (great for writing new tests)
npm run e2e:ui

# Open the last HTML report
npm run e2e:report
```

On failure, Playwright writes screenshots + a trace file next to the
report. Open the HTML report to see the exact timeline of the failing
test.

## Running in CI

GitHub Actions reads `STAGING_*` from repository secrets and runs the
same command. A nightly workflow also runs the full suite daily and
emails on failure — this arrives in a follow-up PR.

## Selector strategy

Prefer, in order:

1. `data-tab` or similar semantic attributes: `[data-tab="ingredientes"]`
2. Role-based queries: `getByRole('button', { name: /sign in/i })`
3. Stable visible text (seed names like "Pasta Bolonesa")
4. Hard-coded emojis in the UI (📊 for escandallo)
5. Stable IDs (`#modal-escandallo`)

Avoid:
- Class-only selectors (`.btn-primary`) — they change when styles evolve
- `nth-child` positional locators
- Language-specific text without a regex that covers all three languages

## When a test starts flaking

1. Reproduce locally with `npm run e2e:ui` to watch it step by step.
2. If staging was redeployed while the test ran, the storage state JWT
   may have expired. Delete `playwright/.auth/user.json` and re-run —
   the setup project will regenerate it.
3. If the test is inherently flaky (chat, animations), move it behind
   `test.fixme` while the flake is investigated, so the rest of the
   suite stays green and meaningful.

## What is NOT covered (on purpose)

- **Chat IA**: LLM responses are non-deterministic; a first-pass E2E
  suite shouldn't depend on them.
- **Stripe checkout**: needs matching test-mode price IDs in staging
  env vars, TBD.
- **End-to-end order flow**: pending a richer seed that includes orders
  and daily sales.
- **Visual regression**: premature while the UI still evolves fast.

## Adding a new test

1. Decide whether it needs a logged-in session (goes in `flows.spec.js`
   or a new file in the `chromium` project) or not (`chromium-anon`).
2. Drop the new file under `tests/e2e/`.
3. If it depends on new seed data, extend the seed SQL in
   `infrastructure_staging.md` first — never bake new data directly
   into the test.
4. Run `npx playwright test --list` to confirm the runner sees it.
5. Run `npm run e2e` locally once before opening the PR.
