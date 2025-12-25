/**
 * ⚡ Optimización de Búsquedas - MindLoop CostOS
 *
 * Añade debouncing a los inputs de búsqueda para mejorar rendimiento
 *
 * @copyright MindLoopIA
 * @version 2.1.0
 */

import { debounce } from './helpers.js';

/**
 * Inicializa optimizaciones de búsqueda con debouncing
 */
export function initSearchOptimizations() {
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupSearchDebouncing);
    } else {
        setupSearchDebouncing();
    }
}

/**
 * Configura debouncing en inputs de búsqueda
 */
function setupSearchDebouncing() {
    // Ingredientes
    const busquedaIngredientes = document.getElementById('busqueda-ingredientes');
    if (busquedaIngredientes) {
        // Remover evento inline si existe
        busquedaIngredientes.removeAttribute('oninput');

        // Añadir debouncing de 300ms
        const debouncedRender = debounce(() => {
            if (typeof window.renderizarIngredientes === 'function') {
                window.renderizarIngredientes();
            }
        }, 300);

        busquedaIngredientes.addEventListener('input', debouncedRender);
    }

    // Recetas (si existe)
    const busquedaRecetas = document.getElementById('busqueda-recetas');
    if (busquedaRecetas) {
        busquedaRecetas.removeAttribute('oninput');

        const debouncedRender = debounce(() => {
            if (typeof window.renderizarRecetas === 'function') {
                window.renderizarRecetas();
            }
        }, 300);

        busquedaRecetas.addEventListener('input', debouncedRender);
    }

    // Proveedores (si existe)
    const busquedaProveedores = document.getElementById('busqueda-proveedores');
    if (busquedaProveedores) {
        busquedaProveedores.removeAttribute('oninput');

        const debouncedRender = debounce(() => {
            if (typeof window.renderizarProveedores === 'function') {
                window.renderizarProveedores();
            }
        }, 300);

        busquedaProveedores.addEventListener('input', debouncedRender);
    }

    // Pedidos (si existe)
    const busquedaPedidos = document.getElementById('busqueda-pedidos');
    if (busquedaPedidos) {
        busquedaPedidos.removeAttribute('oninput');

        const debouncedRender = debounce(() => {
            if (typeof window.renderizarPedidos === 'function') {
                window.renderizarPedidos();
            }
        }, 300);

        busquedaPedidos.addEventListener('input', debouncedRender);
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.initSearchOptimizations = initSearchOptimizations;
}
