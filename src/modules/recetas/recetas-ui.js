/**
 * Recetas UI Module
 * Funciones de interfaz de usuario para recetas
 */

/**
 * Muestra el formulario de nueva receta
 */
export function mostrarFormularioReceta() {
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];
    if (ingredientes.length === 0) {
        window.showToast('Primero añade ingredientes', 'warning');
        window.cambiarTab('ingredientes');
        if (typeof window.mostrarFormularioIngrediente === 'function') {
            window.mostrarFormularioIngrediente();
        }
        return;
    }
    document.getElementById('formulario-receta').style.display = 'block';
    window.agregarIngredienteReceta();
    document.getElementById('rec-nombre').focus();
}

/**
 * Cierra el formulario de receta y resetea campos
 */
export function cerrarFormularioReceta() {
    document.getElementById('formulario-receta').style.display = 'none';
    document.querySelector('#formulario-receta form').reset();
    document.getElementById('lista-ingredientes-receta').innerHTML = '';
    document.getElementById('coste-calculado-form').style.display = 'none';
    window.editandoRecetaId = null;

    // Limpiar campos del formulario
    document.getElementById('rec-nombre').value = '';
    document.getElementById('rec-codigo').value = '';
    document.getElementById('rec-categoria').value = 'entrante';
    document.getElementById('rec-precio_venta').value = '';
    document.getElementById('rec-porciones').value = '1';
    document.getElementById('lista-ingredientes-receta').innerHTML = '';
    document.getElementById('form-title-receta').textContent = 'Nueva Receta';
    document.getElementById('btn-text-receta').textContent = 'Guardar';
}

/**
 * Agrega una fila de ingrediente en el formulario de receta
 */
export function agregarIngredienteReceta() {
    const lista = document.getElementById('lista-ingredientes-receta');
    const item = document.createElement('div');
    item.className = 'ingrediente-item';
    item.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px;';

    // Ordenar ingredientes alfabéticamente
    const ingredientesOrdenados = [...(window.ingredientes || [])].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );

    let optionsHtml = '<option value="">Selecciona ingrediente...</option>';
    ingredientesOrdenados.forEach(ing => {
        const precio = parseFloat(ing.precio || 0).toFixed(2);
        const unidad = ing.unidad || 'ud';
        optionsHtml += `<option value="${ing.id}">${ing.nombre} (${precio}€/${unidad})</option>`;
    });

    item.innerHTML = `
    <select style="flex: 2; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.calcularCosteReceta()">
      ${optionsHtml}
    </select>
    <input type="number" step="0.01" min="0" placeholder="Cantidad" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px;" onchange="window.calcularCosteReceta()">
    <button type="button" onclick="this.parentElement.remove(); window.calcularCosteReceta();" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">✕</button>
  `;

    lista.appendChild(item);
}

/**
 * Calcula el coste total de la receta desde ingredientes seleccionados
 */
export function calcularCosteReceta() {
    const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
    let costeTotal = 0;
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];

    items.forEach(item => {
        const select = item.querySelector('select');
        const input = item.querySelector('input');
        if (select.value && input.value) {
            const ing = ingredientes.find(i => i.id === parseInt(select.value));
            if (ing) {
                costeTotal += parseFloat(ing.precio || 0) * parseFloat(input.value || 0);
            }
        }
    });

    const costeDiv = document.getElementById('coste-calculado-form');
    if (costeDiv) {
        costeDiv.style.display = costeTotal > 0 ? 'block' : 'none';
        const costeSpan = document.getElementById('coste-receta-valor');
        if (costeSpan) costeSpan.textContent = costeTotal.toFixed(2) + '€';

        const precioVenta = parseFloat(document.getElementById('rec-precio_venta')?.value || 0);
        const margenSpan = document.getElementById('margen-receta-valor');
        if (margenSpan && precioVenta > 0) {
            const margen = ((precioVenta - costeTotal) / precioVenta * 100);
            margenSpan.textContent = margen.toFixed(1) + '%';
            margenSpan.style.color = margen >= 60 ? '#10b981' : margen >= 40 ? '#f59e0b' : '#ef4444';
        }
    }

    return costeTotal;
}

/**
 * Renderiza la tabla de recetas
 */
export function renderizarRecetas() {
    const busquedaEl = document.getElementById('busqueda-recetas');
    const busqueda = busquedaEl?.value?.toLowerCase() || '';
    const recetas = Array.isArray(window.recetas) ? window.recetas : [];

    const filtradas = recetas.filter(r =>
        r.nombre.toLowerCase().includes(busqueda) ||
        (r.codigo && r.codigo.toString().includes(busqueda))
    );

    const container = document.getElementById('tabla-recetas');
    if (!container) return;

    if (filtradas.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">👨‍🍳</div>
        <h3>${busqueda ? 'No encontradas' : 'Aún no hay recetas'}</h3>
      </div>
    `;
        document.getElementById('resumen-recetas').style.display = 'none';
    } else {
        let html = '<table><thead><tr>';
        html += '<th>Cód.</th><th>Plato</th><th>Categoría</th><th>Coste</th><th>Precio</th><th>Margen</th><th>Acciones</th>';
        html += '</tr></thead><tbody>';

        filtradas.forEach(rec => {
            const coste = window.calcularCosteRecetaCompleto(rec);
            const margen = rec.precio_venta - coste;
            const pct = rec.precio_venta > 0 ? ((margen / rec.precio_venta) * 100).toFixed(0) : 0;

            html += '<tr>';
            html += `<td><span style="color:#666;font-size:12px;">${rec.codigo || '-'}</span></td>`;
            html += `<td><strong>${rec.nombre}</strong></td>`;
            html += `<td><span class="badge badge-success">${rec.categoria}</span></td>`;
            html += `<td>${coste.toFixed(2)} €</td>`;
            html += `<td>${rec.precio_venta ? parseFloat(rec.precio_venta).toFixed(2) : '0.00'} €</td>`;
            html += `<td><span class="badge ${margen > 0 ? 'badge-success' : 'badge-warning'}">${margen.toFixed(2)} € (${pct}%)</span></td>`;
            html += `<td><div class="actions">`;
            html += `<button class="icon-btn produce" onclick="window.abrirModalProducir(${rec.id})">⬇️</button>`;
            html += `<button class="icon-btn edit" onclick="window.editarReceta(${rec.id})">✏️</button>`;
            html += `<button class="icon-btn delete" onclick="window.eliminarReceta(${rec.id})">🗑️</button>`;
            html += '</div></td>';

            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        const resumenEl = document.getElementById('resumen-recetas');
        if (resumenEl) {
            resumenEl.innerHTML = `
              <div>Total: <strong>${recetas.length}</strong></div>
              <div>Mostrando: <strong>${filtradas.length}</strong></div>
            `;
            resumenEl.style.display = 'flex';
        }
    }
}

/**
 * Exporta recetas a Excel
 */
export function exportarRecetas() {
    const recetas = Array.isArray(window.recetas) ? window.recetas : [];
    const ingredientes = Array.isArray(window.ingredientes) ? window.ingredientes : [];

    const columnas = [
        { header: 'ID', key: 'id' },
        { header: 'Código', value: (rec) => rec.codigo || `REC-${String(rec.id).padStart(4, '0')}` },
        { header: 'Nombre', key: 'nombre' },
        { header: 'Categoría', key: 'categoria' },
        { header: 'Precio Venta (€)', value: (rec) => parseFloat(rec.precio_venta || 0).toFixed(2) },
        {
            header: 'Coste (€)', value: (rec) => {
                return (rec.ingredientes || []).reduce((sum, item) => {
                    const ing = ingredientes.find(i => i.id === item.ingredienteId);
                    return sum + (ing ? parseFloat(ing.precio) * parseFloat(item.cantidad) : 0);
                }, 0).toFixed(2);
            }
        },
        {
            header: 'Margen (€)', value: (rec) => {
                const coste = (rec.ingredientes || []).reduce((sum, item) => {
                    const ing = ingredientes.find(i => i.id === item.ingredienteId);
                    return sum + (ing ? parseFloat(ing.precio) * parseFloat(item.cantidad) : 0);
                }, 0);
                return (parseFloat(rec.precio_venta || 0) - coste).toFixed(2);
            }
        },
        {
            header: 'Margen (%)', value: (rec) => {
                const coste = (rec.ingredientes || []).reduce((sum, item) => {
                    const ing = ingredientes.find(i => i.id === item.ingredienteId);
                    return sum + (ing ? parseFloat(ing.precio) * parseFloat(item.cantidad) : 0);
                }, 0);
                const margen = rec.precio_venta > 0 ? ((parseFloat(rec.precio_venta) - coste) / parseFloat(rec.precio_venta) * 100) : 0;
                return margen.toFixed(1) + '%';
            }
        },
        { header: 'Porciones', key: 'porciones' },
        { header: 'Nº Ingredientes', value: (rec) => (rec.ingredientes || []).length }
    ];

    if (typeof window.exportarAExcel === 'function' && typeof window.getRestaurantNameForFile === 'function') {
        window.exportarAExcel(recetas, `Recetas_${window.getRestaurantNameForFile()}`, columnas);
    }
}
