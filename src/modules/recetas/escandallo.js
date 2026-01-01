/**
 * Escandallo Module
 * Visual cost breakdown and PDF export for recipes
 * 
 * @module modules/recetas/escandallo
 */

/**
 * Opens the escandallo modal for a recipe with pie chart
 * @param {number} recetaId - Recipe ID
 */
export function verEscandallo(recetaId) {
    const receta = (window.recetas || []).find(r => r.id === recetaId);
    if (!receta) return;

    const ingredientes = window.ingredientes || [];
    const inventario = window.inventarioCompleto || [];

    // ⚡ OPTIMIZACIÓN: Crear Maps O(1) una vez, no .find() O(n) por cada ingrediente
    const ingMap = new Map(ingredientes.map(i => [i.id, i]));
    const invMap = new Map(inventario.map(i => [i.id, i]));

    // Calculate cost breakdown per ingredient
    const desglose = [];
    let costeTotal = 0;

    (receta.ingredientes || []).forEach(item => {
        const ing = ingMap.get(item.ingredienteId);  // O(1) lookup
        const inv = invMap.get(item.ingredienteId);  // O(1) lookup

        if (ing) {
            const precio = inv?.precio_medio
                ? parseFloat(inv.precio_medio)
                : parseFloat(ing.precio || 0);
            const coste = precio * item.cantidad;
            costeTotal += coste;

            desglose.push({
                nombre: ing.nombre,
                cantidad: item.cantidad,
                unidad: ing.unidad || 'ud',
                precioUnitario: precio,
                coste: coste,
                porcentaje: 0 // Calculated below
            });
        }
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
            <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 id="escandallo-titulo" style="margin: 0;">📊 Escandallo</h3>
                    <button onclick="document.getElementById('modal-escandallo').classList.remove('active')" 
                        style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
                </div>
                <div id="escandallo-resumen" style="margin-bottom: 20px;"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="position: relative; height: 250px;">
                        <canvas id="chart-escandallo"></canvas>
                    </div>
                    <div id="escandallo-tabla" style="font-size: 13px; max-height: 250px; overflow-y: auto;"></div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button id="btn-exportar-pdf-escandallo" class="btn btn-primary" style="background: linear-gradient(135deg, #EF4444, #DC2626);">
                        📄 Exportar PDF
                    </button>
                    <button onclick="document.getElementById('modal-escandallo').classList.remove('active')" class="btn btn-secondary">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Store data for PDF export
    window._escandalloActual = { receta, desglose, costeTotal, precioVenta, margenEuros, margenPct, foodCost };

    // Update modal content
    document.getElementById('escandallo-titulo').textContent = `📊 ${receta.nombre}`;

    // Summary section
    const foodCostColor = foodCost <= 33 ? '#10B981' : foodCost <= 38 ? '#F59E0B' : '#EF4444';
    document.getElementById('escandallo-resumen').innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div style="background: #F0FDF4; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">Coste</div>
                <div style="font-size: 20px; font-weight: 700; color: #10B981;">${costeTotal.toFixed(2)}€</div>
            </div>
            <div style="background: #EFF6FF; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">PVP</div>
                <div style="font-size: 20px; font-weight: 700; color: #3B82F6;">${precioVenta.toFixed(2)}€</div>
            </div>
            <div style="background: #FEF3C7; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">Margen</div>
                <div style="font-size: 20px; font-weight: 700; color: #F59E0B;">${margenEuros.toFixed(2)}€</div>
            </div>
            <div style="background: ${foodCost <= 33 ? '#F0FDF4' : foodCost <= 38 ? '#FEF3C7' : '#FEE2E2'}; padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: #64748B; text-transform: uppercase;">Food Cost</div>
                <div style="font-size: 20px; font-weight: 700; color: ${foodCostColor};">${foodCost.toFixed(1)}%</div>
            </div>
        </div>
    `;

    // Table section
    let tablaHtml = '<table style="width: 100%; border-collapse: collapse;">';
    tablaHtml += '<thead><tr style="background: #F8FAFC;">';
    tablaHtml += '<th style="text-align: left; padding: 8px; border-bottom: 2px solid #E2E8F0;">Ingrediente</th>';
    tablaHtml += '<th style="text-align: right; padding: 8px; border-bottom: 2px solid #E2E8F0;">Cant.</th>';
    tablaHtml += '<th style="text-align: right; padding: 8px; border-bottom: 2px solid #E2E8F0;">Coste</th>';
    tablaHtml += '<th style="text-align: right; padding: 8px; border-bottom: 2px solid #E2E8F0;">%</th>';
    tablaHtml += '</tr></thead><tbody>';

    desglose.forEach((item, i) => {
        const bgColor = i === 0 ? '#FEE2E2' : i === 1 ? '#FEF3C7' : 'transparent';
        tablaHtml += `<tr style="background: ${bgColor};">`;
        tablaHtml += `<td style="padding: 6px 8px; border-bottom: 1px solid #E2E8F0;">${item.nombre}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #E2E8F0;">${item.cantidad} ${item.unidad}</td>`;
        tablaHtml += `<td style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; font-weight: 600;">${item.coste.toFixed(2)}€</td>`;
        tablaHtml += `<td style="text-align: right; padding: 6px 8px; border-bottom: 1px solid #E2E8F0;">${item.porcentaje.toFixed(1)}%</td>`;
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

    // Color palette
    const colors = [
        '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];

    window._chartEscandallo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: desglose.map(d => d.nombre),
            datasets: [{
                data: desglose.map(d => d.coste),
                backgroundColor: colors.slice(0, desglose.length),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const item = desglose[context.dataIndex];
                            return `${item.nombre}: ${item.coste.toFixed(2)}€ (${item.porcentaje.toFixed(1)}%)`;
                        }
                    }
                }
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
export function exportarPDFEscandallo() {
    const data = window._escandalloActual;
    if (!data) return;

    const { receta, desglose, costeTotal, precioVenta, margenEuros, margenPct, foodCost } = data;

    // jsPDF está expuesto como window.jsPDF en vendors.js
    const jsPDF = window.jsPDF;
    if (!jsPDF) {
        console.error('jsPDF no está cargado');
        window.showToast?.('Error: jsPDF no disponible', 'error');
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
    doc.text('FICHA TÉCNICA', pageWidth / 2, 15, { align: 'center' });

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
        { label: 'COSTE', value: `${costeTotal.toFixed(2)}€`, color: [16, 185, 129] },
        { label: 'PVP', value: `${precioVenta.toFixed(2)}€`, color: [59, 130, 246] },
        { label: 'MARGEN', value: `${margenEuros.toFixed(2)}€`, color: [245, 158, 11] },
        { label: 'FOOD COST', value: `${foodCost.toFixed(1)}%`, color: foodCost <= 33 ? [16, 185, 129] : foodCost <= 38 ? [245, 158, 11] : [239, 68, 68] }
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
    doc.text('DESGLOSE DE INGREDIENTES', 14, boxY + 35);

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
    doc.text('Ingrediente', 28, tableY + 5.5);
    doc.text('Cantidad', 88, tableY + 5.5);
    doc.text('Precio Unit.', 118, tableY + 5.5);
    doc.text('Coste', 153, tableY + 5.5);
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
        doc.text(`${item.precioUnitario.toFixed(2)}€/${item.unidad}`, 118, tableY + 5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.coste.toFixed(2)}€`, 153, tableY + 5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${item.porcentaje.toFixed(1)}%`, 178, tableY + 5);

        tableY += 7;
    });

    // Footer row
    doc.setFillColor(30, 41, 59);
    doc.rect(14, tableY, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 28, tableY + 5.5);
    doc.text(`${costeTotal.toFixed(2)}€`, 153, tableY + 5.5);
    doc.text('100%', 178, tableY + 5.5);

    tableY += 15;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 14, tableY);
    doc.text('Powered by MindLoop CostOS', pageWidth - 14, tableY, { align: 'right' });

    // Tips section
    if (tableY < 240) {
        doc.setFillColor(254, 243, 199);
        doc.roundedRect(14, tableY + 5, pageWidth - 28, 20, 3, 3, 'F');

        doc.setTextColor(180, 83, 9);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('ANALISIS:', 18, tableY + 13);

        doc.setFont('helvetica', 'normal');
        const topIngredient = desglose[0];
        const tip = topIngredient
            ? `"${topIngredient.nombre}" representa el ${topIngredient.porcentaje.toFixed(0)}% del coste. ${topIngredient.porcentaje > 40 ? 'Considera optimizar.' : 'Distribucion equilibrada.'}`
            : 'Sin ingredientes.';
        doc.text(tip, 18, tableY + 20);
    }

    // Save PDF
    const fileName = `Escandallo_${receta.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    window.showToast?.('PDF descargado correctamente', 'success');
}

