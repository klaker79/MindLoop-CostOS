/**
 * Resumen del recuento físico (cabecera del modal "Confirmar Mermas").
 *
 * El modal es el ÚLTIMO momento en que se puede corregir: al confirmar, la
 * diferencia se escribe en inventory_snapshots_v2, se reparte en
 * inventory_adjustments_v2 y —desde 2026-08-01— la parte que falta viaja también
 * a `mermas`, así que sale en los informes y en Omnes. Un 0 tecleado por error
 * deja de ser invisible y pasa a contar como dinero perdido.
 *
 * Por eso estos tests se centran en dos cosas: que las cuentas salgan, y que las
 * líneas que huelen a dedazo se señalen ANTES de guardar.
 */
import {
    construirResumenRecuento,
    construirHtmlResumen,
    fmtCant,
    UMBRALES_RECUENTO
} from '../../modules/inventario/resumen-recuento.js';

// Dedazos reales de La Nave 5: alguien puso a 0 el pan y la verdura de golpe.
const INGREDIENTES = [
    { id: 345, nombre: 'Pan Total', unidad: 'unidad' },
    { id: 900, nombre: 'VERDURA TOTAL', unidad: 'kg' },
    { id: 45, nombre: 'BERBERECHOS', unidad: 'kg' },
    { id: 47, nombre: 'NAVAJA', unidad: 'kg' },
];
const INVENTARIO = [
    { id: 345, precio_medio_compra: 1 },
    { id: 900, precio_medio_compra: 1 },
    { id: 45, precio_medio_compra: 16.32 },
    { id: 47, precio_medio_compra: 17.52 },
];
const deps = { ingredientes: INGREDIENTES, inventario: INVENTARIO };

describe('construirResumenRecuento — las cuentas', () => {
    test('separa lo que falta de lo que sobra y valora en €', () => {
        const r = construirResumenRecuento([
            { id: 45, stock_virtual: 20, stock_real: 8 },   // faltan 12 kg
            { id: 47, stock_virtual: 10, stock_real: 12 },  // sobran 2 kg
        ], deps);

        expect(r.contados).toBe(2);
        expect(r.faltan).toBe(1);
        expect(r.sobran).toBe(1);
        expect(r.importeFalta).toBeCloseTo(12 * 16.32, 2);
        expect(r.importeSobra).toBeCloseTo(2 * 17.52, 2);
        expect(r.importeNeto).toBeCloseTo(2 * 17.52 - 12 * 16.32, 2);
    });

    test('ignora las líneas que no cambian', () => {
        const r = construirResumenRecuento([
            { id: 45, stock_virtual: 20, stock_real: 20 },
            { id: 47, stock_virtual: 10, stock_real: 10.0001 },
        ], deps);
        expect(r.contados).toBe(0);
        expect(r.lineas).toEqual([]);
    });

    test('usa el precio canónico del ingrediente', () => {
        const r = construirResumenRecuento([{ id: 45, stock_virtual: 10, stock_real: 0 }], deps);
        expect(r.lineas[0].importe).toBeCloseTo(-163.2, 2);
    });

    test('sin precio no rompe: la línea sale con importe 0', () => {
        const r = construirResumenRecuento(
            [{ id: 45, stock_virtual: 10, stock_real: 0 }],
            { ingredientes: INGREDIENTES, inventario: [] }
        );
        expect(r.contados).toBe(1);
        expect(r.lineas[0].importe).toBe(0);
    });
});

describe('aviso: solo las diferencias ABSURDAS, no las grandes', () => {
    // Calibrado con 150 líneas reales de recuento de La Nave 5 (120 días). Con el
    // criterio anterior (cualquier cero, o 200 €, o el 90%, en OR) saltaban 96 de
    // 150. Un aviso que salta el 64% de las veces se deja de leer.

    test('se esfuma casi todo Y mueve dinero → avisa', () => {
        // Caso real: SOLOMILLO 22 → 1 kg. Es lo que Iker quiere ver.
        const carne = {
            ingredientes: [{ id: 1, nombre: 'Solomillo de ternera', unidad: 'kg' }],
            inventario: [{ id: 1, precio_medio_compra: 19.08 }],
        };
        const r = construirResumenRecuento([{ id: 1, stock_virtual: 22, stock_real: 1 }], carne);
        expect(r.sospechosas).toHaveLength(1);
        expect(r.sospechosas[0].motivoAviso).toBe('casi-todo');
    });

    test('una merma GRANDE pero plausible NO avisa', () => {
        // Caso real: AMEIXAS 30,7 → 6 kg (80%, 561 €). En un sitio de marisco es
        // un martes cualquiera. Sale en la tabla de reparto, no en el aviso.
        const marisco = {
            ingredientes: [{ id: 2, nombre: 'AMEIXAS', unidad: 'kg' }],
            inventario: [{ id: 2, precio_medio_compra: 22.7 }],
        };
        const r = construirResumenRecuento([{ id: 2, stock_virtual: 30.7, stock_real: 6 }], marisco);
        expect(r.sospechosas).toHaveLength(0);
        expect(r.contados).toBe(1);   // pero SÍ se cuenta en el resumen
    });

    test('vaciar algo que no vale nada NO avisa', () => {
        // Antes bastaba con poner a 0: una caja de perejil daba aviso.
        const perejil = {
            ingredientes: [{ id: 3, nombre: 'PEREJIL', unidad: 'kg' }],
            inventario: [{ id: 3, precio_medio_compra: 2 }],
        };
        const r = construirResumenRecuento([{ id: 3, stock_virtual: 5, stock_real: 0 }], perejil);
        expect(r.sospechosas).toHaveLength(0);
    });

    test('una cifra bestia avisa aunque proporcionalmente sea poco', () => {
        // 40 de 746 kg de pulpo son solo el 5%, pero son ~700 €: hay que mirarlo.
        const pulpo = {
            ingredientes: [{ id: 4, nombre: 'PULPO', unidad: 'kg' }],
            inventario: [{ id: 4, precio_medio_compra: 17.49 }],
        };
        const r = construirResumenRecuento([{ id: 4, stock_virtual: 746, stock_real: 696 }], pulpo);
        expect(r.sospechosas[0].motivoAviso).toBe('importe');
    });

    test('una diferencia pequeña y normal NO avisa', () => {
        const r = construirResumenRecuento([{ id: 45, stock_virtual: 20, stock_real: 19.5 }], deps);
        expect(r.sospechosas).toHaveLength(0);
    });

    test('las sospechosas van primero y ordenadas por dinero', () => {
        const r = construirResumenRecuento([
            { id: 45, stock_virtual: 20, stock_real: 19.5 },          // normal
            { id: 900, stock_virtual: 456, stock_real: 0 },            // absurdo, 456 €
            { id: 345, stock_virtual: 1416.75, stock_real: 0 },        // absurdo, 1.416 €
        ], deps);
        expect(r.lineas.map(l => l.nombre)).toEqual(['Pan Total', 'VERDURA TOTAL', 'BERBERECHOS']);
        expect(r.sospechosas).toHaveLength(2);
    });
});

describe('entradas raras no rompen el guardado', () => {
    test('lista vacía, nula o con basura', () => {
        expect(construirResumenRecuento([], deps).contados).toBe(0);
        expect(construirResumenRecuento(null, deps).contados).toBe(0);
        expect(construirResumenRecuento([null, {}, { id: null }], deps).contados).toBe(0);
    });

    test('sin deps (ni ingredientes ni inventario cargados)', () => {
        const r = construirResumenRecuento([{ id: 45, stock_virtual: 10, stock_real: 0 }]);
        expect(r.contados).toBe(1);
        expect(r.lineas[0].nombre).toBe('Ingrediente 45');
    });

    test('valores no numéricos se tratan como 0', () => {
        const r = construirResumenRecuento([{ id: 45, stock_virtual: 'x', stock_real: 5 }], deps);
        expect(r.lineas[0].diferencia).toBe(5);
    });
});

describe('construirHtmlResumen', () => {
    test('pinta los contadores y el bloque de avisos', () => {
        const r = construirResumenRecuento([{ id: 345, stock_virtual: 1416.75, stock_real: 0 }], deps);
        const html = construirHtmlResumen(r);
        expect(html).toContain('Pan Total');
        expect(html).toMatch(/1\.?416/);
    });

    test('sin cambios no pinta nada', () => {
        expect(construirHtmlResumen(construirResumenRecuento([], deps))).toBe('');
        expect(construirHtmlResumen(null)).toBe('');
    });

    test('sin sospechosas no aparece el bloque naranja de avisos', () => {
        const r = construirResumenRecuento([{ id: 45, stock_virtual: 20, stock_real: 19.5 }], deps);
        const html = construirHtmlResumen(r);
        expect(html).not.toContain('#FFF7ED');
    });
});

describe('fmtCant', () => {
    test('quita decimales inútiles y usa coma', () => {
        expect(fmtCant(12)).toBe('12');
        expect(fmtCant(0.75)).toBe('0,75');
        expect(fmtCant('no')).toBe('0');
    });
});

describe('umbrales', () => {
    test('están documentados y son coherentes entre sí', () => {
        expect(UMBRALES_RECUENTO.fraccionAlta).toBeLessThanOrEqual(1);
        expect(UMBRALES_RECUENTO.importeMinimoFraccion).toBeGreaterThan(0);
        // El atajo por importe tiene que ser MÁS alto que el mínimo de la regla
        // combinada; si no, se saltaría siempre por el camino corto y volveríamos
        // al ruido de avisar por todo.
        expect(UMBRALES_RECUENTO.importeExtremo)
            .toBeGreaterThan(UMBRALES_RECUENTO.importeMinimoFraccion);
    });
});

describe('seguridad — el nombre del ingrediente lo escribe el usuario', () => {
    // Auditoría XSS 2026-07-31: todo dato de usuario que acabe en innerHTML se escapa.
    test('un nombre con HTML no se inyecta en el modal', () => {
        const malicioso = {
            ingredientes: [{ id: 1, nombre: '<img src=x onerror=alert(1)>', unidad: '"><script>' }],
            inventario: [{ id: 1, precio_medio_compra: 100 }],
        };
        const r = construirResumenRecuento([{ id: 1, stock_virtual: 10, stock_real: 0 }], malicioso);
        const html = construirHtmlResumen(r);
        expect(html).not.toContain('<img src=x');
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;img');
    });
});
