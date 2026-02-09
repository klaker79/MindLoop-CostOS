# Database Schema Reference

> Multi-tenant PostgreSQL database. **Every table** includes `restaurante_id` for tenant isolation.

## Table Catalog

### Core Tables

#### `restaurantes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| nombre | VARCHAR(255) | Restaurant name |
| email | VARCHAR(255) | Owner email |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `usuarios`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | TEXT | bcrypt (cost 10) |
| nombre | VARCHAR(255) | |
| rol | VARCHAR(50) | `admin` or `usuario` |
| email_verified | BOOLEAN | DEFAULT FALSE |
| verification_token | TEXT | For email verification |
| verification_expires | TIMESTAMP | |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `api_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| nombre | VARCHAR(255) | e.g., "n8n Integration" |
| token_hash | TEXT | Last 20 chars hashed |
| expires_at | TIMESTAMP | |
| created_at | TIMESTAMP | DEFAULT NOW() |

---

### Ingredient Management

#### `ingredientes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| nombre | VARCHAR(255) | |
| proveedor_id | INT FK → proveedores | Primary supplier |
| precio | DECIMAL(10,2) | **Price per format** (not unit!) |
| unidad | VARCHAR(50) | Base unit: kg, l, ud |
| stock_actual | DECIMAL(10,2) | Virtual stock (auto-adjusted) |
| stock_real | DECIMAL(10,2) | Physical count (NULL when synced) |
| stock_minimo | DECIMAL(10,2) | Alert threshold |
| familia | VARCHAR(50) | `alimento`, `pescado`, `carne`, `marisco`, `verdura`, `lacteo`, `bebida`, `suministros` |
| activo | BOOLEAN | Soft toggle (NULL = active) |
| codigo | VARCHAR(20) | Optional internal code |
| formato_compra | VARCHAR(100) | e.g., "Barril 30L" |
| cantidad_por_formato | DECIMAL(10,2) | Units per purchase format |
| rendimiento | INT | Yield percentage (DEFAULT 100) |
| ultima_actualizacion_stock | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

> **Critical**: `precio` is the price of the purchase **format** (e.g., €50 for a 30L barrel). To get unit price: `precio / cantidad_por_formato`.

#### `ingredientes_alias`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| ingrediente_id | INT FK → ingredientes | |
| alias | VARCHAR(255) | Alternative name for matching |
| UNIQUE | (ingrediente_id, alias) | |

#### `ingredientes_proveedores`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| ingrediente_id | INT FK → ingredientes | |
| proveedor_id | INT FK → proveedores | |
| precio | DECIMAL(10,2) | Price from this supplier |
| es_proveedor_principal | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | |
| UNIQUE | (ingrediente_id, proveedor_id) | |

---

### Recipe Management

#### `recetas`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| nombre | VARCHAR(255) | |
| categoria | VARCHAR(100) | `entrante`, `principal`, `postre`, `bebida`, `vino`, etc. |
| precio_venta | DECIMAL(10,2) | Selling price |
| porciones | INT | Servings per batch (DEFAULT 1) |
| ingredientes | JSONB | `[{ingredienteId, cantidad, unidad}]` |
| codigo | VARCHAR(20) | TPV code (for sales matching) |
| deleted_at | TIMESTAMP | Soft delete |

> **JSONB `ingredientes` format**: `[{"ingredienteId": 5, "cantidad": 0.2, "unidad": "kg"}]`

#### `recetas_variantes`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| receta_id | INT FK → recetas | |
| restaurante_id | INT FK → restaurantes | |
| nombre | VARCHAR(100) | e.g., "Copa", "Botella" |
| factor | DECIMAL(5,3) | Stock deduction multiplier (e.g., 0.2 for glass) |
| precio_venta | DECIMAL(10,2) | Variant-specific price |
| codigo | VARCHAR(20) | TPV code for this variant |
| activo | BOOLEAN | DEFAULT TRUE |
| UNIQUE | (receta_id, nombre) | |

---

### Supply Chain

#### `proveedores`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| nombre | VARCHAR(255) | |
| contacto | VARCHAR(255) | Contact person |
| telefono | VARCHAR(50) | |
| email | VARCHAR(255) | |
| notas | TEXT | |
| created_at | TIMESTAMP | |

#### `pedidos` (Orders)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| proveedor_id | INT FK → proveedores | |
| fecha | TIMESTAMP | Order date |
| ingredientes | JSONB | `[{ingredienteId, cantidad, precioUnitario, cantidadRecibida, precioReal}]` |
| total | DECIMAL(10,2) | |
| total_recibido | DECIMAL(10,2) | |
| estado | VARCHAR(20) | `pendiente`, `recibido`, `cancelado` |
| fecha_recepcion | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

---

### Sales & Analytics

#### `ventas` (Sales)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| receta_id | INT FK → recetas | |
| variante_id | INT FK → recetas_variantes | NULL if no variant |
| cantidad | INT | |
| precio_unitario | DECIMAL(10,2) | |
| total | DECIMAL(10,2) | |
| factor_variante | DECIMAL(5,3) | Stored for accurate stock rollback |
| fecha | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

#### `ventas_diarias_resumen` (Daily Sales Summary)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| receta_id | INT FK → recetas | |
| fecha | DATE | |
| cantidad_vendida | INT | |
| precio_venta_unitario | DECIMAL(10,2) | |
| coste_ingredientes | DECIMAL(10,2) | |
| total_ingresos | DECIMAL(10,2) | |
| beneficio_bruto | DECIMAL(10,2) | |
| UNIQUE | (receta_id, fecha, restaurante_id) | |

#### `precios_compra_diarios` (Daily Purchase Prices)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| ingrediente_id | INT FK → ingredientes | |
| fecha | DATE | |
| precio_unitario | DECIMAL(10,2) | |
| cantidad_comprada | DECIMAL(10,2) | |
| total_compra | DECIMAL(10,2) | |
| proveedor_id | INT FK → proveedores | |
| pedido_id | INT FK → pedidos | |
| UNIQUE | (ingrediente_id, fecha, restaurante_id) | Upsert on conflict |

---

### Inventory Tracking

#### `inventory_adjustments_v2`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| ingrediente_id | INT FK → ingredientes | |
| cantidad | DECIMAL(10,2) | Adjustment amount |
| motivo | VARCHAR(100) | Reason |
| notas | TEXT | |
| created_at | TIMESTAMP | |

#### `inventory_snapshots_v2`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| ingrediente_id | INT FK → ingredientes | |
| stock_virtual | DECIMAL(10,2) | |
| stock_real | DECIMAL(10,2) | |
| diferencia | DECIMAL(10,2) | |
| created_at | TIMESTAMP | |

---

### Staff & Scheduling

#### `empleados`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| nombre | VARCHAR(255) | |
| color | VARCHAR(7) | Hex color for UI |
| horas_contrato | INT | Weekly contract hours |
| coste_hora | DECIMAL(10,2) | |
| dias_libres_fijos | TEXT | Fixed days off |
| puesto | VARCHAR(100) | Position |
| activo | BOOLEAN | Soft delete |

#### `horarios` (Schedules)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| empleado_id | INT FK → empleados | |
| fecha | DATE | |
| turno | VARCHAR(50) | `completo`, `mañana`, `tarde`, `noche` |
| hora_inicio | TIME | |
| hora_fin | TIME | |
| es_extra | BOOLEAN | Extra shift |
| notas | TEXT | |
| UNIQUE | (empleado_id, fecha) | |

---

### Financial

#### `gastos_fijos` (Fixed Expenses)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| concepto | VARCHAR(255) | e.g., "Alquiler", "Electricidad" |
| monto_mensual | DECIMAL(10,2) | |
| activo | BOOLEAN | Soft delete |
| updated_at | TIMESTAMP | |

---

### Waste Tracking

#### `mermas`
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| restaurante_id | INT FK → restaurantes | |
| ingrediente_id | INT FK → ingredientes | Nullable |
| ingrediente_nombre | VARCHAR(255) | Denormalized for history |
| cantidad | DECIMAL(10,2) | |
| unidad | VARCHAR(50) | |
| valor_perdida | DECIMAL(10,2) | |
| motivo | VARCHAR(100) | Reason category |
| nota | TEXT | |
| responsable_id | INT FK → empleados | |
| periodo_id | INT | YYYYMM format |
| fecha | TIMESTAMP | DEFAULT NOW() |
| deleted_at | TIMESTAMP | Soft delete |

## Key Data Patterns

### Soft Delete
Most tables use `deleted_at TIMESTAMP` — queries always filter `WHERE deleted_at IS NULL`.

### Multi-Tenancy
All queries filter by `restaurante_id = $N` using `req.restauranteId` from JWT.

### JSONB for Ingredients
`recetas.ingredientes` and `pedidos.ingredientes` store ingredient arrays as JSONB. Format:
```json
[
  {"ingredienteId": 5, "cantidad": 0.2, "unidad": "kg"},
  {"ingredienteId": 12, "cantidad": 1, "unidad": "ud"}
]
```

### Price Calculation
```
precio_unitario = ingredientes.precio / ingredientes.cantidad_por_formato
valor_stock = stock_actual × precio_unitario
food_cost_% = (coste_receta / precio_venta) × 100
```

### Stock Flow
```
Orders received  → stock_actual += cantidad (× cantidad_por_formato if applicable)
Sales registered → stock_actual -= (ing.cantidad / porciones) × cantidad_vendida × factor_variante
Mermas recorded  → stock_actual -= cantidad (done by frontend before API call)
Consolidation    → stock_actual = stock_real; stock_real = NULL
```
