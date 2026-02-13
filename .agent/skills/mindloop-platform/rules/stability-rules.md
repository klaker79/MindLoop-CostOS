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
- [ ] Cálculo PNL con datos simulados
- [ ] Importación de compras masivas
- [ ] Generación de PDF
- [ ] Creación de horario
- [ ] Cálculo de costes medios

### Regla de Regresión
> **Un bug solucionado sin test asociado es un bug que volverá.**

Cada bug corregido DEBE generar:
1. Un test que reproduzca ese bug
2. Confirmación de que no vuelve a aparecer

### Estado actual
- 13 test suites, 144 tests, 0 fallos
- Regression suite: `__tests__/regression/p0-p1-regression.test.js` (27 tests)
- Contract tests: `__tests__/api/api-surface-contract.test.js`

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

### Mes 1 (ACTUAL — Feb 2026)
- [x] Congelación de features
- [x] Tests de flujos críticos (P0/P1 regression suite)
- [x] Auditoría técnica (frontend bug audit)
- [ ] Documentación mínima de arquitectura

### Mes 2
- [ ] Refactorización de módulos inestables
- [ ] Limpieza de dependencias
- [ ] Mejora de validaciones
- [ ] Optimización de consultas a BD

### Mes 3
- [ ] Tests de carga
- [ ] Simulación de restaurante grande
- [ ] Optimización de rendimiento
- [ ] Preparación para escalado
