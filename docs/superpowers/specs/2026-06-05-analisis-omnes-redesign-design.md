# Spec — Rediseño Ingeniería de Menú v2 (Análisis + Principios de Omnes)

**Fecha**: 2026-06-05
**Autor**: Iker + Claude (brainstorming guiado)
**Estado**: Aprobado para implementación tras review final
**Repos afectados**: `MindLoop-CostOS` (frontend), `lacaleta-api` (backend)
**Estrategia de despliegue**: `develop` → staging → validación Iker → `main` → prod
**Trigger comercial**: levantar la calidad del módulo Análisis para captación de clientes en España. Iker quiere "profesional y elegante con nuestro estilo" sin romper nada en producción.

## 1. Contexto y problema

El módulo Análisis actual (`src/legacy/app-core.js:921` + endpoint `GET /api/analysis/menu-engineering`) muestra una matriz BCG con 4 cuadrantes y listas por categoría. Funciona pero es pobre comparado con la herramienta Excel "Ingeniería de menús" que circula en la industria, que añade:

- Vista por plato individual con métricas + acciones específicas.
- Principios de Omnes (dispersión, amplitud de gama, calidad-precio) — análisis avanzado de estrategia de carta.
- Dashboard sintético con conteos por categoría.
- Estética editorial (iconos animales grandes, cards diferenciadas).

El módulo actual vive en `legacy/`, no está en producción como "killer feature" y no aporta valor demostrable en demo comercial. Para subir el ticket y captar los próximos clientes hay que llevar este módulo al nivel del Excel y mejor.

## 2. Objetivos

- Diferenciador comercial fuerte para demo (matriz BCG + Omnes en tiempo real con datos reales).
- Migrar el módulo de legacy a `src/modules/analisis/` siguiendo el patrón orchestrator + submódulos (como dashboard y chat).
- Mantener 100% de los cálculos canónicos existentes (no introducir inconsistencias de food cost ni de stock).
- Cero regresiones en producción (La Nave 5 sigue viendo todo lo que ya tenía).
- Multi-tenant inquebrantable (todo query con `WHERE restaurante_id`).

## 3. Alcance

### Dentro

- Refactor del módulo Análisis a `src/modules/analisis/` con orchestrator + submódulos.
- Dashboard sintético arriba con conteos por categoría + donut de distribución.
- Matriz BCG rediseñada con cards visuales por cuadrante.
- Modal drill-down por plato con métricas + acciones recomendadas + mini-chart 6 meses.
- Módulo Principios de Omnes (dispersión + amplitud de gama + relación calidad-precio).
- Filtro de periodo (Último mes / 3 meses / Año / Personalizado).
- Iconos SVG profesionales para los 4 cuadrantes.
- Nuevo endpoint backend `GET /api/analysis/omnes`.
- Parámetro opcional `?desde=&hasta=` en `/menu-engineering` existente.
- Tests unitarios (frontend Jest, backend Jest+Supertest).
- Tests E2E (Playwright contra staging).
- Bump del Service Worker (`v70 → v71`).

### Fuera

- Refactor de la tabla de rentabilidad actual (solo pulido visual).
- Nuevos cálculos de food cost o precio de ingredientes (se usa la misma fórmula canónica `getIngredientUnitPrice`).
- Cambios en backend de `/sales`, `/recipes` o `/ingredients`.
- Internacionalización completa de Omnes a en/zh (solo es-ES en este PR; en/zh quedan placeholders).
- Tutorial integrado tipo Loom (se planificó pero queda fuera del scope para no inflar; se añade en PR siguiente).
- Borrar el código viejo de `app-core.js` (queda como shim; eliminación en PR aparte de cleanup).

## 4. Arquitectura

### 4.1 Frontend — estructura de carpetas

```
src/modules/analisis/
├─ analisis.js              ← orchestrator (≤200 líneas): carga, periodo, llama subs
├─ analisis-state.js        ← periodo activo, cache de datos, helpers compartidos
├─ dashboard-sintetico.js   ← cards counts por categoría + donut distribución
├─ matriz-bcg.js            ← scatter chart Chart.js + listas por cuadrante
├─ plato-modal.js           ← modal drill-down individual
├─ omnes.js                 ← orchestrator de 3 cards Omnes
├─ omnes-dispersion.js      ← cálculo dispersión + render card
├─ omnes-amplitud.js        ← cálculo amplitud de gama + render card
├─ omnes-calidad.js         ← cálculo calidad-precio + render card
├─ rentabilidad-tabla.js    ← tabla existente (pulida)
├─ acciones-recomendadas.js ← catálogo de acciones por clasificación (constantes)
├─ iconos.js                ← SVG inline de los 4 animales
└─ styles.css               ← CSS modular del módulo
```

`renderizarAnalisis` y `renderMenuEngineeringUI` en `src/legacy/app-core.js` quedan como shims que delegan al módulo nuevo (compatibilidad backward durante migración). El shim se elimina en PR aparte tras validar en producción.

Funciones relacionadas también en `app-core.js` (`renderChartRentabilidad`, `renderChartIngredientes`, `renderChartMargenCategoria`, `renderRevenueChart`, `renderTablaRentabilidad`) — el plan de implementación las inventaría al inicio. Las que el rediseño hereda (tabla rentabilidad, charts de ingredientes/margen) se migran al módulo nuevo. Las que el rediseño reemplaza (chart rentabilidad → matriz BCG) se eliminan del flujo cuando el shim quede en pie.

### 4.2 Backend — endpoints

| Endpoint | Estado | Cambios |
|---|---|---|
| `GET /api/analysis/menu-engineering` | Existe | Añadir parámetros opcionales `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`. Default: histórico completo (compat back). |
| `GET /api/analysis/omnes` | NUEVO | Devuelve `{ dispersion, amplitud, calidad_precio, recomendacion_global }` para el rango. Usa misma exclusión non-food que `/menu-engineering` (vía `nonFoodCategoriesSqlList()`). |

Ambos con `authMiddleware`. Multi-tenant garantizado con `WHERE r.restaurante_id = $1 AND r.deleted_at IS NULL`. Soft-delete respetado en `recetas` y `ventas`.

### 4.3 Layout de la pestaña Análisis

Vertical, scroll natural, todo en una página:

1. **Header**: título "Ingeniería de Menú" + selector de periodo arriba derecha.
2. **Dashboard sintético**: 4 chips conteo por categoría + donut distribución.
3. **Matriz BCG**: scatter chart con cuadrantes + 4 listas debajo (una por cuadrante).
4. **Principios de Omnes**: 3 cards lado a lado + recomendación global.
5. **Tabla rentabilidad** (existente, pulida).

### 4.4 Modal drill-down

Trigger: click en punto del scatter O click en chip de lista.

Contenido:
- Animal grande de la clasificación + label + descripción corta.
- Métricas: ventas mes, popularidad %, precio venta, coste, margen contribución, food cost.
- Acciones recomendadas (5-8 bullets contextuales según clasificación).
- Mini-chart línea: evolución ventas últimos 6 meses.
- Botones: "Ver escandallo" (navega a Recetas con foco), "Cerrar".

### 4.5 Estilo visual

- Cards blancas, border-radius 16px, sombra `0 4px 16px rgba(0,0,0,0.06)`.
- Borde izquierdo 4px en color temático por categoría:
  - Estrella: verde `#10b981`
  - Puzzle: azul `#3b82f6`
  - Caballo: naranja `#f59e0b`
  - Perro: rojo `#ef4444`
- Iconos SVG ~48px en dashboard sintético, ~24px en chips, ~96px en modal.
- Tipografía: títulos 18-22px semibold, métricas 28-32px bold, descripciones 14px regular.
- Acento violeta `#7c3aed` en CTAs (heredado del estilo MindLoop).
- Whitespace generoso, layout en cards al estilo dashboard actual.

## 5. Algoritmos

### 5.1 Dispersión

```
precios = [precio_venta de cada plato food activo del periodo]
dispersion = max(precios) / min(precios)

estado:
  ≤ 2,5    → "ok"          🟢
  2,5-3,5  → "alta"        🟡
  > 3,5    → "muy_alta"    🔴

casos edge:
  precios vacío           → null, estado "sin_datos"
  min === 0 o min < 0,01  → null (precios inválidos, log warn)
```

### 5.2 Amplitud de gama

```
precio_medio = AVG(precio_venta)
gama_baja  = precio_venta < precio_medio * 0,75
gama_alta  = precio_venta > precio_medio * 1,25
gama_media = el resto

pct_baja  = count(gama_baja)  / total * 100
pct_media = count(gama_media) / total * 100
pct_alta  = count(gama_alta)  / total * 100

ideal = { baja: 25, media: 50, alta: 25 }
desviacion = |pct_baja - 25| + |pct_media - 50| + |pct_alta - 25|

estado:
  desviacion < 15  → "equilibrada"     🟢
  desviacion 15-30 → "desbalance"      🟡
  desviacion > 30  → "muy_desbalanceada" 🔴

casos edge:
  total === 0      → null, estado "sin_datos"
  total === 1      → null (no se puede analizar distribución)
```

### 5.3 Relación calidad-precio

```
precio_medio_ofertado = AVG(precio_venta) sobre TODOS los platos food activos
precio_medio_vendido  = SUM(precio_venta * cantidad_vendida) / SUM(cantidad_vendida)
ratio = precio_medio_vendido / precio_medio_ofertado

estado:
  0,95 ≤ ratio ≤ 1,05  → "equilibrado"  🟢
  ratio < 0,95         → "bajan"        ⬇️ (recomendación: subir precios)
  ratio > 1,05         → "suben"        ⬆️ (recomendación: mantener)

casos edge:
  precio_medio_ofertado === 0       → null
  SUM(cantidad_vendida) === 0       → null, estado "sin_ventas"
```

### 5.4 Recomendación global

Texto generado en cliente según estados de los 3:

```
si todos "ok" / "equilibrada" / "equilibrado":
  → "Tu carta está bien equilibrada. Mantén la estrategia."

si dispersión "alta" o "muy_alta":
  → "Reduce dispersión. Quita 2-3 platos de los extremos de precio."

si amplitud "desbalance" o "muy_desbalanceada":
  → "Reequilibra la distribución de precios. Apunta a 25/50/25."

si calidad-precio "bajan":
  → "Los clientes piden los platos más baratos. Sube precios medios un 5-7%."

si calidad-precio "suben":
  → "Los clientes piden los platos más caros. Mantén la estrategia o introduce más opciones de gama media."

(combina hasta 3 frases ordenadas por severidad)
```

## 6. Modelo de datos

### 6.1 Backend `/api/analysis/omnes` response

```json
{
  "periodo": { "desde": "2026-05-05", "hasta": "2026-06-05" },
  "dispersion": {
    "valor": 3.2,
    "estado": "alta",
    "precio_max": 28.50,
    "precio_min": 8.90,
    "platos_max": "Solomillo ibérico",
    "platos_min": "Ensalada simple"
  },
  "amplitud": {
    "baja_pct": 12,
    "media_pct": 41,
    "alta_pct": 47,
    "estado": "desbalance",
    "desviacion": 22,
    "total_platos": 17
  },
  "calidad_precio": {
    "ratio": 0.87,
    "estado": "bajan",
    "ofertado": 18.40,
    "vendido": 16.01,
    "unidades_vendidas": 1342
  },
  "recomendacion_global": "Reduce dispersión. Los clientes piden los platos más baratos, sube precios medios un 5-7%."
}
```

Si no hay datos suficientes, cada campo devuelve `null` con `estado: "sin_datos"`.

### 6.2 Estado del módulo frontend

`analisis-state.js` mantiene en memoria:
```
{
  periodo: { tipo: 'mes' | 'trimestre' | 'anio' | 'custom', desde: ISO, hasta: ISO },
  bcgData: array (cache del `/menu-engineering` para el periodo),
  omnesData: object (cache del `/analysis/omnes` para el periodo),
  ultimaActualizacion: timestamp
}
```

Cache se invalida al cambiar periodo o al pulsar "Refrescar".

## 7. Multi-tenant y seguridad

- `WHERE r.restaurante_id = $1 AND r.deleted_at IS NULL` en TODA query nueva.
- `LEFT JOIN ventas v ON v.receta_id = r.id AND v.restaurante_id = $1 AND v.deleted_at IS NULL`.
- Validar `desde`/`hasta` con `validateDate()` antes de query.
- Endpoint `/analysis/omnes` con `authMiddleware`. Cubierto por `globalLimiter` global (mismo patrón que el resto). Si CodeQL marca "Missing rate limiting", dismiss con misma justificación que migración 012.

## 8. Testing

### 8.1 Unit tests frontend (Jest + jsdom)

| Archivo | Cobertura |
|---|---|
| `tests/unit/omnes-dispersion.test.js` | 0 platos, 1 plato, precios iguales, max=min, ratio=2.5, ratio=10, precio_min=0 |
| `tests/unit/omnes-amplitud.test.js` | Distribución balanceada, sesgada baja, sesgada alta, todos iguales, 0/1/2 platos |
| `tests/unit/omnes-calidad.test.js` | Solo se venden los baratos, solo los caros, mix balanceado, 0 ventas, 0 platos |
| `tests/unit/analisis-state.test.js` | Cambio de periodo invalida cache, refrescar fuerza reload |
| `tests/unit/acciones-recomendadas.test.js` | Devuelve set correcto de bullets para cada clasificación |

Objetivo: pasar de 611 tests a 611 + ~25 nuevos. Todos los 611 originales deben seguir verdes.

### 8.2 Unit tests backend (Jest + Supertest)

| Archivo | Cobertura |
|---|---|
| `tests/critical/analysis-omnes.test.js` | endpoint responde 200 con tenant válido, 401 sin token, valores numéricos coherentes, multi-tenant aislado (tenant A NO ve datos de B), exclusión correcta de bebidas y categorías base, periodo personalizado funciona, sin ventas devuelve estados "sin_datos" |

### 8.3 E2E tests (Playwright contra staging)

| Archivo | Cobertura |
|---|---|
| `tests/e2e/analisis-bcg-load.spec.js` | Login Demo Trattoria, navegar a Análisis, ver dashboard sintético, ver scatter chart, ver 3 cards Omnes |
| `tests/e2e/analisis-modal-plato.spec.js` | Click en plato del scatter abre modal, modal tiene métricas y acciones, cerrar con X |
| `tests/e2e/analisis-filtro-periodo.spec.js` | Cambiar de "mes" a "trimestre" recarga datos visibles |

### 8.4 Regresión

- Suite frontend completa antes y después: 611 ✅ → 611 + nuevos ✅.
- Suite backend completa antes y después: 161 unit + critical ✅.
- Lint frontend 0 errores ✅.
- Lint backend 0 errores ✅.
- Build frontend OK ✅.
- Smoke test post-deploy en staging: matriz BCG sigue clasificando los mismos platos en los mismos cuadrantes (los datos no cambian, solo la UI).
- Multi-tenancy-validator agent corre en CI sobre el backend nuevo → 0 hallazgos críticos.
- Formula-validator agent corre antes de PR a main → confirma que `getIngredientUnitPrice` sigue en 13 módulos.

## 9. Plan de despliegue

| Día | Hito |
|---|---|
| D1 | Branch `feat/analisis-omnes-redesign` en backend. Endpoint `/analysis/omnes` + parámetro periodo en `/menu-engineering`. Tests backend verdes. Push → PR → merge develop → Dokploy redeploy staging-api. |
| D2 | Branch `feat/analisis-omnes-redesign` en frontend. Módulo skeleton + state + dashboard sintético + filtro periodo. Shims en legacy delegando al módulo nuevo. |
| D3 | Matriz BCG refactor + scatter chart + iconos SVG. Tests unit dashboard + matriz. |
| D4 | Modal drill-down + acciones recomendadas + mini-chart 6 meses. |
| D5 | Principios de Omnes UI (3 cards + recomendación global). Tests unit Omnes + E2E. Lint + build verdes. SW bump v70 → v71. Push → PR → merge develop → Dokploy redeploy staging-frontend con Clean Cache. |
| D6 | QA contigo en staging (tenant Demo Trattoria KL). Ajustes finales. Si OK → PR develop → main en los 2 repos. |

Eliminación del código legacy queda en PR aparte de cleanup (T+1 semana) tras validar estabilidad en producción.

## 10. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Romper la matriz BCG actual durante migración | Media | Alto | Shims en legacy + tests de regresión + validar en staging antes de prod |
| Cálculos Omnes mal hechos | Media | Alto | Unit tests por algoritmo + verificar SQL contra cálculo JS + revisar con formula-validator |
| Cambio de UI confunde a usuarios actuales | Baja | Medio | Layout mantiene la matriz BCG arriba (lo familiar) + tooltip explicativo Omnes primera vez |
| Performance: cargar 6 meses lento | Baja | Bajo | Cache en `analisis-state.js`, recalcula solo al cambiar periodo |
| CodeQL flag "Missing rate limiting" en endpoint nuevo | Alta | Bajo (FP) | Dismiss con justificación globalLimiter (mismo patrón migración 012) |

## 11. Memoria relacionada

- `project_kpis_sellados_2026_04_20.md` — fórmulas canónicas que NO se deben romper.
- `project_formulas_verified.md` — unificación Jack Miller.
- `feedback_no_more_calc_errors.md` — tolerancia cero a discrepancias.
- `feedback_no_precio_medio_compra.md` — getIngredientUnitPrice como única fuente.
- `feedback_reglas_duras_tenants.md` — La Nave 5 intocable, multi-tenancy inquebrantable.
- `project_app_tabs_map_2026_05_14.md` — mapa de pestañas verificado.
- `infrastructure_staging.md` — config de staging.
- `reference_e2e_testing.md` — Playwright contra staging.

## 12. Notas finales

- El módulo Omnes es la pieza diferenciadora vs competencia. Justifica el ticket de 95€/mes + add-ons.
- El refactor de legacy a modular es una inversión de mantenibilidad — futuras mejoras al módulo Análisis serán mucho más rápidas y seguras.
- Tras este PR, queda libre el camino para añadir en futuros sprints: comparativa mes anterior, predicciones, simulador de cambios de precio, exportar PDF del informe.
