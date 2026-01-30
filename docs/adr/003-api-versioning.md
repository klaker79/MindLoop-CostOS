# ADR 003: Versionado de API

## Estado
**Aceptado** - Enero 2026

## Contexto
La API backend necesitaba evolucionar sin romper clientes existentes. Con múltiples restaurantes usando la aplicación en producción, no podíamos hacer breaking changes.

## Decisión
Implementar **versionado por prefijo de URL**:

```
/api/v1/ingredientes  → Versión legacy (deprecated)
/api/v2/ingredientes  → Versión actual
```

### Convenciones
1. **Nuevas features** → Añadir a v2
2. **Breaking changes** → Nueva versión (v3, v4...)
3. **Deprecación** → Mantener versión anterior 6 meses
4. **Headers opcionales** → `X-API-Version` para override

### Ejemplo de Migración
```javascript
// Antes (v1)
GET /api/ingredientes
Response: [{ id, nombre, precio }]

// Después (v2)
GET /api/v2/ingredientes
Response: { 
  data: [{ id, nombre, precio, categoria, proveedor }],
  meta: { total, page, limit }
}
```

## Consecuencias

### Positivas ✅
- **Backward compatibility**: Clientes antiguos siguen funcionando
- **Migración gradual**: No hay "big bang" de actualización
- **Documentación clara**: Cada versión tiene su spec
- **Rollback fácil**: Podemos revertir endpoints individuales

### Negativas ⚠️
- **Mantenimiento**: Múltiples versiones activas
- **Complejidad backend**: Lógica duplicada temporalmente
- **Testing**: Más test suites a mantener

## Implementación
- Backend: `lacaleta-api/routes/v2/`
- Frontend: `src/services/api.js` con configuración de versión
- Config: `src/config/app-config.js` define versión por defecto

## Referencias
- [API Versioning Best Practices](https://restfulapi.net/versioning/)
- Versión actual en producción: v2
