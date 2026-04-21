/**
 * Escandallo Module
 * Visual cost breakdown and PDF export for recipes
 * 
 * @module modules/recetas/escandallo
 */

import { t } from '@/i18n/index.js';
import { escapeHTML, cm } from '../../utils/helpers.js';
import { loadChart, loadPDF } from '../../utils/lazy-vendors.js';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';
import { getInvMap, getIngMap } from './recetas-crud.js';

/**
 * Opens the escandallo modal for a recipe with pie chart
 * @param {number} recetaId - Recipe ID
 */
export async function verEscandallo(recetaId) {
    const receta = (window.recetas || []).find(r => r.id === recetaId);
    if (!receta) return;

    const ingredientes = window.ingredientes || [];
    const recetas = window.recetas || [];

    // ⚡ Usar Maps cacheados compartidos con recetas-crud (misma fuente de precios)
    const ingMap = getIngMap();
    const invMap = getInvMap();
    // Map para sub-recetas (preparaciones base)
    const recetaMap = new Map(recetas.filter(r => r.categoria === 'base').map(r => [r.id, r]));

    // Calculate cost breakdown per ingredient
    const desglose = [];
    let costeTotal = 0;

    (receta.ingredientes || []).forEach(item => {
        let ing = null;
        let inv = null;
        let esSubreceta = false;

        // 🧪 DETECTAR SUB-RECETAS: ingredienteId > 100000 significa receta base
        if (item.ingredienteId > 100000) {
            esSubreceta = true;
            const recetaBaseId = item.ingredienteId - 100000;
            const subreceta = recetas.find(r => r.id === recetaBaseId);

            if (subreceta) {
                // Calcular coste de la sub-receta
                let costeSubreceta = parseFloat(subreceta.coste || 0);

                // Si tiene función de cálculo, usarla
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
                    coste: coste,
                    porcentaje: 0,
                    esSubreceta: true
                });
            }
        } else {
            // Buscar en ingredientes por ID
            ing = ingMap.get(item.ingredienteId);
            inv = invMap.get(item.ingredienteId);

            // Si no se encuentra por ID, buscar por nombre
            if (!ing && item.nombre) {
                const nombreBuscado = item.nombre.toLowerCase().trim();
                ing = ingredientes.find(i => i.nombre.toLowerCase().trim() === nombreBuscado);
                if (ing) {
                    inv = invMap.get(ing.id);
                }
            }
        }

        if (ing && !esSubreceta) {
            // 💰 Precio unitario: función centralizada (precio_medio_compra > precio_medio > precio/cpf)
            const precio = getIngredientUnitPrice(inv, ing);

            // 🔒 H1 FIX: Aplicar rendimiento (idéntico a calcularCosteRecetaCompleto)
            let rendimiento = parseFloat(item.rendimiento);
            if (!rendimiento) {
                if (ing?.rendimiento) {
                    rendimiento = parseFloat(ing.rendimiento);
                } else {
                    rendimiento = 100;
                }
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
                coste: coste,
                porcentaje: 0
            });
        }
    });

    // Divide by porciones to get cost per serving (same as calcularCosteRecetaCompleto)
    const porciones = Math.max(1, parseInt(receta.porciones) || 1);
    costeTotal = costeTotal / porciones;
    desglose.forEach(item => {
        item.coste = item.coste / porciones;
    });

    // Calculate percentages
    desglose.forEach(item => {
        item.porcentaje = costeTotal > 0 ? (item.coste / costeTotal) * 100 : 0;
    });

    // Sort by cost descending
    desglose.sort((a, b) => b.coste - a.coste);

    // Calculate margins
    const precioVenta = parseFloat(receta.precio_venta || 0);
    const margenEuros = precioVenta - costeTotal;
    const margenPct = precioVenta > 0 ? (margenEuros / precioVenta) * 100 : 0;
    const foodCost = precioVenta > 0 ? (costeTotal / precioVenta) * 100 : 100;

    // Get or create modal
    let modal = document.getElementById('modal-escandallo');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-escandallo';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 650px; max-height: 90vh; overflow-y: auto; overflow-x: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 id="escandallo-titulo" style="margin: 0;">📊 ${t('recetas:escandallo_title')}</h3>
                    <button onclick="document.getElementById('modal-escandallo').classList.remove('active')" 
                        style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
                </div>
                <div id="escandallo-resumen" style="margin-bottom: 20px;"></div>
                <!-- Layout vertical: gráfico arriba, tabla abajo -->
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

    // Cálculos adicionales estilo ficha técnica de cocina
    const MARGEN_ERROR_PCT = 8;
    const IVA_PCT = 10;
    const margenError = costeTotal * (MARGEN_ERROR_PCT / 100);
    const subtotalConError = costeTotal + margenError;
    const _precioSugerido30 = subtotalConError / 0.30;
    const precioSugerido35 = subtotalConError / 0.35;
    const esBebida = (receta.categoria || '').toLowerCase().includes('bebida');
    const precioSugerido45 = subtotalConError / 0.45;
    const beneficioBruto = precioVenta - subtotalConError;
    const pvpConIva = precioVenta * (1 + IVA_PCT / 100);
    const foodCostReal = precioVenta > 0 ? (subtotalConError / precioVenta) * 100 : 100;

    // Store data for PDF export
    window._escandalloActual = { receta, desglose, costeTotal, precioVenta, margenEuros, margenPct, foodCost, subtotalConError, margenError, beneficioBruto, pvpConIva, precioSugerido35, foodCostReal };

    // Update modal content
    document.getElementById('escandallo-titulo').textContent = `📊 ${receta.nombre}`;

    // Summary section
    // Umbrales: ≤30 excelente, 31-35 target, 36-40 watch, >40 alert
    const foodCostColor = foodCost <= 30 ? '#059669' : foodCost <= 35 ? '#10B981' : foodCost <= 40 ? '#F59E0B' : '#EF4444';
    const foodCostRealColor = foodCostReal <= 30 ? '#059669' : foodCostReal <= 35 ? '#10B981' : foodCostReal <= 40 ? '#F59E0B' : '#EF4444';
    const precioIdeal = esBebida ? precioSugerido45 : precioSugerido35;
    const precioIdealLabel = esBebida ? '45%' : '35%';
    document.getElementById('escandallo-resumen').innerHTML = `
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

        <!-- Ficha Técnica de Cocina -->
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

    // Table section - Tabla compacta sin cortes
    let tablaHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed;">';
    tablaHtml += '<thead><tr style="background: #F8FAFC;">';
    tablaHtml += `<th style="text-align: left; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 45%;">${t('recetas:escandallo_col_ingredient')}</th>`;
    tablaHtml += `<th style="text-align: right; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 20%;">${t('recetas:escandallo_col_quantity')}</th>`;
    tablaHtml += `<th style="text-align: right; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 18%;">${t('recetas:escandallo_col_cost')}</th>`;
    tablaHtml += '<th style="text-align: right; padding: 6px; border-bottom: 2px solid #E2E8F0; width: 17%;">%</th>';
    tablaHtml += '</tr></thead><tbody>';

    desglose.forEach((item, i) => {
        const bgColor = i === 0 ? '#FEE2E2' : i === 1 ? '#FEF3C7' : 'transparent';
        // Truncar nombre si es muy largo
        const nombreCorto = item.nombre.length > 25 ? item.nombre.substring(0, 23) + '...' : item.nombre;
        tablaHtml += `<tr style="background: ${bgColor};">`;
        tablaHtml += `<td style="padding: 5px; border-bottom: 1px solid #E2E8F0; overflow: hidden; text-overflow: ellipsis;" title="${escapeHTML(item.nombre)}">${escapeHTML(nombreCorto)}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 5px; border-bottom: 1px solid #E2E8F0;">${item.cantidad} ${item.unidad}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 5px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${cm(item.coste)}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 5px; border-bottom: 1px solid #E2E8F0;">${item.porcentaje.toFixed(0)}%</td>`;
        tablaHtml += '</tr>';
    });

    tablaHtml += '</tbody></table>';
    document.getElementById('escandallo-tabla').innerHTML = tablaHtml;

    // Render pie chart
    const ctx = document.getElementById('chart-escandallo').getContext('2d');

    // Destroy existing chart if any
    if (window._chartEscandallo) {
        window._chartEscandallo.destroy();
    }

    // Premium vibrant color palette
    const colors = [
        '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
        '#14B8A6', '#F43F5E', '#A855F7', '#0EA5E9'
    ];

    // Hover colors (brighter variants)
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
                legend: {
                    display: false
                },
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

    // Bind PDF export button
    document.getElementById('btn-exportar-pdf-escandallo').onclick = () => exportarPDFEscandallo();

    // Show modal
    modal.classList.add('active');
}

/**
 * Exports the current escandallo as a professional PDF
 */
export async function exportarPDFEscandallo() {
    const data = window._escandalloActual;
    if (!data) return;

    const { receta, desglose, costeTotal, precioVenta, margenEuros, margenPct, foodCost } = data;

    // Cargar jsPDF bajo demanda
    await loadPDF();
    const jsPDF = window.jsPDF;
    if (!jsPDF) {
        console.error('jsPDF no está cargado');
        window.showToast?.(t('recetas:escandallo_pdf_error'), 'error');
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header with gradient effect (simulated)
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Logo/Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(t('recetas:escandallo_pdf_title'), pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(receta.nombre.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

    // Restaurant name
    const restaurantName = window.restauranteActual?.nombre || 'MindLoop CostOS';
    doc.setFontSize(10);
    doc.text(restaurantName, pageWidth / 2, 32, { align: 'center' });

    // Reset colors for body
    doc.setTextColor(30, 41, 59);

    // Summary boxes
    const boxY = 45;
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

    // Ingredients table - Manual drawing
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(t('recetas:escandallo_breakdown'), 14, boxY + 35);

    // Table header
    let tableY = boxY + 42;
    const colWidths = [10, 60, 30, 35, 25, 20];
    const colX = [14, 24, 84, 114, 149, 174];

    // Header row
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

    // Data rows
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');

    desglose.forEach((item, i) => {
        // Alternate row background
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

    // Footer row
    doc.setFillColor(30, 41, 59);
    doc.rect(14, tableY, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(t('recetas:escandallo_total'), 28, tableY + 5.5);
    doc.text(`${cm(costeTotal)}`, 153, tableY + 5.5);
    doc.text('100%', 178, tableY + 5.5);

    tableY += 15;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const lang = localStorage.getItem('mindloop_lang') || 'es';
    const locale = lang === 'en' ? 'en-GB' : 'es-ES';
    doc.text(`Generado: ${new Date().toLocaleDateString(locale)} ${new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`, 14, tableY);
    doc.text('Powered by MindLoop CostOS', pageWidth - 14, tableY, { align: 'right' });

    // Tips section
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

    // Save PDF
    const fileName = `Escandallo_${receta.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    window.showToast?.(t('recetas:escandallo_pdf_success'), 'success');
}

