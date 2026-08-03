/**
 * @jest-environment jsdom
 *
 * Ejecuta el flujo REAL de `confirmarCarrito()` con el carrito exacto de la
 * captura de Iker (2026-08-03): ATLANTICA CASTRELO BRANCO, VIDE VIDE, CAJA de
 * 10 l, 23,10 €. Síntoma: "desde el móvil no termina de hacer el pedido".
 *
 * Ya está descartado con datos que sea el backend (POST /api/orders → 201 con
 * este mismo payload) y que sea caché (el SW es network-first y no intercepta
 * POST). Esto comprueba la otra mitad: que el módulo del carrito llegue a
 * llamar a la API y con qué manda.
 */
import { jest } from '@jest/globals';

describe('confirmarCarrito: flujo completo', () => {
    let createPedido;
    let toasts;

    beforeEach(async () => {
        jest.resetModules();
        localStorage.clear();
        toasts = [];
        createPedido = jest.fn(async () => ({ id: 99 }));

        // Sesión: sin esto tenantKey escribe/lee con sufijo `anon`.
        window.currentUser = { restauranteId: 2 };
        localStorage.setItem('user', JSON.stringify({ restauranteId: 2 }));

        window.api = { createPedido, getPedidos: jest.fn(async () => []) };
        window.showLoading = jest.fn();
        window.hideLoading = jest.fn();
        window.showToast = jest.fn((m, tipo) => toasts.push({ m, tipo }));
        window.renderizarPedidos = jest.fn();
        window.cerrarCarrito = jest.fn();
        window.cambiarTab = jest.fn();
        window.confirm = jest.fn(() => true);

        // `toast-container` es OBLIGATORIO: `showToast` (helpers.js) hace return
        // en silencio si no lo encuentra. Importar helpers reasigna
        // `window.showToast`, así que el mock de arriba no lo tapa.
        document.body.innerHTML = `
            <div class="toast-container" id="toast-container"></div>
            <span id="carrito-badge"></span>
            <div id="carrito-contenido"></div>
            <span id="carrito-total"></span>
            <input id="ped-fecha" value="2026-08-03">
        `;

        // El carrito tal y como lo deja la UI: cantidad en UNIDAD BASE (10 l) y
        // precio del FORMATO (23,10 € la caja de 10).
        localStorage.setItem('pedidoCarrito_2', JSON.stringify({
            items: [{
                ingredienteId: 41,
                nombre: 'ATLANTICA CASTRELO BRANCO',
                cantidad: 10,
                precio: 23.10,
                precioYaEsUnitario: false,
                cantidadPorFormato: 10,
                proveedorId: 8,
                unidad: 'l',
            }],
            proveedorId: 8,
            fecha: '2026-08-03',
            ivaPct: 21,
        }));

        await import('../../modules/pedidos/pedidos-cart.js');
        window.initCarrito();
    });

    test('llega a llamar a la API', async () => {
        await window.confirmarCarrito();
        const errores = toasts.filter(x => x.tipo === 'error');
        expect(errores).toEqual([]);          // si peta, aquí se ve el motivo
        expect(createPedido).toHaveBeenCalledTimes(1);
    });

    test('manda el precio en las unidades correctas', async () => {
        await window.confirmarCarrito();
        const [pedido] = createPedido.mock.calls[0];

        expect(pedido.proveedorId).toBe(8);
        expect(pedido.total).toBeCloseTo(23.10, 2);   // (10/10) × 23,10
        expect(pedido.iva_pct).toBe(21);

        const linea = pedido.ingredientes[0];
        expect(linea.ingredienteId).toBe(41);
        expect(linea.cantidad).toBe(10);              // unidad base
        expect(linea.precioUnitario).toBeCloseTo(2.31, 4);  // €/l
        expect(linea.precio).toBeCloseTo(23.10, 2);         // €/caja
    });

    test('si cancelas el confirm no se manda nada', async () => {
        window.confirm = jest.fn(() => false);
        await window.confirmarCarrito();
        expect(createPedido).not.toHaveBeenCalled();
    });

    // El guard anti-doble-click no puede quedarse pegado tras cancelar, o el
    // botón muere hasta recargar (síntoma: "le doy y no hace nada").
    test('tras cancelar, el botón sigue vivo', async () => {
        window.confirm = jest.fn(() => false);
        await window.confirmarCarrito();
        window.confirm = jest.fn(() => true);
        await window.confirmarCarrito();
        expect(createPedido).toHaveBeenCalledTimes(1);
    });

    // Y tampoco tras un fallo de red.
    test('tras un error de red, el botón sigue vivo', async () => {
        window.api.createPedido = jest.fn(async () => { throw new Error('boom'); });
        await window.confirmarCarrito();

        window.api.createPedido = createPedido;
        await window.confirmarCarrito();
        expect(createPedido).toHaveBeenCalledTimes(1);
    });

    // Al fallar, el error TIENE que llegar al DOM. `showToast` de helpers hace
    // return en silencio si no encuentra el contenedor, así que un fallo se
    // quedaba en un `console.warn` que nadie lee desde un móvil.
    test('un fallo pinta el aviso de error en el DOM', async () => {
        window.api.createPedido = jest.fn(async () => { throw new Error('boom'); });
        await window.confirmarCarrito();

        const container = document.getElementById('toast-container');
        expect(container.querySelector('.toast.error')).not.toBeNull();
    });

    // ⚠️ EL FALLO REAL DE IKER (2026-08-03): "Error creando pedidos: La fecha no
    // puede ser futura". El backend rechaza futuras (allowFuture:false) y el
    // carrito guardaba la fecha en localStorage SIN ENSEÑARLA — carrito
    // bloqueado y sin forma de ver ni cambiar la fecha culpable.
    describe('fecha futura pegada en el carrito', () => {
        const enDias = (n) => {
            const d = new Date();
            d.setDate(d.getDate() + n);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        async function conFecha(fecha) {
            const raw = JSON.parse(localStorage.getItem('pedidoCarrito_2'));
            raw.fecha = fecha;
            localStorage.setItem('pedidoCarrito_2', JSON.stringify(raw));
            window.initCarrito();
            await window.confirmarCarrito();
            return createPedido.mock.calls[0]?.[0];
        }

        test('no bloquea: manda hoy en vez de la fecha futura', async () => {
            const pedido = await conFecha(enDias(30));
            expect(pedido).toBeDefined();
            expect(pedido.fecha).toBe(enDias(0));
        });

        test('avisa de la corrección en vez de cambiarla a escondidas', async () => {
            await conFecha(enDias(30));
            const container = document.getElementById('toast-container');
            expect(container.querySelector('.toast.warning')).not.toBeNull();
        });

        // Las retroactivas son un flujo válido (meter una compra olvidada) y el
        // backend las acepta: no tocarlas.
        test('una fecha PASADA se respeta', async () => {
            const pedido = await conFecha('2026-07-15');
            expect(pedido.fecha).toBe('2026-07-15');
        });

        test('hoy se respeta', async () => {
            const pedido = await conFecha(enDias(0));
            expect(pedido.fecha).toBe(enDias(0));
        });

        // Un carrito viejo con basura no puede tumbar el pedido.
        test('una fecha con formato inválido cae a hoy', async () => {
            const pedido = await conFecha('no-es-una-fecha');
            expect(pedido.fecha).toBe(enDias(0));
        });
    });

    // El carrito NO se vacía si falló: lo que el usuario metió sigue ahí.
    test('si falla, el carrito no se pierde', async () => {
        window.api.createPedido = jest.fn(async () => { throw new Error('boom'); });
        await window.confirmarCarrito();

        const guardado = JSON.parse(localStorage.getItem('pedidoCarrito_2'));
        expect(guardado.items).toHaveLength(1);
    });
});
