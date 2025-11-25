// API Configuration
const API_URL = 'https://lacaleta-api.mindloop.cloud/api';

// API Helper Functions
const api = {
  // Ingredientes
  async getIngredientes() {
    const res = await fetch(`${API_URL}/ingredients`);
    if (!res.ok) throw new Error('Error cargando ingredientes');
    const data = await res.json();
    return data.map(ing => ({
      ...ing,
      proveedorId: ing.proveedor_id,
      stockActual: parseFloat(ing.stock_actual),
      stockMinimo: parseFloat(ing.stock_minimo),
      precio: parseFloat(ing.precio)
    }));
  },

  async createIngrediente(ingrediente) {
    const res = await fetch(`${API_URL}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingrediente)
    });
    if (!res.ok) throw new Error('Error creando ingrediente');
    const data = await res.json();
    return {
      ...data,
      proveedorId: data.proveedor_id,
      stockActual: parseFloat(data.stock_actual),
      stockMinimo: parseFloat(data.stock_minimo),
      precio: parseFloat(data.precio)
    };
  },

  async updateIngrediente(id, ingrediente) {
    const res = await fetch(`${API_URL}/ingredients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingrediente)
    });
    if (!res.ok) throw new Error('Error actualizando ingrediente');
    const data = await res.json();
    return {
      ...data,
      proveedorId: data.proveedor_id,
      stockActual: parseFloat(data.stock_actual),
      stockMinimo: parseFloat(data.stock_minimo),
      precio: parseFloat(data.precio)
    };
  },

  async deleteIngrediente(id) {
    const res = await fetch(`${API_URL}/ingredients/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error eliminando ingrediente');
    return await res.json();
  },

  // Recetas
  async getRecetas() {
    const res = await fetch(`${API_URL}/recipes`);
    if (!res.ok) throw new Error('Error cargando recetas');
    const data = await res.json();
    return data.map(rec => ({
      ...rec,
      precioVenta: parseFloat(rec.precio_venta),
      ingredientes: rec.ingredientes
    }));
  },

  async createReceta(receta) {
    const res = await fetch(`${API_URL}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receta)
    });
    if (!res.ok) throw new Error('Error creando receta');
    const data = await res.json();
    return {
      ...data,
      precioVenta: parseFloat(data.precio_venta),
      ingredientes: data.ingredientes
    };
  },

  async updateReceta(id, receta) {
    const res = await fetch(`${API_URL}/recipes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receta)
    });
    if (!res.ok) throw new Error('Error actualizando receta');
    const data = await res.json();
    return {
      ...data,
      precioVenta: parseFloat(data.precio_venta),
      ingredientes: data.ingredientes
    };
  },

  async deleteReceta(id) {
    const res = await fetch(`${API_URL}/recipes/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error eliminando receta');
    return await res.json();
  },

  // Proveedores
  async getProveedores() {
    const res = await fetch(`${API_URL}/suppliers`);
    if (!res.ok) throw new Error('Error cargando proveedores');
    return await res.json();
  },

  async createProveedor(proveedor) {
    const res = await fetch(`${API_URL}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proveedor)
    });
    if (!res.ok) throw new Error('Error creando proveedor');
    return await res.json();
  },

  async updateProveedor(id, proveedor) {
    const res = await fetch(`${API_URL}/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proveedor)
    });
    if (!res.ok) throw new Error('Error actualizando proveedor');
    return await res.json();
  },

  async deleteProveedor(id) {
    const res = await fetch(`${API_URL}/suppliers/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error eliminando proveedor');
    return await res.json();
  },

  // Pedidos
  async getPedidos() {
    const res = await fetch(`${API_URL}/orders`);
    if (!res.ok) throw new Error('Error cargando pedidos');
    const data = await res.json();
    return data.map(ped => ({
      ...ped,
      proveedorId: ped.proveedor_id,
      total: parseFloat(ped.total),
      totalRecibido: ped.total_recibido ? parseFloat(ped.total_recibido) : null,
      fechaCreacion: ped.fecha_creacion,
      fechaRecepcion: ped.fecha_recepcion
    }));
  },

  async createPedido(pedido) {
    const res = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido)
    });
    if (!res.ok) throw new Error('Error creando pedido');
    const data = await res.json();
    return {
      ...data,
      proveedorId: data.proveedor_id,
      total: parseFloat(data.total)
    };
  },

  async updatePedido(id, pedido) {
    const res = await fetch(`${API_URL}/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pedido)
    });
    if (!res.ok) throw new Error('Error actualizando pedido');
    const data = await res.json();
    return {
      ...data,
      proveedorId: data.proveedor_id,
      total: parseFloat(data.total),
      totalRecibido: data.total_recibido ? parseFloat(data.total_recibido) : null
    };
  },

  async deletePedido(id) {
    const res = await fetch(`${API_URL}/orders/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error eliminando pedido');
    return await res.json();
  }
};
