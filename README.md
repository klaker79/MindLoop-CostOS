# 🍽️ MindLoop CostOS

**Restaurant Intelligence Platform** - Plataforma profesional de gestión de costes, recetas, inventario y análisis financiero para restaurantes.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

---

## 📋 Descripción

MindLoop CostOS es una plataforma completa de inteligencia para restaurantes que permite:

- 📊 **Dashboard en tiempo real** con KPIs financieros (ingresos, márgenes, stock)
- 🥘 **Gestión de recetas** con cálculo automático de costes
- 📦 **Control de inventario** con alertas de stock bajo
- 💰 **Análisis de costes** y proyecciones de consumo
- 📈 **Reportes y exportación** a PDF/Excel
- 🤖 **Chatbot integrado** para soporte
- 🔔 **Sistema de alertas** inteligentes

---

## 🚀 Tecnologías

### Core
- **Vite 5.4** - Build tool ultrarrápido
- **ES6 Modules** - Arquitectura modular moderna
- **Chart.js 4.5** - Visualización de datos
- **DOMPurify** - Seguridad XSS

### Libraries
- **jsPDF + AutoTable** - Generación de PDFs
- **XLSX** - Exportación a Excel
- **API RESTful** - Backend en Node.js

### DevTools
- **ESLint 9** - Code quality
- **Prettier** - Code formatting
- **Jest 29** - Testing framework
- **GitHub Actions** - CI/CD

---

## 📦 Instalación

### Requisitos previos
- Node.js >= 18.x
- npm >= 9.x
- Git

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/klaker79/lacaletacost.git
cd lacaletacost

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (ver .env.example)
cp .env.example .env

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

---

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo (Vite)
npm run build        # Build de producción
npm run preview      # Preview del build local

# Testing
npm test             # Ejecutar tests
npm run test:watch   # Tests en modo watch
npm run test:coverage # Coverage report

# Code Quality
npm run lint         # Linter (ESLint)
npm run lint:fix     # Auto-fix linting errors
npm run format       # Formatear código (Prettier)
npm run format:check # Verificar formato
```

---

## 🚀 Deployment

### Dokploy (Recomendado)

Para deployar en Dokploy, usa **Dockerfile** como Build Type (NO Nixpacks):

```yaml
Build Type: Dockerfile
Repository: klaker79/MindLoop-CostOS
Branch: main
Dockerfile Path: ./Dockerfile
Port: 80
Health Check: /health
```

**⚠️ IMPORTANTE:** Si usas Nixpacks, el build puede fallar generando 502 Bad Gateway. Ver [`DOKPLOY_CONFIG.md`](./DOKPLOY_CONFIG.md) para troubleshooting.

### Docker Manual

```bash
# Build
docker build -t mindloop-costos .

# Run
docker run -p 80:80 mindloop-costos
```

### Vercel

```bash
npm run build
vercel deploy --prod
```

---

## 📁 Estructura del Proyecto

```
lacaletacost/
├── src/
│   ├── main.js                 # Entry point
│   ├── modules/                # Feature modules
│   │   ├── ingredientes/       # CRUD ingredientes
│   │   ├── recetas/            # CRUD recetas
│   │   ├── pedidos/            # CRUD pedidos
│   │   ├── proveedores/        # CRUD proveedores
│   │   ├── ventas/             # CRUD ventas
│   │   ├── dashboard/          # Dashboard & KPIs
│   │   ├── export/             # PDF/Excel export
│   │   ├── chat/               # Chatbot widget
│   │   └── alertas/            # Alert system
│   ├── utils/                  # Utilities
│   │   ├── performance.js      # Memoization & caching
│   │   ├── helpers.js          # Helper functions
│   │   ├── dom-helpers.js      # DOM utilities
│   │   └── search-optimization.js # Search debouncing
│   ├── services/               # API & services
│   │   └── api-client.js       # REST API client
│   ├── ui/                     # UI components
│   │   └── toast.js            # Toast notifications
│   └── legacy/                 # Legacy code (gradual migration)
│       ├── app-core.js         # Core legacy logic
│       ├── inventario-masivo.js # Bulk inventory
│       └── modales.js          # Modal system
├── styles/                     # CSS stylesheets
├── __tests__/                  # Test files
├── docs/                       # Documentation
│   ├── ARQUITECTURA.md         # Architecture docs
│   └── OPTIMIZATIONS.md        # Performance optimizations
└── dist/                       # Build output
```

---

## ⚡ Optimizaciones de Performance

Esta aplicación incluye optimizaciones avanzadas de rendimiento:

### 1. **Carga Paralela de Datos** (75% más rápido)
```javascript
// Antes: secuencial (4s)
await api.getIngredientes();
await api.getRecetas();

// Después: paralelo (1s)
await Promise.all([api.getIngredientes(), api.getRecetas()]);
```

### 2. **Memoización con TTL Cache**
```javascript
// Cache inteligente para cálculos costosos
const coste = calcularCosteRecetaMemoizado(recetaId); // 100x más rápido en hits
```

### 3. **Búsquedas O(1) con Maps**
```javascript
// Antes: O(n) array.find() - 500ms en 10k items
// Después: O(1) Map.get() - 0.5ms
```

### 4. **Debouncing en Búsquedas** (90% menos renders)
```javascript
// Solo renderiza después de 300ms sin typing
```

Ver documentación completa en [OPTIMIZATIONS.md](./docs/OPTIMIZATIONS.md)

---

## 🏗️ Arquitectura

### Patrón CRUD + UI
Cada módulo sigue una estructura consistente:

```
módulo/
  ├── <nombre>-crud.js  # Business logic & API calls
  └── <nombre>-ui.js    # UI rendering & DOM manipulation
```

### Flujo de Datos
```
User Action → UI Handler → CRUD Service → API Client → Backend
                 ↓                                        ↓
              DOM Update ← Data Transform ← Response ← Database
```

### Gestión de Estado
- Estado global en `window.ingredientes`, `window.recetas`, etc.
- DataMaps para búsquedas optimizadas
- TTL Cache para cálculos costosos

Ver documentación completa en [ARQUITECTURA.md](./docs/ARQUITECTURA.md)

---

## 🔐 Seguridad

- **DOMPurify** - Sanitización de HTML para prevenir XSS
- **CSP Headers** - Content Security Policy
- **Input Validation** - Validación en cliente y servidor
- **JWT Authentication** - Tokens seguros para API
- **HTTPS Only** - Comunicación encriptada

---

## 🚢 Deployment

### Producción (Dockploy)

```bash
# 1. Build de producción
npm run build

# 2. Push a GitHub
git push origin main

# 3. Dockploy auto-deploys desde el branch configurado
# URL: https://app.mindloop.cloud
```

### Variables de Entorno Requeridas

```bash
VITE_API_BASE_URL=https://lacaleta-api.mindloop.cloud
```

Ver `.env.example` para lista completa.

---

## 📊 Features Principales

### Dashboard Inteligente
- KPIs en tiempo real (ingresos, márgenes, stock)
- Gráficos interactivos con Chart.js
- Comparativas temporales (día/semana/mes)
- Alertas de stock bajo

### Gestión de Recetas
- Cálculo automático de costes
- Ingredientes asociados
- Cálculo de márgenes
- Historial de cambios

### Control de Inventario
- Stock en tiempo real
- Alertas automáticas
- Proyección de consumo
- Importación masiva (CSV)

### Reportes Avanzados
- Exportación a PDF con jsPDF
- Exportación a Excel con XLSX
- Reportes personalizables
- Análisis de rentabilidad

### Chatbot de Soporte
- Widget flotante integrado
- Respuestas contextuales
- Historial de conversación

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch (desarrollo)
npm run test:watch
```

Cobertura actual: Ver `/coverage/lcov-report/index.html`

---

## 📝 Contribuir

1. Fork el proyecto
2. Crea una feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Code Style
- ESLint para JavaScript
- Prettier para formateo
- Commits descriptivos en español
- JSDoc para funciones públicas

---

## 📄 Licencia

Copyright © 2025 MindLoop. Todos los derechos reservados.

Este software es propietario y confidencial. Uso no autorizado está prohibido.

---

## 👥 Autores

**MindLoop Team**
- Plataforma: [https://app.mindloop.cloud](https://app.mindloop.cloud)
- GitHub: [@klaker79](https://github.com/klaker79)

---

## 🆘 Soporte

Para reportar bugs o solicitar features:
- GitHub Issues: [https://github.com/klaker79/lacaletacost/issues](https://github.com/klaker79/lacaletacost/issues)
- Email: soporte@mindloop.cloud

---

## 📚 Documentación Adicional

- [Arquitectura del Sistema](./docs/ARQUITECTURA.md)
- [Optimizaciones de Performance](./docs/OPTIMIZATIONS.md)
- [Guía de Migración](./docs/README_REFACTORIZACION.md)
- [API Documentation](./docs/API.md) *(próximamente)*

---

## 🎯 Roadmap

- [x] Sistema de módulos ES6
- [x] Optimizaciones de performance (5-10x)
- [x] Build con Vite
- [x] Testing con Jest
- [x] Chatbot integrado
- [ ] TypeScript migration
- [ ] E2E tests (Playwright)
- [ ] Internacionalización (i18n)
- [ ] PWA support
- [ ] Dark mode

---

<div align="center">

**Made with ❤️ by MindLoop**

[⬆ Volver arriba](#-mindloop-costos)

</div>
