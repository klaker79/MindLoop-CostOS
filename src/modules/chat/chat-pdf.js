/**
 * Chat — Exportar mensaje a PDF profesional.
 *
 * Renderiza un informe A4 con header/footer de marca, tablas markdown,
 * headers, bullets, listas numeradas, blockquotes y separadores — sin
 * dependencia de jsPDF autoTable. jsPDF helvetica no soporta emoji, así
 * que se limpia a ASCII + Latin-1 (acentos y € preservados).
 *
 * Se expone en `window.exportMessageToPDF` porque los botones inline
 * (onclick) en chat-messages lo invocan por nombre global.
 */

import { loadPDF } from '../../utils/lazy-vendors.js';
import { getDateLocale } from '../../utils/helpers.js';
import { t } from '@/i18n/index.js';

/**
 * Exporta un mensaje del chat a PDF.
 * @param {string} rawText - Texto raw del mensaje (markdown)
 */
export async function exportMessageToPDF(rawText) {
    try {
        window.showToast?.(t('chat:pdf_generating'), 'info');

        await loadPDF();
        const { jsPDF } = window.jspdf;

        const restaurante = window.getRestaurantName ? window.getRestaurantName() : 'Mi Restaurante';
        // 🔒 Auditoría Capa 7 (S9): locale dinámico (incluye 'zh')
        const fecha = new Date().toLocaleDateString(getDateLocale(), {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const C = {
            primary: [102, 126, 234],
            primaryDark: [79, 70, 229],
            accent: [139, 92, 246],
            text: [30, 41, 59],
            textMuted: [100, 116, 139],
            textLight: [148, 163, 184],
            border: [226, 232, 240],
            zebra: [248, 250, 252],
            white: [255, 255, 255]
        };

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 18;
        const contentTop = 50;
        const contentBottom = pageHeight - 18;
        const usableWidth = pageWidth - margin * 2;

        function cleanText(text) {
            if (!text) return '';
            return text
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/__(.+?)__/g, '$1')
                .replace(/_(.+?)_/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/^\s*[-*]\s+/, '')
                .replace(/^\s*>\s*/, '')
                .replace(/^#{1,6}\s*/, '')
                .replace(/[^\x20-\x7E\xA0-\xFF]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function drawHeader() {
            doc.setFillColor(...C.primary);
            doc.rect(0, 0, pageWidth, 28, 'F');
            doc.setFillColor(...C.accent);
            doc.rect(0, 28, pageWidth, 2, 'F');

            doc.setTextColor(...C.white);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.text(restaurante, margin, 14);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(t('chat:pdf_subtitle') || 'Business Intelligence Report', margin, 22);

            doc.setFontSize(9);
            doc.text(fecha, pageWidth - margin, 22, { align: 'right' });
        }

        function drawFooter(pageNum, totalPages) {
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.3);
            doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

            doc.setFontSize(8);
            doc.setTextColor(...C.textLight);
            doc.setFont('helvetica', 'normal');
            doc.text(restaurante, margin, pageHeight - 8);
            doc.text('MindLoop CostOS', pageWidth / 2, pageHeight - 8, { align: 'center' });
            doc.text(`${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
        }

        let y = contentTop;

        function ensureSpace(needed) {
            if (y + needed > contentBottom) {
                doc.addPage();
                drawHeader();
                y = contentTop;
            }
        }

        drawHeader();

        function renderHorizontalRule() {
            ensureSpace(8);
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.4);
            doc.line(margin, y + 2, pageWidth - margin, y + 2);
            y += 6;
        }

        function measureRowHeight(cells, colWidths, fontSize) {
            doc.setFontSize(fontSize);
            let maxLines = 1;
            cells.forEach((cell, idx) => {
                const w = colWidths[idx] - 4;
                const wrapped = doc.splitTextToSize(cleanText(cell) || '', w);
                if (wrapped.length > maxLines) maxLines = wrapped.length;
            });
            return Math.max(8, maxLines * 4.5 + 3);
        }

        function renderTable(headers, rows) {
            const colCount = headers.length;
            if (colCount === 0) return;
            const colWidths = new Array(colCount).fill(usableWidth / colCount);

            const headerHeight = measureRowHeight(headers, colWidths, 9);
            ensureSpace(headerHeight + 10);
            doc.setFillColor(...C.primary);
            doc.rect(margin, y, usableWidth, headerHeight, 'F');
            doc.setTextColor(...C.white);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            headers.forEach((h, idx) => {
                const x = margin + colWidths.slice(0, idx).reduce((s, w) => s + w, 0);
                const text = cleanText(h);
                const wrapped = doc.splitTextToSize(text, colWidths[idx] - 4);
                doc.text(wrapped, x + 2, y + 5.5);
            });
            y += headerHeight;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...C.text);
            rows.forEach((row, rowIdx) => {
                const rowHeight = measureRowHeight(row, colWidths, 9);
                ensureSpace(rowHeight + 2);
                if (rowIdx % 2 === 0) {
                    doc.setFillColor(...C.zebra);
                    doc.rect(margin, y, usableWidth, rowHeight, 'F');
                }
                doc.setDrawColor(...C.border);
                doc.setLineWidth(0.15);
                doc.line(margin, y + rowHeight, margin + usableWidth, y + rowHeight);
                row.forEach((cell, idx) => {
                    const x = margin + colWidths.slice(0, idx).reduce((s, w) => s + w, 0);
                    const text = cleanText(cell);
                    const wrapped = doc.splitTextToSize(text, colWidths[idx] - 4);
                    doc.text(wrapped, x + 2, y + 5);
                });
                y += rowHeight;
            });
            y += 4;
        }

        const lines = rawText.split('\n');
        let i = 0;
        while (i < lines.length) {
            const raw = lines[i];
            const line = raw.trim();

            if (/^[-*_]{3,}$/.test(line)) {
                renderHorizontalRule();
                i++;
                continue;
            }

            if (i + 1 < lines.length && raw.includes('|') &&
                /^[\s\-:|]+$/.test(lines[i + 1].trim()) && lines[i + 1].includes('|')) {
                const tableLines = [];
                let j = i;
                while (j < lines.length) {
                    const tline = lines[j];
                    if (!tline.includes('|') && tableLines.length > 0) break;
                    if (!/^[\s\-:|]+$/.test(tline.trim())) tableLines.push(tline);
                    j++;
                }
                if (tableLines.length >= 2) {
                    const parseCells = l => l.split('|').map(c => c.trim()).filter((c, idx, arr) => {
                        if (idx === 0 && c === '') return false;
                        if (idx === arr.length - 1 && c === '') return false;
                        return true;
                    });
                    const headers = parseCells(tableLines[0]);
                    const rows = tableLines.slice(1).map(parseCells);
                    if (headers.length > 0 && rows.length > 0) {
                        renderTable(headers, rows);
                    }
                }
                i = j;
                continue;
            }

            if (!line) {
                y += 3;
                i++;
                continue;
            }

            const cleaned = cleanText(line);
            if (!cleaned) { i++; continue; }

            const headerLvl = (line.match(/^(#{1,6})\s/) || [null, ''])[1].length;
            if (headerLvl > 0) {
                const size = headerLvl === 1 ? 15 : headerLvl === 2 ? 13 : 11;
                ensureSpace(size + 4);
                if (headerLvl <= 2) {
                    doc.setFillColor(...C.primary);
                    doc.rect(margin, y - size * 0.55, 1.2, size * 0.85, 'F');
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(size);
                doc.setTextColor(...C.primary);
                const wrapped = doc.splitTextToSize(cleaned, usableWidth - 4);
                doc.text(wrapped, margin + (headerLvl <= 2 ? 4 : 0), y);
                y += wrapped.length * (size * 0.42) + 3;
                doc.setTextColor(...C.text);
                i++;
                continue;
            }

            if (line.startsWith('>')) {
                const text = cleanText(line.replace(/^>+\s*/, ''));
                if (text) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9.5);
                    doc.setTextColor(...C.textMuted);
                    const wrapped = doc.splitTextToSize(text, usableWidth - 6);
                    const blockHeight = wrapped.length * 5 + 2;
                    ensureSpace(blockHeight);
                    doc.setFillColor(...C.accent);
                    doc.rect(margin, y - 3, 1.5, blockHeight, 'F');
                    doc.text(wrapped, margin + 4, y + 1);
                    y += blockHeight + 1;
                    doc.setTextColor(...C.text);
                    doc.setFont('helvetica', 'normal');
                }
                i++;
                continue;
            }

            if (/^[-*•]\s+/.test(line)) {
                const text = cleanText(line);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...C.text);
                const wrapped = doc.splitTextToSize(text, usableWidth - 6);
                ensureSpace(wrapped.length * 5 + 1);
                doc.setFillColor(...C.primary);
                doc.circle(margin + 1.5, y - 1.2, 0.8, 'F');
                doc.text(wrapped, margin + 5, y);
                y += wrapped.length * 5 + 1;
                i++;
                continue;
            }

            const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
            if (numMatch) {
                const num = numMatch[1];
                const text = cleanText(numMatch[2]);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...C.primaryDark);
                doc.text(`${num}.`, margin, y);
                doc.setTextColor(...C.text);
                const wrapped = doc.splitTextToSize(text, usableWidth - 8);
                ensureSpace(wrapped.length * 5 + 1);
                doc.text(wrapped, margin + 7, y);
                y += wrapped.length * 5 + 1;
                i++;
                continue;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...C.text);
            const wrapped = doc.splitTextToSize(cleaned, usableWidth);
            ensureSpace(wrapped.length * 5 + 1);
            doc.text(wrapped, margin, y);
            y += wrapped.length * 5 + 1;
            i++;
        }

        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            drawFooter(p, totalPages);
        }

        const fechaFile = new Date().toISOString().split('T')[0];
        const nombreFile = restaurante.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        doc.save(`Report_${nombreFile}_${fechaFile}.pdf`);
        window.showToast?.(t('chat:pdf_downloaded'), 'success');
    } catch (error) {
        console.error('Error generando PDF:', error);
        window.showToast?.(t('chat:pdf_error') + ': ' + error.message, 'error');
    }
}

// Exponer global para onclick inline en botones del chat
window.exportMessageToPDF = exportMessageToPDF;
