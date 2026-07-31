/**
 * KPI — Deriva de precio sostenida (sidebar del dashboard).
 *
 * El "caso tomate": el food cost usa la media ponderada de TODO el histórico de
 * compras. Si un proveedor sube un precio y SE MANTIENE caro, esa media tarda
 * meses en reflejarlo y el escandallo enseña un margen mejor que el real.
 *
 * La tarjeta "Variación Costes" que hay al lado compara la ÚLTIMA compra con la
 * anterior — detecta el salto puntual. Esta detecta lo contrario: la subida
 * lenta y sostenida que no da ningún salto llamativo pero se come el margen.
 *
 * Consume GET /intelligence/price-drift, que es READ-ONLY y aditivo: no cambia
 * ningún cálculo, solo compara "precio que usa la app" contra "media ponderada
 * de los últimos 90 días" en ingredientes de alto gasto. Es SQL puro (sin IA),
 * así que no tiene coste por uso.
 *
 * ⚠️ DISEÑO A PRUEBA DE FALLOS (requisito de Iker, 2026-07-31): esta tarjeta es
 * un añadido a una home que ya funciona. Nace OCULTA en el HTML y solo se
 * muestra si la llamada devuelve alertas reales. Cualquier fallo — endpoint
 * caído, respuesta rara, backend viejo sin ese endpoint — deja la tarjeta
 * oculta y la home exactamente como estaba. Nunca lanza.
 *
 * Actualiza #card-deriva-precio y #lista-deriva-precio.
 */

import { escapeHTML, cm } from '../../../utils/helpers.js';
import { t } from '@/i18n/index.js';

/** Máximo de ingredientes listados (la tarjeta es un resumen, no un informe). */
const MAX_ITEMS = 4;

/**
 * Llama al endpoint de deriva. Devuelve [] ante cualquier problema —
 * nunca lanza, para no tumbar el render del dashboard.
 * @returns {Promise<Array>}
 */
async function fetchDeriva() {
    try {
        const apiBase = window.getApiUrl ? window.getApiUrl() : null;
        if (!apiBase) return [];

        const headers = { 'Content-Type': 'application/json' };
        const token = typeof window !== 'undefined' ? window.authToken : null;
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${apiBase}/intelligence/price-drift`, {
            method: 'GET',
            credentials: 'include',
            headers
        });
        if (!response.ok) return [];

        const data = await response.json();
        // El endpoint devuelve { alertas: [...] } o directamente el array según
        // versión; aceptamos ambas formas y cualquier otra cosa cuenta como vacío.
        const alertas = Array.isArray(data) ? data : (Array.isArray(data?.alertas) ? data.alertas : []);
        return alertas;
    } catch {
        return [];
    }
}

/**
 * Pinta la tarjeta de deriva de precio. Segura de llamar siempre: si no hay
 * nada que enseñar, deja la tarjeta oculta.
 * @returns {Promise<void>}
 */
export async function renderKpiDerivaPrecio() {
    const card = document.getElementById('card-deriva-precio');
    const lista = document.getElementById('lista-deriva-precio');
    if (!card || !lista) return;

    try {
        const alertas = await fetchDeriva();

        // Sin alertas → la tarjeta NO se muestra. Es deliberado: una home con
        // una tarjeta vacía permanente ("no hay nada") es ruido; el usuario solo
        // debe verla el día que de verdad hay una subida sostenida.
        if (!Array.isArray(alertas) || alertas.length === 0) {
            card.style.display = 'none';
            return;
        }

        const items = alertas.slice(0, MAX_ITEMS);
        const impactoTotal = alertas.reduce((acc, a) => acc + (parseFloat(a.impacto_mes) || 0), 0);

        lista.innerHTML = items.map(a => {
            const nombre = escapeHTML(String(a.nombre || ''));
            const pct = parseFloat(a.desviacion_pct) || 0;
            const impacto = parseFloat(a.impacto_mes) || 0;
            const fijado = a.precio_fijado === true;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #F1F5F9;">
                    <div style="min-width: 0;">
                        <div style="font-weight: 600; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nombre}${fijado ? ' 📌' : ''}</div>
                        <div style="font-size: 11px; color: #64748B;">${t('dashboard:drift_sustained_rise')} ${pct.toFixed(1)}%</div>
                    </div>
                    <div style="text-align: right; white-space: nowrap;">
                        <div style="font-weight: 700; color: #DC2626;">+${cm(impacto)}</div>
                        <div style="font-size: 11px; color: #64748B;">${t('dashboard:drift_per_month')}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (alertas.length > MAX_ITEMS) {
            lista.innerHTML += `
                <div style="font-size: 11px; color: #64748B; padding-top: 6px;">
                    ${t('dashboard:drift_and_more', { count: alertas.length - MAX_ITEMS })}
                </div>
            `;
        }

        const totalEl = document.getElementById('deriva-precio-total');
        if (totalEl) totalEl.textContent = `+${cm(impactoTotal)}`;

        card.style.display = '';
    } catch (e) {
        // Cualquier imprevisto: la home sigue como si esta tarjeta no existiera.
        card.style.display = 'none';
        console.warn('KPI deriva de precio no disponible:', e?.message);
    }
}
