/**
 * omnes-suministros.test.js — aviso de suministros acumulados.
 *
 * Los suministros no están en ninguna receta: vender NO los descuenta, así que
 * su stock solo puede subir y acaba midiendo lo comprado desde el primer día en
 * vez de lo que hay en el almacén (La Nave 5: 45 de 54 sin bajar en 90 días).
 *
 * `resumirSuministros` colapsa las N alertas del backend en UN solo aviso. Estos
 * tests fijan lo que importa: que agrega en vez de spamear, que degrada sin
 * romper cuando el backend no tiene el endpoint, y que no saca tarjeta vacía.
 */
import { resumirSuministros } from '../../modules/inteligencia/omnes-avisos.js';

// Recorte real de La Nave 5 (2026-08-01).
const RESPUESTA = {
    ventana_dias: 90,
    umbral_meses: 2,
    n_suministros_con_stock: 64,
    valor_total: 11283.61,
    valor_exceso_total: 4433.93,
    nunca_contados: 64,
    alertas: [
        { id: 501, nombre: 'PROPANO', meses_cobertura: 5.6, valor_exceso: 2401.97 },
        { id: 502, nombre: 'CAMINO MESA VICHY TAUPE', meses_cobertura: 3, valor_exceso: 550.53 },
        { id: 503, nombre: 'ROLLO TRAPO PUNTO AZUL', meses_cobertura: 5.1, valor_exceso: 250.36 },
        { id: 504, nombre: 'SERVILLETAS 30*40', meses_cobertura: 3.9, valor_exceso: 185.79 },
    ],
};

describe('resumirSuministros — un aviso, no veinte', () => {
    test('agrega las alertas y se queda con los 3 que más dinero acumulan', () => {
        const r = resumirSuministros(RESPUESTA);
        expect(r.nAlertas).toBe(4);
        expect(r.nTotal).toBe(64);
        expect(r.valorExceso).toBeCloseTo(4433.93, 2);
        expect(r.nuncaContados).toBe(64);
        expect(r.top).toEqual(['PROPANO', 'CAMINO MESA VICHY TAUPE', 'ROLLO TRAPO PUNTO AZUL']);
    });

    test('el CTA apunta al que más acumula', () => {
        expect(resumirSuministros(RESPUESTA).peorId).toBe(501);
    });

    test('calcula el exceso sumando si el backend no manda el total', () => {
        const { valor_exceso_total, ...sinTotal } = RESPUESTA;
        expect(resumirSuministros(sinTotal).valorExceso).toBeCloseTo(3388.65, 2);
    });
});

describe('degradación sin romper', () => {
    // El endpoint es nuevo: si el backend todavía no está desplegado,
    // fetchIntelligence devuelve null y el feed debe seguir funcionando.
    test('backend sin el endpoint (null) → sin aviso', () => {
        expect(resumirSuministros(null)).toBeNull();
        expect(resumirSuministros(undefined)).toBeNull();
    });

    test('sin alertas → sin tarjeta vacía', () => {
        expect(resumirSuministros({ ...RESPUESTA, alertas: [] })).toBeNull();
        expect(resumirSuministros({})).toBeNull();
    });

    test('alertas sin dinero detrás → sin aviso (anti-ruido)', () => {
        const sinDinero = { ...RESPUESTA, valor_exceso_total: 0, alertas: [{ id: 1, nombre: 'X', valor_exceso: 0 }] };
        expect(resumirSuministros(sinDinero)).toBeNull();
    });

    test('alerta sin id no rompe: aviso sin CTA', () => {
        const sinId = { ...RESPUESTA, alertas: [{ nombre: 'PROPANO', valor_exceso: 100 }] };
        const r = resumirSuministros(sinId);
        expect(r.peorId).toBeNull();
        expect(r.top).toEqual(['PROPANO']);
    });
});
