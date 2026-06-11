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
// BUMP v148: Alérgenos UE (14) por ingrediente — selector en el form, guardado en BD (col alergenos JSONB, backend), y la receta los HEREDA (unión recursiva de ingredientes + subrecetas). Se muestran en la Ficha de Costes y su PDF. Módulo puro src/modules/ingredientes/alergenos.js + i18n es/en/zh.
const CACHE_NAME = 'mindloop-costos-v148';

// Solo recursos GARANTIZADOS que existen en producción
// CSS/JS se cachean dinámicamente porque Vite les añade hashes
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/images/logo-sin-circulo.png'
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
