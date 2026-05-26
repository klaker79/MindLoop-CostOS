/**
 * Dashboard — Forecast (predicción de ingresos).
 *
 * Usa `window.calcularForecast` (legacy) sobre las ventas del store para
 * calcular la predicción a 7/30/90 días y renderizar la gráfica.
 * `initForecastTabs` engancha los tabs la primera vez que se llama.
 */

import { cm } from '../../../utils/helpers.js';
import { saleStore } from '../../../stores/saleStore.js';
import { t } from '@/i18n/index.js';

/**
 * Render principal del forecast (total, confianza, comparativa vs semana pasada
 * y chart). Invocado desde `actualizarKPIs`.
 */
export function renderForecast() {
    if (typeof window.calcularForecast !== 'function') return;

    const ventas = saleStore.getState().sales;
    const forecast = window.calcularForecast(ventas, 7);

    const forecastTotalEl = document.getElementById('forecast-total');
    if (forecastTotalEl) {
        forecastTotalEl.textContent = cm(forecast.totalPrediccion, 0);
    }

    renderHorquilla(forecast.horquilla);

    const confianzaEl = document.getElementById('forecast-confianza');
    if (confianzaEl) {
        const confianzaTextos = {
            'alta': `📊 ${t('dashboard:forecast_high_confidence')}`,
            'media': `📊 ${t('dashboard:forecast_medium_confidence')}`,
            'baja': `📊 ${t('dashboard:forecast_low_confidence')}`,
            'muy_baja': `📊 ${t('dashboard:forecast_limited_data')}`,
            'sin_datos': `📊 ${t('dashboard:forecast_no_data')}`
        };
        const base = confianzaTextos[forecast.confianza] || t('dashboard:forecast_default');
        const tendenciaTxt = formatearTendencia(forecast.tendencia);
        confianzaEl.innerHTML = tendenciaTxt ? `${base} · ${tendenciaTxt}` : base;
    }

    const comparativaEl = document.getElementById('forecast-comparativa');
    if (comparativaEl && forecast.comparativaSemana) {
        const comp = forecast.comparativaSemana;
        if (comp.anterior > 0 || comp.actual > 0) {
            const signo = comp.tendencia === 'up' ? '↑' : comp.tendencia === 'down' ? '↓' : '→';
            const color = comp.tendencia === 'up' ? '#10B981' : comp.tendencia === 'down' ? '#EF4444' : '#64748B';
            comparativaEl.innerHTML = `<span style="color: ${color}">${signo} ${comp.porcentaje}%</span> ${t('dashboard:vs_prev_week')}`;
            comparativaEl.style.background = comp.tendencia === 'up' ? '#ECFDF5' : comp.tendencia === 'down' ? '#FEF2F2' : '#F8FAFC';
        } else {
            comparativaEl.textContent = '';
        }
    }

    if (typeof window.renderForecastChart === 'function') {
        window.renderForecastChart('chart-forecast', forecast.chartData);
    }

    initForecastTabs();
}

/**
 * Engancha los tabs de período del forecast (7/30/90d) una sola vez.
 */
function initForecastTabs() {
    const tabs = document.querySelectorAll('.forecast-period-tab');
    if (!tabs.length) return;

    if (window._forecastTabsInitialized) return;
    window._forecastTabsInitialized = true;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const period = parseInt(tab.dataset.period);
            updateForecastPeriod(period);

            tabs.forEach(otherTab => {
                if (otherTab === tab) {
                    // 🎨 Verde oliva editorial (Fase D — 2026-05-26)
                    otherTab.style.background = 'linear-gradient(135deg, #3f4d2a, #2f3a1f)';
                    otherTab.style.color = 'white';
                    otherTab.style.fontWeight = '600';
                } else {
                    otherTab.style.background = '#f5f5f0';
                    otherTab.style.color = '#64748b';
                    otherTab.style.fontWeight = '500';
                }
            });
        });
    });
}

/**
 * Recalcula y re-renderiza el forecast para un número específico de días.
 */
function updateForecastPeriod(dias) {
    const ventas = saleStore.getState().sales;
    if (!ventas.length || typeof window.calcularForecast !== 'function') return;

    const forecast = window.calcularForecast(ventas, dias);

    const forecastTotalEl = document.getElementById('forecast-total');
    if (forecastTotalEl) {
        forecastTotalEl.textContent = cm(forecast.totalPrediccion, 0);
    }

    renderHorquilla(forecast.horquilla);

    const confianzaEl = document.getElementById('forecast-confianza');
    if (confianzaEl) {
        const periodoTexto = dias === 7 ? t('dashboard:forecast_7days') : dias === 30 ? t('dashboard:forecast_month') : t('dashboard:forecast_quarter');
        const confianzaTextos = {
            'alta': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_high')}`,
            'media': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_medium')}`,
            'baja': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_low')}`,
            'muy_baja': `📊 ${t('dashboard:forecast_period_projection', { period: periodoTexto })} · ${t('dashboard:forecast_confidence_limited')}`,
            'sin_datos': `📊 ${t('dashboard:forecast_no_data')}`
        };
        const base = confianzaTextos[forecast.confianza] || t('dashboard:forecast_period_projection', { period: periodoTexto });
        const tendenciaTxt = formatearTendencia(forecast.tendencia);
        confianzaEl.innerHTML = tendenciaTxt ? `${base} · ${tendenciaTxt}` : base;
    }

    if (typeof window.renderForecastChart === 'function') {
        window.renderForecastChart('chart-forecast', forecast.chartData);
    }
}

/**
 * Pinta la horquilla bajo el total ("21k – 25k"). Si la horquilla no es fiable
 * (poco histórico), no pinta nada para no engañar.
 */
function renderHorquilla(horquilla) {
    const el = document.getElementById('forecast-rango');
    if (!el) return;
    if (!horquilla || horquilla.min === null || horquilla.min === undefined || horquilla.max === null || horquilla.max === undefined) {
        el.textContent = '';
        return;
    }
    // Si la banda es muy estrecha (≤2% del total), no aporta — no pintar.
    const ancho = horquilla.max - horquilla.min;
    if (ancho <= 0) {
        el.textContent = '';
        return;
    }
    el.textContent = `${cm(horquilla.min, 0)} – ${cm(horquilla.max, 0)}`;
}

/**
 * Texto compacto de tendencia 4 semanas vs 4 anteriores. Devuelve '' cuando
 * no hay suficiente histórico (aplicable=false) para no contar mentiras.
 */
function formatearTendencia(tendencia) {
    if (!tendencia || !tendencia.aplicable) return '';
    if (tendencia.direccion === 'estable') return '';
    const flecha = tendencia.direccion === 'up' ? '↑' : '↓';
    const color = tendencia.direccion === 'up' ? '#10B981' : '#EF4444';
    const pct = Math.abs(tendencia.porcentaje);
    const label = t('dashboard:forecast_trend_4w') || 'tendencia 4s';
    return `<span style="color:${color};font-weight:600">${flecha} ${pct}%</span> ${label}`;
}
