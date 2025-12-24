/**
 * Proveedores CRUD Module
 * Funciones de crear, editar y eliminar proveedores
 */

/**
 * Guarda un proveedor (nuevo o editado)
 */
export async function guardarProveedor(event) {
    event.preventDefault();

    const checks = document.querySelectorAll('#lista-ingredientes-proveedor input[type="checkbox"]:checked');
    const ingredientesIds = Array.from(checks).map(cb => parseInt(cb.value));

    const proveedor = {
        nombre: document.getElementById('prov-nombre').value,
        contacto: document.getElementById('prov-contacto').value || '',
        telefono: document.getElementById('prov-telefono').value || '',
        email: document.getElementById('prov-email').value || '',
        direccion: document.getElementById('prov-direccion').value || '',
        notas: document.getElementById('prov-notas').value || '',
        ingredientes: ingredientesIds
    };

    window.showLoading();

    try {
        if (window.editandoProveedorId !== null) {
            await window.api.updateProveedor(window.editandoProveedorId, proveedor);
        } else {
            await window.api.createProveedor(proveedor);
        }

        await window.cargarDatos();
        window.renderizarProveedores();
        window.hideLoading();
        window.showToast(window.editandoProveedorId ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
        window.cerrarFormularioProveedor();
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error guardando proveedor: ' + error.message, 'error');
    }
}

/**
 * Edita un proveedor existente
 */
export function editarProveedor(id) {
    const prov = window.proveedores.find(p => p.id === id);
    if (!prov) return;

    // Rellenar todos los campos del formulario con los datos existentes
    document.getElementById('prov-nombre').value = prov.nombre || '';
    document.getElementById('prov-contacto').value = prov.contacto || '';
    document.getElementById('prov-telefono').value = prov.telefono || '';
    document.getElementById('prov-email').value = prov.email || '';
    document.getElementById('prov-direccion').value = prov.direccion || '';
    document.getElementById('prov-notas').value = prov.notas || '';

    window.cargarIngredientesProveedor(prov.ingredientes || []);

    window.editandoProveedorId = id;
    document.getElementById('form-title-proveedor').textContent = 'Editar Proveedor';
    document.getElementById('btn-text-proveedor').textContent = 'Guardar';
    window.mostrarFormularioProveedor();
}

/**
 * Elimina un proveedor
 */
export async function eliminarProveedor(id) {
    const prov = window.proveedores.find(p => p.id === id);
    if (!prov) return;

    if (!confirm(`¿Eliminar proveedor "${prov.nombre}"?`)) return;

    window.showLoading();

    try {
        await window.api.deleteProveedor(id);
        await window.cargarDatos();
        window.renderizarProveedores();
        window.hideLoading();
        window.showToast('Proveedor eliminado', 'success');
    } catch (error) {
        window.hideLoading();
        console.error('Error:', error);
        window.showToast('Error eliminando proveedor: ' + error.message, 'error');
    }
}
