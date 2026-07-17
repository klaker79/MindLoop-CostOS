/**
 * Navegación móvil enfocada — CosteOS.
 *
 * Portada móvil (Inicio) = dos botones grandes: Nuevo pedido (voz) y Recibir
 * albarán (foto). El dashboard vive en su propio botón (Panel). Barra inferior:
 * Inicio · Panel · Pedidos · Más.
 *
 * 100% aditivo y responsive: en escritorio los elementos están ocultos por CSS,
 * así que este módulo es inerte. Reutiliza window.cambiarTab() y el sidebar
 * off-canvas que ya existen; nunca los reemplaza.
 */

// Pestaña activa → botón de la barra que se enciende (cuando NO estamos en Inicio).
// Barra = destinos: Inicio · Pedidos · Recibir · Más. "Recibir" es una acción
// (abre la cámara), no una pestaña, así que no aparece aquí.
const TAB_TO_NAV = {
    pedidos: 'pedidos',
};

function setNavActive(name) {
    document.querySelectorAll('.ml-bottomnav button[data-mnav]').forEach((b) => {
        b.classList.toggle('active', b.dataset.mnav === name);
    });
}

/** Muestra la portada de Inicio (2 botones). */
function mostrarHome() {
    document.body.classList.add('ml-home-active');
    setNavActive('inicio');
    // Rellena "qué me falta" + "volver a pedir" con los datos actuales.
    window.renderMobileHome?.();
}

/** Sale de la portada (deja ver el contenido de la app). */
function salirHome() {
    document.body.classList.remove('ml-home-active');
}

/** Sincroniza la barra según la pestaña activa (si no estamos en Inicio). */
function syncNavFromTab(tab) {
    if (document.body.classList.contains('ml-home-active')) {
        setNavActive('inicio');
        return;
    }
    setNavActive(TAB_TO_NAV[tab] || null);
}

/** Sale de Inicio y navega a una pestaña real. */
function irATab(tab) {
    salirHome();
    if (typeof window.cambiarTab === 'function') window.cambiarTab(tab);
}

/**
 * Placeholder de la recepción por foto. La Pieza B (cámara → /parse-albaran) lo
 * reemplaza. Aquí solo avisamos para no dejar un botón muerto.
 */
function recibirAlbaranPlaceholder() {
    if (typeof window.showToast === 'function') {
        window.showToast('La cámara para recibir albaranes llega en el siguiente paso.', 'info');
    }
}

export function initMobileNav() {
    if (typeof window.mlRecibirAlbaran !== 'function') {
        window.mlRecibirAlbaran = recibirAlbaranPlaceholder;
    }

    // Barra inferior
    document.querySelectorAll('.ml-bottomnav button[data-mnav]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const a = btn.dataset.mnav;
            if (a === 'inicio') mostrarHome();
            else if (a === 'pedidos') irATab('pedidos');
            else if (a === 'recibir') window.mlRecibirAlbaran?.();   // trabajo nº2: foto del albarán
            else if (a === 'mas') document.getElementById('sidebar')?.classList.add('open');
        });
    });

    // Botones grandes de la portada
    document.querySelector('[data-mact="nuevo-pedido"]')?.addEventListener('click', () => {
        salirHome();
        if (typeof window.mlNuevoPedido === 'function') window.mlNuevoPedido();
        else irATab('pedidos');
    });
    document.querySelector('[data-mact="recibir-albaran"]')?.addEventListener('click', () => window.mlRecibirAlbaran?.());

    // Envolver cambiarTab (conservando el original): navegar a una pestaña = salir
    // de Inicio y sincronizar la barra, venga la navegación de donde venga.
    if (typeof window.cambiarTab === 'function' && !window.cambiarTab.__mlWrapped) {
        const original = window.cambiarTab;
        const wrapped = function (tab) {
            salirHome();
            const r = original.apply(this, arguments);
            try { syncNavFromTab(tab); } catch { /* no-op */ }
            return r;
        };
        wrapped.__mlWrapped = true;
        window.cambiarTab = wrapped;
    }

    // Arranque: en móvil, la portada de 2 botones es la primera pantalla.
    // En escritorio esta clase es inerte (el CSS solo la usa dentro de @media 768).
    mostrarHome();
}
