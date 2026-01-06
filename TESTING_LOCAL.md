# Plan de Testing Local - Múltiples Proveedores por Ingrediente

## 🎯 Objetivo
Probar la funcionalidad completa antes de mergear a main.

---

## 📋 Pre-requisitos

1. **PostgreSQL** corriendo localmente o acceso a BD de desarrollo
2. **Node.js** instalado
3. Credenciales de base de datos

---

## 🔧 Paso 1: Configurar y correr el Backend

### 1.1 Crear archivo .env en lacaleta-api

```bash
cd /home/user/lacaleta-api

# Crear archivo .env
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://usuario:password@localhost:5432/lacaleta_test
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lacaleta_test
DB_USER=postgres
DB_PASSWORD=tu_password

# JWT
JWT_SECRET=test_secret_key_change_in_production_12345

# Server
PORT=3000
NODE_ENV=development

# CORS - Permitir origen local
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173

# Email (opcional para testing)
RESEND_API_KEY=re_test_key
EOF
```

### 1.2 Instalar dependencias

```bash
cd /home/user/lacaleta-api
npm install
```

### 1.3 Crear base de datos de test (si no existe)

```bash
# Conectar a PostgreSQL
psql -U postgres

# Dentro de psql:
CREATE DATABASE lacaleta_test;
\q
```

### 1.4 Correr el backend

```bash
cd /home/user/lacaleta-api
npm start

# Deberías ver:
# ✅ Conectado a PostgreSQL
# ✅ Tablas creadas
# ✅ Servidor corriendo en http://localhost:3000
```

**⚠️ Verificar que se crea la tabla:**
```bash
# En otra terminal, verificar que la tabla existe
psql -U postgres -d lacaleta_test -c "\d ingredientes_proveedores"
```

---

## 🎨 Paso 2: Configurar y correr el Frontend

### 2.1 Crear archivo .env.local

```bash
cd /home/user/MindLoop-CostOS

# Crear archivo .env.local para desarrollo
cat > .env.local << 'EOF'
# Apuntar al backend local
VITE_API_BASE_URL=http://localhost:3000

# Chat (opcional)
VITE_CHAT_WEBHOOK_URL=http://localhost:3000/webhook-test

# Debug
VITE_ENABLE_DEBUG=true
VITE_LOG_LEVEL=debug
EOF
```

### 2.2 Instalar dependencias

```bash
cd /home/user/MindLoop-CostOS
npm install
```

### 2.3 Correr el frontend en modo dev

```bash
cd /home/user/MindLoop-CostOS
npm run dev

# Deberías ver:
# VITE v4.x.x ready in XXX ms
# ➜ Local: http://localhost:5173/
```

---

## 🧪 Paso 3: Testing Manual

### 3.1 Crear datos de prueba

**En el backend (psql):**

```sql
-- Conectar a la BD de test
psql -U postgres -d lacaleta_test

-- 1. Crear restaurante de test
INSERT INTO restaurantes (nombre, email)
VALUES ('Test Restaurant', 'test@test.com')
RETURNING id;
-- Anotar el ID (ejemplo: 1)

-- 2. Crear usuario de test
INSERT INTO usuarios (email, password_hash, nombre, restaurante_id, rol)
VALUES ('test@test.com', '$2a$10$abcdefghijklmnopqrstuv', 'Test User', 1, 'admin')
RETURNING id;

-- 3. Crear proveedores de test
INSERT INTO proveedores (nombre, contacto, telefono, email, restaurante_id)
VALUES
  ('Proveedor A', 'Juan Pérez', '111111111', 'proveedorA@test.com', 1),
  ('Proveedor B', 'María López', '222222222', 'proveedorB@test.com', 1),
  ('Proveedor C', 'Carlos Ruiz', '333333333', 'proveedorC@test.com', 1)
RETURNING id, nombre;

-- 4. Crear ingrediente de test
INSERT INTO ingredientes (nombre, precio, unidad, stock_actual, stock_minimo, familia, restaurante_id)
VALUES ('Tomate', 2.50, 'kg', 10, 5, 'alimento', 1)
RETURNING id, nombre;
-- Anotar el ID (ejemplo: 1)
```

### 3.2 Hacer login en el frontend

1. Abrir: `http://localhost:5173`
2. Login con: `test@test.com` / crear password o usar uno de test

**⚠️ Si falla el login:**
```bash
# Actualizar password en BD con hash conocido (password: "test123")
psql -U postgres -d lacaleta_test

UPDATE usuarios
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE email = 'test@test.com';
```

### 3.3 Testing de la funcionalidad

**Ir a sección "Ingredientes":**

1. ✅ **Verificar que aparece el botón 🏢** en la columna ACCIONES
   - Entre 📈 y ✏️
   - Hover debería mostrar "Gestionar proveedores"

2. ✅ **Abrir modal de proveedores**
   - Click en 🏢
   - Debería abrir modal "Proveedores de Tomate"
   - Lista vacía con mensaje "No hay proveedores asociados"

3. ✅ **Agregar primer proveedor**
   - Seleccionar "Proveedor A" en el dropdown
   - Ingresar precio: `2.50`
   - Click "Agregar"
   - Debería aparecer en la lista

4. ✅ **Agregar segundo proveedor**
   - Seleccionar "Proveedor B"
   - Ingresar precio: `2.80`
   - Click "Agregar"
   - Debería aparecer en la lista

5. ✅ **Marcar como principal**
   - Click en "Marcar como principal" en Proveedor B
   - Debería mostrar badge "⭐ PRINCIPAL"
   - Proveedor A no debería tener el badge

6. ✅ **Editar precio**
   - Click en "✏️ Editar precio" en Proveedor A
   - Cambiar a `2.60`
   - Verificar que se actualiza

7. ✅ **Eliminar proveedor**
   - Click en "🗑️ Eliminar" en Proveedor A
   - Confirmar
   - Debería desaparecer de la lista

8. ✅ **Cerrar modal y reabrir**
   - Cerrar modal
   - Volver a abrir
   - Verificar que solo aparece Proveedor B marcado como principal

---

## 🔍 Paso 4: Verificar en Base de Datos

```sql
-- Ver proveedores asociados
SELECT * FROM ingredientes_proveedores;

-- Debería mostrar algo como:
-- id | ingrediente_id | proveedor_id | precio | es_proveedor_principal | created_at
-- ---|----------------|--------------|--------|------------------------|------------
-- 2  | 1              | 2            | 2.80   | true                   | 2026-01-06...

-- Ver con nombres
SELECT
  ip.*,
  i.nombre as ingrediente,
  p.nombre as proveedor
FROM ingredientes_proveedores ip
JOIN ingredientes i ON i.id = ip.ingrediente_id
JOIN proveedores p ON p.id = ip.proveedor_id;
```

---

## 📊 Paso 5: Testing de Endpoints (API Manual)

### 5.1 Obtener token de autenticación

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123"
  }' | jq

# Copiar el token
export TOKEN="el_token_que_te_devuelve"
```

### 5.2 Test GET - Listar proveedores del ingrediente

```bash
curl -X GET http://localhost:3000/api/ingredients/1/suppliers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

**Respuesta esperada:**
```json
[
  {
    "id": 2,
    "ingrediente_id": 1,
    "proveedor_id": 2,
    "precio": "2.80",
    "es_proveedor_principal": true,
    "created_at": "2026-01-06...",
    "proveedor_nombre": "Proveedor B",
    "proveedor_contacto": "María López",
    "proveedor_telefono": "222222222",
    "proveedor_email": "proveedorB@test.com"
  }
]
```

### 5.3 Test POST - Agregar proveedor

```bash
curl -X POST http://localhost:3000/api/ingredients/1/suppliers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proveedor_id": 3,
    "precio": 2.70,
    "es_proveedor_principal": false
  }' | jq
```

### 5.4 Test PUT - Actualizar precio y marcar como principal

```bash
curl -X PUT http://localhost:3000/api/ingredients/1/suppliers/3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precio": 2.65,
    "es_proveedor_principal": true
  }' | jq
```

### 5.5 Test DELETE - Eliminar asociación

```bash
curl -X DELETE http://localhost:3000/api/ingredients/1/suppliers/3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq
```

### 5.6 Test Healthcheck

```bash
curl -X GET http://localhost:3000/api/health | jq
```

---

## ✅ Checklist de Testing

### Backend
- [ ] Backend corre sin errores
- [ ] Tabla `ingredientes_proveedores` existe en BD
- [ ] Endpoint GET retorna array vacío o con datos
- [ ] Endpoint POST crea asociación correctamente
- [ ] Endpoint POST con `es_proveedor_principal=true` desmarca otros
- [ ] Endpoint PUT actualiza precio
- [ ] Endpoint PUT cambia proveedor principal
- [ ] Endpoint DELETE elimina asociación
- [ ] Multi-tenant isolation funciona (no se puede acceder a ingredientes de otros restaurantes)
- [ ] Healthcheck responde 200

### Frontend
- [ ] Frontend corre sin errores de compilación
- [ ] Botón 🏢 aparece en tabla de ingredientes
- [ ] Modal se abre correctamente
- [ ] Lista de proveedores se carga
- [ ] Dropdown de proveedores disponibles funciona
- [ ] Agregar proveedor funciona
- [ ] Marcar como principal funciona (visual)
- [ ] Editar precio funciona
- [ ] Eliminar proveedor funciona
- [ ] Cerrar y reabrir modal mantiene datos
- [ ] No hay errores en consola del navegador
- [ ] Toasts de éxito/error aparecen

### Integración
- [ ] Frontend se comunica con backend local
- [ ] CORS funciona correctamente
- [ ] Autenticación funciona
- [ ] Cambios se reflejan inmediatamente en UI
- [ ] Cambios persisten en BD

---

## 🐛 Troubleshooting

### Backend no arranca

```bash
# Ver logs detallados
cd /home/user/lacaleta-api
DEBUG=* npm start

# Verificar puerto no ocupado
lsof -i :3000

# Verificar PostgreSQL corriendo
psql -U postgres -c "SELECT version();"
```

### Frontend no conecta con backend

1. Abrir DevTools (F12)
2. Ir a Network tab
3. Hacer una acción (agregar proveedor)
4. Ver si hay error de CORS o 403/401

**Si hay error CORS:**
```bash
# Verificar que backend tiene CORS configurado para localhost:5173
grep -A 10 "ALLOWED_ORIGINS" /home/user/lacaleta-api/server.js
```

### Modal no abre

1. Abrir DevTools Console (F12)
2. Ver errores de JavaScript
3. Verificar que `window.gestionarProveedoresIngrediente` existe:
   ```javascript
   // En consola del navegador:
   console.log(typeof window.gestionarProveedoresIngrediente)
   // Debería retornar "function"
   ```

---

## 🎯 Siguiente Paso

Una vez que TODO funcione correctamente:

```bash
# Mergear a main
cd /home/user/MindLoop-CostOS
git checkout main
git merge claude/multiple-suppliers-cpVw6
git push origin main

# Backend (decidir estrategia)
cd /home/user/lacaleta-api
# Opción A: mergear a main directamente
# Opción B: crear PR
```

---

**¿Necesitas ayuda con algún paso específico del testing?**
