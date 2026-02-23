/**
 * PDF Generator Module
 * Genera PDFs profesionales para recetas, ingredientes y pedidos
 */

import { loadPDF } from '../../utils/lazy-vendors.js';

/**
 * Genera PDF profesional de una receta con logo y formato premium
 * @param {Object} receta - Objeto receta con ingredientes
 * @param {Array} ingredientes - Array de todos los ingredientes disponibles
 */
export async function generarPDFReceta(receta, ingredientes) {
    // Cargar jsPDF bajo demanda
    await loadPDF();
    if (!window.jspdf) {
        console.error('jsPDF no está cargado.');
        window.showToast?.('Error: Librería PDF no cargada', 'error');
        return null;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Colores brand
    const colorPrimary = [255, 107, 53]; // #FF6B35
    const colorText = [30, 41, 59]; // #1E293B
    const colorSecondary = [100, 116, 139]; // #64748B

    // === HEADER CON LOGO ===
    doc.setFillColor(...colorPrimary);
    doc.rect(0, 0, 210, 40, 'F');

    // MindLoop CostOS
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MindLoop CostOS', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Restaurant Intelligence Platform', 105, 28, { align: 'center' });

    // === INFORMACIÓN RECETA ===
    let yPos = 55;

    doc.setTextColor(...colorText);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`RECETA: ${receta.nombre.toUpperCase()}`, 20, yPos);

    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colorSecondary);
    doc.text(`Código: ${receta.codigo || 'N/A'}`, 20, yPos);
    doc.text(`Categoría: ${receta.categoria || 'N/A'}`, 80, yPos);
    doc.text(`Porciones: ${receta.porciones || 1}`, 140, yPos);

    // Línea de separación
    yPos += 8;
    doc.setDrawColor(...colorPrimary);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);

    // === TABLA DE INGREDIENTES ===
    yPos += 10;
    doc.setTextColor(...colorText);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INGREDIENTES:', 20, yPos);

    yPos += 8;

    // Calcular costes
    let costoTotal = 0;
    const ingredientesData = [];

    if (receta.ingredientes && Array.isArray(receta.ingredientes)) {
        receta.ingredientes.forEach(item => {
            const ing = ingredientes.find(
                i => i.id === item.ingredienteId || i.id === item.ingrediente_id
            );
            if (ing) {
                const cantidad = item.cantidad || 0;
                const precio = ing.precio || 0;
                const subtotal = cantidad * precio;
                costoTotal += subtotal;

                ingredientesData.push([
                    ing.nombre,
                    `${cantidad} ${ing.unidad || 'kg'}`,
                    `${precio.toFixed(2)}€`,
                    `${subtotal.toFixed(2)}€`,
                ]);
            }
        });
    }

    // Usar autoTable para tabla profesional
    doc.autoTable({
        startY: yPos,
        head: [['Ingrediente', 'Cantidad', 'Precio/Unidad', 'Subtotal']],
        body: ingredientesData,
        theme: 'striped',
        headStyles: {
            fillColor: colorPrimary,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
            halign: 'left',
        },
        bodyStyles: {
            fontSize: 9,
            textColor: colorText,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 40, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
        },
        margin: { left: 20, right: 20 },
    });

    // === RESUMEN FINANCIERO ===
    yPos = doc.lastAutoTable.finalY + 15;

    doc.setDrawColor(...colorPrimary);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);

    yPos += 12;

    const precioVenta = receta.precio_venta || 0;
    const margen = precioVenta > 0 ? ((precioVenta - costoTotal) / precioVenta) * 100 : 0;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colorText);

    doc.text(`COSTE TOTAL:`, 20, yPos);
    doc.text(`${costoTotal.toFixed(2)}€`, 100, yPos, { align: 'right' });

    yPos += 8;
    doc.text(`PRECIO VENTA:`, 20, yPos);
    doc.setTextColor(16, 185, 129); // Verde
    doc.text(`${precioVenta.toFixed(2)}€`, 100, yPos, { align: 'right' });

    yPos += 8;
    doc.setTextColor(...colorText);
    doc.text(`BENEFICIO:`, 20, yPos);
    const beneficio = precioVenta - costoTotal;
    doc.setTextColor(beneficio >= 0 ? [16, 185, 129] : [239, 68, 68]);
    doc.text(`${beneficio.toFixed(2)}€`, 100, yPos, { align: 'right' });

    yPos += 8;
    doc.setTextColor(...colorText);
    doc.text(`MARGEN:`, 20, yPos);
    // Colores basados en Food Cost: ≤28% verde brillante, ≤33% verde, ≤38% amarillo, >38% rojo
    const foodCost = precioVenta > 0 ? (costoTotal / precioVenta) * 100 : 100;
    doc.setTextColor(
        foodCost <= 28
            ? [5, 150, 105]
            : foodCost <= 33
                ? [16, 185, 129]
                : foodCost <= 38
                    ? [245, 158, 11]
                    : [239, 68, 68]
    );
    doc.text(`${margen.toFixed(1)}%`, 100, yPos, { align: 'right' });

    // === FOOTER ===
    const fechaActual = new Date().toLocaleDateString('es-ES');
    doc.setFontSize(8);
    doc.setTextColor(...colorSecondary);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el ${fechaActual} por MindLoop CostOS`, 105, 280, { align: 'center' });

    // Descargar PDF
    const nombreArchivo = `Receta_${receta.nombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    doc.save(nombreArchivo);

    return doc;
}

/**
 * Genera PDF de lista completa de ingredientes
 * @param {Array} ingredientes - Array de ingredientes
 */
export async function generarPDFIngredientes(ingredientes) {
    await loadPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const colorPrimary = [255, 107, 53];
    const colorText = [30, 41, 59];
    const colorSecondary = [100, 116, 139];

    // Header
    doc.setFillColor(...colorPrimary);
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE INGREDIENTES', 105, 22, { align: 'center' });

    // Datos tabla
    const data = ingredientes.map(ing => [
        ing.nombre,
        ing.unidad || 'kg',
        `${(ing.precio || 0).toFixed(2)}€`,
        `${(ing.stock_actual || 0).toFixed(2)}`,
        ing.proveedor?.nombre || 'N/A',
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Ingrediente', 'Unidad', 'Precio', 'Stock', 'Proveedor']],
        body: data,
        theme: 'striped',
        headStyles: {
            fillColor: colorPrimary,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: 'bold',
        },
        bodyStyles: {
            fontSize: 9,
            textColor: colorText,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
        },
    });

    // Footer
    const fechaActual = new Date().toLocaleDateString('es-ES');
    doc.setFontSize(8);
    doc.setTextColor(...colorSecondary);
    doc.text(`Generado el ${fechaActual}`, 105, 280, { align: 'center' });

    doc.save(`Ingredientes_${Date.now()}.pdf`);
    return doc;
}

/**
 * Expone funciones globalmente para compatibilidad
 */
if (typeof window !== 'undefined') {
    window.generarPDFReceta = generarPDFReceta;
    window.generarPDFIngredientes = generarPDFIngredientes;
}
