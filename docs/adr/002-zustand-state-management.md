# ADR 002: Zustand para State Management

## Estado
**Aceptado** - Enero 2026

## Contexto
La aplicación necesitaba gestión de estado centralizada para:
- Compartir datos entre módulos (ingredientes, recetas, etc.)
- Sincronizar UI con cambios de datos
- Persistir estado entre sesiones

Opciones evaluadas:
1. **Redux** - Complejo, mucho boilerplate
2. **MobX** - Reactivo pero verboso
3. **Zustand** - Simple, minimalista, TypeScript-friendly
4. **Context API** - Limitado para estado complejo

## Decisión
Usar **Zustand** con stores por dominio:

```javascript
// Ejemplo: authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);
```

### Stores Implementados
- `authStore` - Autenticación y sesión
- `ingredientStore` - Catálogo de ingredientes
- `recipeStore` - Catálogo de recetas
- `alertStore` - Alertas y notificaciones
- `configStore` - Configuración multi-tenant

## Consecuencias

### Positivas ✅
- **API simple**: Sin boilerplate de actions/reducers
- **DevTools**: Compatible con Redux DevTools
- **TypeScript-friendly**: Inferencia de tipos automática
- **Persistencia**: Middleware `persist` incluido
- **Bundle pequeño**: ~2KB vs 7KB de Redux

### Negativas ⚠️
- **Menos ecosistema**: Menos middleware que Redux
- **Menos documentación**: Comunidad más pequeña

## Referencias
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- Implementación: `src/stores/`
