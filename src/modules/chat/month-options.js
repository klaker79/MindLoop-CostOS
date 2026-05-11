/**
 * Opciones del selector de mes para el botón "Informe ejecutivo" del chat.
 *
 * Genera 6 entradas: "Mes en curso" + 5 meses cerrados anteriores
 * (el más reciente etiquetado "Recién cerrado").
 *
 * Función pura — acepta `now` opcional para hacer los tests deterministas
 * (no depender de la fecha real del sistema en CI).
 *
 * @param {'es'|'en'} lang  Idioma del usuario
 * @param {Date} [now]      Fecha de referencia (por defecto: now real)
 * @returns {Array<{label: string, sublabel: string, mes: string|null}>}
 */
export function buildMonthOptions(lang, now = new Date()) {
    const opts = [];
    const fmtLong = lang === 'en' ? 'en-GB' : 'es-ES';

    // Mes en curso (mes=null → backend usa el mes actual)
    opts.push({
        label: lang === 'en' ? 'Current month' : 'Mes en curso',
        sublabel: now.toLocaleDateString(fmtLong, { month: 'long', year: 'numeric' }),
        mes: null
    });

    // 5 meses cerrados anteriores en orden descendente (más reciente primero)
    for (let i = 1; i <= 5; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const label = d.toLocaleDateString(fmtLong, { month: 'long', year: 'numeric' });
        opts.push({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            sublabel: i === 1 ? (lang === 'en' ? 'Just closed' : 'Recién cerrado') : '',
            mes: `${yyyy}-${mm}`
        });
    }
    return opts;
}
