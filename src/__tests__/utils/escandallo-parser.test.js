/**
 * Tests defensivos del parser de escandallo de recetas.
 *
 * Origen: fixes de la sesión 2026-05-28..31 (Iker). Cubren los casos de
 * negocio que costaron diagnosticar para evitar regresiones:
 *  - Detección de formato escandallo vs sólo-cabecera.
 *  - Forward-fill de cabecera por receta.
 *  - Matching ingrediente por nombre (case-insensitive, trim).
 *  - Subrecetas reconocidas por nombre (ingredienteId = 100000 + recetaId).
 *  - Auto-referencia bloqueada (una receta no se incluye a sí misma).
 *  - Rendimiento: en blanco = hereda; explícito 0-100 = se fija.
 *  - Líneas sin emparejar → reportadas, no bloquean si hay otras válidas.
 *  - Recetas sin líneas válidas → marcadas inválidas.
 */

import {
    celdaReceta,
    parseRecetasSoloCabecera,
    parseRecetasConEscandallo,
    parseRecetas,
} from '../../utils/escandallo-parser.js';

describe('celdaReceta', () => {
    it('encuentra la columna case-insensitive', () => {
        const row = { Ingrediente: 'PULPO', cantidad: 0.25 };
        expect(celdaReceta(row, ['ingrediente'])).toBe('PULPO');
        expect(celdaReceta(row, ['INGREDIENTE'])).toBe('PULPO');
    });

    it('trim en el nombre buscado y en las claves del row', () => {
        const row = { '  Receta ': 'PULPO A FEIRA' };
        expect(celdaReceta(row, ['Receta'])).toBe('PULPO A FEIRA');
    });

    it('prueba candidatos en orden, devuelve el primero con valor', () => {
        const row = { 'Precio (€)': 18, Precio: '' };
        expect(celdaReceta(row, ['Precio Venta', 'Precio (€)', 'Precio'])).toBe(18);
    });

    it('ignora celdas vacías/null/undefined', () => {
        const row = { A: '', B: null, C: undefined, D: '  ', E: 'hola' };
        expect(celdaReceta(row, ['A', 'B', 'C', 'D', 'E'])).toBe('hola');
    });

    it('devuelve string vacío si ningún nombre casa', () => {
        expect(celdaReceta({ X: 1 }, ['Y', 'Z'])).toBe('');
    });
});

describe('parseRecetasSoloCabecera (formato histórico)', () => {
    it('una fila = una receta vacía', () => {
        const res = parseRecetasSoloCabecera([
            { Nombre: 'PULPO A FEIRA', Categoría: 'Alimentos', 'Precio Venta': 18, Porciones: 1 },
        ]);
        expect(res).toHaveLength(1);
        expect(res[0].nombre).toBe('PULPO A FEIRA');
        expect(res[0].categoria).toBe('Alimentos');
        expect(res[0].precioVenta).toBe(18);
        expect(res[0].porciones).toBe(1);
        expect(res[0].ingredientes).toEqual([]);
        expect(res[0].valido).toBe(true);
    });

    it('marca inválida si no hay nombre', () => {
        const res = parseRecetasSoloCabecera([{ Nombre: '   ', Precio: 10 }]);
        expect(res[0].valido).toBe(false);
        expect(res[0].error).toBe('Nombre requerido');
    });

    it('porciones < 1 se normaliza a 1', () => {
        const res = parseRecetasSoloCabecera([{ Nombre: 'X', Porciones: 0 }]);
        expect(res[0].porciones).toBe(1);
    });
});

describe('parseRecetasConEscandallo: agrupado y forward-fill', () => {
    const INGS = [
        { id: 50, nombre: 'PULPO' },
        { id: 51, nombre: 'PATATA' },
        { id: 52, nombre: 'ACEITE DE OLIVA' },
    ];

    it('agrupa filas por receta con cabecera sólo en la 1ª', () => {
        const data = [
            { Receta: 'PULPO A FEIRA', Categoría: 'Alimentos', 'Precio Venta': 18, Porciones: 1, Ingrediente: 'PULPO', Cantidad: 0.25, Rendimiento: 60 },
            { Receta: 'PULPO A FEIRA', Ingrediente: 'PATATA', Cantidad: 0.2 },
            { Receta: 'PULPO A FEIRA', Ingrediente: 'ACEITE DE OLIVA', Cantidad: 0.02 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res).toHaveLength(1);
        const r = res[0];
        expect(r.nombre).toBe('PULPO A FEIRA');
        expect(r.categoria).toBe('Alimentos');
        expect(r.precioVenta).toBe(18);
        expect(r.porciones).toBe(1);
        expect(r.ingredientes).toEqual([
            { ingredienteId: 50, cantidad: 0.25, rendimiento: 60 },
            { ingredienteId: 51, cantidad: 0.2 },
            { ingredienteId: 52, cantidad: 0.02 },
        ]);
        expect(r.sinEmparejar).toEqual([]);
        expect(r.valido).toBe(true);
    });

    it('forward-fill funciona también si el nombre de receta está vacío en continuaciones', () => {
        const data = [
            { Receta: 'PULPO A FEIRA', Categoría: 'Alimentos', 'Precio Venta': 18, Porciones: 1, Ingrediente: 'PULPO', Cantidad: 0.25 },
            { Receta: '', Ingrediente: 'PATATA', Cantidad: 0.2 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res).toHaveLength(1);
        expect(res[0].ingredientes).toHaveLength(2);
    });

    it('separa varias recetas correctamente', () => {
        const data = [
            { Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1 },
            { Receta: 'R2', 'Precio Venta': 20, Ingrediente: 'PATATA', Cantidad: 0.2 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res).toHaveLength(2);
        expect(res[0].nombre).toBe('R1');
        expect(res[1].nombre).toBe('R2');
    });

    it('descarta filas sin nombre actual (no current)', () => {
        const data = [
            { Receta: '', Ingrediente: 'PULPO', Cantidad: 0.1 },  // ignorada
            { Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res).toHaveLength(1);
        expect(res[0].ingredientes).toHaveLength(1);
    });

    it('cabecera repetida con valor ya fijado != default → NO sobrescribe', () => {
        // Categoría != 'principal' y precio > 0 y porciones > 1 en la 1ª fila →
        // las siguientes filas con cabecera distinta no deben pisar los valores.
        const data = [
            { Receta: 'R1', Categoría: 'Alimentos', 'Precio Venta': 18, Porciones: 2, Ingrediente: 'PULPO', Cantidad: 0.1 },
            { Receta: 'R1', Categoría: 'Otra', 'Precio Venta': 99, Porciones: 4, Ingrediente: 'PATATA', Cantidad: 0.2 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].categoria).toBe('Alimentos');
        expect(res[0].precioVenta).toBe(18);
        expect(res[0].porciones).toBe(2);
    });

    it('cabecera por forward-fill: si la 1ª fila no la trae, una posterior la rellena', () => {
        // 1ª fila sólo trae nombre + línea, defaults aplicados (cat=principal,
        // precio=0, porciones=1). Una fila posterior con cabecera la rellena.
        const data = [
            { Receta: 'R1', Ingrediente: 'PULPO', Cantidad: 0.1 },
            { Receta: 'R1', Categoría: 'Alimentos', 'Precio Venta': 18, Porciones: 4, Ingrediente: 'PATATA', Cantidad: 0.2 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].categoria).toBe('Alimentos');
        expect(res[0].precioVenta).toBe(18);
        expect(res[0].porciones).toBe(4);
    });
});

describe('parseRecetasConEscandallo: matching de ingredientes', () => {
    const INGS = [
        { id: 50, nombre: 'PULPO' },
        { id: 99, nombre: '  Aceite de Oliva  ' }, // con espacios y case mezclado
    ];

    it('matching es case-insensitive y trim', () => {
        const data = [
            { Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'pulpo', Cantidad: 0.1 },
            { Receta: 'R1', Ingrediente: 'aceite de oliva', Cantidad: 0.02 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].ingredientes).toEqual([
            { ingredienteId: 50, cantidad: 0.1 },
            { ingredienteId: 99, cantidad: 0.02 },
        ]);
    });

    it('línea con nombre no existente → sinEmparejar (no bloquea)', () => {
        const data = [
            { Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'INVENTADO', Cantidad: 0.1 },
            { Receta: 'R1', Ingrediente: 'PULPO', Cantidad: 0.2 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].sinEmparejar).toContain('INVENTADO');
        expect(res[0].ingredientes).toHaveLength(1); // PULPO sí entra
        expect(res[0].valido).toBe(true);
    });

    it('receta sólo con ingredientes inválidos → marcada inválida', () => {
        const data = [
            { Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'INVENTADO', Cantidad: 0.1 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].valido).toBe(false);
        expect(res[0].error).toBe('Sin líneas válidas emparejadas');
    });

    it('cantidad inválida (vacía o 0) → sinEmparejar con etiqueta', () => {
        const data = [
            { Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0 },
        ];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].sinEmparejar[0]).toMatch(/cantidad inválida/);
    });
});

describe('parseRecetasConEscandallo: subrecetas y auto-referencia', () => {
    const INGS = [{ id: 50, nombre: 'PULPO' }];
    const RECS = [{ id: 1, nombre: 'SALSA BRAVA' }, { id: 2, nombre: 'PULPO A FEIRA' }];

    it('si no casa ingrediente pero sí receta → subreceta con id +100000', () => {
        const data = [
            { Receta: 'R_NUEVA', 'Precio Venta': 10, Ingrediente: 'SALSA BRAVA', Cantidad: 0.05 },
        ];
        const res = parseRecetasConEscandallo(data, INGS, RECS);
        expect(res[0].ingredientes).toEqual([{ ingredienteId: 100001, cantidad: 0.05 }]);
    });

    it('auto-referencia bloqueada: una receta no se incluye a sí misma como subreceta', () => {
        const data = [
            { Receta: 'PULPO A FEIRA', 'Precio Venta': 18, Ingrediente: 'PULPO A FEIRA', Cantidad: 0.1 },
        ];
        const res = parseRecetasConEscandallo(data, INGS, RECS);
        expect(res[0].sinEmparejar).toContain('PULPO A FEIRA');
        expect(res[0].ingredientes).toEqual([]);
    });
});

describe('parseRecetasConEscandallo: rendimiento (prioridad de línea)', () => {
    const INGS = [{ id: 50, nombre: 'PULPO' }];

    it('rendimiento en blanco → no se fija en la línea (hereda)', () => {
        const data = [{ Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1 }];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].ingredientes[0]).toEqual({ ingredienteId: 50, cantidad: 0.1 });
        expect(res[0].ingredientes[0].rendimiento).toBeUndefined();
    });

    it('rendimiento explícito 1-100 → se fija en la línea', () => {
        const data = [{ Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1, Rendimiento: 60 }];
        const res = parseRecetasConEscandallo(data, INGS);
        expect(res[0].ingredientes[0].rendimiento).toBe(60);
    });

    it('rendimiento fuera de rango (0 o >100) → no se fija', () => {
        const dataCero = [{ Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1, Rendimiento: 0 }];
        const dataAlto = [{ Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1, Rendimiento: 150 }];
        expect(parseRecetasConEscandallo(dataCero, INGS)[0].ingredientes[0].rendimiento).toBeUndefined();
        expect(parseRecetasConEscandallo(dataAlto, INGS)[0].ingredientes[0].rendimiento).toBeUndefined();
    });

    it('acepta variantes de nombre de columna: "Rendimiento" y "Rendimiento (%)"', () => {
        const data = [{ Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1, 'Rendimiento (%)': 60 }];
        expect(parseRecetasConEscandallo(data, INGS)[0].ingredientes[0].rendimiento).toBe(60);
    });
});

describe('parseRecetas (entry point)', () => {
    it('detecta formato escandallo si hay columna "Ingrediente"', () => {
        const INGS = [{ id: 1, nombre: 'PULPO' }];
        const data = [{ Receta: 'R1', 'Precio Venta': 10, Ingrediente: 'PULPO', Cantidad: 0.1 }];
        const res = parseRecetas(data, INGS);
        expect(res[0].ingredientes).toHaveLength(1);
    });

    it('si NO hay columna "Ingrediente" → modo histórico (vacío)', () => {
        const data = [{ Nombre: 'R1', 'Precio Venta': 10, Porciones: 1 }];
        const res = parseRecetas(data);
        expect(res[0].ingredientes).toEqual([]);
    });

    it('input vacío o no-array → []', () => {
        expect(parseRecetas([])).toEqual([]);
        expect(parseRecetas(null)).toEqual([]);
        expect(parseRecetas(undefined)).toEqual([]);
    });
});
