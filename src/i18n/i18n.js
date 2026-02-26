/**
 * i18n — Motor de traducciones para MindLoop CostOS
 * 
 * Uso:
 *   import { t, setLang, getCurrentLang } from './i18n/i18n.js';
 *   t('nav.ingredients')         → "Ingredientes" (es) / "Ingredients" (en)
 *   t('msg.saved', {name: 'X'}) → "X guardado" / "X saved"
 */

let currentLang = 'es';
let translations = {};
let fallback = {};

/**
 * Inicializa el sistema i18n. Carga el idioma del usuario.
 * Llamar una vez al arrancar la app (main.js).
 */
export async function initI18n() {
    // Detectar idioma: localStorage > navigator > 'es'
    const stored = localStorage.getItem('costos_lang');
    if (stored && (stored === 'es' || stored === 'en')) {
        currentLang = stored;
    } else {
        currentLang = navigator.language?.startsWith('en') ? 'en' : 'es';
    }

    try {
        // Cargar traducciones — imports estáticos para que Vite los resuelva
        if (currentLang === 'en') {
            const mod = await import('./en.json');
            translations = mod.default || mod;
            const fb = await import('./es.json');
            fallback = fb.default || fb;
        } else {
            const mod = await import('./es.json');
            translations = mod.default || mod;
        }
    } catch (e) {
        console.warn('[i18n] Error cargando traducciones:', e);
    }

    // Actualizar atributo lang del HTML
    document.documentElement.lang = currentLang;

    // Traducir elementos con data-i18n
    translateDOM();
}

/**
 * Traduce una key. Si no existe, devuelve el fallback español o la key.
 * Soporta interpolación: t('msg', {name: 'foo'}) → "Hola foo"
 */
export function t(key, params = {}) {
    let str = translations[key] || fallback[key] || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
}

/**
 * Cambia el idioma y recarga la app.
 */
export function setLang(lang) {
    if (lang !== 'es' && lang !== 'en') return;
    localStorage.setItem('costos_lang', lang);
    window.location.reload();
}

/**
 * Devuelve el idioma activo ('es' | 'en').
 */
export function getCurrentLang() {
    return currentLang;
}

/**
 * Recorre todos los [data-i18n] del DOM y aplica t().
 * Se puede llamar después de renderizar HTML dinámico.
 */
export function translateDOM(root = document) {
    const elements = root.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;

        // data-i18n-attr="placeholder" → traduce el atributo en vez del textContent
        const attr = el.getAttribute('data-i18n-attr');
        if (attr) {
            el.setAttribute(attr, t(key));
        } else {
            el.textContent = t(key);
        }
    });

    // Traducir títulos (tooltips)
    const titled = root.querySelectorAll('[data-i18n-title]');
    titled.forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
}
