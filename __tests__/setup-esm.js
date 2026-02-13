/**
 * Jest ESM Setup — runs BEFORE test environment modules are loaded.
 * Polyfills import.meta.env for Vite compatibility in Jest/Node.
 */

// Note: In ESM mode with --experimental-vm-modules, import.meta is available
// but import.meta.env is NOT (Vite provides it). We polyfill it here.
if (typeof import.meta.env === 'undefined') {
    Object.defineProperty(import.meta, 'env', {
        value: {},
        writable: true,
        configurable: true,
    });
}

// Set default values matching Vite defaults
Object.assign(import.meta.env, {
    VITE_API_BASE_URL: 'http://localhost:3001',
    VITE_STOCK_WARNING_THRESHOLD: '0.2',
    VITE_CHAT_WEBHOOK_URL: '',
    VITE_ENABLE_DEBUG: 'false',
    VITE_LOG_LEVEL: 'info',
    VITE_ENABLE_PERFORMANCE_MONITORING: 'true',
    VITE_SENTRY_DSN: '',
    MODE: 'test',
    DEV: true,
    PROD: false,
    ...import.meta.env, // preserve any existing values
});
