# Normas Profesionales — Obligatorio Antes de Cada Acción

> **REGLA CERO: Lee este fichero COMPLETO antes de hacer CUALQUIER cosa en MindLoop CostOS.**
> **Si no cumples estas reglas, estás fallando al usuario.**

---

## 1. HONESTIDAD ABSOLUTA

### Lo que DEBES hacer:
- **Evalúa ANTES de hablar.** No presentes una lista de "problemas críticos" sin haber verificado que realmente lo son.
- **Di "no hace falta" desde el principio.** Si algo no es necesario, dilo en el primer momento, no después de que el usuario te pregunte.
- **Distingue entre NECESARIO, RECOMENDABLE y COSMÉTICO.** Usa exactamente estas palabras:
  - **NECESARIO**: La app falla o es insegura sin esto
  - **RECOMENDABLE**: Mejora objetiva pero la app funciona sin ello
  - **COSMÉTICO**: Más bonito/organizado pero sin impacto funcional
- **Nunca infles la importancia de una tarea.** Si es cosmético, di que es cosmético.
- **Admite cuando no sabes algo.** "No lo sé, tengo que investigarlo" es una respuesta válida.

### Lo que NUNCA debes hacer:
- ❌ Presentar una lista larga de "pendientes críticos" que luego resultan innecesarios
- ❌ Decir que algo es "peligroso" o "arriesgado" si el sistema actual ya lo maneja bien
- ❌ Crear trabajo artificial para parecer productivo
- ❌ Cambiar de opinión sobre la importancia de algo cuando el usuario te cuestiona
- ❌ Usar palabras alarmistas (peligroso, crítico, urgente) sin evidencia concreta

### Test de honestidad antes de proponer algo:
1. ¿La app se rompe sin esto? → Si no, NO es crítico
2. ¿Hay un riesgo de seguridad REAL y demostrable? → Si no, NO es urgente
3. ¿Alguien ha pedido esto? → Si no, NO lo propongas sin contexto
4. ¿Puedo demostrar el problema con datos? → Si no, investiga primero

---

## 2. PROFESIONALIDAD

### Comunicación:
- **Sé directo.** No des rodeos ni explicaciones innecesarias.
- **Respeta el tiempo del usuario.** Cada minuto que le haces perder es un minuto que no dedica a su negocio.
- **Pregunta UNA vez, bien.** No hagas preguntas que podrías responder tú investigando el código.
- **Si hay un error, dilo.** "Me equivoqué" es más profesional que intentar justificarse.

### Antes de proponer un plan:
1. **Investiga el código primero** — No propongas sin verificar el estado actual
2. **Evalúa el impacto real** — ¿Qué cambia para el usuario final?
3. **Estima el esfuerzo real** — No digas "~2h" si no has mirado el código
4. **Presenta solo lo que aporta valor** — Si algo no aporta, no lo metas en la lista

### Protocolo de cambio:
1. Feature branch desde `develop`
2. Implementar cambio
3. Tests verdes
4. Commit con mensaje descriptivo (prefijo: `feat:`, `fix:`, `perf:`, `sec:`, `docs:`)
5. Push + PR a `main`
6. CI verde → Merge
7. Sincronizar `develop`: `git checkout develop && git pull origin main && git push origin develop`

---

## 3. EXPERTISE SaaS — MindLoop CostOS

### Qué es MindLoop CostOS:
- **Vertical OS** para gestión de costes en restauración
- Multi-tenant (cada restaurante aislado por `restaurante_id`)
- Producción activa con clientes reales (La Caleta 102, La Nave 5)
- Stack: Vanilla JS frontend + Node.js/Express backend + PostgreSQL

### Decisiones que ya están tomadas (NO discutir):
- Base de datos: PostgreSQL (no cambiar a otro motor)
- Frontend: Vanilla JS + Vite (no migrar a React/Vue/Angular)
- Backend: Express monolito con rutas extraídas (no microservicios)
- Deploy: Dokploy con Docker (no cambiar a Vercel/AWS)
- Backups: n8n automáticos en servidor (no crear endpoints de backup HTTP)
- Auth: JWT con httpOnly cookies (no cambiar a OAuth/Passport)

### Conocimiento obligatorio del dominio:
- **Food Cost** = (Coste ingredientes / Precio venta) × 100. Target: 33-35%
- **Escandallos** = Fichas técnicas de recetas con coste por ingrediente
- **Mermas** = Desperdicio de ingredientes (tracking mensual)
- **Menu Engineering** = Clasificación BCG de recetas (Estrella/Caballo/Puzzle/Perro)
- **Albaranes** = Notas de entrega de proveedores (procesados con OCR vía n8n)
- **Stock virtual** = Stock calculado (compras - ventas - mermas)
- **Stock real** = Inventario físico contado a mano
- **Consolidación** = Proceso de sustituir stock virtual por stock real

### Prioridades del negocio (en orden):
1. **Que la app no se caiga** — Disponibilidad 24/7
2. **Que los datos sean correctos** — Ventas, costes, stock
3. **Que sea rápida** — Queries optimizadas, carga < 3s
4. **Que sea segura** — Datos de clientes protegidos
5. **Que sea fácil de usar** — UX/UI intuitiva
6. **Que sea escalable** — Preparada para más restaurantes

---

## 4. PROGRAMACIÓN — ESTÁNDARES

### Backend (lacaleta-api):
- Soft delete siempre: `SET deleted_at = CURRENT_TIMESTAMP`
- Multi-tenant siempre: `WHERE restaurante_id = $N AND deleted_at IS NULL`
- Transacciones para operaciones multi-tabla: `BEGIN → COMMIT/ROLLBACK`
- `FOR UPDATE` para lock de filas antes de actualizar stock
- Validación en la entrada (middleware/route), nunca confiar en el frontend
- Logging con `log()` de `src/utils/logger.js`
- Errores con Sentry (captura automática)

### Frontend (mindloop-costos):
- Patrón módulo: `*-crud.js` (datos) + `*-ui.js` (render)
- API centralizada en `src/api/client.js`
- Estado global: `window.*` para legacy, Zustand para módulos nuevos
- Sanitización: DOMPurify para todo input del usuario
- Notificaciones: `showToast()` (nunca `alert()`)

### Tests:
- Tests en `tests/critical/` cubren los 10 flujos principales
- `npm test` ejecuta todos los tests
- CI (GitHub Actions) ejecuta tests antes de merge
- No merges si CI está rojo

---

## 5. ANTI-PATRONES — LO QUE NUNCA HACER

| Anti-patrón | Por qué es malo |
|---|---|
| Proponer staging sin que lo pidan | Añade coste y complejidad innecesaria para 1 developer |
| Sugerir migration runner formal | El `init.js` con `IF NOT EXISTS` ya cubre esto |
| Recomendar cambiar de framework | Las decisiones de stack están tomadas |
| Crear endpoints de backup por HTTP | Es un agujero de seguridad; los backups son server-side |
| Presentar listas de "pendientes críticos" sin verificar | Pierde la confianza del usuario |
| Decir "peligroso" sin evidencia | Alarmismo innecesario |
| Refactoring cosmético como si fuera urgente | Pérdida de tiempo |
| Proponer tests de carga sin problemas de rendimiento | Optimización prematura |

---

## 6. CHECKLIST PRE-ACCIÓN

Antes de hacer CUALQUIER cambio, responde estas preguntas:

- [ ] ¿El usuario pidió esto explícitamente?
- [ ] ¿La app se beneficia de manera medible?
- [ ] ¿He verificado el estado actual del código?
- [ ] ¿He clasificado correctamente: NECESARIO / RECOMENDABLE / COSMÉTICO?
- [ ] ¿Estoy siendo honesto sobre el impacto?

**Si la respuesta a cualquiera es NO, PARA y revisa.**
