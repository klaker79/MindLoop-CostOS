/**
 * Omnes — Avisos proactivos (pestaña "Omnes", antes "Inteligencia").
 *
 * Construye un FEED de avisos DETERMINISTAS sobre datos reales (sin IA que
 * invente → sin ruido ni errores). Omnes pone la voz (copy plantilla i18n),
 * los números los pone el sistema. Cada aviso solo aparece si supera su umbral.
 *
 * Fuentes (todas ya existentes):
 *  - /intelligence/price-check  → recetas no rentables (food cost alto)
 *  - /intelligence/freshness    → frescura / caducidad de frescos
 *  - /intelligence/overstock    → sobrestock
 *  - window.ingredientes        → stock crítico (<= mínimo)
 *  - window.pedidos             → subidas de precio (último vs anterior)
 *
 * Niveles: 'critico' (🔴) > 'atencion' (🟠) > 'oportunidad' (🟢).
 */

import { t } from '@/i18n/index.js';
import { cm } from '../../utils/helpers.js';

// Umbrales (un aviso SOLO se muestra si supera su umbral → anti-ruido).
export const UMBRALES = {
    subidaPrecioPct: 8,   // % de subida en la última compra para avisar
    maxPorTipo: 5,        // máximo de avisos por categoría (no saturar)
};

const ORDEN_NIVEL = { critico: 0, atencion: 1, oportunidad: 2 };

// ─────────────────────────────────────────────────────────────
// CÁLCULOS PUROS (testeables)
// ─────────────────────────────────────────────────────────────

/**
 * Subidas de precio: agrupa precios por ingrediente de los últimos 30 pedidos
 * recibidos, compara último vs anterior y devuelve SOLO las subidas >= umbral.
 * Misma fuente y lógica que el KPI cambios-precio del dashboard.
 */
export function calcularSubidasPrecio(pedidos, ingMap, umbralPct = UMBRALES.subidaPrecioPct) {
    const recibidos = (pedidos || [])
        .filter(p => p.estado === 'recibido' && Array.isArray(p.ingredientes) && p.ingredientes.length)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 30);

    const porIng = {};
    recibidos.forEach(ped => {
        (ped.ingredientes || []).forEach(item => {
            if (item.personal === true) return; // comida personal no es precio de compra
            const id = item.ingredienteId || item.ingrediente_id;
            const precio = parseFloat(item.precioReal || item.precio_unitario || item.precio || 0);
            if (!porIng[id]) porIng[id] = [];
            porIng[id].push(precio);
        });
    });

    const subidas = [];
    Object.entries(porIng).forEach(([id, precios]) => {
        if (precios.length < 2) return;
        const ultimo = precios[0];
        const anterior = precios[1];
        const ing = ingMap.get(parseInt(id));
        if (!ing || !(anterior > 0)) return;
        const pct = ((ultimo - anterior) / anterior) * 100;
        if (pct >= umbralPct) {
            subidas.push({ id: ing.id, nombre: ing.nombre, anterior, ultimo, pct, unidad: ing.unidad || '' });
        }
    });
    return subidas.sort((a, b) => b.pct - a.pct);
}

/**
 * Stock crítico. MISMA regla canónica que el KPI Stock Bajo (stock-bajo.js):
 *   stock_actual === 0  OR  (minimo > 0 AND stock <= minimo)
 * stock_actual null/undefined = no registrado → NO es alerta.
 */
export function calcularStockCritico(ingredientes) {
    const out = [];
    (ingredientes || []).forEach(i => {
        if (i.deleted_at) return;
        if (i.activo === false) return;
        if (i.stock_actual === null || i.stock_actual === undefined) return;
        const stock = parseFloat(i.stock_actual) || 0;
        const min = parseFloat(i.stock_minimo) || parseFloat(i.stockMinimo) || 0;
        const incluir = stock === 0 || (min > 0 && stock <= min);
        if (incluir) {
            out.push({ id: i.id, nombre: i.nombre, stock, min, unidad: i.unidad || '', cero: stock <= 0 });
        }
    });
    // Primero los que están a 0, luego el resto.
    return out.sort((a, b) => (a.cero === b.cero ? 0 : a.cero ? -1 : 1));
}

// ─────────────────────────────────────────────────────────────
// "PREGÚNTALE A OMNES" — convierte un aviso en una pregunta de chat
// ─────────────────────────────────────────────────────────────

/**
 * El texto del aviso viene de t() con escapeValue (entidades HTML) y puede
 * llevar etiquetas. Para meterlo en el input del chat lo dejamos en texto plano:
 * quita tags, decodifica entidades comunes + numéricas, y colapsa espacios.
 */
export function limpiarTextoAviso(texto) {
    if (typeof texto !== 'string') return '';
    let s = texto;
    // Quitar etiquetas con el parser del navegador (NO con regex de tags: ese
    // patrón lo marca CodeQL como "incomplete multi-character sanitization").
    // textContent decodifica además las entidades HTML del aviso.
    if (typeof window !== 'undefined' && window.DOMParser) {
        s = new window.DOMParser().parseFromString(s, 'text/html').body.textContent || '';
    }
    // Texto plano para el input del chat: fuera cualquier '<'/'>' residual
    // (garantiza que no quede ninguna secuencia tipo "<script"). Nunca se
    // inyecta como HTML, pero así la sanitización es total y verificable.
    return s.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Construye la pregunta que se manda al chat al pulsar "Pregúntale a Omnes".
 * @param {object} aviso  - { categoria, texto }
 * @param {object} frases - textos i18n: { prefix, recetas, stock, precio, frescura, sobrestock, default }
 */
export function buildOmnesQuestion(aviso, frases) {
    const f = frases || {};
    const texto = limpiarTextoAviso(aviso && aviso.texto);
    const seguimiento = f[aviso && aviso.categoria] || f.default || '';
    return `${f.prefix || ''}"${texto}". ${seguimiento}`.trim();
}

// ─────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL FEED (async — junta señales y arma los avisos)
// ─────────────────────────────────────────────────────────────

function fmtCant(n) {
    const v = parseFloat(n);
    return Number.isFinite(v) ? (Math.round(v * 100) / 100).toString().replace('.', ',') : '0';
}

/**
 * @param {object} deps - { fetchIntelligence, ingredientes, pedidos }
 * @returns {Promise<Array>} avisos [{ id, nivel, icono, titulo, texto, cta }]
 */
export async function construirAvisos(deps) {
    const { fetchIntelligence } = deps;
    const ingredientes = Array.isArray(deps.ingredientes) ? deps.ingredientes : [];
    const pedidos = Array.isArray(deps.pedidos) ? deps.pedidos : [];
    const ingMap = new Map(ingredientes.map(i => [i.id, i]));
    const max = UMBRALES.maxPorTipo;

    const [price, fresh, over] = await Promise.all([
        fetchIntelligence('price-check'),
        fetchIntelligence('freshness'),
        fetchIntelligence('overstock'),
    ]);

    const avisos = [];

    // CTA con deep-link: tipo + id del item concreto. Solo se adjunta si hay id válido
    // (si no, la tarjeta se muestra sin botón en vez de llevar a ningún sitio).
    //   'receta'      → abre la ficha de la receta (window.editarReceta)
    //   'ingrediente' → abre la ficha del ingrediente (window.editarIngrediente)
    //   'pedido'      → añade el ingrediente al carrito de pedidos (window.agregarAlCarrito)
    const mkCta = (tipo, id, label) =>
        Number.isFinite(Number(id)) ? { label, tipo, id: Number(id) } : null;

    // 1) 🔴 Recetas que no rentan (food cost alto + precio sugerido)
    const recetasProblema = (price && Array.isArray(price.recetas_problema)) ? price.recetas_problema : [];
    recetasProblema.slice(0, max).forEach((r, i) => {
        avisos.push({
            id: `receta-${r.id ?? i}`,
            categoria: 'recetas',
            nivel: 'critico',
            icono: '📉',
            titulo: t('inteligencia:omnes_t_receta_no_renta'),
            texto: t('inteligencia:omnes_x_receta_no_renta', { nombre: r.nombre, fc: r.food_cost, precio: cm(r.precio_sugerido) }),
            cta: mkCta('receta', r.id, t('inteligencia:omnes_cta_ajustar_precio')),
        });
    });

    // 2) 🔴/🟠 Stock crítico
    calcularStockCritico(ingredientes).slice(0, max).forEach((s) => {
        avisos.push({
            id: `stock-${s.id}`,
            categoria: 'stock',
            nivel: s.cero ? 'critico' : 'atencion',
            icono: '📦',
            titulo: t('inteligencia:omnes_t_stock_critico'),
            texto: s.cero
                ? t('inteligencia:omnes_x_stock_cero', { nombre: s.nombre })
                : t('inteligencia:omnes_x_stock_bajo', { nombre: s.nombre, stock: fmtCant(s.stock), unidad: s.unidad, min: fmtCant(s.min) }),
            cta: mkCta('pedido', s.id, t('inteligencia:omnes_cta_pedir')),
        });
    });

    // 3) 🟠 Subidas de precio en la última compra
    calcularSubidasPrecio(pedidos, ingMap).slice(0, max).forEach((p) => {
        avisos.push({
            id: `precio-${p.id}`,
            categoria: 'precio',
            nivel: 'atencion',
            icono: '📈',
            titulo: t('inteligencia:omnes_t_precio_sube'),
            texto: t('inteligencia:omnes_x_precio_sube', {
                nombre: p.nombre, pct: p.pct.toFixed(0),
                antes: cm(p.anterior), ahora: cm(p.ultimo), unidad: p.unidad,
            }),
            cta: mkCta('ingrediente', p.id, t('inteligencia:omnes_cta_ver_ingrediente')),
        });
    });

    // 4) 🟠/🔴 Frescura / caducidad de frescos
    (Array.isArray(fresh) ? fresh : []).slice(0, max).forEach((f, i) => {
        const critico = f.urgencia === 'critico';
        avisos.push({
            id: `fresh-${f.id ?? i}`,
            categoria: 'frescura',
            nivel: critico ? 'critico' : 'atencion',
            icono: '🧊',
            titulo: t('inteligencia:omnes_t_frescura'),
            texto: t('inteligencia:omnes_x_frescura', {
                stock: fmtCant(f.stock_actual), unidad: f.unidad, nombre: f.nombre,
                dias: f.dias_desde_compra || 0,
            }),
            cta: mkCta('ingrediente', f.id, t('inteligencia:omnes_cta_ver_ingrediente')),
        });
    });

    // 5) 🟠 Sobrestock
    (Array.isArray(over) ? over : []).slice(0, max).forEach((o, i) => {
        avisos.push({
            id: `over-${o.id ?? i}`,
            categoria: 'sobrestock',
            nivel: 'atencion',
            icono: '🗄️',
            titulo: t('inteligencia:omnes_t_sobrestock'),
            texto: t('inteligencia:omnes_x_sobrestock', {
                nombre: o.nombre, stock: fmtCant(o.stock_actual), unidad: o.unidad,
                dias: Math.round(o.dias_stock || 0),
            }),
            cta: mkCta('ingrediente', o.id, t('inteligencia:omnes_cta_ver_ingrediente')),
        });
    });

    avisos.sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]);
    return avisos;
}
