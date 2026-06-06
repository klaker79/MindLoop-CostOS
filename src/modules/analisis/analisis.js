/**
 * Orchestrator del módulo Análisis (Ingeniería de Menú v2).
 *
 * Estrategia de migración (Iker 2026-06-05):
 *   D2 — esta función inserta el dashboard sintético + filtro periodo
 *        ARRIBA del BCG existente, sin tocar el legacy `renderizarAnalisis`.
 *        El legacy sigue renderizando charts, tabla y BCG. Esta capa nueva
 *        es aditiva: si falla por cualquier motivo (caché vieja, JS error),
 *        el cliente sigue viendo el módulo viejo intacto.
 *   D3 — se reemplaza el BCG legacy por el módulo nuevo (con scatter +
 *        listas refactorizadas).
 *   D4 — se añade el modal drill-down.
 *   D5 — se añade el bloque Principios de Omnes debajo del BCG.
 *
 * Hooks de entrada:
 *   `window.mlAnalisisOnRender(menuEngineeringData)` — el shim del legacy
 *     llama a esta función después de renderizar el BCG. Pasa el array
 *     que devuelve `/menu-engineering` (ya tiene `clasificacion` por plato).
 */

import './styles.css';
import { renderDashboardSintetico, contarCategorias } from './dashboard-sintetico.js';
import { renderMatrizBCG } from './matriz-bcg.js';
import './plato-modal.js'; // auto-registra listener `analisis:plato-click`
import { getMenuEngineering, getPeriodo, setMedias } from './analisis-state.js';
import { calcularMediasMenu } from './recomendaciones-plato.js';

const HOST_ID = 'analisis-dashboard-sintetico';

function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    // Insertar arriba del BCG existente. Si el BCG no existe (cliente
    // que aún no carga el legacy), montamos al inicio de #analisis-contenido.
    const bcgMatrix = document.getElementById('bcg-matrix-container');
    const contenido = document.getElementById('analisis-contenido');
    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'chart-card';
    host.style.marginBottom = '16px';
    if (bcgMatrix && bcgMatrix.parentNode) {
        bcgMatrix.parentNode.insertBefore(host, bcgMatrix);
    } else if (contenido) {
        contenido.insertBefore(host, contenido.firstChild);
    }
    return host;
}

/**
 * Repinta el dashboard sintético sobre el host. Reutiliza un callback
 * estable (no recursivo via arguments.callee — incompatible con ES modules).
 */
function pintar(host, counts) {
    renderDashboardSintetico(host, { counts }, onPeriodoChange);
}

async function onPeriodoChange() {
    const host = ensureHost();
    if (!host) return;
    try {
        const data = await getMenuEngineering({ force: true });
        setMedias(calcularMediasMenu(data));
        // Matriz BCG v2 (oculta el contenedor legacy automáticamente).
        try { renderMatrizBCG(data); } catch (e) { console.warn('[analisis] BCGv2 falló (no bloqueante):', e?.message); }
        pintar(host, contarCategorias(data));
    } catch (err) {
        console.warn('[analisis] error refrescando BCG:', err?.message);
    }
}

/**
 * Llamada por el legacy tras renderizar la matriz BCG.
 *
 * @param {Array} menuEngineeringData - response de /analysis/menu-engineering
 */
async function onRender(menuEngineeringData) {
    const host = ensureHost();
    if (!host) return;
    // Calcula y guarda medias para que el modal drill-down las use sin recalcular.
    setMedias(calcularMediasMenu(menuEngineeringData));
    pintar(host, contarCategorias(menuEngineeringData));
    // D3: renderizar BCG v2 y ocultar el contenedor legacy. Si falla, el
    // legacy sigue visible (ocultarLegacy solo se invoca tras render OK).
    try { renderMatrizBCG(menuEngineeringData); } catch (e) {
        console.warn('[analisis] BCGv2 falló (no bloqueante):', e?.message);
    }
}

if (typeof window !== 'undefined') {
    window.mlAnalisisOnRender = onRender;
    window.mlAnalisisGetPeriodo = getPeriodo;
}

export { onRender };
