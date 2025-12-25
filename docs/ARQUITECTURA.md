# Arquitectura MindLoop CostOS v2.0.0

## Visión General

MindLoop CostOS es una aplicación SPA (Single Page Application) para gestión de costes de restaurantes. Usa una arquitectura modular ES6 con migración progresiva desde código legacy.

## Estructura del Proyecto

```
src/
├── config/         # Configuración centralizada
│   ├── app-config.js    # Settings de app y environment
│   └── constants.js     # Constantes globales
│
├── modules/        # Módulos funcionales (CRUD + UI)
│   ├── auth/           # Autenticación
│   ├── core/           # Funciones centrales (cargarDatos, cambiarTab)
│   ├── equipo/         # Gestión de equipo
│   ├── alertas/        # Sistema de alertas
│   ├── chat/           # Chat IA
│   ├── dashboard/      # KPIs y métricas
│   ├── export/         # Exportación PDF
│   ├── ingredientes/   # CRUD + UI ingredientes
│   ├── pedidos/        # CRUD + UI pedidos
│   ├── proveedores/    # CRUD + UI proveedores
│   ├── recetas/        # CRUD + UI recetas
│   └── ventas/         # CRUD + UI ventas
│
├── services/       # Servicios externos
│   └── api.js          # Cliente API REST
│
├── ui/             # Componentes UI compartidos
│   ├── event-bindings.js  # Event handlers centralizados
│   └── toast.js           # Notificaciones
│
├── utils/          # Utilidades
│   ├── dom-helpers.js      # Helpers DOM
│   ├── helpers.js          # Funciones utilitarias
│   ├── logger.js           # Sistema de logging
│   ├── performance.js      # Optimizaciones (memoization, Maps)
│   ├── sanitize.js         # Sanitización XSS (DOMPurify)
│   └── search-optimization.js  # Debouncing para búsquedas
│
├── legacy/         # Código legacy (en migración)
│   ├── app-core.js         # Código monolítico original
│   ├── inventario-masivo.js
│   └── modales.js
│
├── main.js         # Entry point - expone módulos a window.*
└── vendors.js      # Import de librerías npm
```

## Patrón de Módulos

Cada módulo sigue el patrón:

```
[módulo]/
├── [módulo]-crud.js    # Business logic, API calls, validaciones
└── [módulo]-ui.js      # Rendering, manipulación DOM
```

## Flujo de Datos

```
┌───────────────┐     ┌─────────────┐     ┌──────────────┐
│  UI/Eventos   │────▶│  Módulo.js  │────▶│  api.js      │
│  (click, etc) │     │  (CRUD/UI)  │     │  (fetch)     │
└───────────────┘     └─────────────┘     └──────────────┘
                             │                    │
                             ▼                    ▼
                      ┌─────────────┐     ┌──────────────┐
                      │  Renderizar │     │  Backend API │
                      │  (showToast)│     │  (REST)      │
                      └─────────────┘     └──────────────┘
```

## Estado Global

El estado se mantiene en `window.*`:

```javascript
window.ingredientes = []  // Array de ingredientes
window.recetas = []       // Array de recetas
window.proveedores = []   // Array de proveedores
window.pedidos = []       // Array de pedidos
window.ventas = []        // Array de ventas
```

## Optimizaciones Implementadas

1. **Promise.all()** - Carga paralela de datos (75% más rápido)
2. **Memoización con TTL** - Cache de funciones costosas
3. **DataMaps O(1)** - Búsquedas instantáneas por ID
4. **Debouncing** - Reducción de renders en búsquedas
5. **DocumentFragment** - Batch DOM updates

## Seguridad

- **DOMPurify** - Sanitización de HTML contra XSS
- **JWT** - Autenticación con Bearer tokens
- **Input validation** - Validación client-side

## Build System

- **Vite 5.4** - Build moderno con ES modules
- **ESLint** - Linting con formato plano (eslint.config.js)
- **Prettier** - Formateo consistente
- **Jest** - Testing con jsdom

## Migración Legacy → ES6

El código legacy en `src/legacy/` se ejecuta primero, luego `main.js` sobrescribe las funciones con versiones ES6:

1. `index.html` carga scripts legacy
2. `main.js` se carga al final
3. Funciones ES6 sobrescriben `window.*`
