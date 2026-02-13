/**
 * Sentry Error Monitoring — Inicialización
 * 
 * El DSN de frontend es público por diseño (Sentry docs).
 * La protección está en los "Allowed Domains" configurados en Sentry.
 * Se carga aquí (no inline en index.html) para:
 * 1. Poder desactivar en dev/test sin tocar HTML
 * 2. Control centralizado de sampling y environment
 */

const SENTRY_DSN = 'https://ac722e9d30983357b092ee766be13c5e@o4510649135661056.ingest.de.sentry.io/4510649155190864';

export function initSentry() {
    // Solo inicializar si el SDK está cargado y estamos en producción
    if (!window.Sentry) return;

    const isProduction = window.location.hostname !== 'localhost'
        && !window.location.hostname.includes('127.0.0.1');

    if (!isProduction) {
        console.log('🔇 Sentry desactivado en desarrollo');
        return;
    }

    window.Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: 'production',
        // Filtrar errores de extensiones de navegador
        beforeSend(event) {
            if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
                f => f.filename?.includes('chrome-extension')
            )) {
                return null;
            }
            return event;
        }
    });
}
