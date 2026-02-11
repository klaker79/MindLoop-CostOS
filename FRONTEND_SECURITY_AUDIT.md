# Frontend Security Audit — MindLoop CostOS

**Fecha:** 2026-02-11
**Alcance:** `src/` — 12 archivos clave + utilidades de soporte
**Auditor:** Claude Opus 4.6 (análisis automatizado)

---

## Resumen Ejecutivo

Se identificaron **28 hallazgos** de seguridad en el frontend de MindLoop CostOS:

| Severidad | Cantidad |
|-----------|----------|
| CRITICA   | 2        |
| ALTA      | 5        |
| MEDIA     | 14       |
| BAJA      | 7        |

Las vulnerabilidades críticas se concentran en **secretos expuestos en el bundle** (webhook URL con UUID) y **falta de manejo de sesión expirada** que permite operación silenciosa sin autenticación.

---

## Hallazgos Detallados

| Sev. | ID | Archivo:línea | Descripción | Fix sugerido |
|------|----|---------------|-------------|--------------|
| CRITICA | SEC-01 | `config/app-config.js:29` | **Webhook URL de n8n con UUID hardcodeada como fallback.** La URL `https://n8niker.mindloop.cloud/webhook/3f075a6e-b005-407d-911c-93f710727449` queda en el bundle de Vite en producción. Cualquiera puede enviar peticiones al webhook. | Eliminar fallback. Exigir `VITE_CHAT_WEBHOOK_URL` en `.env`. Si no existe, deshabilitar el chat. |
| CRITICA | SEC-02 | `modules/core/core.js:59-77` | **Sin manejo de 401 en carga de datos.** `cargarDatos()` usa `r.ok ? r.json() : []` para todas las llamadas. Si el token expira, el usuario ve tablas vacías sin ser redirigido al login. Los datos desaparecen silenciosamente. | Verificar `response.status === 401` en cada fetch y llamar a `mostrarLogin()` + limpiar token. |
| ALTA | SEC-03 | `api/client.js:51-55` | **Handler de 401 comentado.** El bloque `// window.dispatchEvent(new CustomEvent('auth:expired'))` está desactivado. El cliente API detecta el 401 pero no actúa: no hay logout, no hay refresh, no hay redirect. | Descomentar y implementar el dispatch de `auth:expired` con listener que llame a `logout()`. |
| ALTA | SEC-04 | `api/client.js:31` + `modules/auth/auth.js:17` | **Mecanismo dual de autenticación inconsistente.** `auth.js` usa httpOnly cookies (`credentials: 'include'`), pero `client.js` también envía Bearer token desde `localStorage`. Si la cookie expira pero el token persiste (o viceversa), el estado de auth es ambiguo. | Elegir un solo mecanismo. Si httpOnly cookies: eliminar el Bearer de localStorage. Si Bearer: no depender de cookies. |
| ALTA | SEC-05 | `config/app-config.js:19` | **URL de API de producción como fallback.** Si `VITE_API_BASE_URL` no se configura, se usa `https://lacaleta-api.mindloop.cloud` incluso en desarrollo. Un dev puede modificar datos de producción accidentalmente. | Usar fallback a `http://localhost:3000` en dev. Exigir variable en producción. |
| ALTA | SEC-06 | `modules/pedidos/compras-pendientes-ui.js:228-253` | **Race condition en aprobación de compras.** `aprobarItemPendiente()` y `aprobarBatchPendiente()` no deshabilitan botones durante la operación async. Clicks rápidos duplican aprobaciones y registros de stock. | Añadir flag `isApproving` o usar `protectButton()` de `form-protection.js` en los handlers de aprobación. |
| ALTA | SEC-07 | `modules/chat/chat-widget.js:593-889` | **Ejecución de comandos desde respuesta del webhook.** `executeAction()` parsea comandos pipe-delimited del bot (`update\|ingrediente\|PULPO\|precio\|25`) y modifica datos directamente. Si el webhook de n8n es comprometido, un atacante puede modificar precios, stock, recetas, crear pedidos y ventas. | Añadir confirmación adicional del usuario antes de ejecutar. Validar que los valores están en rangos razonables. Limitar acciones a solo lectura si la sesión es de tipo `viewer`/`staff`. |
| MEDIA | SEC-08 | `modules/pedidos/compras-pendientes-ui.js:140-142` | **Datos de OCR interpolados sin escapar.** `${item.ingrediente_nombre}` y `${matchLabel}` se insertan directamente en template literals que alimentan `innerHTML`. Los nombres vienen del OCR de n8n y podrían contener HTML malicioso. | Usar `escapeHTML()` de `utils/sanitize.js` en todos los campos de texto dinámico: `${escapeHTML(item.ingrediente_nombre)}`. |
| MEDIA | SEC-09 | `modules/pedidos/compras-pendientes-ui.js:111` | **String `batchId` en onclick sin sanitizar.** `onclick="window.aprobarBatchPendiente('${batchId}')"` — Si `batchId` contiene comillas o caracteres especiales, permite inyección en el atributo. | Usar event delegation con `data-batch-id` y un listener centralizado en vez de onclick inline. |
| MEDIA | SEC-10 | `config/app-config.js:151-164` | **Config mutable en runtime.** `setConfig()` permite cambiar cualquier valor de configuración. Desde consola: `setConfig('api.baseUrl', 'https://evil.com')` redirige todas las API calls. | Hacer `appConfig` inmutable con `Object.freeze()` en producción. Eliminar `setConfig()` o protegerlo. |
| MEDIA | SEC-11 | `api/client.js:265-268` | **API client expuesto en `window`.**  `window.apiClient` y `window.api` permiten llamadas API arbitrarias desde la consola del navegador. | Aceptar como riesgo inherente al patrón legacy, pero documentar. En futuro: eliminar exposición global cuando se migre completamente a ES6 modules. |
| MEDIA | SEC-12 | `modules/pedidos/pedidos-recepcion.js:97-98` | **Nombres de ingredientes sin escapar en modal de recepción.** `<td>${nombre}</td>` usa directamente el nombre del ingrediente sin `escapeHTML()`. | Aplicar `escapeHTML(nombre)` y `escapeHTML(unidad)` en el template del modal. |
| MEDIA | SEC-13 | `modules/pedidos/pedidos-recepcion.js:150-173` | **Sin validación de cantidad máxima en recepción.** `cantidadRecibida` acepta cualquier valor positivo sin límite superior. Un error de teclado (99999 en vez de 9.99) corrompe el stock. | Añadir validación: `if (cantidadRecibida > cantidadPedida * 10) { warn(); }` o usar `VALIDATION.MAX_STOCK` de `constants.js`. |
| MEDIA | SEC-14 | `modules/pedidos/pedidos-cart.js:14-28` | **Cart en localStorage sin validación de schema.** Los datos parseados de localStorage no se validan. Un valor manipulado en `items[].precio` o `items[].ingredienteId` sería usado directamente. | Validar estructura después de `JSON.parse`: verificar que cada item tenga `ingredienteId` (number), `cantidad` (number > 0), `precio` (number >= 0). |
| MEDIA | SEC-15 | `modules/pedidos/pedidos-cart.js:291-293` | **Nombres de ítems del carrito sin escapar.** `<strong>${item.nombre}</strong>` y `${item.formatoCompra}` se insertan sin sanitizar. | Usar `escapeHTML()` en la renderización del carrito. |
| MEDIA | SEC-16 | `legacy/inventario-masivo.js:39-84,402-421` | **Sin validación de tamaño de archivo antes de importar.** `reader.readAsArrayBuffer(file)` lee el archivo completo sin verificar tamaño. Un archivo de 500MB+ puede colgar el navegador. | Añadir check: `if (file.size > 10 * 1024 * 1024) { showToast('Máximo 10MB', 'error'); return; }`. |
| MEDIA | SEC-17 | `legacy/inventario-masivo.js:708-731` | **PDF enviado como base64 sin límite de tamaño.** El PDF completo se convierte a base64 y se envía como JSON. Un PDF grande (>50MB) podría agotar memoria del cliente y sobrecargar el backend. | Limitar tamaño: `if (file.size > 5 * 1024 * 1024) { showToast('PDF máximo 5MB', 'error'); return; }`. |
| MEDIA | SEC-18 | `legacy/inventario-masivo.js:512-533,655-674,982-1007,1189-1268` | **Bulk imports secuenciales sin rollback.** Todas las importaciones masivas (ingredientes, recetas, ventas, pedidos) hacen N llamadas API en un for loop. Si falla en el item 50 de 100, quedan 50 importados sin rollback. | Implementar endpoint batch en backend (`POST /api/ingredients/bulk`). O al menos: mostrar progreso, permitir cancelar, y listar qué se importó parcialmente. |
| MEDIA | SEC-19 | `modules/auth/auth.js:89-131` | **Sin rate limiting de login en cliente.** El formulario de login permite envíos ilimitados. Aunque el backend tiene rate limit (100 req/15min), el usuario no recibe feedback hasta que el backend bloquea. | Añadir debounce o contador de intentos con cooldown exponencial en el cliente. |
| MEDIA | SEC-20 | `legacy/inventario-masivo.js:721,1324` | **URL de producción hardcodeada como fallback en código legacy.** `window.API_CONFIG?.baseUrl \|\| 'https://lacaleta-api.mindloop.cloud'` duplica el problema de SEC-05 en el código legacy. | Usar siempre `window.API_CONFIG.baseUrl` sin fallback, o importar desde `app-config.js`. |
| MEDIA | SEC-21 | `modules/chat/chat-widget.js:946-965` | **Webhook sin autenticación.** El chat envía POST al webhook de n8n sin Bearer token ni ninguna credencial. Cualquier persona con la URL puede enviar mensajes al bot. | Incluir el Bearer token en las peticiones al webhook. O implementar un proxy en el backend: `POST /api/chat` que reenvíe al webhook con credenciales server-side. |
| BAJA | SEC-22 | `api/client.js:78-93` | **Sin timeout en fetch.** A pesar de que `appConfig.api.timeout: 30000` está configurado, no se usa `AbortController`. Las peticiones pueden colgar indefinidamente. | Implementar `AbortController` con `signal` y `setTimeout` para abortar después de 30s. |
| BAJA | SEC-23 | `api/client.js:78-93` | **Sin retry logic.** `appConfig.api.retries: 3` está configurado pero no implementado en el cliente API. | Usar `withRetry()` de `error-handler.js` o implementar retry en `apiClient`. |
| BAJA | SEC-24 | `modules/core/core.js:13-19` | **Header Authorization vacío cuando no hay token.** `Authorization: ''` se envía cuando `token` es null. Algunos servidores rechazan headers vacíos. | Condicionar: solo incluir el header si hay token. |
| BAJA | SEC-25 | `main.js:563-573` | **Service Worker sin verificación de integridad.** `navigator.serviceWorker.register('/sw.js')` no valida el contenido del SW. | Añadir Subresource Integrity (SRI) si el hosting lo permite, o verificar via CSP. |
| BAJA | SEC-26 | `main.js:97,111,267,665` | **Inicialización basada en setTimeout arbitrarios.** Múltiples `setTimeout(fn, 1000-3000)` para inicializar módulos. Si la red es más rápida, pueden haber race conditions en carga. | Usar eventos o promises para secuenciar la inicialización en vez de delays fijos. |
| BAJA | SEC-27 | `modules/chat/chat-widget.js:31-46,522-527` | **Historial de chat almacenado sin cifrar en localStorage.** Mensajes del bot (que pueden contener datos de negocio: precios, stock, márgenes) quedan en texto plano en localStorage. | Aceptar como riesgo bajo (localStorage es per-origin). Documentar que datos sensibles pueden quedar en el navegador. |
| BAJA | SEC-28 | `utils/form-protection.js:114-116` | **Cooldown de 300ms puede ser insuficiente.** El flag `isSubmitting` se resetea 300ms después del `finally`. En redes muy rápidas (<300ms RTT), un usuario podría re-enviar. | Aumentar a 500-1000ms o mantener el flag hasta que la UI se re-renderice completamente. |

---

## Aspectos Positivos

El codebase tiene varias prácticas de seguridad ya implementadas:

1. **DOMPurify disponible** (`utils/sanitize.js`, `utils/safe-html.js`) — Existe infraestructura de sanitización, aunque no se usa consistentemente.
2. **`escapeHTML()` en inventario-masivo.js** — El código legacy tiene su propia función de escape y la usa en los previews.
3. **`parseMarkdown()` escapa antes de formatear** (`chat-widget.js:1451`) — El chat escapa `<>&` antes de aplicar markdown, previniendo XSS básico.
4. **Lock en `cargarDatos()`** (`core.js:22-48`) — Previene llamadas concurrentes con un mutex.
5. **`form-protection.js`** — Módulo dedicado anti-double-submit con protección para forms y botones.
6. **Global error handler** (`error-handler.js`) — Captura errores no manejados y promesas rechazadas.
7. **httpOnly cookies** para autenticación — El backend usa httpOnly cookies, reduciendo el riesgo de robo de token via XSS.
8. **Validación en recepción de pedidos** (`pedidos-recepcion.js:304-314`) — Valida cantidades negativas y tiene tracking de fallos parciales.
9. **Tabla de celdas escapadas en chat** (`chat-widget.js:1428-1430`) — Las celdas de tablas en el chat se escapan correctamente.

---

## Priorización de Remediación

### Fase 1 — Inmediata (Crítico + Alto)
1. **SEC-01**: Eliminar webhook URL hardcodeada del fallback
2. **SEC-02**: Implementar manejo de 401 en `cargarDatos()`
3. **SEC-03**: Activar handler de sesión expirada en `client.js`
4. **SEC-04**: Unificar mecanismo de autenticación
5. **SEC-05**: Eliminar fallback a URL de producción
6. **SEC-06**: Añadir lock de UI en aprobación de compras
7. **SEC-07**: Añadir validación y límites en `executeAction()`

### Fase 2 — Corto plazo (Medio)
8. **SEC-08, SEC-12, SEC-15**: Aplicar `escapeHTML()` en todos los templates dinámicos
9. **SEC-09**: Migrar onclick inline a event delegation
10. **SEC-10**: Congelar configuración en producción
11. **SEC-13**: Validar rangos de cantidades en recepción
12. **SEC-14**: Validar schema del carrito en localStorage
13. **SEC-16, SEC-17**: Limitar tamaño de archivos importados
14. **SEC-18**: Implementar batch imports en backend
15. **SEC-19**: Rate limiting de login en cliente
16. **SEC-20, SEC-21**: Eliminar URLs hardcodeadas y proteger webhook

### Fase 3 — Mejora continua (Bajo)
17. **SEC-22 a SEC-28**: Timeouts, retry logic, cleanup de headers, etc.

---

## Módulos Analizados

| # | Archivo | Hallazgos |
|---|---------|-----------|
| 1 | `src/api/client.js` | SEC-03, SEC-04, SEC-11, SEC-22, SEC-23 |
| 2 | `src/config/app-config.js` | SEC-01, SEC-05, SEC-10 |
| 3 | `src/modules/chat/chat-widget.js` | SEC-07, SEC-21, SEC-27 |
| 4 | `src/modules/pedidos/compras-pendientes-crud.js` | (limpio — wrappers API) |
| 5 | `src/modules/pedidos/compras-pendientes-ui.js` | SEC-06, SEC-08, SEC-09 |
| 6 | `src/legacy/inventario-masivo.js` | SEC-16, SEC-17, SEC-18, SEC-19, SEC-20 |
| 7 | `src/main.js` | SEC-25, SEC-26 |
| 8 | `src/utils/form-protection.js` | SEC-28 |
| 9 | `src/modules/pedidos/pedidos-recepcion.js` | SEC-12, SEC-13 |
| 10 | `src/modules/pedidos/pedidos-cart.js` | SEC-14, SEC-15 |
| 11 | `src/modules/core/core.js` | SEC-02, SEC-24 |
| 12 | `src/modules/auth/auth.js` | SEC-04, SEC-19 |
| **Soporte** | `src/utils/sanitize.js` | (bien implementado) |
| **Soporte** | `src/utils/safe-html.js` | (bien implementado) |
| **Soporte** | `src/utils/error-handler.js` | (bien implementado) |
| **Soporte** | `src/config/constants.js` | (bien implementado) |
