# 📋 Configuración de Dokploy para MindLoop CostOS Frontend

## ⚠️ PROBLEMA IDENTIFICADO

Cuando usas **Nixpacks** como Build Type en Dokploy, el build de Vite NO se ejecuta correctamente, resultando en:
- 502 Bad Gateway después de Stop + Deploy
- Archivos JavaScript principales faltantes en `/dist/assets/`
- Referencias a archivos JS antiguos en `index.html`

## ✅ SOLUCIÓN

### Opción 1: Cambiar a Dockerfile (RECOMENDADO)

En Dokploy, en la configuración del servicio Frontend:

1. **Provider**: Github
2. **Repository**: MindLoop-CostOS (klaker79/MindLoop-CostOS)
3. **Branch**: main (o la branch que uses)
4. **Build Type**: **Dockerfile** ← CAMBIAR DE NIXPACKS A DOCKERFILE
5. **Dockerfile Path**: `./Dockerfile` (o dejar vacío si está en la raíz)
6. **Build Path**: `/`
7. **Clean Cache**: ✅ Activado

### Opción 2: Configurar Nixpacks Correctamente

Si prefieres usar Nixpacks:

1. Asegúrate de que `nixpacks.toml` existe en la raíz (ya creado)
2. En Dokploy, verifica que detecta el archivo `nixpacks.toml`
3. Fuerza un rebuild completo con Clean Cache

---

## 🔍 Por qué ocurre el problema

1. **Nixpacks usa detección automática** que no siempre ejecuta `npm run build` correctamente para Vite
2. **El cache de Docker layers** puede quedar corrupto después de Stop
3. **Los archivos en `/dist/` no se regeneran** en cada build si Nixpacks usa cache antiguo

---

## 📝 Configuración Correcta del Servicio

```yaml
Service Name: Frontend
Provider: Github
Repository: klaker79/MindLoop-CostOS
Branch: main
Build Type: Dockerfile  # ← IMPORTANTE
Build Path: /
Dockerfile Path: ./Dockerfile
Port: 80
Domain: app.mindloop.cloud
Health Check: /health
```

---

## 🚀 Pasos para Resolver el 502

1. **En Dokploy, ve al servicio Frontend**
2. **Cambia Build Type de "Nixpacks" a "Dockerfile"**
3. **Activa Clean Cache**
4. **Click en Rebuild**
5. **Espera a que el build termine (verás los logs de Vite)**
6. **Verifica que el deployment dice "Docker Deployed ✓"**
7. **Prueba la app en app.mindloop.cloud**

---

## 🐛 Debug si aún falla

Si después de cambiar a Dockerfile aún tienes problemas:

```bash
# 1. SSH a tu servidor de Dokploy
ssh user@tu-servidor

# 2. Ve al directorio del proyecto
cd /path/to/dokploy/projects/lacaleta/frontend

# 3. Lista los contenedores
docker ps -a | grep frontend

# 4. Ve los logs del contenedor
docker logs <container_id>

# 5. Entra al contenedor y verifica archivos
docker exec -it <container_id> sh
ls -la /usr/share/nginx/html/assets/

# 6. Verifica que main-*.js existe
# Si NO existe, el build no se ejecutó correctamente
```

---

## ✅ Archivos Necesarios (Ya Creados)

- ✅ `Dockerfile` - Multi-stage build con Node + nginx
- ✅ `nginx.conf` - Configuración optimizada para SPA
- ✅ `vite.config.js` - Build con emptyOutDir: true
- ✅ `.dockerignore` - Optimiza build excluyendo node_modules
- ✅ `nixpacks.toml` - Deshabilita Nixpacks (fuerza Dockerfile)

---

## 📊 Verificación Post-Deploy

Después de un deploy exitoso, deberías ver:

```bash
# En los logs de Dokploy:
✓ vite v5.4.21 building for production...
✓ 446 modules transformed.
✓ built in 7.41s

# En el contenedor:
/usr/share/nginx/html/assets/main-XXXXXXXX.js  # Existe
/usr/share/nginx/html/index.html              # Referencia el mismo main-XXXXXXXX.js
```

---

## 🔄 Workflow Recomendado

### Para Development:
```bash
npm run dev  # Puerto 3000
```

### Para Production (Dokploy):
1. Push a GitHub
2. Dokploy auto-deploy (si Autodeploy está activado)
3. O manualmente: Click en "Deploy" o "Rebuild"

### Si necesitas forzar rebuild limpio:
1. Activa Clean Cache
2. Click en Rebuild
3. Espera 1-2 minutos para el build completo

---

## 💡 Notas Importantes

- **NUNCA uses Stop + Deploy** - Usa solo "Rebuild" si necesitas refrescar
- **Clean Cache** debe estar activado por defecto
- **Autodeploy** puede estar activado si confías en tus pushes a main
- **El branch debe ser `main`** no otra (o ajusta según tu workflow)

---

## 🆘 Soporte

Si después de seguir estos pasos aún tienes problemas:

1. Verifica los logs de build en Dokploy
2. Verifica que el repositorio es el correcto (klaker79/MindLoop-CostOS)
3. Verifica que el branch es el correcto
4. Contacta al equipo de Dokploy si el problema persiste
