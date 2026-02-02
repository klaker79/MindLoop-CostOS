/**
 * P&L Report Module
 * Filtrado por rango de fechas y exportación PDF profesional
 */

// Variable para almacenar el rango de filtro actual
let filtroFechaDesde = null;
let filtroFechaHasta = null;

/**
 * Filtra el P&L por rango de fechas seleccionado
 */
export function filtrarPLPorRango() {
    const desde = document.getElementById('diario-fecha-desde')?.value;
    const hasta = document.getElementById('diario-fecha-hasta')?.value;

    if (!desde || !hasta) {
        window.showToast('Selecciona fechas Desde y Hasta', 'error');
        return;
    }

    if (new Date(desde) > new Date(hasta)) {
        window.showToast('La fecha Desde debe ser anterior a Hasta', 'error');
        return;
    }

    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        window.showToast('Primero carga los datos del mes', 'error');
        return;
    }

    filtroFechaDesde = desde;
    filtroFechaHasta = hasta;

    // Re-renderizar con filtro
    renderizarPLFiltrado();
    window.showToast(`Mostrando P&L del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`, 'success');
}

/**
 * Limpia el filtro y muestra todos los días
 */
export function limpiarFiltroPL() {
    filtroFechaDesde = null;
    filtroFechaHasta = null;
    document.getElementById('diario-fecha-desde').value = '';
    document.getElementById('diario-fecha-hasta').value = '';

    // Re-renderizar sin filtro (función original del legacy)
    if (window.datosResumenMensual) {
        // Llamar a la función original que re-renderiza todo
        window.cargarResumenMensual?.();
    }
    window.showToast('Filtro eliminado - Mostrando mes completo', 'info');
}

/**
 * Renderiza la tabla P&L con el filtro aplicado
 */
async function renderizarPLFiltrado() {
    const container = document.getElementById('tabla-pl-diario');
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML = '<p class="empty-state">No hay datos cargados</p>';
        return;
    }

    // Filtrar días por rango
    let diasFiltrados = window.datosResumenMensual.dias;
    if (filtroFechaDesde && filtroFechaHasta) {
        diasFiltrados = diasFiltrados.filter(dia => {
            const fecha = dia.split('T')[0];
            return fecha >= filtroFechaDesde && fecha <= filtroFechaHasta;
        });
    }

    if (diasFiltrados.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay datos en el rango seleccionado</p>';
        return;
    }

    const recetas = window.datosResumenMensual.ventas?.recetas || {};

    // Calcular totales por día (solo días filtrados)
    const totalesPorDia = {};
    diasFiltrados.forEach(dia => {
        totalesPorDia[dia] = { ingresos: 0, costes: 0 };
    });

    for (const [nombre, data] of Object.entries(recetas)) {
        for (const [dia, diaData] of Object.entries(data.dias)) {
            if (totalesPorDia[dia]) {
                totalesPorDia[dia].ingresos += diaData.ingresos;
                totalesPorDia[dia].costes += diaData.coste;
            }
        }
    }

    // Obtener gastos fijos
    let gastosFijosMes = 0;
    try {
        const gastosFijos = await window.api?.getGastosFijos?.() || [];
        gastosFijosMes = gastosFijos.reduce((sum, g) => sum + parseFloat(g.monto_mensual || 0), 0);
    } catch (e) {
        console.warn('Error cargando gastos fijos:', e.message);
    }

    const mesSeleccionado = parseInt(document.getElementById('diario-mes')?.value || new Date().getMonth() + 1);
    const anoSeleccionado = parseInt(document.getElementById('diario-ano')?.value || new Date().getFullYear());
    const diasEnMes = new Date(anoSeleccionado, mesSeleccionado, 0).getDate();
    const gastosFijosDia = diasEnMes > 0 ? gastosFijosMes / diasEnMes : 0;

    // Calcular compras por día
    const comprasData = window.datosResumenMensual.compras?.ingredientes || {};
    const comprasPorDia = {};
    diasFiltrados.forEach(dia => { comprasPorDia[dia] = 0; });
    for (const [nombre, data] of Object.entries(comprasData)) {
        for (const [dia, diaData] of Object.entries(data.dias || {})) {
            if (comprasPorDia[dia] !== undefined) {
                comprasPorDia[dia] += diaData.total || diaData.precio || 0;
            }
        }
    }

    // Generar HTML de la tabla
    let html = generarHTMLTablaPL(diasFiltrados, totalesPorDia, gastosFijosDia, comprasPorDia);
    container.innerHTML = html;

    // Cambiar a vista combinada
    window.cambiarVistaDiario?.('combinada');
}

/**
 * Genera el HTML de la tabla P&L
 */
function generarHTMLTablaPL(dias, totalesPorDia, gastosFijosDia, comprasPorDia) {
    let totalIngresos = 0, totalCostes = 0, totalGastosFijos = 0, totalBeneficio = 0;

    let html = `
    <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            📊 Cuenta de Resultados Diaria
            <span style="font-size: 12px; color: #64748b; font-weight: normal;">(P&L Operativo)</span>
            ${filtroFechaDesde ? `<span style="font-size: 12px; color: #0369a1; background: #e0f2fe; padding: 4px 8px; border-radius: 6px;">📅 ${formatearFecha(filtroFechaDesde)} - ${formatearFecha(filtroFechaHasta)}</span>` : ''}
        </h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    `;

    // Header
    html += '<thead><tr><th style="position: sticky; left: 0; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 14px 16px; text-align: left; font-weight: 600; color: #334155; border-bottom: 2px solid #cbd5e1;">Concepto</th>';
    dias.forEach(dia => {
        const fecha = new Date(dia);
        const diaSemana = fecha.toLocaleDateString('es-ES', { weekday: 'short' }).charAt(0).toUpperCase();
        html += `<th style="min-width: 85px; text-align: center; padding: 14px 8px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-bottom: 2px solid #cbd5e1; font-weight: 600; color: #334155;">${diaSemana} ${fecha.getDate()}/${fecha.getMonth() + 1}</th>`;
    });
    html += '<th style="min-width: 100px; text-align: center; padding: 14px 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-bottom: 2px solid #93c5fd; font-weight: 700; color: #1e40af;">TOTAL MES</th></tr></thead>';

    html += '<tbody>';

    // Fila INGRESOS
    html += '<tr style="background: #f0fdf4;"><td style="padding: 14px 16px; font-weight: 600; color: #166534; display: flex; align-items: center; gap: 6px;">📈 INGRESOS</td>';
    dias.forEach(dia => {
        const val = totalesPorDia[dia]?.ingresos || 0;
        totalIngresos += val;
        html += `<td style="text-align: center; padding: 14px 8px; color: #166534; font-weight: 500;">${val.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; padding: 14px 16px; background: #dcfce7; color: #166534; font-weight: 700;">${totalIngresos.toFixed(2)}€</td></tr>`;

    // Fila COSTES PROD
    html += '<tr style="background: #fef2f2;"><td style="padding: 14px 16px; font-weight: 600; color: #dc2626; display: flex; align-items: center; gap: 6px;">📦 COSTES PROD.</td>';
    dias.forEach(dia => {
        const val = totalesPorDia[dia]?.costes || 0;
        totalCostes += val;
        html += `<td style="text-align: center; padding: 14px 8px; color: #dc2626; font-weight: 500;">${val.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; padding: 14px 16px; background: #fee2e2; color: #dc2626; font-weight: 700;">${totalCostes.toFixed(2)}€</td></tr>`;

    // Fila MARGEN BRUTO
    html += '<tr style="background: #fefce8;"><td style="padding: 14px 16px; font-weight: 600; color: #a16207; display: flex; align-items: center; gap: 6px;">💰 MARGEN BRUTO</td>';
    let totalMargen = 0;
    dias.forEach(dia => {
        const margen = (totalesPorDia[dia]?.ingresos || 0) - (totalesPorDia[dia]?.costes || 0);
        totalMargen += margen;
        html += `<td style="text-align: center; padding: 14px 8px; color: #a16207; font-weight: 500;">${margen.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; padding: 14px 16px; background: #fef9c3; color: #a16207; font-weight: 700;">${totalMargen.toFixed(2)}€</td></tr>`;

    // Fila GASTOS FIJOS
    html += '<tr style="background: #f5f5f5;"><td style="padding: 14px 16px; font-weight: 600; color: #525252; display: flex; align-items: center; gap: 6px;">🏢 GASTOS FIJOS/DÍA</td>';
    dias.forEach(() => {
        totalGastosFijos += gastosFijosDia;
        html += `<td style="text-align: center; padding: 14px 8px; color: #525252;">${gastosFijosDia.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; padding: 14px 16px; background: #e5e5e5; color: #525252; font-weight: 700;">${totalGastosFijos.toFixed(2)}€</td></tr>`;

    // Fila BENEFICIO NETO
    html += '<tr style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);"><td style="padding: 16px; font-weight: 700; color: #92400e; display: flex; align-items: center; gap: 6px;">✅ BENEFICIO NETO</td>';
    dias.forEach(dia => {
        const beneficio = (totalesPorDia[dia]?.ingresos || 0) - (totalesPorDia[dia]?.costes || 0) - gastosFijosDia;
        totalBeneficio += beneficio;
        const color = beneficio >= 0 ? '#166534' : '#dc2626';
        html += `<td style="text-align: center; padding: 16px 8px; color: ${color}; font-weight: 700;">${beneficio.toFixed(2)}€</td>`;
    });
    const colorTotal = totalBeneficio >= 0 ? '#166534' : '#dc2626';
    html += `<td style="text-align: center; padding: 16px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: ${colorTotal}; font-weight: 800; font-size: 16px;">${totalBeneficio.toFixed(2)}€</td></tr>`;

    html += '</tbody></table>';

    // Sección Flujo de Caja
    let totalCompras = 0;
    dias.forEach(dia => { totalCompras += comprasPorDia[dia] || 0; });

    html += `
    </div>
    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; margin-top: 20px;">
        <h4 style="margin: 0 0 12px 0; color: #92400e; display: flex; align-items: center; gap: 8px;">
            💸 Flujo de Caja - Compras a Proveedores
            <span style="font-size: 12px; font-weight: normal; color: #a16207;">⚠️ No afecta al P&L, va al inventario</span>
        </h4>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div>
                <div style="font-size: 12px; color: #92400e;">Total Compras del Período</div>
                <div style="font-size: 24px; font-weight: 700; color: #b45309;">${totalCompras.toFixed(2)}€</div>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 12px; color: #92400e; margin-bottom: 8px;">Desglose por día:</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${dias.filter(d => comprasPorDia[d] > 0).map(d => {
        const fecha = new Date(d);
        return `<span style="background: white; padding: 4px 10px; border-radius: 6px; font-size: 13px; color: #92400e;">${fecha.getDate()}/${fecha.getMonth() + 1}: ${comprasPorDia[d].toFixed(2)}€</span>`;
    }).join('')}
                </div>
            </div>
        </div>
    </div>`;

    return html;
}

/**
 * Exporta el P&L a PDF profesional
 */
export async function exportarPDFInformePL() {
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        window.showToast('Primero carga los datos del mes', 'error');
        return;
    }

    // Verificar si jsPDF está disponible
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
        window.showToast('Cargando librería PDF...', 'info');
        // jsPDF ya debería estar disponible via vendors.js
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF || jsPDF;
    if (!jsPDFLib) {
        window.showToast('Error: Librería PDF no disponible', 'error');
        return;
    }

    window.showLoading?.();

    try {
        const doc = new jsPDFLib();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;

        // Filtrar días
        let diasFiltrados = window.datosResumenMensual.dias;
        if (filtroFechaDesde && filtroFechaHasta) {
            diasFiltrados = diasFiltrados.filter(dia => {
                const fecha = dia.split('T')[0];
                return fecha >= filtroFechaDesde && fecha <= filtroFechaHasta;
            });
        }

        const recetas = window.datosResumenMensual.ventas?.recetas || {};

        // Calcular totales
        let totalIngresos = 0, totalCostes = 0, totalGastosFijos = 0;
        const totalesPorDia = {};
        diasFiltrados.forEach(dia => {
            totalesPorDia[dia] = { ingresos: 0, costes: 0 };
        });

        for (const data of Object.values(recetas)) {
            for (const [dia, diaData] of Object.entries(data.dias)) {
                if (totalesPorDia[dia]) {
                    totalesPorDia[dia].ingresos += diaData.ingresos;
                    totalesPorDia[dia].costes += diaData.coste;
                }
            }
        }

        diasFiltrados.forEach(dia => {
            totalIngresos += totalesPorDia[dia]?.ingresos || 0;
            totalCostes += totalesPorDia[dia]?.costes || 0;
        });

        // Gastos fijos
        let gastosFijosMes = 0;
        try {
            const gastosFijos = await window.api?.getGastosFijos?.() || [];
            gastosFijosMes = gastosFijos.reduce((sum, g) => sum + parseFloat(g.monto_mensual || 0), 0);
        } catch (e) { /* ignore */ }

        const diasEnMes = new Date(
            parseInt(document.getElementById('diario-ano')?.value || new Date().getFullYear()),
            parseInt(document.getElementById('diario-mes')?.value || new Date().getMonth() + 1),
            0
        ).getDate();
        const gastosFijosDia = diasEnMes > 0 ? gastosFijosMes / diasEnMes : 0;
        totalGastosFijos = gastosFijosDia * diasFiltrados.length;

        const margenBruto = totalIngresos - totalCostes;
        const beneficioNeto = margenBruto - totalGastosFijos;
        const foodCost = totalIngresos > 0 ? ((totalCostes / totalIngresos) * 100).toFixed(1) : 0;
        const margenPct = totalIngresos > 0 ? ((margenBruto / totalIngresos) * 100).toFixed(1) : 0;

        // Obtener nombre del restaurante
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const restaurantName = user.restaurante_nombre || user.restaurant_name || 'Mi Restaurante';

        // ═══════════════════════════════════════
        // DISEÑO DEL PDF
        // ═══════════════════════════════════════

        // Header con gradiente simulado
        doc.setFillColor(30, 64, 175); // Azul oscuro
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Logo/Título
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORME P&L', margin, 25);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(restaurantName, margin, 35);

        // Fecha del informe
        doc.setFontSize(10);
        const fechaInforme = filtroFechaDesde
            ? `${formatearFecha(filtroFechaDesde)} - ${formatearFecha(filtroFechaHasta)}`
            : `${document.getElementById('diario-mes')?.selectedOptions[0]?.text || ''} ${document.getElementById('diario-ano')?.value || ''}`;
        doc.text(fechaInforme, pageWidth - margin - doc.getTextWidth(fechaInforme), 25);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin - 60, 35);

        let y = 60;

        // Resumen Ejecutivo
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('RESUMEN EJECUTIVO', margin, y);
        y += 10;

        // Línea decorativa
        doc.setDrawColor(30, 64, 175);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 15;

        // KPIs en cajas
        const boxWidth = (pageWidth - margin * 2 - 30) / 4;
        const boxHeight = 35;

        const kpis = [
            { label: 'INGRESOS', value: `${totalIngresos.toFixed(2)}€`, color: [22, 163, 74] },
            { label: 'COSTES', value: `${totalCostes.toFixed(2)}€`, color: [220, 38, 38] },
            { label: 'MARGEN BRUTO', value: `${margenBruto.toFixed(2)}€`, color: [161, 98, 7] },
            { label: 'BENEFICIO NETO', value: `${beneficioNeto.toFixed(2)}€`, color: beneficioNeto >= 0 ? [22, 163, 74] : [220, 38, 38] }
        ];

        kpis.forEach((kpi, i) => {
            const x = margin + i * (boxWidth + 10);

            // Caja con borde
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(...kpi.color);
            doc.setLineWidth(1);
            doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3, 'FD');

            // Etiqueta
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(kpi.label, x + 5, y + 12);

            // Valor
            doc.setTextColor(...kpi.color);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(kpi.value, x + 5, y + 26);
        });

        y += boxHeight + 20;

        // Métricas secundarias
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Food Cost: ${foodCost}%  |  Margen: ${margenPct}%  |  Días analizados: ${diasFiltrados.length}  |  Gastos Fijos/día: ${gastosFijosDia.toFixed(2)}€`, margin, y);

        y += 20;

        // Tabla detallada por día
        doc.setTextColor(30, 64, 175);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('DETALLE POR DÍA', margin, y);
        y += 10;

        doc.setDrawColor(30, 64, 175);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;

        // Headers de tabla
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');

        doc.setTextColor(51, 65, 85);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        const colWidths = [35, 35, 35, 35, 35];
        const headers = ['FECHA', 'INGRESOS', 'COSTES', 'MARGEN', 'BENEFICIO'];
        let xPos = margin + 5;
        headers.forEach((h, i) => {
            doc.text(h, xPos, y + 7);
            xPos += colWidths[i];
        });

        y += 12;

        // Filas de datos
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        diasFiltrados.forEach((dia, index) => {
            if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;
            }

            const fecha = new Date(dia);
            const ingresos = totalesPorDia[dia]?.ingresos || 0;
            const costes = totalesPorDia[dia]?.costes || 0;
            const margen = ingresos - costes;
            const beneficio = margen - gastosFijosDia;

            // Alternar colores de fila
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, y - 4, pageWidth - margin * 2, 10, 'F');
            }

            doc.setTextColor(51, 65, 85);
            xPos = margin + 5;

            // Fecha
            doc.text(`${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`, xPos, y + 3);
            xPos += colWidths[0];

            // Ingresos (verde)
            doc.setTextColor(22, 163, 74);
            doc.text(`${ingresos.toFixed(2)}€`, xPos, y + 3);
            xPos += colWidths[1];

            // Costes (rojo)
            doc.setTextColor(220, 38, 38);
            doc.text(`${costes.toFixed(2)}€`, xPos, y + 3);
            xPos += colWidths[2];

            // Margen
            doc.setTextColor(161, 98, 7);
            doc.text(`${margen.toFixed(2)}€`, xPos, y + 3);
            xPos += colWidths[3];

            // Beneficio
            doc.setTextColor(beneficio >= 0 ? 22 : 220, beneficio >= 0 ? 163 : 38, beneficio >= 0 ? 74 : 38);
            doc.text(`${beneficio.toFixed(2)}€`, xPos, y + 3);

            y += 10;
        });

        // Footer
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.text('Generado por MindLoop CostOS', margin, pageHeight - 10);
        doc.text(`Página 1`, pageWidth - margin - 20, pageHeight - 10);

        // Guardar PDF
        const fileName = filtroFechaDesde
            ? `PL_${filtroFechaDesde}_${filtroFechaHasta}.pdf`
            : `PL_${document.getElementById('diario-mes')?.value || ''}_${document.getElementById('diario-ano')?.value || ''}.pdf`;

        doc.save(fileName);

        window.hideLoading?.();
        window.showToast('PDF generado correctamente', 'success');

    } catch (error) {
        window.hideLoading?.();
        console.error('Error generando PDF:', error);
        window.showToast('Error generando PDF: ' + error.message, 'error');
    }
}

/**
 * Formatea una fecha ISO a formato español
 */
function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Exponer funciones globalmente
if (typeof window !== 'undefined') {
    window.filtrarPLPorRango = filtrarPLPorRango;
    window.limpiarFiltroPL = limpiarFiltroPL;
    window.exportarPDFInformePL = exportarPDFInformePL;
}
