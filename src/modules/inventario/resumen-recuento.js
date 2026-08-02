/**
 * 🧾 Resumen del recuento físico — cabecera del modal "Confirmar Mermas".
 *
 * QUÉ HACE: antes de guardar, enseña en cristiano lo que se acaba de contar —
 * cuántos ingredientes, cuáles tienen menos de lo esperado y cuáles más— y
 * señala las líneas que parecen un dedazo.
 *
 * POR QUÉ AQUÍ Y NO EN UNA PANTALLA FIJA: el modal es el ÚNICO momento en que
 * todavía se puede corregir. Una vez confirmado, la diferencia se escribe en
 * `inventory_snapshots_v2`, se reparte en `inventory_adjustments_v2` y —desde
 * 2026-08-01— la parte que falta viaja también a `mermas`, así que **aparece en
 * los informes y en Omnes**. Un 0 tecleado por error deja de ser invisible y
 * pasa a contar como dinero perdido. De ahí que avisar ANTES valga más que
 * cualquier panel a posteriori.
 *
 * DECISIONES DE PRESENTACIÓN (Iker, 2026-08-02):
 *  - La CANTIDAD manda, el dinero acompaña en gris. Un cocinero reconoce
 *    "1.416 → 0 unidades" mucho antes que "−1.416,75 €", y si el euro domina la
 *    pantalla un error de tecleo parece una catástrofe económica.
 *  - Nada de porcentajes de desviación ni semáforos: con recuentos por zonas
 *    esos números mienten (se cuenta lo que ya se sospecha descuadrado).
 *  - Informativo, nunca bloqueante. No impide guardar: solo hace mirar.
 */

import { cm, escapeHTML } from '../../utils/helpers.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { t } from '@/i18n/index.js';

/**
 * Umbrales del aviso "¿seguro?".
 *
 * ⚠️ CALIBRADOS CON DATOS REALES (2026-08-02), no a ojo. Con los primeros valores
 * —cualquier cero, o 200 €, o el 90% de merma, en OR— saltaban **96 de las 150**
 * líneas de recuento de La Nave 5 de los últimos 120 días. Un aviso que salta el
 * 64% de las veces no es un aviso: es ruido, y se deja de leer.
 *
 * Una merma grande NO es lo mismo que una diferencia absurda. En un restaurante
 * de marisco, gastar 7 de 8 kg de percebes o 24 de 30 kg de ameixas es un martes
 * cualquiera; que desaparezcan 716 de 746 kg de pulpo, no.
 *
 * Por eso el criterio pasa a ser Y en vez de O: hace falta que se esfume casi
 * todo **y además** tenga peso económico. La única excepción es una cifra tan
 * bestia que merece mirarse aunque proporcionalmente sea poco.
 *
 * Con estos valores saltan 27 de 150 (18%), y son las que se ven a la legua:
 *   PULPO 746 → 30 (12.536 €) · COSTELA 259 → 10 · VERDURA y PAN a cero.
 * Quedan fuera, correctamente: AMEIXAS 30 → 6 · PERCEBES 8 → 1 · OSTRAS 540 → 200.
 * Esas siguen viéndose en la tabla de reparto de abajo, como cualquier otra.
 */
export const UMBRALES_RECUENTO = {
    // Se esfumó casi todo lo que había (incluye poner a 0, que es fracción = 1).
    fraccionAlta: 0.9,
    // …Y además mueve dinero. Sin esto, vaciar una caja de perejil daba aviso.
    importeMinimoFraccion: 150,
    // Excepción: tanto dinero que hay que mirarlo aunque proporcionalmente sea poco
    // (media merluza de un lote grande, azafrán, marisco caro…).
    importeExtremo: 800,
};

/**
 * Redondea a 2 decimales normalizando el -0 de JavaScript. Sin esto, una línea
 * sin precio configurado pinta "−0,00 €", que parece un error de la app.
 */
function eur(n) {
    const v = Math.round((parseFloat(n) || 0) * 100) / 100;
    return v === 0 ? 0 : v;
}

/** Cantidades legibles: 12.00 → 12 · 0.750 → 0,75 */
export function fmtCant(n) {
    const v = parseFloat(n);
    if (!Number.isFinite(v)) return '0';
    return (Math.round(v * 1000) / 1000).toString().replace('.', ',');
}

/**
 * Construye el resumen a partir de las líneas que el usuario acaba de teclear.
 *
 * @param {Array} snapshots - [{ id, stock_virtual, stock_real }] tal como los arma
 *                            guardarCambiosStock en el legacy.
 * @param {object} deps - { ingredientes: [], inventario: [] } (window.ingredientes /
 *                          window.inventarioCompleto). Se pasan por parámetro para
 *                          poder testear sin DOM ni globals.
 * @param {object} [umbrales] - override de UMBRALES_RECUENTO.
 * @returns {{contados:number, faltan:number, sobran:number, importeFalta:number,
 *            importeSobra:number, importeNeto:number, lineas:Array, sospechosas:Array}}
 */
export function construirResumenRecuento(snapshots, deps = {}, umbrales = UMBRALES_RECUENTO) {
    const ingredientes = Array.isArray(deps.ingredientes) ? deps.ingredientes : [];
    const inventario = Array.isArray(deps.inventario) ? deps.inventario : [];
    const ingMap = new Map(ingredientes.map(i => [i.id, i]));
    const invMap = new Map(inventario.map(i => [i.id, i]));

    const lineas = [];
    let importeFalta = 0;
    let importeSobra = 0;
    let faltan = 0;
    let sobran = 0;

    (Array.isArray(snapshots) ? snapshots : []).forEach(snap => {
        if (!snap || snap.id === undefined || snap.id === null) return;
        const virtual = parseFloat(snap.stock_virtual) || 0;
        const real = parseFloat(snap.stock_real) || 0;
        const diferencia = real - virtual;
        if (Math.abs(diferencia) < 0.001) return;

        const ing = ingMap.get(snap.id);
        // Precio unitario canónico (media de compras > configurado): el mismo que
        // usa el resto de la app, para que el importe no contradiga al inventario.
        const precio = getIngredientUnitPrice(invMap.get(snap.id), ing) || 0;
        const importe = diferencia * precio;

        if (diferencia < 0) { faltan++; importeFalta += -importe; } else { sobran++; importeSobra += importe; }

        // ¿Diferencia ABSURDA, o simplemente grande? Solo la primera merece aviso.
        // Una merma gorda es normal en hostelería; lo que no lo es, es que se
        // esfume casi todo Y encima mueva dinero. Se avisa, nunca se bloquea: puede
        // ser real (una cámara que se vació de verdad) y quien cuenta es quien sabe.
        const fraccion = virtual > 0 ? Math.abs(diferencia) / virtual : 0;
        const casiTodo = fraccion >= umbrales.fraccionAlta
            && Math.abs(importe) >= umbrales.importeMinimoFraccion;
        const importeExtremo = Math.abs(importe) >= umbrales.importeExtremo;

        lineas.push({
            id: snap.id,
            nombre: ing?.nombre || `Ingrediente ${snap.id}`,
            unidad: ing?.unidad || '',
            virtual, real, diferencia,
            importe: eur(importe),
            sospechosa: casiTodo || importeExtremo,
            motivoAviso: casiTodo ? 'casi-todo' : (importeExtremo ? 'importe' : null),
        });
    });

    // Las sospechosas primero y por dinero: si hay 40 líneas, que las dudosas no
    // haya que buscarlas.
    lineas.sort((a, b) => (b.sospechosa - a.sospechosa) || (Math.abs(b.importe) - Math.abs(a.importe)));

    return {
        contados: lineas.length,
        faltan,
        sobran,
        importeFalta: eur(importeFalta),
        importeSobra: eur(importeSobra),
        importeNeto: eur(importeSobra - importeFalta),
        lineas,
        sospechosas: lineas.filter(l => l.sospechosa),
    };
}

/** Una línea del bloque de avisos. Cantidad grande, dinero pequeño y en gris. */
function filaSospechosa(l) {
    return `
        <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:5px 0;">
            <span style="font-weight:700; color:#7C2D12; font-size:13px;">${escapeHTML(l.nombre)}</span>
            <span style="font-size:13px; color:#1E293B; white-space:nowrap;">
                ${fmtCant(l.virtual)} → <strong>${fmtCant(l.real)}</strong> ${escapeHTML(l.unidad)}
            </span>
            <span style="font-size:11px; color:#94A3B8; white-space:nowrap; min-width:66px; text-align:right;">${cm(l.importe)}</span>
        </div>`;
}

/**
 * HTML del resumen. Devuelve '' si no hay nada que contar, para no meter un
 * bloque vacío encima de la tabla.
 */
export function construirHtmlResumen(resumen) {
    if (!resumen || !resumen.contados) return '';

    const avisos = resumen.sospechosas.length
        ? `<div style="margin-top:10px; padding:10px 12px; background:#FFF7ED; border:1px solid #FED7AA; border-radius:8px;">
               <div style="font-size:12px; font-weight:700; color:#9A3412; margin-bottom:4px;">
                   ⚠️ ${t('inventario:resumen_revisa', { n: resumen.sospechosas.length })}
               </div>
               ${resumen.sospechosas.slice(0, 5).map(filaSospechosa).join('')}
               <div style="margin-top:6px; font-size:11px; color:#9A3412;">
                   ${t('inventario:resumen_revisa_pie')}
               </div>
           </div>`
        : '';

    return `
    <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px; margin-bottom:16px;">
        <div style="display:flex; gap:22px; flex-wrap:wrap; align-items:baseline;">
            <div>
                <div style="font-size:24px; font-weight:800; color:#1E293B; line-height:1;">${resumen.contados}</div>
                <div style="font-size:11px; color:#64748B;">${t('inventario:resumen_contados')}</div>
            </div>
            <div>
                <div style="font-size:18px; font-weight:700; color:#DC2626; line-height:1;">${resumen.faltan}</div>
                <div style="font-size:11px; color:#64748B;">${t('inventario:resumen_con_menos')}</div>
            </div>
            <div>
                <div style="font-size:18px; font-weight:700; color:#059669; line-height:1;">${resumen.sobran}</div>
                <div style="font-size:11px; color:#64748B;">${t('inventario:resumen_con_mas')}</div>
            </div>
            <div style="margin-left:auto; text-align:right;">
                <div style="font-size:12px; color:#94A3B8;">${t('inventario:resumen_importe')}</div>
                <div style="font-size:14px; font-weight:600; color:#64748B;">${cm(resumen.importeNeto)}</div>
            </div>
        </div>
        ${avisos}
    </div>`;
}

/**
 * Pinta el resumen dentro del modal. Defensivo a propósito: si algo falla, se
 * oculta el bloque y el modal de reparto sigue funcionando igual que siempre.
 * Guardar stock no puede romperse por una cabecera informativa.
 */
export function renderResumenRecuento(snapshots) {
    const cont = document.getElementById('resumen-recuento');
    if (!cont) return;
    try {
        const resumen = construirResumenRecuento(snapshots, {
            ingredientes: window.ingredientes,
            inventario: window.inventarioCompleto,
        });
        const html = construirHtmlResumen(resumen);
        cont.innerHTML = html;
        cont.style.display = html ? 'block' : 'none';
    } catch (e) {
        console.warn('Resumen de recuento no disponible:', e?.message || e);
        cont.innerHTML = '';
        cont.style.display = 'none';
    }
}

if (typeof window !== 'undefined') {
    window.renderResumenRecuento = renderResumenRecuento;
}
