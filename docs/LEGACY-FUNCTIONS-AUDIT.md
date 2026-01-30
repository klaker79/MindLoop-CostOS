# Auditoría de Funciones Legacy

**Fecha:** 2026-01-30
**Archivo:** `src/legacy/app-core.js` (5,737 líneas)

## Funciones Globales (window.*)

| Función | Estado | Migrada a |
|---------|--------|-----------|
| `window.showToast` | ✅ | `src/services/api.js` |
| `window.showLoading` | ✅ | `src/utils/helpers.js` + expuesto en `main.js` |
| `window.hideLoading` | ✅ | `src/utils/helpers.js` + expuesto en `main.js` |
| `window.actualizarKPIs` | ✅ | `src/modules/dashboard/dashboard.js` |
| `window.renderizarVentas` | ✅ | `src/modules/ventas/` |
| `window.eliminarVenta` | ✅ | `src/modules/ventas/` |
| `window.renderizarBalance` | ⚠️ DESACTIVADO | - |
| `window.calcularPL` | ⚠️ DESACTIVADO | - |
| `window.logout` | ✅ | `src/modules/auth/` |
| `window.renderizarEquipo` | ✅ | `src/modules/equipo/` |
| `window.exportarIngredientes` | ✅ | `src/modules/ingredientes/ingredientes-ui.js` |

## Funciones Internas

| Función | Propósito | Estado |
|---------|-----------|--------|
| `escapeHTML` | Seguridad XSS | ✅ `src/utils/safe-html.js` |
| `exportarAExcel` | Exportar datos | ✅ `src/modules/export/` |
| `getElement` | DOM helper | ✅ `src/utils/dom-utils.js` |

## Conclusión

- **Funciones migradas:** La mayoría de las funciones críticas ya existen en módulos
- **Funciones desactivadas:** `renderizarBalance` y `calcularPL` están comentadas en el código
- **Acción recomendada:** Comentar las funciones duplicadas en `app-core.js`
