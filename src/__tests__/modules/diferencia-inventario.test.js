/**
 * Panel de diferencia de inventario (pestaña Inventario).
 *
 * Enseña la distancia entre lo que el sistema creía tener y lo que había de
 * verdad en la última vuelta a la cámara. El dato se guardaba desde diciembre de
 * 2025 (560 recuentos en La Nave 5) y no se pintaba en ninguna pantalla.
 *
 * Solo informa: el stock virtual es una aproximación y el recuento físico es lo
 * único que pone los dos mundos a cero. Compensarlo automáticamente obligaría a
 * una precisión de almacén que una cocina no sostiene.
 */
import {
    construirPanelDiferencia,
    compararRecuentos,
    nivelDesviacion
} from '../../modules/inventario/diferencia-inventario.js';

// Recuento real del 23/07 en La Nave 5, recortado.
const DATA = {
    dias: 90,
    recuentos: 26,
    acumulado_eur: -39199.12,
    ultimo: {
        fecha: '2026-07-23T15:12:00.000Z',
        contados: 25,
        falta_eur: 3601.2,
        sobra_eur: 17.19,
        neto_eur: -3584.01,
        valor_esperado: 4172.5,
        desviacion_pct: 85.9,
        top: [
            { id: 45, nombre: 'BERBERECHOS', unidad: 'kg', stock_virtual: 54.2, stock_real: 9.6, diferencia: -44.6, eur: -728.0 },
            { id: 47, nombre: 'NAVAJA', unidad: 'kg', stock_virtual: 90, stock_real: 31.5, diferencia: -58.5, eur: -1025.0 }
        ]
    },
    anterior: {
        fecha: '2026-07-02T14:52:00.000Z',
        contados: 24, neto_eur: -3649, desviacion_pct: 92.4, top: []
    }
};

describe('construirPanelDiferencia', () => {
    test('pinta el dinero de diferencia y el % de desviación', () => {
        const html = construirPanelDiferencia(DATA);
        expect(html).toContain('85.9%');
        expect(html).toMatch(/3\.?584/);       // el titular, con o sin separador
        expect(html).toContain('BERBERECHOS');
        expect(html).toContain('NAVAJA');
    });

    // Un restaurante que nunca ha contado no necesita un panel vacío diciéndoselo.
    test('sin recuentos NO pinta nada', () => {
        expect(construirPanelDiferencia(null)).toBe('');
        expect(construirPanelDiferencia({})).toBe('');
        expect(construirPanelDiferencia({ ultimo: null })).toBe('');
        expect(construirPanelDiferencia({ ultimo: { contados: 0 } })).toBe('');
    });

    test('el acumulado solo sale si hay más de un recuento', () => {
        expect(construirPanelDiferencia(DATA)).toContain('39');
        const uno = { ...DATA, recuentos: 1 };
        const html = construirPanelDiferencia(uno);
        expect(html).not.toMatch(/39\.199/);
    });

    test('cuando SOBRA género el mensaje es el otro', () => {
        const sobra = { ...DATA, ultimo: { ...DATA.ultimo, neto_eur: 250, top: [] } };
        const html = construirPanelDiferencia(sobra);
        // El signo del titular cambia (+ en vez de −).
        expect(html).toContain('+');
    });
});

describe('compararRecuentos — mejora o empeora', () => {
    // Se comparan PORCENTAJES: contar la bodega entera y contar cuatro ingredientes
    // dan cifras absolutas que no significan lo mismo.
    test('detecta mejora cuando baja la desviación', () => {
        const c = compararRecuentos(DATA.ultimo, DATA.anterior);
        expect(c.mejora).toBe(true);
        expect(c.delta).toBeCloseTo(-6.5, 1);
    });

    test('detecta empeoramiento', () => {
        const c = compararRecuentos({ desviacion_pct: 30 }, { desviacion_pct: 10 });
        expect(c.mejora).toBe(false);
        expect(c.delta).toBe(20);
    });

    test('sin recuento anterior no inventa tendencia', () => {
        expect(compararRecuentos(DATA.ultimo, null)).toBeNull();
        expect(compararRecuentos(null, DATA.anterior)).toBeNull();
        expect(compararRecuentos({ desviacion_pct: null }, { desviacion_pct: 5 })).toBeNull();
    });
});

describe('nivelDesviacion — semáforo', () => {
    test('≤5% es sano: el stock sirve para decidir compras', () => {
        expect(nivelDesviacion(2).nivel).toBe('bueno');
        expect(nivelDesviacion(5).nivel).toBe('bueno');
    });

    test('entre 5 y 15% hay que mirarlo', () => {
        expect(nivelDesviacion(9).nivel).toBe('atencion');
    });

    test('>15% el stock ya no es fiable', () => {
        expect(nivelDesviacion(40).nivel).toBe('malo');
        expect(nivelDesviacion(85.9).nivel).toBe('malo');
    });

    test('da igual el signo: desviarse es desviarse', () => {
        expect(nivelDesviacion(-40).nivel).toBe('malo');
    });

    test('sin dato no pinta semáforo', () => {
        expect(nivelDesviacion(null).nivel).toBe('sin-datos');
    });
});
