/**
 * @jest-environment jsdom
 *
 * "Volver a pedir" solo ofrece pedidos YA RECIBIDOS.
 *
 * Bug que previene (2026-07-30): la portada móvil recorría TODOS los pedidos sin
 * mirar el estado, así que uno `pendiente` salía como "último pedido" con su
 * botón Repetir. Se veía en pantalla "PILAR LOPEZ FREIRE · Último: 30/7/2026 ·
 * 157,50€ · Repetir" mientras ese pedido seguía en Pendiente.
 *
 * Regla (Iker): no se repite un pedido hasta que está realizado. Y si el
 * proveedor tiene uno en camino, tampoco se ofrece: acabarías con dos pedidos
 * pendientes del mismo proveedor.
 */
import { renderMobileHome } from '../../modules/mobile/mobile-home.js';

const PROVS = [
    { id: 1, nombre: 'PILAR LOPEZ FREIRE' },
    { id: 2, nombre: 'OROSA AVES Y HUEVOS' },
];

function pintar(pedidos) {
    document.body.innerHTML = '<div id="ml-home-falta"></div><div id="ml-home-repetir"></div>';
    window.ingredientes = [];
    window.proveedores = PROVS;
    window.pedidos = pedidos;
    renderMobileHome();
    return document.getElementById('ml-home-repetir').innerHTML;
}

describe('Volver a pedir — solo pedidos recibidos', () => {
    afterEach(() => {
        delete window.pedidos; delete window.proveedores; delete window.ingredientes;
    });

    test('un pedido PENDIENTE no se ofrece para repetir', () => {
        const html = pintar([
            { id: 5, proveedor_id: 1, estado: 'pendiente', fecha: '2026-07-30', total: 157.5 },
        ]);
        expect(html).toBe('');
        expect(html).not.toContain('Repetir');
    });

    test('un pedido RECIBIDO sí se ofrece', () => {
        const html = pintar([
            { id: 5, proveedor_id: 1, estado: 'recibido', fecha: '2026-07-30', total: 157.5 },
        ]);
        expect(html).toContain('Repetir');
        expect(html).toContain('PILAR LOPEZ FREIRE');
    });

    test('si el proveedor tiene uno en camino, no se ofrece repetir el anterior', () => {
        // El viejo está recibido, pero ya hay otro pendiente del mismo proveedor:
        // repetir crearía un segundo pedido pendiente al mismo sitio.
        const html = pintar([
            { id: 4, proveedor_id: 1, estado: 'recibido', fecha: '2026-07-20', total: 100 },
            { id: 5, proveedor_id: 1, estado: 'pendiente', fecha: '2026-07-30', total: 157.5 },
        ]);
        expect(html).toBe('');
    });

    test('un proveedor con pendiente no tapa a otro que sí puede repetir', () => {
        const html = pintar([
            { id: 5, proveedor_id: 1, estado: 'pendiente', fecha: '2026-07-30', total: 157.5 },
            { id: 6, proveedor_id: 2, estado: 'recibido', fecha: '2026-07-29', total: 9.83 },
        ]);
        expect(html).toContain('OROSA AVES Y HUEVOS');
        expect(html).not.toContain('PILAR LOPEZ FREIRE');
    });

    test('de varios recibidos del mismo proveedor, se ofrece el más reciente', () => {
        const html = pintar([
            { id: 4, proveedor_id: 2, estado: 'recibido', fecha: '2026-07-10', total: 50 },
            { id: 7, proveedor_id: 2, estado: 'recibido', fecha: '2026-07-25', total: 80 },
        ]);
        expect(html).toContain('window.mlVolverAPedir(7)');
        expect(html).not.toContain('window.mlVolverAPedir(4)');
    });
});
