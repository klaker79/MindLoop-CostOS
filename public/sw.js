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

const CACHE_NAME = 'mindloop-costos-v22';

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
