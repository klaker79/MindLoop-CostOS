// ========== INVENTARIO MASIVO ==========
//
// Soporta 2 formatos de Excel:
//
//   A) Plantilla nativa (legacy):
//      Cabecera "Ingrediente" + "Stock Real". Match por nombre exacto.
//
//   B) Excel del cliente (flexible):
//      Detección automática de columnas Name / Stock / Código TPV / Formato.
//      Match por código TPV vía recetas-variants → fallback a nombre exacto
//      → fallback a fuzzy/tokens. Si la fila trae Formato y coincide con el
//      formato_compra del ingrediente, multiplica por cantidad_por_formato
//      (ej. 0.5 BARRIL → 15 L).
//
// La elección es transparente: si la cabecera del Excel matchea la plantilla
// nativa se usa el flujo legacy (compatible 100%). Si no, se aplica el
// parser flexible. La capa de subida al backend (consolidateStock) NO cambia.
//
// IMPORTANTE: este archivo se carga como <script> plano (no ESM), por eso
// NO usamos `import`. Las funciones del parser viven en window.__inventarioFlexible,
// expuestas desde main.js (que sí es módulo ES6) para evitar romper el script.

// Función anti-XSS: Sanitiza datos de usuario antes de insertarlos en HTML
/* global cm -- defined via window.cm in main.js */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char] || char);
}

// Null-safe para togglear la clase 'active' sin reventar si el elemento no está
// en el DOM (regla DOM Safety de CLAUDE.md). Evita el TypeError de Sentry
// "Cannot read properties of null (reading 'classList')".
function setClaseInventario(id, accion) {
    const el = document.getElementById(id);
    if (el) el.classList[accion]('active');
}

let datosInventarioMasivo = [];

window.mostrarModalInventarioMasivo = function () {
    setClaseInventario('modal-inventario-masivo', 'add');
    document.getElementById('preview-inventario-masivo').style.display = 'none';
    document.getElementById('file-inventario-masivo').value = '';
};

window.procesarArchivoInventario = async function (input) {
    const file = input.files[0];
    if (!file) return;

    setClaseInventario('loading-overlay', 'add');

    try {
        const data = await leerArchivoInventario(file);
        datosInventarioMasivo = await validarDatosInventario(data);
        mostrarPreviewInventario(datosInventarioMasivo);
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

async function leerArchivoInventario(file) {
    if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
        await window.loadXLSX();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                if (rows.length < 2) {
                    reject(
                        new Error('El archivo debe tener al menos 2 filas (encabezado + datos)')
                    );
                    return;
                }

                const headers = rows[0] || [];
                const useLegacy = window.__inventarioFlexible.isLegacyTemplate(headers);

                if (useLegacy) {
                    // Flujo legacy: 100% compatible con plantilla nativa
                    const result = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i];
                        if (row[0] && row[1] !== undefined && row[1] !== null && row[1] !== '') {
                            result.push({
                                __mode: 'legacy',
                                ingrediente: String(row[0]).trim(),
                                stockReal: parseFloat(row[1]),
                            });
                        }
                    }
                    if (result.length === 0) {
                        reject(new Error('No se encontraron datos válidos en el archivo'));
                        return;
                    }
                    resolve(result);
                    return;
                }

                // Flujo flexible: detectar columnas
                const cols = window.__inventarioFlexible.detectColumns(headers);
                if (cols.ambiguous.length > 0) {
                    reject(new Error(
                        'No se pudieron detectar las columnas: ' + cols.ambiguous.join(', ') +
                        '. Revisa la cabecera o usa la plantilla descargable.'
                    ));
                    return;
                }
                const parsed = window.__inventarioFlexible.parseFlexibleRows(rows, cols);
                if (parsed.length === 0) {
                    reject(new Error('No se encontraron filas con stock numérico en el archivo'));
                    return;
                }
                // Marcar para validarDatosInventario sepa qué flujo usar
                parsed.forEach(p => { p.__mode = 'flexible'; });
                parsed.__cols = cols;
                resolve(parsed);
            } catch (error) {
                reject(new Error('Error leyendo el archivo: ' + error.message));
            }
        };

        reader.onerror = () => reject(new Error('Error leyendo el archivo'));
        reader.readAsArrayBuffer(file);
    });
}

async function validarDatosInventario(data) {
    const ingredientesActuales = window.ingredientes || (await api.getIngredientes());

    // Detectar modo en base al primer item — leerArchivoInventario marca __mode
    const isFlexible = data.some(d => d.__mode === 'flexible');

    if (!isFlexible) {
        return data.map(item => validarLegacy(item, ingredientesActuales));
    }

    // Modo flexible: cargar variantes del restaurante para matching por código TPV
    const variantes = await cargarVariantesParaMatching();
    const recetasById = new Map((window.recetas || []).map(r => [r.id, r]));
    const codeIndex = window.__inventarioFlexible.buildCodeIndex(variantes, recetasById);
    const nameIndex = window.__inventarioFlexible.buildNameIndex(ingredientesActuales);
    const ctx = { ingredientes: ingredientesActuales, codeIndex, nameIndex };

    return data.map(row => validarFlexible(row, ctx));
}

function validarLegacy(item, ingredientes) {
    const ing = ingredientes.find(
        i => i.nombre.toLowerCase() === item.ingrediente.toLowerCase()
    );
    return {
        ...item,
        ingredienteId: ing ? ing.id : null,
        stockVirtual: ing ? parseFloat(ing.stock_actual || ing.stock_virtual || 0) : 0,
        stockActual: ing ? parseFloat(ing.stock_actual || ing.stock_virtual || 0) : null,
        valido: !!ing && !isNaN(item.stockReal) && item.stockReal >= 0,
        error: !ing
            ? 'Ingrediente no encontrado'
            : isNaN(item.stockReal)
                ? 'Stock inválido'
                : item.stockReal < 0
                    ? 'Stock no puede ser negativo'
                    : null,
    };
}

function validarFlexible(row, ctx) {
    const matched = window.__inventarioFlexible.matchRow(row, ctx);
    if (!matched) {
        return {
            ingrediente: row.name || row.codigo || '(sin identificar)',
            stockReal: row.stock,
            stockActual: null,
            stockVirtual: 0,
            ingredienteId: null,
            valido: false,
            error: 'No se encontró el ingrediente en BBDD',
            __matchMethod: null,
        };
    }
    const ing = matched.ingrediente;
    const conv = window.__inventarioFlexible.convertToBaseUnit(row.stock, row.formato, ing);
    const stockBase = conv.stockBase;
    const stockActual = parseFloat(ing.stock_actual || ing.stock_virtual || 0);
    return {
        ingrediente: ing.nombre,
        stockReal: stockBase,
        stockActual,
        stockVirtual: stockActual,
        ingredienteId: ing.id,
        valido: !isNaN(stockBase) && stockBase >= 0,
        error: isNaN(stockBase)
            ? 'Stock inválido'
            : stockBase < 0
                ? 'Stock no puede ser negativo'
                : null,
        __matchMethod: matched.method,
        __formatApplied: conv.applied,
        __formatFactor: conv.factor,
        __originalStock: row.stock,
        __originalFormato: row.formato,
    };
}

/**
 * Carga las variantes del restaurante. Solo necesario para matching por
 * código TPV en modo flexible. Si el endpoint falla (plan insuficiente
 * o red caída) seguimos con array vacío y caemos al matching por nombre.
 */
async function cargarVariantesParaMatching() {
    try {
        if (window.api && typeof window.api.getRecipesVariants === 'function') {
            return await window.api.getRecipesVariants();
        }
        const baseUrl = (window.appConfig && window.appConfig.apiBaseUrl) ||
            (typeof window !== 'undefined' && window.API_BASE_URL) || '';
        const token = sessionStorage.getItem('_at') || window.authToken || '';
        const res = await fetch(`${baseUrl}/recipes-variants`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
        });
        if (!res.ok) return [];
        return await res.json();
    } catch (_e) {
        return [];
    }
}

// Función auxiliar para descargar Excel
async function descargarExcel(datos, filename, sheetName) {
    // XLSX es lazy — cargarlo si aún no está
    if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
        await window.loadXLSX();
    }
    if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.write) {
        const ws = XLSX.utils.json_to_sheet(datos);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Plantilla');

        ws['!cols'] = [{ wch: 35 }, { wch: 15 }];

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        showToast('✓ Descargado: ' + filename, 'success');
        return true;
    }
    return false;
}

/**
 * Construye una fila de plantilla con las 4 columnas:
 *   - Ingrediente
 *   - Cuenta en: descriptivo humano ("garrafa de 5 L" / "kg" / "ud").
 *     El parser flexible IGNORA esta columna — es solo guía visual.
 *   - Formato: valor EXACTO de `ing.formato_compra` (ej. "garrafa").
 *     Si el usuario mantiene este valor, el parser flexible interpreta
 *     "Stock Real" como cantidad en formato y multiplica por
 *     cantidad_por_formato. Si lo edita o lo borra, asume unidad base.
 *   - Stock Real: vacío para que el usuario lo rellene tras contar.
 *
 * Si el ingrediente NO tiene `formato_compra` (o cpf<=1), tanto "Cuenta en"
 * como "Formato" reflejan la unidad base sola; el stock se interpreta
 * directamente en unidad base (kg/L/ud).
 */
function _filaPlantillaInventario(ing) {
    const cpf = parseFloat(ing.cantidad_por_formato);
    const tieneFormatoReal = ing.formato_compra
        && Number.isFinite(cpf)
        && cpf > 1;
    const unidad = (ing.unidad || 'ud').trim();
    const cuentaEn = tieneFormatoReal
        ? `${ing.formato_compra} de ${cpf} ${unidad}`
        : unidad;
    return {
        Ingrediente: ing.nombre,
        'Cuenta en': cuentaEn,
        'Formato': tieneFormatoReal ? ing.formato_compra : '',
        'Stock Real': ''
    };
}

// Descargar plantilla COMPLETA (todos los ingredientes)
window.descargarPlantillaStock = async function () {
    try {
        if (!window.ingredientes || window.ingredientes.length === 0) {
            showToast('No hay ingredientes para descargar', 'warning');
            return;
        }

        const datos = window.ingredientes.map(_filaPlantillaInventario);

        const filename = `Plantilla_Inventario_COMPLETO_${new Date().toISOString().split('T')[0]}.xlsx`;
        if (!(await descargarExcel(datos, filename, 'Todos'))) {
            showToast('Error: XLSX no disponible', 'error');
        }
    } catch (error) {
        console.error('Error descargando plantilla:', error);
        showToast('Error: ' + error.message, 'error');
    }
};

// Descargar plantilla solo ALIMENTOS
window.descargarPlantillaAlimentos = async function () {
    try {
        if (!window.ingredientes || window.ingredientes.length === 0) {
            showToast('No hay ingredientes', 'warning');
            return;
        }

        const alimentos = window.ingredientes.filter(ing =>
            (ing.familia || 'alimento').toLowerCase() === 'alimento'
        );

        if (alimentos.length === 0) {
            showToast('No hay alimentos registrados', 'warning');
            return;
        }

        const datos = alimentos.map(_filaPlantillaInventario);

        const filename = `Plantilla_ALIMENTOS_${new Date().toISOString().split('T')[0]}.xlsx`;
        if (!(await descargarExcel(datos, filename, 'Alimentos'))) {
            showToast('Error: XLSX no disponible', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
    }
};

// Descargar plantilla solo BEBIDAS
window.descargarPlantillaBebidas = async function () {
    try {
        if (!window.ingredientes || window.ingredientes.length === 0) {
            showToast('No hay ingredientes', 'warning');
            return;
        }

        const bebidas = window.ingredientes.filter(ing =>
            (ing.familia || '').toLowerCase() === 'bebida'
        );

        if (bebidas.length === 0) {
            showToast('No hay bebidas registradas', 'warning');
            return;
        }

        const datos = bebidas.map(_filaPlantillaInventario);

        const filename = `Plantilla_BEBIDAS_${new Date().toISOString().split('T')[0]}.xlsx`;
        if (!(await descargarExcel(datos, filename, 'Bebidas'))) {
            showToast('Error: XLSX no disponible', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error: ' + error.message, 'error');
    }
};

function mostrarPreviewInventario(datos) {
    setClaseInventario('loading-overlay', 'remove');

    const validos = datos.filter(d => d.valido).length;
    const invalidos = datos.filter(d => !d.valido).length;

    let html = `
                <div style="margin-bottom: 15px; padding: 10px; background: #f8fafc; border-radius: 6px;">
                    <strong>Resumen:</strong> 
                    <span style="color: #10b981; margin-left: 10px;">✓ ${validos} válidos</span>
                    ${invalidos > 0 ? `<span style="color: #ef4444; margin-left: 10px;">✗ ${invalidos} con errores</span>` : ''}
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Estado</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Ingrediente</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Stock Actual</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e2e8f0;">Stock Nuevo</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e2e8f0;">Observación</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

    datos.forEach(item => {
        const bgColor = item.valido ? '#f0fdf4' : '#fef2f2';
        const icon = item.valido ? '✓' : '✗';
        const iconColor = item.valido ? '#10b981' : '#ef4444';

        // Observación enriquecida para modo flexible: método de match y
        // conversión de formato si aplicó.
        let observacion = item.error || 'OK';
        if (item.valido && item.__matchMethod) {
            const labels = {
                codigo_tpv: 'Match: código TPV',
                nombre_exacto: 'Match: nombre exacto',
                nombre_fuzzy: 'Match: nombre parcial',
                nombre_tokens: 'Match: nombre por palabras',
            };
            observacion = labels[item.__matchMethod] || 'OK';
            if (item.__formatApplied) {
                observacion += ` · ${item.__originalStock} ${item.__originalFormato} × ${item.__formatFactor} = ${item.stockReal}`;
            }
        }

        html += `
                    <tr style="background: ${bgColor};">
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: ${iconColor}; font-size: 18px;">${icon}</span>
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${escapeHTML(item.ingrediente)}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">
                            ${item.stockActual !== null ? item.stockActual : '-'}
                        </td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">
                            ${item.stockReal}
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: ${item.valido ? '#10b981' : '#ef4444'}; font-size: 12px;">
                            ${escapeHTML(observacion)}
                        </td>
                    </tr>
                `;
    });

    html += `
                    </tbody>
                </table>
            `;

    document.getElementById('preview-table-container').innerHTML = html;
    document.getElementById('preview-inventario-masivo').style.display = 'block';

    // Guardrail: si estamos en modo flexible y MENOS del 50% matchea, lo más
    // probable es que la cabecera del Excel se haya detectado mal (columnas
    // confundidas) o que sea de otro restaurante. Mejor parar que subir
    // 100 filas con stock=0 a ingredientes equivocados.
    const totalRows = datosInventarioMasivo.length;
    const validRows = datosInventarioMasivo.filter(d => d.valido).length;
    const enModoFlexible = datosInventarioMasivo.some(d => d.__matchMethod !== undefined);
    const ratioMatch = totalRows > 0 ? validRows / totalRows : 0;
    const guardrailFalla = enModoFlexible && ratioMatch < 0.5 && totalRows >= 5;

    if (guardrailFalla) {
        const aviso = document.createElement('div');
        aviso.style.cssText = 'background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 12px; color: #78350f;';
        aviso.innerHTML = `<strong>⚠️ Cabecera del Excel sospechosa</strong><br>
            Solo ${validRows} de ${totalRows} filas (${Math.round(ratioMatch * 100)}%) coinciden con
            ingredientes de tu restaurante. Suele indicar que las columnas del Excel
            no se han detectado bien o que el archivo es de otro tenant. Revisa la
            cabecera o usa la plantilla descargable antes de confirmar.`;
        document.getElementById('preview-table-container').prepend(aviso);
    }

    const hayValidos = validRows > 0;
    const btnConfirmar = document.getElementById('btn-confirmar-masivo');
    btnConfirmar.disabled = !hayValidos || guardrailFalla;
    if (!hayValidos || guardrailFalla) {
        btnConfirmar.style.opacity = '0.5';
        btnConfirmar.style.cursor = 'not-allowed';
    } else {
        btnConfirmar.style.opacity = '1';
        btnConfirmar.style.cursor = 'pointer';
    }
}

window.confirmarInventarioMasivo = async function () {
    const datosValidos = datosInventarioMasivo.filter(d => d.valido);

    if (datosValidos.length === 0) {
        window.showToast('No hay datos válidos para actualizar', 'error');
        return;
    }

    // Split en dos buckets:
    //   - mermasDetectadas: stock_real < stock_virtual → registrar como merma
    //     real en la tabla `mermas` (descuenta stock + queda en histórico).
    //   - ajustesPositivos: stock_real >= stock_virtual → consolidateStock
    //     (sube stock_actual al valor contado).
    // ANTES llamábamos consolidateStock para TODO y luego resetMermas, que
    // (a) NO registraba las nuevas pérdidas en histórico, y (b) restauraba
    // el stock de las mermas previas inflando el conteo del usuario.
    // Bug reportado por Iker 2026-05-12 con la cebolla.
    const inventario = Array.isArray(window.inventarioCompleto) ? window.inventarioCompleto : [];
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];
    const inventarioMap = new Map(inventario.map(i => [i.id, i]));
    const ingredientesMap = new Map(ingredientes.map(i => [i.id, i]));

    const mermasDetectadas = [];
    const ajustesPositivos = [];

    datosValidos.forEach(d => {
        if (d.stockReal < d.stockVirtual) {
            const ing = ingredientesMap.get(d.ingredienteId) || {};
            const inv = inventarioMap.get(d.ingredienteId) || {};
            const cantidad = +(d.stockVirtual - d.stockReal).toFixed(4);
            // Precio unitario (€/unidad-base) por la función CANÓNICA (respeta el
            // precio fijado 📌 y la prioridad estándar precio_medio_compra >
            // precio_medio > precio/cpf). Antes replicaba la cascada a mano y un
            // ingrediente con precio fijado valoraba su merma con la media de
            // compras (auditoría 2026-07-09). Fallback inline solo si el puente
            // window no está (no debería ocurrir: main.js lo registra al boot).
            let precioUnit;
            if (typeof window.getIngredientUnitPrice === 'function') {
                precioUnit = parseFloat(window.getIngredientUnitPrice(inv, ing)) || 0;
            } else {
                precioUnit = parseFloat(inv.precio_medio_compra) || 0;
                if (!precioUnit) precioUnit = parseFloat(inv.precio_medio) || 0;
                if (!precioUnit && ing.precio && ing.cantidad_por_formato > 0) {
                    precioUnit = parseFloat(ing.precio) / parseFloat(ing.cantidad_por_formato);
                }
            }
            mermasDetectadas.push({
                ingredienteId: d.ingredienteId,
                ingredienteNombre: d.ingrediente,
                cantidad,
                unidad: ing.unidad || 'ud',
                valorPerdida: +(cantidad * precioUnit).toFixed(2),
                motivo: 'Ajuste de inventario',
                nota: `Detectada en subida de Excel — ${new Date().toLocaleDateString('es-ES')}`
            });
        } else {
            ajustesPositivos.push({
                id: d.ingredienteId,
                stock_real: d.stockReal,
            });
        }
    });

    let mensaje = `¿Confirmar actualización de ${datosValidos.length} ingredientes?`;
    if (mermasDetectadas.length > 0) {
        const valorTotal = mermasDetectadas.reduce((s, m) => s + m.valorPerdida, 0);
        mensaje += `\n\n⚠️ ${mermasDetectadas.length} mermas detectadas (valor estimado: ${valorTotal.toFixed(2)}€).\nSe registrarán en el Historial de Mermas con motivo "Ajuste de inventario".`;
    }
    if (ajustesPositivos.length > 0) {
        mensaje += `\n\n${ajustesPositivos.length} ingredientes con stock real ≥ sistema: se ajustarán al alza.`;
    }

    if (!confirm(mensaje)) {
        return;
    }

    setClaseInventario('loading-overlay', 'add');

    try {
        // 1. Registrar mermas (cada una descuenta stock_actual en backend).
        if (mermasDetectadas.length > 0) {
            await window.api.createMermas(mermasDetectadas);
        }

        // 2. Ajustes positivos (subir stock al valor contado).
        if (ajustesPositivos.length > 0) {
            await window.api.consolidateStock([], [], ajustesPositivos);
        }

        setClaseInventario('loading-overlay', 'remove');
        const resumen = mermasDetectadas.length > 0
            ? `✓ ${datosValidos.length} ingredientes (${mermasDetectadas.length} merma(s) registradas)`
            : `✓ ${datosValidos.length} ingredientes actualizados`;
        window.showToast(resumen, 'success');

        setClaseInventario('modal-inventario-masivo', 'remove');
        await window.cargarDatos();
        await window.renderizarInventario();
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error actualizando inventario: ' + error.message, 'error');
    }
};

window.cancelarInventarioMasivo = function () {
    setClaseInventario('modal-inventario-masivo', 'remove');
    datosInventarioMasivo = [];
};

// ========== IMPORTAR INGREDIENTES ==========
let datosImportarIngredientes = [];

window.mostrarModalImportarIngredientes = function () {
    setClaseInventario('modal-importar-ingredientes', 'add');
    document.getElementById('preview-importar-ingredientes').style.display = 'none';
    document.getElementById('file-importar-ingredientes').value = '';
    datosImportarIngredientes = [];
};

window.procesarArchivoIngredientes = async function (input) {
    const file = input.files[0];
    if (!file) return;

    setClaseInventario('loading-overlay', 'add');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarIngredientes = validarDatosIngredientes(data);
        mostrarPreviewIngredientes(datosImportarIngredientes);
        setClaseInventario('loading-overlay', 'remove');
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

async function leerArchivoGenerico(file) {
    if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
        await window.loadXLSX();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                resolve(jsonData);
            } catch (err) {
                reject(new Error('Error leyendo archivo Excel'));
            }
        };

        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsArrayBuffer(file);
    });
}

function validarDatosIngredientes(data) {
    // 🧪 Lógica EXTRAÍDA a src/utils/ingredientes-parser.js con tests defensivos
    // en src/__tests__/utils/ingredientes-parser.test.js. La función de aquí es
    // un thin wrapper que inyecta window.ingredientes y window.proveedores como
    // dependencias. Fallback a la implementación inline si el módulo ESM no
    // está cargado (por ejemplo, en tests legacy que no arrancan main.js).
    if (window.__importParsers && typeof window.__importParsers.parseIngredientes === 'function') {
        return window.__importParsers.parseIngredientes(
            data,
            window.ingredientes || [],
            window.proveedores || []
        );
    }
    // ----- FALLBACK histórico (mantenido por seguridad) -----
    const existentesMap = new Map(
        (window.ingredientes || []).map(i => [String(i.nombre || '').trim().toLowerCase(), i])
    );
    const vistosEnArchivo = new Set();
    const provMap = new Map(
        (window.proveedores || []).map(p => [String(p.nombre || '').trim().toLowerCase(), p])
    );

    return data.map(row => {
        const nombre = row['Nombre'] || row['nombre'] || row['NOMBRE'] || '';
        const precio = parseFloat(row['Precio'] || row['Precio (€)'] || row['precio'] || row['PRECIO'] || 0);
        const unidad = row['Unidad'] || row['unidad'] || row['UNIDAD'] || 'kg';
        const stockActual = parseFloat(
            row['Stock Actual'] || row['stock_actual'] || row['Stock'] || 0
        );
        const stockMinimo = parseFloat(
            row['Stock Mínimo'] || row['stock_minimo'] || row['Stock Minimo'] || 0
        );

        // 🆕 Proveedor por nombre, resuelto a id contra window.proveedores. Si la
        // celda viene vacía → sin proveedor (igual que antes). Si trae un nombre
        // que no se empareja → aviso en preview pero el ingrediente se importa
        // sin proveedor (no bloquea).
        const proveedorNombreRaw = String(
            row['Proveedor'] || row['proveedor'] || row['PROVEEDOR'] || row['Supplier'] || ''
        ).trim();
        let proveedorId = null;
        let proveedorAviso = null;
        if (proveedorNombreRaw) {
            const match = provMap.get(proveedorNombreRaw.toLowerCase());
            if (match) proveedorId = match.id;
            else proveedorAviso = `Proveedor "${proveedorNombreRaw}" no existe`;
        }

        const nombreTrim = nombre.trim();
        const clave = nombreTrim.toLowerCase();
        const valido = nombreTrim.length > 0;
        let yaExiste = false;
        let dupEnArchivo = false;
        let existenteRef = null;
        if (valido) {
            existenteRef = existentesMap.get(clave) || null;
            yaExiste = !!existenteRef;
            dupEnArchivo = vistosEnArchivo.has(clave);
            vistosEnArchivo.add(clave);
        }
        // 🆕 Caso B (2026-05-30): si el ingrediente ya existe SIN proveedor y el
        // Excel trae uno emparejado, marcamos para actualizar SOLO el proveedor
        // (sin tocar precio/stock). El resto de "ya existe" se sigue saltando.
        const provExistente = existenteRef && (existenteRef.proveedor_id || existenteRef.proveedorId);
        const actualizarProveedor = yaExiste && !dupEnArchivo && !provExistente && !!proveedorId;
        return {
            nombre: nombreTrim,
            precio: isNaN(precio) ? 0 : precio,
            unidad: unidad,
            stockActual: isNaN(stockActual) ? 0 : stockActual,
            stockMinimo: isNaN(stockMinimo) ? 0 : stockMinimo,
            proveedorNombre: proveedorNombreRaw,
            proveedorId,
            proveedorAviso,
            valido: valido,
            yaExiste,        // ya está en la BD → se saltará (no duplicar)
            dupEnArchivo,    // repetido dentro del propio Excel → se saltará
            actualizarProveedor, // 🆕 excepción al "saltar": solo update del proveedor
            existenteId: existenteRef ? existenteRef.id : null,
            error: valido ? null : 'Nombre requerido',
        };
    });
}

function mostrarPreviewIngredientes(datos) {
    const nuevos = datos.filter(d => d.valido && !d.yaExiste && !d.dupEnArchivo).length;
    // Los marcados para actualizar proveedor NO cuentan como "saltados" (sí se tocan).
    const yaExisten = datos.filter(d => d.valido && (d.yaExiste || d.dupEnArchivo) && !d.actualizarProveedor).length;
    const actualizar = datos.filter(d => d.valido && d.actualizarProveedor).length;
    const invalidos = datos.filter(d => !d.valido).length;
    const sinProveedor = datos.filter(d => d.valido && !d.yaExiste && !d.dupEnArchivo && d.proveedorAviso).length;

    let html = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <strong>Resumen:</strong>
          <span style="color: #10b981;">✓ ${nuevos} nuevos</span>
          ${actualizar > 0 ? `<span style="color: #3b82f6; margin-left: 10px;">✏️ ${actualizar} a actualizar (solo proveedor)</span>` : ''}
          ${yaExisten > 0 ? `<span style="color: #f59e0b; margin-left: 10px;">⚠ ${yaExisten} ya existen (se saltarán)</span>` : ''}
          ${invalidos > 0 ? `<span style="color: #ef4444; margin-left: 10px;">✗ ${invalidos} con errores</span>` : ''}
          ${sinProveedor > 0 ? `<span style="color: #f59e0b; margin-left: 10px;">⚠ ${sinProveedor} sin proveedor emparejado</span>` : ''}
        </div>
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: left;">Estado</th>
              <th style="padding: 10px; text-align: left;">Nombre</th>
              <th style="padding: 10px; text-align: left;">Proveedor</th>
              <th style="padding: 10px; text-align: right;">Precio</th>
              <th style="padding: 10px; text-align: center;">Unidad</th>
              <th style="padding: 10px; text-align: right;">Stock</th>
              <th style="padding: 10px; text-align: left;">Observación</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const seSalta = item.valido && (item.yaExiste || item.dupEnArchivo) && !item.actualizarProveedor;
        const icon = !item.valido ? '✗' : (item.actualizarProveedor ? '✏️' : (seSalta ? '⚠' : '✓'));
        const bgColor = !item.valido
            ? '#fef2f2'
            : (item.actualizarProveedor ? '#eff6ff' : (seSalta ? '#fffbeb' : '#f0fdf4'));
        const iconColor = !item.valido
            ? '#ef4444'
            : (item.actualizarProveedor ? '#3b82f6' : (seSalta ? '#f59e0b' : '#10b981'));
        // Observación principal (estado de la fila), con aviso de proveedor anexado si aplica.
        let obs = !item.valido
            ? item.error
            : item.actualizarProveedor
                ? 'Existe sin proveedor → se actualizará el proveedor'
                : item.yaExiste
                    ? 'Ya existe → se saltará'
                    : item.dupEnArchivo
                        ? 'Repetido en el Excel → se saltará'
                        : 'Nuevo';
        let obsColor = !item.valido
            ? '#ef4444'
            : (item.actualizarProveedor ? '#3b82f6' : (seSalta ? '#f59e0b' : '#10b981'));
        if (item.valido && !seSalta && !item.actualizarProveedor && item.proveedorAviso) {
            obs = `${obs} · ⚠ ${item.proveedorAviso} (se importa sin proveedor)`;
            obsColor = '#f59e0b';
        }
        // Celda de proveedor: nombre resuelto si emparejó, o aviso en naranja si no.
        const provCell = item.proveedorId
            ? escapeHTML(item.proveedorNombre)
            : item.proveedorNombre
                ? `<span style="color:#f59e0b;">⚠ ${escapeHTML(item.proveedorNombre)}</span>`
                : '<span style="color:#94a3b8;">—</span>';

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">${escapeHTML(item.nombre) || '-'}</td>
            <td style="padding: 10px;">${provCell}</td>
            <td style="padding: 10px; text-align: right;">${cm(item.precio)}</td>
            <td style="padding: 10px; text-align: center;">${escapeHTML(item.unidad)}</td>
            <td style="padding: 10px; text-align: right;">${item.stockActual}</td>
            <td style="padding: 10px; color: ${obsColor};">${escapeHTML(obs) || 'OK'}</td>
          </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('preview-ingredientes-container').innerHTML = html;
    document.getElementById('preview-importar-ingredientes').style.display = 'block';

    // El botón se activa si hay nuevos a crear O updates de proveedor a aplicar.
    const hayNuevos = datos.some(d => d.valido && !d.yaExiste && !d.dupEnArchivo);
    const hayUpdates = datos.some(d => d.valido && d.actualizarProveedor);
    const habilitado = hayNuevos || hayUpdates;
    const btn = document.getElementById('btn-confirmar-importar-ingredientes');
    btn.disabled = !habilitado;
    btn.style.opacity = habilitado ? '1' : '0.5';
}

window.confirmarImportarIngredientes = async function () {
    // Solo se CREAN los nuevos. Los que ya existen (en BD o repetidos en el
    // Excel) se saltan para no duplicar el inventario (decisión Iker 2026-05-29).
    // Editar precios/datos en bloque NO se hace por aquí: reimportar nombres
    // existentes duplicaba todo. Para cambiar precios → ficha del ingrediente.
    const aCrear = datosImportarIngredientes.filter(d => d.valido && !d.yaExiste && !d.dupEnArchivo);
    const aActualizarProveedor = datosImportarIngredientes.filter(d => d.valido && d.actualizarProveedor);
    const saltados = datosImportarIngredientes.filter(d => d.valido && (d.yaExiste || d.dupEnArchivo) && !d.actualizarProveedor).length;

    if (aCrear.length === 0 && aActualizarProveedor.length === 0) {
        window.showToast(
            saltados > 0
                ? `No hay ingredientes nuevos: los ${saltados} del Excel ya existen`
                : 'No hay ingredientes válidos para importar',
            'info'
        );
        return;
    }

    const partes = [];
    if (aCrear.length) partes.push(`crear ${aCrear.length} nuevos`);
    if (aActualizarProveedor.length) partes.push(`actualizar proveedor en ${aActualizarProveedor.length} existentes`);
    if (saltados > 0) partes.push(`saltar ${saltados} ya existentes`);
    if (!confirm(`¿Confirmar: ${partes.join(' · ')}?`)) {
        return;
    }

    setClaseInventario('loading-overlay', 'add');

    // 🔗 Crear (o asegurar) la fila en ingredientes_proveedores (pivot).
    // El form manual de editar ingrediente llama a este endpoint tras guardar;
    // el import (create + update) no lo hacía → ingredientes con proveedor_id
    // pero pivot vacía. El desplegable de pedidos filtra por la pivot, así que
    // esos ingredientes quedaban invisibles aunque estuviesen "asignados" a un
    // proveedor. Bug confirmado por Iker 2026-05-31 (CALABACIN no aparecía).
    const asegurarPivotProveedor = async (ingredienteId, proveedorId, precio) => {
        if (!ingredienteId || !proveedorId) return;
        try {
            await window.apiClient.post(`/ingredients/${ingredienteId}/suppliers`, {
                proveedor_id: parseInt(proveedorId),
                precio: parseFloat(precio) || 0,
                es_proveedor_principal: true,
            });
        } catch (err) {
            console.warn(`pivot proveedor falló para ingrediente ${ingredienteId}:`, err?.message);
        }
    };

    try {
        let importados = 0;
        const sinProveedorEmparejado = [];
        for (const ing of aCrear) {
            const payload = {
                nombre: ing.nombre,
                precio: ing.precio,
                unidad: ing.unidad,
                stockActual: ing.stockActual,
                stockMinimo: ing.stockMinimo,
            };
            // 2026-06-08: enviar cantidad_por_formato / formato_compra / rendimiento /
            // familia si el parser los extrajo. Sin esto, comprar por caja/garrafa con
            // precio del formato inflaba precio unitario × N → food cost mentía.
            if (ing.cantidadPorFormato) payload.cantidad_por_formato = ing.cantidadPorFormato;
            if (ing.formatoCompra) payload.formato_compra = ing.formatoCompra;
            if (ing.rendimiento) payload.rendimiento = ing.rendimiento;
            if (ing.familia) payload.familia = ing.familia;
            // 🆕 Solo enviar proveedorId si el Excel traía un nombre y se emparejó.
            // Si traía un nombre que no existe, se crea el ingrediente sin proveedor
            // y se registra en el informe final para que el usuario lo arregle.
            if (ing.proveedorId) {
                payload.proveedorId = ing.proveedorId;
            } else if (ing.proveedorAviso) {
                sinProveedorEmparejado.push(`${ing.nombre}: ${ing.proveedorAviso}`);
            }
            const creado = await window.api.createIngrediente(payload);
            importados++;
            // Pivot solo si se emparejó proveedor (no si quedó "sin proveedor").
            if (ing.proveedorId && creado?.id) {
                await asegurarPivotProveedor(creado.id, ing.proveedorId, ing.precio);
            }
        }

        // 🆕 Caso B: para existentes SIN proveedor pero con uno en el Excel,
        // PUT con SOLO {proveedorId} → el backend conserva el resto de campos.
        // Además, asegurar la pivot.
        let actualizados = 0;
        const erroresUpdate = [];
        for (const ing of aActualizarProveedor) {
            try {
                await window.api.updateIngrediente(ing.existenteId, { proveedorId: ing.proveedorId });
                await asegurarPivotProveedor(ing.existenteId, ing.proveedorId, ing.precio);
                actualizados++;
            } catch (err) {
                erroresUpdate.push(`${ing.nombre}: ${err.message || 'error'}`);
            }
        }

        setClaseInventario('loading-overlay', 'remove');
        const partesToast = [];
        if (importados) partesToast.push(`✓ ${importados} creados`);
        if (actualizados) partesToast.push(`✏️ ${actualizados} con proveedor actualizado`);
        if (saltados) partesToast.push(`${saltados} saltados`);
        window.showToast(partesToast.join(' · ') || '✓ Importación completada', 'success');
        setClaseInventario('modal-importar-ingredientes', 'remove');
        // 2026-06-08: antes solo se llamaba a renderizarIngredientes() — que pinta
        // la lista desde window.ingredientes (state en memoria). Como esa lista NO
        // se actualizaba tras los POST, los ingredientes recién creados no aparecían
        // hasta que el usuario hacía F5. Cargamos primero, luego renderizamos.
        if (typeof window.cargarDatos === 'function') {
            await window.cargarDatos();
        }
        await window.renderizarIngredientes();
        if (sinProveedorEmparejado.length > 0 || erroresUpdate.length > 0) {
            let resumen = 'Importación completada con avisos:\n';
            if (sinProveedorEmparejado.length > 0) {
                resumen += `\n⚠ ${sinProveedorEmparejado.length} creados SIN proveedor (nombre del Excel no coincide):\n${sinProveedorEmparejado.join('\n')}\n`;
            }
            if (erroresUpdate.length > 0) {
                resumen += `\n✗ ${erroresUpdate.length} fallaron al actualizar proveedor:\n${erroresUpdate.join('\n')}\n`;
            }
            alert(resumen);
        }
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error importando: ' + error.message, 'error');
    }
};

window.cancelarImportarIngredientes = function () {
    setClaseInventario('modal-importar-ingredientes', 'remove');
    datosImportarIngredientes = [];
};

// ========== IMPORTAR RECETAS ==========
let datosImportarRecetas = [];

window.mostrarModalImportarRecetas = function () {
    setClaseInventario('modal-importar-recetas', 'add');
    document.getElementById('preview-importar-recetas').style.display = 'none';
    document.getElementById('file-importar-recetas').value = '';
    datosImportarRecetas = [];
};

window.procesarArchivoRecetas = async function (input) {
    const file = input.files[0];
    if (!file) return;

    setClaseInventario('loading-overlay', 'add');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarRecetas = validarDatosRecetas(data);
        mostrarPreviewRecetas(datosImportarRecetas);
        setClaseInventario('loading-overlay', 'remove');
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

// 🔎 Lee una celda probando varios nombres de columna (case-insensitive).
function celdaReceta(row, nombres) {
    const keys = Object.keys(row);
    for (const n of nombres) {
        const target = String(n).trim().toLowerCase();
        for (const k of keys) {
            if (String(k).trim().toLowerCase() === target) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
        }
    }
    return '';
}

function validarDatosRecetas(data) {
    // 🧪 Lógica EXTRAÍDA a src/utils/escandallo-parser.js con tests defensivos
    // en src/__tests__/utils/escandallo-parser.test.js. Wrapper que inyecta
    // window.ingredientes (para matching) y window.recetas (para subrecetas).
    // Fallback a la implementación inline si el módulo no está cargado.
    if (window.__importParsers && typeof window.__importParsers.parseRecetas === 'function') {
        return window.__importParsers.parseRecetas(
            data,
            window.ingredientes || [],
            window.recetas || []
        );
    }
    // ----- FALLBACK histórico (mantenido por seguridad) -----
    if (!Array.isArray(data) || data.length === 0) return [];
    const tieneEscandallo = data.some(row =>
        Object.keys(row).some(k => String(k).trim().toLowerCase() === 'ingrediente')
    );
    return tieneEscandallo ? validarRecetasConEscandallo(data) : validarRecetasSoloCabecera(data);
}

// Comportamiento histórico: una fila = una receta vacía (solo cabecera).
function validarRecetasSoloCabecera(data) {
    return data.map(row => {
        const nombre = row['Nombre'] || row['nombre'] || row['NOMBRE'] || '';
        const categoria = row['Categoría'] || row['categoria'] || row['Categoria'] || 'principal';
        const precioVenta = parseFloat(
            row['Precio Venta'] || row['precio_venta'] || row['Precio'] || 0
        );
        const porciones = parseInt(row['Porciones'] || row['porciones'] || 1);

        const valido = nombre.trim().length > 0;
        return {
            nombre: nombre.trim(),
            categoria: categoria,
            precioVenta: isNaN(precioVenta) ? 0 : precioVenta,
            porciones: isNaN(porciones) || porciones < 1 ? 1 : porciones,
            ingredientes: [],
            sinEmparejar: [],
            valido: valido,
            error: valido ? null : 'Nombre requerido',
        };
    });
}

// 🆕 Formato largo: varias filas por receta, cada una una línea del escandallo.
// Empareja "Ingrediente" por nombre contra window.ingredientes y construye las
// líneas {ingredienteId, cantidad, rendimiento?}. Rendimiento en blanco = hereda
// del ingrediente (no se fija en la línea). Las líneas sin emparejar se reportan.
// La cabecera (categoría/precio/porciones) puede ir solo en la 1ª fila de cada
// receta; el nombre de receta se arrastra a las filas siguientes si va en blanco.
function validarRecetasConEscandallo(data) {
    const ingMap = new Map(
        (window.ingredientes || []).map(i => [String(i.nombre || '').trim().toLowerCase(), i])
    );
    // Subrecetas: el export escribe el NOMBRE de la subreceta como "ingrediente".
    // Mapeamos también las recetas por nombre para que el round-trip no las pierda:
    // si una línea no casa con un ingrediente pero sí con una receta, la tratamos
    // como subreceta (ingredienteId = 100000 + recetaId, convención de toda la app).
    const recMap = new Map(
        (window.recetas || []).map(r => [String(r.nombre || '').trim().toLowerCase(), r])
    );
    const porNombre = new Map();
    const orden = [];
    let current = '';

    for (const row of data) {
        const recetaCell = String(celdaReceta(row, ['Receta', 'Nombre'])).trim();
        if (recetaCell) {
            current = recetaCell;
            if (!porNombre.has(current)) {
                porNombre.set(current, {
                    nombre: current,
                    categoria: String(celdaReceta(row, ['Categoría', 'Categoria'])).trim() || 'principal',
                    precioVenta: parseFloat(celdaReceta(row, ['Precio Venta', 'Precio (€)', 'Precio'])) || 0,
                    porciones: parseInt(celdaReceta(row, ['Porciones'])) || 1,
                    codigo: String(celdaReceta(row, ['Código TPV', 'Codigo TPV', 'Código', 'Codigo'])).trim() || null,
                    ingredientes: [],
                    sinEmparejar: [],
                    valido: true,
                    error: null,
                });
                orden.push(current);
            } else {
                // Rellenar cabecera si esta fila la trae y aún no estaba fijada
                const r = porNombre.get(current);
                const cat = String(celdaReceta(row, ['Categoría', 'Categoria'])).trim();
                const precio = parseFloat(celdaReceta(row, ['Precio Venta', 'Precio (€)', 'Precio']));
                const porc = parseInt(celdaReceta(row, ['Porciones']));
                const cod = String(celdaReceta(row, ['Código TPV', 'Codigo TPV', 'Código', 'Codigo'])).trim();
                if (cat && r.categoria === 'principal') r.categoria = cat;
                if (precio > 0 && !r.precioVenta) r.precioVenta = precio;
                if (porc > 1 && r.porciones === 1) r.porciones = porc;
                if (cod && !r.codigo) r.codigo = cod;
            }
        }
        if (!current) continue;
        const r = porNombre.get(current);
        const ingNombre = String(celdaReceta(row, ['Ingrediente'])).trim();
        if (!ingNombre) continue; // fila solo de cabecera, sin línea
        const cantidad = parseFloat(celdaReceta(row, ['Cantidad']));
        if (!(cantidad > 0)) { r.sinEmparejar.push(`${ingNombre} (cantidad inválida)`); continue; }
        const clave = ingNombre.toLowerCase();
        const ing = ingMap.get(clave);
        let linea;
        if (ing) {
            linea = { ingredienteId: ing.id, cantidad };
        } else {
            // ¿Es una subreceta? La reconocemos por nombre de receta, evitando que
            // una receta se incluya a sí misma como subreceta (auto-referencia).
            const sub = recMap.get(clave);
            if (sub && clave !== current.trim().toLowerCase()) {
                linea = { ingredienteId: 100000 + sub.id, cantidad };
            } else {
                r.sinEmparejar.push(ingNombre);
                continue;
            }
        }
        const rend = parseFloat(celdaReceta(row, ['Rendimiento', 'Rendimiento (%)']));
        if (rend > 0 && rend <= 100) linea.rendimiento = rend; // blanco = hereda del ingrediente
        r.ingredientes.push(linea);
    }

    const resultado = orden.map(n => porNombre.get(n));
    resultado.forEach(r => {
        if (!r.nombre) { r.valido = false; r.error = 'Nombre requerido'; }
        else if (r.ingredientes.length === 0) { r.valido = false; r.error = 'Sin líneas válidas emparejadas'; }
    });
    return resultado;
}

function mostrarPreviewRecetas(datos) {
    const validos = datos.filter(d => d.valido).length;
    const invalidos = datos.filter(d => !d.valido).length;
    const totalSinEmparejar = datos.reduce((s, d) => s + (d.sinEmparejar ? d.sinEmparejar.length : 0), 0);

    let html = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <strong>Resumen:</strong>
          <span style="color: #10b981;">✓ ${validos} válidas</span>
          ${invalidos > 0 ? `<span style="color: #ef4444; margin-left: 10px;">✗ ${invalidos} con errores</span>` : ''}
          ${totalSinEmparejar > 0 ? `<span style="color: #f59e0b; margin-left: 10px;">⚠ ${totalSinEmparejar} líneas sin emparejar</span>` : ''}
        </div>
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: left;">Estado</th>
              <th style="padding: 10px; text-align: left;">Receta</th>
              <th style="padding: 10px; text-align: center;">Categoría</th>
              <th style="padding: 10px; text-align: right;">Precio Venta</th>
              <th style="padding: 10px; text-align: center;">Porciones</th>
              <th style="padding: 10px; text-align: center;">Líneas</th>
              <th style="padding: 10px; text-align: left;">Observación</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const icon = item.valido ? '✓' : '✗';
        const bgColor = item.valido ? '#f0fdf4' : '#fef2f2';
        const iconColor = item.valido ? '#10b981' : '#ef4444';
        const nLineas = item.ingredientes ? item.ingredientes.length : 0;
        const sinEmp = item.sinEmparejar || [];

        let obs, obsColor;
        if (!item.valido) {
            obs = escapeHTML(item.error || 'Error');
            if (sinEmp.length) obs += ` (sin emparejar: ${sinEmp.map(s => escapeHTML(s)).join(', ')})`;
            obsColor = '#ef4444';
        } else if (sinEmp.length > 0) {
            obs = `⚠ Sin emparejar: ${sinEmp.map(s => escapeHTML(s)).join(', ')}`;
            obsColor = '#f59e0b';
        } else {
            obs = 'OK';
            obsColor = '#10b981';
        }

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">${escapeHTML(item.nombre) || '-'}</td>
            <td style="padding: 10px; text-align: center;">${escapeHTML(item.categoria)}</td>
            <td style="padding: 10px; text-align: right;">${cm(item.precioVenta)}</td>
            <td style="padding: 10px; text-align: center;">${item.porciones}</td>
            <td style="padding: 10px; text-align: center;">${nLineas}</td>
            <td style="padding: 10px; color: ${obsColor};">${obs}</td>
          </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('preview-recetas-container').innerHTML = html;
    document.getElementById('preview-importar-recetas').style.display = 'block';

    const hayValidos = datos.some(d => d.valido);
    const btn = document.getElementById('btn-confirmar-importar-recetas');
    btn.disabled = !hayValidos;
    btn.style.opacity = hayValidos ? '1' : '0.5';
}

window.confirmarImportarRecetas = async function () {
    const datosValidos = datosImportarRecetas.filter(d => d.valido);

    if (datosValidos.length === 0) {
        window.showToast('No hay recetas válidas para importar', 'error');
        return;
    }

    if (!confirm(`¿Importar ${datosValidos.length} recetas?`)) {
        return;
    }

    // Upsert por nombre: si la receta ya existe se ACTUALIZA (no se duplica).
    const existentesMap = new Map(
        (window.recetas || []).map(r => [String(r.nombre || '').trim().toLowerCase(), r])
    );

    setClaseInventario('loading-overlay', 'add');

    const creadas = [];
    const actualizadas = [];
    const errores = [];

    for (const rec of datosValidos) {
        const clave = String(rec.nombre || '').trim().toLowerCase();
        const existente = existentesMap.get(clave);
        try {
            if (existente) {
                // Si el import NO trae líneas (solo cabecera), conservar el escandallo
                // actual para no borrarlo sin querer; si trae líneas, se sustituye.
                const ingredientesFinal = (rec.ingredientes && rec.ingredientes.length > 0)
                    ? rec.ingredientes
                    : (existente.ingredientes || []);
                await window.api.updateReceta(existente.id, {
                    nombre: rec.nombre,
                    categoria: rec.categoria,
                    precio_venta: rec.precioVenta,
                    porciones: rec.porciones,
                    // Código TPV: si el Excel no lo trae, conservar el actual (no borrarlo).
                    codigo: rec.codigo || existente.codigo || null,
                    ingredientes: ingredientesFinal,
                });
                actualizadas.push(rec.nombre);
            } else {
                const nueva = await window.api.createReceta({
                    nombre: rec.nombre,
                    categoria: rec.categoria,
                    precio_venta: rec.precioVenta,
                    porciones: rec.porciones,
                    codigo: rec.codigo || null,
                    ingredientes: rec.ingredientes || [],
                });
                creadas.push(rec.nombre);
                if (nueva && nueva.id) existentesMap.set(clave, nueva); // si el Excel repite el nombre, actualizar la 2ª vez
            }
        } catch (error) {
            errores.push(`${rec.nombre}: ${error.message}`);
        }
    }

    // Refrescar estado: window.recetas queda al día → un re-import posterior
    // reconoce las recetas y las actualiza en vez de duplicarlas.
    await window.cargarDatos();
    window.renderizarRecetas();
    setClaseInventario('loading-overlay', 'remove');
    setClaseInventario('modal-importar-recetas', 'remove');

    const totalSinEmparejar = datosValidos.reduce((s, d) => s + (d.sinEmparejar ? d.sinEmparejar.length : 0), 0);
    const tipo = (creadas.length || actualizadas.length) ? 'success' : 'error';
    if (errores.length === 0 && totalSinEmparejar === 0) {
        window.showToast(`✓ ${creadas.length} creadas · ${actualizadas.length} actualizadas`, tipo);
    } else {
        window.showToast(`✓ ${creadas.length} creadas · ${actualizadas.length} actualizadas`, tipo);
        let resumen = `Importación completada:\n\n✓ ${creadas.length} recetas creadas\n✏️ ${actualizadas.length} actualizadas`;
        if (totalSinEmparejar) resumen += `\n⚠ ${totalSinEmparejar} líneas sin emparejar (ingrediente no encontrado — revísalas)`;
        if (errores.length) resumen += `\n✗ ${errores.length} con error:\n${errores.join('\n')}`;
        alert(resumen);
    }
};

window.cancelarImportarRecetas = function () {
    setClaseInventario('modal-importar-recetas', 'remove');
    datosImportarRecetas = [];
};

// Cabecera canónica de escandallo. ÚNICO sitio donde se define el orden — la
// plantilla, el export y el round-trip lo comparten para nunca divergir.
// (2026-06-08) Orden alineado con plantilla histórica: cabecera de la receta
// (Receta/Categoría/Precio/Porciones/Código) antes del bloque de líneas
// (Ingrediente/Cantidad/Rendimiento). Iker prefirió este orden tras feedback
// de la plantilla CSV: lee como ficha técnica de cocina.
const ESCANDALLO_HEADER = ['Receta', 'Categoría', 'Precio Venta', 'Porciones', 'Código TPV', 'Ingrediente', 'Cantidad', 'Rendimiento'];
const ESCANDALLO_COL_WIDTHS = [{ wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 12 }];

// Construye las filas de escandallo (SIN cabecera) de UNA receta, en el formato
// del import: la 1ª línea lleva Categoría/Precio/Porciones/Código TPV; las
// siguientes en blanco. Rendimiento vacío si la línea no lo fija (al reimportar
// hereda del ingrediente). Compartido por la plantilla (todas las recetas) y
// el export por receta para que ambos formatos no diverjan nunca.
function _filasEscandalloDeReceta(rec, ingMap, recMap) {
    const lineas = Array.isArray(rec.ingredientes) ? rec.ingredientes : [];
    const precio = parseFloat(rec.precio_venta) || 0;
    const porciones = parseInt(rec.porciones) || 1;
    const codigo = rec.codigo || ''; // Código TPV (campo `codigo` de la receta)
    if (lineas.length === 0) {
        return [[rec.nombre, rec.categoria || '', precio, porciones, codigo, '', '', '']];
    }
    return lineas.map((item, idx) => {
        let nombreIng;
        if (item.ingredienteId > 100000) {
            const sub = recMap.get(item.ingredienteId - 100000);
            nombreIng = sub ? sub.nombre : `receta#${item.ingredienteId - 100000}`;
        } else {
            const ing = ingMap.get(item.ingredienteId);
            nombreIng = ing ? ing.nombre : `ingrediente#${item.ingredienteId}`;
        }
        const rend = (item.rendimiento != null && parseFloat(item.rendimiento) > 0)
            ? parseFloat(item.rendimiento) : '';
        const cantidad = parseFloat(item.cantidad) || 0;
        // Categoría/Precio/Porciones/Código son de la receta → solo en la 1ª línea.
        return idx === 0
            ? [rec.nombre, rec.categoria || '', precio, porciones, codigo, nombreIng, cantidad, rend]
            : [rec.nombre, '', '', '', '', nombreIng, cantidad, rend];
    });
}

// Filas de ejemplo para la plantilla (5 recetas tipo restaurante gallego). Mismo
// orden que ESCANDALLO_HEADER. Mantenido aquí (y NO en CSV estático) para que el
// orden de columnas no pueda desincronizarse del export real.
const PLANTILLA_RECETAS_EJEMPLO = [
    ['PULPO A LA GALLEGA', 'alimentos', 18, 1, 'P001', 'PULPO COCIDO', 0.18, 100],
    ['PULPO A LA GALLEGA', '', '', '', '', 'PATATAS GALLEGAS', 0.20, 85],
    ['PULPO A LA GALLEGA', '', '', '', '', 'ACEITE OLIVA VIRGEN', 0.02, 100],
    ['PULPO A LA GALLEGA', '', '', '', '', 'SAL MARINA', 0.003, 100],
    ['PULPO A LA GALLEGA', '', '', '', '', 'PIMIENTA NEGRA', 0.002, 100],
    ['LUBINA AL HORNO', 'alimentos', 24, 1, 'L001', 'LUBINA SALVAJE', 0.30, 80],
    ['LUBINA AL HORNO', '', '', '', '', 'PATATAS GALLEGAS', 0.15, 85],
    ['LUBINA AL HORNO', '', '', '', '', 'CEBOLLA MORADA', 0.10, 90],
    ['LUBINA AL HORNO', '', '', '', '', 'ACEITE OLIVA VIRGEN', 0.03, 100],
    ['LUBINA AL HORNO', '', '', '', '', 'SAL MARINA', 0.003, 100],
    ['SOLOMILLO CON PATATAS', 'alimentos', 28, 1, 'S001', 'SOLOMILLO TERNERA', 0.20, 90],
    ['SOLOMILLO CON PATATAS', '', '', '', '', 'PATATAS GALLEGAS', 0.18, 85],
    ['SOLOMILLO CON PATATAS', '', '', '', '', 'SAL MARINA', 0.003, 100],
    ['ENSALADA DE QUESO', 'alimentos', 11.5, 1, 'E001', 'QUESO TETILLA', 0.08, 100],
    ['ENSALADA DE QUESO', '', '', '', '', 'TOMATE RAMA', 0.12, 95],
    ['ENSALADA DE QUESO', '', '', '', '', 'ACEITE OLIVA VIRGEN', 0.015, 100],
];

// Construye un libro XLSX con 2 sheets: Escandallo + Ingredientes disponibles.
// Cuerpo = filas ya construidas (sin cabecera). Devuelve el wb listo para writeFile.
function _construirLibroEscandallo(filasSinCabecera) {
    const wb = XLSX.utils.book_new();
    const wsEsc = XLSX.utils.aoa_to_sheet([ESCANDALLO_HEADER, ...filasSinCabecera]);
    wsEsc['!cols'] = ESCANDALLO_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, wsEsc, 'Escandallo');

    const ings = (window.ingredientes || []).map(i => [i.nombre, i.unidad || '']);
    const wsIng = XLSX.utils.aoa_to_sheet([['Ingrediente', 'Unidad'], ...ings]);
    wsIng['!cols'] = [{ wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsIng, 'Ingredientes disponibles');
    return wb;
}

// 📥 "Descargar plantilla" = SIEMPRE el ejemplo. No depende de los datos del
// usuario. Genera un XLSX que el cliente puede editar y reimportar. Si quiere
// exportar SUS recetas, usa el botón "Exportar mis recetas".
window.descargarPlantillaRecetas = async function () {
    try {
        if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
            await window.loadXLSX();
        }
        const wb = _construirLibroEscandallo(PLANTILLA_RECETAS_EJEMPLO);
        XLSX.writeFile(wb, `plantilla_recetas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        window.showToast('Error generando la plantilla: ' + error.message, 'error');
    }
};

// 💾 "Exportar mis recetas" = exporta TUS recetas reales en formato
// re-importable. Si aún no tienes recetas, NO descarga un ejemplo (eso
// confundía: parecía que ya tenías recetas). En su lugar, avisa.
window.descargarPlantillaEscandallo = async function () {
    try {
        const recetas = Array.isArray(window.recetas) ? window.recetas : [];
        if (recetas.length === 0) {
            window.showToast('Aún no tienes recetas. Pulsa "Descargar plantilla" para empezar con un ejemplo.', 'info');
            return;
        }
        if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
            await window.loadXLSX();
        }
        const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));
        const recMap = new Map(recetas.map(r => [r.id, r]));

        const filas = [];
        for (const rec of recetas) {
            for (const fila of _filasEscandalloDeReceta(rec, ingMap, recMap)) filas.push(fila);
        }

        const wb = _construirLibroEscandallo(filas);
        XLSX.writeFile(wb, `mis_recetas_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        window.showToast('Error exportando recetas: ' + error.message, 'error');
    }
};

// 🆕 Exporta el escandallo de UNA receta concreta en el formato del import
// (Receta/Categoría/Precio/Porciones/Ingrediente/Cantidad/Rendimiento), para
// editarla en Excel y re-importarla (round-trip). El nombre del archivo lleva
// el nombre de la receta. Rendimiento en blanco si la línea no lo fija (para
// que al re-importar herede del ingrediente).
window.exportarEscandalloReceta = async function (recetaId) {
    try {
        if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
            await window.loadXLSX();
        }
        const recetas = Array.isArray(window.recetas) ? window.recetas : [];
        const rec = recetas.find(r => r.id === recetaId);
        if (!rec) { window.showToast('Receta no encontrada', 'error'); return; }
        const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));
        const recMap = new Map(recetas.map(r => [r.id, r]));

        const filas = [ESCANDALLO_HEADER];
        for (const fila of _filasEscandalloDeReceta(rec, ingMap, recMap)) filas.push(fila);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(filas);
        ws['!cols'] = ESCANDALLO_COL_WIDTHS;
        XLSX.utils.book_append_sheet(wb, ws, 'Escandallo');
        const slug = String(rec.nombre || 'receta').trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'receta';
        XLSX.writeFile(wb, `escandallo_${slug}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        window.showToast('Error exportando el escandallo: ' + error.message, 'error');
    }
};

// ========== PROVEEDORES (importar / plantilla / exportar) ==========
// Cabecera canónica de proveedores. ÚNICO sitio donde se define el orden — la
// plantilla, el export real y el parser de import comparten esta lista para
// que los 3 nunca diverjan. Solo `Nombre` es obligatorio; el resto opcional.
// `iva_pct` se trata como porcentaje 0-100 (NUMERIC(5,2) en BD, no afecta
// fórmulas — solo display en modal de recepción).
const PROVEEDORES_HEADER = ['Nombre', 'Contacto', 'Teléfono', 'Email', 'CIF', 'IVA (%)', 'Código', 'Dirección', 'Notas'];
const PROVEEDORES_COL_WIDTHS = [{ wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 30 }];

const PLANTILLA_PROVEEDORES_EJEMPLO = [
    ['PESCADOS PEREZ', 'Juan Perez', '600111222', 'juan@pescadosperez.com', 'B12345678', 10, '', 'Mercado Central Galicia', 'Pescado fresco diario llamar 8h'],
    ['VERDURAS LA HUERTA', 'Maria Lopez', '600333444', 'maria@laHuerta.com', 'B23456789', 4, '', 'Pol Industrial 3', 'Verdura ecologica martes/viernes'],
    ['CARNICAS ATLANTICAS', 'Pedro Garcia', '600555666', 'pedro@carnicas.com', 'B34567890', 10, '', 'Calle Real 12', 'Reservar lomo con 48h'],
    ['BODEGA RIBEIRO', 'Bodegas SL', '600777888', 'info@bodegariberia.com', 'B45678901', 21, '', 'Carretera Ourense km 5', 'Vino y bebidas'],
    ['LACTEOS DEL VALLE', 'Ana Rios', '600999000', 'ana@lacteos.com', 'B56789012', 10, '', 'Avda Galicia 88', 'Queso fresco lunes y jueves'],
];

function _filaProveedor(prov) {
    const iva = (prov.iva_pct !== null && prov.iva_pct !== undefined && prov.iva_pct !== '')
        ? prov.iva_pct : '';
    return [
        prov.nombre || '',
        prov.contacto || '',
        prov.telefono || '',
        prov.email || '',
        prov.cif || '',
        iva,
        prov.codigo || '',
        prov.direccion || '',
        prov.notas || '',
    ];
}

function _construirLibroProveedores(filasSinCabecera) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([PROVEEDORES_HEADER, ...filasSinCabecera]);
    ws['!cols'] = PROVEEDORES_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
    return wb;
}

// 📥 Plantilla: SIEMPRE el ejemplo. No depende de los datos del usuario.
window.descargarPlantillaProveedores = async function () {
    try {
        if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
            await window.loadXLSX();
        }
        const wb = _construirLibroProveedores(PLANTILLA_PROVEEDORES_EJEMPLO);
        XLSX.writeFile(wb, `plantilla_proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        window.showToast('Error generando la plantilla: ' + error.message, 'error');
    }
};

// 💾 Exporta TUS proveedores reales en formato re-importable. Sin proveedores → toast.
window.exportarProveedores = async function () {
    try {
        const proveedores = Array.isArray(window.proveedores) ? window.proveedores : [];
        if (proveedores.length === 0) {
            window.showToast('Aún no tienes proveedores. Pulsa "Descargar plantilla" para empezar con un ejemplo.', 'info');
            return;
        }
        if (typeof XLSX === 'undefined' && typeof window.loadXLSX === 'function') {
            await window.loadXLSX();
        }
        const filas = proveedores.map(_filaProveedor);
        const wb = _construirLibroProveedores(filas);
        XLSX.writeFile(wb, `mis_proveedores_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        window.showToast('Error exportando proveedores: ' + error.message, 'error');
    }
};

// ===== IMPORT =====
let datosImportarProveedores = [];

window.mostrarModalImportarProveedores = function () {
    setClaseInventario('modal-importar-proveedores', 'add');
    document.getElementById('preview-importar-proveedores').style.display = 'none';
    document.getElementById('file-importar-proveedores').value = '';
    datosImportarProveedores = [];
};

window.procesarArchivoProveedores = async function (input) {
    const file = input.files[0];
    if (!file) return;
    setClaseInventario('loading-overlay', 'add');
    try {
        const data = await leerArchivoGenerico(file);
        datosImportarProveedores = validarDatosProveedores(data);
        mostrarPreviewProveedores(datosImportarProveedores);
    } catch (error) {
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    } finally {
        setClaseInventario('loading-overlay', 'remove');
    }
};

function celdaProv(row, nombres) {
    const keys = Object.keys(row);
    for (const n of nombres) {
        const target = String(n).trim().toLowerCase();
        for (const k of keys) {
            if (String(k).trim().toLowerCase() === target) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
        }
    }
    return '';
}

function validarDatosProveedores(data) {
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map(row => {
        const nombre = String(celdaProv(row, ['Nombre', 'nombre', 'NOMBRE'])).trim();
        const contacto = String(celdaProv(row, ['Contacto', 'contacto'])).trim();
        const telefono = String(celdaProv(row, ['Teléfono', 'Telefono', 'telefono'])).trim();
        const email = String(celdaProv(row, ['Email', 'email', 'Correo', 'correo'])).trim();
        const cif = String(celdaProv(row, ['CIF', 'cif', 'NIF', 'nif'])).trim();
        const direccion = String(celdaProv(row, ['Dirección', 'Direccion', 'direccion'])).trim();
        const notas = String(celdaProv(row, ['Notas', 'notas', 'Observaciones'])).trim();
        const codigo = String(celdaProv(row, ['Código', 'Codigo', 'codigo'])).trim();
        const ivaRaw = celdaProv(row, ['IVA (%)', 'IVA habitual (%)', 'IVA', 'iva', 'iva_pct']);
        let iva_pct = null;
        if (ivaRaw !== '' && ivaRaw !== null && ivaRaw !== undefined) {
            const n = parseFloat(String(ivaRaw).replace(',', '.'));
            if (Number.isFinite(n) && n >= 0 && n <= 100) iva_pct = Math.round(n * 100) / 100;
        }
        const valido = nombre.length > 0;
        return {
            nombre, contacto, telefono, email, cif, direccion, notas, codigo, iva_pct,
            valido, error: valido ? null : 'Nombre requerido',
        };
    });
}

function mostrarPreviewProveedores(datos) {
    const validos = datos.filter(d => d.valido).length;
    const invalidos = datos.filter(d => !d.valido).length;

    let html = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <strong>Resumen:</strong>
          <span style="color: #10b981;">✓ ${validos} válidos</span>
          ${invalidos > 0 ? `<span style="color: #ef4444; margin-left: 10px;">✗ ${invalidos} con errores</span>` : ''}
        </div>
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: left;">Estado</th>
              <th style="padding: 10px; text-align: left;">Nombre</th>
              <th style="padding: 10px; text-align: left;">Teléfono</th>
              <th style="padding: 10px; text-align: left;">Email</th>
              <th style="padding: 10px; text-align: center;">IVA</th>
              <th style="padding: 10px; text-align: left;">Observación</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const icon = item.valido ? '✓' : '✗';
        const bg = item.valido ? '#f0fdf4' : '#fef2f2';
        const ic = item.valido ? '#10b981' : '#ef4444';
        const obs = item.valido ? 'OK' : escapeHTML(item.error || 'Error');
        const obsColor = item.valido ? '#10b981' : '#ef4444';
        const ivaTxt = item.iva_pct !== null ? `${item.iva_pct}%` : '—';
        html += `
          <tr style="background: ${bg};">
            <td style="padding: 10px;"><span style="color: ${ic};">${icon}</span></td>
            <td style="padding: 10px;">${escapeHTML(item.nombre) || '-'}</td>
            <td style="padding: 10px;">${escapeHTML(item.telefono) || '-'}</td>
            <td style="padding: 10px;">${escapeHTML(item.email) || '-'}</td>
            <td style="padding: 10px; text-align: center;">${ivaTxt}</td>
            <td style="padding: 10px; color: ${obsColor};">${obs}</td>
          </tr>`;
    });
    html += '</tbody></table>';

    document.getElementById('preview-proveedores-container').innerHTML = html;
    document.getElementById('preview-importar-proveedores').style.display = 'block';
    const btn = document.getElementById('btn-confirmar-importar-proveedores');
    btn.disabled = !datos.some(d => d.valido);
    btn.style.opacity = btn.disabled ? '0.5' : '1';
}

window.confirmarImportarProveedores = async function () {
    const validos = datosImportarProveedores.filter(d => d.valido);
    if (validos.length === 0) {
        window.showToast('No hay proveedores válidos para importar', 'error');
        return;
    }
    if (!confirm(`¿Importar ${validos.length} proveedores?`)) return;

    // Upsert por nombre (case-insensitive). Si ya existe, se ACTUALIZA.
    const existentes = new Map(
        (window.proveedores || []).map(p => [String(p.nombre || '').trim().toLowerCase(), p])
    );

    setClaseInventario('loading-overlay', 'add');
    const creados = [];
    const actualizados = [];
    const errores = [];

    for (const p of validos) {
        const clave = p.nombre.trim().toLowerCase();
        const existente = existentes.get(clave);
        const payload = {
            nombre: p.nombre,
            contacto: p.contacto,
            telefono: p.telefono,
            email: p.email,
            cif: p.cif,
            codigo: p.codigo,
            direccion: p.direccion,
            notas: p.notas,
            iva_pct: p.iva_pct,
        };
        try {
            if (existente) {
                // Conservar la relación con ingredientes — no la tocamos desde el import.
                payload.ingredientes = existente.ingredientes || [];
                await window.api.updateProveedor(existente.id, payload);
                actualizados.push(p.nombre);
            } else {
                const nuevo = await window.api.createProveedor(payload);
                creados.push(p.nombre);
                if (nuevo && (nuevo.id || nuevo.data?.id)) {
                    existentes.set(clave, nuevo.data || nuevo);
                }
            }
        } catch (error) {
            errores.push(`${p.nombre}: ${error.message}`);
        }
    }

    await window.cargarDatos();
    if (typeof window.renderizarProveedores === 'function') window.renderizarProveedores();
    setClaseInventario('loading-overlay', 'remove');
    setClaseInventario('modal-importar-proveedores', 'remove');

    const tipo = (creados.length || actualizados.length) ? 'success' : 'error';
    if (errores.length === 0) {
        window.showToast(`✓ ${creados.length} creados · ${actualizados.length} actualizados`, tipo);
    } else {
        window.showToast(`✓ ${creados.length} creados · ${actualizados.length} actualizados (${errores.length} con error)`, tipo);
        alert(`Importación completada:\n\n✓ ${creados.length} creados\n✏️ ${actualizados.length} actualizados\n✗ ${errores.length} con error:\n${errores.join('\n')}`);
    }
};

window.cancelarImportarProveedores = function () {
    setClaseInventario('modal-importar-proveedores', 'remove');
    datosImportarProveedores = [];
};

// ========== IMPORTAR VENTAS TPV ==========
let datosImportarVentas = [];

window.mostrarModalImportarVentas = function () {
    setClaseInventario('modal-importar-ventas', 'add');
    document.getElementById('preview-importar-ventas').style.display = 'none';
    document.getElementById('file-importar-ventas').value = '';
    // Resetear fecha al abrir (vacío = fecha actual al importar)
    const fechaInput = document.getElementById('fecha-importar-ventas');
    if (fechaInput) fechaInput.value = '';
    datosImportarVentas = [];
};

window.procesarArchivoVentas = async function (input) {
    const file = input.files[0];
    if (!file) return;

    setClaseInventario('loading-overlay', 'add');

    try {
        // Detectar si es PDF
        const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

        if (isPDF) {
            // Procesar PDF con IA (backend)
            window.showToast('Procesando PDF con IA...', 'info');

            // Convertir a base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    // Quitar el prefijo "data:application/pdf;base64,"
                    const result = reader.result.split(',')[1];
                    resolve(result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Llamar al endpoint del backend
            const response = await fetch(`${window.API_CONFIG?.baseUrl ?? 'https://lacaleta-api.mindloop.cloud'}/api/parse-pdf`, {
                method: 'POST',
                credentials: 'include',
                headers: Object.assign({ 'Content-Type': 'application/json' }, window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {}),
                body: JSON.stringify({
                    pdfBase64: base64,
                    filename: file.name
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error procesando PDF');
            }

            const result = await response.json();

            // Establecer la fecha del documento
            const fechaInput = document.getElementById('fecha-importar-ventas');
            if (fechaInput && result.fecha) {
                fechaInput.value = result.fecha;
            }

            // Asegurar que tenemos las variantes cargadas
            if (!Array.isArray(window.recetasVariantes) && window.API?.fetch) {
                try {
                    const result = await window.API.fetch('/api/recipes-variants');
                    window.recetasVariantes = Array.isArray(result) ? result : [];
                } catch (e) {
                    console.warn('No se pudieron cargar variantes:', e);
                    window.recetasVariantes = [];
                }
            }

            // Convertir formato del backend al formato esperado
            datosImportarVentas = result.ventas.map(v => {
                // Buscar receta por código o nombre
                let recetaEncontrada = null;
                let varianteEncontrada = null;

                if (v.codigo_tpv) {
                    // 1. Buscar en recetas principales
                    recetaEncontrada = window.recetas.find(r => r.codigo && String(r.codigo) === String(v.codigo_tpv));

                    // 2. Si no encuentra, buscar en variantes (BOTELLA/COPA)
                    if (!recetaEncontrada && Array.isArray(window.recetasVariantes)) {
                        varianteEncontrada = window.recetasVariantes.find(va => va.codigo && String(va.codigo) === String(v.codigo_tpv));
                        if (varianteEncontrada) {
                            // Encontrar la receta padre de la variante
                            recetaEncontrada = window.recetas.find(r => r.id === varianteEncontrada.receta_id);
                        }
                    }
                }
                if (!recetaEncontrada && v.receta) {
                    const nombreNorm = v.receta.toLowerCase().trim();
                    recetaEncontrada = window.recetas.find(r => r.nombre.toLowerCase().trim() === nombreNorm);
                }

                // Nombre para mostrar: variante o receta
                const nombreMostrar = varianteEncontrada
                    ? `${recetaEncontrada?.nombre || ''} (${varianteEncontrada.nombre})`
                    : recetaEncontrada?.nombre || null;

                return {
                    codigo: v.codigo_tpv || '',
                    nombre: v.receta || '',
                    cantidad: v.cantidad || 0,
                    total: v.total || 0,
                    recetaId: recetaEncontrada ? recetaEncontrada.id : null,
                    varianteId: varianteEncontrada ? varianteEncontrada.id : null,
                    recetaNombre: nombreMostrar,
                    valido: v.cantidad > 0,
                    error: !recetaEncontrada ? '⚠️ No vinculado (se registrará como genérico)' : null
                };
            });

            mostrarPreviewVentas(datosImportarVentas);
            setClaseInventario('loading-overlay', 'remove');
            window.showToast(`✓ PDF procesado: ${result.totalVentas} ventas encontradas`, 'success');

        } else {
            // Procesar Excel/CSV (comportamiento original)
            const data = await leerArchivoGenerico(file);
            datosImportarVentas = validarDatosVentas(data);
            mostrarPreviewVentas(datosImportarVentas);
            setClaseInventario('loading-overlay', 'remove');
        }
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

function validarDatosVentas(data) {
    return data.map(row => {
        // Mapeo flexible de columnas
        const codigo = row['Código'] || row['codigo'] || row['Codigo'] || row['CODIGO'] || '';
        const nombre =
            row['Nombre'] ||
            row['nombre'] ||
            row['NOMBRE'] ||
            row['Articulo'] ||
            row['Artículo'] ||
            '';
        const cantidad = parseFloat(
            row['Cantidad'] || row['cantidad'] || row['CANTIDAD'] || row['Unidades'] || 0
        );
        const total = parseFloat(
            row['Total'] || row['total'] || row['TOTAL'] || row['Importe'] || 0
        );

        // Intentar vincular con receta existente
        let recetaEncontrada = null;
        let varianteEncontrada = null;

        // 1. Buscar por código exacto si existe
        if (codigo) {
            recetaEncontrada = window.recetas.find(
                r => r.codigo && String(r.codigo) === String(codigo)
            );

            // 2. Si no encuentra, buscar en variantes (BOTELLA/COPA)
            if (!recetaEncontrada && Array.isArray(window.recetasVariantes)) {
                varianteEncontrada = window.recetasVariantes.find(va => va.codigo && String(va.codigo) === String(codigo));
                if (varianteEncontrada) {
                    recetaEncontrada = window.recetas.find(r => r.id === varianteEncontrada.receta_id);
                }
            }
        }

        // 3. Si no, buscar por nombre (exacto o aproximado)
        if (!recetaEncontrada && nombre) {
            const nombreNorm = nombre.toLowerCase().trim();
            recetaEncontrada = window.recetas.find(
                r => r.nombre.toLowerCase().trim() === nombreNorm
            );
        }

        // Validación: warning si no encuentra receta en importación
        if (!recetaEncontrada && nombre) {
            console.warn(`⚠️ Receta no encontrada en importación TPV: "${nombre}"`);
        }

        const valido = cantidad > 0 && (recetaEncontrada || nombre.length > 0);

        // Nombre para mostrar
        const nombreMostrar = varianteEncontrada
            ? `${recetaEncontrada?.nombre || ''} (${varianteEncontrada.nombre})`
            : recetaEncontrada?.nombre || null;

        return {
            codigo: codigo,
            nombre: nombre,
            cantidad: isNaN(cantidad) ? 0 : cantidad,
            total: isNaN(total) ? 0 : total,
            recetaId: recetaEncontrada ? recetaEncontrada.id : null,
            varianteId: varianteEncontrada ? varianteEncontrada.id : null,
            recetaNombre: nombreMostrar,
            valido: valido,
            error: !valido
                ? 'Cantidad inválida'
                : !recetaEncontrada
                    ? '⚠️ No vinculado (se registrará como genérico)'
                    : null,
        };
    });
}

function mostrarPreviewVentas(datos) {
    const validos = datos.filter(d => d.valido).length;
    const vinculados = datos.filter(d => d.recetaId).length;
    const noVinculados = validos - vinculados;

    let html = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <strong>Resumen:</strong> 
          <span style="color: #10b981;">✓ ${validos} registros válidos</span>
          <span style="color: #3b82f6; margin-left: 10px;">🔗 ${vinculados} vinculados a recetas</span>
          ${noVinculados > 0 ? `<span style="color: #f59e0b; margin-left: 10px;">⚠️ ${noVinculados} sin vincular (solo financiero)</span>` : ''}
        </div>
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: left;">Estado</th>
              <th style="padding: 10px; text-align: left;">TPV (Cód/Nombre)</th>
              <th style="padding: 10px; text-align: left;">Receta Vinculada</th>
              <th style="padding: 10px; text-align: right;">Cant.</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const icon = item.valido ? '✓' : '✗';
        const bgColor = item.valido ? (item.recetaId ? '#f0fdf4' : '#fffbeb') : '#fef2f2';
        const iconColor = item.valido ? '#10b981' : '#ef4444';

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">
              ${item.codigo ? `<span style="font-family:monospace; background:#eee; padding:2px 4px; border-radius:4px;">${escapeHTML(item.codigo)}</span> ` : ''}
              ${escapeHTML(item.nombre)}
            </td>
            <td style="padding: 10px;">
              ${item.recetaId ? `<strong>${escapeHTML(item.recetaNombre)}</strong>` : '<span style="color:#999; font-style:italic;">No encontrado</span>'}
            </td>
            <td style="padding: 10px; text-align: right;">${item.cantidad}</td>
            <td style="padding: 10px; text-align: right;">${cm(item.total)}</td>
          </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('preview-ventas-container').innerHTML = html;
    document.getElementById('preview-importar-ventas').style.display = 'block';

    const hayValidos = datos.some(d => d.valido);
    const btn = document.getElementById('btn-confirmar-importar-ventas');
    btn.disabled = !hayValidos;
    btn.style.opacity = hayValidos ? '1' : '0.5';
}

window.confirmarImportarVentas = async function () {
    const datosValidos = datosImportarVentas.filter(d => d.valido);

    if (datosValidos.length === 0) {
        window.showToast('No hay ventas válidas para importar', 'error');
        return;
    }

    // 📅 Usar fecha seleccionada o fecha actual
    const fechaInput = document.getElementById('fecha-importar-ventas');
    let fechaVentas;
    if (fechaInput && fechaInput.value) {
        // Usuario seleccionó fecha específica (retroactiva)
        // Formato: YYYY-MM-DD del input type="date"
        fechaVentas = new Date(fechaInput.value + 'T12:00:00').toISOString();
        console.log('📅 Usando fecha seleccionada por usuario:', fechaInput.value, '→', fechaVentas);
    } else {
        // Fecha actual por defecto
        fechaVentas = new Date().toISOString();
        console.log('📅 Usando fecha actual:', fechaVentas);
    }

    // Mostrar confirmación del usuario con la fecha
    const fechaDisplay = fechaInput && fechaInput.value ? fechaInput.value : new Date().toISOString().split('T')[0];
    if (!confirm(`¿Importar ${datosValidos.length} registros de venta para la fecha ${fechaDisplay}?\nSe actualizará el stock de los artículos vinculados.`)) {
        return;
    }

    setClaseInventario('loading-overlay', 'add');

    try {
        let importados = 0;

        // Procesar en lotes o uno a uno (por ahora uno a uno para simplicidad, idealmente batch en backend)
        // Nota: La API actual de createSale espera un solo objeto.
        // Podríamos crear un endpoint batch, pero usaremos el existente en bucle por ahora.

        for (const venta of datosValidos) {
            // Si está vinculado, registramos venta normal (descuenta stock)
            if (venta.recetaId) {
                await window.api.createSale({
                    recetaId: venta.recetaId,
                    cantidad: venta.cantidad,
                    total: venta.total, // Opcional si el backend lo recalcula, pero útil si el precio TPV varía
                    fecha: fechaVentas,
                    varianteId: venta.varianteId, // 🔧 FIX: Pasar variante para usar precio correcto
                });
            } else {
                // Si NO está vinculado, solo registramos financieramente (TODO: Backend support for generic sales)
                // Por ahora, para no perder el dato financiero, podríamos asignarlo a una receta "Varios" o similar,
                // o simplemente ignorar el descuento de stock pero sumar al total.
                // Como el backend actual requiere recetaId, saltaremos los no vinculados o crearemos una receta dummy.
                // ESTRATEGIA: Crear venta con recetaId nulo si el backend lo permite, o loguear error.
                // Revisando server.js: receta_id es INTEGER NOT NULL.
                // Solución temporal: Solo importar vinculados.
                console.warn(
                    'Venta no vinculada omitida de stock (se requiere receta):',
                    venta.nombre
                );
                continue;
            }
            importados++;
        }

        setClaseInventario('loading-overlay', 'remove');
        window.showToast(`✓ ${importados} ventas importadas correctamente`, 'success');
        setClaseInventario('modal-importar-ventas', 'remove');

        // ⚡ Invalidar caché para forzar reload con datos frescos
        window._ventasCache = null;
        await window.renderizarVentas();
        window.actualizarKPIs();
        window.actualizarDashboardExpandido();
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error importando ventas: ' + error.message, 'error');
    }
};

window.cancelarImportarVentas = function () {
    setClaseInventario('modal-importar-ventas', 'remove');
    datosImportarVentas = [];
};

// ========== IMPORTAR PEDIDOS (COMPRAS) ==========
let datosImportarPedidos = [];

window.mostrarModalImportarPedidos = function () {
    setClaseInventario('modal-importar-pedidos', 'add');
    document.getElementById('preview-importar-pedidos').style.display = 'none';
    document.getElementById('file-importar-pedidos').value = '';
    datosImportarPedidos = [];
};

window.procesarArchivoPedidos = async function (input) {
    const file = input.files[0];
    if (!file) return;

    setClaseInventario('loading-overlay', 'add');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarPedidos = validarDatosPedidos(data);
        mostrarPreviewPedidos(datosImportarPedidos);
        setClaseInventario('loading-overlay', 'remove');
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

// 🔧 Anti-fragmentación (auditoría 2026-06-27 HIGH-2): normaliza nombres de
// ingrediente para emparejar de forma robusta (insensible a acentos, mayúsculas
// y espacios) al importar pedidos. NO fusiona nada por su cuenta: solo enlaza por
// coincidencia EXACTA normalizada (segura) y AVISA de posibles duplicados cuando
// comparten el primer término. El backend además rechaza nombres exactos duplicados.
function normalizarNombreIngrediente(s) {
    return String(s || '')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase().trim().replace(/\s+/g, ' ');
}
function primerTokenIngrediente(s) {
    return normalizarNombreIngrediente(s).split(' ')[0] || '';
}

function validarDatosPedidos(data) {
    return data.map(row => {
        // Mapeo flexible de columnas
        const fecha =
            row['Fecha'] || row['fecha'] || row['FECHA'] || new Date().toISOString().split('T')[0];
        const proveedor = row['Proveedor'] || row['proveedor'] || row['PROVEEDOR'] || 'Varios';
        const ingredienteNombre =
            row['Ingrediente'] ||
            row['ingrediente'] ||
            row['INGREDIENTE'] ||
            row['Articulo'] ||
            row['Concepto'] ||
            '';
        const cantidad = parseFloat(
            row['Cantidad'] || row['cantidad'] || row['CANTIDAD'] || row['Unidades'] || 0
        );
        const precio = parseFloat(
            row['Precio'] || row['precio'] || row['PRECIO'] || row['Precio Unitario'] || 0
        );
        const total = parseFloat(
            row['Total'] || row['total'] || row['TOTAL'] || row['Importe'] || 0
        );

        // Vincular con ingrediente existente. Match EXACTO normalizado (insensible a
        // acentos/mayúsculas/espacios) → "Limón" enlaza con "limon" sin riesgo. Si no
        // hay exacto pero comparte el primer término (≥4 letras) con uno existente, se
        // marca como POSIBLE DUPLICADO para que el usuario decida (no se autocrea a
        // ciegas). El backend además rechaza nombres exactos duplicados (HIGH-1).
        let ingredienteEncontrado = null;
        let posibleDuplicado = null;
        if (ingredienteNombre) {
            const norm = normalizarNombreIngrediente(ingredienteNombre);
            ingredienteEncontrado = (window.ingredientes || []).find(
                i => normalizarNombreIngrediente(i.nombre) === norm
            );
            if (!ingredienteEncontrado) {
                const tn = primerTokenIngrediente(ingredienteNombre);
                if (tn.length >= 4) {
                    posibleDuplicado = (window.ingredientes || []).find(
                        i => primerTokenIngrediente(i.nombre) === tn
                    ) || null;
                }
            }
        }

        // Validación: warning si no encuentra ingrediente en importación
        if (!ingredienteEncontrado && ingredienteNombre) {
            console.warn(`⚠️ Ingrediente no encontrado en importación: "${ingredienteNombre}"`);
        }

        const valido = cantidad > 0 && ingredienteNombre.length > 0;

        return {
            fecha: fecha,
            proveedor: proveedor,
            ingredienteNombre: ingredienteNombre,
            cantidad: isNaN(cantidad) ? 0 : cantidad,
            precio: isNaN(precio) ? 0 : precio,
            total: isNaN(total) ? 0 : total,
            ingredienteId: ingredienteEncontrado ? ingredienteEncontrado.id : null,
            ingredienteUnidad: ingredienteEncontrado
                ? ingredienteEncontrado.unidad
                : (posibleDuplicado ? posibleDuplicado.unidad : 'unidad'),
            posibleDuplicadoNombre: (!ingredienteEncontrado && posibleDuplicado) ? posibleDuplicado.nombre : null,
            valido: valido,
            error: !valido
                ? 'Datos incompletos'
                : !ingredienteEncontrado
                    ? (posibleDuplicado
                        ? `⚠️ ¿Es "${posibleDuplicado.nombre}"? Se creará NUEVO`
                        : '⚠️ Nuevo ingrediente (se creará)')
                    : null,
        };
    });
}

function mostrarPreviewPedidos(datos) {
    const validos = datos.filter(d => d.valido).length;
    const vinculados = datos.filter(d => d.ingredienteId).length;
    const nuevos = validos - vinculados;
    const posiblesDup = datos.filter(d => d.valido && !d.ingredienteId && d.posibleDuplicadoNombre).length;

    let html = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <strong>Resumen:</strong>
          <span style="color: #10b981;">✓ ${validos} registros válidos</span>
          <span style="color: #3b82f6; margin-left: 10px;">🔗 ${vinculados} vinculados</span>
          ${nuevos > 0 ? `<span style="color: #f59e0b; margin-left: 10px;">✨ ${nuevos} nuevos ingredientes</span>` : ''}
          ${posiblesDup > 0 ? `<span style="color: #b45309; margin-left: 10px; font-weight:600;">⚠️ ${posiblesDup} posible(s) duplicado(s) — revisa antes de importar</span>` : ''}
        </div>
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px; text-align: left;">Estado</th>
              <th style="padding: 10px; text-align: left;">Fecha</th>
              <th style="padding: 10px; text-align: left;">Proveedor</th>
              <th style="padding: 10px; text-align: left;">Ingrediente</th>
              <th style="padding: 10px; text-align: right;">Cant.</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const icon = item.valido ? '✓' : '✗';
        const esPosibleDup = item.valido && !item.ingredienteId && item.posibleDuplicadoNombre;
        const bgColor = !item.valido ? '#fef2f2' : (item.ingredienteId ? '#f0fdf4' : (esPosibleDup ? '#fef3c7' : '#fffbeb'));
        const iconColor = item.valido ? '#10b981' : '#ef4444';

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">${escapeHTML(String(item.fecha))}</td>
            <td style="padding: 10px;">${escapeHTML(item.proveedor)}</td>
            <td style="padding: 10px;">
              ${escapeHTML(item.ingredienteNombre)}
              ${esPosibleDup
                ? `<br><span style="font-size:11px; color:#b45309; font-weight:600;">⚠️ ¿Es "${escapeHTML(item.posibleDuplicadoNombre)}"? Se creará NUEVO</span>`
                : (!item.ingredienteId ? '<br><span style="font-size:11px; color:#f59e0b;">(Se creará nuevo)</span>' : '')}
            </td>
            <td style="padding: 10px; text-align: right;">${item.cantidad} ${escapeHTML(item.ingredienteUnidad)}</td>
            <td style="padding: 10px; text-align: right;">${cm(item.total)}</td>
          </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('preview-pedidos-container').innerHTML = html;
    document.getElementById('preview-importar-pedidos').style.display = 'block';

    const hayValidos = datos.some(d => d.valido);
    const btn = document.getElementById('btn-confirmar-importar-pedidos');
    btn.disabled = !hayValidos;
    btn.style.opacity = hayValidos ? '1' : '0.5';
}

window.confirmarImportarPedidos = async function () {
    const datosValidos = datosImportarPedidos.filter(d => d.valido);

    if (datosValidos.length === 0) {
        window.showToast('No hay pedidos válidos para importar', 'error');
        return;
    }

    if (
        !confirm(
            `¿Importar ${datosValidos.length} pedidos?\nSe actualizará el stock y se crearán los ingredientes nuevos.`
        )
    ) {
        return;
    }

    setClaseInventario('loading-overlay', 'add');

    try {
        let importados = 0;

        for (const pedido of datosValidos) {
            let ingId = pedido.ingredienteId;

            // 1. Si no existe ingrediente, crearlo
            if (!ingId) {
                // Buscar proveedor ID o crear (simplificado: asignamos string por ahora o null)
                // Para simplificar, creamos el ingrediente con datos básicos
                // 🔒 FIX: Proteger división por cero
                const cantidadSegura = parseFloat(pedido.cantidad) || 1;
                const precioUnitario = parseFloat(pedido.total) / cantidadSegura;

                const nuevoIng = await window.api.createIngrediente({
                    nombre: pedido.ingredienteNombre,
                    precio: isNaN(precioUnitario) || !isFinite(precioUnitario) ? 0 : precioUnitario,
                    unidad: 'unidad', // Default, usuario deberá corregir
                    stockActual: 0,
                    stockMinimo: 0,
                    familia: 'alimento', // Default
                });
                ingId = nuevoIng.id;
            }

            // 2. Crear el pedido (que actualiza stock en backend si está configurado,
            // pero la API actual de createOrder es compleja (cabecera + lineas).
            // SIMPLIFICACION: Usaremos una lógica directa de actualización de stock + registro de gasto?
            // No, lo correcto es crear un pedido.
            // Pero createOrder espera { proveedorId, fecha, items: [{ingredienteId, cantidad, precio}] }
            // Aquí tenemos una lista plana. Agruparemos por proveedor y fecha?
            // Para MVP: Importación línea a línea creando 1 pedido por línea es ineficiente pero seguro.
            // MEJOR: Agrupar por (Fecha, Proveedor).

            // Por ahora, para no complicar, asumiremos que el backend tiene un endpoint 'registrarCompra' o similar?
            // No. Usaremos la API existente.
            // Vamos a actualizar el stock directamente y registrar el gasto como "Otros Gastos" o crear un pedido dummy?
            // Lo ideal es crear el pedido real.

            // ESTRATEGIA: Crear un pedido por cada línea (simple) o agrupar.
            // Vamos a crear un pedido por línea para asegurar trazabilidad individual.

            // Buscar ID proveedor
            let provId = null;
            const prov = window.proveedores.find(
                p => p.nombre.toLowerCase() === pedido.proveedor.toLowerCase()
            );
            if (prov) {
                provId = prov.id;
            } else {
                // Crear proveedor si no existe
                const nuevoProv = await window.api.createProveedor({
                    nombre: pedido.proveedor,
                    contacto: '',
                    telefono: '',
                    email: '',
                    direccion: '',
                    notas: 'Importado automáticamente',
                });
                provId = nuevoProv.id;
                // 🔧 FIX: Usar asignación inmutable en lugar de push directo
                // El push directo puede causar problemas si hay condiciones de carrera
                window.proveedores = [...(window.proveedores || []), nuevoProv];
            }

            await window.api.createPedido({
                proveedorId: provId,
                fecha: pedido.fecha,
                estado: 'recibido', // Importante: ya está recibido
                ingredientes: [
                    {
                        ingredienteId: ingId,
                        cantidad: pedido.cantidad,
                        // 🔒 FIX: Proteger división por cero
                        precio: pedido.precio > 0
                            ? pedido.precio
                            : (parseFloat(pedido.cantidad) > 0 ? pedido.total / pedido.cantidad : 0),
                    },
                ],
                total: pedido.total,
            });

            importados++;
        }

        setClaseInventario('loading-overlay', 'remove');
        window.showToast(`✓ ${importados} pedidos importados correctamente`, 'success');
        setClaseInventario('modal-importar-pedidos', 'remove');

        // Actualizar UI
        await window.renderizarIngredientes(); // Stock actualizado
        await window.renderizarPedidos();
        // await window.renderizarBalance(); // P&L actualizado - DESACTIVADO
    } catch (error) {
        setClaseInventario('loading-overlay', 'remove');
        window.showToast('Error importando pedidos: ' + error.message, 'error');
    }
};

window.cancelarImportarPedidos = function () {
    setClaseInventario('modal-importar-pedidos', 'remove');
    datosImportarPedidos = [];
};

// ========== MÓDULO DIARIO: Tracking de Costes/Ventas por Día ==========

// Global para que modales.js pueda acceder
window.datosResumenMensual = null;

// Inicializar mes actual en los selectores
(function initDiario() {
    const mesSelect = document.getElementById('diario-mes');
    const anoSelect = document.getElementById('diario-ano');
    if (mesSelect) {
        mesSelect.value = (new Date().getMonth() + 1).toString();
    }
    if (anoSelect) {
        anoSelect.value = new Date().getFullYear().toString();
    }
})();

// Cargar resumen mensual desde la API
window.cargarResumenMensual = async function () {
    const mes = document.getElementById('diario-mes').value;
    const ano = document.getElementById('diario-ano').value;

    // 🔒 SECURITY: httpOnly cookie can't be read by JS, use 'user' as session proxy
    if (!localStorage.getItem('user')) {
        window.showToast('Sesión expirada', 'error');
        return;
    }

    try {
        window.showToast('Cargando datos...', 'info');

        const response = await fetch(
            // ⚡ Multi-tenant: usa config global si existe
            // 🔧 FIX: Usar /api/monthly/summary que devuelve {dias, compras.ingredientes, ventas.recetas}
            `${window.API_CONFIG?.baseUrl ?? 'https://lacaleta-api.mindloop.cloud'}/api/monthly/summary?mes=${mes}&ano=${ano}`,
            {
                credentials: 'include',
                headers: Object.assign({ 'Content-Type': 'application/json' }, window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {}),
            }
        );

        if (!response.ok) throw new Error('Error cargando datos');

        window.datosResumenMensual = await response.json();

        // Actualizar KPIs respetando el filtro de semana
        window.actualizarKPIsDiario();

        // Aplicar modo compacto si estamos en "todo el mes" (default)
        document.body.classList.toggle('diario-mes-completo', window.diarioSemanaActiva === 'todas');

        // Renderizar tablas
        renderizarTablaComprasDiarias();
        renderizarTablaVentasDiarias();
        renderizarTablaProveedoresDiarios();
        await renderizarTablaPLDiario();
        renderizarBeneficioNetoDiario();
        window.showToast('Datos cargados', 'success');
    } catch (error) {
        console.error('Error cargando resumen mensual:', error);
        window.showToast('Error cargando datos', 'error');
    }
};

// 📅 Filtro de días por semana del mes (1=1-7, 2=8-14, 3=15-21, 4=22-28, 5=29-31, 'todas'=mes completo)
window.diarioSemanaActiva = 'todas';

// 📊 Recalcula los 4 KPIs del encabezado del Diario.
// Total Compras: sigue saliendo de monthly/summary (precios_compra_diarios; no
// depende de la receta, no le afecta el bug).
// Ventas / Beneficio / Food Cost: pasan a usar /analytics/pnl-breakdown (la
// misma fuente canónica que el Dashboard). Antes se sumaba de
// data.ventas.recetas, pero monthly/summary excluye ventas cuya receta fue
// borrada (JOIN con r.deleted_at IS NULL) → los totales aparecían bajos y el
// food cost distorsionado vs el Dashboard. Bug confirmado por Iker 2026-05-30.
window.actualizarKPIsDiario = async function () {
    const data = window.datosResumenMensual;
    if (!data) return;
    const diasVisibles = window.filtrarDiasPorSemana(data.dias || [], window.diarioSemanaActiva);
    const diasSet = new Set(diasVisibles);

    // Compras (materia prima) — sigue saliendo de monthly/summary.
    let totalCompras = 0;
    const comprasIng = data.compras?.ingredientes || {};
    for (const ing of Object.values(comprasIng)) {
        for (const [dia, diaData] of Object.entries(ing.dias || {})) {
            if (diasSet.has(dia)) totalCompras += (diaData.total ?? (diaData.precio * diaData.cantidad)) || 0;
        }
    }

    // Ventas / Beneficio / Food Cost — fuente canónica del Dashboard.
    // Usa el rango de fechas correspondiente al filtro de semana activo
    // (o todo el mes si está en "todas").
    let totalIngresos = 0;
    let totalCostesProd = 0;
    let foodCost = 0;
    try {
        const toLocalDate = (d) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        // 🔴 FIX auditoría 2026-07-09: las tarjetas KPI usaban SIEMPRE el mes actual
        // (new Date()) e ignoraban los selectores #diario-mes/#diario-ano, mientras
        // las tablas de la misma pestaña sí los respetan → al consultar un mes
        // pasado, tarjetas y tablas mostraban meses DISTINTOS. Ahora todas las
        // piezas del Diario usan el mes/año seleccionados.
        const ahora = new Date();
        const mesSel = parseInt(document.getElementById('diario-mes')?.value) || (ahora.getMonth() + 1);
        const anoSel = parseInt(document.getElementById('diario-ano')?.value) || ahora.getFullYear();
        let desde = new Date(anoSel, mesSel - 1, 1);
        let hasta = new Date(anoSel, mesSel, 1);
        const sem = parseInt(window.diarioSemanaActiva);
        if (Number.isFinite(sem) && sem >= 1 && sem <= 5) {
            const minDia = (sem - 1) * 7 + 1;
            const maxDia = sem * 7; // pnl-breakdown usa hasta exclusivo, ver más abajo
            desde = new Date(anoSel, mesSel - 1, minDia);
            hasta = new Date(anoSel, mesSel - 1, maxDia + 1);
        }
        const desdeStr = toLocalDate(desde);
        const hastaStr = toLocalDate(hasta);
        const apiBase = window.API_CONFIG?.baseUrl ?? 'https://lacaleta-api.mindloop.cloud';
        const resp = await fetch(
            `${apiBase}/api/analytics/pnl-breakdown?desde=${desdeStr}&hasta=${hastaStr}`,
            {
                credentials: 'include',
                headers: Object.assign(
                    { 'Content-Type': 'application/json' },
                    window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {}
                ),
            }
        );
        if (resp.ok) {
            const pnl = await resp.json();
            totalIngresos = parseFloat(pnl.total?.ingresos) || 0;
            totalCostesProd = parseFloat(pnl.total?.cogs) || 0;
            // Food cost canónico de hostelería = solo COMIDA (el Dashboard hace lo mismo).
            foodCost = parseFloat(pnl.food?.food_cost_pct) || 0;
        }
    } catch (err) {
        console.warn('No se pudo obtener pnl-breakdown para KPIs del Diario:', err);
    }
    const beneficioBruto = totalIngresos - totalCostesProd;

    const elCompras = document.getElementById('diario-total-compras');
    if (elCompras) elCompras.textContent = cm(totalCompras);
    const elVentas = document.getElementById('diario-total-ventas');
    if (elVentas) elVentas.textContent = cm(totalIngresos);
    const elBeneficio = document.getElementById('diario-beneficio');
    if (elBeneficio) elBeneficio.textContent = cm(beneficioBruto);
    const elFoodCost = document.getElementById('diario-food-cost');
    if (elFoodCost) elFoodCost.textContent = foodCost.toFixed(1) + '%';
};

window.filtrarDiasPorSemana = function (dias, semana) {
    if (!semana || semana === 'todas') return dias;
    const semanaNum = parseInt(semana);
    if (!semanaNum || semanaNum < 1 || semanaNum > 5) return dias;
    const minDia = (semanaNum - 1) * 7 + 1;
    const maxDia = semanaNum * 7;
    return dias.filter(d => {
        const dayNum = new Date(d + 'T12:00:00').getDate();
        return dayNum >= minDia && dayNum <= maxDia;
    });
};

// Cambiar semana visible en el Diario (1-5 o 'todas')
window.cambiarSemanaDiario = function (semana) {
    window.diarioSemanaActiva = semana;

    // Actualizar estilo de botones
    document.querySelectorAll('.btn-semana').forEach(btn => {
        const esActiva = String(btn.dataset.semana) === String(semana);
        btn.classList.toggle('active', esActiva);
        btn.className = esActiva
            ? 'btn-semana btn btn-primary active'
            : 'btn-semana btn btn-secondary';
    });

    // Modo compacto en body cuando se ve el mes completo (31 días caben sin scroll)
    document.body.classList.toggle('diario-mes-completo', semana === 'todas');

    // Re-renderizar las 4 tablas con el nuevo filtro
    if (window.datosResumenMensual) {
        window.actualizarKPIsDiario();
        renderizarTablaComprasDiarias();
        renderizarTablaVentasDiarias();
        renderizarTablaProveedoresDiarios();
        renderizarTablaPLDiario();
    }
};

// Cambiar entre vistas (Compras, Ventas, Proveedores, P&L)
window.cambiarVistaDiario = function (vista) {
    // Ocultar todas las vistas
    document.querySelectorAll('.diario-vista').forEach(el => (el.style.display = 'none'));

    // Resetear botones
    document.getElementById('btn-vista-compras').className = 'btn btn-secondary';
    document.getElementById('btn-vista-ventas').className = 'btn btn-secondary';
    document.getElementById('btn-vista-proveedores').className = 'btn btn-secondary';
    document.getElementById('btn-vista-combinada').className = 'btn btn-secondary';

    // Mostrar vista seleccionada
    if (vista === 'compras') {
        document.getElementById('vista-compras').style.display = 'block';
        document.getElementById('btn-vista-compras').className = 'btn btn-primary';
    } else if (vista === 'ventas') {
        document.getElementById('vista-ventas').style.display = 'block';
        document.getElementById('btn-vista-ventas').className = 'btn btn-primary';
    } else if (vista === 'proveedores') {
        document.getElementById('vista-proveedores').style.display = 'block';
        document.getElementById('btn-vista-proveedores').className = 'btn btn-primary';
    } else if (vista === 'combinada') {
        document.getElementById('vista-combinada').style.display = 'block';
        document.getElementById('btn-vista-combinada').className = 'btn btn-primary';
    }
};

// Renderizar tabla de compras diarias (tipo Excel)
function renderizarTablaComprasDiarias() {
    const container = document.getElementById('tabla-compras-diarias');
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML = '<p class="empty-state">No hay datos de compras para este mes</p>';
        return;
    }

    const dias = window.filtrarDiasPorSemana(window.datosResumenMensual.dias, window.diarioSemanaActiva);
    const ingredientes = window.datosResumenMensual.compras?.ingredientes || {};

    let html =
        '<table style="min-width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">';

    // Header con días
    html +=
        '<thead><tr><th style="position: sticky; left: 0; background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); z-index: 1; border-right: 1px solid #E2E8F0; border-bottom: 2px solid #CBD5E1; padding: 16px;">Ingrediente</th>';
    dias.forEach(dia => {
        const fecha = new Date(dia + 'T12:00:00');
        html += `<th style="min-width: 80px; text-align: center; border-right: 1px solid #E2E8F0; border-bottom: 2px solid #CBD5E1; padding: 16px; background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%);">${fecha.getDate()}/${fecha.getMonth() + 1}</th>`;
    });
    html +=
        '<th style="background: #e8f5e9; font-weight: bold; border-bottom: 2px solid #CBD5E1; padding: 16px;">TOTAL</th></tr></thead>';

    // Filas de ingredientes
    html += '<tbody>';
    let rowIndex = 0;
    for (const [nombre, data] of Object.entries(ingredientes)) {
        const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#FAFBFC';
        html += `<tr style="border-bottom: 1px solid #F1F5F9;"><td style="position: sticky; left: 0; background: ${bgColor}; font-weight: 600; padding: 18px; border-right: 1px solid #E2E8F0;">${nombre}</td>`;

        // Buscar unidad del ingrediente
        const ing = window.ingredientes.find(i => i.nombre === nombre);
        const unidad = ing?.unidad || 'kg';

        // 📊 El total debe sumar SOLO los días visibles (respeta filtro de semana).
        // UX fix: cada celda muestra el IMPORTE DEL DÍA en grande (cantidad×precio) y el
        // desglose unitario en pequeño — así la suma cuadra visualmente con el TOTAL.
        let totalVisible = 0;
        dias.forEach(dia => {
            const diaData = data.dias[dia];
            if (diaData) {
                const calculado = diaData.precio * diaData.cantidad;
                const importeDia = (diaData.total ?? calculado) || 0;
                totalVisible += importeDia;
                const hayDescuento = Math.abs(calculado - (diaData.total ?? calculado)) > 0.02;
                const avisoDescuento = hayDescuento
                    ? `<span title="Total real difiere de precio×cantidad (posible descuento)" style="color:#dc2626;"> 🏷️</span>`
                    : '';
                html += `<td style="text-align: center; background: #FFF5F2; padding: 18px; border-right: 1px solid #E2E8F0;">
                    <div style="font-weight: 700; color: #1E293B; font-size: 1em;">${cm(importeDia)}${avisoDescuento}</div>
                    <small style="color:#64748B;">${cm(diaData.precio)}/${unidad} × ${diaData.cantidad}</small>
                </td>`;
            } else {
                html +=
                    '<td style="text-align: center; color: #CBD5E1; padding: 18px; border-right: 1px solid #E2E8F0;">-</td>';
            }
        });
        html += `<td style="text-align: center; background: #e8f5e9; font-weight: bold; padding: 18px;">${cm(totalVisible)}</td>`;
        html += '</tr>';
        rowIndex++;
    }
    html += '</tbody></table>';

    container.innerHTML = html;
}

// Renderizar tabla de ventas diarias (tipo Excel)
function renderizarTablaVentasDiarias() {
    const container = document.getElementById('tabla-ventas-diarias');
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML = '<p class="empty-state">No hay datos de ventas para este mes</p>';
        return;
    }

    const dias = window.filtrarDiasPorSemana(window.datosResumenMensual.dias, window.diarioSemanaActiva);
    const recetas = window.datosResumenMensual.ventas?.recetas || {};

    let html = '<table style="min-width: 100%; border-collapse: collapse;">';

    // Header con días
    html +=
        '<thead><tr><th style="position: sticky; left: 0; background: #f8f8f8; z-index: 1;">Receta</th>';
    dias.forEach(dia => {
        const fecha = new Date(dia + 'T12:00:00');
        html += `<th style="min-width: 100px; text-align: center;">${fecha.getDate()}/${fecha.getMonth() + 1}</th>`;
    });
    html += '<th style="background: #e8f5e9; font-weight: bold;">TOTAL</th></tr></thead>';

    // Filas de recetas
    html += '<tbody>';
    for (const [nombre, data] of Object.entries(recetas)) {
        html += `<tr><td style="position: sticky; left: 0; background: white; font-weight: 500;">${nombre}</td>`;
        // 📊 FIX: totales solo de los días visibles
        let ingresosVisibles = 0;
        let vendidasVisibles = 0;
        dias.forEach(dia => {
            const diaData = data.dias[dia];
            if (diaData) {
                ingresosVisibles += diaData.ingresos || 0;
                vendidasVisibles += diaData.vendidas || 0;
                html += `<td style="text-align: center;">
              <div style="color: #2e7d32; font-weight: 500;">${cm(diaData.ingresos)}</div>
              <small style="color:#666;">${diaData.vendidas} uds</small>
            </td>`;
            } else {
                html += '<td style="text-align: center; color: #ccc;">-</td>';
            }
        });
        html += `<td style="text-align: center; background: #e8f5e9;">
          <div style="font-weight: bold;">${cm(ingresosVisibles)}</div>
          <small>${vendidasVisibles} uds</small>
        </td>`;
        html += '</tr>';
    }
    html += '</tbody></table>';

    container.innerHTML = html;
}

// Renderizar tabla de compras por proveedor (tipo Excel con heatmap)
function renderizarTablaProveedoresDiarios() {
    const container = document.getElementById('tabla-proveedores-diarios');
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML = '<p class="empty-state">No hay datos de compras para este mes</p>';
        return;
    }

    const dias = window.filtrarDiasPorSemana(window.datosResumenMensual.dias, window.diarioSemanaActiva);
    const proveedores = window.datosResumenMensual.compras?.porProveedor || {};

    if (Object.keys(proveedores).length === 0) {
        container.innerHTML = '<p class="empty-state">No hay datos de proveedores para este mes</p>';
        return;
    }

    // 📊 FIX: total por proveedor solo sobre días visibles (respeta filtro de semana)
    const totalVisiblePorProveedor = new Map();
    for (const [nombre, data] of Object.entries(proveedores)) {
        let s = 0;
        dias.forEach(dia => { s += data.dias[dia] || 0; });
        totalVisiblePorProveedor.set(nombre, s);
    }
    // Ordenar proveedores por total visible descendente
    const proveedoresOrdenados = Object.entries(proveedores).sort(
        (a, b) => (totalVisiblePorProveedor.get(b[0]) || 0) - (totalVisiblePorProveedor.get(a[0]) || 0)
    );
    const maxTotal = totalVisiblePorProveedor.get(proveedoresOrdenados[0]?.[0]) || 1;

    // Calcular totales por día
    const totalesPorDia = {};
    dias.forEach(dia => {
        totalesPorDia[dia] = 0;
        proveedoresOrdenados.forEach(([, data]) => {
            totalesPorDia[dia] += data.dias[dia] || 0;
        });
    });
    const totalGeneral = proveedoresOrdenados.reduce(
        (sum, [nombre]) => sum + (totalVisiblePorProveedor.get(nombre) || 0), 0
    );

    let html = `<h3 style="margin-bottom: 15px;">${window.t('balance:supplier_title')}</h3>`;
    html += '<table style="min-width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">';

    // Header
    html += '<thead><tr>';
    html += `<th style="position: sticky; left: 0; background: linear-gradient(135deg, #F0F4FF 0%, #E8EDFF 100%); z-index: 1; border-right: 2px solid #CBD5E1; border-bottom: 2px solid #CBD5E1; padding: 14px 16px; font-weight: 700; color: #334155; min-width: 180px;">${window.t('balance:supplier_col_name')}</th>`;
    dias.forEach(dia => {
        const fecha = new Date(dia + 'T12:00:00');
        const dayNames = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        const dayName = dayNames[fecha.getDay()];
        html += `<th style="min-width: 90px; text-align: center; border-right: 1px solid #E2E8F0; border-bottom: 2px solid #CBD5E1; padding: 10px 8px; background: linear-gradient(135deg, #F0F4FF 0%, #E8EDFF 100%); font-size: 0.85em;"><div style="font-weight: 700; color: #334155;">${dayName} ${fecha.getDate()}</div><div style="color: #94A3B8; font-size: 0.85em;">${fecha.getMonth() + 1}/${fecha.getFullYear().toString().slice(-2)}</div></th>`;
    });
    html += '<th style="background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); font-weight: 700; border-bottom: 2px solid #CBD5E1; padding: 14px 16px; min-width: 110px; text-align: center; color: #065F46;">TOTAL</th>';
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    proveedoresOrdenados.forEach(([nombre, data], idx) => {
        const bgColor = idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC';
        const totalVisibleProv = totalVisiblePorProveedor.get(nombre) || 0;
        // Intensidad de color según proporción del total
        const intensidad = Math.max(0.05, totalVisibleProv / maxTotal);
        const barWidth = Math.round(intensidad * 100);

        html += `<tr style="border-bottom: 1px solid #F1F5F9;">`;
        // Nombre del proveedor con barra de proporción
        html += `<td style="position: sticky; left: 0; background: ${bgColor}; padding: 14px 16px; border-right: 2px solid #E2E8F0; font-weight: 600; color: #1E293B;">`;
        html += `<div>${nombre}</div>`;
        html += `<div style="height: 4px; margin-top: 6px; background: #F1F5F9; border-radius: 2px;"><div style="height: 100%; width: ${barWidth}%; background: linear-gradient(90deg, #6366F1, #8B5CF6); border-radius: 2px;"></div></div>`;
        html += '</td>';

        dias.forEach(dia => {
            const valor = data.dias[dia] || 0;
            if (valor > 0) {
                // Heatmap: más intenso = más gasto
                const dayMax = totalesPorDia[dia] || 1;
                const ratio = valor / dayMax;
                const alpha = Math.max(0.08, Math.min(0.35, ratio * 0.4));
                html += `<td style="text-align: center; padding: 14px 8px; border-right: 1px solid #E2E8F0; background: rgba(99, 102, 241, ${alpha});">`;
                html += `<div style="font-weight: 600; color: #1E293B; font-size: 0.95em;">${cm(valor)}</div>`;
                html += '</td>';
            } else {
                html += '<td style="text-align: center; color: #CBD5E1; padding: 14px 8px; border-right: 1px solid #E2E8F0;">-</td>';
            }
        });

        html += `<td style="text-align: center; background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); font-weight: 700; padding: 14px 16px; color: #065F46; font-size: 1.05em;">${cm(totalVisibleProv)}</td>`;
        html += '</tr>';
    });

    // Fila de totales
    html += '<tr style="border-top: 2px solid #CBD5E1;">';
    html += `<td style="position: sticky; left: 0; background: linear-gradient(135deg, #F0F4FF 0%, #E8EDFF 100%); padding: 14px 16px; border-right: 2px solid #CBD5E1; font-weight: 700; color: #334155;">${window.t('balance:supplier_total_day')}</td>`;
    dias.forEach(dia => {
        const total = totalesPorDia[dia] || 0;
        if (total > 0) {
            html += `<td style="text-align: center; padding: 14px 8px; border-right: 1px solid #E2E8F0; background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); font-weight: 700; color: #9A3412;">${cm(total)}</td>`;
        } else {
            html += '<td style="text-align: center; color: #CBD5E1; padding: 14px 8px; border-right: 1px solid #E2E8F0;">-</td>';
        }
    });
    html += `<td style="text-align: center; background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%); font-weight: 700; padding: 14px 16px; color: #1E40AF; font-size: 1.1em;">${cm(totalGeneral)}</td>`;
    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Renderizar P&L diario - Estructura profesional
async function renderizarTablaPLDiario() {
    const container = document.getElementById('tabla-pl-diario');
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML = '<p class="empty-state">No hay datos para este mes</p>';
        return;
    }

    // ⛔ COLUMNAS = TODOS los días TRANSCURRIDOS del mes (1..hoy si es el mes en
    // curso; el mes entero si es pasado), no solo los días con ventas/compras.
    // MISMO universo que el gráfico "Beneficio neto por día" (modales.js), para
    // que tabla y gráfico den EXACTAMENTE el mismo total y el TOTAL de cada fila
    // sea SIEMPRE la suma de sus columnas (auditoría 2026-07-09: un extra pagado
    // un día sin ventas tenía total pero no columna, y un extra con FECHA FUTURA
    // entraba al total del mes "hasta hoy").
    const _hoyTabla = new Date();
    const _mesTabla = parseInt(document.getElementById('diario-mes')?.value) || (_hoyTabla.getMonth() + 1);
    const _anoTabla = parseInt(document.getElementById('diario-ano')?.value) || _hoyTabla.getFullYear();
    const _esMesEnCursoTabla = _anoTabla === _hoyTabla.getFullYear() && _mesTabla === (_hoyTabla.getMonth() + 1);
    const _diasEnMesTabla = new Date(_anoTabla, _mesTabla, 0).getDate();
    const _ultimoDiaTabla = _esMesEnCursoTabla ? _hoyTabla.getDate() : _diasEnMesTabla;
    const _diasCompletos = [];
    for (let d = 1; d <= _ultimoDiaTabla; d++) {
        _diasCompletos.push(`${_anoTabla}-${String(_mesTabla).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    const dias = window.filtrarDiasPorSemana(_diasCompletos, window.diarioSemanaActiva);
    const recetas = window.datosResumenMensual.ventas?.recetas || {};

    // Calcular totales por día
    const totalesPorDia = {};
    dias.forEach(dia => {
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

    // Obtener gastos fijos mensuales OPERATIVOS (de explotación): excluye
    // impuestos NO operativos (IVA/IGIC/IRPF/Sociedades), mantiene IAE/IBI/tasas.
    // MISMA regla que el punto de equilibrio (window.mlSumaGastosOperativos) → el
    // P&L (Cuenta de Resultados) y el equilibrio cuadran.
    let gastosFijosMes = 0;
    try {
        const gastosFijos = await window.api.getGastosFijos();
        if (gastosFijos && gastosFijos.length > 0) {
            gastosFijosMes = typeof window.mlSumaGastosOperativos === 'function'
                ? window.mlSumaGastosOperativos(gastosFijos)
                : gastosFijos.reduce((sum, g) => sum + parseFloat(g.monto_mensual || 0), 0);
        }
    } catch (error) {
        console.warn('Fallback a localStorage para gastos fijos:', error.message);
        // Scopear por tenant: datos de gastos fijos son específicos por restaurante
        // y nunca deben mezclarse entre tenants del mismo navegador.
        const raw = window.tenantStorage?.getItem('opex_inputs') || null;
        const opexData = JSON.parse(
            raw ||
            '{"alquiler":0,"personal":0,"suministros":0,"otros":0}'
        );
        gastosFijosMes =
            parseFloat(opexData.alquiler || 0) +
            parseFloat(opexData.personal || 0) +
            parseFloat(opexData.suministros || 0) +
            parseFloat(opexData.otros || 0);
    }

    // Calcular gastos fijos por día
    const mesSeleccionado = parseInt(document.getElementById('diario-mes').value);
    const anoSeleccionado = parseInt(document.getElementById('diario-ano').value);
    const diasEnMes = new Date(anoSeleccionado, mesSeleccionado, 0).getDate();
    const gastosFijosDia = diasEnMes > 0 ? gastosFijosMes / diasEnMes : 0;

    // Calcular compras por día (para sección de flujo de caja)
    const comprasData = window.datosResumenMensual.compras?.ingredientes || {};
    const comprasPorDia = {};
    dias.forEach(dia => { comprasPorDia[dia] = 0; });
    for (const [nombre, data] of Object.entries(comprasData)) {
        for (const [dia, diaData] of Object.entries(data.dias || {})) {
            if (comprasPorDia[dia] !== undefined) {
                comprasPorDia[dia] += diaData.total || diaData.precio || 0;
            }
        }
    }

    // 🆕 (2026-06-08) Calcular mermas por día desde /mermas?mes=&ano=.
    // Iker pidió que el P&L muestre las mermas como pérdida operativa real
    // (antes solo afectaban al stock, no al beneficio neto). El coste de
    // receta vendida (COSTES PROD) sigue intacto — eso mide la rentabilidad
    // de la carta. La merma se RESTA aparte para mostrar la realidad económica.
    //
    // Estructura del endpoint (verificada en mermas.routes.js:239-260):
    //   { id, ingrediente_id, ingrediente_nombre, cantidad, unidad,
    //     valor_perdida, motivo, nota, fecha, restaurante_id }
    // - cantidad y valor_perdida son SIEMPRE positivos (la tabla solo
    //   almacena pérdidas reales; los ajustes positivos del inventario
    //   masivo van por otro flujo y NO entran aquí).
    const mermasPorDia = {};
    dias.forEach(dia => { mermasPorDia[dia] = 0; });
    try {
        const mermasMes = await window.api.getMermas(mesSeleccionado, anoSeleccionado);
        if (Array.isArray(mermasMes)) {
            mermasMes.forEach(m => {
                const valor = parseFloat(m.valor_perdida) || 0;
                if (valor <= 0) return;
                // m.fecha llega como YYYY-MM-DD o ISO. Normalizar a YYYY-MM-DD.
                const fecha = String(m.fecha || '').substring(0, 10);
                if (mermasPorDia[fecha] !== undefined) {
                    mermasPorDia[fecha] += valor;
                }
            });
        }
    } catch (err) {
        console.warn('No se pudieron cargar mermas para el P&L:', err.message);
    }

    // 🍽️ Comida de personal por día (líneas `personal` de los pedidos).
    // Es GASTO operativo: resta al beneficio neto, pero NO es food cost (COSTES
    // PROD intactos) ni compras. Mismo COALESCE cantidad/precio que el backend
    // (personalCostExpr) para que el total cuadre con el chat / informe / pestaña.
    const comidaPersonalPorDia = {};
    dias.forEach(dia => { comidaPersonalPorDia[dia] = 0; });
    (window.pedidos || []).forEach(ped => {
        if (ped.deleted_at) return;
        const fecha = String(ped.fecha || '').substring(0, 10);
        if (comidaPersonalPorDia[fecha] === undefined) return;
        let lineas = ped.ingredientes;
        if (typeof lineas === 'string') { try { lineas = JSON.parse(lineas); } catch (_e) { lineas = []; } }
        if (!Array.isArray(lineas)) return;
        lineas.forEach(l => {
            if (l.personal !== true || l.estado === 'no-entregado') return;
            const cant = parseFloat(l.cantidadRecibida ?? l.cantidad) || 0;
            const precio = parseFloat(l.precioReal ?? l.precioUnitario ?? l.precio_unitario) || 0;
            comidaPersonalPorDia[fecha] += cant * precio;
        });
    });

    // 👷 Personal extra por día (pagos a extras por horas, tabla personal_extra).
    // Gasto operativo aparte: resta al beneficio neto, pero NO es food cost ni
    // compra. Mismo importe que el chat (resumen_pyg) y el informe mensual para
    // que el beneficio cuadre en TODOS los sitios.
    // El mapa cubre todo el periodo consultado; el TOTAL de la fila se calcula
    // después SOLO sobre los días MOSTRADOS (columnas), como mermas y comida.
    // Desde la auditoría 2026-07-09 las columnas son TODOS los días transcurridos
    // → un extra de un día sin ventas SÍ tiene columna y cuenta; un extra con
    // FECHA FUTURA no cuenta hasta que su día llegue (antes entraba al total del
    // mes "hasta hoy" sin columna y el total no era la suma de las columnas).
    const personalExtraPorDia = {};
    let totalPersonalExtra = 0;
    try {
        const mmPE = String(mesSeleccionado).padStart(2, '0');
        let _dPE = 1, _hPE = diasEnMes;
        if (window.diarioSemanaActiva && window.diarioSemanaActiva !== 'todas') {
            const _s = parseInt(window.diarioSemanaActiva);
            _dPE = (_s - 1) * 7 + 1;
            _hPE = Math.min(_s * 7, diasEnMes);
        }
        const desdePE = `${anoSeleccionado}-${mmPE}-${String(_dPE).padStart(2, '0')}`;
        const hastaPE = `${anoSeleccionado}-${mmPE}-${String(_hPE).padStart(2, '0')}`;
        const extras = await window.api.getPersonalExtra(desdePE, hastaPE);
        if (Array.isArray(extras)) {
            extras.forEach(e => {
                const fecha = String(e.fecha || '').substring(0, 10);
                const val = parseFloat(e.total) || 0;
                personalExtraPorDia[fecha] = (personalExtraPorDia[fecha] || 0) + val;
                totalPersonalExtra += val;
            });
        }
    } catch (err) {
        console.warn('No se pudo cargar personal extra para el P&L:', err.message);
    }

    // 🔗 ÚNICA FUENTE DE VERDAD: exponer los mapas por día (clave YYYY-MM-DD) para
    // que el widget lateral "Beneficio Neto por Día" (modales.js) reste EXACTAMENTE
    // los mismos componentes que esta tabla y el beneficio neto diario cuadre en
    // ambos. Se setean antes de que renderizarBeneficioNetoDiario() corra (se llama
    // justo después de esta función).
    window.plMermasPorDia = mermasPorDia;
    window.plComidaPersonalPorDia = comidaPersonalPorDia;
    window.plPersonalExtraPorDia = personalExtraPorDia;
    window.plGastosFijosDia = gastosFijosDia;

    // ═══════════════════════════════════════════════════════════
    // 📊 TABLA P&L - CUENTA DE RESULTADOS
    // ═══════════════════════════════════════════════════════════
    let html = `
    <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            ${window.t('balance:pl_title')}
            <span style="font-size: 12px; color: #64748b; font-weight: normal;">${window.t('balance:pl_subtitle')}</span>
            <button type="button" onclick="window.mlGastosOperativosInfo && window.mlGastosOperativosInfo()" title="¿Qué gastos cuentan en el P&L y por qué?" style="background: none; border: 1px solid #cbd5e1; border-radius: 999px; width: 19px; height: 19px; line-height: 17px; color: #64748b; cursor: pointer; font-size: 12px; font-weight: 700; padding: 0; font-style: italic; flex-shrink: 0;">i</button>
        </h3>
        <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    `;

    // Header
    html += `<thead><tr><th style="position: sticky; left: 0; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 14px 16px; text-align: left; font-weight: 600; color: #334155; border-bottom: 2px solid #cbd5e1;">${window.t('balance:pl_concept')}</th>`;
    dias.forEach(dia => {
        const fecha = new Date(dia + 'T12:00:00');
        // 🔒 Auditoría Capa 7 (S9): locale dinámico (incluye 'zh') via window.getDateLocale
        const _locale1788 = (typeof window !== 'undefined' && typeof window.getDateLocale === 'function') ? window.getDateLocale() : 'es-ES';
        const diaSemana = fecha.toLocaleDateString(_locale1788, { weekday: 'short' }).charAt(0).toUpperCase();
        html += `<th style="min-width: 85px; text-align: center; padding: 14px 8px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-bottom: 2px solid #cbd5e1; font-weight: 600; color: #334155;">${diaSemana} ${fecha.getDate()}/${fecha.getMonth() + 1}</th>`;
    });
    // 📊 FIX: si el usuario filtró por semana, el label debe decir "TOTAL SEMANA"
    const esSemana = window.diarioSemanaActiva && window.diarioSemanaActiva !== 'todas';
    const totalLabelHeader = esSemana
        ? (window.t('balance:pl_total_week') || 'TOTAL SEMANA')
        : window.t('balance:pl_total_month');
    html += `<th style="background: linear-gradient(135deg, #1e3a5f 0%, #152b48 100%); color: white; padding: 14px 16px; font-weight: 700;">${totalLabelHeader}</th></tr></thead>`;

    // Body
    html += '<tbody>';

    let totalIngresos = 0, totalCostes = 0;

    // ── FILA: INGRESOS ──
    html += `<tr style="background: #f0fdf4;"><td style="position: sticky; left: 0; background: #f0fdf4; padding: 16px; font-weight: 600; color: #166534; border-bottom: 1px solid #bbf7d0;">${window.t('balance:pl_revenue')}</td>`;
    dias.forEach(dia => {
        const val = totalesPorDia[dia].ingresos;
        totalIngresos += val;
        html += `<td style="text-align: center; padding: 16px 8px; font-weight: 600; color: #166534; border-bottom: 1px solid #bbf7d0;">${cm(val)}</td>`;
    });
    html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">${cm(totalIngresos)}</td></tr>`;

    // ── FILA: COSTES DE PRODUCCIÓN ──
    html += `<tr style="background: #fef2f2;"><td style="position: sticky; left: 0; background: #fef2f2; padding: 16px; font-weight: 600; color: #991b1b; border-bottom: 1px solid #fecaca;">${window.t('balance:pl_cogs')}</td>`;
    dias.forEach(dia => {
        const val = totalesPorDia[dia].costes;
        totalCostes += val;
        html += `<td style="text-align: center; padding: 16px 8px; color: #dc2626; border-bottom: 1px solid #fecaca;">${cm(val)}</td>`;
    });
    html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">${cm(totalCostes)}</td></tr>`;

    // ── SEPARADOR ──
    html += `<tr><td colspan="${dias.length + 2}" style="height: 3px; background: linear-gradient(90deg, #e2e8f0 0%, #94a3b8 50%, #e2e8f0 100%); padding: 0;"></td></tr>`;

    // ── FILA: MARGEN BRUTO (INGRESOS - COSTES PROD) ──
    const totalMargenBruto = totalIngresos - totalCostes;
    html += `<tr style="background: #fef3c7;"><td style="position: sticky; left: 0; background: #fef3c7; padding: 16px; font-weight: 700; color: #92400e; border-bottom: 1px solid #fcd34d;">${window.t('balance:pl_gross_margin')}</td>`;
    dias.forEach(dia => {
        const margenDia = totalesPorDia[dia].ingresos - totalesPorDia[dia].costes;
        const color = margenDia >= 0 ? '#d97706' : '#dc2626';
        html += `<td style="text-align: center; padding: 16px 8px; font-weight: 700; color: ${color}; border-bottom: 1px solid #fcd34d;">${cm(margenDia)}</td>`;
    });
    html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">${cm(totalMargenBruto)}</td></tr>`;

    // ── FILA: MERMAS DEL DÍA (🆕 2026-06-08) ──
    // Solo se muestra si hay al menos 1 merma en el periodo, para no contaminar
    // visualmente el P&L cuando el negocio no tuvo pérdidas registradas.
    let totalMermas = 0;
    dias.forEach(dia => { totalMermas += mermasPorDia[dia] || 0; });
    if (totalMermas > 0) {
        html += `<tr style="background: #fee2e2;"><td style="position: sticky; left: 0; background: #fee2e2; padding: 16px; font-weight: 600; color: #991b1b; border-bottom: 1px solid #fecaca;" title="Pérdidas registradas vía inventario físico, no incluidas en el coste de receta vendida">${window.t('balance:pl_waste') || '🗑️ MERMAS DEL DÍA'}</td>`;
        dias.forEach(dia => {
            const val = mermasPorDia[dia] || 0;
            html += `<td style="text-align: center; padding: 16px 8px; color: #dc2626; border-bottom: 1px solid #fecaca;">${val > 0 ? '−' + cm(val) : cm(0)}</td>`;
        });
        html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">−${cm(totalMermas)}</td></tr>`;
    }

    // ── FILA: COMIDA DE PERSONAL DEL DÍA (🍽️) ──
    // Gasto operativo aparte (resta al beneficio). Solo se muestra si hay gasto.
    let totalComidaPersonal = 0;
    dias.forEach(dia => { totalComidaPersonal += comidaPersonalPorDia[dia] || 0; });
    if (totalComidaPersonal > 0) {
        html += `<tr style="background: #f3e8ff;"><td style="position: sticky; left: 0; background: #f3e8ff; padding: 16px; font-weight: 600; color: #6b21a8; border-bottom: 1px solid #e9d5ff;" title="Gasto en comida del equipo. No es food cost ni compra del restaurante.">${window.t('balance:pl_staff_meals') || '🍽️ COMIDA PERSONAL'}</td>`;
        dias.forEach(dia => {
            const val = comidaPersonalPorDia[dia] || 0;
            html += `<td style="text-align: center; padding: 16px 8px; color: #7c3aed; border-bottom: 1px solid #e9d5ff;">${val > 0 ? '−' + cm(val) : cm(0)}</td>`;
        });
        html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">−${cm(totalComidaPersonal)}</td></tr>`;
    }

    // ── FILA: PERSONAL EXTRA DEL DÍA (👷) ──
    // Pagos a extras por horas. Gasto operativo aparte (resta al beneficio).
    // El TOTAL de la fila = suma de las COLUMNAS mostradas (auditoría 2026-07-09):
    // como las columnas ya son todos los días transcurridos, ningún extra pasado
    // se pierde, y un extra con FECHA FUTURA no cuenta hasta que llegue su día.
    totalPersonalExtra = dias.reduce((s, dia) => s + (personalExtraPorDia[dia] || 0), 0);
    if (totalPersonalExtra > 0) {
        html += `<tr style="background: #e0f2fe;"><td style="position: sticky; left: 0; background: #e0f2fe; padding: 16px; font-weight: 600; color: #075985; border-bottom: 1px solid #bae6fd;" title="Pagos a extras por horas. No es food cost ni compra del restaurante.">${window.t('balance:pl_extra_staff') || '👷 PERSONAL EXTRA'}</td>`;
        dias.forEach(dia => {
            const val = personalExtraPorDia[dia] || 0;
            html += `<td style="text-align: center; padding: 16px 8px; color: #0284c7; border-bottom: 1px solid #bae6fd;">${val > 0 ? '−' + cm(val) : cm(0)}</td>`;
        });
        html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">−${cm(totalPersonalExtra)}</td></tr>`;
    }

    // ── FILA: GASTOS FIJOS / DÍA ──
    // El TOTAL MES de gastos fijos = gasto fijo diario × nº de días MOSTRADOS
    // (desde la auditoría 2026-07-09, TODOS los días transcurridos del mes =
    // mismo universo que el gráfico). Así el TOTAL cuadra EXACTAMENTE con la
    // suma de los beneficios netos diarios: cada columna ya resta su
    // gastoFijoDia y el total suma lo mismo. Ni más ni menos.
    //
    // Historia (Iker 2026-07-08): el total prorrateaba a los días de CALENDARIO
    // transcurridos (p.ej. día 8) aunque solo hubiera 4 días con ventas → cargaba
    // 4 días de fijos "fantasma" sin ingresos detrás y el total NO cuadraba con la
    // suma de las columnas (salía 396€ en vez de 5.610€). Antes de eso restaba el
    // mes ENTERO (−29.582€ falso). Regla correcta y sin sorpresas: el total es la
    // suma de lo que se ve; cada día ya lleva descontado su gasto fijo.
    const totalGastosFijosMostrados = gastosFijosDia * dias.length;
    html += `<tr style="background: #fce7f3;"><td style="position: sticky; left: 0; background: #fce7f3; padding: 16px; font-weight: 600; color: #9d174d; border-bottom: 1px solid #f9a8d4;">${window.t('balance:pl_fixed_expenses')}</td>`;
    dias.forEach(() => {
        html += `<td style="text-align: center; padding: 16px 8px; color: #be185d; border-bottom: 1px solid #f9a8d4;">${cm(gastosFijosDia)}</td>`;
    });
    html += `<td style="text-align: center; background: #1e3a5f; color: white; font-weight: 700; padding: 16px;">${cm(totalGastosFijosMostrados)}</td></tr>`;

    // ── SEPARADOR GRUESO ──
    html += `<tr><td colspan="${dias.length + 2}" style="height: 4px; background: linear-gradient(90deg, #1e3a5f 0%, #3b82f6 50%, #1e3a5f 100%); padding: 0;"></td></tr>`;

    // ── FILA: BENEFICIO NETO (MARGEN BRUTO - MERMAS - GASTOS FIJOS) ──
    // Total del período coherente con las filas de mermas y gastos fijos.
    // (2026-06-08) Resta también las mermas del día — antes solo gastos fijos.
    html += `<tr style="background: #dbeafe;"><td style="position: sticky; left: 0; background: #dbeafe; padding: 18px 16px; font-weight: 700; font-size: 15px; color: #1e3a5f; border-bottom: 2px solid #93c5fd;">${window.t('balance:pl_net_profit')}</td>`;
    dias.forEach(dia => {
        const margenDia = totalesPorDia[dia].ingresos - totalesPorDia[dia].costes;
        const mermaDia = mermasPorDia[dia] || 0;
        const personalDia = comidaPersonalPorDia[dia] || 0;
        const extraDia = personalExtraPorDia[dia] || 0;
        const beneficioNeto = margenDia - mermaDia - personalDia - extraDia - gastosFijosDia;
        const color = beneficioNeto >= 0 ? '#1e3a5f' : '#dc2626';
        const bg = beneficioNeto >= 0 ? '#dbeafe' : '#fee2e2';
        html += `<td style="text-align: center; padding: 18px 8px; font-weight: 700; font-size: 14px; color: ${color}; background: ${bg}; border-bottom: 2px solid #93c5fd;">${cm(beneficioNeto)}</td>`;
    });
    const totalBeneficioNeto = totalMargenBruto - totalMermas - totalComidaPersonal - totalPersonalExtra - totalGastosFijosMostrados;
    // 🎨 Tonos legibles sobre fondo navy oscuro (rediseño 2026-05-26).
    // Antes: #22c55e (verde fluo) / #ef4444 (rojo fuerte) — ilegibles
    // sobre navy.
    // Usamos !important inline para vencer el "color: #1e293b !important"
    // genérico que el tema editorial aplica a todas las table td.
    const colorTotal = totalBeneficioNeto >= 0 ? '#a3e9a4' : '#fda4af';
    html += `<td style="text-align: center; background: linear-gradient(135deg, #1e3a5f 0%, #152b48 100%); color: ${colorTotal} !important; font-weight: 800; font-size: 16px; padding: 18px; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${cm(totalBeneficioNeto)}</td></tr>`;

    html += '</tbody></table></div>';

    // ═══════════════════════════════════════════════════════════
    // 💳 SECCIÓN FLUJO DE CAJA (COMPRAS)
    // ═══════════════════════════════════════════════════════════
    let totalCompras = 0;
    dias.forEach(dia => { totalCompras += comprasPorDia[dia] || 0; });

    // 🧾 IVA soportado del periodo — sub-línea INFORMATIVA del bloque de compras (su
    // sitio natural: es el IVA DE estas compras). Se recupera en la declaración, NO es
    // coste ni entra en el P&L. A prueba de fallos: si el endpoint falla, no se muestra.
    let ivaSoportadoLinea = '';
    try {
        const ivaData = await window.api.getIvaSoportado(mesSeleccionado, anoSeleccionado);
        const ivaSop = parseFloat(ivaData?.iva_soportado) || 0;
        const baseImponible = parseFloat(ivaData?.base_imponible) || 0;
        if (ivaSop > 0) {
            ivaSoportadoLinea = `
                <div style="margin-top: 8px; font-size: 12px; color: #92400e;" title="${window.t('balance:iva_soportado_hint')}">
                    🧾 ${window.t('balance:iva_soportado_title')}: <strong style="color: #b45309;">${cm(ivaSop)}</strong>
                    <div style="font-size: 11px; color: #a16207; margin-top: 1px;">
                        ${window.t('balance:iva_base_hint', { base: cm(baseImponible) })}
                    </div>
                </div>`;
        }
    } catch (e) { /* informativo: si falla, no rompe la vista */ }

    html += `
    <div style="margin-top: 24px; padding: 20px; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 12px; border: 1px solid #fcd34d;">
        <h4 style="margin: 0 0 16px 0; color: #92400e; font-size: 15px; display: flex; align-items: center; gap: 8px;">
            ${window.t('balance:cashflow_title')}
            <span style="font-size: 11px; color: #a16207; font-weight: normal; background: #fef9c3; padding: 2px 8px; border-radius: 4px;">${window.t('balance:cashflow_warning')}</span>
        </h4>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
                <div style="font-size: 12px; color: #92400e; margin-bottom: 4px;">${window.t('balance:cashflow_total')}</div>
                <div style="font-size: 28px; font-weight: 700; color: #d97706;">${cm(totalCompras)}</div>
                ${ivaSoportadoLinea}
            </div>
            <div style="flex: 2; min-width: 300px;">
                <div style="font-size: 12px; color: #92400e; margin-bottom: 8px;">${window.t('balance:cashflow_breakdown')}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
    `;

    dias.forEach(dia => {
        const fecha = new Date(dia + 'T12:00:00');
        const val = comprasPorDia[dia] || 0;
        if (val > 0) {
            html += `<span style="background: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; border: 1px solid #fcd34d;">${fecha.getDate()}/${fecha.getMonth() + 1}: <strong style="color: #d97706;">${cm(val)}</strong></span>`;
        }
    });

    html += `
                </div>
            </div>
        </div>
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #fcd34d; font-size: 12px; color: #92400e;">
            ${window.t('balance:cashflow_note')}
        </div>
    </div>
    `;

    container.innerHTML = html;
}

// Exportar a Excel
window.exportarDiarioExcel = async function () {
    if (!window.datosResumenMensual) {
        window.showToast('Primero carga los datos', 'warning');
        return;
    }

    // XLSX is lazy-loaded from vendors; legacy scripts can't ES6-import so
    // window.loadXLSX is exposed in main.js for this very purpose.
    if (typeof window.loadXLSX === 'function') {
        await window.loadXLSX();
    }
    if (typeof XLSX === 'undefined') {
        window.showToast('No se pudo cargar el motor de Excel. Recarga la página e inténtalo de nuevo.', 'error');
        return;
    }

    // 📅 El export debe respetar el filtro de semana activo: si el usuario está viendo
    // Semana 2, el Excel NO puede incluir todo el mes con totales del mes — sería engañoso.
    const diasExport = window.filtrarDiasPorSemana(
        window.datosResumenMensual.dias || [],
        window.diarioSemanaActiva
    );
    const diasSet = new Set(diasExport);

    // Crear workbook con los datos
    const wb = XLSX.utils.book_new();

    // Hoja de compras — totales recalculados sobre días visibles
    const comprasData = [];
    comprasData.push(['Ingrediente', ...diasExport, 'TOTAL']);
    for (const [nombre, data] of Object.entries(
        window.datosResumenMensual.compras?.ingredientes || {}
    )) {
        const fila = [nombre];
        let totalFila = 0;
        diasExport.forEach(dia => {
            const d = data.dias[dia];
            fila.push(d?.precio ?? '');
            if (d) totalFila += (d.total ?? (d.precio * d.cantidad)) || 0;
        });
        fila.push(Number(totalFila.toFixed(2)));
        comprasData.push(fila);
    }
    const wsCompras = XLSX.utils.aoa_to_sheet(comprasData);
    XLSX.utils.book_append_sheet(wb, wsCompras, 'Compras');

    // Hoja de ventas — totales recalculados sobre días visibles
    const ventasData = [];
    ventasData.push(['Receta', ...diasExport, 'TOTAL']);
    for (const [nombre, data] of Object.entries(window.datosResumenMensual.ventas?.recetas || {})) {
        const fila = [nombre];
        let totalIngresosFila = 0;
        diasExport.forEach(dia => {
            const d = data.dias[dia];
            fila.push(d?.ingresos ?? '');
            if (d) totalIngresosFila += d.ingresos || 0;
        });
        fila.push(Number(totalIngresosFila.toFixed(2)));
        ventasData.push(fila);
    }
    const wsVentas = XLSX.utils.aoa_to_sheet(ventasData);
    XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

    // Hoja de proveedores — suma por proveedor restringida a días visibles
    const proveedores = window.datosResumenMensual.compras?.porProveedor || {};
    if (Object.keys(proveedores).length > 0) {
        const provData = [];
        provData.push(['Proveedor', ...diasExport, 'TOTAL']);
        for (const [nombre, data] of Object.entries(proveedores)) {
            const fila = [nombre];
            let totalProv = 0;
            diasExport.forEach(dia => {
                const v = data.dias?.[dia] || 0;
                fila.push(v || '');
                totalProv += v;
            });
            fila.push(Number(totalProv.toFixed(2)));
            provData.push(fila);
        }
        const wsProv = XLSX.utils.aoa_to_sheet(provData);
        XLSX.utils.book_append_sheet(wb, wsProv, 'Proveedores');
    }

    // Descargar — nombre refleja si es semana o mes completo
    const mes = document.getElementById('diario-mes').value;
    const ano = document.getElementById('diario-ano').value;
    const sufijo = window.diarioSemanaActiva && window.diarioSemanaActiva !== 'todas'
        ? `_Semana${window.diarioSemanaActiva}`
        : '';
    XLSX.writeFile(wb, `Control_Diario_${ano}-${mes.padStart(2, '0')}${sufijo}.xlsx`);
    // evitar warning de variable no usada en linter
    void diasSet;

    window.showToast('Excel exportado', 'success');
};
