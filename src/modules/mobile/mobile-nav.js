/**
 * Navegación móvil enfocada (Pieza A) — CosteOS.
 *
 * Añade barra inferior (Inicio · Pedidos · Recibir · Más) y las dos acciones
 * grandes de la portada. NO duplica vistas: reutiliza window.cambiarTab() y el
 * sidebar off-canvas que ya existen. Solo actúa en móvil (los elementos están
 * ocultos por CSS en escritorio), así que en ordenador es inerte.
 */

// Mapa: pestaña activa → botón de la barra inferior que debe encenderse.
const TAB_TO_NAV = {
    ingredientes: 'inicio',
    pedidos: 'pedidos',
};

function syncBottomNav(tab) {
    const target = TAB_TO_NAV[tab] || null;
    document.querySelectorAll('.ml-bottomnav button[data-mnav]').forEach((b) => {
        b.classList.toggle('active', b.dataset.mnav === target);
    });
}

function irA(tab) {
    if (typeof window.cambiarTab === 'function') window.cambiarTab(tab);
}

/**
 * Placeholder de la recepción por foto. La Pieza B (cámara → /parse-albaran)
 * reemplaza esta función. Aquí solo avisamos para no dejar un botón muerto.
 */
function recibirAlbaranPlaceholder() {
    if (typeof window.showToast === 'function') {
        window.showToast('La cámara para recibir albaranes llega en el siguiente paso.', 'info');
    }
}

export function initMobileNav() {
    // Placeholder global (la Pieza B lo sobrescribe con la cámara real).
    if (typeof window.mlRecibirAlbaran !== 'function') {
        window.mlRecibirAlbaran = recibirAlbaranPlaceholder;
    }

    // Barra inferior
    document.querySelectorAll('.ml-bottomnav button[data-mnav]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const a = btn.dataset.mnav;
            if (a === 'inicio') irA('ingredientes');
            else if (a === 'pedidos') irA('pedidos');
            else if (a === 'recibir') window.mlRecibirAlbaran?.();
            else if (a === 'mas') document.getElementById('sidebar')?.classList.add('open');
        });
    });

    // Acciones grandes de la portada
    document.querySelector('[data-mact="nuevo-pedido"]')?.addEventListener('click', () => irA('pedidos'));
    document.querySelector('[data-mact="recibir-albaran"]')?.addEventListener('click', () => window.mlRecibirAlbaran?.());

    // Mantener la barra inferior sincronizada con la navegación, venga de donde
    // venga (sidebar, checklist, alertas…). Envolvemos cambiarTab conservando el
    // original — nunca lo reemplazamos.
    if (typeof window.cambiarTab === 'function' && !window.cambiarTab.__mlWrapped) {
        const original = window.cambiarTab;
        const wrapped = function (tab) {
            const r = original.apply(this, arguments);
            try { syncBottomNav(tab); } catch { /* no-op */ }
            return r;
        };
        wrapped.__mlWrapped = true;
        window.cambiarTab = wrapped;
    }

    // Estado inicial (la app arranca en 'ingredientes').
    syncBottomNav('ingredientes');
}
