# AUDITORÍA TÉCNICA — MindLoop CostOS Frontend
**Fecha:** 2026-02-19
**Auditor:** Claude (Sonnet 4)
**Repo auditado:** `mindloop-costos` (frontend únicamente — `lacaleta-api` no disponible)
**Estado:** Solo informe — no se modificó ningún archivo

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad |
|-----------|----------|
| 🔴 Crítico | 4 |
| 🟡 Medio | 8 |
| 🟢 Bajo | 4 |

**Riesgo más alto en producción:** Los bugs C1 y C2 distorsionan cifras financieras visibles al usuario (valor de stock y precio medio ponderado). El bug M1 puede enviar tráfico de desarrollo directamente a la API de producción.

> **Nota sobre el backend:** La API (`lacaleta-api`) no está en este repo. Los bugs relativos a cómo el backend maneja `cantidad_por_formato` en `adjust-stock` no se pueden verificar aquí. Se señalan como riesgo M5.

---

## 🔴 CRÍTICOS

---

### C1 — `ingredientStore.totalValue` no aplica `cantidad_por_formato`

**Archivo:** `src/stores/ingredientStore.js:38–40`

```js
// CÓDIGO ACTUAL (INCORRECTO):
totalValue: () => {
    return state.ingredients.reduce((sum, ing) => {
        const precio = parseFloat(ing.precio) || 0;   // precio POR FORMATO (e.g. €50/barril)
        const stock = parseFloat(ing.stock_actual) || 0; // en unidades base (e.g. 60 L)
        return sum + (precio * stock);  // €50 × 60L = €3.000 ❌ (correcto sería €100)
    }, 0);
},
```

**Impacto en producción:**
El valor total del stock mostrado en el dashboard es incorrecto para cualquier ingrediente cuyo `cantidad_por_formato > 1`. Un barril de 30L a €50 tiene 60L en stock → el sistema muestra €3.000 en vez de €100. La cifra "Valor de Stock" del KPI puede estar inflada por un factor de ×30 o más.

**Fix sugerido:**
```js
// CORRECTO:
return sum + ((precio / (parseFloat(ing.cantidad_por_formato) || 1)) * stock);
```

---

### C2 — `pedidos-crud.js` WAP mezcla unidades de formato con unidades base

**Archivo:** `src/modules/pedidos/pedidos-crud.js:210–213`

```js
// CÓDIGO ACTUAL (INCORRECTO) — solo ejecutado en "compra de mercado":
const stockActual = parseFloat(ing.stock_actual || 0); // ← en base units, e.g. 60 L
const cantidadRecibida = parseFloat(item.cantidad || 0); // ← en FORMAT units, e.g. 2 barriles

const stockSinCompra = stockActual - cantidadRecibida;
// 60L - 2 barriles = 58 ← UNIDADES INCOMPATIBLES

let precioMedioPonderado = (stockSinCompra * precioAnterior + cantidadRecibida * precioNuevo) / stockActual;
// Resultado: precio medio ponderado incorrecto
```

**Impacto en producción:**
Cuando se registra una "compra de mercado" de un ingrediente con formato (`cantidad_por_formato > 1`), el precio medio ponderado que se guarda en la BD es incorrecto. Todos los cálculos de food cost basados en `ingrediente.precio` quedan contaminados para ese ingrediente hasta la próxima compra que corrija el precio.

**Fix sugerido:**
```js
const cantFormato = parseFloat(ing.cantidad_por_formato) || 1;
const cantidadEnBaseUnits = cantidadRecibida * cantFormato; // convertir a base units
const stockSinCompra = stockActual - cantidadEnBaseUnits;
```

---

### C3 — `modales.js` Punto de Equilibrio usa precio de formato en vez de precio unitario

**Archivo:** `src/legacy/modales.js:524–533`

```js
// CÓDIGO ACTUAL (INCORRECTO):
rec.ingredientes.forEach(ing => {
    const ingData = window.ingredientes?.find(i => i.id === ing.ingredienteId);
    if (ingData) {
        costeReceta += (parseFloat(ingData.precio) || 0) * (ing.cantidad || 0);
        //              ↑ precio POR FORMATO                ↑ cantidad en base units
        //              €50/barril × 0.5 kg = €25 ❌ (correcto: €1.67/L × 0.5L = €0.83)
    }
});
```

**Impacto en producción:**
El "Punto de Equilibrio Mensual" y el cálculo de "margen promedio por plato" en el panel de beneficio neto diario están inflados por un factor de ×`cantidad_por_formato`. El punto de equilibrio que ve el dueño en el widget del dashboard es completamente incorrecto para restaurantes con ingredientes a granel.

**Fix sugerido:**
```js
costeReceta += ((parseFloat(ingData.precio) || 0) / (parseFloat(ingData.cantidad_por_formato) || 1)) * (ing.cantidad || 0);
```

---

### C4 — `merma-rapida.js`: mermas marcadas como éxito antes de llamar al backend, y llamada condicional que puede silenciar errores

**Archivo:** `src/modules/inventario/merma-rapida.js:285–366`

```js
// PROBLEMA 1 — "éxito" registrado ANTES de llamar a la API (líneas 292-296):
actualizacionesExitosas.push({
    id: ingrediente.id,
    nombre: ingrediente.nombre,
    cantidadMerma
});
// ^ Se registra como éxito ANTES de que se llame al backend

// PROBLEMA 2 — La llamada al backend es CONDICIONAL (línea 356):
if (mermasParaBackend.length > 0 && window.API?.fetch) {
    await window.API.fetch('/api/mermas', { method: 'POST', ... });
}
// Si window.API no existe o no tiene 'fetch', las mermas NO se guardan en BD
// El usuario ve "✅ merma registrada" pero la BD no tiene el registro
```

**Impacto en producción:**
Si `window.API` no está disponible en el momento de ejecutar `confirmarMermasMultiples` (por un problema de inicialización de módulos), el usuario recibe un toast de éxito pero la merma no se persiste. El stock se descuenta visualmente pero no en la BD. Próxima recarga: el stock reaparece sin la deducción.

**Fix sugerido:**
- Mover `actualizacionesExitosas.push()` a DESPUÉS de que la API responde con éxito.
- Cambiar a `await window.api.fetch(...)` (lowercase `api` — más robusto) o `await apiClient.post('/mermas', {...})`.
- Si la llamada a la BD falla, lanzar el error y no mostrar toast de éxito.

---

## 🟡 MEDIOS

---

### M1 — Legacy code usa `||` en vez de `??` → en desarrollo, requests van a PRODUCCIÓN

**Archivos afectados (todos con el mismo patrón):**
- `src/legacy/modales.js:218` — `getGastosApiBase()`
- `src/legacy/modales.js:655` — `startTokenRefresh()`
- `src/legacy/app-core.js:226` — `getAuthApiBase()`
- `src/legacy/app-core.js:290` — `getApiBase()`
- `src/legacy/app-core.js:2321` — inlined
- `src/legacy/inventario-masivo.js:721` — `parse-pdf` call
- `src/legacy/inventario-masivo.js:1324` — `monthly/summary` call

```js
// PATRÓN (INCORRECTO):
window.API_CONFIG?.baseUrl || 'https://lacaleta-api.mindloop.cloud'

// Por qué es incorrecto:
// En producción: API_CONFIG.baseUrl = 'https://lacaleta-api.mindloop.cloud' → OK
// En desarrollo: API_CONFIG.baseUrl = '' (string vacío, para proxy Vite)
//   '' || 'https://lacaleta-api...' = 'https://lacaleta-api...' ❌ (usa producción)
//   '' ?? 'https://lacaleta-api...' = '' ✅ (usa URL relativa → proxy)
```

**Impacto en producción:**
En entorno de desarrollo (con `vite dev`), las 7 funciones del código legacy llaman directamente a la API de producción en vez de usar el proxy de Vite. Cualquier test o debug en local puede contaminar datos reales de producción (stock, mermas, gastos, etc.).

**Fix sugerido:** Reemplazar `||` por `??` en los 7 lugares:
```js
// CORRECTO:
window.API_CONFIG?.baseUrl ?? 'https://lacaleta-api.mindloop.cloud'
```

---

### M2 — Dark mode: 30+ `background: white` en template literals sin ningún override CSS

**Archivos con más ocurrencias:**
- `src/modules/horarios/horarios.js:147,175,181,293,296,299,1290,1302,1379`
- `src/modules/docs/dossier-v24.js:44,77,103,177,201,239,259`
- `src/modules/chat/chat-styles.js:75,212,315,346,450`
- `src/modules/ingredientes/ingredientes-ui.js:58,90`
- `src/modules/equipo/equipo.js:68`
- `src/modules/recetas/recetas-ui.js:127,162`
- `src/modules/recetas/recetas-variantes.js:161,282`
- `src/modules/pedidos/pedidos-detalles.js:137`
- `src/modules/inventario/merma-rapida.js:87`
- `src/modules/pedidos/compras-pendientes-ui.js:135`
- `src/modules/search/global-search.js:38`

**`styles/polish.css` no contiene** ninguna regla `@media (prefers-color-scheme: dark)`.
Los inline styles en template literals tienen mayor especificidad que cualquier selector CSS externo, por lo que no pueden anularse desde CSS.

**Impacto en producción:**
Todos los usuarios con dark mode activado en su OS ven tarjetas, modales, tablas y botones con fondo blanco sobre fondo oscuro del sistema → contraste muy bajo o texto invisible.

**Fix sugerido (global):**
Añadir al final de `polish.css`:
```css
@media (prefers-color-scheme: dark) {
    /* O usar [data-theme="dark"] si se implementa un toggle */
    .merma-linea,
    .equipo-card,
    .horario-card { background: var(--surface, #1e293b) !important; }

    #global-search-results {
        background: var(--surface, #1e293b) !important;
        border-color: #334155 !important;
    }
}
```
O migrar los estilos de los template literals a clases CSS.

---

### M3 — `GASTOS_FIJOS_MAP` hardcodea IDs 1, 2, 3, 4 de la tabla `gastos_fijos`

**Archivo:** `src/legacy/modales.js:204–209`

```js
// CÓDIGO ACTUAL (PROBLEMÁTICO):
const GASTOS_FIJOS_MAP = {
    'alquiler':     { id: 1, concepto: 'Alquiler' },
    'personal':     { id: 2, concepto: 'Nóminas' },
    'suministros':  { id: 3, concepto: 'Agua' },
    'otros':        { id: 4, concepto: 'Luz' }
};

// Uso (línea 265):
await fetch(getGastosApiBase() + '/gastos-fijos/' + gastoInfo.id, { method: 'PUT', ... });
// → PUT /api/gastos-fijos/1 siempre, independientemente del ID real en BD
```

**Impacto en producción:**
Si la BD tiene los gastos fijos con IDs distintos de 1-4 (tras una migración, recreación de BD, o inserción de datos en orden diferente), `guardarGastoFinanzas()` actualiza las filas incorrectas. El restaurante podría ver "Alquiler" guardado como "Agua" o viceversa.

**Fix sugerido:**
Buscar el ID dinámicamente al cargar, usando `fetchGastosFijos()` que ya devuelve los conceptos:
```js
const gastos = await fetchGastosFijos();
const gastoTarget = gastos.find(g => g.concepto.toLowerCase() === gastoInfo.concepto.toLowerCase());
if (gastoTarget) {
    await fetch(getGastosApiBase() + '/gastos-fijos/' + gastoTarget.id, ...);
}
```

---

### M4 — `localStorage.getItem('user')` como comprobación de autenticación

**Archivos:** `src/legacy/modales.js:371,685` · `src/legacy/app-core.js:231` · `src/legacy/inventario-masivo.js:1313` · `src/main.js:702,714`

```js
// PATRÓN PROBLEMÁTICO:
if (localStorage.getItem('user')) {
    cargarValoresGastosFijos();  // Dispara request a la API
    startTokenRefresh();         // Inicia interval de verificación
}
```

**Impacto en producción:**
- `localStorage` es modificable por JS (XSS, extensiones de navegador, o accidentalmente en dev tools).
- Si el usuario hace logout pero no se limpia `localStorage`, las funciones se inicializan de nuevo al recargar con datos obsoletos.
- La fuente de verdad de autenticación debe ser `window.authToken` o `sessionStorage.getItem('_at')` (ambos ya usados en `api/client.js`).

**Fix sugerido:**
```js
// Consistente con el resto de la app:
if (window.authToken || sessionStorage.getItem('_at')) {
    cargarValoresGastosFijos();
    startTokenRefresh();
}
```

---

### M5 — `pedidos-recepcion.js` y `pedidos-crud.js` envían delta en FORMAT units, no base units

**Archivos:** `src/modules/pedidos/pedidos-recepcion.js:289` · `src/modules/pedidos/pedidos-crud.js:171`

```js
// pedidos-recepcion.js:289
const adjustments = ingredientesActualizados
    .filter(...)
    .map(item => ({
        id: item.ingredienteId,
        delta: parseFloat(item.cantidadRecibida)  // ← número de FORMATOS recibidos (e.g. 2 barriles)
    }));

// pedidos-crud.js:171 (compra mercado)
const stockAdjustments = ingredientesPedido
    .map(item => ({
        id: item.ingredienteId,
        delta: parseFloat(item.cantidad)  // ← ídem, número de FORMATOS
    }));

// Ambos llaman a:
await window.api.bulkAdjustStock(adjustments, 'recepcion_pedido');
// PUT /api/ingredients/bulk-adjust-stock → { adjustments: [{id, delta}] }
```

**Impacto en producción:**
Si el backend de `bulk-adjust-stock` suma `delta` directamente a `stock_actual` sin multiplicar por `cantidad_por_formato`, entonces recibir 2 barriles de 30L añade solo 2 L al stock en vez de 60 L. **Esto requiere verificación en `lacaleta-api`.**

El schema doc dice: `"Orders received → stock_actual += cantidad (× cantidad_por_formato if applicable)"`, pero no está claro si `bulk-adjust-stock` aplica este multiplicador o si lo aplica solo el endpoint `PUT /api/orders/:id`.

**Fix sugerido (si el backend NO aplica cantidad_por_formato):**
```js
delta: parseFloat(item.cantidadRecibida) * (parseFloat(ing.cantidad_por_formato) || 1)
```

---

### M6 — `inteligencia-ui.js` fallback URL sin prefijo `/api`

**Archivo:** `src/modules/inteligencia/inteligencia-ui.js:8`

```js
const apiBase = window.getApiUrl
    ? window.getApiUrl()                           // ← correcto: devuelve baseUrl + '/api'
    : 'https://lacaleta-api.mindloop.cloud';       // ← falta '/api' al final
```

**Impacto en producción:**
Si `window.getApiUrl` no está disponible cuando se carga el módulo (race condition en la inicialización), todas las llamadas del módulo de inteligencia irán a `https://lacaleta-api.mindloop.cloud/intelligence` en vez de `.../api/intelligence` → HTTP 404. El usuario no ve ninguna alerta ni insight.

**Fix sugerido:**
```js
const apiBase = window.getApiUrl
    ? window.getApiUrl()
    : 'https://lacaleta-api.mindloop.cloud/api';  // ← añadir /api
```

---

### M7 — `balance/index.js` carga TODAS las ventas sin filtro de fechas

**Archivo:** `src/modules/balance/index.js:53–57`

```js
const ventas = await window.api.getSales(); // ← obtiene TODAS las ventas históricas
const ahora = new Date();
const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
const ventasMes = ventas.filter(v => v.fecha >= inicioMes); // ← filtra client-side
```

**Impacto en producción:**
Un restaurante con 1 año de operación puede tener miles de registros de ventas. `getSales()` los carga todos en memoria para luego descartar el 95%. Puede causar timeouts o errores de memoria en el navegador.

**Fix sugerido:**
```js
const ahora = new Date();
const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0];
const ventasMes = await window.api.getSales(inicioMes); // ← filtrar en el servidor
```
*(El endpoint `GET /sales?fecha=` ya existe en `api/client.js:289`.)*

---

### M8 — `balance/index.js` compara fechas como strings (puede fallar con timestamps)

**Archivo:** `src/modules/balance/index.js:56`

```js
const ventasMes = ventas.filter(v => v.fecha >= inicioMes);
// inicioMes = '2026-02-01' (date string)
// v.fecha puede ser '2026-02-15T14:30:00.000Z' (timestamp ISO)
// '2026-02-15T14:30:00.000Z' >= '2026-02-01' → true ✅ (funciona por suerte con ISO 8601)
// PERO: '2026-02-15 14:30:00' >= '2026-02-01' → true ✅ también OK
// PERO: '15/02/2026' >= '2026-02-01' → false ❌ (formato europeo fallaría)
```

**Impacto en producción:**
Si el backend alguna vez devuelve fechas en formato distinto de ISO 8601 (DD/MM/YYYY, etc.), el P&L mostrará €0 sin error visible.

**Fix sugerido:**
```js
const inicioMesMs = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
const ventasMes = ventas.filter(v => new Date(v.fecha).getTime() >= inicioMesMs);
```

---

## 🟢 BAJOS

---

### B1 — Carrito de pedidos persiste en `localStorage` entre sesiones y restaurantes

**Archivo:** `src/modules/pedidos/pedidos-cart.js:14–27`

```js
function initCarrito() {
    const saved = localStorage.getItem('pedidoCarrito'); // sin clave de restaurante_id
    ...
}
```

**Impacto:** Si el mismo navegador cambia de cuenta o de restaurante (multi-tenant), el carrito del restaurante anterior queda activo. Podría crear un pedido de Restaurante A como si fuera del Restaurante B.

**Fix:** Incluir `restaurante_id` en la clave: `localStorage.getItem('pedidoCarrito_' + window.restauranteId)`.

---

### B2 — `ingredientStore.lowStockItems()` trata `stock_actual = null` como stock = 0

**Archivo:** `src/stores/ingredientStore.js:43–49`

```js
lowStockItems: () => {
    return state.ingredients.filter(ing => {
        const stock = parseFloat(ing.stock_actual) || 0; // null → parseFloat(null) = NaN → || 0 = 0
        const minStock = parseFloat(ing.stock_minimo) || 0;
        return stock <= minStock && minStock > 0; // 0 <= minStock → siempre aparece
    });
},
```

**Impacto:** Ingredientes con `stock_actual = null` (estado "inventario físico registrado") aparecen en las alertas de stock bajo, generando falsas alarmas.

**Fix:** `if (ing.stock_actual === null || ing.stock_actual === undefined) return false;` antes del cálculo.

---

### B3 — `services/api.js` silencia errores devolviendo `[]` en fallo

**Archivo:** `src/services/api.js:115–121`

```js
// En caso de error no-recuperable:
if (normalizedEndpoint.includes('ingredients') || normalizedEndpoint.includes('mermas') || ...) {
    return []; // ← error silenciado, el caller no sabe que falló
}
return null;
```

**Impacto:** Si la API está caída o hay un error 500, `window.API.fetch('/api/mermas', ...)` devuelve `[]` en vez de lanzar el error. El caller (`merma-rapida.js`) no puede distinguir "mermas vacías" de "error de red". Los logs muestran el error pero el usuario no lo ve.

---

### B4 — `modales.js:89` divide por 30 días fijos para calcular coste diario

**Archivo:** `src/legacy/modales.js:89`

```js
const totalDiario = totalMensual / 30; // ← Febrero tiene 28-29 días, enero 31
```

**Impacto:** El coste diario de gastos fijos es ligeramente incorrecto. En febrero el coste real diario es `totalMensual / 28`, pero se muestra como `/ 30`. Pequeña discrepancia (≈7% en febrero).

**Fix:** `const diasMes = new Date(year, month, 0).getDate();` y usar `diasMes` en vez de `30`.

---

## CHECKLIST DE VERIFICACIÓN PENDIENTE (BACKEND)

Los siguientes puntos **no se pudieron verificar** porque `lacaleta-api` no está en este repo:

| # | Verificación | Riesgo si falla |
|---|---|---|
| V1 | `POST /api/ingredients/:id/adjust-stock` — ¿multiplica `delta × cantidad_por_formato`? | 🔴 Stock siempre incorrecto en recepción de pedidos |
| V2 | `POST /api/ingredients/bulk-adjust-stock` — ¿ídem? | 🔴 Mismo riesgo para compras en masa |
| V3 | `POST /api/purchases/pending/:id/approve` — ¿actualiza stock, precios_compra_diarios Y estado? | 🔴 Compras por foto sin impacto en stock |
| V4 | `POST /api/purchases/pending` — ¿normaliza acentos/mayúsculas en el matching de ingredientes por nombre? | 🟡 Compras por foto con matching fallido |
| V5 | `POST /api/mermas` — ¿descuenta `stock_actual` en el mismo request? | 🔴 Mermas sin impacto en stock si frontend no hace adjust previo |
| V6 | `PUT /api/orders/:id` con `estado='recibido'` — ¿hace SELECT ... FOR UPDATE antes del UPDATE de stock? | 🟡 Race condition en recepción simultánea |
| V7 | Queries multi-tenant — ¿todas filtran por `restaurante_id`? | 🔴 Fuga de datos entre restaurantes |

---

*Informe generado el 2026-02-19. Para cada bug, consultar con el equipo antes de priorizar.*
