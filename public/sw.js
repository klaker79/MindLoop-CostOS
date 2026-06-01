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

const CACHE_NAME = 'mindloop-costos-v63';

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
