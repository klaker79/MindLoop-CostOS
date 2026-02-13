# Auditoría Profesional — MindLoop CostOS (Frontend)

**Fecha:** 2026-02-13
**Auditor:** Claude Opus 4.6 (Senior Frontend Architect)
**Scope:** 84 archivos JS (~34,565 LOC) + 12 test suites (117 tests)
**Branch:** `claude/mindloop-costos-audit-R9eIi`

---

## P0 — CRITICOS (rompe funcionalidad)

### P0-1. [pedidos-cart.js:346-378] Discrepancia en cálculo del total del carrito vs pedido confirmado

- **Bug:** En `renderizarCarrito` (líneas 247-254), el total se calcula respetando el flag `precioYaEsUnitario`. Pero en `confirmarCarrito` (líneas 375-378), la "FÓRMULA INTOCABLE" SIEMPRE calcula `(cantidad / cantidadPorFormato) * precio`, ignorando `precioYaEsUnitario`.
- **Impacto:** El usuario ve un total correcto (ej: 24 botellas x 1.38EUR = 33.12EUR), pero el pedido se crea con un total diferente (ej: (24/24)*1.38 = 1.38EUR). Esto corrompe el total del pedido almacenado en la BD y afecta los cálculos de P&L/Balance.
- **Fix propuesto:** Unificar la fórmula de cálculo en ambos flujos. Respetar `precioYaEsUnitario` tanto en render como en confirmación.

### P0-2. [ingredientes-crud.js:90] Race condition — ingredienteAnterior lee datos ya actualizados

- **Bug:** `guardarIngrediente()` primero actualiza vía Zustand store (línea 76), que sincroniza `window.ingredientes` con los datos nuevos. Después (línea 90) busca `ingredienteAnterior` en `window.ingredientes`, pero ya contiene los datos NUEVOS, no los anteriores.
- **Impacto:** La lógica de "¿cambió el proveedor?" (línea 94) siempre compara el proveedor nuevo consigo mismo, por lo que NUNCA detecta cambios. El ingrediente se queda asociado al proveedor viejo y no se añade al nuevo. Código muerto por diseño.
- **Fix propuesto:** Guardar una copia de `ingredienteAnterior` ANTES de llamar al store update, no después.

### P0-3. [core.js:59-61] Pérdida silenciosa de datos en error de API

- **Bug:** Cada fetch en `cargarDatos` tiene fallback `r.ok ? r.json() : []`. Si la API falla (ej: timeout, 500), los datos existentes en `window.ingredientes/recetas/etc.` se SOBRESCRIBEN con arrays vacíos.
- **Impacto:** Un error transitorio de red borra todos los datos visibles del usuario. El dashboard muestra "0 ingredientes, 0 recetas, 0 pedidos" sin ningún mensaje de error.
- **Fix propuesto:** No sobrescribir `window.*` con arrays vacíos en caso de error. Mantener los datos previos y mostrar toast de error. Considerar usar `Promise.allSettled` en vez de `Promise.all`.

### P0-4. [ventas-ui.js:76] Sort de fechas roto — produce orden aleatorio

- **Bug:** Las claves de agrupación de ventas son strings de fecha formateados con `toLocaleDateString('es-ES')` (ej: "13/02/2026"). Después se sortean con `new Date(b) - new Date(a)`, pero `DD/MM/YYYY` no es parseable por `new Date()` en la mayoría de engines JS.
- **Impacto:** Las ventas en la tabla aparecen en orden aleatorio o completamente desordenado. Los usuarios no pueden encontrar las ventas por fecha.
- **Fix propuesto:** Usar la fecha ISO original (YYYY-MM-DD) como key del `Map` para sorting, y formatear solo para display.

### P0-5. [ingredientStore.js:34-40] Getters de Zustand nunca funcionan

- **Bug:** `totalValue` y `lowStockItems` están definidos como `get` properties en el objeto de estado. Zustand usa shallow merge y `getState()` devuelve un plain object — los getters nativos de JS se pierden.
- **Impacto:** `ingredientStore.getState().totalValue` devuelve `undefined` siempre. Cualquier código que dependa de estos getters no funciona.
- **Fix propuesto:** Convertir los getters en funciones normales del store: `getTotalValue: () => { ... }`, `getLowStockItems: () => { ... }`.

---

## P1 — IMPORTANTES (funciona mal)

### P1-1. [ingredientes-ui.js:226] División por cero — muestra "Infinity%" en UI

- **Bug:** `(precioMedio - precioBase) / precioBase * 100` donde `precioBase = parseFloat(ing.precio) || 0`. Si `precioBase` es 0, el resultado es `Infinity` o `-Infinity`. `Infinity.toFixed(0)` produce el string "Infinity" que se renderiza en el HTML.
- **Impacto:** Ingredientes con precio 0 muestran "Infinity%" como diferencia de precio. Confusión visual para el usuario.
- **Fix propuesto:** Añadir guard: `if (precioBase === 0) return 0` antes del cálculo.

### P1-2. [merma-rapida.js:152] División por cero — Infinity en valor de merma

- **Bug:** `const precioUnitario = precio / formato` donde `formato` puede ser 0 (del `data-formato` del HTML).
- **Impacto:** El valor de la merma aparece como "Infinity€" en la UI. Si se confirma, se envía `Infinity` al backend.
- **Fix propuesto:** Guard: `const formato = parseFloat(...) || 1` (ya existe en otras partes del código).

### P1-3. [balance/index.js:57-73] P&L no usa rendimiento/merma en cálculo de COGS

- **Bug:** El cálculo de COGS en el balance multiplica `precioUnitario * item.cantidad` pero NO aplica el factor de rendimiento que sí se aplica en `calcularCosteRecetaCompleto()`.
- **Impacto:** El COGS del P&L es menor que el coste real de las recetas, porque ignora las pérdidas por merma/rendimiento. El margen bruto aparece artificialmente inflado.
- **Fix propuesto:** Reutilizar `calcularCosteRecetaCompleto()` para calcular el coste de cada venta, en vez de duplicar la fórmula sin el factor de rendimiento.

### P1-4. [horarios.js:260] Turnos nocturnos calculan horas negativas

- **Bug:** `(hFin * 60 + mFin) - (hIni * 60 + mIni)` produce un número negativo si el turno cruza medianoche (ej: 22:00 a 06:00 = -960 minutos).
- **Impacto:** El total de horas trabajadas se reduce incorrectamente. Un empleado con turno nocturno podría aparecer con horas negativas.
- **Fix propuesto:** Si `fin < ini`, sumar 24h al cálculo: `duracion = fin < ini ? (fin + 1440 - ini) : (fin - ini)`.

### P1-5. [pedidos-ui.js:18] Crash cuando no hay proveedores cargados

- **Bug:** `window.proveedores.length` se accede directamente sin verificar que `window.proveedores` exista. Si la función se llama antes de `cargarDatos()`, explota con `TypeError`.
- **Impacto:** Si el usuario navega a Pedidos rápido después del login, la pantalla queda en blanco con error en consola.
- **Fix propuesto:** Usar `(window.proveedores || []).length`.

### P1-6. [pedidos-cart.js:70,107,239] Mismo patrón: crash en undefined

- **Bug:** Múltiples accesos directos a `window.ingredientes.find()` y `window.proveedores.find()` sin verificar que existan.
- **Impacto:** Crash del carrito si se accede antes de que los datos estén cargados.
- **Fix propuesto:** Usar `(window.ingredientes || [])` consistentemente.

### P1-7. [horarios.js:134-135,332-333] Departamentos hardcodeados por nombre

- **Bug:** `const COCINA = ['IKER', 'LAURA', 'FRAN', 'LOLA', 'BEA']` está duplicado en dos funciones. Clasificar empleados por nombre hardcodeado en el frontend.
- **Impacto:** Cada nuevo empleado o cambio de nombre requiere modificar el código fuente y redesplegar. Los empleados nuevos nunca aparecen en el departamento correcto.
- **Fix propuesto:** Mover la clasificación de departamento al backend como campo del empleado (`departamento: 'cocina'|'sala'`).

### P1-8. [saleStore.js:162-165] Filtrado de ventas del día usa timezone local

- **Bug:** `new Date().toDateString()` usa timezone local para comparar con `s.fecha` que puede estar en UTC.
- **Impacto:** Ventas registradas cerca de medianoche pueden contarse en el día equivocado (ej: una venta a las 23:30 hora local podría ser 00:30 UTC del día siguiente).
- **Fix propuesto:** Normalizar ambas fechas al mismo timezone antes de comparar.

### P1-9. [chat-widget.js:942-959] Datos sensibles enviados a webhook sin autenticación

- **Bug:** El contexto del chat envía TODOS los datos del negocio (precios, costes, márgenes, empleados, horarios, ventas, gastos fijos) al webhook de n8n sin header de Authorization.
- **Impacto:** Exposición total de datos financieros del restaurante si el endpoint de n8n es comprometido o está mal configurado.
- **Fix propuesto:** Añadir autenticación al webhook. Limitar los datos enviados al contexto mínimo necesario. No enviar precios exactos ni datos de empleados.

### P1-10. [onboarding.js:557-558,633-634] Navegación de pasos rota

- **Bug:** Los event bindings de `bindRecipeFormEvents` navegan al paso 2 (Pantry) en vez del paso 4 (Ingredients). `bindIngredientEvents` navega al paso 3 en vez del 5 (Results).
- **Impacto:** El wizard de onboarding salta a pasos incorrectos — el usuario no puede completar el flujo.
- **Fix propuesto:** Corregir los números de paso para que coincidan con los definidos en `renderStep`.

---

## P2 — SEGURIDAD

### P2-SEC-1. XSS — innerHTML con datos sin escapar

Los siguientes archivos inyectan datos de la API directamente en `innerHTML` sin sanitizar:

| Archivo | Líneas | Dato no escapado |
|---------|--------|-----------------|
| `pedidos-ui.js` | 32-33 | `prov.nombre` en `<option>` |
| `pedidos-cart.js` | 293 | `item.nombre`, `item.formatoCompra` |
| `merma-rapida.js` | 35 | `emp.nombre` en `<option>` |
| `merma-rapida.js` | 575 | `merma.producto` (texto de IA) |
| `horarios.js` | 153-195 | `emp.nombre`, `emp.color`, `emp.puesto` |
| `horarios.js` | 1445,1502 | Restaurant name, employee names en HTML exportado |
| `onboarding.js` | 293,424 | `recipe.nombre` |
| `inventario-masivo.js` | 1149 | `item.ingredienteNombre` |

- **Impacto:** Un nombre de ingrediente/proveedor/empleado malicioso (ej: `<img onerror=alert(1) src=x>`) ejecuta JavaScript arbitrario.
- **Fix propuesto:** Usar `escapeHTML()` (que ya existe en `sanitize.js`, `helpers.js`, y `app-core.js`) de forma consistente en TODOS los puntos de inserción de datos en el DOM.

### P2-SEC-2. [app-config.js:151-163] `setConfig` permite redirigir toda la API

- **Bug:** `setConfig('api.baseUrl', 'https://evil.com')` redirige TODAS las llamadas API a un servidor malicioso.
- **Impacto:** Cualquier XSS puede secuestrar toda la comunicación de la app.
- **Fix propuesto:** Hacer `setConfig` inmutable para campos sensibles (baseUrl, authUrl), o eliminarlo por completo si no se usa en producción.

### P2-SEC-3. [error-handler.js:43] Clasificación de errores por string matching causa falsos logouts

- **Bug:** `message.includes('token')` clasifica como error de auth. Un error "500 records processed with token format" deslogea al usuario.
- **Impacto:** Logouts inesperados por falsos positivos en la clasificación de errores.
- **Fix propuesto:** Clasificar errores por `error.status` (número HTTP), no por contenido del mensaje.

### P2-SEC-4. Token legacy en localStorage

- **Bug:** `localStorage.getItem('token')` se usa como fallback en `api/client.js:31` y en `services/api.js:57`. Aunque la app migró a httpOnly cookies, el token legacy sigue expuesto en localStorage.
- **Impacto:** Un ataque XSS puede leer el token de localStorage si algún usuario legacy aún lo tiene almacenado.
- **Fix propuesto:** Eliminar completamente las lecturas de `localStorage.getItem('token')` después de verificar que todos los usuarios usan cookies.

---

## P2 — MEJORAS (code quality)

### P2-1. Duplicación del API client: `window.api` vs `window.API` vs `apiClient`

- **Problema:** Tres clientes API coexisten:
  - `window.api` (lowercase): definido en `app-core.js:307-678`, con fetch directo
  - `window.API` (uppercase): definido en `services/api.js:561-605`, con fetch + retry + timeout
  - `apiClient` (ES module): definido en `api/client.js:79-215`, usado por Zustand stores
- **Beneficio:** Unificar en un solo cliente eliminaría ~600 LOC de duplicación y haría imposible que unos módulos usen un cliente y otros otro.

### P2-2. Dual state: `window.*` vs Zustand stores

- **Problema:** Los datos viven en dos lugares: `window.recetas` / `window.ingredientes` (legacy) Y `recipeStore` / `ingredientStore` (moderno). La sincronización es unidireccional (store -> window), pero `cargarDatos()` en `core.js` solo actualiza `window.*`, no los stores.
- **Beneficio:** Elegir UNA fuente de verdad eliminaría una clase entera de bugs de desincronización.

### P2-3. [app-core.js:762] `renderRevenueChart` hace 7 llamadas a `api.getSales()` en un loop

- **Problema:** Dentro del `for (let i = 6; i >= 0; i--)`, cada iteración llama a `api.getSales()` para TODAS las ventas, y luego filtra por fecha. Esto genera 7 requests idénticas a la API.
- **Beneficio:** Hacer un solo fetch y filtrar en memoria reduce latencia y carga del servidor un 85%.

### P2-4. [event-bindings.js:150-156] Sin guard contra múltiple inicialización

- **Problema:** `initEventBindings()` y `bindAllEvents()` pueden llamarse múltiples veces, acumulando event listeners duplicados en el document.
- **Beneficio:** Añadir flag `_initialized` previene handlers que se ejecutan 2-3 veces por click.

### P2-5. [ingredientes-ui.js:298] `<style>` inyectado en cada render

- **Problema:** `renderizarFiltrosCategorias()` inyecta un bloque `<style>` en el DOM cada vez que se llama. Los tags se acumulan indefinidamente.
- **Beneficio:** Mover el CSS a un archivo .css o inyectarlo una sola vez.

### P2-6. [onboarding.js:202-233,850-896] Funciones duplicadas (`renderConfiguration`)

- **Problema:** `renderConfiguration` y `bindConfigurationEvents` están definidas DOS veces en el archivo. La segunda definición sobrescribe la primera. La primera es dead code.
- **Beneficio:** Eliminar las definiciones muertas (líneas 202-280).

### P2-7. Dead code en `app-core.js`

- **Problema:** Cientos de funciones están comentadas con "MIGRADO A src/modules/X". El archivo tiene 2296 líneas pero ~60% es código migrado que sigue existiendo como comentarios.
- **Beneficio:** Eliminar código comentado. Si es necesario recuperar, está en git history.

### P2-8. `escapeHTML` definida 3 veces

- Definida en: `app-core.js:28`, `main.js:342`, `sanitize.js:52`
- **Beneficio:** Mantener una sola implementación exportada y reutilizada.

### P2-9. `debounce` definida 2 veces

- Definida en: `helpers.js` y `form-protection.js:283`
- **Beneficio:** Eliminar duplicado.

---

## PLAN DE TESTS (por orden de importancia)

### Test 1: "Cálculo de coste de receta con rendimiento/merma"
- **Archivo sugerido:** `src/__tests__/modules/recetas-coste.test.js`
- **Qué verifica:** Que `calcularCosteRecetaCompleto()` calcula correctamente con rendimiento
- **Casos:**
  - Receta con 1 ingrediente, rendimiento 100% => coste = precio_unitario * cantidad
  - Receta con rendimiento 80% => coste inflado un 25% (1/0.8)
  - Receta con rendimiento 0% => no divide por cero (debe tratar como 100%)
  - Receta con sub-receta (ingredienteId > 100000) => recursión correcta
  - Receta con porciones=0 => no divide por cero
  - Receta con precio_medio del inventario vs fallback a precio/formato
  - Receta sin ingredientes => devuelve 0

### Test 2: "Recepción de pedido — ajuste atómico de stock"
- **Archivo sugerido:** `src/__tests__/modules/pedidos-recepcion.test.js`
- **Qué verifica:** Que `confirmarRecepcionPedido()` ajusta stock correctamente
- **Casos:**
  - Recepción completa (todos OK) => stock incrementado, pedido marcado como "recibido"
  - Item "no-entregado" => ese ingrediente no se ajusta
  - Fallo parcial (bulk falla, fallback individual) => stock parcial, pedido NO se marca
  - Fallo total => pedido queda pendiente, usuario avisado
  - Varianza de precio => precio_real se guarda en el pedido

### Test 3: "Validación de entidades (ingrediente, receta, pedido)"
- **Archivo sugerido:** `src/__tests__/utils/validation.test.js`
- **Qué verifica:** Que `validateIngrediente/Receta/Pedido()` detectan errores
- **Casos:**
  - Nombre vacío => error
  - Precio negativo => error
  - Cantidad `NaN` => error (actualmente pasa `parseFloat(undefined) <= 0` = false)
  - Email inválido pero no vacío => error
  - Ingrediente sin campos opcionales => valid

### Test 4: "P&L / Balance calcula COGS con rendimiento"
- **Archivo sugerido:** `src/__tests__/modules/balance.test.js` (reemplazar el existente)
- **Qué verifica:** Que `calcularPL()` y `renderizarBalance()` usan el factor de rendimiento
- **Casos:**
  - Ingrediente con rendimiento 80% => COGS mayor que sin rendimiento
  - Sin ventas => ingresos = 0, COGS = 0
  - Break-even con OPEX > 0 => valor correcto

### Test 5: "Carrito de pedidos — total consistente"
- **Archivo sugerido:** `src/__tests__/modules/pedidos-cart.test.js`
- **Qué verifica:** Que el total mostrado y el total confirmado coinciden
- **Casos:**
  - `precioYaEsUnitario = true` => total = cantidad * precio (no dividir por formato)
  - `precioYaEsUnitario = false` => total = (cantidad / formato) * precio
  - Formato = 0 => no divide por cero
  - Carrito vacío => total = 0

### Test 6: "Zustand stores — CRUD y sincronización con window"
- **Archivo sugerido:** `src/__tests__/stores/recipeStore.test.js`
- **Qué verifica:** Que el store sincroniza `window.recetas` después de cada operación
- **Casos:**
  - `createRecipe` => `window.recetas` incluye la nueva
  - `deleteRecipe` => `window.recetas` no la incluye
  - `fetchRecipes` falla => `recipes` queda vacío pero no crashea
  - Filtros => `filteredRecipes` se actualiza

### Test 7: "Error handler — clasificación correcta"
- **Archivo sugerido:** `src/__tests__/utils/error-handler.test.js`
- **Qué verifica:** Que `classifyError()` no produce falsos positivos
- **Casos:**
  - Error con `.status = 401` => AUTH
  - Error con `.status = 500` => SERVER
  - Error con mensaje "500 records processed" => NO debe ser SERVER
  - Error con mensaje "my token is invalid" => NO debe ser AUTH si `.status` no es 401

### Test 8: "sanitize.js — funciones reales importadas"
- **Archivo sugerido:** `src/__tests__/utils/sanitize-real.test.js`
- **Qué verifica:** Que las funciones REALES de `sanitize.js` previenen XSS
- **Casos:**
  - `escapeHTML('<script>alert(1)</script>')` => escaped
  - `sanitizeURL('javascript:alert(1)')` => bloqueada
  - `sanitizeURL('https://valid.com')` => permitida

### Test 9: "Forecast — predicción de ventas"
- **Archivo sugerido:** `src/__tests__/modules/forecast.test.js`
- **Qué verifica:** `calcularForecast()` produce predicciones coherentes
- **Casos:**
  - 0 ventas => confianza "sin_datos"
  - 7 días de datos => confianza "baja"
  - 30+ días => confianza "alta"
  - Predicción para 7 días => array de 7 elementos

### Test 10: "API surface contract — AMPLIAR para cubrir window.API"
- **Archivo sugerido:** Ampliar `src/__tests__/api/api-surface-contract.test.js`
- **Qué verifica:** Que AMBOS clientes (`window.api` y `window.API`) tienen las mismas funciones
- **Casos:**
  - Todas las funciones de `services/api.js` están en `window.API`
  - Todas las funciones de `api/client.js` están en `window.api`
  - No hay funciones en un cliente que falten en el otro

---

## ROADMAP DE ESTABILIZACION (orden de ejecución)

### Paso 1: Fixes P0 (críticos que rompen funcionalidad)

1. **P0-1**: Unificar fórmula del carrito (`pedidos-cart.js`)
2. **P0-2**: Guardar `ingredienteAnterior` ANTES del store update (`ingredientes-crud.js`)
3. **P0-3**: No sobrescribir datos con arrays vacíos en error (`core.js`)
4. **P0-4**: Usar fecha ISO para sorting de ventas (`ventas-ui.js`)
5. **P0-5**: Convertir getters de Zustand a funciones normales (`ingredientStore.js`)

### Paso 2: Tests para proteger lo corregido

6. Crear tests 1-5 del Plan de Tests (recetas-coste, pedidos-recepcion, validation, balance, pedidos-cart)
7. Ampliar `api-surface-contract.test.js` para cubrir ambos clientes

### Paso 3: Fixes P1 (funciona mal)

8. **P1-1**: Guard de división por cero en `ingredientes-ui.js`
9. **P1-2**: Guard de división por cero en `merma-rapida.js`
10. **P1-3**: Usar `calcularCosteRecetaCompleto()` en Balance para COGS con rendimiento
11. **P1-4**: Fix de turnos nocturnos en `horarios.js`
12. **P1-5/6**: Añadir `(window.X || [])` en todos los accesos a datos globales
13. **P1-10**: Corregir navegación de pasos en onboarding

### Paso 4: Seguridad

14. **P2-SEC-1**: Audit exhaustivo de todos los `innerHTML` — reemplazar con `escapeHTML()` donde haya datos de usuario
15. **P2-SEC-2**: Bloquear `setConfig` para campos sensibles o eliminarlo
16. **P2-SEC-3**: Clasificar errores por `error.status`, no por string matching
17. **P2-SEC-4**: Eliminar lectura de token de localStorage si ya no se usa
18. **P1-9**: Añadir autenticación al webhook del chat, limitar datos enviados

### Paso 5: Tests de seguridad

19. Crear tests 7-8 (error-handler, sanitize)
20. Crear test de regresión XSS: verificar que `escapeHTML` se usa en todos los puntos de inyección

### Paso 6: Unificación de arquitectura

21. **P2-1**: Elegir UN solo cliente API (recomendado: `apiClient` de `api/client.js` con las mejoras de retry/timeout de `services/api.js`)
22. **P2-2**: Migrar `cargarDatos()` para actualizar Zustand stores como fuente de verdad, y que `window.*` sea un alias de solo lectura
23. **P2-3**: Fix del loop de 7 fetches en `renderRevenueChart`

### Paso 7: Limpieza

24. **P2-4**: Añadir flag `_initialized` a `initEventBindings`
25. **P2-5**: Mover CSS inline a archivos `.css`
26. **P2-6/7**: Eliminar dead code en `onboarding.js` y `app-core.js`
27. **P2-8/9**: Consolidar `escapeHTML` y `debounce` en una sola definición

### Paso 8: Tests de cobertura amplia

28. Crear tests 6, 9, 10 (stores, forecast, API surface ampliado)
29. Ejecutar `npm test:coverage` y verificar que se alcanza el 50% configurado
30. Integrar tests en CI/CD para prevenir regresiones

---

## NOTA SOBRE TESTS EXISTENTES

**Hallazgo crítico:** De los 12 test suites existentes (117 tests), solo 3 importan funciones reales del código fuente:
- `yield.test.js` importa `cost-calculator.js`
- `helpers.test.js` importa `helpers.js`
- `dom-helpers.test.js` importa `dom-helpers.js`

Los otros 9 test files (ingredientes, recetas, kpis, balance, inventario, logger, performance, sanitize) testean **aritmética inline** — no importan ni ejecutan el código real. Si alguien introduce un bug en `recetas-crud.js` o `validation.js`, ningún test lo detectará.

---

## RESUMEN EJECUTIVO

| Categoría | Cantidad |
|-----------|----------|
| P0 - Críticos | 5 |
| P1 - Importantes | 10 |
| P2 - Seguridad | 4 |
| P2 - Code Quality | 9 |
| Tests propuestos | 10 |
| Pasos del roadmap | 30 |

**Riesgo principal:** La coexistencia del sistema legacy (`window.*` + `app-core.js`) y el moderno (Zustand stores + ES modules) es la fuente de la mayoría de bugs. Cada fix puntual es un parche si no se avanza en la unificación.

**Recomendación:** Priorizar los 5 P0 + tests de protección ANTES de añadir nuevas features. El roadmap está ordenado para maximizar estabilidad con mínimo esfuerzo.
