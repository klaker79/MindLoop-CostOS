/**
 * suministros-valor-stock.test.js — P0
 *
 * El KPI Valor de Stock debe contar SOLO género (alimento + bebida). Los
 * suministros (guantes, servilletas, mantelillos) entran por recepción de pedido
 * pero no salen por ninguna receta, así que su stock solo puede crecer: en La
 * Nave 5 eran 11.283 € de 51.438 € (22%) y subían cada semana.
 *
 * Estos tests blindan las dos propiedades que importan:
 *   1. El corte género/suministro es correcto y tolerante a plurales.
 *   2. Es FAIL-SAFE: sin `familia` (backend antiguo) todo cuenta como género,
 *      así que el KPI nunca muestra menos valor del real.
 */
import { esSuministro } from '../../utils/cost-calculator.js';

describe('esSuministro — criterio único de material no comestible', () => {
    test('familia "suministro" es suministro', () => {
        expect(esSuministro({ familia: 'suministro' })).toBe(true);
    });

    test('acepta el plural "suministros" (importación masiva y datos históricos)', () => {
        expect(esSuministro({ familia: 'suministros' })).toBe(true);
    });

    test('ignora mayúsculas y espacios sobrantes', () => {
        expect(esSuministro({ familia: '  SUMINISTRO ' })).toBe(true);
        expect(esSuministro({ familia: 'Suministros' })).toBe(true);
    });

    test('alimento y bebida son género, no suministro', () => {
        expect(esSuministro({ familia: 'alimento' })).toBe(false);
        expect(esSuministro({ familia: 'bebida' })).toBe(false);
    });

    // FAIL-SAFE: si el frontend corre contra un backend que todavía no manda
    // `familia`, TODO debe contar como género. Un falso negativo solo mantiene el
    // comportamiento anterior; un falso positivo escondería valor real del stock.
    test('sin familia NO es suministro (default de BD es alimento)', () => {
        expect(esSuministro({})).toBe(false);
        expect(esSuministro({ familia: null })).toBe(false);
        expect(esSuministro({ familia: '' })).toBe(false);
        expect(esSuministro(null)).toBe(false);
        expect(esSuministro(undefined)).toBe(false);
    });

    test('una familia desconocida cuenta como género', () => {
        expect(esSuministro({ familia: 'marisco' })).toBe(false);
    });
});

describe('reparto del valor de stock', () => {
    // Muestra real de La Nave 5 (2026-08-01) reducida a 5 líneas.
    const inventario = [
        { id: 32, familia: 'alimento', valor_stock: 9157.59, stock_actual: 523.59 },
        { id: 354, familia: 'bebida', valor_stock: 1478.00, stock_actual: 1478 },
        { id: 320, familia: 'suministro', valor_stock: 601.00, stock_actual: 6010 },
        { id: 1132, familia: 'suministro', valor_stock: 350.00, stock_actual: 3500 },
        { id: 45, familia: 'alimento', valor_stock: 156.67, stock_actual: 9.6 },
    ];

    const repartir = (items) => items.reduce((acc, i) => {
        const valor = parseFloat(i.valor_stock) || 0;
        if (esSuministro(i)) acc.suministros += valor;
        else acc.genero += valor;
        return acc;
    }, { genero: 0, suministros: 0 });

    test('separa género de suministros', () => {
        const { genero, suministros } = repartir(inventario);
        expect(genero).toBeCloseTo(10792.26, 2);
        expect(suministros).toBeCloseTo(951.00, 2);
    });

    // Invariante anti-fuga: ningún euro puede perderse ni contarse dos veces al
    // partir el total. Si alguien añade una tercera categoría, esto lo caza.
    test('género + suministros = total de siempre (no se pierde ni un euro)', () => {
        const { genero, suministros } = repartir(inventario);
        const total = inventario.reduce((s, i) => s + i.valor_stock, 0);
        expect(genero + suministros).toBeCloseTo(total, 2);
    });

    test('sin campo familia, todo el valor va a género', () => {
        const sinFamilia = inventario.map(({ familia, ...resto }) => resto);
        const { genero, suministros } = repartir(sinFamilia);
        expect(suministros).toBe(0);
        expect(genero).toBeCloseTo(11743.26, 2);
    });
});
