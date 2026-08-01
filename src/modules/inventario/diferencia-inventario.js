/**
 * 📉 Diferencia de inventario — pestaña Inventario.
 *
 * QUÉ CUENTA: la distancia entre lo que el sistema creía tener y lo que había de
 * verdad la última vez que se contó la cámara. Dentro va todo lo que no quedó
 * registrado: producto tirado sin apuntar, escandallos cortos, pesajes flojos en
 * recepción, raciones generosas.
 *
 * POR QUÉ SOLO INFORMA: el stock virtual es una aproximación por naturaleza. El
 * recuento físico es lo único que pone los dos mundos a cero, y por eso NO se
 * intenta compensar automáticamente — hacerlo obligaría a una precisión de
 * almacén que una cocina no puede sostener, y un cocinero que mete 10 kg vería
 * entrar 5. Lo que sí da este panel es la medida de cuánto puedes fiarte de tu
 * propio stock entre recuento y recuento.
 *
 * El dato existía desde diciembre de 2025 (560 recuentos guardados en La Nave 5)
 * y no se enseñaba en ninguna pantalla: se calculaba y se tiraba.
 */

import { cm } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

/** Formatea cantidades sin decimales inútiles (12.00 → 12; 0.750 → 0,75). */
function fmtCant(n) {
    const v = parseFloat(n);
    if (!Number.isFinite(v)) return '0';
    return (Math.round(v * 1000) / 1000).toString().replace('.', ',');
}

function fmtFecha(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Compara el último recuento con el anterior. Devuelve null si no hay con qué
 * comparar — es mejor no decir nada que inventar una tendencia con un solo dato.
 *
 * Se comparan PORCENTAJES, no euros: contar la bodega entera y contar cuatro
 * ingredientes producen cifras absolutas incomparables.
 */
export function compararRecuentos(ultimo, anterior) {
    if (!ultimo || !anterior) return null;
    const a = parseFloat(ultimo.desviacion_pct);
    const b = parseFloat(anterior.desviacion_pct);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const delta = Math.round((a - b) * 10) / 10;
    return { delta, mejora: delta < 0, anteriorPct: b };
}

/**
 * Traduce el % de desviación a un semáforo. Los cortes salen de lo que se
 * considera sano en gestión de almacén de hostelería: por debajo del 5% el stock
 * es una herramienta fiable; por encima del 15% las decisiones de compra se están
 * tomando sobre datos que no existen.
 */
export function nivelDesviacion(pct) {
    const v = Math.abs(parseFloat(pct));
    if (!Number.isFinite(v)) return { nivel: 'sin-datos', color: '#64748B', icono: '📊' };
    if (v <= 5) return { nivel: 'bueno', color: '#10B981', icono: '🟢' };
    if (v <= 15) return { nivel: 'atencion', color: '#F59E0B', icono: '🟠' };
    return { nivel: 'malo', color: '#EF4444', icono: '🔴' };
}

function filaTop(item) {
    const negativo = parseFloat(item.eur) < 0;
    const color = negativo ? '#DC2626' : '#059669';
    const signo = negativo ? '' : '+';
    return `
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 7px 0; border-bottom: 1px solid #F1F5F9;">
            <span style="font-weight: 600; color: #1E293B; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.nombre}</span>
            <span style="font-size: 12px; color: #64748B; white-space: nowrap;">
                ${fmtCant(item.stock_virtual)} → <strong style="color:#1E293B">${fmtCant(item.stock_real)}</strong> ${item.unidad}
            </span>
            <span style="font-weight: 700; color: ${color}; white-space: nowrap; min-width: 74px; text-align: right;">${signo}${cm(item.eur)}</span>
        </div>`;
}

/**
 * Construye el HTML del panel. Separado del fetch para poder testearlo.
 * Devuelve '' cuando no hay ningún recuento: un restaurante que nunca ha contado
 * no necesita un panel vacío diciéndoselo.
 */
export function construirPanelDiferencia(data) {
    const ultimo = data?.ultimo;
    if (!ultimo || !ultimo.contados) return '';

    const sem = nivelDesviacion(ultimo.desviacion_pct);
    const comp = compararRecuentos(ultimo, data.anterior);
    const falta = parseFloat(ultimo.neto_eur) < 0;

    // Titular: el número gordo es el dinero de diferencia, en valor absoluto.
    const titular = cm(Math.abs(ultimo.neto_eur));

    const tendencia = comp
        ? `<span style="font-size: 12px; color: ${comp.mejora ? '#059669' : '#DC2626'}; font-weight: 600;">
               ${comp.mejora ? '▼' : '▲'} ${Math.abs(comp.delta)} ${t('inventario:dif_puntos_vs_anterior')}
           </span>`
        : `<span style="font-size: 12px; color: #94A3B8;">${t('inventario:dif_sin_comparativa')}</span>`;

    const top = (ultimo.top || []).map(filaTop).join('');

    const acumulado = Number.isFinite(parseFloat(data.acumulado_eur)) && data.recuentos > 1
        ? `<div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #E2E8F0; font-size: 12px; color: #64748B;">
               ${t('inventario:dif_acumulado', { n: data.recuentos, dias: data.dias })}
               <strong style="color: ${parseFloat(data.acumulado_eur) < 0 ? '#DC2626' : '#059669'};">${cm(data.acumulado_eur)}</strong>
           </div>`
        : '';

    return `
    <div class="card" style="margin-bottom: 20px; border-left: 4px solid ${sem.color};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div>
                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1E293B;">
                    ${sem.icono} ${t('inventario:dif_titulo')}
                </h3>
                <p style="margin: 3px 0 0; font-size: 12px; color: #64748B;">
                    ${t('inventario:dif_subtitulo', { fecha: fmtFecha(ultimo.fecha), n: ultimo.contados })}
                </p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 30px; font-weight: 800; color: ${falta ? '#DC2626' : '#059669'}; line-height: 1;">
                    ${falta ? '−' : '+'}${titular}
                </div>
                <div style="font-size: 12px; color: ${sem.color}; font-weight: 700; margin-top: 2px;">
                    ${ultimo.desviacion_pct != null ? `${ultimo.desviacion_pct}% ${t('inventario:dif_desviacion')}` : ''}
                </div>
                <div style="margin-top: 2px;">${tendencia}</div>
            </div>
        </div>

        <p style="margin: 12px 0 0; font-size: 12px; color: #475569; line-height: 1.5;">
            ${falta ? t('inventario:dif_explicacion_falta') : t('inventario:dif_explicacion_sobra')}
        </p>

        ${top ? `<div style="margin-top: 12px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #94A3B8; font-weight: 700; margin-bottom: 4px;">
                ${t('inventario:dif_top_titulo')}
            </div>
            ${top}
        </div>` : ''}

        ${acumulado}
    </div>`;
}

/**
 * Carga y pinta el panel. Silencioso ante fallos: si el backend aún no tiene el
 * endpoint (despliegue a medias), la pestaña Inventario se ve como siempre.
 */
export async function renderDiferenciaInventario() {
    const cont = document.getElementById('panel-diferencia-inventario');
    if (!cont) return;

    try {
        const api = window.api;
        if (!api?.getInventoryDifferences) return;
        const data = await api.getInventoryDifferences();
        const html = construirPanelDiferencia(data);
        cont.innerHTML = html;
        cont.style.display = html ? 'block' : 'none';
    } catch (e) {
        console.warn('Diferencia de inventario no disponible:', e?.message || e);
        cont.style.display = 'none';
    }
}

if (typeof window !== 'undefined') {
    window.renderDiferenciaInventario = renderDiferenciaInventario;
}
