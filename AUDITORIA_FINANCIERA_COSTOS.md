# 🔍 AUDITORÍA FINANCIERA - FÓRMULAS DE COSTES Y CÁLCULOS FINANCIEROS

**Fecha:** 2026-01-15
**Sistema:** MindLoop CostOS v2.0
**Enfoque:** Cálculos de costes, Food Cost, P&L, y descuento de stock
**Auditor:** Claude (Anthropic AI)

---

## 📊 RESUMEN EJECUTIVO

Se realizó una auditoría exhaustiva de las fórmulas de cálculo de costes, Food Cost, P&L y descuento de stock en el sistema MindLoop CostOS. Se identificaron **3 errores críticos** y **1 advertencia importante** que pueden causar cálculos incorrectos de costes y márgenes.

### ⚡ Contexto de Corrección Previa

El usuario ya corrigió un bug crítico donde **NO se dividía por `cantidad_por_formato`**, lo que inflaba el Food Cost al 75%. Sin embargo, se han encontrado **múltiples ubicaciones donde el mismo problema persiste** en funciones fallback y alternativas.

### 🎯 Hallazgos Principales

| # | Ubicación | Severidad | Estado | Impacto |
|---|-----------|-----------|--------|---------|
| 1 | `recetas-crud.js` - calcularCosteRecetaCompleto() | 🔴 **CRÍTICO** | ❌ Bug Activo | Inflación de costes cuando no hay precio_medio |
| 2 | `performance.js` - calcularCosteRecetaMemoizado() | 🔴 **CRÍTICO** | ❌ Bug Activo | KPI Margen incorrecto en dashboard |
| 3 | `escandallo.js` - cálculo de coste | 🟡 **IMPORTANTE** | ❌ Bug Activo | Escandallo muestra costes incorrectos |
| 4 | `cost-tracker.js` - cálculo de coste | 🟡 **IMPORTANTE** | ❌ Bug Activo | Tracker muestra costes inflados |
| 5 | Descuento de stock en ventas | ✅ **VERIFICADO** | ⚠️ Backend | Requiere auditoría backend |

---

## 🔴 ERROR #1: calcularCosteRecetaCompleto() - CRÍTICO

### 📍 Ubicación
**Archivo:** `src/modules/recetas/recetas-crud.js`
**Líneas:** 171-203
**Función:** `calcularCosteRecetaCompleto(receta)`

### 🐛 Descripción del Problema

La función calcula correctamente el coste cuando existe `precio_medio` en el inventario, pero el **fallback usa `ing.precio` directamente SIN dividir por `cantidad_por_formato`**.

### 📄 Código Actual (con bug)

```javascript
export function calcularCosteRecetaCompleto(receta) {
    // ... código previo ...

    return receta.ingredientes.reduce((total, item) => {
        // ... código para recetas base ...

        // Ingrediente normal
        const invItem = invMap.get(item.ingredienteId);
        const ing = ingMap.get(item.ingredienteId);

        // ✅ CORRECTO: Usa precio_medio si existe
        const precio = invItem?.precio_medio
            ? parseFloat(invItem.precio_medio)
            // ❌ BUG: Fallback usa ing.precio SIN dividir por cantidad_por_formato
            : (ing?.precio ? parseFloat(ing.precio) : 0);

        return total + precio * item.cantidad;
    }, 0);
}
```

### 💥 Impacto

**Severidad:** 🔴 **CRÍTICO**

- **Frecuencia:** Se ejecuta cuando NO hay `precio_medio` en inventario (ej: ingredientes nuevos sin pedidos recibidos)
- **Afectación:** Costes de recetas inflados x2 a x10 (dependiendo de `cantidad_por_formato`)
- **Ejemplo:**
  - Precio del proveedor: 10€ por caja de 5kg
  - `cantidad_por_formato = 5`
  - Precio unitario correcto: 10€ / 5kg = 2€/kg
  - **Precio calculado (BUG)**: 10€/kg ❌ (inflación 5x)

### 🔧 Solución

```javascript
export function calcularCosteRecetaCompleto(receta) {
    if (!receta || !receta.ingredientes) return 0;

    const invMap = getInvMap();
    const ingMap = getIngMap();
    const recetas = window.recetas || [];
    const recetasMap = new Map(recetas.map(r => [r.id, r]));

    return receta.ingredientes.reduce((total, item) => {
        // 🧪 Detectar si es receta base
        if (item.ingredienteId > 100000) {
            const recetaId = item.ingredienteId - 100000;
            const recetaBase = recetasMap.get(recetaId);
            if (recetaBase) {
                const costeRecetaBase = calcularCosteRecetaCompleto(recetaBase);
                return total + costeRecetaBase * item.cantidad;
            }
            return total;
        }

        // Ingrediente normal
        const invItem = invMap.get(item.ingredienteId);
        const ing = ingMap.get(item.ingredienteId);

        // ✅ FIX: Calcular precio unitario correctamente
        let precioUnitario = 0;

        if (invItem?.precio_medio) {
            // Usar precio_medio del inventario (ya es unitario)
            precioUnitario = parseFloat(invItem.precio_medio);
        } else if (ing?.precio) {
            // Calcular precio unitario dividiendo por cantidad_por_formato
            const precioBase = parseFloat(ing.precio);
            const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
            precioUnitario = precioBase / cantidadFormato;
        }

        return total + precioUnitario * item.cantidad;
    }, 0);
}
```

---

## 🔴 ERROR #2: calcularCosteRecetaMemoizado() - CRÍTICO

### 📍 Ubicación
**Archivo:** `src/utils/performance.js`
**Líneas:** 259-276
**Función:** `calcularCosteRecetaMemoizado(receta)`

### 🐛 Descripción del Problema

Esta función **NO usa `precio_medio` del inventario** y **siempre usa `ing.precio` directamente** sin dividir por `cantidad_por_formato`. Es usada por el **dashboard para calcular el KPI de Margen Promedio**.

### 📄 Código Actual (con bug)

```javascript
export function calcularCosteRecetaMemoizado(receta) {
    if (!receta || !receta.ingredientes) return 0;

    // Clave de cache
    const key = `${receta.id}-${JSON.stringify(receta.ingredientes.map(i => [i.ingredienteId, i.cantidad]))}`;

    const cached = costeRecetasCache.get(key);
    if (cached !== null) return cached;

    const coste = receta.ingredientes.reduce((total, item) => {
        const ing = dataMaps.getIngrediente(item.ingredienteId);
        // ❌ BUG: Usa ing.precio directamente SIN dividir por cantidad_por_formato
        const precio = ing ? parseFloat(ing.precio || 0) : 0;
        return total + precio * (item.cantidad || 0);
    }, 0);

    costeRecetasCache.set(key, coste);
    return coste;
}
```

### 💥 Impacto

**Severidad:** 🔴 **CRÍTICO**

- **Afectación:** KPI "Margen Promedio" en dashboard muestra valores INCORRECTOS
- **Ubicación de uso:** `dashboard.js:164-186`
- **Ejemplo:**
  - Receta: Hamburguesa (PVP: 10€)
  - Coste real: 3€ → Margen real: 70%
  - Coste calculado (BUG): 12€ → Margen calculado: -20% ❌
  - **Resultado:** Dashboard muestra pérdidas cuando en realidad hay ganancias

### 🔧 Solución

```javascript
export function calcularCosteRecetaMemoizado(receta) {
    if (!receta || !receta.ingredientes) return 0;

    // Clave de cache (incluir timestamp de inventario para invalidar cache)
    const key = `${receta.id}-${JSON.stringify(receta.ingredientes.map(i => [i.ingredienteId, i.cantidad]))}-${dataMaps.lastUpdate || 0}`;

    const cached = costeRecetasCache.get(key);
    if (cached !== null) return cached;

    // ✅ FIX: Usar mismo cálculo que calcularCosteRecetaCompleto
    const inventario = window.inventarioCompleto || [];
    const invMap = new Map(inventario.map(i => [i.id, i]));

    const coste = receta.ingredientes.reduce((total, item) => {
        const ing = dataMaps.getIngrediente(item.ingredienteId);
        const invItem = invMap.get(item.ingredienteId);

        let precioUnitario = 0;

        if (invItem?.precio_medio) {
            // Usar precio_medio del inventario (ya es unitario)
            precioUnitario = parseFloat(invItem.precio_medio);
        } else if (ing?.precio) {
            // Calcular precio unitario dividiendo por cantidad_por_formato
            const precioBase = parseFloat(ing.precio);
            const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
            precioUnitario = precioBase / cantidadFormato;
        }

        return total + precioUnitario * (item.cantidad || 0);
    }, 0);

    costeRecetasCache.set(key, coste);
    return coste;
}
```

---

## 🟡 ERROR #3: Escandallo - Cálculo de Coste - IMPORTANTE

### 📍 Ubicación
**Archivo:** `src/modules/recetas/escandallo.js`
**Líneas:** 31-46
**Función:** `verEscandallo(recetaId)`

### 🐛 Descripción del Problema

Mismo bug que #1: usa `precio_medio` correctamente, pero fallback usa `ing.precio` sin dividir.

### 📄 Código Actual (con bug)

```javascript
(receta.ingredientes || []).forEach(item => {
    const ing = ingMap.get(item.ingredienteId);
    const inv = invMap.get(item.ingredienteId);

    if (ing) {
        // ✅ CORRECTO: Usa precio_medio si existe
        const precio = inv?.precio_medio
            ? parseFloat(inv.precio_medio)
            // ❌ BUG: Fallback usa ing.precio SIN dividir
            : parseFloat(ing.precio || 0);
        const coste = precio * item.cantidad;
        // ...
    }
});
```

### 💥 Impacto

**Severidad:** 🟡 **IMPORTANTE**

- **Afectación:** Escandallo PDF muestra costes y Food Cost incorrectos
- **Frecuencia:** Solo cuando no hay `precio_medio` en inventario
- **Consecuencia:** Decisiones de negocio basadas en datos erróneos

### 🔧 Solución

```javascript
(receta.ingredientes || []).forEach(item => {
    const ing = ingMap.get(item.ingredienteId);
    const inv = invMap.get(item.ingredienteId);

    if (ing) {
        // ✅ FIX: Calcular precio unitario correctamente
        let precioUnitario = 0;

        if (inv?.precio_medio) {
            precioUnitario = parseFloat(inv.precio_medio);
        } else if (ing?.precio) {
            const precioBase = parseFloat(ing.precio);
            const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
            precioUnitario = precioBase / cantidadFormato;
        }

        const coste = precioUnitario * item.cantidad;
        costeTotal += coste;

        desglose.push({
            nombre: ing.nombre,
            cantidad: item.cantidad,
            unidad: ing.unidad || 'ud',
            precioUnitario: precioUnitario,
            coste: coste,
            porcentaje: 0 // Calculated below
        });
    }
});
```

---

## 🟡 ERROR #4: Cost Tracker - Cálculo de Coste - IMPORTANTE

### 📍 Ubicación
**Archivo:** `src/modules/recetas/cost-tracker.js`
**Líneas:** 185-196
**Función:** `actualizarDatosCostTracker()`

### 🐛 Descripción del Problema

Mismo patrón: usa `precio_medio` correctamente, pero fallback usa `ing.precio` sin dividir.

### 📄 Código Actual (con bug)

```javascript
recetaIngredientes.forEach(item => {
    const ingId = item.ingredienteId || item.ingrediente_id;
    const invItem = inventarioMap.get(ingId);
    const ing = ingredientesMap.get(ingId);

    // ✅ CORRECTO: Usa precio_medio si existe
    const precio = invItem?.precio_medio
        ? parseFloat(invItem.precio_medio)
        // ❌ BUG: Fallback usa ing.precio SIN dividir
        : (ing?.precio ? parseFloat(ing.precio) : 0);

    costeActual += precio * parseFloat(item.cantidad || 0);
});
```

### 💥 Impacto

**Severidad:** 🟡 **IMPORTANTE**

- **Afectación:** Modal "Seguimiento de Costes en Tiempo Real" muestra datos incorrectos
- **Frecuencia:** Ingredientes sin pedidos recibidos
- **Consecuencia:** Recetas marcadas como "Alerta" cuando en realidad son rentables

### 🔧 Solución

```javascript
recetaIngredientes.forEach(item => {
    const ingId = item.ingredienteId || item.ingrediente_id;
    const invItem = inventarioMap.get(ingId);
    const ing = ingredientesMap.get(ingId);

    // ✅ FIX: Calcular precio unitario correctamente
    let precioUnitario = 0;

    if (invItem?.precio_medio) {
        precioUnitario = parseFloat(invItem.precio_medio);
    } else if (ing?.precio) {
        const precioBase = parseFloat(ing.precio);
        const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
        precioUnitario = precioBase / cantidadFormato;
    }

    costeActual += precioUnitario * parseFloat(item.cantidad || 0);
});
```

---

## ✅ VERIFICACIÓN #5: Descuento de Stock en Ventas

### 📍 Ubicación
**Frontend:** `src/services/api.js:307-312`
**Backend:** ⚠️ **NO AUDITADO** (no accesible)

### 🔍 Análisis

El frontend envía solo `{ recetaId, cantidad }` al backend:

```javascript
async function createSale(recetaId, cantidad) {
    return await fetchAPI('/api/sales', {
        method: 'POST',
        body: JSON.stringify({ recetaId, cantidad }),
    });
}
```

**Conclusión:** El descuento de stock se realiza **completamente en el BACKEND**. No hay lógica de descuento en el frontend.

### ⚠️ Recomendaciones

1. **Auditar backend:** Verificar que `POST /api/sales` descuente stock correctamente usando:
   - `stock_virtual` (stock teórico calculado)
   - `cantidad_por_formato` al calcular consumo de ingredientes
   - Transacciones atómicas para evitar race conditions

2. **Verificar cálculos:**
   - ¿Se multiplica `item.cantidad` (de receta) por `venta.cantidad`?
   - ¿Se usa `precio_medio` del inventario o `precio` del ingrediente?
   - ¿Se actualiza `stock_virtual` tras cada venta?

3. **Testing recomendado:**
   ```sql
   -- Test: Registrar venta y verificar descuento
   SELECT stock_virtual FROM ingredientes WHERE id = 123; -- Antes: 10kg
   INSERT INTO ventas (receta_id, cantidad) VALUES (5, 2); -- Receta usa 0.5kg
   SELECT stock_virtual FROM ingredientes WHERE id = 123; -- Después: 9kg ✅
   ```

---

## ✅ VERIFICACIÓN #6: Cálculo de Valor de Stock en Dashboard

### 📍 Ubicación
**Archivo:** `src/modules/dashboard/dashboard.js`
**Líneas:** 206-216

### 🔍 Análisis

Este cálculo está **CORRECTO**:

```javascript
const valorTotal = inventario.reduce((sum, ing) => {
    const stock = parseFloat(ing.stock_virtual) || 0;
    let precioUnitario = parseFloat(ing.precio_medio) || 0;

    if (!precioUnitario) {
        const precioBase = parseFloat(ing.precio) || 0;
        const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 0;
        // ✅ CORRECTO: Divide por cantidad_por_formato
        precioUnitario = (cantidadFormato > 0) ? precioBase / cantidadFormato : precioBase;
    }

    return sum + (stock * precioUnitario);
}, 0);
```

### ✅ Estado
**Sin errores.** Este cálculo ya implementa correctamente la división por `cantidad_por_formato`.

---

## 📋 CHECKLIST DE CORRECCIONES

### 🔴 Prioridad CRÍTICA (Implementar YA)

- [ ] **Error #1:** Corregir `calcularCosteRecetaCompleto()` en `recetas-crud.js`
- [ ] **Error #2:** Corregir `calcularCosteRecetaMemoizado()` en `performance.js`

### 🟡 Prioridad IMPORTANTE (Implementar esta semana)

- [ ] **Error #3:** Corregir cálculo en `escandallo.js`
- [ ] **Error #4:** Corregir cálculo en `cost-tracker.js`

### ⚠️ Recomendaciones Adicionales

- [ ] **Centralizar cálculo:** Crear función única `calcularPrecioUnitario(ingrediente, inventario)` y reutilizarla
- [ ] **Auditar backend:** Verificar descuento de stock en `POST /api/sales`
- [ ] **Testing:** Crear tests unitarios para cálculos de coste
- [ ] **Documentación:** Documentar fórmula: `precio_unitario = precio / cantidad_por_formato`

---

## 🧪 PLAN DE TESTING

### Test 1: Ingrediente con formato (ej: caja de 5kg)

```javascript
// Setup
const ingrediente = {
    id: 1,
    nombre: 'Tomate',
    precio: 10, // 10€ por caja
    cantidad_por_formato: 5, // 5kg por caja
    unidad: 'kg'
};

const receta = {
    id: 1,
    nombre: 'Ensalada',
    ingredientes: [
        { ingredienteId: 1, cantidad: 2 } // 2kg de tomate
    ],
    precio_venta: 8
};

// Test
const coste = calcularCosteRecetaCompleto(receta);

// Esperado:
// precio_unitario = 10€ / 5kg = 2€/kg
// coste = 2€/kg * 2kg = 4€
console.assert(coste === 4, `Coste esperado: 4€, obtenido: ${coste}€`);

// Food Cost
const foodCost = (coste / receta.precio_venta) * 100;
console.assert(foodCost === 50, `Food Cost esperado: 50%, obtenido: ${foodCost}%`);
```

### Test 2: Ingrediente sin formato (precio unitario directo)

```javascript
const ingrediente = {
    id: 2,
    nombre: 'Sal',
    precio: 1.5, // 1.5€ por kg
    cantidad_por_formato: null, // Sin formato
    unidad: 'kg'
};

const receta = {
    ingredientes: [
        { ingredienteId: 2, cantidad: 0.01 } // 10g de sal
    ],
    precio_venta: 10
};

const coste = calcularCosteRecetaCompleto(receta);

// Esperado:
// precio_unitario = 1.5€ / 1 = 1.5€/kg (sin formato, usar 1)
// coste = 1.5€/kg * 0.01kg = 0.015€
console.assert(Math.abs(coste - 0.015) < 0.001, `Coste esperado: ~0.015€, obtenido: ${coste}€`);
```

### Test 3: Usar precio_medio del inventario (prioridad)

```javascript
const ingrediente = {
    id: 3,
    nombre: 'Carne',
    precio: 20, // Precio original
    cantidad_por_formato: 2
};

const inventario = [
    {
        id: 3,
        precio_medio: 12.5 // Precio medio de pedidos
    }
];

const receta = {
    ingredientes: [
        { ingredienteId: 3, cantidad: 1 }
    ]
};

// Debe usar precio_medio (12.5€) en lugar de precio/cantidad_por_formato (10€)
const coste = calcularCosteRecetaCompleto(receta);
console.assert(coste === 12.5, `Debe usar precio_medio: ${coste}€`);
```

---

## 📊 IMPACTO FINANCIERO ESTIMADO

Basado en el bug corregido anteriormente (Food Cost inflado del 75%):

### Escenario: Restaurante con 50 recetas

| Métrica | Antes (Bug) | Después (Fix) | Mejora |
|---------|-------------|---------------|--------|
| Food Cost Promedio | 75% | 30% | ✅ -45pp |
| Margen Promedio | 25% | 70% | ✅ +45pp |
| Recetas "En Alerta" | 45/50 (90%) | 5/50 (10%) | ✅ -80% |
| Decisiones Incorrectas | ❌ Subir precios innecesariamente | ✅ Mantener competitividad | Crítico |

### Impacto en Toma de Decisiones

**Sin el fix:**
- Dashboard muestra pérdidas ficticias
- Gerente sube precios → Pérdida de clientes
- Se eliminan platos "no rentables" que en realidad SÍ lo son

**Con el fix:**
- Datos reales de rentabilidad
- Decisiones basadas en información correcta
- Optimización real de costes

---

## 🚀 IMPLEMENTACIÓN RECOMENDADA

### Paso 1: Crear función centralizada (NUEVO ARCHIVO)

**Archivo:** `src/utils/precio-helpers.js`

```javascript
/**
 * Calcula el precio unitario de un ingrediente
 * Prioridad: precio_medio > precio/cantidad_por_formato
 *
 * @param {Object} ingrediente - Ingrediente desde window.ingredientes
 * @param {Object|null} inventarioItem - Item desde window.inventarioCompleto
 * @returns {number} Precio unitario en euros
 */
export function calcularPrecioUnitario(ingrediente, inventarioItem = null) {
    if (!ingrediente) return 0;

    // Prioridad 1: Usar precio_medio del inventario (basado en compras reales)
    if (inventarioItem?.precio_medio) {
        return parseFloat(inventarioItem.precio_medio) || 0;
    }

    // Prioridad 2: Calcular desde precio del ingrediente
    if (ingrediente.precio) {
        const precioBase = parseFloat(ingrediente.precio) || 0;
        const cantidadFormato = parseFloat(ingrediente.cantidad_por_formato) || 1;

        // CRÍTICO: Dividir por cantidad_por_formato
        // Ejemplo: 10€ por caja de 5kg → 2€/kg
        return precioBase / cantidadFormato;
    }

    return 0;
}

/**
 * Calcula el coste total de una receta
 * @param {Object} receta - Receta con array de ingredientes
 * @param {Map} ingredientesMap - Map de ingredientes (id → objeto)
 * @param {Map} inventarioMap - Map de inventario (id → objeto)
 * @returns {number} Coste total en euros
 */
export function calcularCosteReceta(receta, ingredientesMap, inventarioMap) {
    if (!receta || !receta.ingredientes) return 0;

    return receta.ingredientes.reduce((total, item) => {
        const ing = ingredientesMap.get(item.ingredienteId);
        const inv = inventarioMap.get(item.ingredienteId);

        const precioUnitario = calcularPrecioUnitario(ing, inv);
        const cantidad = parseFloat(item.cantidad) || 0;

        return total + (precioUnitario * cantidad);
    }, 0);
}
```

### Paso 2: Actualizar todos los archivos

**recetas-crud.js:**
```javascript
import { calcularPrecioUnitario } from '../../utils/precio-helpers.js';

export function calcularCosteRecetaCompleto(receta) {
    if (!receta || !receta.ingredientes) return 0;

    const invMap = getInvMap();
    const ingMap = getIngMap();

    return receta.ingredientes.reduce((total, item) => {
        const ing = ingMap.get(item.ingredienteId);
        const inv = invMap.get(item.ingredienteId);

        // ✅ Usar función centralizada
        const precioUnitario = calcularPrecioUnitario(ing, inv);

        return total + precioUnitario * item.cantidad;
    }, 0);
}
```

**performance.js, escandallo.js, cost-tracker.js:**
- Importar y usar `calcularPrecioUnitario()` de la misma manera

### Paso 3: Testing

```bash
# Crear archivo de tests
touch __tests__/utils/precio-helpers.test.js

# Ejecutar tests
npm test -- precio-helpers.test.js
```

---

## 📞 RECOMENDACIONES FINALES

### 1. **Prioridad MÁXIMA** (HOY)
- ✅ Implementar correcciones en `recetas-crud.js` y `performance.js`
- ✅ Invalidar cache de recetas: `window.Performance.invalidarCacheRecetas()`
- ✅ Re-calcular KPIs del dashboard

### 2. **Esta Semana**
- ✅ Implementar función centralizada `calcularPrecioUnitario()`
- ✅ Corregir `escandallo.js` y `cost-tracker.js`
- ✅ Crear tests unitarios

### 3. **Auditoría Backend**
- ⚠️ Verificar descuento de stock en `POST /api/sales`
- ⚠️ Verificar cálculo de `precio_medio` en pedidos
- ⚠️ Verificar actualización de `stock_virtual`

### 4. **Comunicación**
- 📢 Notificar a usuarios que hubo un bug en cálculos de coste
- 📢 Explicar que Food Cost/márgenes previos pueden haber estado inflados
- 📢 Recomendar revisar decisiones de precio de las últimas semanas

---

## 🎯 CONCLUSIÓN

Se identificaron **4 ubicaciones con el mismo bug** de cálculo de precio unitario. El impacto es **CRÍTICO** porque afecta a:

1. ❌ Dashboard - KPI Margen (decisiones estratégicas)
2. ❌ Cálculo de costes de recetas (precios de venta)
3. ❌ Escandallo PDF (reporting)
4. ❌ Cost Tracker (monitoreo en tiempo real)

**Acción requerida:** Implementar correcciones INMEDIATAMENTE para evitar decisiones de negocio basadas en datos incorrectos.

---

**Generado por:** Claude Code Audit Tool
**Fecha:** 2026-01-15
**Próxima revisión:** Después de implementar correcciones (48-72h)
