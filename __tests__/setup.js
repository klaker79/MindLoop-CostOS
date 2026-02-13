/**
 * Jest Test Setup
 * Configura el entorno global para simular el navegador
 */

// En ES modules, jest ya está disponible en el contexto de test
// Este archivo solo configura variables globales que usa la app

// Mock de import.meta.env (Vite env vars) para Node test environment
if (!import.meta.env) {
    import.meta.env = {};
}
import.meta.env.VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
import.meta.env.VITE_STOCK_WARNING_THRESHOLD = import.meta.env.VITE_STOCK_WARNING_THRESHOLD || '0.2';
import.meta.env.VITE_CHAT_WEBHOOK_URL = import.meta.env.VITE_CHAT_WEBHOOK_URL || '';
import.meta.env.VITE_ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG || 'false';
import.meta.env.VITE_LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'info';
import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING = import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING || 'true';
import.meta.env.MODE = import.meta.env.MODE || 'test';
import.meta.env.DEV = true;
import.meta.env.PROD = false;
// Mock de variables globales que usa la app
global.window = global.window || {};
global.window.ingredientes = [];
global.window.recetas = [];
global.window.proveedores = [];
global.window.pedidos = [];
global.window.ventas = [];

// localStorage ya está mockeado por jsdom, pero añadimos fallback
if (!global.localStorage) {
    global.localStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { }
    };
}

// Mock de XLSX (SheetJS) - para tests de exportación
global.XLSX = {
    utils: {
        book_new: () => ({}),
        json_to_sheet: () => ({}),
        book_append_sheet: () => { }
    },
    writeFile: () => { }
};

// Silenciar console en tests (opcional, comentar para debug)
// global.console.log = () => {};
// global.console.warn = () => {};
