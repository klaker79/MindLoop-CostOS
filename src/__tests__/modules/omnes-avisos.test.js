/**
 * Lógica determinista de los avisos de Omnes (sin IA → sin errores).
 */
import { calcularSubidasPrecio, calcularStockCritico, UMBRALES, construirAvisos } from '@modules/inteligencia/omnes-avisos.js';

// Señales del backend: por defecto ninguna, cada test activa la que necesita.
const mkFetch = (porEndpoint = {}) => (endpoint) =>
    Promise.resolve(Object.prototype.hasOwnProperty.call(porEndpoint, endpoint) ? porEndpoint[endpoint] : null);

const ENTRADA_PAN = {
    id: 345, nombre: 'PAN', unidad: 'unidad',
    uds_sin_descontar: 2517.64, importe_eur: 5538.81, n_ventas: 150,
    primera: '2026-05-11', ultima: '2026-08-06'
};

describe('calcularSubidasPrecio', () => {
    const ingMap = new Map([
        [1, { id: 1, nombre: 'Aguacate', unidad: 'kg' }],
        [2, { id: 2, nombre: 'Tomate', unidad: 'kg' }],
    ]);
    // pedidos recibidos, más reciente primero por fecha
    const pedidos = [
        { estado: 'recibido', fecha: '2026-06-10', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.9 }, { ingredienteId: 2, precio_unitario: 2 }] },
        { estado: 'recibido', fecha: '2026-06-03', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.0 }, { ingredienteId: 2, precio_unitario: 2 }] },
    ];

    test('detecta subida >= umbral (aguacate +18%)', () => {
        const r = calcularSubidasPrecio(pedidos, ingMap);
        expect(r).toHaveLength(1);
        expect(r[0].nombre).toBe('Aguacate');
        expect(r[0].pct).toBeCloseTo(18, 0);
    });
    test('ignora sin cambio (tomate igual) y bajadas', () => {
        const r = calcularSubidasPrecio(pedidos, ingMap);
        expect(r.find(x => x.nombre === 'Tomate')).toBeUndefined();
    });
    test('subida por debajo del umbral no se incluye', () => {
        const peq = [
            { estado: 'recibido', fecha: '2026-06-10', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.1 }] },
            { estado: 'recibido', fecha: '2026-06-03', ingredientes: [{ ingredienteId: 1, precio_unitario: 5.0 }] },
        ];
        expect(calcularSubidasPrecio(peq, ingMap, UMBRALES.subidaPrecioPct)).toHaveLength(0); // +2% < 8%
    });
    test('salta líneas de comida personal', () => {
        const conPersonal = [
            { estado: 'recibido', fecha: '2026-06-10', ingredientes: [{ ingredienteId: 1, precio_unitario: 50, personal: true }] },
            { estado: 'recibido', fecha: '2026-06-03', ingredientes: [{ ingredienteId: 1, precio_unitario: 5 }] },
        ];
        expect(calcularSubidasPrecio(conPersonal, ingMap)).toHaveLength(0);
    });
});

describe('calcularStockCritico', () => {
    test('stock 0 → crítico; <= mínimo → bajo; ok → fuera', () => {
        const ings = [
            { id: 1, nombre: 'Pimentón', stock_actual: 0, stock_minimo: 2, unidad: 'kg' },
            { id: 2, nombre: 'Ajo', stock_actual: 1, stock_minimo: 5, unidad: 'kg' },
            { id: 3, nombre: 'Sal', stock_actual: 50, stock_minimo: 5, unidad: 'kg' },
        ];
        const r = calcularStockCritico(ings);
        expect(r.map(x => x.nombre)).toEqual(['Pimentón', 'Ajo']); // Sal fuera; cero primero
        expect(r[0].cero).toBe(true);
        expect(r[1].cero).toBe(false);
    });
    test('ignora borrados/inactivos y sin stock numérico', () => {
        const ings = [
            { id: 1, nombre: 'X', stock_actual: 0, stock_minimo: 2, deleted_at: '2026-01-01' },
            { id: 2, nombre: 'Y', stock_actual: 0, stock_minimo: 2, activo: false },
            { id: 3, nombre: 'Z', stock_actual: null, stock_minimo: 2 },
        ];
        expect(calcularStockCritico(ings)).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────
// Entradas sin registrar (caso PAN): mercancía servida y cobrada
// con el stock a 0, que nunca salió del inventario.
// ─────────────────────────────────────────────────────────────
describe('construirAvisos — entradas sin registrar', () => {
    const deps = (fetchIntelligence) => ({ fetchIntelligence, ingredientes: [], pedidos: [] });

    test('crea el aviso con id estable, nivel atención y CTA al ingrediente', async () => {
        const avisos = await construirAvisos(deps(mkFetch({
            'unregistered-entries': { alertas: [ENTRADA_PAN] }
        })));
        const a = avisos.find(x => x.categoria === 'entradas');
        expect(a).toBeDefined();
        expect(a.id).toBe('entrada-345');      // estable → el descarte de 7d funciona
        expect(a.nivel).toBe('atencion');      // no es urgencia de hoy, es proceso roto
        expect(a.icono).toBe('📥');
        expect(a.cta).toEqual({ label: expect.any(String), tipo: 'ingrediente', id: 345 });
        expect(a.texto).toContain('PAN');
    });

    test('backend sin el endpoint (null) → no rompe y no inventa avisos', async () => {
        const avisos = await construirAvisos(deps(mkFetch({})));
        expect(avisos.filter(x => x.categoria === 'entradas')).toHaveLength(0);
    });

    test('respuesta sin alertas o malformada → sin avisos, sin crash', async () => {
        for (const payload of [{}, { alertas: null }, { alertas: [] }, 'texto', 42]) {
            const avisos = await construirAvisos(deps(mkFetch({ 'unregistered-entries': payload })));
            expect(avisos.filter(x => x.categoria === 'entradas')).toHaveLength(0);
        }
    });

    test('nunca supera maxPorTipo aunque el backend mande muchas', async () => {
        const muchas = Array.from({ length: 20 }, (_, i) => ({ ...ENTRADA_PAN, id: 100 + i }));
        const avisos = await construirAvisos(deps(mkFetch({
            'unregistered-entries': { alertas: muchas }
        })));
        expect(avisos.filter(x => x.categoria === 'entradas')).toHaveLength(UMBRALES.maxPorTipo);
    });

    test('si una señal falla, las demás siguen saliendo (aislamiento)', async () => {
        const fetchConFallo = (endpoint) => endpoint === 'price-check'
            ? Promise.resolve(null)
            : mkFetch({ 'unregistered-entries': { alertas: [ENTRADA_PAN] } })(endpoint);
        const avisos = await construirAvisos(deps(fetchConFallo));
        expect(avisos.filter(x => x.categoria === 'entradas')).toHaveLength(1);
    });
});
