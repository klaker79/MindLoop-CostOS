/**
 * Action Dropdown — botón con menú colgante reutilizable.
 *
 * Patrón:
 *   <div class="ad-wrapper">
 *     <button class="btn btn-secondary ad-trigger">📊 Importar / Exportar ▾</button>
 *     <div class="ad-menu" role="menu" hidden>
 *       <a href="..." download role="menuitem">📥 Descargar plantilla</a>
 *       <button data-action="..." role="menuitem">📤 Importar Excel</button>
 *       <button data-action="..." role="menuitem">📥 Exportar Excel</button>
 *     </div>
 *   </div>
 *
 * Comportamiento:
 *   - Click en .ad-trigger → toggle del menú.
 *   - Click fuera → cierra cualquier menú abierto.
 *   - Esc → cierra.
 *   - Al pulsar un item del menú, se cierra automáticamente
 *     (excepto en enlaces de descarga, que se cierran tras el browser
 *     iniciar la descarga).
 *
 * Iker (2026-06-08): rediseño UX para no saturar al cliente con 6 botones.
 * Patrón Notion / Linear / Figma: dropdown único para agrupar acciones
 * relacionadas.
 */

const OPEN_CLASS = 'ad-open';

function closeAllDropdowns(except = null) {
    document.querySelectorAll('.ad-wrapper.' + OPEN_CLASS).forEach(w => {
        if (w !== except) {
            w.classList.remove(OPEN_CLASS);
            const menu = w.querySelector('.ad-menu');
            if (menu) menu.hidden = true;
            const trigger = w.querySelector('.ad-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

function bindWrapper(wrapper) {
    if (wrapper.dataset.adBound === '1') return;
    wrapper.dataset.adBound = '1';

    const trigger = wrapper.querySelector('.ad-trigger');
    const menu = wrapper.querySelector('.ad-menu');
    if (!trigger || !menu) return;

    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = wrapper.classList.contains(OPEN_CLASS);
        closeAllDropdowns(isOpen ? null : wrapper);
        if (isOpen) {
            wrapper.classList.remove(OPEN_CLASS);
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
        } else {
            wrapper.classList.add(OPEN_CLASS);
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
        }
    });

    // Click en cualquier item del menú lo cierra (tras un microtask para
    // que el handler del click llegue a su destino).
    menu.querySelectorAll('[role="menuitem"]').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(() => closeAllDropdowns(), 50);
        });
    });
}

export function mountActionDropdowns() {
    document.querySelectorAll('.ad-wrapper').forEach(bindWrapper);
}

// Click fuera y Esc — bindeo global, una sola vez.
if (typeof document !== 'undefined' && !document.__adGlobalBound) {
    document.__adGlobalBound = true;
    document.addEventListener('click', () => closeAllDropdowns());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDropdowns(); });
}

// Auto-mount al cargar (los wrappers creados después necesitan mountActionDropdowns()).
if (typeof window !== 'undefined') {
    window.mountActionDropdowns = mountActionDropdowns;
}
