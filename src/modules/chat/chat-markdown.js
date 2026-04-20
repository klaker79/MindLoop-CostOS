/**
 * Chat — Parser Markdown a HTML.
 *
 * Soporta tablas markdown (| col | col |), negritas (**texto**), código inline
 * (`código`), listas (• item) y emojis-título. Escapa HTML en celdas y contenido
 * antes de formatear. Pure functions: sin estado, sin DOM, sin dependencias.
 */

/**
 * Parsea markdown a HTML: detecta tabla si hay separador (|---|---|),
 * y fallback a `formatTextContent` para el resto.
 */
export function parseMarkdown(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let tableStartIndex = -1;
    let tableEndIndex = -1;
    let hasSeparator = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(line) || /^[-|:\s]+$/.test(line)) {
            if (tableStartIndex === -1 && i > 0) tableStartIndex = i - 1;
            hasSeparator = true;
            continue;
        }

        if (line.includes('|') && hasSeparator) {
            tableEndIndex = i;
        } else if (line.includes('|') && tableStartIndex === -1) {
            tableStartIndex = i;
        } else if (!line.includes('|') && tableEndIndex > tableStartIndex) {
            break;
        }
    }

    if (hasSeparator && tableStartIndex >= 0 && tableEndIndex > tableStartIndex) {
        const beforeTable = lines.slice(0, tableStartIndex).join('\n');
        const tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
        const afterTable = lines.slice(tableEndIndex + 1).join('\n');

        let tableHtml = '<div class="chat-table-wrapper"><table class="chat-table"><tbody>';
        let isHeader = true;

        for (const line of tableLines) {
            if (/^[\s\-:|]+$/.test(line.trim())) continue;
            if (/^\|?[\s\-:]+\|/.test(line.trim())) continue;

            const cells = line
                .split('|')
                .map(c => c.trim())
                .filter(c => c !== '');

            if (cells.length > 0) {
                const tag = isHeader ? 'th' : 'td';
                tableHtml += '<tr>' + cells.map(c => {
                    const safeCell = c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    return `<${tag}>${safeCell}</${tag}>`;
                }).join('') + '</tr>';
                isHeader = false;
            }
        }

        tableHtml += '</tbody></table></div>';

        return formatTextContent(beforeTable) + tableHtml + formatTextContent(afterTable);
    }

    return formatTextContent(text);
}

/**
 * Formatea texto plano (negritas, código inline, listas, emojis-título,
 * saltos de línea). Escapa HTML antes de aplicar reemplazos.
 */
function formatTextContent(text) {
    if (!text) return '';

    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

    html = html.replace(/•\s+([^\n]+)/g, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul class="chat-list">$&</ul>');

    html = html.replace(
        // eslint-disable-next-line no-misleading-character-class -- intentional: emoji character class
        /([📊💰📦📈🏪🎯✅❌⚠️🔴🟢🟡])\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]*:)/gu,
        '<strong>$1 $2</strong>'
    );

    html = html.replace(/\n/g, '<br>');

    return html;
}
