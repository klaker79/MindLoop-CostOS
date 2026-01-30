# Guía de Contribución - MindLoop CostOS

## Requisitos
- Node.js 18+
- npm 9+

## Setup
```bash
git clone https://github.com/klaker79/MindLoop-CostOS.git
cd MindLoop-CostOS
npm install
npm run dev
```

## Estructura del Proyecto
```
src/
├── modules/        # Módulos de dominio (17 total)
│   ├── ingredientes/
│   ├── recetas/
│   ├── pedidos/
│   ├── proveedores/
│   ├── inventario/
│   ├── dashboard/
│   ├── balance/
│   ├── simulador/
│   └── ...
├── stores/         # Zustand state stores
├── services/       # API clients
├── utils/          # Utilidades compartidas
├── config/         # Configuración multi-tenant
├── ui/             # Componentes UI compartidos
└── main.js         # Entry point
```

## Convenciones de Código

### Commits (Conventional Commits)
Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `refactor:` Refactorización sin cambio de funcionalidad
- `docs:` Solo documentación
- `test:` Añadir o modificar tests
- `chore:` Tareas de mantenimiento
- `style:` Cambios de formato (no afectan lógica)
- `perf:` Mejoras de rendimiento

**Ejemplos:**
```bash
git commit -m "feat: Add ingredient category filter"
git commit -m "fix: Correct margin calculation in P&L"
git commit -m "refactor: Migrate renderizarBalance to balance module"
```

### Naming
- **Archivos**: kebab-case (`ingredientes-crud.js`)
- **Funciones**: camelCase (`calcularCosteReceta`)
- **Clases**: PascalCase (`IngredienteService`)
- **Constantes**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Variables**: camelCase (`ingredienteActual`)

### Módulos
Cada módulo debe seguir esta estructura:
```
modules/midominio/
├── midominio-crud.js   # Lógica de negocio
├── midominio-ui.js     # Renderizado
└── index.js            # Exports públicos (opcional)
```

### JavaScript
- ES6+ (modules, arrow functions, destructuring)
- Preferir `const` sobre `let`, nunca `var`
- Usar optional chaining (`?.`) para acceso seguro
- Documentar funciones públicas con JSDoc

## Testing
```bash
npm test              # Ejecutar tests
npm run test:watch    # Watch mode
npm run test:coverage # Con cobertura
```

### Escribir Tests
- Ubicación: `__tests__/` o `*.test.js` junto al módulo
- Framework: Vitest
- Nombrar descriptivamente: `should calculate recipe cost correctly`

## Build
```bash
npm run build    # Build producción
npm run preview  # Preview del build
```

## Pull Requests

### Proceso
1. Crear branch desde `main`: `git checkout -b feat/mi-feature`
2. Hacer cambios siguiendo las convenciones
3. Verificar:
   ```bash
   npm run lint    # Sin errores
   npm test        # Tests pasan
   npm run build   # Build exitoso
   ```
4. Commit con mensaje descriptivo
5. Push y crear PR con descripción clara

### Template de PR
```markdown
## Descripción
[Qué hace este PR]

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva feature
- [ ] Breaking change
- [ ] Documentación

## Checklist
- [ ] Tests añadidos/actualizados
- [ ] Documentación actualizada
- [ ] Build pasa
- [ ] Lint sin errores
```

## Arquitectura

### ADRs (Architecture Decision Records)
Las decisiones de arquitectura están documentadas en `docs/adr/`:
- [001 - Arquitectura Modular](docs/adr/001-modular-architecture.md)
- [002 - Zustand State Management](docs/adr/002-zustand-state-management.md)
- [003 - API Versioning](docs/adr/003-api-versioning.md)

## Contacto
- Issues: [GitHub Issues](https://github.com/klaker79/MindLoop-CostOS/issues)
- Dudas: Abrir un issue con label `question`
