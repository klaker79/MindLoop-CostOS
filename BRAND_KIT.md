# Brand Kit — MindLoop CostOS

Documento de identidad visual para pasarlo a Claude Design (`claude.ai/design`) y mantener coherencia en cualquier rediseño, nuevo componente o pantalla.

---

## Identidad

- **Nombre**: MindLoopIA CostOS
- **Tagline**: "Restaurant Intelligence Platform"
- **Producto**: plataforma SaaS de gestión de costes, inventario y análisis para restaurantes.
- **Tono**: profesional, data-driven, moderno, legible a primera vista. Con personalidad (gradientes cálidos, emojis puntuales) pero sin perder seriedad financiera.
- **Idiomas soportados**: español (principal), inglés, chino.

---

## Paleta de colores

### Variables CSS canónicas (`styles/main.css`)

#### Modo claro (default)

```css
--bg-primary:    #ffffff
--bg-secondary:  #f8fafc
--bg-card:       #ffffff
--bg-input:      #ffffff
--text-primary:  #1e293b   /* slate-800 */
--text-secondary:#64748b   /* slate-500 */
--text-muted:    #94a3b8   /* slate-400 */
--border-color:  #e2e8f0   /* slate-200 */
--shadow-color:  rgba(0, 0, 0, 0.1)
--gradient-start:#667eea   /* índigo suave */
--gradient-end:  #764ba2   /* púrpura profundo */
```

#### Modo oscuro (`[data-theme="dark"]`)

```css
--bg-primary:    #0f172a   /* slate-900 */
--bg-secondary:  #1e293b   /* slate-800 */
--bg-card:       #1e293b
--bg-input:      #334155   /* slate-700 */
--text-primary:  #f1f5f9   /* slate-100 */
--text-secondary:#94a3b8
--text-muted:    #64748b
--border-color:  #334155
--gradient-start:#4f46e5   /* índigo más saturado */
--gradient-end:  #7c3aed   /* violeta */
```

### Paleta de acento (gradientes principales)

| Uso | Gradiente | Hex |
|---|---|---|
| **Hero / fondo app** | índigo → violeta | `linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)` |
| **Logo "MindLoopIA CostOS"** | naranja cálido (text gradient) | `linear-gradient(135deg, #ff8c42 0%, #ffb347 100%)` |
| **Sidebar header púrpura** | índigo-violeta saturado | `linear-gradient(180deg, #667eea, #764ba2)` |
| **Acción positiva / success** | verde esmeralda | `linear-gradient(135deg, #10b981 0%, #059669 100%)` |
| **Warning / watch** | naranja | `linear-gradient(135deg, #f97316 0%, #ea580c 100%)` |
| **Alerta / danger** | rojo | `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)` |
| **Botón secundario** | gris suave | `linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)` |

### Paleta de cards (pastel para diferenciar KPIs)

| Variante | Fondo | Uso |
|---|---|---|
| Amarillo suave | `linear-gradient(135deg, #FEF3C7, #FDE68A)` | iconos / cards stock |
| Azul suave | `linear-gradient(135deg, #DBEAFE, #BFDBFE)` | iconos / cards ingresos |
| Verde suave | `linear-gradient(135deg, #F0FDF4, #DCFCE7)` o `#D1FAE5, #A7F3D0` | positivo / OK |
| Naranja suave | `linear-gradient(135deg, #FFF7ED, #FFEDD5)` | neutro/cálido |
| Violeta suave | `linear-gradient(135deg, #E0E7FF, #C7D2FE)` | destacado |

### Food cost thresholds (colores sólidos para categorización)

| Rango | Color | Hex |
|---|---|---|
| ≤ 30% excellent | verde oscuro | `#059669` |
| 31-35% target | verde claro | `#10B981` |
| 36-40% watch | naranja | `#F59E0B` |
| > 40% alert | rojo | `#EF4444` |
| N/A | gris | `#9CA3AF` |

---

## Tipografía

### Familia principal

```css
font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
```

Montserrat cargada desde Google Fonts (ver `<link>` en `index.html`).

### Jerarquía típica

| Elemento | Tamaño | Weight | Letter-spacing |
|---|---|---|---|
| Logo / hero title ("MindLoopIA CostOS") | 2rem (32px) | 800 | -0.5px |
| Título de sección ("Recetas", "Pedidos") | 1.5rem (24px) | 700 | — |
| KPI valor grande | 1.5-2rem | 700-800 | — |
| Body texto | 14-15px | 400-500 | — |
| Label / meta | 12-13px | 500 | 0.4px uppercase para tags |
| Micro / badge | 10-11px | 600 | — |

---

## Componentes clave

### Sidebar

- Ancho ~240px, sticky a la izquierda.
- Fondo blanco (o `var(--bg-card)`), borde derecho `var(--border-color)`.
- Logo arriba: avatar "CostOS" + badge "Restaurant Intelligence".
- Grupos de navegación con labels UPPERCASE grises: `INGREDIENTES`, `OPERACIONES`, `ANÁLISIS`, `CONFIGURACIÓN`.
- Item activo: fondo naranja (`#FF6B35` aprox) con texto blanco, borde izquierdo acento.
- Selector de idiomas 🇪🇸 🇬🇧 🇨🇳 al final.
- Selector de restaurante + email usuario abajo del todo.

### Hero/header principal

- Bloque púrpura-índigo full-width en la parte superior del contenido.
- Título grande (gradient naranja en el texto) + subtítulo "Restaurant Intelligence Platform".
- Buscador central (command+K).
- Botón "🌙 modo oscuro" y "Cerrar Sesión" arriba a la derecha.

### Dashboard cards (`.dashboard-card`)

```css
background: rgba(255, 255, 255, 0.98);
border: 1px solid rgba(255, 255, 255, 0.8);
border-radius: 20px;
box-shadow:
  0 10px 30px rgba(0, 0, 0, 0.08),
  0 2px 8px rgba(0, 0, 0, 0.04),
  inset 0 1px 0 rgba(255, 255, 255, 0.9);
```

- Hover: `translateY(-8px) scale(1.02)` + sombra más fuerte.
- Border radius grande (20px) — "pillow" friendly.
- Efecto glass sutil sobre el gradiente de fondo.

### KPI mini-cards

- Borde redondeado (14-16px)
- Icono emoji grande (💰, 📦, ⚠️, 🍽️)
- Valor destacado en tipografía grande + label pequeño debajo
- Trend arrow o sparkline opcional al lado

### Botones

- **Primario**: gradiente índigo-violeta, texto blanco, padding generoso, border-radius ~10px, `box-shadow: 0 4px 15px rgba(99,102,241,0.4)`.
- **Destructivo**: gradiente rojo + sombra roja tenue.
- **Secundario**: gris claro, texto púrpura, sin sombra agresiva.

### Tabs / nav horizontal

- Botones con fondo pastel cuando están inactivos, fondo sólido de color cuando se activan.
- Border radius grande (20-24px).

### Tablas

- Header gris claro con uppercase + letter-spacing.
- Filas con hover suave (background-color transition).
- Bordes solo entre filas (border-bottom `var(--border-color)`).

### Modales

- Overlay oscuro `rgba(0,0,0,0.6)` + `backdrop-filter: blur(4px)`.
- Card central con `background: #1e293b` (en dark) o blanco, `border-radius: 16px`, `max-width: 560px`.
- Header del modal con gradiente sutil en el fondo o solo texto.
- Botón cerrar `×` arriba a la derecha.

---

## Iconografía

- Uso amplio de **emojis** como iconos para secciones y KPIs (📦 stock, 💰 ingresos, 📊 dashboard, ⚠️ alertas, 🍽️ recetas, 🛒 carrito, etc.). Decisión consciente: accesible, universal, multi-idioma, sin dependencia de librerías de iconos.
- Para elementos UI más formales (botones de acción, controles), SVG inline con stroke `currentColor`.

---

## Animaciones y microinteracciones

- Transiciones globales en cards y botones:
  ```css
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  ```
  (cubic-bezier con overshoot para "bounce" ligero al hover).
- Skeleton loading con `linear-gradient` que se mueve (shimmer) mientras cargan datos: `#e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%`.
- No abusar de animaciones: el usuario objetivo es un profesional de restaurante mirando números en prisa.

---

## Ejemplos visuales de la app actual

> 📸 **Iker, sube aquí capturas para que Claude Design las ingiera:**
> - Dashboard principal (Ingredientes por defecto)
> - Tab Recetas con Cost Tracker abierto
> - Tab Diario con P&L del mes
> - Modal de nueva receta o editar ingrediente
> - Sidebar expandido y Hero header
>
> Guarda las capturas en `docs/screenshots/` dentro del repo, o arrástralas a Claude Design directamente junto con el link a este archivo.

---

## Contexto técnico para Claude Design

- **Stack**: Vanilla JS + Vite 7.3 + Zustand 5 + Chart.js (sin framework). Importante: no sugerir React/Vue/Svelte, no valen aquí.
- **SPA monolítica**: todo en `index.html` (3200+ líneas). Los módulos ES6 viven en `src/modules/`.
- **CSS**: `polish.css` tiene prioridad sobre `main.css` (carga después). Muchas vistas usan estilos inline en template literals dentro de JS — por eso los overrides tipo `[data-theme="dark"] [style*="background: white"]` existen y son intencionales.
- **Temas**: claro/oscuro ya soportados vía `[data-theme="..."]` attribute en `<html>`. Cualquier rediseño debe respetar ambos.
- **Responsive**: actualmente optimizado para desktop. Tablet/móvil son áreas mejorables.
- **Multi-idioma**: i18n con i18next. Todo texto nuevo debe usar claves `t('módulo:clave')` y añadirse a `src/i18n/locales/{es,en,zh}/*.json`.
- **Accesibilidad**: por mejorar. Si Claude Design puede aportar ARIA, contraste, focus states, bienvenido sea.

---

## Repo

`https://github.com/klaker79/MindLoop-CostOS`

- Rama de producción: `main` (autodeploy a `https://app.mindloop.cloud`).
- Rama de staging: `develop` (autodeploy a `https://staging.mindloop.cloud`).
- **Cualquier rediseño se integra primero en `staging/*` → develop → staging → main**. Nunca directo a main.

---

## Peticiones típicas que puedes hacer a Claude Design con este kit

1. "Rediseña el dashboard principal manteniendo los KPIs actuales pero con más jerarquía visual y mejor legibilidad en móvil."
2. "Propón una nueva vista de 'Cost Tracker' (tab Recetas) más compacta que permita ver más recetas a la vez sin scroll."
3. "Rediseña el modal de 'Nueva receta' en 3 pasos guiados en lugar del formulario largo actual."
4. "Haz una landing page pública para `mindloop.cloud` con este kit de marca."
5. "Mejora la iconografía — reemplaza algunos emojis por SVG custom coherentes con la paleta."
