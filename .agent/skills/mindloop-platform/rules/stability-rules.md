# Reglas de Estabilidad y Control — MindLoop CostOS

> **Estado:** Producción con clientes activos.
> **Fase actual:** Mes 1 — Congelación de features + Tests de flujos críticos.
> **Prioridad absoluta:** Estabilidad, control y escalabilidad. NO innovación.

---

## 1. Principios Fundamentales

Toda acción del agente debe cumplir TODOS estos principios:

1. **Nunca modificar producción directamente** — solo código probado en staging
2. **Cada cambio aislado** — una rama, un propósito
3. **Cada cambio reversible** — revertir un commit no debe afectar otros
4. **Flujos críticos protegidos por tests** — sin test = sin merge
5. **No features hasta estabilidad sólida** — zero feature creep
6. **Todo cambio documentado** — commit descriptivo + contexto

---

## 2. Flujos Críticos ("Zona Roja")

Estos 10 flujos son **intocables** sin test + validación en staging:

| # | Flujo | Módulos afectados |
|---|-------|-------------------|
| 1 | Autenticación (login/registro) | `api/client.js`, `services/api.js`, `server.js` |
| 2 | Importación de compras | `pedidos/pedidos-crud.js`, `pedidos-cart.js` |
| 3 | Importación de ventas | `ventas/ventas-crud.js`, `ventas-ui.js` |
| 4 | Cálculo PNL diario | `balance/index.js`, `dashboard.js` |
| 5 | Cálculo de costes medios | `ingredientes/`, `stores/ingredientStore.js` |
| 6 | Generación de informes PDF | `informes/informes-pdf.js` |
| 7 | Creación de horarios | `horarios/horarios.js` |
| 8 | Comparativa de proveedores | `proveedores/`, `evolucion-precio.js` |
| 9 | Backups automáticos | Backend cron / n8n |
| 10 | Integraciones externas | OCR (Claude), email (Resend), Sentry |

**Regla:** Ninguna modificación puede afectar estos flujos sin:
- ✅ Test asociado
- ✅ Validación en staging
- ✅ Revisión de logs

---

## 3. Protocolo de Cambio (Obligatorio)

Cada modificación sigue este flujo. **Si en cualquier paso algo falla, NO avanza:**

```
1. Crear rama feature/nombre
2. Implementar cambio
3. npm test → DEBE pasar 100%
4. Verificar flujos críticos afectados
5. npm run build → DEBE compilar limpio
6. Commit descriptivo (qué problema soluciona)
7. Deploy en staging
8. Simular uso real + revisar logs
9. Merge a main → Deploy a producción
```

---

## 4. Estructura de Ramas

| Rama | Uso |
|------|-----|
| `main` | Producción estable — SOLO recibe código probado |
| `develop` | Integración de features |
| `feature/nombre` | Cambios individuales aislados |
| `hotfix/nombre` | Arreglos urgentes desde main |

**Prohibido:**
- Trabajar directamente sobre `main`
- Mezclar varios arreglos en un mismo commit
- Merge sin tests pasando

---

## 5. Prohibiciones del Agente

El agente **NO PUEDE:**

- ❌ Editar múltiples módulos críticos simultáneamente
- ❌ Reestructurar arquitectura sin plan previo aprobado
- ❌ Eliminar código sin entender dependencias
- ❌ Cambiar modelos de datos sin migración controlada
- ❌ Modificar lógica financiera sin test asociado
- ❌ Añadir features nuevas durante fase de estabilización
- ❌ Cambiar estructura de carpetas sin motivo justificado
- ❌ Modificar UI innecesariamente

---

## 6. Clasificación de Errores

| Nivel | Criterio | Prioridad |
|-------|----------|-----------|
| **Crítico** | Afecta datos financieros, corrompe cálculos, pierde datos | INMEDIATA |
| **Alto** | Afecta integridad de BD, bloquea flujos principales | 24h |
| **Medio** | UI rota, funcionalidad secundaria afectada | Sprint actual |
| **Bajo** | Cosmético, mejora menor, tech debt | Backlog |

**Siempre priorizar:**
1. Errores que afectan datos financieros
2. Errores que afectan cálculos
3. Errores que afectan integridad de base de datos

**Nunca solucionar un error sin:**
- Identificar causa raíz
- Analizar impacto lateral sobre otros módulos

---

## 7. Testing

### Tests Obligatorios de Flujos Críticos
- [x] Cálculo PNL con datos simulados
- [x] Importación de compras masivas
- [x] Generación de PDF (smoke test)
- [x] Creación de horario
- [x] Cálculo de costes medios

### Regla de Regresión
> **Un bug solucionado sin test asociado es un bug que volverá.**

Cada bug corregido DEBE generar:
1. Un test que reproduzca ese bug
2. Confirmación de que no vuelve a aparecer

### Estado actual (14 Feb 2026)
- **Backend:** 47 suites, 216 tests (all pass)
- **Frontend:** 15 suites, 275 tests (all pass)
- **Total: 491 tests, 10/10 flujos críticos cubiertos**
- Regression suite: `__tests__/regression/p0-p1-regression.test.js` (25 tests)
- Contract tests: `__tests__/api/api-surface-contract.test.js`

### Bugs resueltos (Feb 2026)
- ✅ Bug #3: 401 intermitentes por race condition del token — fix: token separado para logout test + `--runInBand`
- ✅ Bug #4: `init()` duplicado en app-core.js — ya estaba comentado
- ✅ Bug #5: apiClient spread pattern sobreescribía headers auth — fix: destructuring en 5 métodos
- ✅ Bug #6: Logs diagnósticos en apiClient.get() — eliminados
- ✅ Bug #7: CSP bloqueaba Google Fonts y Sentry — ya incluidos en nginx.conf
- ✅ Bug #8: /api/alerts/stats sin auth check — ya tenía guard
- ✅ Bug #9: Ingredientes no renderizaban al recargar página — fix: checkAuth() ahora llama init()

### Bugs pendientes (Mes 2)
- 🐛 2 ventas con cantidad>0 pero total≤0 en lacaleta_dev (requiere decisión del dueño)
- ⚠️ `/api/backup` no existe — requiere decisión sobre implementación

---

## 8. Base de Datos

- ❌ No modificar esquemas manualmente en producción
- ✅ Usar migraciones versionadas (`migrations/*.sql`)
- ✅ Probar migraciones en staging antes de aplicar
- ✅ Backup antes de cada migración
- ❌ Si migración falla en staging → NO pasa a producción

---

## 9. Dependencias

Cada actualización de librería requiere:
1. Verificar compatibilidad con la versión actual
2. Probar flujos críticos después del upgrade
3. Revisar nuevos errores en logs

---

## 10. Protocolo de Emergencia (Producción caída)

```
1. Identificar commit exacto que generó el problema
2. Revertir SOLO ese commit (git revert <hash>)
3. Analizar causa raíz en staging
4. Crear test que reproduzca el fallo
5. Aplicar solución controlada
```

**Nunca hacer rollback completo salvo corrupción total.**

---

## 11. Plan de 90 Días

### Mes 1 (COMPLETADO ✅ — Feb 2026)
- [x] Congelación de features
- [x] Tests de flujos críticos — 10/10 flujos cubiertos, 491 tests total
- [x] Auditoría técnica — 7 de 9 bugs corregidos
- [x] Documentación de arquitectura (skill completo)
- [x] Separación entornos prod/dev/test (parcial — no hay staging real)

### Mes 2 (ACTUAL — Feb-Mar 2026)
- [ ] Corregir bugs documentados restantes (#1, #2)
- [ ] Mejora de validaciones (prevenir datos inválidos)
- [ ] Limpieza de dependencias
- [ ] Optimización de consultas a BD
- [ ] Refactorización de módulos inestables (server.js, app-core.js)
- [ ] Implementar endpoint `/api/backup`

### Mes 3
- [ ] Tests de carga
- [ ] Simulación de restaurante grande
- [ ] Optimización de rendimiento
- [ ] Preparación para escalado
