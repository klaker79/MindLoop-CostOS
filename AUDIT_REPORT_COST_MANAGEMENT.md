# 📊 INFORME DE AUDITORÍA - Sistema de Gestión de Costes
## MindLoop CostOS

**Fecha:** 2026-01-24
**Auditor:** Claude AI - Experto en Sistemas de Costes para Restaurantes
**Versión del Sistema:** v24.x

---

## 📋 RESUMEN EJECUTIVO

| Métrica | Estado |
|---------|--------|
| **Archivos Revisados** | 12 |
| **Funciones de Cálculo Analizadas** | 18 |
| **Errores Críticos** | 0 |
| **Warnings (Inconsistencias)** | 3 |
| **Mejoras Sugeridas** | 4 |

### Veredicto General: ✅ SISTEMA CORRECTO CON MEJORAS MENORES

---

## 📁 ARCHIVOS REVISADOS

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `src/modules/recetas/recetas-crud.js` | 320 | ✅ OK |
| `src/modules/recetas/recetas-ui.js` | 535 | ⚠️ WARNING |
| `src/modules/recetas/recetas-variantes.js` | 346 | ⚠️ WARNING |
| `src/modules/recetas/escandallo.js` | 416 | ✅ OK |
| `src/modules/recetas/cost-tracker.js` | 365 | ✅ OK |
| `src/legacy/inventario-masivo.js` | 1709 | ✅ OK |
| `src/modules/dashboard/dashboard.js` | 591 | ✅ OK |
| `src/utils/performance.js` | 388 | ✅ OK |
| `src/utils/helpers.js` | 465 | ✅ OK |
| `src/services/api.js` | 473 | ✅ OK |
| `src/modules/ingredientes/ingredientes-ui.js` | N/A | ✅ OK |
| `src/legacy/app-core.js` | N/A | ✅ OK |

---

## 🔢 VERIFICACIÓN DE FÓRMULAS

### 1. Precio Unitario
**Fórmula Esperada:**
```
Precio Unitario = precio_medio (WAP) || (precio_formato / cantidad_por_formato)
```

**Estado: ✅ CORRECTO**

| Archivo | Línea | Implementación |
|---------|-------|----------------|
| `recetas-crud.js` | 197-204 | ✅ Usa precio_medio con fallback |
| `recetas-ui.js` | 213-222 | ✅ Usa precio_medio con fallback |
| `escandallo.js` | 79-87 | ✅ Usa precio_medio con fallback |
| `cost-tracker.js` | 194-202 | ✅ Usa precio_medio con fallback |
| `dashboard.js` | 202-213 | ✅ Usa precio_medio con fallback |
| `performance.js` | 276-284 | ✅ Usa precio_medio con fallback |

**Código Verificado:**
```javascript
// ✅ CORRECTO - Patrón consistente en todos los archivos
let precio = 0;
if (invItem?.precio_medio) {
    precio = parseFloat(invItem.precio_medio);  // Prioridad 1: WAP
} else if (ing?.precio) {
    const precioFormato = parseFloat(ing.precio);
    const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;
    precio = precioFormato / cantidadPorFormato;  // Fallback
}
```

---

### 2. Coste de Receta
**Fórmula Esperada:**
```
Coste Receta = Σ(precio_unitario × cantidad_ingrediente) / porciones
```

**Estado: ✅ CORRECTO**

| Archivo | Línea | Implementación |
|---------|-------|----------------|
| `recetas-crud.js` | 180-216 | ✅ Divide por porciones |
| `recetas-ui.js` | 230-232 | ✅ Divide por porciones |
| `performance.js` | 272-294 | ✅ Divide por porciones |

**Código Verificado (`recetas-crud.js:210-215`):**
```javascript
// ✅ CORRECTO - Divide por porciones
const porciones = parseInt(receta.porciones) || 1;
const costePorPorcion = costeTotalLote / porciones;
return parseFloat(costePorPorcion.toFixed(2));
```

---

### 3. Food Cost %
**Fórmula Esperada:**
```
Food Cost % = (Coste / Precio Venta) × 100
```

**Estado: ✅ CORRECTO**

| Archivo | Línea | Implementación |
|---------|-------|----------------|
| `recetas-ui.js` | 246 | ✅ `(costeTotal / precioVenta) * 100` |
| `escandallo.js` | 114 | ✅ `(costeTotal / precioVenta) * 100` |
| `cost-tracker.js` | 209 | ✅ `(costeActual / precioVenta) * 100` |

---

### 4. Margen %
**Fórmula Esperada:**
```
Margen % = ((Precio Venta - Coste) / Precio Venta) × 100
```

**Estado: ✅ CORRECTO**

| Archivo | Línea | Implementación |
|---------|-------|----------------|
| `recetas-ui.js` | 245 | ✅ `((precioVenta - costeTotal) / precioVenta) * 100` |
| `escandallo.js` | 113 | ✅ `(margenEuros / precioVenta) * 100` |
| `dashboard.js` | 169-173 | ✅ `((precio_venta - coste) / precio_venta) * 100` |

---

## ⚠️ WARNINGS DETECTADOS

### WARNING 1: Inconsistencia en Export Excel
**Ubicación:** `src/modules/recetas/recetas-ui.js:485-492`

**Problema:** La función `exportarRecetas()` NO usa `precio_medio` del inventario, calcula el coste directamente con `ing.precio / cantidad_por_formato`.

```javascript
// ⚠️ INCONSISTENTE - No usa precio_medio
const coste = (rec.ingredientes || []).reduce((sum, item) => {
    const ing = ingredientesMap.get(item.ingredienteId);
    if (!ing) return sum;
    const cantidadFormato = parseFloat(ing.cantidad_por_formato) || 1;
    const precioUnitario = parseFloat(ing.precio) / cantidadFormato;  // ⚠️ No usa inventario
    return sum + (precioUnitario * parseFloat(item.cantidad));
}, 0);
```

**Impacto:** Los exports a Excel pueden mostrar costes diferentes a los de la UI.

**Solución Recomendada:** Usar `window.calcularCosteRecetaCompleto(rec)` en lugar del reduce manual.

---

### WARNING 2: Variantes no consideran porciones
**Ubicación:** `src/modules/recetas/recetas-variantes.js:83-112`

**Problema:** El cálculo del coste de variantes suma los ingredientes SIN dividir por porciones antes de aplicar el factor.

```javascript
// ⚠️ POTENCIAL INCONSISTENCIA
receta.ingredientes.forEach(item => {
    // ... suma costes sin dividir por porciones
    costeBase += cantidad * precioUnitario;
});

// Luego aplica factor
const costeVariante = costeBase * factor;  // Si receta.porciones > 1, esto podría ser incorrecto
```

**Impacto:** Si una receta base tiene porciones > 1, el coste de la variante será incorrecto.

**Solución Recomendada:** Dividir `costeBase` por `receta.porciones` antes de multiplicar por `factor`, o usar `window.calcularCosteRecetaCompleto(receta)` directamente.

---

### WARNING 3: Chat Widget usa precio_medio directamente
**Ubicación:** `src/modules/chat/chat-widget.js:1387`

```javascript
const precio = parseFloat(i.precio_medio) || parseFloat(i.precio) || 0;
```

**Problema:** Accede a `precio_medio` directamente desde el ingrediente, pero este campo está en `inventarioCompleto`, no en `ingredientes`.

**Impacto:** Menor - el fallback a `i.precio` funciona, pero no aplica la división por `cantidad_por_formato`.

---

## ✅ VERIFICACIONES CORRECTAS

### Protección contra División por Cero
**Estado: ✅ IMPLEMENTADO**

Todos los lugares usan el patrón seguro:
```javascript
const cantidadPorFormato = parseFloat(ing.cantidad_por_formato) || 1;  // || 1 previene /0
const porciones = parseInt(receta.porciones) || 1;  // || 1 previene /0
```

### Protección contra NaN
**Estado: ✅ IMPLEMENTADO**

Validaciones encontradas en:
- `inventario-masivo.js:101` - `!isNaN(item.stockReal)`
- `modales.js:287` - `if (isNaN(total) || total < 0)`
- `modales.js:374` - `isNaN(gastosFijosMes)`
- `app-core.js:1098` - `if (isNaN(margenBruto))`
- `app-core.js:5201` - `if (isNaN(cantidadPorFormato))`

### Sub-recetas (Recetas Base)
**Estado: ✅ IMPLEMENTADO CORRECTAMENTE**

El sistema detecta sub-recetas con `ingredienteId > 100000` y calcula recursivamente:
```javascript
// recetas-crud.js:181-190
if (item.ingredienteId > 100000) {
    const recetaId = item.ingredienteId - 100000;
    const recetaBase = recetasMap.get(recetaId);
    if (recetaBase) {
        const costeRecetaBase = calcularCosteRecetaCompleto(recetaBase);
        return total + costeRecetaBase * item.cantidad;
    }
}
```

### Importación de Ventas con Variantes
**Estado: ✅ IMPLEMENTADO CORRECTAMENTE**

En `inventario-masivo.js:990`, se pasa `varianteId` para usar el precio correcto:
```javascript
await window.api.createSale({
    recetaId: venta.recetaId,
    cantidad: venta.cantidad,
    varianteId: venta.varianteId,  // ✅ Correcto
});
```

---

## 📈 OPTIMIZACIONES DETECTADAS

El código incluye buenas prácticas de rendimiento:

1. **Maps O(1)** en lugar de `.find()` O(n):
```javascript
const ingMap = new Map(ingredientes.map(i => [i.id, i]));
const invMap = new Map(inventario.map(i => [i.id, i]));
```

2. **Cache con invalidación** en `recetas-crud.js:146-169`

3. **Memoización** en `performance.js:259-294`

---

## 🔧 RECOMENDACIONES DE MEJORA

### 1. Centralizar cálculo de coste
**Prioridad:** Alta

Crear una única función canónica y usarla en todos los lugares:
```javascript
// Propuesta: src/utils/cost-calculator.js
export function calcularPrecioUnitario(ingredienteId) {
    const invItem = invMap.get(ingredienteId);
    const ing = ingMap.get(ingredienteId);

    if (invItem?.precio_medio) return parseFloat(invItem.precio_medio);
    if (ing?.precio) {
        return parseFloat(ing.precio) / (parseFloat(ing.cantidad_por_formato) || 1);
    }
    return 0;
}
```

### 2. Corregir exportarRecetas()
**Prioridad:** Media

Ubicación: `recetas-ui.js:485`

Cambiar el reduce manual por:
```javascript
const coste = window.calcularCosteRecetaCompleto(rec);
```

### 3. Corregir cálculo de variantes
**Prioridad:** Media

Ubicación: `recetas-variantes.js:83-112`

Usar la función centralizada:
```javascript
const costeBase = window.calcularCosteRecetaCompleto(receta);
const costeVariante = costeBase * factor;
```

### 4. Añadir tests unitarios
**Prioridad:** Baja

Crear tests para verificar:
- Precio unitario con y sin precio_medio
- Coste de receta con porciones
- Coste de variantes
- División por cero edge cases

---

## 📊 MATRIZ DE CONSISTENCIA

| Función | precio_medio | cantidad_por_formato | porciones | factor |
|---------|:------------:|:--------------------:|:---------:|:------:|
| `calcularCosteRecetaCompleto` | ✅ | ✅ | ✅ | N/A |
| `calcularCosteReceta` (UI) | ✅ | ✅ | ✅ | N/A |
| `verEscandallo` | ✅ | ✅ | ❌* | N/A |
| `renderizarVariantes` | ❌ | ✅ | ❌ | ✅ |
| `exportarRecetas` | ❌ | ✅ | ❌ | N/A |
| `calcularCosteRecetaMemoizado` | ✅ | ✅ | ✅ | N/A |
| `actualizarKPIs` (dashboard) | ✅ | ✅ | N/A | N/A |

*Escandallo muestra coste total, no por porción (correcto para su propósito)

---

## ✅ CONCLUSIÓN

El sistema de gestión de costes de MindLoop CostOS está **correctamente implementado** en sus funciones principales. Las fórmulas críticas (precio unitario, coste de receta, food cost, margen) son **consistentes y correctas**.

Se detectaron **3 inconsistencias menores** en funciones secundarias (export Excel, variantes, chat widget) que no afectan al funcionamiento principal pero deberían corregirse para mantener la coherencia de datos.

**Prioridades de corrección:**
1. ⚠️ `exportarRecetas()` - Usar precio_medio
2. ⚠️ `renderizarVariantes()` - Considerar porciones
3. 🔵 Centralizar función de cálculo

---

*Informe generado automáticamente por Claude AI*
*Sistema: MindLoop CostOS - Auditoría de Código v1.0*
