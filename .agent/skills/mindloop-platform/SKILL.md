---
name: MindLoop CostOS Platform
description: Comprehensive skill for the MindLoop CostOS restaurant management platform (frontend + backend + database)
---

# MindLoop CostOS Platform

## ⚠️ FASE ACTUAL: Estabilización (Mes 2 de 3)

> **La app está en producción con clientes activos.**
> **Prioridad ABSOLUTA: estabilidad, control y robustez.**
> **PROHIBIDO añadir features nuevas hasta completar estabilización.**
>
> Antes de cualquier cambio, leer obligatoriamente:
> [stability-rules.md](file:///Users/ikerfernandezcaballero/.gemini/antigravity/scratch/mindloop-costos/.agent/skills/mindloop-platform/rules/stability-rules.md)

## Overview

MindLoop CostOS is a **multi-tenant restaurant cost management platform** for managing ingredients, recipes, suppliers, orders, sales, inventory, staff schedules, waste tracking, and financial analytics. Currently deployed for **La Caleta 102** restaurant in Galicia, Spain.

| Component | Technology | Repo |
|-----------|-----------|------|
| **Frontend** | Vite 5.4 + ES6 Modules + Chart.js + Zustand | `mindloop-costos` |
| **Backend** | Node.js + Express 4.18 + PostgreSQL (`pg`) | `lacaleta-api` |
| **Database** | PostgreSQL (20+ tables, multi-tenant) | Managed via Dokploy |

### Production URLs
- **Frontend**: `https://app.mindloop.cloud`
- **Backend API**: `https://lacaleta-api.mindloop.cloud`
- **Monitoring**: Uptime Kuma at `https://uptime.mindloop.cloud`

## When to Use This Skill

- Modifying any code in `mindloop-costos` or `lacaleta-api`
- Debugging API errors, stock discrepancies, or sales import issues
- Adding new features (modules, endpoints, database tables)
- Understanding the architecture and data flow
- Deployment and DevOps tasks
- Understanding business logic (food cost, menu engineering, inventory)

## Architecture Summary

### Backend (`lacaleta-api`)
- **Single-file server**: `server.js` (4379 lines) contains ALL route handlers inline
- **DDD layers in `src/`**: Only `SupplierController` is migrated to clean architecture; rest is inline
- **Multi-tenant**: Every table has `restaurante_id` column; extracted from JWT in `authMiddleware`
- **Auth**: JWT tokens (7-day expiry) stored in httpOnly cookies + Bearer header for API clients
- **Security**: bcrypt password hashing, CORS with strict origin check, rate limiting (100 req/15min), invitation code for registration
- **Integrations**: Sentry (error tracking), Resend (email), Anthropic Claude (PDF parsing), Uptime Kuma (heartbeat)
- **80+ API endpoints** across 15 modules

### Frontend (`mindloop-costos`)
- **Hybrid architecture**: Legacy HTML/JS + modern ES6 modules (ES6 has priority)
- **41 ES6 modules** in `src/modules/` following CRUD+UI pattern
- **Global state**: `window.*` for legacy compatibility + Zustand stores
- **API client**: Centralized in `src/api/client.js` with convenience functions
- **Performance**: Parallel data loading, memoization (TTL cache), O(1) lookups with Maps, debouncing
- **Security**: DOMPurify for XSS, CSP headers, input validation
- **Entry point**: `src/main.js` orchestrates module loading and exposes functions globally

### Key Business Logic
- **Food Cost**: Target 33-35%, alert at 40%
- **Menu Engineering**: BCG Matrix (Estrella/Caballo/Puzzle/Perro classification)
- **Inventory**: Virtual stock (adjusted by sales/orders) vs Real stock (physical count), consolidation flow
- **Variants**: Recipes can have variants (e.g., wine bottle vs glass) with factor-based stock deduction
- **Mermas** (Waste): Tracked per ingredient with monthly summaries and stats
- **Intelligence**: Freshness alerts, purchase planning, overstock detection, price checking

## Reference Documents

For detailed information, consult these rule files:

| Document | Path | Contents |
|----------|------|----------|
| **⚠️ Stability Rules** | [stability-rules.md](file:///rules/stability-rules.md) | **Reglas operativas obligatorias, flujos críticos, protocolo de cambio, prohibiciones** |
| Database Schema | [database-schema.md](file:///rules/database-schema.md) | All 20+ tables, columns, types, relations, migrations |
| API Endpoints | [api-endpoints.md](file:///rules/api-endpoints.md) | All 80+ endpoints with methods, auth, bodies, responses |
| Frontend Architecture | [frontend-architecture.md](file:///rules/frontend-architecture.md) | 41 modules, patterns, state management, API client |
| Deployment & DevOps | [deployment-devops.md](file:///rules/deployment-devops.md) | Docker, Dokploy, env vars, monitoring, CI/CD |

## Coding Conventions

### Backend
- Route names in **English** (`/api/ingredients`, `/api/recipes`, `/api/orders`)
- Log messages and comments in **Spanish**
- Use `req.restauranteId` (set by `authMiddleware`) for all queries
- Soft delete pattern: `SET deleted_at = CURRENT_TIMESTAMP` (never hard delete data)
- Transactions with `pool.connect()` → `BEGIN` → `COMMIT`/`ROLLBACK` → `client.release()`
- Row locking: `SELECT ... FOR UPDATE` before stock updates to prevent race conditions
- Validation helpers: `validatePrecio()`, `validateCantidad()`, `validateNumber()`

### Frontend
- Module pattern: `*-crud.js` (data ops) + `*-ui.js` (rendering)
- Expose functions via `window.*` for legacy compatibility
- Import from `../../api/client.js` for API calls
- Use `showToast()` for user notifications
- DOM helpers in `../../utils/dom-helpers.js`
- Validation in `../../utils/validation.js`

## Known Issues & TODOs
- Email verification in login is **commented out** (line ~770 of `server.js`)
- `VITE_CHAT_WEBHOOK_URL` must be set for chatbot functionality
- Recipe v2 routes exist at `/api/v2/recipes` but inline routes in `server.js` are the active ones
- `server.js` is a monolith — only Suppliers have been migrated to clean architecture
- Galicia holidays are hardcoded for 2026 in the overstock intelligence endpoint

## Workflows Disponibles
- `/change-protocol` — Protocolo obligatorio para cada cambio (9 pasos)
- `/hotfix-protocol` — Protocolo de emergencia para producción

## Tests (Estado actual: 491 tests, 62 suites, 0 fallos)
- `__tests__/regression/p0-p1-regression.test.js` — 27 tests de regresión P0/P1
- `__tests__/api/api-surface-contract.test.js` — Contrato de API client
- `__tests__/modules/` — Tests unitarios por módulo
- Backend: 47 suites, 216 tests
- Frontend: 15 suites, 275 tests
