---
description: Protocolo obligatorio para cada cambio en el código (feature o fix)
---

# Protocolo de Cambio

Cada modificación en CostOS debe seguir estos pasos. **Si en cualquier paso algo falla, NO se avanza al siguiente.**

## Pasos

1. Crear rama desde `develop`:
```bash
git checkout develop && git pull && git checkout -b feature/nombre-descriptivo
```

2. Implementar el cambio en la rama feature.

3. Ejecutar tests:
// turbo
```bash
npm test
```
**DEBE pasar al 100%.** Si falla algún test, corregir antes de continuar.

4. Verificar que los flujos críticos afectados siguen funcionando. Consultar la lista en `.agent/skills/mindloop-platform/rules/stability-rules.md` sección 2.

5. Build de producción:
// turbo
```bash
npm run build
```
**DEBE compilar limpio** (solo warnings de chunk size son aceptables).

6. Commit con mensaje descriptivo:
```bash
git add -A && git commit -m "TIPO(módulo): descripción del problema que soluciona"
```
Tipos: `FIX`, `FEAT`, `REFACTOR`, `TEST`, `DOCS`, `PERF`

7. Push y crear PR a `develop`:
```bash
git push origin feature/nombre-descriptivo
```

8. Revisar logs en staging tras deploy.

9. Merge a `main` solo después de validación en staging.
