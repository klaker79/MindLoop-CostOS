# Auditoría Profesional — MindLoop CostOS

**Fecha:** 13 de febrero de 2026
**Auditor:** Claude Opus 4.6 (Auditor Senior de Código SaaS)
**Alcance:** Frontend (`mindloop-costos`) + Backend (`lacaleta-api` — documentación y contratos) + Base de datos + DevOps
**Versión auditada:** v2.0.0

---

## Nota Global: 6.4/10

### Resumen ejecutivo
MindLoop CostOS es una aplicación funcional con dominio de negocio bien modelado y un plan de estabilización serio en marcha. Sin embargo, el monolito backend de ~5.400 líneas, la duplicación de clientes API en frontend, la ausencia de CI con tests del backend en el pipeline del frontend, y el hardcodeo de credenciales Sentry en el HTML público representan riesgos significativos que deben resolverse antes de escalar a más clientes.

---

### Notas por área

| Área | Nota | Veredicto |
|------|------|-----------|
| Arquitectura | 5/10 | Monolito backend insostenible; frontend en transición desordenada legacy→ES6 |
| Calidad de código | 6/10 | Legible y consistente, pero con duplicación y acoplamiento a `window.*` |
| Seguridad | 6.5/10 | Fundamentos sólidos (JWT httpOnly, bcrypt, CSP, DOMPurify) pero con agujeros |
| Base de datos | 7/10 | Schema bien diseñado, multi-tenant correcto, buenos índices; JSONB riesgoso |
| Testing | 5/10 | Tests superficiales que no testean lógica real; 142 frontend tests son "unit tests de matemáticas" |
| Frontend | 7/10 | Buena UX, modularización decente, buen rendimiento; lastrado por legacy |
| DevOps e Infra | 5.5/10 | Docker + Dokploy funcional pero sin staging real, backup manual, CI incompleto |
| Escalabilidad | 6/10 | Aguanta 10 restaurantes bien; 100 requiere refactorización seria |

---

## Problemas CRITICOS (deben solucionarse ya)

### 1. Sentry DSN hardcodeado en `index.html:9`
```javascript
dsn: "https://ac722e9d30983357b092ee766be13c5e@o4510649135661056.ingest.de.sentry.io/4510649155190864"
```
**Riesgo:** Cualquiera puede enviar eventos falsos a tu Sentry, contaminando alertas y potencialmente agotando tu cuota. Esto es un **secreto público** en tu código fuente.
**Solución:** Mover a variable de entorno `VITE_SENTRY_DSN` y cargar dinámicamente.

### 2. Dos clientes API duplicados que compiten entre sí
El frontend tiene **dos sistemas API completamente separados** que hacen exactamente lo mismo:
- `src/api/client.js` — `apiClient` + `api` exports (moderno, limpio)
- `src/services/api.js` — `window.API` con `fetchAPI()` (legacy, con retry + timeout)

**Riesgo:** Inconsistencia en manejo de errores, autenticación, y retry. Algunos módulos usan `window.api`, otros `window.API`, otros `apiClient`. El módulo `ingredientes-crud.js` usa **los tres** en la misma función (`ingredientStore` → `apiClient`, `window.API.fetch()`, `window.api.getProveedores()`).
**Solución:** Eliminar uno. Migrar todo a `apiClient` con retry/timeout del legacy.

### 3. Monolito `server.js` de ~5.400 líneas (backend)
Un solo archivo con 80+ endpoints, middleware, auth, validaciones, queries SQL, y lógica de negocio. Solo `SupplierController` está migrado a clean architecture.
**Riesgo:**
- Imposible hacer code review efectivo
- Un error en una ruta puede afectar a todas las demás
- Conflictos de merge constantes en equipo
- Tiempo de arranque y debugging degradado
**Solución:** Refactorización progresiva: extraer routes → controllers → services. Mínimo separar por dominio (auth, ingredients, recipes, orders, sales, inventory).

### 4. index.html de 3.150 líneas con CSS inline y lógica legacy
El HTML principal es un megaarchivo con:
- ~2.000+ líneas de `<style>` inline dentro del body
- Código legacy JS en `<script>` tags mezclado con ES6 modules
- Modales HTML hardcodeados
- Registro de Service Worker duplicado (línea 62 en `<head>` Y en `main.js:564`)

**Riesgo:** Unmaintainable. Cualquier cambio de UI requiere editar un archivo monstruoso.
**Solución:** Extraer CSS a archivos separados, componentizar modales, eliminar duplicaciones.

### 5. Tests frontend que no testean nada real
Los tests en `__tests__/modules/` son **tests de aritmética**, no de lógica de negocio:
```javascript
// ingredientes.test.js - Esto NO testea tu código
it('should calculate ingredient cost correctly', () => {
    const precio = 10;
    const cantidad = 2.5;
    expect(precio * cantidad).toBe(25); // Testea la multiplicación de JS
});
```
```javascript
// recetas.test.js - Tampoco testea tu código
it('should require at least one ingredient', () => {
    const receta = { ingredientes: [] };
    expect(receta.ingredientes.length).toBe(0); // Testea .length
});
```
**Ninguno de estos tests importa un solo módulo de `src/`**. No testean `guardarIngrediente()`, ni `validateIngrediente()`, ni `calcularCosteReceta()`. Son tests "de mentira" que dan falsa sensación de seguridad.

**Los 142 tests frontend declarados en la documentación son en realidad ~10 tests de utilidades reales + ~130 tests cosméticos.**

---

## Mejoras IMPORTANTES (proximos 30 dias)

### 1. Unificar sistema de estado: `window.*` vs Zustand
Hay 8 Zustand stores creados (`ingredientStore`, `orderStore`, `recipeStore`, etc.) pero el 90% del código sigue usando `window.ingredientes`, `window.recetas`, etc. Los stores hacen sync bidireccional con `window.*`, creando una capa innecesaria de complejidad.
**Decisión requerida:** O se migra a Zustand de verdad (eliminando `window.*` globals), o se eliminan los stores y se queda con `window.*` + un wrapper simple. La situación actual es lo peor de ambos mundos.

### 2. CI pipeline incompleto
`ci.yml` solo ejecuta `npm test -- --passWithNoTests`. El flag `--passWithNoTests` significa que **si borras todos los tests, CI sigue pasando**. No hay:
- Lint en CI
- Build verification en CI (se hace pero después de tests)
- Tests del backend en ningún pipeline
- Análisis de seguridad (`npm audit`) en CI
- Cobertura mínima enforced (el threshold del 50% en jest.config.js no se ejecuta en CI)

### 3. `static.yml` despliega el repo entero a GitHub Pages
```yaml
path: '.'  # Upload entire repository
```
Esto sube `.env.example`, `.agent/`, `scripts/`, `docs/` internos, etc. a un sitio público.
**Solución:** Cambiar a `path: './dist'` y ejecutar build antes del deploy.

### 4. `ingredientes_proveedores` sin `restaurante_id` en la tabla
Según el schema, la tabla `ingredientes_proveedores` **no tiene `restaurante_id`** como columna propia — depende del JOIN con `ingredientes`. Esto es un vector de escalabilidad: queries de JOIN se vuelven más costosas y el filtro multi-tenant no es directo.

### 5. JSONB para ingredientes en `recetas` y `pedidos`
Almacenar ingredientes como JSONB (`[{ingredienteId, cantidad, unidad}]`) en lugar de una tabla de relación N:M tiene consecuencias:
- No hay integridad referencial (un ingrediente eliminado queda como ID huérfano en el JSONB)
- No se pueden hacer queries eficientes ("¿qué recetas usan el ingrediente X?")
- Los índices GIN ayudan pero no reemplazan a FKs
- Consistencia depende 100% del código de aplicación

### 6. Falta endpoint `/api/backup` documentado como pendiente
La documentación reconoce que no existe. Un SaaS en producción sin backup programático es un riesgo de pérdida de datos.

### 7. Email verification comentado
La verificación de email en el login está **comentada** (línea ~770 del server.js según SKILL.md). Cualquiera puede registrar un restaurante con un email falso si conoce el código de invitación.

### 8. Rate limiting in-memory (no Redis)
100 req/15min por IP con storage en memoria del proceso Node. Si el servidor se reinicia, los contadores se pierden. Con Docker + auto-deploy, cada deploy resetea los rate limits. No escala a múltiples instancias.

---

## Mejoras DESEABLES (cuando haya tiempo)

### 1. Eliminar código legacy del index.html
Quitar los `<script>` legacy y las funciones inline. El sistema de ES6 modules en `main.js` ya sobrescribe todo — el legacy es peso muerto que confunde.

### 2. Componentizar UI
El index.html tiene modales, formularios, y tablas hardcodeados en HTML. Considerar extraer a componentes renderizados por JS (como ya se hace en algunos módulos con `innerHTML`).

### 3. Migrar a TypeScript
Con 83 archivos JS en `src/` y lógica financiera compleja, TypeScript evitaría bugs como la confusión `stock_actual` vs `stockActual`, `proveedor_id` vs `proveedorId` que se ve en el código.

### 4. Implementar tests reales de integración
Escribir tests que:
- Importen los módulos reales de `src/`
- Mockeen la API con MSW o similar
- Testean flujos completos: crear ingrediente → verificar store → verificar render
- Testean `validateIngrediente()` con edge cases reales

### 5. Separar CSS del HTML
Las ~2.000+ líneas de CSS inline en index.html deberían estar en archivos `.css` separados. Ya existe `styles/main.css` — consolidar ahí.

### 6. Mejorar Docker build
El Dockerfile usa `npm install` en lugar de `npm ci` en el stage builder, lo que puede producir builds no reproducibles.

### 7. Nginx: quitar error_log debug en producción
```nginx
error_log /var/log/nginx/error.log debug;
```
El nivel `debug` en producción genera logs excesivos y puede exponer información sensible.

### 8. Hardcoded Galicia holidays
Los festivos de Galicia para 2026 están hardcodeados en el endpoint de overstock intelligence. Necesita ser dinámico o al menos actualizable sin deploy.

### 9. Source maps en producción
`vite.config.js` tiene `sourcemap: true` para producción. Esto expone el código fuente completo a cualquiera que abra DevTools.

---

## Comparacion con MarketMan/Apicbase/ORCA

### Que hace bien MindLoop que ellos no
- **Precio/rendimiento imbatible:** Un SaaS de gestión de costes completo por lo que probablemente cueste una fracción de MarketMan (~$200-500/mes)
- **Inteligencia incorporada:** Freshness alerts, purchase planning, overstock detection, price-check — funcionalidades que en la competencia son premium
- **Menu Engineering con BCG Matrix:** Clasificación estrella/caballo/puzzle/perro es un diferenciador real
- **PDF parsing con IA (Claude):** Importar ventas desde PDF de TPV con OCR es innovador
- **UX enfocada:** Interfaz diseñada específicamente para restaurantes españoles, con jerga del sector (mermas, escandallos, albaranes)
- **Variantes de receta (copa/botella):** Buen modelado del negocio de vinos
- **Velocidad:** 30ms avg en endpoints es excelente

### Que le falta para competir
- **Multi-location:** MarketMan y Apicbase manejan cadenas con 50+ locales. MindLoop está diseñado para 1 restaurante a la vez
- **Integraciones nativas:** ORCA se conecta directamente con POS (Revel, Toast, Square). MindLoop depende de n8n/webhooks manuales
- **App móvil:** La competencia tiene apps nativas. MindLoop es PWA — funcional pero no nativa
- **Gestión de pedidos automática:** MarketMan genera pedidos automáticos basados en par levels. MindLoop tiene purchase-plan inteligente pero no auto-ordering
- **Multi-idioma:** La competencia es global. MindLoop es solo español
- **Audit trail / compliance:** Para restaurantes serios, trazabilidad de cambios (quién modificó qué y cuándo) es crítico. No hay audit log
- **API pública documentada:** Para integraciones de terceros
- **SLA y uptime garantizado:** Con un solo VPS en Dokploy, no hay redundancia ni failover
- **Onboarding automatizado:** El registro requiere código de invitación manual

---

## Veredicto final

### Esta app esta lista para venderla profesionalmente?

**No todavía, pero está sorprendentemente cerca.**

MindLoop CostOS tiene un **dominio de negocio excelente** — el modelado de costes, recetas, inventario, mermas y analytics demuestra conocimiento profundo de la industria. La funcionalidad cubre el 80% de lo que necesita un restaurante medio. El rendimiento es bueno (30ms avg, 20 usuarios concurrentes sin degradación).

**Lo que falta para vender con confianza:**

1. **Fiabilidad demostrable** — Los tests actuales son cosméticos. Necesitas tests reales que demuestren que los flujos críticos (importación de ventas, cálculo de PNL, consolidación de inventario) no se rompen. Esto es requisito #1 para cualquier cliente que maneje dinero real.

2. **Arquitectura mantenible** — El monolito de 5.400 líneas y el index.html de 3.150 líneas son bombas de tiempo. Un solo desarrollador puede vivir con esto; un equipo de 2+ no puede. Si aspiras a crecer, la refactorización no es opcional.

3. **Seguridad madura** — Los fundamentos están (JWT httpOnly, bcrypt, CSP, rate limiting, DOMPurify), pero el Sentry DSN público, la verificación de email deshabilitada, y el rate limiting in-memory necesitan corrección. Un pentest profesional antes de vender es muy recomendable.

4. **Infraestructura de producción** — Un solo VPS sin redundancia, sin backup automático programático, sin staging real. Para un restaurante de prueba está bien; para 10 clientes pagando, no es aceptable.

**Plan de acción recomendado (prioridad estricta):**
1. Mes 1: Fix de los 5 problemas críticos + tests reales de flujos financieros
2. Mes 2: Refactorización del backend (extraer al menos auth, sales, orders a archivos separados) + backup automático + staging
3. Mes 3: Integraciones POS directas + multi-location básico + pentest
4. Mes 4: Listo para venta profesional a primeros clientes beta pagando

**Nota final:** El plan de 90 días que ya completaste (Mes 1 estabilización) fue la decisión correcta. Demuestra madurez técnica. Ahora el Mes 2 es donde se juega todo — la refactorización y los tests reales son lo que separa un proyecto personal de un producto vendible.

---

*Auditoría generada por Claude Opus 4.6 — 13 de febrero de 2026*
*Basada en análisis exhaustivo de: SKILL.md, stability-rules.md, database-schema.md, api-endpoints.md, deployment-devops.md, frontend-architecture.md, 83 archivos JS en src/, 10 archivos de test, Dockerfile, nginx.conf, CI/CD workflows, package.json, y documentación interna.*
