# 🏗️ Arquitectura del Proyecto MindLoop CostOS

## Estado Actual: Arquitectura Híbrida

El proyecto utiliza una **arquitectura híbrida** donde coexisten:
- Código legacy inline en `index.html`
- Módulos ES6 modernos en `src/modules/`

### ¿Por qué funciona correctamente?

```
ORDEN DE CARGA:
1. index.html → Define funciones legacy en `window.*`
2. main.js → SOBRESCRIBE las funciones con módulos ES6
```

Los módulos ES6 **siempre tienen prioridad** porque se cargan después.

---

## 📁 Estructura de Módulos ES6

```
src/
├── main.js                    # Punto de entrada - expone funciones globalmente
├── modules/
│   ├── ingredientes/
│   │   ├── ingredientes-crud.js    ✅ ACTIVO
│   │   └── ingredientes-ui.js      ✅ ACTIVO
│   ├── recetas/
│   │   ├── recetas-crud.js         ✅ ACTIVO
│   │   └── recetas-ui.js           ✅ ACTIVO
│   ├── proveedores/
│   │   ├── proveedores-crud.js     ✅ ACTIVO
│   │   └── proveedores-ui.js       ✅ ACTIVO
│   ├── pedidos/
│   │   ├── pedidos-crud.js         ✅ ACTIVO
│   │   └── pedidos-ui.js           ✅ ACTIVO
│   ├── ventas/
│   │   ├── ventas-crud.js          ✅ ACTIVO
│   │   └── ventas-ui.js            ✅ ACTIVO
│   ├── dashboard/
│   │   └── dashboard-ui.js         ✅ ACTIVO
│   ├── export/
│   │   ├── pdf-generator.js        ✅ ACTIVO
│   │   └── pdf-helper.js           ✅ ACTIVO
│   └── ui/
│       ├── toast.js                ✅ ACTIVO
│       └── dom-helpers.js          ✅ ACTIVO
```

---

## 📋 Estado de Migración Legacy → ES6

| Módulo | Legacy Comentado | Módulo ES6 | Estado |
|--------|------------------|------------|--------|
| Ingredientes | ✅ Sí | ✅ Activo | ✅ Completo |
| Recetas | ✅ Sí | ✅ Activo | ✅ Completo |
| Proveedores | ✅ Sí | ✅ Activo | ✅ Completo |
| Pedidos | ⚠️ No | ✅ Activo | ⚙️ Híbrido |
| Ventas | ⚠️ No | ✅ Activo | ⚙️ Híbrido |
| Dashboard | ⚠️ No | ✅ Activo | ⚙️ Híbrido |

> **Nota:** Los módulos marcados como "Híbrido" funcionan correctamente porque el módulo ES6 tiene prioridad.

---

## ⚠️ Código Legacy en index.html

El código legacy está marcado con bloques de comentario:

```javascript
/* ========================================
 * CÓDIGO LEGACY - [MÓDULO] (COMENTADO)
 * ✅ AHORA EN: src/modules/[módulo]/
 * Fecha migración: 2025-12-21
 * NO BORRAR hasta validar 100% producción
 * ======================================== */
```

### Ubicación de bloques legacy:
- **Ingredientes**: Líneas ~4357-4544 (COMENTADO ✅)
- **Recetas**: Líneas ~4548-4850 (COMENTADO ✅)
- **Proveedores**: Líneas ~4854-5066 (COMENTADO ✅)
- **Pedidos**: Líneas ~5072-6019 (Activo - ES6 tiene prioridad)
- **Ventas**: Líneas ~6100+ (Activo - ES6 tiene prioridad)
- **Dashboard**: Líneas ~6500+ (Activo - ES6 tiene prioridad)

---

## 🔧 Guía de Mantenimiento

### Para añadir nueva funcionalidad:
1. **Siempre usa los módulos ES6** en `src/modules/`
2. Exporta la función en el módulo
3. Expón globalmente en `main.js` si se necesita desde HTML

### Para modificar funcionalidad existente:
1. **Modifica SOLO el módulo ES6**, no el código legacy
2. El cambio se aplicará automáticamente

### Para eliminar código legacy (futuro):
1. Verificar que el módulo ES6 cubre toda la funcionalidad
2. Hacer backup del código legacy
3. Eliminar línea por línea, probando después de cada cambio

---

## 🚀 Beneficios de la Arquitectura Actual

1. **Estabilidad**: La app funciona sin errores
2. **Mantenibilidad**: Código modular fácil de entender
3. **Retrocompatibilidad**: No rompe funcionalidad existente
4. **Migración gradual**: Permite continuar mejorando sin riesgo

---

*Última actualización: 2025-12-21*
