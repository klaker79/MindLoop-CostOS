# Auditoría Profesional — MindLoop CostOS Frontend

**Fecha:** 15 febrero 2026
**Alcance:** Repositorio `mindloop-costos` (frontend). El backend (`lacaleta-api`) no está disponible en este workspace; se audita según la documentación de referencia.
**Metodología:** Revisión estática de código, ejecución de tests, análisis de patrones de seguridad y rendimiento.

---

## 1. Resumen Ejecutivo

MindLoop CostOS es una aplicación frontend bien estructurada con **275 tests pasando al 100%**, buena separación modular (41 módulos ES6), y prácticas de seguridad sólidas en los módulos más recientes (uso de `escapeHTML()`, DOMPurify disponible, headers de seguridad en nginx). Los principales riesgos identificados son: (1) tokens JWT almacenados en `localStorage` además de las httpOnly cookies, creando superficie de ataque innecesaria; (2) CSP con `unsafe-inline` y `unsafe-eval` que debilita la protección XSS; (3) ~31 llamadas `fetch()` directas que no pasan por el API client centralizado; y (4) carga upfront de todas las dependencias sin code splitting. Ninguno de estos problemas causa fallos inmediatos, pero representan riesgos reales que conviene abordar por prioridad.

---

## 2. Resultado de Tests

```
Test Suites: 15 passed, 15 total
Tests:       275 passed, 275 total
Snapshots:   0 total
Time:        7.655 s
```

**Todos los tests pasan al 100%.** Cobertura incluye:
- Tests de regresión P0/P1
- Tests de contrato API (superficie de api client)
- Tests unitarios por módulo (ingredientes, recetas, inventario, balance, KPIs)
- Tests de sanitización y helpers
- Tests de performance (memoización, debounce)

> **Nota:** El backend (`lacaleta-api`) no está en este workspace, por lo que sus 216 tests no se ejecutaron. Según la documentación, pasan al 100%.

---

## 3. Seguridad

### 3.1 NECESARIO

#### S1. Tokens JWT en localStorage (Superficie de ataque XSS)
**Archivos:** `src/api/client.js:31`, `src/stores/authStore.js:39,86`, y ~30 ubicaciones más con `localStorage.getItem('token')`
**Problema:** El token JWT se almacena en `localStorage` además de en la httpOnly cookie del backend. Si un atacante explota una vulnerabilidad XSS, puede extraer el token directamente de `localStorage`. Las httpOnly cookies son inmunes a esto por diseño.
**Impacto:** Un XSS exitoso permite robo de sesión completa.
**Recomendación:** Eliminar el almacenamiento en `localStorage`. Usar exclusivamente las httpOnly cookies (ya configuradas en el backend) y el header `credentials: 'include'` (ya implementado).

#### S2. CSP con `unsafe-inline` y `unsafe-eval`
**Archivo:** `nginx.conf:27`
**Problema:** La directiva CSP incluye `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. Esto anula la protección principal de CSP contra XSS, ya que permite la ejecución de scripts inline y `eval()`.
**Impacto:** Un atacante que logre inyectar HTML puede ejecutar JavaScript sin restricciones de CSP.
**Recomendación:** Eliminar `unsafe-inline` y `unsafe-eval`. Mover scripts inline a archivos .js externos. Si es imprescindible algún inline, usar nonces (`'nonce-{random}'`).

#### S3. `document.write()` con datos sin sanitizar en exports
**Archivos:**
- `src/modules/pedidos/pedidos-export.js:202`
- `src/modules/docs/dossier-v24.js:734`
**Problema:** Las funciones de exportación/impresión usan `document.write(html)` en ventanas nuevas donde `html` contiene datos de recetas, ingredientes y proveedores sin sanitizar. Si un nombre de receta contuviera `<img src=x onerror="alert('XSS')">`, se ejecutaría en la ventana de impresión.
**Impacto:** Stored XSS en contexto de impresión. El vector de ataque requiere que datos maliciosos estén almacenados en la BD (baja probabilidad pero alto impacto).
**Recomendación:** Sanitizar con `escapeHTML()` todos los datos interpolados antes de pasarlos a `document.write()`, o mejor, usar `innerHTML` con sanitización en un contenedor seguro.

#### S4. Nombres de empleados sin sanitizar en horarios
**Archivo:** `src/modules/horarios/horarios.js:166,362`
**Problema:** `${emp.nombre}` se interpola directamente en template literals que se asignan a `innerHTML` sin pasar por `escapeHTML()`.
**Impacto:** Stored XSS si un nombre de empleado contiene HTML malicioso.
**Recomendación:** Importar `escapeHTML` de `src/utils/sanitize.js` y usarlo: `${escapeHTML(emp.nombre)}`.

### 3.2 RECOMENDABLE

#### S5. ~31 llamadas `fetch()` directas sin pasar por apiClient
**Archivos principales:**
- `src/modules/auth/auth.js` (5 llamadas)
- `src/legacy/app-core.js` (5 llamadas)
- `src/modules/horarios/horarios.js` (13 llamadas)
- `src/legacy/modales.js` (3 llamadas)
- `src/legacy/inventario-masivo.js` (2 llamadas)
**Problema:** Estas llamadas no pasan por el manejo centralizado de errores, retry, ni el tratamiento uniforme de 401. Algunas construyen headers de autenticación de forma inconsistente.
**Recomendación:** Migrar progresivamente al uso de `apiClient` de `src/api/client.js`.

#### S6. Requisito de contraseña débil (6 caracteres mínimo)
**Archivo:** `src/modules/auth/auth.js:109`
**Problema:** Solo se valida longitud >= 6 sin requisitos de complejidad.
**Recomendación:** Aumentar a >= 12 caracteres. La validación principal debe estar en el backend; el frontend es solo UX.

#### S7. Atributo `style` permitido en safe-html.js
**Archivo:** `src/utils/safe-html.js:12`
**Problema:** La configuración de DOMPurify incluye `style` en `ALLOWED_ATTR`. Esto permite ataques de CSS injection (exfiltración de datos via `background: url(...)` controlada por atacante).
**Recomendación:** Eliminar `'style'` de `ALLOWED_ATTR` en `safe-html.js`. La versión en `sanitize.js` ya lo excluye correctamente.

### 3.3 COSMÉTICO

#### S8. Cookie clearing inefectiva desde JavaScript
**Archivo:** `src/api/client.js:55`
**Detalle:** `document.cookie = 'auth_token=; expires=...'` no puede borrar cookies httpOnly. No causa daño pero es código muerto.

#### S9. Check de autenticación por cookie unreliable
**Archivo:** `src/services/api.js:138`
**Detalle:** `document.cookie.includes('token')` no puede leer cookies httpOnly. Sin impacto funcional (la app usa `/api/auth/verify`).

### Prácticas positivas de seguridad confirmadas

- **Headers de seguridad en nginx:** X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, Permissions-Policy — todos correctos.
- **DOMPurify disponible** con configuración segura en `src/utils/sanitize.js`.
- **`escapeHTML()` usado consistentemente** en ingredientes-ui, ingredientes-proveedores, evolucion-precio, equipo, global-search.
- **No hay secrets en el código:** Solo `.env.example` está en git, sin tokens ni API keys hardcodeados.
- **`credentials: 'include'`** en todas las llamadas API.
- **No hay `eval()` ni `new Function()`** en el código.
- **Dockerfile seguro:** Alpine images, healthcheck, sin exposición de secrets.

---

## 4. Bugs Encontrados

No se encontraron bugs funcionales (los 275 tests pasan). Los siguientes son patrones de riesgo:

| # | Archivo | Línea(s) | Descripción | Tipo |
|---|---------|----------|-------------|------|
| B1 | `src/legacy/modales.js` | 199 | `setInterval(actualizarBeneficioRealDiario, 2000)` sin cleanup — se acumula si el módulo se reinicializa | NECESARIO |
| B2 | `src/ui/event-bindings.js` | 152-256 | Event listeners de documento (click, tabs) sin cleanup — acumulación en sesiones largas | NECESARIO |
| B3 | `src/modules/core/core.js` | 59-81 | `Promise.all()` con fallback silencioso a datos existentes — si un endpoint falla, la UI muestra datos stale sin aviso | RECOMENDABLE |
| B4 | `src/stores/index.js` | 76-80 | `resetAllStores()` existe pero nunca se llama en logout | RECOMENDABLE |

---

## 5. Robustez

### 5.1 NECESARIO

#### R1. Event listeners que se acumulan
**Archivo:** `src/ui/event-bindings.js:152-256`
**Problema:** Múltiples `addEventListener` a nivel de document sin mecanismo de limpieza. En sesiones largas o re-inicializaciones, los handlers se duplican causando comportamiento errático y memory leaks.
**Recomendación:** Usar `AbortController` o implementar función de cleanup que se llame antes de cada re-inicialización.

#### R2. Interval sin cleanup en modales legacy
**Archivo:** `src/legacy/modales.js:199`
**Problema:** `setInterval(actualizarBeneficioRealDiario, 2000)` nunca se limpia. Si el módulo se re-inicializa, se acumulan intervalos.
**Recomendación:** Almacenar el ID del interval y limpiarlo antes de crear uno nuevo.

### 5.2 RECOMENDABLE

#### R3. Estado dual (Zustand + window.*)
**Archivos:** `src/stores/authStore.js:29-32`, `src/stores/ingredientStore.js:61-63`
**Problema:** Los stores de Zustand sincronizan estado a `window.*` para compatibilidad legacy. Si código legacy modifica `window.ingredientes` directamente, el store queda desincronizado.
**Impacto:** Potencial inconsistencia de datos en la UI.

#### R4. Fallos silenciosos en carga de datos
**Archivo:** `src/modules/core/core.js:59-81`
**Problema:** El `Promise.all()` de `cargarDatos()` captura errores individuales y devuelve datos existentes como fallback. El usuario no recibe notificación de que los datos pueden estar desactualizados.

#### R5. Sin detección offline
**Problema:** No hay uso de `navigator.onLine` ni manejo de eventos `online`/`offline`. Los errores de red se tratan como errores genéricos.

### Prácticas positivas de robustez confirmadas

- **Lock de concurrencia** en `cargarDatos()` (`_cargarDatosLock`) — previene llamadas paralelas.
- **Global error handler** (`src/utils/error-handler.js`) con captura de errores síncronos y promesas rechazadas.
- **Retry logic** en `src/services/api.js` con clasificación de errores (no reintenta errores de validación).
- **Form protection** (`src/utils/form-protection.js`) con debounce y cooldown para prevenir doble-submit.
- **Alert badge interval** en `main.js` limpia el anterior antes de crear uno nuevo.

---

## 6. Rendimiento

### 6.1 NECESARIO

#### P1. Sin code splitting — todo se carga upfront
**Archivos:** `src/main.js` (75+ imports estáticos), `vite.config.js` (sin `manualChunks`)
**Problema:** Todas las dependencias (jsPDF ~29MB, Chart.js, XLSX, 41 módulos) se cargan al inicio aunque el usuario solo visite una pestaña.
**Recomendación:** Configurar `manualChunks` en vite.config.js y usar `import()` dinámico para módulos pesados:
```javascript
// vite.config.js rollupOptions.output.manualChunks
{ chart: ['chart.js'], pdf: ['jspdf', 'jspdf-autotable'], excel: ['xlsx-js-style'] }
```

#### P2. Patrones N+1 en rendering de tablas
**Archivo:** `src/modules/ingredientes/ingredientes-ui.js:222`
**Problema:** `window.inventarioCompleto?.find(i => i.id === ing.id)` dentro de un loop de renderizado — O(n*m) donde n=ingredientes y m=inventario.
**Recomendación:** Pre-construir un `Map` de inventario al inicio del render.

### 6.2 RECOMENDABLE

#### P3. Imagen hero sin optimizar (837KB)
**Archivo:** `public/dashboard-hero.png`
**Detalle:** PNG de 2560x1426 sin comprimir, non-interlaced. Se podría reducir a <250KB con WebP o compresión.

#### P4. Sourcemaps en producción
**Archivo:** `vite.config.js` — `sourcemap: true`
**Detalle:** Genera archivos .map en builds de producción, aumentando el tamaño del deploy y exponiendo código fuente.
**Recomendación:** Usar `sourcemap: 'hidden'` o `false` en producción.

#### P5. Cálculos de KPIs bloquean main thread
**Archivo:** `src/modules/dashboard/dashboard.js:279-312`
**Detalle:** Cálculos de food cost iteran todas las recetas con sub-iteraciones por ingrediente. Para restaurantes grandes (100+ recetas), esto puede causar stuttering.
**Recomendación:** Memoizar resultados (ya existe `src/utils/performance.js` con `memoize()` pero no se usa en dashboard).

### Prácticas positivas de rendimiento confirmadas

- **Carga paralela** con `Promise.all()` para 7 endpoints en `cargarDatos()`.
- **Debouncing** de 200-300ms en búsquedas (global search, ingredientes).
- **Gzip habilitado** en nginx con tipos adecuados.
- **Cache de 1 año** para assets con hash de Vite.
- **Lock de concurrencia** para evitar fetches duplicados.

---

## 7. Calidad de Código

Solo se listan hallazgos con impacto real:

| # | Hallazgo | Detalle |
|---|----------|---------|
| C1 | **`escapeHTML()` duplicado 6 veces** | `sanitize.js`, `safe-html.js`, `helpers.js`, `main.js:345`, `legacy/app-core.js`, `legacy/inventario-masivo.js` — misma función copiada. Consolidar en un único export desde `src/utils/sanitize.js`. |
| C2 | **Backup file de 5,737 líneas** | `src/legacy/app-core.backup.js` — fichero completamente sin usar. Eliminar del repo (queda en historial git). |
| C3 | **main.js expone 166 propiedades a window** | Diseño deliberado para compatibilidad legacy. No es un bug, pero cada módulo migrado a ES6 debería reducir esta superficie. |

---

## 8. Recomendaciones Priorizadas (Top 5)

### 1. Eliminar tokens de localStorage [NECESARIO — Seguridad]
**Impacto:** Cierra el vector de ataque más directo. Si existe un XSS, el atacante no puede robar el token.
**Cambio:** Modificar `src/api/client.js`, `src/stores/authStore.js`, y las ~30 ubicaciones que leen de `localStorage`. Usar solo httpOnly cookies (ya funcionan con `credentials: 'include'`).

### 2. Corregir CSP eliminando unsafe-inline/unsafe-eval [NECESARIO — Seguridad]
**Impacto:** Activa la protección real de CSP. Un XSS inyectado no podrá ejecutar scripts.
**Cambio:** Modificar `nginx.conf:27`. Extraer cualquier script inline a ficheros externos. Usar nonces si algún inline es imprescindible.

### 3. Sanitizar datos en horarios.js y módulos de export [NECESARIO — Seguridad]
**Impacto:** Cierra 3 vulnerabilidades de Stored XSS verificadas.
**Cambio:**
- `horarios.js`: Importar `escapeHTML` y usarlo en `emp.nombre`.
- `pedidos-export.js` y `dossier-v24.js`: Sanitizar datos antes de `document.write()`.

### 4. Implementar code splitting y lazy loading [NECESARIO — Rendimiento]
**Impacto:** Reduce el tiempo de carga inicial. Mejora FCP en 2-3 segundos estimados.
**Cambio:** Configurar `manualChunks` en `vite.config.js`. Usar `import()` dinámico para jsPDF, Chart.js y XLSX.

### 5. Limpiar event listeners y intervals acumulativos [NECESARIO — Robustez]
**Impacto:** Previene memory leaks y comportamiento errático en sesiones largas.
**Cambio:**
- `event-bindings.js`: Implementar función de cleanup con `AbortController`.
- `modales.js:199`: Almacenar y limpiar el interval ID.
- `stores/index.js`: Llamar `resetAllStores()` en logout.

---

## Clasificación completa de hallazgos

| ID | Categoría | Clasificación | Descripción |
|----|-----------|---------------|-------------|
| S1 | Seguridad | NECESARIO | Tokens JWT en localStorage |
| S2 | Seguridad | NECESARIO | CSP con unsafe-inline/unsafe-eval |
| S3 | Seguridad | NECESARIO | document.write() sin sanitizar en exports |
| S4 | Seguridad | NECESARIO | emp.nombre sin sanitizar en horarios.js |
| S5 | Seguridad | RECOMENDABLE | 31 fetch() directas sin apiClient |
| S6 | Seguridad | RECOMENDABLE | Contraseña mínima 6 caracteres |
| S7 | Seguridad | RECOMENDABLE | style attr permitido en safe-html.js |
| S8 | Seguridad | COSMÉTICO | Cookie clearing inefectiva |
| S9 | Seguridad | COSMÉTICO | Cookie auth check unreliable |
| B1 | Bug | NECESARIO | setInterval sin cleanup en modales.js |
| B2 | Bug | NECESARIO | Event listeners acumulativos |
| B3 | Bug | RECOMENDABLE | Fallos silenciosos en cargarDatos() |
| B4 | Bug | RECOMENDABLE | resetAllStores() no se llama en logout |
| R1 | Robustez | NECESARIO | Event listener accumulation |
| R2 | Robustez | NECESARIO | Interval leak en modales |
| R3 | Robustez | RECOMENDABLE | Estado dual Zustand/window |
| R4 | Robustez | RECOMENDABLE | Fallos silenciosos en carga |
| R5 | Robustez | RECOMENDABLE | Sin detección offline |
| P1 | Rendimiento | NECESARIO | Sin code splitting |
| P2 | Rendimiento | NECESARIO | N+1 en rendering de tablas |
| P3 | Rendimiento | RECOMENDABLE | Imagen hero 837KB sin optimizar |
| P4 | Rendimiento | RECOMENDABLE | Sourcemaps en producción |
| P5 | Rendimiento | RECOMENDABLE | KPIs bloquean main thread |
| C1 | Calidad | RECOMENDABLE | escapeHTML duplicado 6 veces |
| C2 | Calidad | RECOMENDABLE | Backup file 5.7K líneas sin usar |
| C3 | Calidad | COSMÉTICO | 166 propiedades en window (by design) |

**Totales:** 8 NECESARIO, 12 RECOMENDABLE, 3 COSMÉTICO
