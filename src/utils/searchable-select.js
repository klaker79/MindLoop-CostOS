/**
 * Searchable select — wraps a <select> con TomSelect.
 *
 * TomSelect se carga via CDN en index.html (compat con GitHub Pages sin build).
 * Si la lib no está disponible (por bloqueo de red), el select original sigue
 * funcionando sin cambios. Failsafe explícito.
 *
 * Uso:
 *   import { enhanceSearchableSelect } from '@/utils/searchable-select.js';
 *   enhanceSearchableSelect(selectElement);
 *
 * Para detach (al destruir el modal):
 *   element.tomselect?.destroy();
 */

const TOMSELECT_DEFAULTS = {
    create: false,
    sortField: { field: 'text', direction: 'asc' },
    maxOptions: 1000,
    placeholder: 'Buscar...',
    plugins: ['clear_button'],
    // Filtra por substring case-insensitive sobre el texto visible
    searchField: ['text'],
    // Mantiene el evento change del select original (algunos componentes lo usan)
    onChange(value) {
        const ev = new Event('change', { bubbles: true });
        this.input.dispatchEvent(ev);
    }
};

export function enhanceSearchableSelect(selectEl, opts = {}) {
    if (!selectEl) return null;
    if (typeof window.TomSelect !== 'function') {
        // Lib no disponible → no hacer nada, el select sigue como nativo
        return null;
    }
    if (selectEl.tomselect) return selectEl.tomselect;

    try {
        return new window.TomSelect(selectEl, { ...TOMSELECT_DEFAULTS, ...opts });
    } catch (err) {
        console.warn('TomSelect init falló, fallback a select nativo:', err);
        return null;
    }
}
