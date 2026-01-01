/**
 * Global Search Module
 * Search across ingredients, recipes, providers, and orders
 * 
 * @module modules/search/global-search
 */

/**
 * Initializes the global search functionality
 */
export function initGlobalSearch() {
    // Create search container if it doesn't exist
    let searchContainer = document.getElementById('global-search-container');
    if (searchContainer) return; // Already initialized

    // Find the header flex container (the one with the logo)
    const headerFlexContainer = document.querySelector('.header > div:first-child');
    if (!headerFlexContainer) {
        console.warn('Global search: Header not found');
        return;
    }

    // Create search HTML
    searchContainer = document.createElement('div');
    searchContainer.id = 'global-search-container';
    searchContainer.style.cssText = 'position: relative; flex: 1; max-width: 350px;';
    searchContainer.innerHTML = `
        <div style="position: relative;">
            <input type="text" id="global-search-input" 
                placeholder="🔍 Buscar..." 
                style="width: 100%; padding: 10px 40px 10px 15px; border: none; border-radius: 25px; font-size: 14px; background: rgba(255,255,255,0.2); color: white; transition: all 0.2s;"
                onfocus="this.style.background='rgba(255,255,255,0.3)'; this.placeholder='Buscar ingredientes, recetas, pedidos...'"
                onblur="if(!this.value) { this.style.background='rgba(255,255,255,0.2)'; this.placeholder='🔍 Buscar...'; }"
            >
            <span style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.6); font-size: 11px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">⌘K</span>
        </div>
        <div id="global-search-results" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); margin-top: 8px; max-height: 400px; overflow-y: auto; z-index: 9999;"></div>
    `;

    // Append to the header flex container
    headerFlexContainer.appendChild(searchContainer);

    // Add event listeners
    const input = document.getElementById('global-search-input');
    const results = document.getElementById('global-search-results');

    input.addEventListener('input', debounce(() => performSearch(input.value), 200));
    input.addEventListener('focus', () => {
        if (input.value.length >= 2) results.style.display = 'block';
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            results.style.display = 'none';
        }
    });

    // Keyboard shortcut (Cmd+K or Ctrl+K)
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            input.focus();
            input.select();
        }
        if (e.key === 'Escape') {
            results.style.display = 'none';
            input.blur();
        }
    });
}

/**
 * Simple debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Performs search across all data types
 * ⚡ OPTIMIZACIÓN: Pre-build Map de proveedores para búsqueda de pedidos
 */
function performSearch(query) {
    const results = document.getElementById('global-search-results');
    if (!query || query.length < 2) {
        results.style.display = 'none';
        return;
    }

    const q = query.toLowerCase();
    const matches = [];

    // Search Ingredients
    (window.ingredientes || []).forEach(ing => {
        if (ing.nombre?.toLowerCase().includes(q) || ing.categoria?.toLowerCase().includes(q)) {
            matches.push({
                type: 'ingrediente',
                icon: '🥬',
                title: ing.nombre,
                subtitle: `${escapeHTML(ing.categoria || 'Sin categoría')} • ${parseFloat(ing.precio || 0).toFixed(2)}€/${escapeHTML(ing.unidad || 'ud')}`,
                action: () => {
                    window.cambiarTab?.('ingredientes');
                    document.getElementById('busqueda-ingredientes').value = ing.nombre;
                    window.renderizarIngredientes?.();
                }
            });
        }
    });

    // Search Recipes
    (window.recetas || []).forEach(rec => {
        if (rec.nombre?.toLowerCase().includes(q) || rec.codigo?.toString().includes(q)) {
            matches.push({
                type: 'receta',
                icon: '🍽️',
                title: rec.nombre,
                subtitle: `${escapeHTML(rec.categoria || 'Sin categoría')} • PVP: ${parseFloat(rec.precio_venta || 0).toFixed(2)}€`,
                action: () => {
                    window.cambiarTab?.('recetas');
                    document.getElementById('busqueda-recetas').value = rec.nombre;
                    window.renderizarRecetas?.();
                }
            });
        }
    });

    // Search Providers
    (window.proveedores || []).forEach(prov => {
        if (prov.nombre?.toLowerCase().includes(q) || prov.contacto?.toLowerCase().includes(q)) {
            matches.push({
                type: 'proveedor',
                icon: '🚚',
                title: prov.nombre,
                subtitle: escapeHTML(prov.telefono || prov.email || 'Sin contacto'),
                action: () => {
                    window.cambiarTab?.('proveedores');
                    document.getElementById('busqueda-proveedores').value = prov.nombre;
                    window.renderizarProveedores?.();
                }
            });
        }
    });

    // ⚡ OPTIMIZACIÓN: Crear Map de proveedores para búsqueda de pedidos O(1)
    const provMap = new Map((window.proveedores || []).map(p => [p.id, p]));

    // Search Orders
    (window.pedidos || []).forEach(ped => {
        const prov = provMap.get(ped.proveedorId);
        const provNombre = prov?.nombre || 'Proveedor';
        if (provNombre.toLowerCase().includes(q) || ped.estado?.toLowerCase().includes(q)) {
            matches.push({
                type: 'pedido',
                icon: '📦',
                title: `Pedido a ${escapeHTML(provNombre)}`,
                subtitle: `${escapeHTML(ped.estado || 'pendiente')} • ${parseFloat(ped.total || 0).toFixed(2)}€`,
                action: () => {
                    window.cambiarTab?.('pedidos');
                    window.renderizarPedidos?.();
                }
            });
        }
    });

    // Render results
    if (matches.length === 0) {
        results.innerHTML = `
            <div style="padding: 30px; text-align: center; color: #94a3b8;">
                <div style="font-size: 24px; margin-bottom: 10px;">🔍</div>
                <div>No se encontraron resultados para "${escapeHTML(query)}"</div>
            </div>
        `;
    } else {
        // Limit and group by type
        const limited = matches.slice(0, 10);
        results.innerHTML = limited.map((m, i) => `
            <div class="search-result-item" data-index="${i}" style="padding: 12px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.1s;"
                onmouseover="this.style.background='#f8fafc'"
                onmouseout="this.style.background='white'">
                <span style="font-size: 20px;">${m.icon}</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1e293b;">${highlightMatch(m.title, query)}</div>
                    <div style="font-size: 12px; color: #64748b;">${m.subtitle}</div>
                </div>
                <span style="font-size: 10px; padding: 4px 8px; background: #f1f5f9; border-radius: 6px; color: #64748b;">${m.type}</span>
            </div>
        `).join('');

        // Store actions for click handling
        window._searchResults = limited;

        // ⚡ OPTIMIZACIÓN: Event delegation - un solo listener en lugar de N listeners
        // Remove previous listeners (if any)
        const oldHandler = results._clickHandler;
        if (oldHandler) {
            results.removeEventListener('click', oldHandler);
        }

        // Add single delegated click handler
        const clickHandler = (e) => {
            const item = e.target.closest('.search-result-item');
            if (item && window._searchResults) {
                const index = parseInt(item.dataset.index);
                if (window._searchResults[index]) {
                    window._searchResults[index].action();
                    results.style.display = 'none';
                    document.getElementById('global-search-input').value = '';
                }
            }
        };
        results.addEventListener('click', clickHandler);
        results._clickHandler = clickHandler; // Store for cleanup
    }

    results.style.display = 'block';
}

/**
 * Escapa caracteres especiales de regex para prevenir ReDoS
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHTML(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Highlights matching text in results (SEGURO contra XSS y ReDoS)
 */
function highlightMatch(text, query) {
    if (!text || !query) return escapeHTML(text);
    // Escapar HTML primero, luego aplicar highlight de forma segura
    const safeText = escapeHTML(text);
    const safeQuery = escapeRegex(query);
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    return safeText.replace(regex, '<strong style="color: #667eea;">$1</strong>');
}
