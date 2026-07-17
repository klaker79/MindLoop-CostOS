// MindLoop CostOS - Service Worker v8
// Requerido para PWA instalable
// FIX: Eliminado /styles/main.css que no existe en producción (Vite genera /assets/main-{hash}.css)
// FIX v5: ignorar requests cross-origin (YouTube thumbnails, CDNs, fonts).
// BUMP v6: forzar invalidación de cache en clientes tras revert TomSelect 2026-05-11
//          (bundles viejos seguían sirviéndose pese a deploy ya hecho).
// BUMP v7: nuevo botón "Informe del mes" en chat-widget + api.getChatInformeMensualHtml.
// BUMP v8: rediseño botón informe (pill ámbar + label) + lang robusto a 'en-US'.
// BUMP v9: contador 0/300 movido a mini badge flotante esquina sup. der. del chat-window.
// BUMP v10: selector de mes en el botón informe (popover con 6 meses).
// BUMP v12: revert del cambio de pedidos (un solo buscador) — vuelve al diseño con dos buscadores.
// BUMP v13: video tutorial YouTube en pestaña Ventas (botón ?).
// BUMP v14: video tutorial YouTube en pestaña Pedidos (botón ?).
// BUMP v15: fix recetas — querySelector('input') pillaba el buscador en lugar de .receta-cantidad.
//          Síntomas: (1) modal "Rentabilidad en tiempo real" desaparecía al cambiar cantidad,
//                    (2) guardarReceta guardaba ingredientes: [] (catastrófico).
// BUMP v16: plantilla inventario masivo con columnas "Cuenta en" + "Formato" pre-rellenadas.
// BUMP v17: subida de inventario registra mermas REALES (antes solo anunciaba; ahora persisten en histórico).
// BUMP v18: historial mermas — auto-cargar al cambiar selector + subtítulo aclarado (retención permanente).
// BUMP v19: botón "ℹ️ Cómo funcionan" + modal educativo de mermas en pestaña Inventario.
// BUMP v20: botón "📹 Tutorial" en inventario + modal informativo ampliado con food cost real.
// BUMP v21: unificar botones — tutorial inventario usa sistema HELP_VIDEOS (placeholder hasta video).
// BUMP v22: inventario — ACTUALIZAR INVENTARIO MASIVO verde + Ver Tutorial inyectado en la fila de botones.
// BUMP v23: sistema info-modal unificado (config en info-content.json), inventario migrado + borradores ingredientes y recetas.
// BUMP v24: añadidos borradores info-content para pedidos, diario y análisis (incluye matriz BCG).
// BUMP v25: fix bugs pedidos — fecha futura por timezone + cpf "30.000" interpretado como "treinta mil".
// BUMP v26: info-content para 5 pestañas restantes (Proveedores, Ventas, Horarios, Inteligencia, Configuración) en es/en/zh.
// BUMP v27: fix info-content Diario e Inteligencia — quitadas referencias a features que NO existen en esas pestañas (Punto de Equilibrio en Diario, Recomendaciones BCG en Diario, Pérdidas del Mes en Inteligencia). Sustituidas por las features REALES tras auditoría 2026-05-14.
// BUMP v28: i18n del botón "ℹ️ Cómo funcionan" y traducción real de las 6 entradas legacy del info-content en EN y ZH (estaban en español).
// BUMP v29: helper formatQuantity() en utils/helpers.js — protección preventiva contra bug "30.000 → treinta mil" en futuros displays. Refactor en pedidos-ui.js.
// BUMP v30: filtro buscador Proveedores — "empieza por palabra" (split + startsWith) en lugar de "includes". Buscar "ma" ya no devuelve "GROVEMAR", "LAMASTELLE", etc.
// BUMP v31: dossier v2.6 — 5 errores típicos al principio + sección n8n + señales de alarma + FAQ ampliada + glosario.
// BUMP v32: modal invitar usuario — label "Usuario interno (email)" + helper text aclarando que el email no tiene que ser real (es/en/zh).
// BUMP v33: tarjeta de pago Plan MindLoop (95€/mes) con checkout Polar + botón gestionar suscripción.
// BUMP v34: chat-widget — botón Coach (Health Check semanal) + badge "nuevo" + endpoints api.
// BUMP v35: i18n claves chat — btn_informe_short "Mes" + btn_healthcheck_short "Coach" en es/en/zh (antes salían las keys crudas).
// BUMP v36: recetas — eliminar botón "Seguimiento Costes" duplicado en el footer del listado (ya está en el top bar).
// BUMP v37: forecast — horquilla (min-max usando σ × √N) + tendencia 4 semanas vs 4 anteriores con factor capped [0.7, 1.4].
// BUMP v38: recetas — fix iconos 📏 y % pisando el valor numérico (padding-left insuficiente en inputs de escandallo).
// BUMP v39: recetas — eliminados iconos 📏 y % de los inputs de escandallo (decisión UX: inputs limpios).
// BUMP v40: recetas — iconos 📏 y % movidos a la DERECHA del input (sufijo) + spinner buttons ocultados vía CSS.
// BUMP v41: pedidos — placeholder del select de ingredientes corregido ("Seleccionar ingrediente..." en vez de "Seleccionar proveedor...").
// BUMP v42: análisis — ranking de rentabilidad y matriz BCG ahora excluyen también las recetas "base" (preparaciones intermedias, no vendibles).
// BUMP v43: escandallo — eliminado toggle Real/Nominal (el backend sincroniza precio configurado con el real en cada recepción → siempre coincidían).
// BUMP v44: import de escandallo de recetas (Excel formato largo) + plantilla descargable.
// BUMP v45: import de recetas = upsert (re-importar actualiza la existente, no duplica) + refresco de datos.
// BUMP v46: botón "Exportar escandallo" (recetas reales en formato editable/re-importable).
// BUMP v47: exportar escandallo POR receta (icono 📋 en cada fila) en vez de todas de golpe.
// BUMP v48: eliminada "Producir plato" (botón ⬇️ + modal + funciones): doble conteo con ventas.
// BUMP v49: Stock mínimo OBLIGATORIO (>0) al crear/editar ingrediente — sin él el Smart Order no propone reposición.
// BUMP v50: "Descargar plantilla" recetas exporta tus recetas reales (round-trip) en vez del ejemplo pulpo hardcodeado.
// BUMP v51: import de ingredientes solo CREA nuevos (salta existentes) — antes duplicaba todo el inventario al reimportar.
// BUMP v52: import de recetas reconoce subrecetas por nombre (round-trip sin perder líneas de subreceta).
// BUMP v53: escandallo export/import incluye la columna "Código TPV" (campo codigo de la receta).
// BUMP v54: Recetas simplificado a UN Exportar (escandallo editable) + UN Importar. Quitado informe coste/margen y botón duplicado.
// BUMP v55: pista del modal importar sin "(arriba)" (el botón Exportar Excel está fuera del modal).
// BUMP v56: import de ingredientes Excel lee columna "Proveedor" (resuelve por nombre → proveedorId).
// BUMP v57: import también actualiza proveedor de ingredientes existentes huérfanos (caso B Iker 2026-05-30).
// BUMP v58: Diario KPIs (Ventas/Beneficio/FoodCost) usan /analytics/pnl-breakdown como Dashboard + fix CSS texto Gastos Fijos Totales.
// BUMP v59: import de ingredientes rellena pivot ingredientes_proveedores tras crear/actualizar (el desplegable de pedidos filtra por pivot).
// BUMP v60: parsers de Excel (escandallo + ingredientes) extraídos a src/utils/ con tests defensivos. Legacy hace fallback si el módulo no carga.
// BUMP v62: Empty state onboarding en Ingredientes — cliente nuevo ve video tutorial embebido + CTAs grandes (Importar Excel / Añadir manual) en vez del cartel vacío.
// BUMP v63: Mismo empty state onboarding aplicado a Recetas y Proveedores. Cliente nuevo recibe guía visual en 3 pestañas críticas del flujo inicial.
// BUMP v64: Onboarding Checklist persistente en dashboard (4 pasos: Proveedores → Ingredientes → Recetas → Pedidos) + banner ámbar de gating suave en Recetas (si no hay ingredientes) y Pedidos (si no hay proveedores). Backend trackea timestamps por paso para el admin panel.
// BUMP v65: fix — OnboardingChecklist se renderiza ANTES del guard de isDataLoaded(). Sin esto, un cliente nuevo sin datos nunca veía el widget (justo el caso que más lo necesita).
// BUMP v66: Onboarding Spotlight — modal centrado + overlay oscuro + flecha animada apuntando al sidebar a la pestaña del paso actual. Sidebar dim en pestañas no destacadas. Skippable (queda como widget pequeño fallback). Inspirado en HeyGen onboarding wizard. Iker 2026-06-03.
// BUMP v67: Spotlight re-trigger por TODO el recorrido. (1) Skip ya no es persistente — solo cooldown 1.5s. (2) Cambio de tab dispara spotlight con paso pendiente. (3) Tras crear proveedor/ingrediente/receta/pedido, spotlight reabre con siguiente paso. (4) Si el cliente ya está en la pestaña del paso pendiente, modal sin flecha + "Empezar aquí ✓".
// BUMP v68: fix highlight sidebar. El sidebar quedaba bajo el overlay oscuro (stacking context) → la pestaña destacada se veía gris en vez de violeta brillante. Fix: elevar .sidebar a z-index 99999 cuando spotlight-active. Highlight más impactante: borde blanco, gradiente más vivo, glow pulsante con shadow expandiéndose.
// BUMP v69: "Lo hago después" avanza al siguiente paso del onboarding en cadena, en vez de cerrar. Cliente que salta 4 veces seguidas ve los 4 modales antes de cerrar. Reset de saltados al re-abrir spotlight desde fuera (nueva apertura por navegación/creación).
// BUMP v70: la flecha al sidebar SIEMPRE aparece, no solo cuando el cliente está en otra pestaña. Coherencia visual paso a paso. CTA cambia ("Empezar aquí ✓" si ya está allí, "Ir a X →" si no).
// BUMP v71: D2 rediseño Análisis. Nuevo módulo src/modules/analisis/ con dashboard sintético arriba del BCG (cards counts + donut + filtro periodo: Histórico/Mes/Trimestre/Año). Aditivo: el BCG legacy queda intacto. Endpoints backend con param ?desde=&hasta= y nuevo /analysis/omnes (para D5).
// BUMP v72: D3 rediseño Análisis. Matriz BCG v2 reemplaza al BCG legacy (display:none). Scatter limpio con cuadrantes coloreados + 4 cards por categoría con icono SVG, header coloreado, count chip y listas clickables. Click en plato (scatter o lista) emite evento `analisis:plato-click` (lo escucha el modal en D4).
// BUMP v73: D4 rediseño Análisis. Modal drill-down al click en plato. Icono SVG grande + label + 6 métricas (ventas, precio, coste, margen, food cost, ingresos) + 5 acciones recomendadas según categoría (Excel Ingeniería de Menús) + CTA "Ver escandallo" que navega a Recetas. Cierre con X, click fuera, Esc.
// BUMP v74: fix scatter Matriz BCG — el wrap quedaba más alto que el canvas y aparecía hueco blanco abajo. Reducido wrap a 380px y forzado canvas a 100%/100% con !important (Chart.js mete inline sizes que rompían el fit).
// BUMP v75: recomendaciones REALES por plato en el modal drill-down (A). Calcula medias del menú (precio, food cost, margen, popularidad) y genera 4-6 frases con números concretos del plato: vendes X uds (Yx la media), margen Z€ vs media W€, subiendo a Q€ ganas R€, etc. Las acciones genéricas del Excel quedan ocultas en details/summary como referencia secundaria. Botón "Consulta al Coach IA" (B) pre-rellena el chat con un prompt construido con los datos del plato y abre el widget (no envía automático, el cliente revisa y pulsa enter).
// BUMP v76: fix Coach IA — el prompt podía hacer que Claude emitiera [ACTION:] como si fuera una orden de cambio. Ahora el prompt pide explícitamente "solo asesoramiento, no emitas [ACTION:]". Complementado con regla anti-ACTION en system prompt backend.
// BUMP v77: modal de validación previa al ejecutar cambios desde el chat (Iker 2026-06-06: "si confirmas, con modal validando el cambio"). Al pulsar Confirmar, antes de ejecutar se abre modal que muestra qué entidad y campo se van a modificar, comparando valor actual vs valor nuevo. Aplicar / Cancelar / Esc / click fuera.
// BUMP v78: fix Coach IA — al precargar el prompt en #chat-input con el chat cerrado, el auto-resize calculaba scrollHeight contra ancho 0 y rompía el layout del bubble (mensajes en vertical). Ahora abre el chat PRIMERO, espera 220ms al render y luego setea value + dispara input + focus.
// BUMP v79: fix Coach IA v2 — el v78 seguía roto. Causa raíz: disparábamos `input` event tras precargar, lo que activaba el auto-resize del textarea con un prompt muy largo y rompía el layout del chat. Ahora prompt corto en una sola línea + NO disparamos input (el textarea queda con su altura por defecto, el cliente solo ve el texto y pulsa enter).
// BUMP v80: D5 Análisis — añadido módulo Principios de Omnes (3 cards dispersión/amplitud/calidad-precio + recomendación global) debajo del BCG. Consume /api/analysis/omnes ya existente.
// BUMP v81: D5 extra — botón "¿Qué es esto?" en el header de Omnes que abre modal explicativo para el cliente (3 principios + qué hacer cuando aparece ámbar/rojo + diferencia con la matriz BCG).
// BUMP v82: D5 extra — consejo personalizado por card de Omnes (con nombres de platos / precios / porcentajes reales) además de la recomendación global. Cada card pinta un tip verde/ámbar/rojo según estado.
// BUMP v83: D5 fix tono — suavizar frases de los consejos (quitar "el cliente no sabe qué tipo de restaurante eres" y "asustas al cliente medio"). Pasamos a registro de palanca de mejora.
// BUMP v84: Análisis ampliado — botón "¿Qué es esto?" + tip por cuadrante (con nº de platos y plato top) en Matriz BCG. Coherencia con el bloque Omnes.
// BUMP v85: Análisis fix coherencia — calcularMediasMenu ahora usa las medias del backend (ponderada por ventas) cuando están disponibles. Antes calculaba media aritmética en local, lo que podía contradecir la clasificación BCG. Fallback aritmético se mantiene para respuestas degradadas.
// BUMP v88: revert "Por sección de carta" en Omnes. El schema de BD solo tiene `alimentos/bebidas/suministros` como categorías macro — el desglose por subcategoría siempre mostraría una sola fila en los tenants actuales. La idea queda como nota pedagógica, no como feature.
// BUMP v90: IVA del albarán en modal recepción + IVA habitual por proveedor (Migration 013). SOLO display para cuadrar con el albarán físico. Cero impacto en precio_medio_compra, food cost, COGS.
// BUMP v91: trial 10 días + plantillas CSV descargables en empty states + welcome email con timeline. Cero cambio en cálculos.
// BUMP v92: botón "📥 Plantilla" siempre visible en barra de Ingredientes/Recetas/Proveedores (antes solo en empty state, pero el onboarding spotlight obliga a crear el 1º → cliente nunca veía la plantilla).
// BUMP v93: plantillas CSV con BOM UTF-8 + separador ; + decimales con coma. Antes Excel español lo abría todo en columna A con ñ/í corruptas (ALBARIÑO → ALBARIÃO). Ahora abre limpio con columnas separadas y caracteres correctos.
// BUMP v94: plantilla ingredientes con cantidad_por_formato + formato_compra + rendimiento + familia. Antes faltaban → comprar por caja/garrafa con precio del formato inflaba precio unitario × N y food cost mentía. Parser actualizado, mandado al backend.
// BUMP v95: (1) auto-refresh tras import (recarga window.ingredientes antes de renderizar — antes el cliente tenía que F5 para ver lo importado), (2) exportar ingredientes ahora incluye Cantidad por formato/Formato/Rendimiento/Familia (antes export → editar → import perdía esos campos).
// BUMP v96: rediseño UX de botones en Ingredientes/Recetas/Proveedores. De 5-6 botones planos → 3 botones jerarquizados: [+ Añadir] [📊 Importar/Exportar ▾] [? Ayuda ▾]. El dropdown agrupa Plantilla / Import / Export. El "?" agrupa Tutorial + Cómo funciona. Patrón Notion/Linear. Iker 2026-06-08.
// BUMP v97: rev2 UX. Iker pidió mantener "🎬 Tutorial" y "ℹ️ Cómo funciona" como botones planos (no dropdown). Sustituir [Importar/Exportar/Plantilla] por un único botón "📂 Excel" que al pulsarse muestra las 3 opciones con descripción breve de cada una. Estética más rica y profesional.
// BUMP v98: fix bug visual — .ad-menu se renderizaba SIEMPRE visible porque el CSS tenía `display: flex` por defecto y dependía del atributo `hidden` del JS. Ocultar siempre por CSS y mostrar solo con `.ad-wrapper.ad-open > .ad-menu`. Robusto aunque mountActionDropdowns no haya corrido todavía.
// BUMP v99: Recetas Excel — (1) plantilla pasa de CSV estático a XLSX dinámico (sin aviso "POSIBLE PÉRDIDA DE DATOS"), (2) plantilla y export comparten ORDEN de columnas (Receta/Categoría/Precio/Porciones/Código TPV/Ingrediente/Cantidad/Rendimiento), (3) "Exportar mis recetas" sin recetas → toast en lugar de descargar ejemplo confuso.
// BUMP v100: Proveedores Excel completo — antes solo tenía "Descargar plantilla" CSV estático. Ahora 3 opciones: plantilla XLSX dinámica + Importar (upsert por nombre, modal con preview, conserva relación de ingredientes) + Exportar mis proveedores. Schema completo (nombre/contacto/teléfono/email/CIF/IVA/código/dirección/notas) alineado con Supplier entity backend.
// BUMP v101: IVA habitual del proveedor también autorellena el modal de NUEVO pedido. Antes solo lo hacía el modal de recepción. Iker espera que al elegir VINOS TONE (iva_pct=21) el campo IVA del pedido sea 21, no 0. Pedidos-ui:cargarIngredientesPedido lo aplica + recalcula totales.
// BUMP v102: IVA también en modal Editar Pedido (duplicar / editar pedido pendiente). Antes no aparecía. Autorrellena del proveedor + muestra fila IVA + fila Total con IVA en footer cuando >0. Solo display visual, no se persiste en BD (igual que Nuevo Pedido y Recepción).
// BUMP v103: fix label dropdown ingrediente en Nuevo Pedido. Mostraba "VINO NANO (80€/botella)" cuando ing.precio=80 era precio de la CAJA, no de la botella. Cliente confundido. Ahora divide por cantidad_por_formato → muestra "VINO NANO (13,33€/botella)" coincidiendo con Inventario. Editar Pedido ya usaba getIngredientUnitPrice() canónico.
// BUMP v104: transparencia precio ingrediente. Hint visual junto al campo Precio del modal Editar Ingrediente explicando que la app lo recalcula automáticamente tras cada pedido (PMC × cpf). Si el usuario edita un ingrediente existente, hint enriquecido con el desglose actual: "13,33€/botella × 6 = 80€/CAJA". Cliente Iker preocupado por confusión "¿se ha roto?" cuando el precio configurado se mueve solo.
// BUMP v105: mismo fix de label €/unidad-base aplicado a (1) dropdown de Nueva/Editar Receta (recetas-ui.js) y (2) búsqueda global (global-search.js). Antes mostraban "VINO NANO (80€/botella)" cuando precio era de CAJA. Iker estaba creando receta VINO NANO y vio el bug. Ahora coincide con Inventario, Pedidos y coste de producción del propio modal de receta. Barrido completo de sitios — ingredientes-ui (listado) y app-core (inventario) ya usaban precio_medio correctamente.
// BUMP v106: tooltip explicativo en "Food Cost real (con error)" de la ficha técnica. Iker preguntó por qué hay 2 FC distintos en la receta (41,7% arriba vs 45% en ficha). Ambos son correctos pero miden cosas distintas (uno sin buffer, otro con +8% para seguridad de precios). Añadido tooltip con icono ? + título HTML nativo en 3 idiomas (es/en/zh).
// BUMP v107: toggle Alimentos/Bebidas/Todo en pestaña Análisis (ranking de rentabilidad + BCG). Antes hardcoded excluía bebidas → VINO NANO invisible aunque tuviera ventas. Iker pidió poder ver bebidas también. Default 'alimentos' (comportamiento histórico). Base SIEMPRE excluida (subproductos distorsionan). 3 botones pill encima de la tabla, persiste en window.analisisCategoriaFilter, re-render automático al cambiar. i18n es/en/zh.
// BUMP v108: Matriz BCG (Ingeniería de Menú) vuelve a quedar SIEMPRE solo alimentos, independiente del toggle. Iker: la metodología Kasavana-Smith es para platos comparables. Mezclar bebidas (volumen distinto, se piden por categoría) distorsiona los cuadrantes. El toggle solo afecta al Ranking de Rentabilidad.
// BUMP v109: 4 mejoras UX tras incidente PATATAS duplicada (Iker, 2026-06-08): (1) detección de duplicado al crear ingrediente con confirm, (2) aviso amber en modal Editar Ingrediente cuando se mueve el slider de rendimiento, (3) subproductos base muestran "—" y "N/A" en columnas PVP/Margen del listado (no engañar con "0% rojo"), (4) ranking de rentabilidad usa thresholds distintos por categoría — bebidas verde ≥55%, alimentos verde ≥67%.
// BUMP v110: nueva fila "🗑️ MERMAS DEL DÍA" en P&L Diario. Antes las mermas solo bajaban el valor del inventario y NO aparecían en el beneficio neto — Iker pidió verlas como pérdida operativa. Carga /mermas?mes=&ano=, agrupa por fecha, muestra solo si hay >0. Beneficio Neto = MARGEN BRUTO − MERMAS − GASTOS FIJOS. COSTES PROD intacto (sigue siendo solo coste de receta vendida). i18n es/en/zh.
// BUMP v111: fix bug v110 — el endpoint /mermas devuelve `valor_perdida` (no `coste`) y `cantidad` es POSITIVA en la tabla (no negativa como asumí). Mi código descartaba todas las mermas porque cantidad >= 0. Verificado en mermas.routes.js y StockMovementRepository.createWaste(). Ahora suma correctamente las pérdidas del día.
// BUMP v112: fix UI tras borrar una merma del Historial. Antes solo se recargaba window.ingredientes pero la pestaña Inventario lee de window.inventarioCompleto → quedaba con datos viejos (P&L cuadraba, Inventario no). Ahora llama a window.cargarDatos() que refresca todo el estado del cliente.
// BUMP v113: pestaña Análisis tragaba 403 trial_expired silenciosamente. Iker simuló trial caducado y vio cards en 0 sin ningún aviso (UX horrible). Fix: getMenuEngineering propaga error con status/trial_expired, y el catch muestra overlay claro con CTA "Ver planes y suscribirse" en vez de console.error mudo.
// BUMP v114: modelo single-plan. Modal de suscripción GLOBAL — sustituye al overlay específico de Análisis. Interceptor en api/client.js detecta 403 SUBSCRIPTION_REQUIRED desde CUALQUIER endpoint y dispara evento global. El modal full-screen tapa toda la UI con CTA Polar (Self 95€ / Pro 185€). URLs configurables vía VITE_POLAR_CHECKOUT_URL_SELF/PRO y fallback contacto Iker para cuando Polar aún no esté listo (alta autónomos + onboarding Polar = 2-5 días). El chat IA va incluido en el plan (no más add-on de 30€).
// BUMP v115: el interceptor de v114 solo capturaba 403 desde apiClient (src/api/client.js). El código legacy usa fetchWithCreds en src/legacy/app-core.js que NO pasa por handleResponse → 403 silenciosos, modal nunca aparecía. Fix: wrap GLOBAL de window.fetch al import time (no en DOMContentLoaded para no perder los 403 que ocurren al arrancar la app, como chatStatus). Buffer window.__pendingSub para race conditions.
// BUMP v116: suprimir modal de suscripción cuando el usuario está en /login.html. Un visitante con cookie/token de sesión anterior caducada veía "Tu prueba ha terminado" antes de logarse — UX confusa. Ahora el modal solo aparece dentro de la app (post-login).
// BUMP v117: fix del fix v116 — el SPA puede seguir con URL /login.html aunque el usuario YA esté logado y viendo el dashboard, así que filtrar por pathname mataba el modal incluso dentro de la app. Reemplazo: chequeo localStorage.user (fuente de verdad de sesión). Si hay user → mostrar modal. Si no → suprimir.
// BUMP v118: Settings → tarjeta "Asistente IA" decía "30€/mes · Cancelar add-on" del modelo viejo. Ahora "Incluido en tu plan". Eliminados botones Activar/Cancelar (chat ya viene en el plan, no hay flow Polar separado).
// BUMP v119: Omnes Dispersión usa percentiles p5/p95 cuando hay ≥10 platos. Antes el ratio se calculaba con max/min absolutos, así que un BOGAVANTE puntual (160€) o un PAN POR PERSONA (1€) disparaban la dispersión a 160×. Ahora recorta outliers naturalmente. La card muestra "rango p5–p95 (ignora outliers)" cuando aplica para que el cliente entienda el cálculo.
// BUMP v120: Omnes Dispersión sustituye percentiles por filtro de outliers vs mediana (MAD-like). Funciona en cartas pequeñas (Demo Trattoria 7 platos) también: descarta cualquier plato fuera del rango [mediana/2.5, mediana×2.5]. Casos como OSTRA (unidad), PAN (cubierto), BOGAVANTE (oferta puntual) o menú degustación extremo se excluyen automáticamente sin pedir nada al cliente. La card avisa cuántos platos atípicos se ignoraron.
// BUMP v121: Omnes Dispersión cambia de filtro estadístico a filtro semántico. Backend excluye categorías de extras (pincho, aperitivo, tapa, extra, guarnición, aceite, bebidas, suministros, base) ANTES del cálculo. Sin "forzar" números: el ratio refleja exactamente lo que el cliente entiende como "plato normal". Iker 2026-06-09 — el filtro estadístico camuflaba como outliers cosas que sí son platos legítimos (BOGAVANTE de carta especial, menú degustación), eso era engañoso.

// BUMP v126: Comida de Personal opt-in (apagado por defecto). Flag por restaurante (comida_personal_activa). Oculta la casilla 🍽️ en pedidos (nuevo + editar) y la pestaña del menú cuando está off. Interruptor en Configuración (solo admin).
// BUMP v127: Fix Nuevo Pedido con comida personal — al llevar líneas personal, el pedido NO pasa por el carrito (que fusiona por ingrediente y perdía el split + el flag); se crea directo como 'pendiente'. Fix parpadeo del modal Editar al marcar la casilla 🍽️ (toggle inline, sin re-render completo).
// BUMP v128: Editar Pedido muestra el reparto en UNA fila (cantidad total + casilla personal con su cantidad), en vez de dos líneas. Al guardar se vuelve a partir en producción + personal.
// BUMP v129: Aislamiento comida personal en vistas de gasto. El gasto personal ya no se cuela en: Top Proveedores fallback (app-core), KPI Cambios de Precio, ni la evolución de precio del ingrediente. (El grueso del aislamiento es backend.)
// BUMP v130: Modal Detalles del Pedido (icono 👁️) muestra el badge 🍽️ Personal en las líneas de comida personal.
// BUMP v131: Recuento de inventario (contador digital móvil). Pantalla nueva aislada en Inventario; botón solo visible en móvil (escritorio intacto). Reconcilia reutilizando createMermas + consolidateStock (mismo camino que el import Excel). Backend sin cambios.
// BUMP v137: Modal Editar Pedido consciente del formato. Líneas con formato de compra (ej. BOTE 750 g) se muestran/editan en formato (1 bote, 3 €/bote) en vez de unidad base (750 g, 0,004 €/g). El dato se sigue guardando en base (food cost intacto). Conversión pura testeada en formato-utils.js.
// BUMP v138: Modal Recibir Pedido consciente del formato (misma técnica que Editar). PEDIDO/RECIBIDO/PRECIOS se muestran en formato (1 bote, 3 €/bote) en vez de base (750 g, 0,004). CRÍTICO: cantidadRecibida/precioReal siguen en BASE internamente → el delta de stock NO cambia → imposible inflar inventario. Test de invariante anti-inflación añadido.
// BUMP v139: Guard de coherencia en alta/edición de ingrediente. Prohíbe guardar "cantidad por formato > 1" SIN nombre de formato (estado ambiguo que dividía el precio por debajo: 3 €/bote ÷ 750 = 0,004 → bug mermelada). Mensaje claro pidiendo el nombre del formato. NO toca datos existentes ni la regla de precio global.
// BUMP v140: Preview EN VIVO del precio por unidad en el formulario de ingrediente. Mientras rellenas precio/unidad/formato/cantidad por formato, muestra "→ La app usará X €/unidad" y avisa si la combinación es incoherente (cpf>1 sin nombre, o cpf>1 con unidad contable tipo 'unidad'/'botella' que casi siempre debería ser g/ml). Caza el bug mermelada al vuelo. Cálculo puro testeado en precio-unidad-preview.js.
// BUMP v141: "Añadir ingrediente" dentro de Editar Pedido ahora es consciente del formato. Si el ingrediente tiene formato (BOTE), pide cantidad en BOTE y precio €/BOTE (como Nuevo Pedido), no en gramos. Convierte a base al añadir; el resto del modal ya pintaba en formato. Coherencia total entre pedir, editar y añadir.
// BUMP v142: Etiqueta de unidad junto a la cantidad en recetas. Cada fila de ingrediente muestra su unidad base (g/kg/l/ml…) al lado del campo de cantidad, para no teclear a ciegas (evita el lío 0.02 vs 20). Se actualiza al elegir ingrediente. Solo display, no toca el cálculo de coste.
// BUMP v143: Fix botón Guardar ingrediente que se quedaba GRIS tras un guardado bloqueado por validación (no se rehabilitaba). + Afinado el aviso del preview: "1 CAJA = 6 botella" (vino por caja) ya NO marca falso positivo; solo avisa con unidad genérica 'unidad'.
// BUMP v144: Editar/Recibir muestran formato (CAJA/BOTE) SOLO si la cantidad son formatos enteros; si hay reparto de personal o sueltas (10 botellas, 2 botellas) lo muestran en unidad base, no en fracciones de caja (0,333 CAJA). El campo de comida personal SIEMPRE en unidad base (botellas). Cifras/stock idénticos: solo cambia el display. Helper esCantidadEnteraEnFormato testeado.
// BUMP v145: Pestaña Comida Personal con buscador (producto/proveedor/fecha) y columnas ordenables (clic en cabecera ordena asc/desc, flecha en la activa). Aviso "mostrando N de M · €" al buscar. i18n es/en/zh. Solo UI de esa pestaña.
// BUMP v146: Chat reenmaquetado como OMNES ("tu chef financiero"). Nombre, avatar búho (/images/omnes-avatar.png con fallback 🦉), subtítulo y saludo nuevos, avatares de mensajes 🦉. i18n es/en/zh. Identidad/voz de Omnes va en el system prompt del backend (repo lacaleta-api). Mismo motor y tools.
// BUMP v148: Alérgenos UE (14) por ingrediente — selector en el form, guardado en BD (col alergenos JSONB, backend), y la receta los HEREDA (unión recursiva de ingredientes + subrecetas). Se muestran en la Ficha de Costes y su PDF. Módulo puro src/modules/ingredientes/alergenos.js + i18n es/en/zh.
// BUMP v150: Auto-sugerencia de alérgenos por NOMBRE del ingrediente (diccionario hostelería ES, match por palabra + plurales, guardas anti-falsos-positivos "leche de coco"/"panga"). Al teclear el nombre se pre-marcan los alérgenos probables (solo hasta que el usuario los toque a mano); siempre confirma él. Módulo puro alergenos-deteccion.js (11 tests).
// BUMP v151: Botón "✨ Detectar alérgenos" en Ingredientes → modal que revisa TODOS los ingredientes con alérgenos nuevos detectados por nombre (pre-marcados), confirmas y se guardan en bloque. Solo AÑADE, nunca quita (health-safe). Ideal onboarding masivo.
// BUMP v152: Pestaña "Inteligencia" → renombrada "Omnes" (icono 🦉, foto del búho /images/omnes.png). Reconstruida como FEED de avisos proactivos DETERMINISTAS (reglas con umbral, sin IA por tarjeta → sin ruido): recetas no rentables, stock crítico, subidas de precio, frescura y sobrestock. Voz de Omnes vía i18n (es/en/zh). Lógica en omnes-avisos.js (testeada).
// BUMP v153: Avisos Omnes con DEEP-LINK al item concreto (no solo a la pestaña). window.omnesIr(tipo,id): receta→editarReceta (abre ficha para ajustar PVP), ingrediente→editarIngrediente (frescura/sobrestock/subida precio), pedido→agregarAlCarrito (stock crítico). El id viaja en cada aviso (endpoints ya devuelven id; stock/precio desde window.ingredientes).
// BUMP v154: Contador de avisos en el sidebar/tab de Omnes (badge rojo "5", "9+"). Se recalcula en cada dashboard:refresh con el mismo construirAvisos del feed (guard anti-concurrencia, solo con sesión). Permite ver avisos pendientes sin entrar en la pestaña.
// BUMP v155: Avatar del chat Omnes = búho azul real (/images/omnes.png) en círculo blanco con object-fit:contain (se ve entero: gorro + varilla). Antes apuntaba a omnes-avatar.png (inexistente) y caía al emoji. Fondo blanco + overflow hidden + sombra.
// BUMP v156: La foto del búho azul también en los avatares de CADA mensaje del bot (y el indicador de escribiendo), no solo en la cabecera. Helper avatarMensaje() con fallback a emoji 🦉. Círculo blanco, object-fit:contain.
// BUMP v157: Botón ✕ en cada aviso de Omnes para descartarlo. Descartes en localStorage PREFIJADO por restauranteId (aislamiento multi-tenant) con CADUCIDAD 7 días (reaparece si sigue vigente). Ids de aviso estables por item. Quita la tarjeta y recalcula chips+badge sin recargar. Lógica testeada (omnes-dismiss.js, 4 tests).
// BUMP v158: Descarte de avisos vía listener delegado + data-dismiss-id (en vez de onclick inline con dato interpolado) — fix defensa XSS del security review.
// BUMP v159: Feed de Omnes reorganizado por SECCIONES (Recetas que no rentan / Stock crítico / Frescura / Subidas de precio / Sobrestock), cada una con cabecera (icono+título+contador) y plegable. Tarjetas más limpias (sin etiqueta repetida, la sección la lleva). Cada aviso trae `categoria`. i18n omnes_sec_* (es/en/zh).
// BUMP v160: Logo del sidebar (CostOS) y burbuja flotante del chat = búho azul (/images/omnes.png) en círculo blanco con object-fit:contain. FAB preparado para animación (basta cambiar el src a un GIF/WebP animado). Fallback a 🦉 si la imagen falla.
// BUMP v161: Burbuja del chat = búho azul EN MOVIMIENTO (video /images/omnes-fab.mp4, autoplay+loop+muted, 163KB comprimido desde 8.9MB). Globo de invitación "Pregúntame lo que quieras" junto al FAB (aparece a 1.8s, se cierra con ✕, click abre el chat). i18n fab_invite (es/en/zh).
// BUMP v162: Precio → UN SOLO PLAN de 90€/mes (chat incluido). Antes 95€ + add-on chat 30€ y modal Self/Pro. PLAN_PRICE_EUR 95→90; paywall muestra un único plan 90€ (retirado Pro 185€ del overlay); comentarios actualizados. El gating no cambia (chat ya estaba incluido desde 8-jun).
// BUMP v163: AUDITORÍA — Cost Tracker y P&L del tab Balance migrados a calcularCosteRecetaCompleto() (la canónica de la tabla Recetas). Cierra: subrecetas que aportaban 0 al coste en ambos, copas contadas como botellas en el P&L (factor_variante), y fallback de rendimiento divergente. Ahora escandallo = tabla Recetas = Cost Tracker = P&L.
// BUMP v164: AUDITORÍA Lote 2 — getIngredientUnitPrice compara >0 (no truthy): "0.0000" de la API ya no devuelve 0€ sino que cae al siguiente nivel (igual que el backend). Anti-ciclo en calcularCosteRecetaCompleto con copia de set por rama (auto-referencia corta a 0 como BE; diamantes legítimos suman). El selector de preparaciones base excluye la receta en edición (no puede contenerse a sí misma).
// BUMP v165: Modal "Detectar alérgenos" — la lista scrollea por dentro (flex column + overflow-y en la tabla, cabecera sticky) y el título + botones Guardar/Cancelar quedan siempre visibles. Antes con 75 ingredientes la tabla se cortaba sin scroll.
// BUMP v166: Ventana del chat responsive — width/height min(fijo, viewport) en vez de 450×550 fijo. Se ve igual en Mac/Windows/móvil sin importar el escalado del SO; las tablas del chat (que ya scrollean en horizontal) se ven bien al converger ambas máquinas a esta versión. Solo CSS, sin lógica.
// BUMP v167: Tablas del chat — las celdas envuelven por PALABRAS (white-space:normal + word-break:normal + overflow-wrap:break-word), ya no parten cada palabra letra a letra en vertical en columnas estrechas. Antes heredaban word-break:break-word del contenedor del mensaje.
// BUMP v168: Tablas del chat — FIX DEFINITIVO. La tabla iba a width:100% y se APLASTABA (columnas de 1-2 chars, texto en vertical). Ahora width:max-content + min-width:100% + celdas nowrap → la tabla toma su ancho natural y el wrapper hace scroll horizontal. Nunca más letras en vertical.
// BUMP v169: FIX RAÍZ tablas del chat. La causa real (3 intentos perdidos): theme-editorial.css/main.css tienen reglas GLOBALES con !important sobre toda tabla (padding 14-16px, min-width:800px) que machacaban las columnas del chat en su panel estrecho → texto en vertical. Mis reglas .chat-table perdían por no llevar !important. Ahora .chat-table + celdas con !important ganan SIEMPRE: ancho natural + scroll-x, padding 6px, nunca parte.
// BUMP v170: Memoria conversacional del búho (envía historial reciente a Claude) + globo FAB i18n al cambiar idioma + executeAction rechaza acciones sin nombre (evitaba pisar la 1ª entidad) + listener ESC del modal de confirmación deja de quedar huérfano.
// BUMP v171: visibilidad de Omnes — botón "Pregúntale a Omnes" en cada tarjeta del feed de avisos (abre el chat con la pregunta del aviso) + welcome del chat con poderes con nombre (Coach/Diagnóstico/Informe).
// BUMP v172: fix "Pregúntale a Omnes" — la pregunta se truncaba en la 1ª comilla (escapeHTML no escapa "). Ahora data-omnes-ask va con encodeURIComponent y se decodifica al pulsar (igual que data-action del chat).
// BUMP v173: el chat se monta también al entrar (enterApp) — antes en el login el token se seteaba tras el primer intento (chat-status 401) y había que refrescar para ver el búho.
// BUMP v174: precio fijado manual por ingrediente — checkbox "Fijar precio" en la ficha; getIngredientUnitPrice respeta el override (coste usa el precio manual, no la media de compras). Backend: columna precio_fijado + todas las queries de coste la traen.
// BUMP v175: guard anti-dedazo al recibir pedido — si un precio se desvía >70% de la media/configurado, avisa antes de que entre en la media de compras (no bloquea: confirmar o corregir).
// BUMP v176: mismo guard anti-dedazo al EDITAR la ficha del ingrediente (protege el fallback y el pin de un precio mal tecleado).
// BUMP v177: el preview verde de la ficha dice la verdad — si el ingrediente tiene media de compras y no está fijado, el coste usa la media (no el precio configurado). Antes el verde prometía el configurado y contradecía al aviso azul.
// BUMP v178: el aviso "qué precio usa el coste" se sube pegado al PRECIO (antes despistaba abajo en Formato). El aviso de coherencia del formato se queda en su sección y solo aparece si hay algo que decir.
// BUMP v179: el guard anti-dedazo de la ficha solo salta si el precio tecleado se va a usar de verdad (fijado o sin media). Si no está fijado y hay media, el precio es inerte → no avisar (caso TOMATE: 6 vs media 3,125 = +92% era ruido por un número que ni se usa).
// BUMP v180: recuento de inventario usa getIngredientUnitPrice (respeta el precio fijado 📌) en vez de cascada inline → un ingrediente fijado se valora igual en inventario que en el food cost. Sale de la whitelist anti-drift.
// BUMP v181: limpieza — i18n de la pestaña "Inteligencia" reescrito para describir el feed real de Omnes (avisos por categoría + Pregúntale a Omnes + descartar), antes describía paneles que ya no existen. Borrado módulo huérfano alertas-sistema.js.
// BUMP v183: nueva sección "Personal extra (por horas)" en balance (apunte fecha/nombre/horas/€h + subtotal del periodo). Nuevo módulo src/modules/balance/personal-extra.js.
// BUMP v188: recepción de pedidos — el descuento se mete bajando el PRECIO REAL de la línea (lo que pagas/unidad), que ya alimenta precio_medio_compra (food cost) Y ahora también el GASTO del P&L: al recibir, pedidos.total pasa a ser lo realmente recibido (precioReal×cantidad + envases), no lo pedido. Así coste y gasto cuadran del mismo precioReal. El "ajuste" queda SOLO para envases/portes (textos relabel; descuentos van en PRECIO REAL). Revertido el "Total del albarán" de v187 (prorrateo global, contaminaba líneas no descontadas). Incidente cerveza EG La Nave 5 2026-06-27.
// BUMP v207: Omnes — nueva sección "Escandallo desactualizado" (deriva de precio sostenida, caso tomate de Anais): /intelligence/price-drift compara el precio que usa el food cost vs la media ponderada de 90 días y avisa de subidas sostenidas en ingredientes de alto gasto.
// BUMP v208: branding — subtítulo "Restaurant Intelligence" en naranja claro #FFB347 (header + sidebar) + búhos SIN caja (fuera el círculo blanco del header y el cuadrado del sidebar; el búho transparente va directo sobre el navy).
// BUMP v209: móvil Fase 1 — (1) el sidebar se CIERRA al navegar (cambiarTab quita .open) + overlay real que oscurece y cierra al tocar fuera (elemento #sidebar-overlay nuevo; su CSS existía muerto); (2) toda tabla sin wrapper se hace auto-scrollable en móvil (display:block+overflow-x — antes desbordaban por el min-width:650 global: mermas, comida personal, editar pedido, evolución precio, alérgenos, horarios, cost-tracker); (3) inputs/selects a 16px en móvil (mata el ZOOM automático de iOS al enfocar); (4) chip ⌘K oculto en móvil (atajo de teclado físico); (5) sidebar COLAPSADO neutralizado en móvil (margin-left:70px estrujaba el contenido y el menú salía solo-iconos); (6) "Nuevo Pedido" en móvil: cada línea de ingrediente es una TARJETA apilada (buscador/select a ancho completo, cantidad+precio en fila táctil 44px, × absoluto arriba-derecha, botones Crear/Añadir a ancho completo) — sin tocar el contrato DOM de guardarPedido.
// BUMP v210: móvil Fase 2 — (1) recepción de pedidos en TARJETAS (data-label + #tabla-recepcion, el flujo del camarero, antes tabla de 780px); (2) card-view Recetas y Proveedores (data-label + CSS, antes scroll lateral con acciones fuera de pantalla); (3) chat con dvh + safe-area (el teclado ya no tapa el input); (4) Nuevo Pedido: steppers +/− de cantidad (solo móvil) + barra "Crear pedido" pegada abajo; (5) safe-area del iPhone (viewport-fit=cover + env insets en hamburguesa/FAB/barra).
// BUMP v211: fix chat móvil — la ventana se salía por la izquierda (anclada solo a la derecha con un width que superaba el viewport → texto cortado). Ahora anclada por los DOS lados (left:10 + right:10 + width:auto) + overflow:hidden → imposible desbordar. Verificado geométricamente (overflow horizontal=0).
// BUMP v212: fix chat móvil (2ª causa, la real): la PÁGINA tenía overflow horizontal en móvil → el "layout viewport" se ensanchaba y el chat position:fixed (anclado a la derecha) se salía por la derecha, aunque su CSS fuese correcto (no reproducible en desktop). Fix: (1) html{overflow-x:hidden} en ≤768 clava la página al ancho visible; (2) el chat se ancla por los DOS lados (left:10+right:10) en TODO el rango móvil ≤768 (antes solo ≤480; algunos móviles reportan 481-768).
// BUMP v213: LA CAUSA REAL del chat gigante en móvil — theme-editorial.css forzaba .chat-window{width:600px!important;height:80vh!important} SIN media query → en móvil aplicaba 600px (mayor que la pantalla, se salía 220px por la derecha) y machacaba con !important toda la regla responsive del chat. Fix: gated a @media(min-width:769px) → solo escritorio; en móvil manda la regla responsive del chat (reforzada con !important). Reproducido y verificado EN VIVO con emulación iPhone: 600px→370px, dentro de pantalla.
// BUMP v214: Punto de Equilibrio como bloque protagonista en Análisis (hero €/día + platos/día + 3 palancas margen/gastos/food cost, margen de contribución PONDERADO por ventas reales) + mini compacto en el Diario que consume el MISMO cálculo (window.mlBreakevenGetSnapshot) para que los números cuadren entre pantallas.
// BUMP v215: rediseño del mini de Punto de Equilibrio en el Diario — de bloque oscuro pesado a tarjeta LIGERA tintada (verde/ámbar/rojo suave) integrada con el resto de la sección "Beneficio Neto por Día". Arreglado el 🎯🎯 doble (el título i18n ya traía el emoji). Números idénticos a Análisis (mismo snapshot).
// BUMP v216: mini de Punto de Equilibrio del Diario con franja superior navy del branding CosteOS (número €/día en verde dinero) + cuerpo claro — quedaba demasiado blanco con el tinte de estado suave. Barra/faltan mantienen color de estado.
// BUMP v217: consejos de las 3 palancas del Punto de Equilibrio ahora INTELIGENTES (leen la BD, no plantillas): food cost nombra los platos que más suben la media, margen nombra los Caballos donde subir precio, prioridad "⭐ Empieza por aquí" en la palanca de mayor impacto. + botón "🦉 Pregúntale a Omnes cómo bajarlo" (deep-link al chat con la pregunta y el número ya redactados; falla suave si no hay add-on).
// BUMP v218: (1) fix carrera de carga en Análisis — si entrabas nada más loguear (datos iniciales aún cargando), la pestaña quedaba "muerta" en ceros/vacío sin repintarse nunca (había que salir y volver). Ahora: watcher one-shot repinta solo cuando llegan los datos (si la pestaña sigue activa), y los 4 stats muestran "…" mientras el fetch está en vuelo en vez de un 0 engañoso. (2) pregunta del botón "Pregúntale a Omnes" reescrita con los números etiquetados por periodo (mensual vs diario) + instrucción de no mezclar "platos/mes" con "€/día" en la misma cifra (Omnes lo comprimía confuso).
// BUMP v219: re-land de la pregunta a Omnes con periodos etiquetados (mensual vs diario) — el commit se quedó fuera del merge de #694. Sin este re-land, Omnes seguía recibiendo la pregunta vieja y mezclaba "560 platos / 464,70 /día".
// BUMP v220: FIX pregunta a Omnes truncada. Iba en un atributo HTML data-omnes-q="..." y una comilla doble del texto («al mes») lo cerraba antes de tiempo → Omnes recibía la pregunta cortada en "...NO mezcles" y respondía "el mensaje se cortó". Ahora la pregunta se pasa por JS directo (closure), sin atributo y sin comillas ASCII. Tests: completitud + guard anti-regresión (no data-omnes-q).
// BUMP v221: el Punto de Equilibrio EXCLUYE los impuestos de los gastos fijos (IVA, IRPF, IAE, Sociedades…). El IVA es pass-through y IRPF/Sociedades son sobre beneficio → no son coste operativo; meterlos inflaba el número (La Nave 5: 45.645€ con impuestos → 36.073€ operativos reales; ~2.524€/día → ~1.994€/día). Detección por palabra completa normalizada (esImpuesto), testada contra los conceptos reales de La Nave 5.
// BUMP v222: food cost del punto de equilibrio ahora se calcula como COGS/ingresos (coste total ÷ ventas totales), IGUAL que el KPI canónico del dashboard (food-cost.js). Antes usaba media de porcentajes ponderada por unidades → daba 29% en vez de ~31% y no cuadraba con el resto de la app. Cambio de método, mismo origen de datos (menu-engineering).
// BUMP v223: food cost del punto de equilibrio ahora se LEE del endpoint canónico (/analytics/pnl-breakdown, el mismo que el KPI del dashboard) para el MES EN CURSO → número idéntico al dashboard (antes: método propio + periodo histórico = descuadre 29% vs 31%). De ese food cost se deriva el margen, así todo el bloque cuadra. Fallback al cálculo del menú si el endpoint falla.
// BUMP v224: el food cost del punto de equilibrio muestra el GLOBAL (comida+bebida) histórico = MISMA fórmula y número que Omnes (34,2% en La Nave 5), no el de comida sola. Un punto de equilibrio va sobre toda la facturación → food cost global. Calculado como (cogs_food+cogs_bev)/(ing_food+ing_bev) desde /analytics/pnl-breakdown, idéntico a fc_total de Omnes.
// BUMP v225: la pregunta a Omnes cita el food cost con 1 decimal (35,6%) igual que la tarjeta del bloque — antes lo redondeaba a 36% y parecía descuadre.
// BUMP v226: gastos fijos OPERATIVOS (de explotación) en TODO el P&L y el punto de equilibrio — excluye solo impuestos NO operativos (IVA/IGIC/IRPF/Sociedades) y MANTIENE el IAE/IBI/tasas. La Nave 5: 45.645€ (lista, sin tocar) → 40.406,58€ operativos (P&L beneficio + Cuenta de Resultados + equilibrio + Omnes cuadran). + ⓘ discreto que explica qué cuenta y por qué. Regla: "si mañana no vendes ni un café, ¿lo pagarías?".
// BUMP v227: la Cuenta de Resultados (P&L Diario) del MES EN CURSO prorratea los gastos fijos a los días transcurridos, no al mes entero — antes restaba el mes completo de fijos contra ventas parciales y salía una pérdida FALSA a mitad de mes (La Nave 5: −29.582€ engañoso con 4 días de ventas). Los meses pasados se cuentan completos, igual que antes.
// BUMP v228: el Punto de Equilibrio (food cost, ticket, margen y pregunta a Omnes) usa una VENTANA MÓVIL de los últimos 90 días, no el histórico completo — un número de supervivencia debe reflejar la realidad reciente, no arrastrar precios/carta viejos. El mini del Diario usa el mismo snapshot → cuadran entre pestañas.
// BUMP v229: FIX P&L Diario — el TOTAL MES de gastos fijos = gastoFijoDia × nº de días MOSTRADOS (columnas con datos), no × días de calendario transcurridos. Así el TOTAL cuadra EXACTO con la suma de los beneficios netos diarios (cada columna ya resta su gasto fijo). Antes salía 396€ en vez de 5.610€ = suma de las columnas (La Nave 5, 4 días).
// BUMP v232: formato de compra por proveedor en el modal de Proveedores (unidad explícita €/unidad-base + bloque caja/bolsa que deriva el precio) + aviso del guard ±70% al marcar principal.

// BUMP v233: el mini de "Punto de equilibrio" se quita del Diario y queda SOLO en Análisis — tenerlo junto al P&L mezclaba el gasto fijo/día (coste, ÷31 días) con el objetivo de ventas/día del equilibrio (÷26 días y descontando food cost) → confundía. El cálculo sigue en Análisis (window.mlBreakevenGetSnapshot). Solo se deja de renderizar el bloque en el Diario; no toca cálculos.
// BUMP v234: rediseño VISUAL de "Beneficio neto por día" en el Diario — de lista de texto a GRÁFICO de barras divergentes (verde arriba = ganas, rojo abajo = pierdes) + titular grande con el beneficio del mes + mejor/peor día + 3 stats + 1 línea de aviso para días sin ventas. Mismos datos y cálculos que antes (barras alimentadas por el mismo beneficio neto diario); solo cambia la presentación.
// BUMP v235: el contenedor de "Beneficio neto por día" recortaba el gráfico (max-height:300px + marco blanco de la lista antigua). Quitado el max-height/overflow y el fondo blanco → el gráfico se ve completo. Texto de estado vacío aclarado sobre fondo oscuro.
// BUMP v236: "Beneficio neto por día" añade LÍNEA de acumulado del mes sobre las barras (sube cuando ganas, baja cuando pierdes) + puntos con el acumulado por día en tooltip. Recupera el arrastre día a día que mostraba la lista antigua, ahora visual. Solo presentación; el total del mes no cambia.
// BUMP v237: la línea de acumulado muestra ahora la CIFRA visible en cada punto (chip azul con el acumulado del día), no solo en tooltip — antes no se veía ningún número sobre la línea. Con >12 días vuelve a solo-tooltip para no saturar.
// BUMP v238: fix solapamiento — el número del DÍA pasa a ir DENTRO de la barra (blanco) y el chip azul del acumulado se coloca arriba o abajo según la posición del punto (sin cortarse por el borde). Antes, en días donde el pico de la línea coincidía con la punta de la barra (p.ej. día 4), los dos números se pisaban y se cortaban.
// BUMP v239: solución definitiva al solapamiento — el número de cada día YA NO va en la barra; va DEBAJO, en el eje (bajo el número del día, en verde/rojo). Así en el área del gráfico solo queda el chip del acumulado, y el valor diario va abajo → imposible que se pisen. Barras limpias.
// BUMP v240: la cifra de cada día vuelve PEGADA a la barra — las VERDES por arriba (encima de la barra) y las ROJAS por abajo (debajo de la barra), como pidió Iker. Barras escaladas al 82% para dejar hueco a la cifra sin cortarse. El chip azul del acumulado sigue sobre la línea (colocado según su altura), sin solaparse.
// BUMP v241: fin del solape definitivo — las cifras del ACUMULADO se sacan del gráfico y van a una fila DEBAJO del eje (azul, bajo el número del día); la línea se queda sin números encima. Así la cifra del día (pegada a la barra) y la del acumulado (bajo el eje) están en zonas separadas y NO pueden pisarse (días 3 y 4 arreglados).
// BUMP v242 (auditoría Lote 1): (1) FIX las tarjetas KPI del Diario (Ventas/Beneficio/FoodCost) respetan el selector de mes/año — antes usaban SIEMPRE el mes actual y al consultar un mes pasado tarjetas y tablas mostraban meses distintos. (2) La tarjeta Food Cost lleva etiqueta "Solo comida · periodo seleccionado" (el Equilibrio usa el global de 90 días — eran números distintos por diseño, ahora se explica). (3) La pregunta a Omnes del Equilibrio le ordena analizar los platos en la MISMA ventana de 90 días (antes Omnes respondía con el histórico completo).
// BUMP v243 (auditoría Lote 3, frontend): (1) el gráfico "Beneficio neto por día" corre sobre la función PURA testeada (pnl-diario-calc vía window.mlComputeBeneficioNetoDiario) — la lógica blindada por tests es la que corre en la app; + guard de la tabla P&L (total fijos = gfd × días mostrados, prohibido volver a calendario/mes entero). (2) Las mermas detectadas al subir Excel valoran con la función CANÓNICA de precio (respeta el precio fijado 📌; antes replicaban la cascada a mano y lo ignoraban). (3) La cache del food cost canónico lleva el rango como clave (un consumidor con otro periodo ya no puede recibir el número cacheado de otro rango).
// BUMP v244: la tabla Cuenta de Resultados muestra columna para TODOS los días TRANSCURRIDOS del mes (mismo universo que el gráfico) y el TOTAL de PERSONAL EXTRA = suma de las columnas — antes un extra pagado un día sin ventas tenía total sin columna, y un extra con FECHA FUTURA (caso Manu 11/7, 120€) entraba al total del mes en curso: la suma de columnas daba +24,43€ y el total −95,57€. Ahora tabla y gráfico dan EXACTAMENTE el mismo beneficio.
// BUMP v245: en el gráfico Beneficio neto por día, los números (valor del día + acumulado bajo el eje) se muestran ahora TODO el mes (hasta 31 días) con letra ADAPTATIVA al nº de días — antes se ocultaban por encima de 12 días y en un mes entero (junio 30 días) no se veía ningún número.
// BUMP v246 (Tanda 2 volandeira — Opción A): al marcar/editar el proveedor PRINCIPAL con formato, ese formato se PROPAGA al ingrediente (formato_compra + cantidad_por_formato + precio en €/formato coherente) → pedidos e inventario lo usan igual que si se configurara en la pestaña Ingredientes. Refresca window.ingredientes al momento + toast. Guard ±70% sobre precio UNITARIO; respeta precio_fijado.
// BUMP v247 (bug pedido por formato): al pedir un ingrediente que se compra por CAJA cuyo proveedor tiene precio configurado (ingredientes_proveedores.precio, en €/unidad-base), el input €/CAJA mostraba el €/base crudo (1 caja de 3 kg salía a 16,09 € en vez de 48,27 €). Ahora, en modo formato, muestra €/formato = €base × cpf, igual que la rama de última compra. Detectado probando la propagación de formato de la volandeira.
// BUMP v252 (claridad ingeniería de menú): las listas de cuadrantes (Estrellas/Puzzles/Caballos/Perros) mostraban "12,44€ · 3387" sin etiqueta (solo tooltip). Ahora cada cuadrante lleva una leyenda de columnas visible "Plato — Margen/ración · uds vendidas" y las unidades llevan sufijo "uds". Se entiende de un vistazo qué es cada número.
// BUMP v253 (tabla ingeniería coherente): la fila era flex "nombre ... margen · uds" amontonado y sin alinear. Ahora item y leyenda son GRID de 3 columnas idénticas (Plato | Margen/ración | Uds vendidas), números a la derecha con tabular-nums → columnas cuadradas y legibles. Sin sufijo "uds" en el valor (ya lo dice la cabecera de columna).
// BUMP v254: Ranking de Rentabilidad, matriz BCG y gráfica de margen por categoría comparten UNA sola lista de "no son platos" (base/suministros/extras). Antes el ranking solo quitaba 'base' y colaba los cargos (PAN POR PERSONA) entre los platos; la gráfica de margen usaba otra lista distinta. Los cargos/complementos se marcan con categoria='extra' (mismo criterio que el backend categoriaClassifier). Pinchos/tapas SIGUEN en el ranking.
// BUMP v255: portada móvil enfocada (Pieza A) — barra de navegación inferior (Inicio/Pedidos/Recibir/Más) + 2 acciones grandes (Nuevo pedido / Recibir albarán) en la vista Inicio. 100% dentro de @media 768 (escritorio intacto), reutiliza cambiarTab. mobile-home.css + mobile-nav.js. i18n es/en/zh.
// BUMP v256: portada móvil Inicio = 2 botones grandes (Nuevo pedido / Recibir albarán) a pantalla completa; dashboard movido a su propio botón (Panel). Barra: Inicio·Panel·Pedidos·Más.
// BUMP v257: FIX modal de recepción de pedidos — las líneas editables (cantidad/precio recibidos) se ocultaban porque quick-actions.css pone .modal-content en flex-column global y el wrapper con overflow-x colapsaba a height:0. flex-shrink:0 en el wrapper. Verificado en staging (0→418px, 4 líneas visibles).
// BUMP v258: Pieza B.1 — botón 'Recibir albarán' abre la cámara del móvil, reescala la foto y la manda a /parse-albaran (Claude Vision); muestra proveedor + líneas leídas/reconocidas + total. Reconciliación con el pedido = B.2.
const CACHE_NAME = 'mindloop-costos-v272';

// Solo recursos GARANTIZADOS que existen en producción
// CSS/JS se cachean dinámicamente porque Vite les añade hashes
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/images/costeos-mark.png',
    '/images/costeos-icon-192.png'
];

// Instalación: cachear recursos estáticos con manejo de errores
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log('📦 Cacheando recursos esenciales');
                // Cachear cada recurso individualmente para tolerancia a errores
                const results = await Promise.allSettled(
                    PRECACHE_ASSETS.map(url =>
                        cache.add(url).catch(err => {
                            console.warn(`⚠️ No se pudo cachear ${url}:`, err.message);
                            return null;
                        })
                    )
                );
                const exitosos = results.filter(r => r.status === 'fulfilled').length;
                console.log(`✅ Precache completado: ${exitosos}/${PRECACHE_ASSETS.length} recursos`);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación: limpiar caches antiguos
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker activado');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
    // Solo interceptar requests GET
    if (event.request.method !== 'GET') return;

    // No cachear requests a API
    if (event.request.url.includes('/api/')) return;

    // No interceptar cross-origin (i.ytimg.com, cdn.jsdelivr.net, fonts...).
    // El catch del fetch devolvía '/' (index.html) como fallback, lo que
    // rompía las miniaturas de YouTube y otros recursos externos: el browser
    // recibía HTML donde esperaba una imagen.
    const reqUrl = new URL(event.request.url);
    if (reqUrl.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es válida, guardar en cache
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red, intentar servir desde cache
                return caches.match(event.request).then((cachedResponse) => {
                    return cachedResponse || caches.match('/');
                });
            })
    );
});

console.log('🚀 MindLoop CostOS Service Worker cargado');
