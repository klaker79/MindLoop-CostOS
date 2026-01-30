# ADR 001: Arquitectura Modular Frontend

## Estado
**Aceptado** - Enero 2026

## Contexto
La aplicación tenía un archivo monolítico `app-core.js` de **8,000+ líneas** que contenía toda la lógica de negocio, UI, y utilidades. Esto causaba:
- Dificultad para mantener el código
- Conflictos frecuentes en merges
- Tiempos de onboarding largos para nuevos desarrolladores
- Imposibilidad de testing unitario efectivo

## Decisión
Migrar a una **arquitectura modular** con la siguiente estructura:

```
src/
├── modules/           # 17 módulos de dominio
│   ├── ingredientes/  # CRUD + UI
│   ├── recetas/       # CRUD + UI + Producción
│   ├── pedidos/       # CRUD + UI + Recepción
│   ├── proveedores/   # CRUD + UI
│   ├── inventario/    # Mermas + Stock
│   ├── dashboard/     # KPIs + Período
│   ├── balance/       # P&L + Break-Even
│   ├── simulador/     # Simulador Financiero
│   ├── ventas/        # CRUD + UI
│   ├── escandallos/   # Costes detallados
│   ├── inteligencia/  # IA + Analytics
│   ├── auth/          # Autenticación
│   └── core/          # Inicialización
├── stores/            # Zustand state management
├── services/          # API clients
├── utils/             # Utilidades compartidas
└── config/            # Configuración multi-tenant
```

### Patrón por Módulo
Cada módulo sigue una estructura consistente:
- `[dominio]-crud.js` - Lógica de negocio y operaciones CRUD
- `[dominio]-ui.js` - Renderizado y manipulación del DOM

## Consecuencias

### Positivas ✅
- **Código mantenible**: Cada archivo < 500 líneas
- **Testing más fácil**: Módulos aislados y testables
- **Onboarding más rápido**: Estructura clara y predecible
- **Paralelización**: Múltiples desarrolladores pueden trabajar sin conflictos
- **Tree-shaking**: Solo se incluye el código utilizado

### Negativas ⚠️
- **Más archivos**: 50+ archivos vs 1 monolito
- **Imports complejos**: Necesidad de gestionar dependencias entre módulos
- **Curva de aprendizaje**: Equipo debe aprender nueva estructura

## Referencias
- Fecha de inicio: Diciembre 2025
- Fecha de completación: Enero 2026
- Líneas migradas: ~8,000
- Módulos creados: 17
