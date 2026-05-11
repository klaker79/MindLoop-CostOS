/**
 * select-with-search — añade un input de búsqueda encima de un <select>
 * nativo que filtra sus <option> al teclear (substring case-insensitive).
 *
 * El <select> sigue siendo HTML5 nativo (sin TomSelect, sin race conditions).
 * El input solo oculta visualmente las options no matching usando display:none
 * — el `.value` del select se mantiene aunque la option esté oculta.
 *
 * Uso:
 *   import { attachSelectSearch } from '@/utils/select-with-search.js';
 *   attachSelectSearch(selectEl, { placeholder: 'Buscar ingrediente...' });
 *
 * Idempotente: si ya tiene un input asociado, no duplica.
 */

const MARK = '__hasSelectSearch';

export function attachSelectSearch(selectEl, opts = {}) {
    if (!selectEl || selectEl[MARK]) return;
    selectEl[MARK] = true;

    const placeholder = opts.placeholder || 'Buscar...';

    // Crear input por encima del select dentro del mismo contenedor.
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = `🔍 ${placeholder}`;
    input.className = 'select-search-input';
    input.autocomplete = 'off';
    input.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        margin-bottom: 6px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13px;
        background: #fff;
        box-sizing: border-box;
    `;

    // Insertarlo antes del select.
    selectEl.parentNode.insertBefore(input, selectEl);

    // Cachear options para filtrar rápido. Saltar la primera (placeholder
    // tipo "Selecciona..." con value="") y las disabled (separadores).
    const options = Array.from(selectEl.options);

    const applyFilter = () => {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            options.forEach(o => { o.hidden = false; });
            return;
        }
        options.forEach(o => {
            if (!o.value || o.disabled) {
                o.hidden = false; // placeholder y separadores siempre visibles
                return;
            }
            o.hidden = !o.textContent.toLowerCase().includes(q);
        });
    };

    input.addEventListener('input', applyFilter);

    // Si el input recibe Enter, no submit del form contenedor — solo cierra
    // el filtro.
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault();
    });
}
