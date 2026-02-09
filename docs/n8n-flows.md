# Flujos n8n — MindLoop CostOS

## Resumen

| # | Flujo | Trigger | Destino API | Frecuencia |
|---|-------|---------|-------------|------------|
| 1 | Importación Facturas MAICA | Google Sheets (nueva fila) | `POST /api/daily/purchases/bulk` | Cada minuto |
| 2 | Importación Ventas TPV | Gmail (email con PDF) | `POST /api/sales/bulk` | Cada minuto |
| 3 | Chef Costos (Chatbot IA) | Webhook POST | Consultas SQL directas a BD | On-demand |

---

## Flujo 1: Importación Facturas MAICA

```
Google Sheets Trigger → Transformar Compras (JS) → POST /api/daily/purchases/bulk
```

**Trigger**: Nueva fila en hoja `FACTURAS_MAICA` del spreadsheet `BASE_MAICA`
- Credencial: `Sheets_LANAVEAPP_API` (OAuth2)
- Poll: cada minuto

**Transformación JS**:
- Parsea columna `PRODUCTOS` (JSON string con array)
- Convierte fecha `DD/MM/YYYY` → `YYYY-MM-DD`
- Extrae: `ingrediente`, `precio`, `cantidad`, `fecha`
- Filtra productos sin descripción o cantidad ≤ 0

**Destino**: `POST https://lacaleta-api.mindloop.cloud/api/daily/purchases/bulk`
- Auth: Header Auth (`qGVzYQT9hgb5e4LT`)
- Header extra: `origin: https://app.mindloop.cloud`

---

## Flujo 2: Importación Ventas TPV (PDF por Email)

```
Gmail Trigger → Claude Sonnet (OCR) → Transformar JS → POST /api/sales/bulk → ¿Errores? → Email resumen
```

**Trigger**: Email no leído de `ikerameas@gmail.com` con adjunto
- Credencial: `Gmail account` (OAuth2)
- Poll: cada minuto
- Descarga adjuntos automáticamente

**IA (Claude Sonnet)**: Analiza el PDF del TPV
- Modelo: `claude-sonnet-4-20250514`
- Prompt: Extrae líneas de venta con código numérico 5-6 dígitos
- Output esperado: `{ fecha, ventas: [{ codigo, descripcion, unidades, importe, familia }] }`
- Max tokens: 32000

**Transformación JS**:
- Limpia markdown del output de Claude
- Parsea JSON
- Mapea a: `{ receta, codigo_tpv, cantidad, total, fecha }`
- Fecha: usa la del documento o fecha actual

**Destino**: `POST https://lacaleta-api.mindloop.cloud/api/sales/bulk`
- Auth: Header Auth (misma credencial)

**Post-proceso**:
- Si `fallidos > 0` → Email HTML con resumen (procesados vs errores)
- Si OK → NoOp (Report Success)

---

## Flujo 3: Chef Costos — Chatbot IA Contable

```
Webhook POST → AGENTE CONTABLE (GPT-4o) → Respond to Webhook
                    ↓ (fallback)
               AI Agent (Gemini/Claude)
```

**Trigger**: Webhook POST
- Path: `3f075a6e-b005-407d-911c-93f710727449`
- CORS: `*`
- Payload esperado: `{ message, sessionId, fechaHoy, contexto: { totalIngredientes, totalRecetas, gastosFijos, valorTotalStock } }`

**Agente principal**: `AGENTE CONTABLE`
- LLM primario: GPT-4o (temp=0)
- LLM fallback: Claude Sonnet 4.5
- Memory: PostgreSQL Chat Memory (por sessionId, credencial `Postgres_servicioiker`)
- On error: continúa a agente fallback

**Agente fallback**: `AI Agent`
- LLM primario: Google Gemini
- LLM fallback: Claude Sonnet 4.5
- Memory: PostgreSQL Chat Memory (por sessionId, credencial `Postgres_servicioanais`)

### Herramientas SQL (15 tools, duplicadas en ambos agentes)

> ⚠️ **IMPORTANTE**: Todas las queries tienen `restaurante_id = 3` hardcodeado

| Tool | Qué hace | Tabla(s) |
|------|----------|----------|
| `obtener_ingredientes` | Lista ingredientes con stock y precio | `ingredientes`, `proveedores` |
| `obtener_recetas` | Recetas con costes e ingredientes | `recetas` |
| `obtener_ventas` | Historial ventas (últimas 100) | `ventas`, `recetas` |
| `obtener_gastos` | Gastos fijos | `gastos_fijos` |
| `obtener_proveedores` | Lista proveedores | `proveedores` |
| `obtener_pedidos` | Compras a proveedores (últimos 100) | `pedidos`, `ingredientes`, `proveedores` |
| `obtener_resumen_ventas` | KPIs ventas últimos 7 días | `ventas`, `recetas` |
| `obtener_horarios` | Turnos de trabajo | `horarios`, `empleados` |
| `stock_critico` | Ingredientes bajo mínimos | `ingredientes`, `proveedores` |
| `analisis_ventas_periodo` | Ingresos diarios últimos 7 días | `ventas` |
| `top_recetas_vendidas` | Top 20 recetas último mes | `ventas`, `recetas` |
| `comparar_precios_proveedores` | Precio unitario por proveedor | `ingredientes`, `proveedores` |
| `detectar_perdidas` | Recetas con food cost >33% | `recetas`, `ingredientes` |
| `ingredientes_multiples` | Ingredientes con 2+ proveedores | `ingredientes_proveedores` |
| `comparar_precios_ingrediente_proveedor` | Precios por proveedor (tabla relación) | `ingredientes_proveedores` |
| `ingenieria_menu` | Clasificación ⭐🐴❓🐕 (BCG matrix) | `recetas`, `ventas`, `ingredientes` |
| `generar_pnl_completo` | P&L con fechas dinámicas (`$fromAI`) | `ventas`, `recetas`, `ingredientes`, `gastos_fijos` |

### System Prompt (resumen)
- Rol: Chef Ejecutivo y CFO virtual
- Fórmulas: Food cost, precio ideal (30% comida, 45-50% vinos)
- Umbrales: Comida ≤28% 🟢 | >38% 🔴 · Vinos ≤40% 🟢 | >50% 🔴
- Formato: Emojis, máximo 10 líneas, negrita, 2 decimales
- Regla clave: Vinos son RECETAS, no ingredientes

---

## Observaciones técnicas

1. **`restaurante_id = 3` hardcodeado** en todas las tools del chatbot → No es multi-tenant
2. **Dos credenciales PostgreSQL distintas**: `Postgres_servicioanais` (agente principal) y `Postgres_servicioiker` (memory del agente principal)
3. **Tools duplicadas**: Cada agente tiene su copia exacta de las 15 tools (podría simplificarse con sub-workflows)
4. **`obtener_gastos` desconectado**: En el agente principal, la conexión de `obtener_gastos` va a un array vacío `[]` — posible bug
5. **Auth compartida**: Todos los flujos usan la misma credencial Header Auth `qGVzYQT9hgb5e4LT`
