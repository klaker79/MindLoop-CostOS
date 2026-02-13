---
description: Protocolo de emergencia para arreglos urgentes en producción
---

# Protocolo Hotfix (Emergencia en Producción)

Usar SOLO cuando producción tiene un fallo activo que afecta a clientes.

## Pasos

1. Identificar el commit exacto que causó el problema:
```bash
git log --oneline -20
```

2. Crear rama hotfix desde `main`:
```bash
git checkout main && git pull && git checkout -b hotfix/nombre-descriptivo
```

3. Aplicar el fix mínimo necesario. **No aprovechar para refactorizar.**

4. Crear test de regresión que reproduzca el fallo:
   - Añadir en `__tests__/regression/`
   - El test debe FALLAR sin el fix y PASAR con el fix

5. Ejecutar tests completos:
// turbo
```bash
npm test
```

6. Build limpio:
// turbo
```bash
npm run build
```

7. Commit descriptivo:
```bash
git add -A && git commit -m "HOTFIX(módulo): descripción del fallo corregido"
```

8. Merge a `main` y `develop`:
```bash
git checkout main && git merge hotfix/nombre-descriptivo
git checkout develop && git merge hotfix/nombre-descriptivo
git push origin main develop
```

9. Verificar en producción que el fallo está resuelto.

10. Eliminar la rama hotfix:
```bash
git branch -d hotfix/nombre-descriptivo
```

## Si el hotfix NO funciona

```bash
git revert <commit-hash-del-hotfix>
git push origin main
```

**Nunca hacer rollback completo salvo corrupción total de datos.**
