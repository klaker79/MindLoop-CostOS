/**
 * modules/balance/pl-movil.js
 * ============================================
 * La Cuenta de Resultados del Diario, en forma de teléfono.
 *
 * En el ordenador el P&L es una matriz: los conceptos en vertical y un día por
 * columna, hasta 31. Eso está bien en una pantalla ancha y es inservible en un
 * móvil — nadie arrastra 31 columnas con el pulgar para enterarse de cómo va el
 * mes. Peor todavía: en el teléfono entran cinco días, y si esos cinco son de
 * principio de mes se ven cinco ceros y parece que no hay datos.
 *
 * Aquí la misma información sale al revés: **una sola columna** con el total del
 * periodo elegido (todo el mes, o la semana que se seleccione arriba), y debajo
 * la lista de días para ver la evolución. Cero scroll lateral.
 *
 * ⛔ NO HAY NI UNA FÓRMULA NUEVA EN ESTE ARCHIVO. El beneficio de cada día y el
 * total del periodo salen de `computeBeneficioNetoDiario`, el mismo cálculo puro
 * que usan la tabla del ordenador y el gráfico de "Beneficio neto por día". Si
 * aquí se recalculara por otro camino, el móvil y el ordenador podrían decir
 * cifras distintas del mismo mes — que es exactamente lo que no puede pasar.
 *
 * @module modules/balance/pl-movil
 */

import { computeBeneficioNetoDiario } from '../analisis/pnl-diario-calc.js';

/** Formatea un importe con el formateador de la app, o un fallback razonable. */
function eur(n) {
    if (typeof window !== 'undefined' && typeof window.cm === 'function') return window.cm(n);
    return `${(Number(n) || 0).toFixed(2)} €`;
}

/**
 * Arma la entrada de `computeBeneficioNetoDiario` a partir de los mapas por día
 * que publica el Diario.
 *
 * Un día "tiene actividad" si movió dinero por algún concepto. Se marca porque
 * el cálculo distingue entre el beneficio real (todos los días, con su gasto
 * fijo) y la suma de los días con actividad; aquí usamos el real.
 *
 * @param {string[]} dias - fechas YYYY-MM-DD mostradas, en orden
 * @param {object} mapas - { ingresos, costes, mermas, comida, extra } por fecha
 * @returns {Array} entrada para computeBeneficioNetoDiario
 */
export function construirDiasInput(dias, mapas = {}) {
    const { ingresos = {}, costes = {}, mermas = {}, comida = {}, extra = {} } = mapas;
    return (dias || []).map((dia) => {
        const ing = Number(ingresos[dia]) || 0;
        const cos = Number(costes[dia]) || 0;
        const mer = Number(mermas[dia]) || 0;
        const com = Number(comida[dia]) || 0;
        const ext = Number(extra[dia]) || 0;
        return {
            dia,
            ingresos: ing,
            costos: cos,
            merma: mer,
            comida: com,
            extra: ext,
            tieneActividad: ing !== 0 || cos !== 0 || mer !== 0 || com !== 0 || ext !== 0,
        };
    });
}

/**
 * Totales del periodo. Los componentes se suman aquí; el beneficio neto y el
 * total de gastos fijos vienen del cálculo compartido, no de una suma propia.
 *
 * @param {string[]} dias
 * @param {object} mapas
 * @param {number} gastosFijosDia
 * @returns {{ingresos:number, costes:number, margenBruto:number, mermas:number,
 *   comida:number, extra:number, gastosFijos:number, beneficioNeto:number,
 *   margenPct:number|null, porDia:Array<{dia:string, beneficio:number, activo:boolean}>}}
 */
export function totalesPeriodo(dias, mapas, gastosFijosDia) {
    const entrada = construirDiasInput(dias, mapas);
    const calc = computeBeneficioNetoDiario(entrada, gastosFijosDia);

    const suma = (k) => entrada.reduce((a, d) => a + d[k], 0);
    const ingresos = suma('ingresos');
    const costes = suma('costos');
    const margenBruto = ingresos - costes;

    return {
        ingresos,
        costes,
        margenBruto,
        mermas: suma('merma'),
        comida: suma('comida'),
        extra: suma('extra'),
        gastosFijos: calc.totalGastosFijos,
        beneficioNeto: calc.beneficioRealTotal,
        margenPct: ingresos > 0 ? (margenBruto / ingresos) * 100 : null,
        porDia: calc.barras,
    };
}

/** Una fila del bloque vertical. `tono` decide el color del importe. */
function fila(etiqueta, valor, { fuerte = false, tono = 'neutro', nota = '' } = {}) {
    const color = tono === 'malo' ? '#b91c1c' : tono === 'bueno' ? '#166534' : '#334155';
    return `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:${fuerte ? '13px' : '10px'} 0;${fuerte ? 'border-top:2px solid #cbd5e1;' : 'border-top:1px solid #f1f5f9;'}">
        <span style="font-size:${fuerte ? '13.5' : '13'}px;font-weight:${fuerte ? '700' : '500'};color:#475569;letter-spacing:.01em;">${etiqueta}</span>
        <span style="text-align:right;white-space:nowrap;">
          <b style="font-size:${fuerte ? '17' : '14.5'}px;font-weight:${fuerte ? '800' : '600'};color:${color};">${valor}</b>
          ${nota ? `<span style="display:block;font-size:11px;color:#94a3b8;margin-top:1px;">${nota}</span>` : ''}
        </span>
      </div>`;
}

/**
 * Devuelve el HTML del P&L móvil. No toca el DOM: quien llama decide dónde va.
 *
 * @param {object} o
 * @param {string[]} o.dias
 * @param {object} o.mapas
 * @param {number} o.gastosFijosDia
 * @param {string} o.periodo - texto del periodo ("todo el mes", "semana 2"…)
 * @returns {string}
 */
export function htmlPLMovil({ dias, mapas, gastosFijosDia, periodo = '' }) {
    const t = totalesPeriodo(dias, mapas, gastosFijosDia);
    const signo = (n) => (n > 0 ? '−' : '');   // los gastos se muestran restando

    const tonoBeneficio = t.beneficioNeto >= 0 ? 'bueno' : 'malo';

    // Solo los días con movimiento: una lista de 31 ceros no informa de nada.
    const diasConMovimiento = t.porDia.filter((d) => d.activo);
    const listaDias = diasConMovimiento.length
        ? diasConMovimiento
            .slice()
            .reverse()   // el más reciente arriba: es lo que se mira primero
            .map((d) => {
                const f = new Date(d.dia + 'T12:00:00');
                const dow = f.toLocaleDateString('es-ES', { weekday: 'short' });
                const col = d.beneficio >= 0 ? '#166534' : '#b91c1c';
                return `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-top:1px solid #f1f5f9;">
                    <span style="font-size:13px;color:#475569;">${dow} ${f.getDate()}/${f.getMonth() + 1}</span>
                    <b style="font-size:14px;color:${col};">${eur(d.beneficio)}</b>
                  </div>`;
            })
            .join('')
        : '<p style="font-size:12.5px;color:#94a3b8;padding:12px 0 0;margin:0;">Ningún día de este periodo tuvo movimiento.</p>';

    return `
    <div id="pl-movil">
      <div style="background:#fff;border:1px solid #e8dfd6;border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(58,34,22,.06);">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:2px;">
          <b style="font-size:15px;color:#1e293b;">Cuenta de Resultados</b>
          <span style="font-size:11.5px;color:#94a3b8;">${periodo}</span>
        </div>

        ${fila('INGRESOS', eur(t.ingresos), { tono: 'bueno' })}
        ${fila('COSTES DE PRODUCCIÓN', `${signo(t.costes)}${eur(t.costes)}`, { tono: 'malo' })}
        ${fila('MARGEN BRUTO', eur(t.margenBruto), {
        fuerte: true,
        tono: t.margenBruto >= 0 ? 'bueno' : 'malo',
        nota: t.margenPct === null ? 'sin ventas' : `${t.margenPct.toFixed(1)}% sobre ingresos`,
    })}
        ${t.mermas ? fila('Mermas', `${signo(t.mermas)}${eur(t.mermas)}`, { tono: 'malo' }) : ''}
        ${t.comida ? fila('Comida de personal', `${signo(t.comida)}${eur(t.comida)}`, { tono: 'malo' }) : ''}
        ${t.extra ? fila('Personal extra', `${signo(t.extra)}${eur(t.extra)}`, { tono: 'malo' }) : ''}
        ${fila('GASTOS FIJOS', `${signo(t.gastosFijos)}${eur(t.gastosFijos)}`, { tono: 'malo' })}
        ${fila('BENEFICIO NETO', eur(t.beneficioNeto), { fuerte: true, tono: tonoBeneficio })}
      </div>

      <div style="background:#fff;border:1px solid #e8dfd6;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(58,34,22,.06);">
        <b style="font-size:13px;color:#475569;letter-spacing:.02em;">BENEFICIO POR DÍA</b>
        ${listaDias}
      </div>
    </div>`;
}

// Puente para el Diario legacy (inventario-masivo.js, sin ESM). Mismo patrón que
// `window.mlComputeBeneficioNetoDiario` y `window.mlSumaGastosOperativos`: la
// lógica vive en un módulo testeado y el legacy la consume por aquí, en vez de
// tener su propia copia.
if (typeof window !== 'undefined') {
    window.mlHtmlPLMovil = htmlPLMovil;
}

export default { htmlPLMovil, totalesPeriodo, construirDiasInput };
