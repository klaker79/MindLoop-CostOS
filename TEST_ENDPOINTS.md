# Testing de Endpoints - Múltiples Proveedores por Ingrediente

## Configuración

**Backend URL:** https://lacaleta-api.mindloop.cloud

**Endpoints implementados:**
- `GET /api/ingredients/:id/suppliers` - Listar proveedores de un ingrediente
- `POST /api/ingredients/:id/suppliers` - Asociar proveedor a ingrediente
- `PUT /api/ingredients/:id/suppliers/:supplierId` - Actualizar precio/principal
- `DELETE /api/ingredients/:id/suppliers/:supplierId` - Eliminar asociación

---

## Pre-requisitos

1. Obtener token de autenticación:
```bash
# Login
curl -X POST https://lacaleta-api.mindloop.cloud/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tu_email@example.com",
    "password": "tu_password"
  }'

# Guardar el token retornado
export TOKEN="tu_token_jwt_aqui"
```

2. Identificar IDs existentes:
```bash
# Listar ingredientes
curl -X GET https://lacaleta-api.mindloop.cloud/api/ingredients \
  -H "Authorization: Bearer $TOKEN"

# Listar proveedores
curl -X GET https://lacaleta-api.mindloop.cloud/api/suppliers \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tests de Endpoints

### 1. GET /api/ingredients/:id/suppliers

**Obtener proveedores asociados a un ingrediente**

```bash
# Reemplazar INGREDIENTE_ID con un ID real
INGREDIENTE_ID=1

curl -X GET "https://lacaleta-api.mindloop.cloud/api/ingredients/${INGREDIENTE_ID}/suppliers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Respuesta esperada (200):**
```json
[
  {
    "id": 1,
    "ingrediente_id": 1,
    "proveedor_id": 5,
    "precio": "2.50",
    "es_proveedor_principal": true,
    "created_at": "2026-01-06T10:00:00.000Z",
    "proveedor_nombre": "Proveedor XYZ",
    "proveedor_contacto": "Juan Pérez",
    "proveedor_telefono": "123456789",
    "proveedor_email": "contacto@proveedor.com"
  }
]
```

**Respuesta si no hay proveedores (200):**
```json
[]
```

---

### 2. POST /api/ingredients/:id/suppliers

**Asociar un proveedor a un ingrediente**

```bash
INGREDIENTE_ID=1
PROVEEDOR_ID=5
PRECIO=2.50

curl -X POST "https://lacaleta-api.mindloop.cloud/api/ingredients/${INGREDIENTE_ID}/suppliers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"proveedor_id\": ${PROVEEDOR_ID},
    \"precio\": ${PRECIO},
    \"es_proveedor_principal\": false
  }"
```

**Respuesta esperada (201):**
```json
{
  "id": 1,
  "ingrediente_id": 1,
  "proveedor_id": 5,
  "precio": "2.50",
  "es_proveedor_principal": false,
  "created_at": "2026-01-06T10:00:00.000Z"
}
```

**Errores posibles:**
- `400`: "proveedor_id es requerido"
- `404`: "Ingrediente no encontrado" o "Proveedor no encontrado"

---

### 3. POST - Marcar como principal

**Asociar y marcar como proveedor principal (desmarca otros)**

```bash
INGREDIENTE_ID=1
PROVEEDOR_ID=3
PRECIO=2.80

curl -X POST "https://lacaleta-api.mindloop.cloud/api/ingredients/${INGREDIENTE_ID}/suppliers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"proveedor_id\": ${PROVEEDOR_ID},
    \"precio\": ${PRECIO},
    \"es_proveedor_principal\": true
  }"
```

---

### 4. PUT /api/ingredients/:id/suppliers/:supplierId

**Actualizar precio o cambiar proveedor principal**

```bash
INGREDIENTE_ID=1
PROVEEDOR_ID=5
NUEVO_PRECIO=2.75

curl -X PUT "https://lacaleta-api.mindloop.cloud/api/ingredients/${INGREDIENTE_ID}/suppliers/${PROVEEDOR_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"precio\": ${NUEVO_PRECIO},
    \"es_proveedor_principal\": true
  }"
```

**Respuesta esperada (200):**
```json
{
  "id": 1,
  "ingrediente_id": 1,
  "proveedor_id": 5,
  "precio": "2.75",
  "es_proveedor_principal": true,
  "created_at": "2026-01-06T10:00:00.000Z"
}
```

---

### 5. DELETE /api/ingredients/:id/suppliers/:supplierId

**Eliminar asociación ingrediente-proveedor**

```bash
INGREDIENTE_ID=1
PROVEEDOR_ID=5

curl -X DELETE "https://lacaleta-api.mindloop.cloud/api/ingredients/${INGREDIENTE_ID}/suppliers/${PROVEEDOR_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Respuesta esperada (200):**
```json
{
  "message": "Asociación eliminada",
  "id": 1
}
```

**Error (404):**
```json
{
  "error": "Asociación no encontrada"
}
```

---

## Test de Healthcheck

**Verificar que el servidor responde (requerido para Docker healthcheck)**

```bash
curl -X GET https://lacaleta-api.mindloop.cloud/api/health
```

**Respuesta esperada (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T15:30:00.000Z",
  "version": "2.3.0",
  "cors_origins": [...]
}
```

---

## Flujo de Testing Completo

```bash
#!/bin/bash

# Configuración
API_BASE="https://lacaleta-api.mindloop.cloud"
TOKEN="tu_token_aqui"

echo "=== Test 1: Healthcheck ==="
curl -X GET "${API_BASE}/api/health"

echo -e "\n\n=== Test 2: Listar ingredientes ==="
curl -X GET "${API_BASE}/api/ingredients" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== Test 3: Listar proveedores ==="
curl -X GET "${API_BASE}/api/suppliers" \
  -H "Authorization: Bearer $TOKEN"

# Usar IDs reales de tu BD
INGREDIENTE_ID=1
PROVEEDOR_ID=1

echo -e "\n\n=== Test 4: Obtener proveedores del ingrediente ${INGREDIENTE_ID} ==="
curl -X GET "${API_BASE}/api/ingredients/${INGREDIENTE_ID}/suppliers" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== Test 5: Asociar proveedor ${PROVEEDOR_ID} al ingrediente ${INGREDIENTE_ID} ==="
curl -X POST "${API_BASE}/api/ingredients/${INGREDIENTE_ID}/suppliers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"proveedor_id\": ${PROVEEDOR_ID},
    \"precio\": 2.50,
    \"es_proveedor_principal\": false
  }"

echo -e "\n\n=== Test 6: Verificar asociación creada ==="
curl -X GET "${API_BASE}/api/ingredients/${INGREDIENTE_ID}/suppliers" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== Test 7: Actualizar precio ==="
curl -X PUT "${API_BASE}/api/ingredients/${INGREDIENTE_ID}/suppliers/${PROVEEDOR_ID}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"precio\": 2.75,
    \"es_proveedor_principal\": true
  }"

echo -e "\n\n=== Test 8: Eliminar asociación ==="
curl -X DELETE "${API_BASE}/api/ingredients/${INGREDIENTE_ID}/suppliers/${PROVEEDOR_ID}" \
  -H "Authorization: Bearer $TOKEN"

echo -e "\n\n=== Tests completados ==="
```

---

## Validaciones Implementadas

✅ **Multi-tenant isolation**: Todos los endpoints verifican `restaurante_id`
✅ **Validación de precio**: Usa `validatePrecio()` (0 a 999999, sin NaN)
✅ **UNIQUE constraint**: No permite duplicados (ingrediente_id, proveedor_id)
✅ **Proveedor principal único**: Solo un proveedor puede ser principal por ingrediente
✅ **CASCADE DELETE**: Si se elimina ingrediente o proveedor, se eliminan asociaciones
✅ **Logging**: Todas las operaciones se registran en logs

---

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| 401 Unauthorized | Token inválido o expirado | Hacer login nuevamente |
| 404 Not Found | ID inexistente o no pertenece al restaurante | Verificar IDs con GET /api/ingredients |
| 400 Bad Request | Datos inválidos (precio negativo, etc.) | Revisar formato de request |
| 500 Internal Server Error | Error de BD o lógica | Revisar logs del servidor |

---

## Test en Frontend

1. Abrir https://app.mindloop.cloud o tu frontend local
2. Login con usuario válido
3. Ir a sección "Ingredientes"
4. Click en botón 🏢 (Gestionar proveedores) en cualquier ingrediente
5. Verificar que se abre el modal
6. Agregar un proveedor con precio
7. Verificar que aparece en la lista
8. Marcar como principal
9. Editar precio
10. Eliminar proveedor

---

## Checklist de Implementación

- [x] Backend: 4 endpoints implementados
- [x] Backend: Tabla `ingredientes_proveedores` creada en migraciones
- [x] Backend: Validaciones y seguridad multi-tenant
- [x] Backend: Endpoint `/api/health` verificado
- [x] Frontend: Botón 🏢 en tabla de ingredientes
- [x] Frontend: Modal de gestión de proveedores
- [x] Frontend: Funciones CRUD implementadas
- [x] Frontend: Integración con window.API
- [ ] Testing: Endpoints probados localmente
- [ ] Testing: Frontend probado en navegador
- [ ] Deploy: Push a branch de desarrollo
- [ ] Deploy: PR para revisión

---

**Fecha de creación:** 2026-01-06
**Branch:** feature/multiple-suppliers-per-ingredient
