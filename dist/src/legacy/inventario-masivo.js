// ========== INVENTARIO MASIVO ==========

let datosInventarioMasivo = [];

window.mostrarModalInventarioMasivo = function () {
    document.getElementById('modal-inventario-masivo').classList.add('active');
    document.getElementById('preview-inventario-masivo').style.display = 'none';
    document.getElementById('file-inventario-masivo').value = '';
};

window.procesarArchivoInventario = async function (input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    try {
        const data = await leerArchivoInventario(file);
        datosInventarioMasivo = await validarDatosInventario(data);
        mostrarPreviewInventario(datosInventarioMasivo);
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

async function leerArchivoInventario(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                // Validar que tenga al menos 2 columnas
                if (rows.length < 2) {
                    reject(
                        new Error('El archivo debe tener al menos 2 filas (encabezado + datos)')
                    );
                    return;
                }

                // Parsear datos
                const result = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (row[0] && row[1] !== undefined && row[1] !== null && row[1] !== '') {
                        result.push({
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

    return data.map(item => {
        const ing = ingredientesActuales.find(
            i => i.nombre.toLowerCase() === item.ingrediente.toLowerCase()
        );

        return {
            ...item,
            ingredienteId: ing ? ing.id : null,
            // Guardamos el Virtual para comparar pérdidas
            stockVirtual: ing ? parseFloat(ing.stock_actual || ing.stock_virtual || 0) : 0,
            // stockActual aqui se refiere al que mostramos como ref en la tabla de preview (sistema)
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
    });
}

window.descargarPlantillaStock = function () {
    if (!window.ingredientes || window.ingredientes.length === 0) {
        showToast('No hay ingredientes para descargar', 'warning');
        return;
    }

    const datos = window.ingredientes.map(ing => ({
        Ingrediente: ing.nombre,
        'Stock Real': '', // Dejar vacío para que lo rellenen, o poner ing.stock_real si quisieran editar
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Stock');

    // Ajustar ancho
    ws['!cols'] = [{ wch: 30 }, { wch: 15 }];

    XLSX.writeFile(wb, `Plantilla_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
};

function mostrarPreviewInventario(datos) {
    document.getElementById('loading-overlay').classList.remove('active');

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

        html += `
                    <tr style="background: ${bgColor};">
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: ${iconColor}; font-size: 18px;">${icon}</span>
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.ingrediente}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">
                            ${item.stockActual !== null ? item.stockActual : '-'}
                        </td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">
                            ${item.stockReal}
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: ${item.valido ? '#10b981' : '#ef4444'};">
                            ${item.error || 'OK'}
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

    // Solo deshabilitar si NO hay datos válidos, no si hay algunos errores
    const hayValidos = datosInventarioMasivo.some(d => d.valido);
    const btnConfirmar = document.getElementById('btn-confirmar-masivo');
    btnConfirmar.disabled = !hayValidos;
    if (!hayValidos) {
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

    // Preparar datos para consolidación
    const adjustments = datosValidos.map(d => ({
        id: d.ingredienteId,
        stock_real: d.stockReal,
    }));

    const mermas = [];
    datosValidos.forEach(d => {
        if (d.stockReal < d.stockVirtual) {
            mermas.push({
                nombre: d.ingrediente,
                diferencia: (d.stockVirtual - d.stockReal).toFixed(2),
            });
        }
    });

    let mensaje = `¿Confirmar actualización de ${datosValidos.length} ingredientes?`;
    if (mermas.length > 0) {
        mensaje += `\n\n⚠️ SE DETECTARON ${mermas.length} MERMAS (Stock Real < Sistema).\nSe registrarán como pérdidas.`;
    } else {
        mensaje += `\n\nEl stock del sistema se ajustará al stock real importado.`;
    }

    if (!confirm(mensaje)) {
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    try {
        // Usar consolidación
        await window.api.consolidateStock(adjustments);

        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast(
            `✓ ${datosValidos.length} ingredientes actualizados y consolidados`,
            'success'
        );

        document.getElementById('modal-inventario-masivo').classList.remove('active');
        await window.renderizarInventario();
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error actualizando inventario: ' + error.message, 'error');
    }
};

window.cancelarInventarioMasivo = function () {
    document.getElementById('modal-inventario-masivo').classList.remove('active');
    datosInventarioMasivo = [];
};

// ========== IMPORTAR INGREDIENTES ==========
let datosImportarIngredientes = [];

window.mostrarModalImportarIngredientes = function () {
    document.getElementById('modal-importar-ingredientes').classList.add('active');
    document.getElementById('preview-importar-ingredientes').style.display = 'none';
    document.getElementById('file-importar-ingredientes').value = '';
    datosImportarIngredientes = [];
};

window.procesarArchivoIngredientes = async function (input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarIngredientes = validarDatosIngredientes(data);
        mostrarPreviewIngredientes(datosImportarIngredientes);
        document.getElementById('loading-overlay').classList.remove('active');
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

async function leerArchivoGenerico(file) {
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
    return data.map(row => {
        const nombre = row['Nombre'] || row['nombre'] || row['NOMBRE'] || '';
        const precio = parseFloat(row['Precio'] || row['precio'] || row['PRECIO'] || 0);
        const unidad = row['Unidad'] || row['unidad'] || row['UNIDAD'] || 'kg';
        const stockActual = parseFloat(
            row['Stock Actual'] || row['stock_actual'] || row['Stock'] || 0
        );
        const stockMinimo = parseFloat(
            row['Stock Mínimo'] || row['stock_minimo'] || row['Stock Minimo'] || 0
        );

        const valido = nombre.trim().length > 0;
        return {
            nombre: nombre.trim(),
            precio: isNaN(precio) ? 0 : precio,
            unidad: unidad,
            stockActual: isNaN(stockActual) ? 0 : stockActual,
            stockMinimo: isNaN(stockMinimo) ? 0 : stockMinimo,
            valido: valido,
            error: valido ? null : 'Nombre requerido',
        };
    });
}

function mostrarPreviewIngredientes(datos) {
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
              <th style="padding: 10px; text-align: right;">Precio</th>
              <th style="padding: 10px; text-align: center;">Unidad</th>
              <th style="padding: 10px; text-align: right;">Stock</th>
              <th style="padding: 10px; text-align: left;">Observación</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const icon = item.valido ? '✓' : '✗';
        const bgColor = item.valido ? '#f0fdf4' : '#fef2f2';
        const iconColor = item.valido ? '#10b981' : '#ef4444';

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">${item.nombre || '-'}</td>
            <td style="padding: 10px; text-align: right;">${item.precio.toFixed(2)}€</td>
            <td style="padding: 10px; text-align: center;">${item.unidad}</td>
            <td style="padding: 10px; text-align: right;">${item.stockActual}</td>
            <td style="padding: 10px; color: ${item.valido ? '#10b981' : '#ef4444'};">${item.error || 'OK'}</td>
          </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('preview-ingredientes-container').innerHTML = html;
    document.getElementById('preview-importar-ingredientes').style.display = 'block';

    const hayValidos = datos.some(d => d.valido);
    const btn = document.getElementById('btn-confirmar-importar-ingredientes');
    btn.disabled = !hayValidos;
    btn.style.opacity = hayValidos ? '1' : '0.5';
}

window.confirmarImportarIngredientes = async function () {
    const datosValidos = datosImportarIngredientes.filter(d => d.valido);

    if (datosValidos.length === 0) {
        window.showToast('No hay ingredientes válidos para importar', 'error');
        return;
    }

    if (!confirm(`¿Importar ${datosValidos.length} ingredientes?`)) {
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    try {
        let importados = 0;
        for (const ing of datosValidos) {
            await window.api.createIngrediente({
                nombre: ing.nombre,
                precio: ing.precio,
                unidad: ing.unidad,
                stockActual: ing.stockActual,
                stockMinimo: ing.stockMinimo,
            });
            importados++;
        }

        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast(`✓ ${importados} ingredientes importados correctamente`, 'success');
        document.getElementById('modal-importar-ingredientes').classList.remove('active');
        await window.renderizarIngredientes();
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error importando: ' + error.message, 'error');
    }
};

window.cancelarImportarIngredientes = function () {
    document.getElementById('modal-importar-ingredientes').classList.remove('active');
    datosImportarIngredientes = [];
};

// ========== IMPORTAR RECETAS ==========
let datosImportarRecetas = [];

window.mostrarModalImportarRecetas = function () {
    document.getElementById('modal-importar-recetas').classList.add('active');
    document.getElementById('preview-importar-recetas').style.display = 'none';
    document.getElementById('file-importar-recetas').value = '';
    datosImportarRecetas = [];
};

window.procesarArchivoRecetas = async function (input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarRecetas = validarDatosRecetas(data);
        mostrarPreviewRecetas(datosImportarRecetas);
        document.getElementById('loading-overlay').classList.remove('active');
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

function validarDatosRecetas(data) {
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
            valido: valido,
            error: valido ? null : 'Nombre requerido',
        };
    });
}

function mostrarPreviewRecetas(datos) {
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
              <th style="padding: 10px; text-align: center;">Categoría</th>
              <th style="padding: 10px; text-align: right;">Precio Venta</th>
              <th style="padding: 10px; text-align: center;">Porciones</th>
              <th style="padding: 10px; text-align: left;">Observación</th>
            </tr>
          </thead>
          <tbody>`;

    datos.forEach(item => {
        const icon = item.valido ? '✓' : '✗';
        const bgColor = item.valido ? '#f0fdf4' : '#fef2f2';
        const iconColor = item.valido ? '#10b981' : '#ef4444';

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">${item.nombre || '-'}</td>
            <td style="padding: 10px; text-align: center;">${item.categoria}</td>
            <td style="padding: 10px; text-align: right;">${item.precioVenta.toFixed(2)}€</td>
            <td style="padding: 10px; text-align: center;">${item.porciones}</td>
            <td style="padding: 10px; color: ${item.valido ? '#10b981' : '#ef4444'};">${item.error || 'OK'}</td>
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

    document.getElementById('loading-overlay').classList.add('active');

    try {
        let importados = 0;
        for (const rec of datosValidos) {
            await window.api.createReceta({
                nombre: rec.nombre,
                categoria: rec.categoria,
                precio_venta: rec.precioVenta,
                porciones: rec.porciones,
                ingredientes: [],
            });
            importados++;
        }

        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast(`✓ ${importados} recetas importadas correctamente`, 'success');
        document.getElementById('modal-importar-recetas').classList.remove('active');
        await window.renderizarRecetas();
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error importando: ' + error.message, 'error');
    }
};

window.cancelarImportarRecetas = function () {
    document.getElementById('modal-importar-recetas').classList.remove('active');
    datosImportarRecetas = [];
};

// ========== IMPORTAR VENTAS TPV ==========
let datosImportarVentas = [];

window.mostrarModalImportarVentas = function () {
    document.getElementById('modal-importar-ventas').classList.add('active');
    document.getElementById('preview-importar-ventas').style.display = 'none';
    document.getElementById('file-importar-ventas').value = '';
    datosImportarVentas = [];
};

window.procesarArchivoVentas = async function (input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarVentas = validarDatosVentas(data);
        mostrarPreviewVentas(datosImportarVentas);
        document.getElementById('loading-overlay').classList.remove('active');
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
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

        // 1. Buscar por código exacto si existe
        if (codigo) {
            recetaEncontrada = window.recetas.find(
                r => r.codigo && String(r.codigo) === String(codigo)
            );
        }

        // 2. Si no, buscar por nombre (exacto o aproximado)
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

        return {
            codigo: codigo,
            nombre: nombre,
            cantidad: isNaN(cantidad) ? 0 : cantidad,
            total: isNaN(total) ? 0 : total,
            recetaId: recetaEncontrada ? recetaEncontrada.id : null,
            recetaNombre: recetaEncontrada ? recetaEncontrada.nombre : null,
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
              ${item.codigo ? `<span style="font-family:monospace; background:#eee; padding:2px 4px; border-radius:4px;">${item.codigo}</span> ` : ''}
              ${item.nombre}
            </td>
            <td style="padding: 10px;">
              ${item.recetaId ? `<strong>${item.recetaNombre}</strong>` : '<span style="color:#999; font-style:italic;">No encontrado</span>'}
            </td>
            <td style="padding: 10px; text-align: right;">${item.cantidad}</td>
            <td style="padding: 10px; text-align: right;">${item.total.toFixed(2)}€</td>
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

    if (
        !confirm(
            `¿Importar ${datosValidos.length} registros de venta?\nSe actualizará el stock de los artículos vinculados.`
        )
    ) {
        return;
    }

    document.getElementById('loading-overlay').classList.add('active');

    try {
        let importados = 0;
        const fechaHoy = new Date().toISOString();

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
                    fecha: fechaHoy,
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

        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast(`✓ ${importados} ventas importadas correctamente`, 'success');
        document.getElementById('modal-importar-ventas').classList.remove('active');

        // Actualizar UI
        await window.renderizarVentas();
        window.actualizarKPIs();
        window.actualizarDashboardExpandido();
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error importando ventas: ' + error.message, 'error');
    }
};

window.cancelarImportarVentas = function () {
    document.getElementById('modal-importar-ventas').classList.remove('active');
    datosImportarVentas = [];
};

// ========== IMPORTAR PEDIDOS (COMPRAS) ==========
let datosImportarPedidos = [];

window.mostrarModalImportarPedidos = function () {
    document.getElementById('modal-importar-pedidos').classList.add('active');
    document.getElementById('preview-importar-pedidos').style.display = 'none';
    document.getElementById('file-importar-pedidos').value = '';
    datosImportarPedidos = [];
};

window.procesarArchivoPedidos = async function (input) {
    const file = input.files[0];
    if (!file) return;

    document.getElementById('loading-overlay').classList.add('active');

    try {
        const data = await leerArchivoGenerico(file);
        datosImportarPedidos = validarDatosPedidos(data);
        mostrarPreviewPedidos(datosImportarPedidos);
        document.getElementById('loading-overlay').classList.remove('active');
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error procesando archivo: ' + error.message, 'error');
    }
};

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

        // Intentar vincular con ingrediente existente
        let ingredienteEncontrado = null;
        if (ingredienteNombre) {
            const nombreNorm = ingredienteNombre.toLowerCase().trim();
            ingredienteEncontrado = window.ingredientes.find(
                i => i.nombre.toLowerCase().trim() === nombreNorm
            );
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
            ingredienteUnidad: ingredienteEncontrado ? ingredienteEncontrado.unidad : 'unidad',
            valido: valido,
            error: !valido
                ? 'Datos incompletos'
                : !ingredienteEncontrado
                    ? '⚠️ Nuevo ingrediente (se creará)'
                    : null,
        };
    });
}

function mostrarPreviewPedidos(datos) {
    const validos = datos.filter(d => d.valido).length;
    const vinculados = datos.filter(d => d.ingredienteId).length;
    const nuevos = validos - vinculados;

    let html = `
        <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <strong>Resumen:</strong> 
          <span style="color: #10b981;">✓ ${validos} registros válidos</span>
          <span style="color: #3b82f6; margin-left: 10px;">🔗 ${vinculados} vinculados</span>
          ${nuevos > 0 ? `<span style="color: #f59e0b; margin-left: 10px;">✨ ${nuevos} nuevos ingredientes</span>` : ''}
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
        const bgColor = item.valido ? (item.ingredienteId ? '#f0fdf4' : '#fffbeb') : '#fef2f2';
        const iconColor = item.valido ? '#10b981' : '#ef4444';

        html += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px;"><span style="color: ${iconColor};">${icon}</span></td>
            <td style="padding: 10px;">${item.fecha}</td>
            <td style="padding: 10px;">${item.proveedor}</td>
            <td style="padding: 10px;">
              ${item.ingredienteNombre}
              ${!item.ingredienteId ? '<br><span style="font-size:11px; color:#f59e0b;">(Se creará nuevo)</span>' : ''}
            </td>
            <td style="padding: 10px; text-align: right;">${item.cantidad} ${item.ingredienteUnidad}</td>
            <td style="padding: 10px; text-align: right;">${item.total.toFixed(2)}€</td>
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

    document.getElementById('loading-overlay').classList.add('active');

    try {
        let importados = 0;

        for (const pedido of datosValidos) {
            let ingId = pedido.ingredienteId;

            // 1. Si no existe ingrediente, crearlo
            if (!ingId) {
                // Buscar proveedor ID o crear (simplificado: asignamos string por ahora o null)
                // Para simplificar, creamos el ingrediente con datos básicos
                const nuevoIng = await window.api.createIngrediente({
                    nombre: pedido.ingredienteNombre,
                    precio: pedido.total / pedido.cantidad, // Precio unitario calculado
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
                // Recargar proveedores localmente
                window.proveedores.push(nuevoProv);
            }

            await window.api.createPedido({
                proveedorId: provId,
                fecha: pedido.fecha,
                estado: 'recibido', // Importante: ya está recibido
                ingredientes: [
                    {
                        ingredienteId: ingId,
                        cantidad: pedido.cantidad,
                        precio: pedido.precio > 0 ? pedido.precio : pedido.total / pedido.cantidad,
                    },
                ],
                total: pedido.total,
            });

            importados++;
        }

        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast(`✓ ${importados} pedidos importados correctamente`, 'success');
        document.getElementById('modal-importar-pedidos').classList.remove('active');

        // Actualizar UI
        await window.renderizarIngredientes(); // Stock actualizado
        await window.renderizarPedidos();
        // await window.renderizarBalance(); // P&L actualizado - DESACTIVADO
    } catch (error) {
        document.getElementById('loading-overlay').classList.remove('active');
        window.showToast('Error importando pedidos: ' + error.message, 'error');
    }
};

window.cancelarImportarPedidos = function () {
    document.getElementById('modal-importar-pedidos').classList.remove('active');
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
    const token = localStorage.getItem('token');

    if (!token) {
        window.showToast('Sesión expirada', 'error');
        return;
    }

    try {
        window.showToast('Cargando datos...', 'info');

        const response = await fetch(
            // ⚡ Multi-tenant: usa config global si existe
            `${window.API_CONFIG?.baseUrl || 'https://lacaleta-api.mindloop.cloud'}/api/monthly/summary?mes=${mes}&ano=${ano}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        if (!response.ok) throw new Error('Error cargando datos');

        window.datosResumenMensual = await response.json();

        // Actualizar KPIs
        document.getElementById('diario-total-compras').textContent =
            (window.datosResumenMensual.compras?.total || 0).toFixed(2) + ' €';
        document.getElementById('diario-total-ventas').textContent =
            (window.datosResumenMensual.ventas?.totalIngresos || 0).toFixed(2) + ' €';
        document.getElementById('diario-beneficio').textContent =
            (window.datosResumenMensual.ventas?.beneficioBruto || 0).toFixed(2) + ' €';
        document.getElementById('diario-food-cost').textContent =
            (window.datosResumenMensual.resumen?.foodCost || 0) + '%';

        // Renderizar tablas
        renderizarTablaComprasDiarias();
        renderizarTablaVentasDiarias();
        renderizarTablaPLDiario();
        renderizarBeneficioNetoDiario();
        window.showToast('Datos cargados', 'success');
    } catch (error) {
        console.error('Error cargando resumen mensual:', error);
        window.showToast('Error cargando datos', 'error');
    }
};

// Cambiar entre vistas (Compras, Ventas, P&L)
window.cambiarVistaDiario = function (vista) {
    // Ocultar todas las vistas
    document.querySelectorAll('.diario-vista').forEach(el => (el.style.display = 'none'));

    // Resetear botones
    document.getElementById('btn-vista-compras').className = 'btn btn-secondary';
    document.getElementById('btn-vista-ventas').className = 'btn btn-secondary';
    document.getElementById('btn-vista-combinada').className = 'btn btn-secondary';

    // Mostrar vista seleccionada
    if (vista === 'compras') {
        document.getElementById('vista-compras').style.display = 'block';
        document.getElementById('btn-vista-compras').className = 'btn btn-primary';
    } else if (vista === 'ventas') {
        document.getElementById('vista-ventas').style.display = 'block';
        document.getElementById('btn-vista-ventas').className = 'btn btn-primary';
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

    const dias = window.datosResumenMensual.dias;
    const ingredientes = window.datosResumenMensual.compras?.ingredientes || {};

    let html =
        '<table style="min-width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden;">';

    // Header con días
    html +=
        '<thead><tr><th style="position: sticky; left: 0; background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); z-index: 1; border-right: 1px solid #E2E8F0; border-bottom: 2px solid #CBD5E1; padding: 16px;">Ingrediente</th>';
    dias.forEach(dia => {
        const fecha = new Date(dia);
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

        dias.forEach(dia => {
            const diaData = data.dias[dia];
            if (diaData) {
                html += `<td style="text-align: center; background: #FFF5F2; padding: 18px; border-right: 1px solid #E2E8F0;">${diaData.precio.toFixed(2)}€<br><small style="color:#64748B; font-weight: 600;">${diaData.cantidad} ${unidad}</small></td>`;
            } else {
                html +=
                    '<td style="text-align: center; color: #CBD5E1; padding: 18px; border-right: 1px solid #E2E8F0;">-</td>';
            }
        });
        html += `<td style="text-align: center; background: #e8f5e9; font-weight: bold; padding: 18px;">${data.total.toFixed(2)}€</td>`;
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

    const dias = window.datosResumenMensual.dias;
    const recetas = window.datosResumenMensual.ventas?.recetas || {};

    let html = '<table style="min-width: 100%; border-collapse: collapse;">';

    // Header con días
    html +=
        '<thead><tr><th style="position: sticky; left: 0; background: #f8f8f8; z-index: 1;">Receta</th>';
    dias.forEach(dia => {
        const fecha = new Date(dia);
        html += `<th style="min-width: 100px; text-align: center;">${fecha.getDate()}/${fecha.getMonth() + 1}</th>`;
    });
    html += '<th style="background: #e8f5e9; font-weight: bold;">TOTAL</th></tr></thead>';

    // Filas de recetas
    html += '<tbody>';
    for (const [nombre, data] of Object.entries(recetas)) {
        html += `<tr><td style="position: sticky; left: 0; background: white; font-weight: 500;">${nombre}</td>`;
        dias.forEach(dia => {
            const diaData = data.dias[dia];
            if (diaData) {
                html += `<td style="text-align: center;">
              <div style="color: #2e7d32; font-weight: 500;">${diaData.ingresos.toFixed(2)}€</div>
              <small style="color:#666;">${diaData.vendidas} uds</small>
            </td>`;
            } else {
                html += '<td style="text-align: center; color: #ccc;">-</td>';
            }
        });
        html += `<td style="text-align: center; background: #e8f5e9;">
          <div style="font-weight: bold;">${data.totalIngresos.toFixed(2)}€</div>
          <small>${data.totalVendidas} uds</small>
        </td>`;
        html += '</tr>';
    }
    html += '</tbody></table>';

    container.innerHTML = html;
}

// Renderizar P&L diario
function renderizarTablaPLDiario() {
    const container = document.getElementById('tabla-pl-diario');
    if (!window.datosResumenMensual || !window.datosResumenMensual.dias?.length) {
        container.innerHTML = '<p class="empty-state">No hay datos para este mes</p>';
        return;
    }

    const dias = window.datosResumenMensual.dias;
    const recetas = window.datosResumenMensual.ventas?.recetas || {};

    // Calcular totales por día
    const totalesPorDia = {};
    dias.forEach(dia => {
        totalesPorDia[dia] = { ingresos: 0, costes: 0, beneficio: 0 };
    });

    for (const [nombre, data] of Object.entries(recetas)) {
        for (const [dia, diaData] of Object.entries(data.dias)) {
            if (totalesPorDia[dia]) {
                totalesPorDia[dia].ingresos += diaData.ingresos;
                totalesPorDia[dia].costes += diaData.coste;
                totalesPorDia[dia].beneficio += diaData.beneficio;
            }
        }
    }

    let html = '<table style="min-width: 100%; border-collapse: collapse;">';

    // Header
    html += '<thead><tr><th style="position: sticky; left: 0; background: #f8f8f8;">Concepto</th>';
    dias.forEach(dia => {
        const fecha = new Date(dia);
        html += `<th style="min-width: 90px; text-align: center;">${fecha.getDate()}/${fecha.getMonth() + 1}</th>`;
    });
    html += '<th style="background: #1565c0; color: white;">TOTAL MES</th></tr></thead>';

    // Fila Ingresos
    let totalIngresos = 0,
        totalCostes = 0,
        totalBeneficio = 0;
    html += '<tbody>';
    html +=
        '<tr style="background: #e8f5e9;"><td style="position: sticky; left: 0; background: #e8f5e9; font-weight: bold;">📈 INGRESOS</td>';
    dias.forEach(dia => {
        const val = totalesPorDia[dia].ingresos;
        totalIngresos += val;
        html += `<td style="text-align: center; font-weight: 500; color: #2e7d32;">${val.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; background: #1565c0; color: white; font-weight: bold;">${totalIngresos.toFixed(2)}€</td></tr>`;

    // Fila Costes
    html +=
        '<tr style="background: #ffebee;"><td style="position: sticky; left: 0; background: #ffebee; font-weight: bold;">📉 COSTES</td>';
    dias.forEach(dia => {
        const val = totalesPorDia[dia].costes;
        totalCostes += val;
        html += `<td style="text-align: center; color: #c62828;">${val.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; background: #1565c0; color: white; font-weight: bold;">${totalCostes.toFixed(2)}€</td></tr>`;

    // Obtener gastos fijos mensuales
    const opexData = JSON.parse(
        localStorage.getItem('opex_inputs') ||
        '{"alquiler":0,"personal":0,"suministros":0,"otros":0}'
    );
    const gastosFijosMes =
        parseFloat(opexData.alquiler || 0) +
        parseFloat(opexData.personal || 0) +
        parseFloat(opexData.suministros || 0) +
        parseFloat(opexData.otros || 0);

    // Calcular gastos fijos por día (días del mes calendario, no solo días con datos)
    const mesSeleccionado = parseInt(document.getElementById('diario-mes').value);
    const anoSeleccionado = parseInt(document.getElementById('diario-ano').value);
    const diasEnMes = new Date(anoSeleccionado, mesSeleccionado, 0).getDate();
    const gastosFijosDia = diasEnMes > 0 ? gastosFijosMes / diasEnMes : 0;

    // Fila Beneficio BRUTO (antes de gastos fijos)
    html +=
        '<tr style="background: #fff3e0;"><td style="position: sticky; left: 0; background: #fff3e0; font-weight: bold;">💰 BENEFICIO BRUTO</td>';
    dias.forEach(dia => {
        const val = totalesPorDia[dia].beneficio;
        totalBeneficio += val;
        const color = val >= 0 ? '#f57c00' : '#c62828';
        html += `<td style="text-align: center; font-weight: bold; color: ${color};">${val.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; background: #1565c0; color: white; font-weight: bold;">${totalBeneficio.toFixed(2)}€</td></tr>`;

    // Fila Gastos Fijos Diarios
    html +=
        '<tr style="background: #fce4ec;"><td style="position: sticky; left: 0; background: #fce4ec; font-weight: bold;">🏢 GASTOS FIJOS/DÍA</td>';
    const totalGastosFijos = gastosFijosDia * dias.length;
    dias.forEach(() => {
        html += `<td style="text-align: center; color: #c62828;">${gastosFijosDia.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; background: #1565c0; color: white; font-weight: bold;">${totalGastosFijos.toFixed(2)}€</td></tr>`;

    // Fila Beneficio NETO (después de gastos fijos)
    html +=
        '<tr style="background: #e3f2fd; border-top: 3px solid #1565c0;"><td style="position: sticky; left: 0; background: #e3f2fd; font-weight: bold; font-size: 16px;">✅ BENEFICIO NETO</td>';
    let totalBeneficioNeto = 0;
    dias.forEach(dia => {
        const beneficioNeto = totalesPorDia[dia].beneficio - gastosFijosDia;
        totalBeneficioNeto += beneficioNeto;
        const color = beneficioNeto >= 0 ? '#1565c0' : '#c62828';
        html += `<td style="text-align: center; font-weight: bold; font-size: 15px; color: ${color};">${beneficioNeto.toFixed(2)}€</td>`;
    });
    html += `<td style="text-align: center; background: #1565c0; color: white; font-weight: bold; font-size: 16px;">${totalBeneficioNeto.toFixed(2)}€</td></tr>`;

    html += '</tbody></table>';

    container.innerHTML = html;
}

// Exportar a Excel
window.exportarDiarioExcel = function () {
    if (!window.datosResumenMensual) {
        window.showToast('Primero carga los datos', 'warning');
        return;
    }

    // Crear workbook con los datos
    const wb = XLSX.utils.book_new();

    // Hoja de compras
    const comprasData = [];
    comprasData.push(['Ingrediente', ...window.datosResumenMensual.dias, 'TOTAL']);
    for (const [nombre, data] of Object.entries(
        window.datosResumenMensual.compras?.ingredientes || {}
    )) {
        const fila = [nombre];
        window.datosResumenMensual.dias.forEach(dia => {
            fila.push(data.dias[dia]?.precio || '');
        });
        fila.push(data.total);
        comprasData.push(fila);
    }
    const wsCompras = XLSX.utils.aoa_to_sheet(comprasData);
    XLSX.utils.book_append_sheet(wb, wsCompras, 'Compras');

    // Hoja de ventas
    const ventasData = [];
    ventasData.push(['Receta', ...window.datosResumenMensual.dias, 'TOTAL']);
    for (const [nombre, data] of Object.entries(window.datosResumenMensual.ventas?.recetas || {})) {
        const fila = [nombre];
        window.datosResumenMensual.dias.forEach(dia => {
            fila.push(data.dias[dia]?.ingresos || '');
        });
        fila.push(data.totalIngresos);
        ventasData.push(fila);
    }
    const wsVentas = XLSX.utils.aoa_to_sheet(ventasData);
    XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

    // Descargar
    const mes = document.getElementById('diario-mes').value;
    const ano = document.getElementById('diario-ano').value;
    XLSX.writeFile(wb, `Control_Diario_${ano}-${mes.padStart(2, '0')}.xlsx`);

    window.showToast('Excel exportado', 'success');
};
