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
 *  - /intelligence/price-drift  → deriva sostenida: el escandallo usa un precio
 *                                 viejo vs la media real de 90 días (caso tomate)
 *  - window.ingredientes        → stock crítico (<= mínimo)
 *  - window.pedidos             → subidas de precio (último vs anterior)
 *
 * Niveles: 'critico' (🔴) > 'atencion' (🟠) > 'oportunidad' (🟢).
 */

import { t } from '@/i18n/index.js';
import { cm, formatDate } from '../../utils/helpers.js';

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

/**
 * Resume la respuesta de /intelligence/supplies-overstock en UN solo aviso.
 *
 * Los suministros no están en ninguna receta, así que vender no los descuenta:
 * solo entran, nunca salen. Cuando el problema es sistémico —en La Nave 5, 45 de
 * 54 sin bajar una unidad en 90 días— sacar un aviso por ingrediente daría 20
 * tarjetas idénticas que nadie lee. Un único aviso con los 3 que más dinero
 * acumulan dice lo mismo y sí se lee.
 *
 * Devuelve null cuando no hay nada que avisar, para que el feed no muestre
 * tarjeta vacía.
 *
 * @param {object|null} data - respuesta del endpoint (null si el backend aún no lo tiene)
 * @returns {{valorExceso:number, nAlertas:number, nTotal:number, nuncaContados:number, top:Array, peorId:number|null}|null}
 */
export function resumirSuministros(data) {
    const alertas = (data && Array.isArray(data.alertas)) ? data.alertas : [];
    if (alertas.length === 0) return null;

    const valorExceso = Number.isFinite(parseFloat(data.valor_exceso_total))
        ? parseFloat(data.valor_exceso_total)
        : alertas.reduce((s, a) => s + (parseFloat(a.valor_exceso) || 0), 0);

    // Sin dinero detrás no hay aviso: evita ruido en tenants que apenas registran material.
    if (!(valorExceso > 0)) return null;

    return {
        valorExceso,
        nAlertas: alertas.length,
        nTotal: parseInt(data.n_suministros_con_stock, 10) || alertas.length,
        nuncaContados: parseInt(data.nunca_contados, 10) || 0,
        top: alertas.slice(0, 3).map(a => a.nombre).filter(Boolean),
        peorId: Number.isFinite(Number(alertas[0]?.id)) ? Number(alertas[0].id) : null,
    };
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

    const [price, fresh, over, drift, supplies, entradas] = await Promise.all([
        fetchIntelligence('price-check'),
        fetchIntelligence('freshness'),
        fetchIntelligence('overstock'),
        fetchIntelligence('price-drift'), // null si el backend aún no lo tiene (degrada sin romper)
        fetchIntelligence('supplies-overstock'), // idem
        fetchIntelligence('unregistered-entries'), // idem
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

    // 3bis) 🔴/🟠 Deriva de precio sostenida ("caso tomate"): el food cost usa la
    // media histórica; si llevas 90 días comprando bastante más caro, el escandallo
    // enseña un margen mejor que el real. Umbrales y filtros anti-ruido viven en el
    // backend (computePriceDrift): sostenido (>=3 compras) + alto gasto (>=100 €).
    const derivas = (drift && Array.isArray(drift.alertas)) ? drift.alertas : [];
    derivas.slice(0, max).forEach((d) => {
        const recetasTxt = (Number.isFinite(d.recetas_afectadas) && d.recetas_afectadas > 0)
            ? ' ' + t('inteligencia:omnes_x_deriva_recetas', { n: d.recetas_afectadas })
            : '';
        avisos.push({
            id: `deriva-${d.id}`,
            categoria: 'deriva',
            nivel: (d.desviacion_pct >= 30) ? 'critico' : 'atencion',
            icono: '🔺',
            titulo: t('inteligencia:omnes_t_deriva'),
            texto: t('inteligencia:omnes_x_deriva', {
                nombre: d.nombre,
                app: cm(d.precio_app),
                real: cm(d.media_90d),
                unidad: d.unidad || 'ud',
                pct: (d.desviacion_pct || 0).toFixed(0),
                impacto: cm(d.impacto_mes),
            }) + recetasTxt,
            cta: mkCta('ingrediente', d.id, t('inteligencia:omnes_cta_ver_ingrediente')),
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

    // 5bis) 🧹 Suministros acumulados — UN solo aviso, no uno por ingrediente.
    // El material no comestible no está en ninguna receta: vender no lo descuenta,
    // así que su stock solo puede subir y acaba midiendo lo comprado desde el
    // primer día, no lo que hay en el almacén. La app no puede corregirlo sola
    // (no sabe cuántos guantes quedan en el cajón), así que empuja al recuento.
    const resumenSum = resumirSuministros(supplies);
    if (resumenSum) {
        const detalle = resumenSum.top.length > 0
            ? ' ' + t('inteligencia:omnes_x_suministros_top', { lista: resumenSum.top.join(', ') })
            : '';
        avisos.push({
            id: 'suministros-acumulados',
            categoria: 'suministros',
            nivel: 'atencion',
            icono: '🧹',
            titulo: t('inteligencia:omnes_t_suministros'),
            texto: t('inteligencia:omnes_x_suministros', {
                n: resumenSum.nAlertas,
                total: resumenSum.nTotal,
                valor: cm(resumenSum.valorExceso),
            }) + detalle,
            cta: mkCta('inventario', resumenSum.peorId, t('inteligencia:omnes_cta_hacer_recuento')),
        });
    }

    // 6) 📥 Entradas sin registrar: producto que se sirvió y se cobró con el stock
    // ya a 0, así que nunca salió del inventario (el descuento no baja de cero por
    // regla de negocio). Si se repite, es que las ENTRADAS de ese producto no se
    // están registrando (caso PAN: entra cada mañana y nadie lo recepciona).
    // Aquí SÍ va un aviso por producto (a diferencia de suministros): cada uno es
    // una acción distinta y el CTA lleva a su ficha. Umbrales y anti-ruido viven
    // en el backend (computeUnregisteredEntries).
    const sinRegistrar = (entradas && Array.isArray(entradas.alertas)) ? entradas.alertas : [];
    sinRegistrar.slice(0, max).forEach((e) => {
        avisos.push({
            id: `entrada-${e.id}`,
            categoria: 'entradas',
            nivel: 'atencion',
            icono: '📥',
            titulo: t('inteligencia:omnes_t_entrada_sin_registrar'),
            texto: t('inteligencia:omnes_x_entrada_sin_registrar', {
                nombre: e.nombre,
                ventas: e.n_ventas,
                uds: fmtCant(e.uds_sin_descontar),
                unidad: e.unidad || 'ud',
                importe: cm(e.importe_eur),
                desde: formatDate(e.primera),
            }),
            cta: mkCta('ingrediente', e.id, t('inteligencia:omnes_cta_ver_ingrediente')),
        });
    });

    avisos.sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]);
    return avisos;
}
