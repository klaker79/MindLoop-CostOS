/**
 * ============================================
 * i18n - Internationalization Module
 * ============================================
 *
 * Centralized translation system using i18next.
 * Supports ES (default) and EN.
 *
 * Usage in any module:
 *   import { t } from '@/i18n/index.js';
 *   showToast(t('ingredientes.saved'), 'success');
 *
 * @module i18n
 */

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import DOMPurify from 'dompurify';

// Import all locale bundles (bundled by Vite, no HTTP requests)
import es_common from './locales/es/common.json';
import es_ingredientes from './locales/es/ingredientes.json';
import es_recetas from './locales/es/recetas.json';
import es_proveedores from './locales/es/proveedores.json';
import es_pedidos from './locales/es/pedidos.json';
import es_ventas from './locales/es/ventas.json';
import es_inventario from './locales/es/inventario.json';
import es_dashboard from './locales/es/dashboard.json';
import es_auth from './locales/es/auth.json';
import es_chat from './locales/es/chat.json';
import es_equipo from './locales/es/equipo.json';
import es_horarios from './locales/es/horarios.json';
import es_balance from './locales/es/balance.json';
import es_alertas from './locales/es/alertas.json';
import es_export from './locales/es/export.json';
import es_settings from './locales/es/settings.json';
import es_inteligencia from './locales/es/inteligencia.json';
import es_simulador from './locales/es/simulador.json';

import en_common from './locales/en/common.json';
import en_ingredientes from './locales/en/ingredientes.json';
import en_recetas from './locales/en/recetas.json';
import en_proveedores from './locales/en/proveedores.json';
import en_pedidos from './locales/en/pedidos.json';
import en_ventas from './locales/en/ventas.json';
import en_inventario from './locales/en/inventario.json';
import en_dashboard from './locales/en/dashboard.json';
import en_auth from './locales/en/auth.json';
import en_chat from './locales/en/chat.json';
import en_equipo from './locales/en/equipo.json';
import en_horarios from './locales/en/horarios.json';
import en_balance from './locales/en/balance.json';
import en_alertas from './locales/en/alertas.json';
import en_export from './locales/en/export.json';
import en_settings from './locales/en/settings.json';
import en_inteligencia from './locales/en/inteligencia.json';
import en_simulador from './locales/en/simulador.json';

const SUPPORTED_LANGS = ['es', 'en'];
const DEFAULT_LANG = 'es';
const NAMESPACES = [
    'common', 'ingredientes', 'recetas', 'proveedores',
    'pedidos', 'ventas', 'inventario', 'dashboard',
    'auth', 'chat', 'equipo', 'horarios',
    'balance', 'alertas', 'export', 'settings', 'inteligencia', 'simulador'
];

i18next
    .use(LanguageDetector)
    .init({
        // Language config
        fallbackLng: DEFAULT_LANG,
        supportedLngs: SUPPORTED_LANGS,
        defaultNS: 'common',
        ns: NAMESPACES,

        // Bundled resources (no HTTP backend needed)
        resources: {
            es: {
                common: es_common,
                ingredientes: es_ingredientes,
                recetas: es_recetas,
                proveedores: es_proveedores,
                pedidos: es_pedidos,
                ventas: es_ventas,
                inventario: es_inventario,
                dashboard: es_dashboard,
                auth: es_auth,
                chat: es_chat,
                equipo: es_equipo,
                horarios: es_horarios,
                balance: es_balance,
                alertas: es_alertas,
                export: es_export,
                settings: es_settings,
                inteligencia: es_inteligencia,
                simulador: es_simulador,
            },
            en: {
                common: en_common,
                ingredientes: en_ingredientes,
                recetas: en_recetas,
                proveedores: en_proveedores,
                pedidos: en_pedidos,
                ventas: en_ventas,
                inventario: en_inventario,
                dashboard: en_dashboard,
                auth: en_auth,
                chat: en_chat,
                equipo: en_equipo,
                horarios: en_horarios,
                balance: en_balance,
                alertas: en_alertas,
                export: en_export,
                settings: en_settings,
                inteligencia: en_inteligencia,
                simulador: en_simulador,
            },
        },

        // Language detection
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'mindloop_lang',
            caches: ['localStorage'],
        },

        // Interpolation (compatible with template literals)
        interpolation: {
            escapeValue: true, // Defense-in-depth: escape interpolated values by default
            prefix: '{{',
            suffix: '}}',
        },

        // Don't fail on missing keys — show key name as fallback
        saveMissing: false,
        missingKeyHandler: false,
    });

/**
 * Translation function — shorthand for i18next.t()
 * @param {string} key - Translation key (e.g., 'common.save' or 'ingredientes.title')
 * @param {object} [options] - Interpolation values
 * @returns {string}
 */
export const t = i18next.t.bind(i18next);

/**
 * Change the active language
 * @param {string} lang - Language code ('es' or 'en')
 */
export function changeLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) {
        console.warn(`[i18n] Unsupported language: ${lang}`);
        return;
    }
    i18next.changeLanguage(lang);
    localStorage.setItem('mindloop_lang', lang);
    document.documentElement.lang = lang;

    // Re-translate all static HTML elements
    translateHTML();

    // Dispatch event so UI modules can re-render dynamic content
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

/**
 * Get current language
 * @returns {string}
 */
export function getCurrentLanguage() {
    return i18next.language || DEFAULT_LANG;
}

/**
 * Get all supported languages
 * @returns {string[]}
 */
export function getSupportedLanguages() {
    return [...SUPPORTED_LANGS];
}

/**
 * Translate all DOM elements with data-i18n attributes.
 * Supports:
 *   data-i18n="namespace:key"           → textContent
 *   data-i18n-placeholder="namespace:key" → placeholder
 *   data-i18n-title="namespace:key"     → title attribute
 *   data-i18n-html="namespace:key"      → innerHTML (use sparingly)
 */
export function translateHTML(root = document) {
    // textContent
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key);
    });
    // placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = t(key);
    });
    // title attribute
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) el.title = t(key);
    });
    // innerHTML (for keys containing HTML markup) — sanitized with DOMPurify
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key) el.innerHTML = DOMPurify.sanitize(t(key));
    });
}

/**
 * Update language switcher button styles to reflect current language
 */
function updateLangSwitcherUI() {
    const currentLang = getCurrentLanguage();
    document.querySelectorAll('#language-switcher .lang-btn').forEach(btn => {
        const isActive = btn.dataset.lang === currentLang;
        btn.style.background = isActive ? 'rgba(255,255,255,0.1)' : 'transparent';
        btn.style.color = isActive ? '#e2e8f0' : 'rgba(255,255,255,0.5)';
        btn.style.borderColor = isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)';
    });
}

// Update switcher UI on language change
window.addEventListener('languageChanged', updateLangSwitcherUI);

// Set initial state when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateLangSwitcherUI);
} else {
    updateLangSwitcherUI();
}

// Expose globally for legacy code compatibility
window.t = t;
window.changeLanguage = changeLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.translateHTML = translateHTML;

export default i18next;
