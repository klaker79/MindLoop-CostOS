/**
 * KPI — Banner de fecha actual del dashboard.
 * Actualiza #fecha-hoy-texto (fecha formateada larga) y #periodo-info
 * (semana + mes + año). Usa `getFechaHoyFormateada` y `getPeriodoActual`
 * de utils/helpers, con fallback a toLocaleDateString si fallan.
 */

import { getFechaHoyFormateada, getPeriodoActual } from '../../../utils/helpers.js';
import { getCurrentLanguage } from '@/i18n/index.js';

export function inicializarFechaActual() {
    const fechaTexto = document.getElementById('fecha-hoy-texto');
    const periodoInfo = document.getElementById('periodo-info');

    if (fechaTexto) {
        try {
            const fechaFormateada = getFechaHoyFormateada();
            fechaTexto.textContent =
                fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
        } catch {
            const fl = getCurrentLanguage();
            const fallbackLocale = fl === 'en' ? 'en-US' : fl === 'zh' ? 'zh-CN' : 'es-ES';
            fechaTexto.textContent = new Date().toLocaleDateString(fallbackLocale, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        }
    }

    if (periodoInfo) {
        try {
            const periodo = getPeriodoActual();
            const mesCapitalizado =
                periodo.mesNombre.charAt(0).toUpperCase() + periodo.mesNombre.slice(1);
            const lang = getCurrentLanguage();
            const weekText = lang === 'en'
                ? `Week ${periodo.semana}`
                : lang === 'zh'
                    ? `第${periodo.semana}周`
                    : `Semana ${periodo.semana}`;
            periodoInfo.textContent = `${weekText} · ${mesCapitalizado} ${periodo.año}`;
        } catch {
            const l = getCurrentLanguage();
            const fallbackLocale2 = l === 'en' ? 'en-US' : l === 'zh' ? 'zh-CN' : 'es-ES';
            periodoInfo.textContent = new Date().toLocaleDateString(fallbackLocale2, {
                month: 'long',
                year: 'numeric',
            });
        }
    }
}
