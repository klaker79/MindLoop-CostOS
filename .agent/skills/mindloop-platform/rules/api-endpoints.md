# API Endpoints Reference

> Base URL: `https://lacaleta-api.mindloop.cloud`
> All routes (except health/root) require `Authorization: Bearer <jwt>` header or `auth_token` httpOnly cookie.

## Authentication

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | ❌ (rate limited) | Login with email/password. Returns JWT + sets httpOnly cookie |
| POST | `/api/auth/register` | ❌ | Register with invitation code. Creates restaurant + admin user in transaction |
| GET | `/api/auth/verify` | ✅ | Verify JWT and return user info |
| POST | `/api/auth/logout` | ❌ | Clear auth cookie |
| POST | `/api/auth/api-token` | ✅ Admin | Generate long-lived API token (for n8n/Zapier) |
| GET | `/api/auth/verify-email` | ❌ | Email verification via token query param |

### Login Response
```json
{
  "token": "jwt...",
  "user": { "id": 1, "email": "...", "nombre": "...", "rol": "admin", "restaurante": "La Caleta", "restauranteId": 1 }
}
```

### Registration Body
```json
{
  "nombre": "Restaurant Name",
  "email": "admin@example.com",
  "password": "min6chars",
  "codigoInvitacion": "ENV_INVITATION_CODE"
}
```

---

## Team Management

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/team` | ✅ | List team members |
| POST | `/api/team/invite` | ✅ Admin | Create team member (name, email, password, rol) |
| DELETE | `/api/team/:id` | ✅ Admin | Delete team member (cannot self-delete) |

---

## Ingredients

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/ingredients` | ✅ | List active ingredients. `?include_inactive=true` for all |
| POST | `/api/ingredients` | ✅ | Create ingredient |
| PUT | `/api/ingredients/:id` | ✅ | Update ingredient (merge-based: only updates provided fields) |
| DELETE | `/api/ingredients/:id` | ✅ | Soft delete |
| PATCH | `/api/ingredients/:id/toggle-active` | ✅ | Toggle active/inactive |
| POST | `/api/ingredients/match` | ✅ | Match by name: exact → alias → partial (LIKE) |

### Ingredient Create/Update Body
```json
{
  "nombre": "Pulpo",
  "precio": 26.50,
  "unidad": "kg",
  "stock_actual": 10,
  "stock_minimo": 2,
  "familia": "marisco",
  "formato_compra": "Caja 5kg",
  "cantidad_por_formato": 5,
  "rendimiento": 85,
  "proveedor_id": 3
}
```

### Multi-Supplier Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/ingredients-suppliers` | ✅ | All ingredient-supplier associations |
| GET | `/api/ingredients/:id/suppliers` | ✅ | Suppliers for one ingredient |
| POST | `/api/ingredients/:id/suppliers` | ✅ | Associate supplier (upsert) |
| PUT | `/api/ingredients/:id/suppliers/:supplierId` | ✅ | Update price/primary flag |
| DELETE | `/api/ingredients/:id/suppliers/:supplierId` | ✅ | Remove association |

---

## Recipes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/recipes` | ✅ | List all active recipes |
| POST | `/api/recipes` | ✅ | Create recipe |
| PUT | `/api/recipes/:id` | ✅ | Update recipe |
| DELETE | `/api/recipes/:id` | ✅ | Soft delete |

### Recipe Body
```json
{
  "nombre": "Pulpo a la Gallega",
  "categoria": "principal",
  "precio_venta": 18.50,
  "porciones": 1,
  "codigo": "00125",
  "ingredientes": [
    {"ingredienteId": 5, "cantidad": 0.3, "unidad": "kg"},
    {"ingredienteId": 12, "cantidad": 0.05, "unidad": "l"}
  ]
}
```

### Recipe Variants

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/recipes-variants` | ✅ | All variants for restaurant |
| GET | `/api/recipes/:id/variants` | ✅ | Variants for one recipe |
| POST | `/api/recipes/:id/variants` | ✅ | Create variant (upsert on name) |
| PUT | `/api/recipes/:id/variants/:variantId` | ✅ | Update variant |
| DELETE | `/api/recipes/:id/variants/:variantId` | ✅ | Delete variant |

---

## Suppliers

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/suppliers` | ✅ | List suppliers |
| GET | `/api/suppliers/:id` | ✅ | Get one supplier |
| POST | `/api/suppliers` | ✅ | Create supplier |
| PUT | `/api/suppliers/:id` | ✅ | Update supplier |
| DELETE | `/api/suppliers/:id` | ✅ | Delete supplier |

> **Note**: These are the only endpoints using the clean architecture `SupplierController`.

---

## Orders

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/orders` | ✅ | List orders. `?limit=50&page=1` for pagination |
| POST | `/api/orders` | ✅ | Create order. If `estado=recibido`, auto-registers daily purchases |
| PUT | `/api/orders/:id` | ✅ | Update order. On `estado=recibido` → registers daily purchases |
| DELETE | `/api/orders/:id` | ✅ | Soft delete + rollback stock + rollback daily purchases |

### Order Create Body
```json
{
  "proveedorId": 3,
  "fecha": "2026-02-08",
  "estado": "pendiente",
  "total": 250.00,
  "ingredientes": [
    {"ingredienteId": 5, "cantidad": 10, "precioUnitario": 25}
  ]
}
```

### Order Delete Cascade
1. If `estado=recibido`: decrements `precios_compra_diarios` quantities (deletes if ≤0)
2. Reverts `ingredientes.stock_actual` using `SELECT FOR UPDATE` row locks
3. Soft deletes the order

---

## Sales

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/sales` | ✅ | List sales. `?fecha=YYYY-MM-DD`, `?limit=50&page=1` |
| POST | `/api/sales` | ✅ | Create single sale. Deducts stock per ingredient (÷ porciones × factor) |
| DELETE | `/api/sales/:id` | ✅ | Soft delete + restore stock |
| POST | `/api/sales/bulk` | ✅ | Bulk import (n8n compatible). Matches by TPV code → variant code → name |
| POST | `/api/parse-pdf` | ✅ | Parse PDF via Claude API (Anthropic). Extracts TPV sales data |

### Single Sale Body
```json
{
  "receta_id": 25,
  "cantidad": 2,
  "variante_id": null,
  "fecha": "2026-02-08T14:00:00Z"
}
```

### Bulk Sale Body (n8n format)
```json
{
  "ventas": [
    {"receta": "CAÑA", "codigo_tpv": "00117", "cantidad": 67, "total": 201.00, "fecha": "2026-02-08T12:00:00Z"}
  ]
}
```

### Bulk Sale Matching Priority
1. Match by `recetas.codigo` (TPV code)
2. Match by `recetas_variantes.codigo` (variant TPV code → applies factor)
3. Match by `recetas.nombre` (case-insensitive)

### Duplicate Protection
Bulk sales returns `409 Conflict` if sales already exist for the given date.

---

## Inventory

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/inventory/complete` | ✅ | Full inventory with calculated `precio_medio` and `valor_stock` |
| PUT | `/api/inventory/:id/stock-real` | ✅ | Set physical stock count for one ingredient |
| PUT | `/api/inventory/bulk-update-stock` | ✅ | Bulk set physical stock counts |
| POST | `/api/inventory/consolidate` | ✅ | ERP-style consolidation: save snapshots + adjustments + sync master stock |

### Consolidation Body
```json
{
  "snapshots": [{"id": 5, "stock_real": 8.5, "stock_virtual": 10}],
  "adjustments": [{"ingrediente_id": 5, "cantidad": -1.5, "motivo": "Merma", "notas": "Podrido"}],
  "finalStock": [{"id": 5, "stock_real": 8.5}]
}
```

---

## Analysis & Balance

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/analysis/menu-engineering` | ✅ | BCG Matrix classification (estrella/caballo/puzzle/perro) |
| GET | `/api/balance/mes` | ✅ | Monthly P&L: ingresos, costos, ganancia, margen. `?mes=2&ano=2026` |
| GET | `/api/balance/comparativa` | ✅ | Last 12 months comparison |

---

## Daily Tracking

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/daily/purchases` | ✅ | Daily purchase prices. `?fecha=YYYY-MM-DD` or `?mes=2&ano=2026` |
| POST | `/api/daily/purchases/bulk` | ✅ | Import daily purchases (n8n). Matches by name/alias + updates stock |
| GET | `/api/daily/sales` | ✅ | Daily sales summaries |
| GET | `/api/monthly/summary` | ✅ | Complete monthly Excel-style report: purchases by ingredient + sales by recipe with costs |

---

## Intelligence

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/intelligence/freshness` | ✅ | Freshness alerts for perishables (pescado/marisco/carne) |
| GET | `/api/intelligence/purchase-plan` | ✅ | Purchase suggestions based on day-of-week consumption. `?day=6` (Saturday default) |
| GET | `/api/intelligence/overstock` | ✅ | Overstock detection using consumption rates vs stock levels |
| GET | `/api/intelligence/price-check` | ✅ | Recipes with food cost > 40% (target: 35%) |
| GET | `/api/intelligence/waste-stats` | ✅ | Waste statistics: monthly totals, top products, month comparison |

---

## Staff & Scheduling

### Empleados (Staff)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/empleados` | ✅ | List active employees |
| POST | `/api/empleados` | ✅ | Create employee |
| PUT | `/api/empleados/:id` | ✅ | Update employee |
| DELETE | `/api/empleados/:id` | ✅ | Soft delete (set activo=false) |

### Horarios (Schedules)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/horarios` | ✅ | Get schedules by range. `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (required) |
| POST | `/api/horarios` | ✅ | Assign shift (upsert on empleado_id+fecha) |
| DELETE | `/api/horarios/:id` | ✅ | Delete shift by ID |
| DELETE | `/api/horarios/empleado/:empleadoId/fecha/:fecha` | ✅ | Delete shift by employee+date |
| DELETE | `/api/horarios/all` | ✅ | Clear all schedules |
| POST | `/api/horarios/copiar-semana` | ✅ | Copy week. Body: `{semana_origen, semana_destino}` |

---

## Fixed Expenses

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/gastos-fijos` | ✅ | List active fixed expenses |
| POST | `/api/gastos-fijos` | ✅ | Create expense |
| PUT | `/api/gastos-fijos/:id` | ✅ | Update expense |
| DELETE | `/api/gastos-fijos/:id` | ✅ | Soft delete |

---

## Waste (Mermas)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/mermas` | ✅ | Register waste batch. Body: `{mermas: [{ingredienteId, cantidad, ...}]}` |
| GET | `/api/mermas` | ✅ | List waste history. `?mes=2&ano=2026&limite=100` |
| GET | `/api/mermas/resumen` | ✅ | Monthly summary: total losses, products, records |
| DELETE | `/api/mermas/:id` | ✅ | Soft delete + restore stock |
| DELETE | `/api/mermas/reset` | ✅ | Hard delete all current month waste |

---

## System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/` | ❌ | API info (name, version, endpoints) |
| GET | `/api/health` | ❌ | Basic health check |
| GET | `/debug-sentry` | ❌ | Trigger test error for Sentry |
| GET | `/api/system/health-check` | ✅ | Deep health: DB, recipes without ingredients, negative stock, inventory value, today's sales |
