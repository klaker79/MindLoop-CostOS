/**
 * Escandallo Module
 * Visual cost breakdown and PDF export for recipes
 *
 * Supports two price modes (local UI toggle — does NOT affect persisted data):
 *   - 'real'    → getIngredientUnitPrice (precio_medio_compra > precio_medio > precio/cpf)
 *   - 'nominal' → getIngredientNominalPrice (precio / cpf only)
 *
 * @module modules/recetas/escandallo
 */

import { t } from '@/i18n/index.js';
import { escapeHTML, cm } from '../../utils/helpers.js';
import { loadChart, loadPDF } from '../../utils/lazy-vendors.js';
import { getIngredientUnitPrice, getIngredientNominalPrice } from '../../utils/cost-calculator.js';
import { getInvMap, getIngMap } from './recetas-crud.js';

const DEVIATION_WARN_PCT = 15;

function calcularDesglose(receta, modo, recetas, ingMap, invMap, ingredientes) {
    const desglose = [];
    let costeTotal = 0;

    (receta.ingredientes || []).forEach(item => {
        let ing = null;
        let inv = null;
        let esSubreceta = false;

        if (item.ingredienteId > 100000) {
            esSubreceta = true;
            const recetaBaseId = item.ingredienteId - 100000;
            const subreceta = recetas.find(r => r.id === recetaBaseId);

            if (subreceta) {
                // Sub-recetas: usamos `calcularCosteRecetaCompleto` (dinámico) en ambos modos.
                // V1 no diferencia nominal vs real para preparaciones base.
                let costeSubreceta = parseFloat(subreceta.coste || 0);
                if (window.calcularCosteRecetaCompleto) {
                    costeSubreceta = window.calcularCosteRecetaCompleto(subreceta);
                }
                const coste = costeSubreceta * item.cantidad;
                costeTotal += coste;

                desglose.push({
                    nombre: `🧪 ${subreceta.nombre}`,
                    cantidad: item.cantidad,
                    unidad: t('recetas:escandallo_subrecipe_unit'),
                    precioUnitario: costeSubreceta,
                    coste,
                    porcentaje: 0,
                    esSubreceta: true
                });
            }
        } else {
            ing = ingMap.get(item.ingredienteId);
            inv = invMap.get(item.ingredienteId);

            if (!ing && item.nombre) {
                const nombreBuscado = item.nombre.toLowerCase().trim();
                ing = ingredientes.find(i => i.nombre.toLowerCase().trim() === nombreBuscado);
                if (ing) inv = invMap.get(ing.id);
            }
        }

        if (ing && !esSubreceta) {
            const precio = modo === 'nominal'
                ? getIngredientNominalPrice(ing)
                : getIngredientUnitPrice(inv, ing);

            let rendimiento = parseFloat(item.rendimiento);
            if (!rendimiento) {
                rendimiento = ing?.rendimiento ? parseFloat(ing.rendimiento) : 100;
            }
            const factorRendimiento = rendimiento / 100;
            const precioConRendimiento = factorRendimiento > 0 ? (precio / factorRendimiento) : precio;

            const coste = precioConRendimiento * item.cantidad;
            costeTotal += coste;

            desglose.push({
                nombre: ing.nombre,
                cantidad: item.cantidad,
                unidad: ing.unidad || 'ud',
                precioUnitario: precioConRendimiento,
                coste,
                porcentaje: 0
            });
        }
    });

    const porciones = Math.max(1, parseInt(receta.porciones) || 1);
    costeTotal = costeTotal / porciones;
    desglose.forEach(it => { it.coste = it.coste / porciones; });
    desglose.forEach(it => { it.porcentaje = costeTotal > 0 ? (it.coste / costeTotal) * 100 : 0; });
    desglose.sort((a, b) => b.coste - a.coste);

    return { desglose, costeTotal };
}

/**
 * Opens the escandallo modal for a recipe with pie chart
 * @param {number} recetaId - Recipe ID
 */
export async function verEscandallo(recetaId) {
    const receta = (window.recetas || []).find(r => r.id === recetaId);
    if (!receta) return;

    const ingredientes = window.ingredientes || [];
    const recetas = window.recetas || [];
    const ingMap = getIngMap();
    const invMap = getInvMap();

    // Calculamos ambos modos una sola vez — el toggle solo cambia qué mostrar.
    const real = calcularDesglose(receta, 'real', recetas, ingMap, invMap, ingredientes);
    const nominal = calcularDesglose(receta, 'nominal', recetas, ingMap, invMap, ingredientes);

    const precioVenta = parseFloat(receta.precio_venta || 0);
    const deviationPct = nominal.costeTotal > 0
        ? ((real.costeTotal - nominal.costeTotal) / nominal.costeTotal) * 100
        : 0;

    window._escandalloActual = {
        receta,
        real,
        nominal,
        precioVenta,
        deviationPct,
        modoActivo: 'real'
    };

    let modal = document.getElementById('modal-escandallo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-escandallo';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px; max-height: 90vh; overflow-y: auto; overflow-x: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 id="escandallo-titulo" style="margin: 0;">📊 ${t('recetas:escandallo_title')}</h3>
                    <button onclick="document.getElementById('modal-escandallo').classList.remove('active')"
                        style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
                </div>
                <div id="escandallo-toggle" style="margin-bottom: 12px;"></div>
                <div id="escandallo-deviation" style="margin-bottom: 14px;"></div>
                <div id="escandallo-resumen" style="margin-bottom: 20px;"></div>
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div style="display: flex; justify-content: center; align-items: center; height: 200px;">
                        <div style="width: 200px; height: 200px;">
                            <canvas id="chart-escandallo"></canvas>
                        </div>
                    </div>
                    <div id="escandallo-tabla" style="font-size: 13px;"></div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button id="btn-exportar-pdf-escandallo" class="btn btn-primary" style="background: linear-gradient(135deg, #EF4444, #DC2626);">
                        📄 ${t('export:btn_export_pdf')}
                    </button>
                    <button onclick="document.getElementById('modal-escandallo').classList.remove('active')" class="btn btn-secondary">
                        ${t('recetas:escandallo_close')}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('escandallo-titulo').textContent = `📊 ${receta.nombre}`;

    renderToggleYDeviation();
    await renderContenido();

    document.getElementById('btn-exportar-pdf-escandallo').onclick = () => exportarPDFEscandallo();
    modal.classList.add('active');
}

function renderToggleYDeviation() {
    const data = window._escandalloActual;
    if (!data) return;
    const { modoActivo, deviationPct, nominal, real } = data;

    const togglePill = (mode, labelKey) => {
        const active = modoActivo === mode;
        return `<button type="button" data-modo="${mode}" class="escandallo-toggle-btn" style="
            padding: 6px 14px;
            border-radius: 999px;
            border: 1px solid ${active ? '#3B82F6' : '#CBD5E1'};
            background: ${active ? '#3B82F6' : '#F8FAFC'};
            color: ${active ? 'white' : '#334155'};
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        ">${escapeHTML(t(labelKey))}</button>`;
    };

    const togglerEl = document.getElementById('escandallo-toggle');
    if (togglerEl) {
        togglerEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 12px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${escapeHTML(t('recetas:escandallo_toggle_label'))}
                </span>
                <div style="display: flex; gap: 6px;">
                    ${togglePill('real', 'recetas:escandallo_toggle_real')}
                    ${togglePill('nominal', 'recetas:escandallo_toggle_nominal')}
                </div>
            </div>
        `;
        togglerEl.querySelectorAll('[data-modo]').forEach(btn => {
            btn.addEventListener('click', async () => {
                data.modoActivo = btn.dataset.modo;
                renderToggleYDeviation();
                await renderContenido();
            });
        });
    }

    const devEl = document.getElementById('escandallo-deviation');
    if (devEl) {
        const absDev = Math.abs(deviationPct);
        const warn = isFinite(deviationPct) && absDev >= DEVIATION_WARN_PCT;
        const bg = warn ? '#FEF3C7' : '#F1F5F9';
        const border = warn ? '#F59E0B' : '#CBD5E1';
        const icon = warn ? '⚠️' : 'ℹ️';
        const sign = deviationPct >= 0 ? '+' : '';
        const signedPct = isFinite(deviationPct) ? `${sign}${deviationPct.toFixed(1)}%` : '—';
        const msgKey = warn ? 'recetas:escandallo_deviation_warn' : 'recetas:escandallo_deviation_info';

        devEl.innerHTML = `
            <div style="background: ${bg}; border-left: 4px solid ${border}; padding: 10px 14px; border-radius: 6px; font-size: 12px; line-height: 1.5;">
                <div style="display: flex; gap: 8px; align-items: flex-start;">
                    <span>${icon}</span>
                    <div>
                        <div style="font-weight: 600; color: #334155; margin-bottom: 2px;">
                            ${escapeHTML(t(msgKey))}
                        </div>
                        <div style="color: #64748B;">
                            ${escapeHTML(t('recetas:escandallo_deviation_detail', {
                                nominal: cm(nominal.costeTotal),
                                real: cm(real.costeTotal),
                                delta: signedPct
                            }))}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

async function renderContenido() {
    const data = window._escandalloActual;
    if (!data) return;
    const { receta, real, nominal, precioVenta, modoActivo } = data;
    const activo = modoActivo === 'nominal' ? nominal : real;
    const { desglose, costeTotal } = activo;

    const margenEuros = precioVenta - costeTotal;
    const margenPct = precioVenta > 0 ? (margenEuros / precioVenta) * 100 : 0;
    const foodCost = precioVenta > 0 ? (costeTotal / precioVenta) * 100 : 100;

    const MARGEN_ERROR_PCT = 8;
    const IVA_PCT = 10;
    const margenError = costeTotal * (MARGEN_ERROR_PCT / 100);
    const subtotalConError = costeTotal + margenError;
    const precioSugerido35 = subtotalConError / 0.35;
    const esBebida = (receta.categoria || '').toLowerCase().includes('bebida');
    const precioSugerido45 = subtotalConError / 0.45;
    const beneficioBruto = precioVenta - subtotalConError;
    const pvpConIva = precioVenta * (1 + IVA_PCT / 100);
    const foodCostReal = precioVenta > 0 ? (subtotalConError / precioVenta) * 100 : 100;

    // Expose derived values for PDF export
    Object.assign(data, {
        costeTotal,
        desglose,
        margenEuros,
        margenPct,
        foodCost,
        subtotalConError,
        margenError,
        beneficioBruto,
        pvpConIva,
        precioSugerido35,
        foodCostReal
    });

    const foodCostColor = foodCost <= 30 ? '#059669' : foodCost <= 35 ? '#10B981' : foodCost <= 40 ? '#F59E0B' : '#EF4444';
    const foodCostRealColor = foodCostReal <= 30 ? '#059669' : foodCostReal <= 35 ? '#10B981' : foodCostReal <= 40 ? '#F59E0B' : '#EF4444';
    const precioIdeal = esBebida ? precioSugerido45 : precioSugerido35;
    const precioIdealLabel = esBebida ? '45%' : '35%';

    const resumenEl = document.getElementById('escandallo-resumen');
    if (resumenEl) {
        resumenEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                <div style="background: #F0FDF4; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_cost')}</div>
                    <div style="font-size: 20px; font-weight: 700; color: #10B981;">${cm(costeTotal)}</div>
                </div>
                <div style="background: #EFF6FF; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_pvp')}</div>
                    <div style="font-size: 20px; font-weight: 700; color: #3B82F6;">${cm(precioVenta)}</div>
                </div>
                <div style="background: #FEF3C7; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_margin')}</div>
                    <div style="font-size: 20px; font-weight: 700; color: #F59E0B;">${cm(margenEuros)}</div>
                </div>
                <div style="background: ${foodCost <= 35 ? '#F0FDF4' : foodCost <= 40 ? '#FEF3C7' : '#FEE2E2'}; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">${t('recetas:escandallo_food_cost')}</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${foodCostColor};">${foodCost.toFixed(1)}%</div>
                </div>
            </div>

            <div style="margin-top: 16px; background: linear-gradient(135deg, #1E293B 0%, #334155 100%); border-radius: 12px; padding: 20px; color: #E2E8F0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #475569;">
                    <span style="font-size: 16px;">📋</span>
                    <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #F8FAFC;">${escapeHTML(t('recetas:escandallo_ficha_title'))}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; font-size: 13px;">
                    <span style="color: #94A3B8;">${escapeHTML(t('recetas:escandallo_coste_ingredientes'))}</span>
                    <span style="text-align: right; font-weight: 600;">${cm(costeTotal)}</span>

                    <span style="color: #94A3B8;">${escapeHTML(t('recetas:escandallo_margen_error', { pct: MARGEN_ERROR_PCT }))}</span>
                    <span style="text-align: right; font-weight: 600; color: #FBBF24;">+${cm(margenError)}</span>

                    <span style="color: #F8FAFC; font-weight: 700; padding-top: 6px; border-top: 1px solid #475569;">${escapeHTML(t('recetas:escandallo_subtotal_racion'))}</span>
                    <span style="text-align: right; font-weight: 700; color: #F8FAFC; padding-top: 6px; border-top: 1px solid #475569;">${cm(subtotalConError)}</span>

                    <span style="color: #94A3B8; padding-top: 8px;">${escapeHTML(t('recetas:escandallo_precio_sugerido', { fc: precioIdealLabel }))}</span>
                    <span style="text-align: right; font-weight: 600; padding-top: 8px; color: #67E8F9;">${cm(precioIdeal)}</span>

                    <span style="color: #94A3B8;">${escapeHTML(t('recetas:escandallo_beneficio_bruto'))}</span>
                    <span style="text-align: right; font-weight: 600; color: ${beneficioBruto >= 0 ? '#34D399' : '#F87171'};">${cm(beneficioBruto)}</span>

                    <span style="color: #94A3B8;">${escapeHTML(t('recetas:escandallo_iva', { pct: IVA_PCT }))}</span>
                    <span style="text-align: right; font-weight: 600;">${cm((precioVenta * IVA_PCT / 100))}</span>

                    <span style="color: #F8FAFC; font-weight: 700; font-size: 15px; padding-top: 8px; border-top: 1px solid #475569;">${escapeHTML(t('recetas:escandallo_pvp'))}</span>
                    <span style="text-align: right; font-weight: 700; font-size: 15px; color: #F97316; padding-top: 8px; border-top: 1px solid #475569;">${cm(pvpConIva)}</span>

                    <span style="color: #94A3B8; padding-top: 6px;">${escapeHTML(t('recetas:escandallo_fc_real'))}</span>
                    <span style="text-align: right; font-weight: 700; padding-top: 6px; color: ${foodCostRealColor};">${foodCostReal.toFixed(1)}%</span>
                </div>
            </div>
        `;
    }

    // Silence unused-var warning: margenPct is derived & exposed via data
    void margenPct;

    let tablaHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">';
    tablaHtml += '<thead><tr style="background: #F8FAFC;">';
    tablaHtml += `<th style="text-align: left; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 45%;">${t('recetas:escandallo_col_ingredient')}</th>`;
    tablaHtml += `<th style="text-align: right; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 20%;">${t('recetas:escandallo_col_quantity')}</th>`;
    tablaHtml += `<th style="text-align: right; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 18%;">${t('recetas:escandallo_col_cost')}</th>`;
    tablaHtml += '<th style="text-align: right; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 17%;">%</th>';
    tablaHtml += '</tr></thead><tbody>';

    desglose.forEach((item, i) => {
        const bgColor = i === 0 ? '#FEE2E2' : i === 1 ? '#FEF3C7' : 'transparent';
        const nombreCorto = item.nombre.length > 25 ? item.nombre.substring(0, 23) + '...' : item.nombre;
        tablaHtml += `<tr style="background: ${bgColor};">`;
        tablaHtml += `<td style="padding: 5px; border-bottom: 1px solid #E2E8F0; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(item.nombre)}">${escapeHTML(nombreCorto)}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 5px; border-bottom: 1px solid #E2E8F0;">${item.cantidad} ${item.unidad}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 5px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${cm(item.coste)}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 5px; border-bottom: 1px solid #E2E8F0;">${item.porcentaje.toFixed(0)}%</td>`;
        tablaHtml += '</tr>';
    });

    tablaHtml += '</tbody></table>';
    const tablaEl = document.getElementById('escandallo-tabla');
    if (tablaEl) tablaEl.innerHTML = tablaHtml;

    const canvas = document.getElementById('chart-escandallo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (window._chartEscandallo) {
        window._chartEscandallo.destroy();
    }

    const colors = [
        '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
        '#14B8A6', '#F43F5E', '#A855F7', '#0EA5E9'
    ];

    const hoverColors = [
        '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA',
        '#F472B6', '#22D3EE', '#A3E635', '#FB923C', '#818CF8',
        '#2DD4BF', '#FB7185', '#C084FC', '#38BDF8'
    ];

    await loadChart();
    window._chartEscandallo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: desglose.map(d => d.nombre),
            datasets: [{
                data: desglose.map(d => d.coste),
                backgroundColor: colors.slice(0, desglose.length),
                hoverBackgroundColor: hoverColors.slice(0, desglose.length),
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverBorderColor: '#ffffff',
                hoverBorderWidth: 3,
                hoverOffset: 8,
                borderRadius: 3,
                spacing: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleColor: '#F8FAFC',
                    bodyColor: '#E2E8F0',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    titleFont: { size: 12, weight: '700' },
                    bodyFont: { size: 13, weight: '600' },
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        label: function (context) {
                            const item = desglose[context.dataIndex];
                            return ` ${cm(item.coste)}  ·  ${item.porcentaje.toFixed(1)}%`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
}

/**
 * Exports the current escandallo as a professional PDF
 */
export async function exportarPDFEscandallo() {
    const data = window._escandalloActual;
    if (!data) return;

    const { receta, desglose, costeTotal, precioVenta, margenEuros, foodCost, modoActivo } = data;

    await loadPDF();
    const jsPDF = window.jsPDF;
    if (!jsPDF) {
        console.error('jsPDF no está cargado');
        window.showToast?.(t('recetas:escandallo_pdf_error'), 'error');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(t('recetas:escandallo_pdf_title'), pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(receta.nombre.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

    const restaurantName = window.restauranteActual?.nombre || 'MindLoop CostOS';
    doc.setFontSize(10);
    doc.text(restaurantName, pageWidth / 2, 32, { align: 'center' });

    // Mode badge (real / nominal) under the header
    const modeLabel = t(modoActivo === 'nominal' ? 'recetas:escandallo_toggle_nominal' : 'recetas:escandallo_toggle_real');
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(pageWidth - 60, 38, 46, 6, 2, 2, 'F');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8);
    doc.text(`${t('recetas:escandallo_toggle_label')}: ${modeLabel}`, pageWidth - 37, 42, { align: 'center' });

    doc.setTextColor(30, 41, 59);

    const boxY = 50;
    const boxWidth = 42;
    const boxHeight = 22;
    const gap = 5;
    const startX = (pageWidth - (boxWidth * 4 + gap * 3)) / 2;

    const summaryData = [
        { label: t('recetas:escandallo_cost'), value: `${cm(costeTotal)}`, color: [16, 185, 129] },
        { label: t('recetas:escandallo_pvp'), value: `${cm(precioVenta)}`, color: [59, 130, 246] },
        { label: t('recetas:escandallo_margin'), value: `${cm(margenEuros)}`, color: [245, 158, 11] },
        { label: t('recetas:escandallo_food_cost'), value: `${foodCost.toFixed(1)}%`, color: foodCost <= 35 ? [16, 185, 129] : foodCost <= 40 ? [245, 158, 11] : [239, 68, 68] }
    ];

    summaryData.forEach((item, i) => {
        const x = startX + (boxWidth + gap) * i;
        doc.setFillColor(...item.color);
        doc.roundedRect(x, boxY, boxWidth, boxHeight, 3, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(item.label, x + boxWidth / 2, boxY + 8, { align: 'center' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, x + boxWidth / 2, boxY + 17, { align: 'center' });
    });

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(t('recetas:escandallo_breakdown'), 14, boxY + 35);

    let tableY = boxY + 42;

    doc.setFillColor(102, 126, 234);
    doc.rect(14, tableY, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 18, tableY + 5.5);
    doc.text(t('recetas:escandallo_col_ingredient'), 28, tableY + 5.5);
    doc.text(t('recetas:escandallo_col_quantity'), 88, tableY + 5.5);
    doc.text(t('recetas:escandallo_col_unit_price'), 118, tableY + 5.5);
    doc.text(t('recetas:escandallo_col_cost'), 153, tableY + 5.5);
    doc.text('%', 178, tableY + 5.5);

    tableY += 8;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');

    desglose.forEach((item, i) => {
        if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, tableY, pageWidth - 28, 7, 'F');
        }

        doc.text((i + 1).toString(), 18, tableY + 5);
        doc.text(item.nombre.substring(0, 25), 28, tableY + 5);
        doc.text(`${item.cantidad} ${item.unidad}`, 88, tableY + 5);
        doc.text(`${cm(item.precioUnitario)}/${item.unidad}`, 118, tableY + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${cm(item.coste)}`, 153, tableY + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${item.porcentaje.toFixed(1)}%`, 178, tableY + 5);

        tableY += 7;
    });

    doc.setFillColor(30, 41, 59);
    doc.rect(14, tableY, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(t('recetas:escandallo_total'), 28, tableY + 5.5);
    doc.text(`${cm(costeTotal)}`, 153, tableY + 5.5);
    doc.text('100%', 178, tableY + 5.5);

    tableY += 15;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const lang = localStorage.getItem('mindloop_lang') || 'es';
    const locale = lang === 'en' ? 'en-GB' : 'es-ES';
    doc.text(`Generado: ${new Date().toLocaleDateString(locale)} ${new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`, 14, tableY);
    doc.text('Powered by MindLoop CostOS', pageWidth - 14, tableY, { align: 'right' });

    if (tableY < 240) {
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(14, tableY + 5, pageWidth - 28, 20, 3, 3, 'F');

        doc.setTextColor(180, 83, 9);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(t('recetas:escandallo_analysis'), 18, tableY + 13);

        doc.setFont('helvetica', 'normal');
        const topIngredient = desglose[0];
        const tip = topIngredient
            ? (topIngredient.porcentaje > 40
                ? t('recetas:escandallo_top_ingredient_high', { name: topIngredient.nombre, pct: topIngredient.porcentaje.toFixed(0) })
                : t('recetas:escandallo_top_ingredient_ok', { name: topIngredient.nombre, pct: topIngredient.porcentaje.toFixed(0) }))
            : t('recetas:escandallo_no_ingredients');
        doc.text(tip, 18, tableY + 20);
    }

    const fileName = `Escandallo_${receta.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    window.showToast?.(t('recetas:escandallo_pdf_success'), 'success');
}
