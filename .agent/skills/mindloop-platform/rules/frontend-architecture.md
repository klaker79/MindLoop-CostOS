# Frontend Architecture Reference

> **Stack**: Vite 5.4 + ES6 Modules + Chart.js + Zustand + jsPDF + XLSX

## Project Structure

```
mindloop-costos/
├── index.html              # Main HTML (linked to main.js)
├── src/
│   ├── main.js             # Entry point: imports ALL modules, exposes to window.*
│   ├── api/
│   │   └── client.js       # Centralized API client with convenience functions
│   ├── config/
│   │   └── app-config.js   # App-wide configuration (API urls, cache, UI, etc.)
│   ├── modules/            # 41 ES6 modules (see below)
│   ├── stores/             # Zustand state stores
│   ├── ui/                 # Shared UI components (toast, icons, etc.)
│   └── utils/              # Shared utilities (DOM helpers, validation, etc.)
├── css/                    # Stylesheets
├── .env.example            # Environment variables template
├── ARQUITECTURA.md         # Architecture documentation
└── vite.config.js          # Vite build configuration
```

## Module Catalog (41 files in `src/modules/`)

### Pattern: CRUD + UI Separation
- `*-crud.js`: Data operations (API calls, create/edit/delete)
- `*-ui.js`: DOM rendering, event binding, display logic

### Ingredients (`ingredientes/`)
| File | Functions | Description |
|------|-----------|-------------|
| `ingredientes-crud.js` | `guardarIngrediente`, `editarIngrediente`, `eliminarIngrediente`, `toggleIngredienteActivo` | CRUD with double-submit prevention, centralized validation |
| `ingredientes-ui.js` | Rendering, filters, tables | Display ingredient table with family filters |
| `ingredientes-proveedores.js` | Multi-supplier management | UI + logic for supplier associations |
| `evolucion-precio.js` | Price evolution charts | Historical price tracking visualization |

### Recipes (`recetas/`)
| File | Functions | Description |
|------|-----------|-------------|
| `recetas-crud.js` | CRUD operations | Create/edit/delete recipes |
| `recetas-ui.js` | Rendering, escandallo display | Recipe table, cost breakdown |
| `recetas-variantes.js` | Variant management | Copa/Botella variant CRUD with factor |
| `escandallo.js` | Cost breakdown calculator | Detailed recipe costing |
| `cost-tracker.js` | Cost tracking over time | Historical cost analysis |

### Orders (`pedidos/`)
| File | Functions | Description |
|------|-----------|-------------|
| `pedidos-crud.js` | CRUD operations | Create/edit/delete orders |
| `pedidos-ui.js` | Rendering, filters | Order list display |
| `pedidos-cart.js` | Shopping cart logic | Cart for building orders |
| `pedidos-detalles.js` | Order detail modal | View full order details |
| `pedidos-recepcion.js` | Receiving flow | Mark orders as received, set actual quantities |
| `pedidos-export.js` | Export to WhatsApp | Format order for WhatsApp sharing |

### Sales (`ventas/`)
| File | Functions | Description |
|------|-----------|-------------|
| `ventas-crud.js` | CRUD + bulk import | Individual + bulk sales, PDF upload |
| `ventas-ui.js` | Rendering, charts | Sales dashboard with Chart.js |

### Suppliers (`proveedores/`)
| File | Functions | Description |
|------|-----------|-------------|
| `proveedores-crud.js` | CRUD | Supplier management |
| `proveedores-ui.js` | Rendering | Supplier list display |

### Dashboard (`dashboard/`)
| File | Functions | Description |
|------|-----------|-------------|
| `dashboard.js` | `cargarDashboard` | Main dashboard with KPIs, charts, quick stats |

### Analytics (`analytics/`)
| File | Functions | Description |
|------|-----------|-------------|
| `forecast.js` | Forecasting engine | Sales and cost predictions |

### Intelligence (`inteligencia/`)
| File | Functions | Description |
|------|-----------|-------------|
| `inteligencia-ui.js` | Intelligence panel | Freshness, purchase plan, overstock, price check UI |

### Inventory (`inventario/`)
| File | Functions | Description |
|------|-----------|-------------|
| `merma-rapida.js` | Quick waste registration | Rapid waste entry flow |
| `merma-historial.js` | Waste history | View and manage waste records |

### Staff & Scheduling
| File | Description |
|------|-------------|
| `equipo/equipo.js` | Team member management |
| `horarios/horarios.js` | Staff scheduling grid |

### Financial
| File | Description |
|------|-------------|
| `balance/index.js` | Monthly P&L, comparisons |

### Export
| File | Description |
|------|-------------|
| `export/pdf-generator.js` | PDF report generation (jsPDF) |
| `export/pdf-helper.js` | PDF formatting utilities |
| `export/excel-export.js` | Excel export (XLSX library) |

### Other Modules
| File | Description |
|------|-------------|
| `alertas/alertas-sistema.js` | System alerts and notifications |
| `auth/auth.js` | Login/register/logout flows |
| `chat/chat-widget.js` | Chatbot widget (n8n webhook) |
| `chat/chat-styles.js` | Chat widget styling |
| `core/core.js` | Core utilities and initialization |
| `docs/dossier-v24.js` | Documentation/report generation |
| `integrations/integrations-status.js` | External integration status monitoring |
| `search/global-search.js` | Global search across all modules |
| `simulador/index.js` | Price/cost simulator |
| `ui/onboarding.js` | First-time user onboarding |
| `ui/visual-effects.js` | Visual polish and animations |

## API Client (`src/api/client.js`)

### Core `apiClient` Methods
```javascript
apiClient.get(path)         // GET + auth header
apiClient.post(path, data)  // POST + JSON body
apiClient.put(path, data)   // PUT + JSON body
apiClient.patch(path, data) // PATCH + JSON body
apiClient.delete(path)      // DELETE
apiClient.upload(path, formData) // File upload
```

### Convenience Functions
```javascript
// All functions auto-prepend the base URL from config
api.getIngredientes()                // → GET /ingredients
api.getRecetas()                     // → GET /recipes
api.getProveedores()                 // → GET /suppliers
api.getPedidos()                     // → GET /orders
api.getVentas()                      // → GET /sales
api.getBalance(mes, ano)             // → GET /balance/mes?mes=&ano=
api.getBalanceComparativa()          // → GET /balance/comparativa
api.getInventarioCompleto()          // → GET /inventory/complete
api.getMenuEngineering()             // → GET /analysis/menu-engineering
api.createIngrediente(data)          // → POST /ingredients
api.updateIngrediente(id, data)      // → PUT /ingredients/:id
api.deleteIngrediente(id)            // → DELETE /ingredients/:id
api.createReceta(data)               // → POST /recipes
api.updateReceta(id, data)           // → PUT /recipes/:id
api.deleteReceta(id)                 // → DELETE /recipes/:id
api.createPedido(data)               // → POST /orders
api.updatePedido(id, data)           // → PUT /orders/:id
api.deletePedido(id)                 // → DELETE /orders/:id
api.createVenta(data)                // → POST /sales
api.deleteVenta(id)                  // → DELETE /sales/:id
api.uploadVentasBulk(data)           // → POST /sales/bulk
// ... and more
```

## State Management

### Global State (`window.*`)
Legacy pattern — used for cross-module communication:
```javascript
window.ingredientes = []     // Loaded from API
window.recetas = []
window.proveedores = []
window.pedidos = []
window.ventas = []
window.currentUser = {...}   // JWT decoded user
```

### Zustand Stores (`src/stores/`)
Modern stores for complex state:
- `ingredientStore.js` — Ingredient state with loading/error handling

## Configuration (`src/config/app-config.js`)

Key settings available via `getConfig(path)`:
```javascript
appConfig.api.baseUrl       // from VITE_API_BASE_URL or default
appConfig.api.timeout        // 30000ms
appConfig.api.retryAttempts  // 2
appConfig.cache.ttl          // 300000ms (5 min)
appConfig.search.debounceMs  // 300ms
appConfig.validation.maxPrice // 99999.99
appConfig.ui.theme           // 'dark'
appConfig.notifications.autoDismissMs // 5000ms
```

## Performance Patterns

1. **Parallel Data Loading**: `Promise.all()` for independent API calls
2. **Memoization**: TTL-based cache for expensive computations
3. **O(1) Lookups**: `Map` objects for ingredient/recipe/supplier lookups
4. **Debouncing**: 300ms debounce on search inputs
5. **DOM Recycling**: Efficient DOM updates instead of full re-renders

## Security

1. **DOMPurify**: All user input sanitized before DOM insertion
2. **CSP Headers**: Content Security Policy configured
3. **Input Validation**: Centralized in `utils/validation.js`
4. **JWT Auth**: Token refresh handled by API client
