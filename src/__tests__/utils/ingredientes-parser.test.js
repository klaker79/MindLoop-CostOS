/**
 * Tests defensivos del parser del Excel de ingredientes.
 *
 * Cubre los casos de negocio cristalizados en la tanda 2026-05-29..31:
 *  - Detección de duplicados existentes (skip).
 *  - Detección de duplicados dentro del propio Excel (skip).
 *  - Resolución de la columna "Proveedor" por nombre (caso A: nuevos).
 *  - Aviso para nombres de proveedor inexistentes (no bloquea).
 *  - Caso B (2026-05-30): existente SIN proveedor + Excel CON proveedor
 *    emparejado → marca `actualizarProveedor` (no skip, no full upsert).
 *  - Caso B NO se activa si el existente ya tenía proveedor.
 *  - Variantes de mayúsculas/minúsculas en columnas y en el matching.
 */

import { parseIngredientes } from '../../utils/ingredientes-parser.js';

describe('parseIngredientes: caso A (creación nueva)', () => {
    it('parsea una fila con todos los campos', () => {
        const res = parseIngredientes(
            [{
                Nombre: 'PULPO',
                Precio: 20,
                Unidad: 'kg',
                'Stock Actual': 5,
                'Stock Mínimo': 1,
                Proveedor: 'PESCADOS PEREZ',
            }],
            [],
            [{ id: 7, nombre: 'PESCADOS PEREZ' }],
        );
        expect(res[0]).toMatchObject({
            nombre: 'PULPO',
            precio: 20,
            unidad: 'kg',
            stockActual: 5,
            stockMinimo: 1,
            proveedorId: 7,
            proveedorAviso: null,
            valido: true,
            yaExiste: false,
            dupEnArchivo: false,
            actualizarProveedor: false,
        });
    });

    it('proveedor sin emparejar → proveedorId=null + aviso (no bloquea)', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Proveedor: 'INVENTADO' }],
            [],
            [{ id: 1, nombre: 'CASH RECORD' }],
        );
        expect(res[0].proveedorId).toBeNull();
        expect(res[0].proveedorAviso).toMatch(/INVENTADO/);
        expect(res[0].valido).toBe(true);
    });

    it('proveedor vacío → no genera aviso', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X' }],
            [],
            [{ id: 1, nombre: 'CASH RECORD' }],
        );
        expect(res[0].proveedorId).toBeNull();
        expect(res[0].proveedorAviso).toBeNull();
    });

    it('matching proveedor es case-insensitive y trim', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Proveedor: '  pescados perez  ' }],
            [],
            [{ id: 7, nombre: 'PESCADOS PEREZ' }],
        );
        expect(res[0].proveedorId).toBe(7);
    });

    it('nombre vacío → valido=false con error "Nombre requerido"', () => {
        const res = parseIngredientes(
            [{ Nombre: '   ', Precio: 10 }],
            [],
            [],
        );
        expect(res[0].valido).toBe(false);
        expect(res[0].error).toBe('Nombre requerido');
    });

    it('acepta variantes de nombres de columna', () => {
        const res = parseIngredientes(
            [{ nombre: 'X', 'Precio (€)': 5, supplier: 'Foo' }],
            [],
            [{ id: 1, nombre: 'Foo' }],
        );
        expect(res[0].nombre).toBe('X');
        expect(res[0].precio).toBe(5);
        expect(res[0].proveedorId).toBeNull(); // 'supplier' lowercase no está en la lista — sólo Supplier capitalizado
    });

    it('reconoce "Supplier" con mayúscula como alias inglés de Proveedor', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Supplier: 'Foo' }],
            [],
            [{ id: 1, nombre: 'Foo' }],
        );
        expect(res[0].proveedorId).toBe(1);
    });
});

describe('parseIngredientes: dedup y skip de existentes', () => {
    const EXISTENTES = [{ id: 50, nombre: 'PULPO', proveedor_id: 7 }];

    it('marca yaExiste=true si el nombre coincide con uno en BD', () => {
        const res = parseIngredientes(
            [{ Nombre: 'PULPO' }],
            EXISTENTES,
            [],
        );
        expect(res[0].yaExiste).toBe(true);
        expect(res[0].existenteId).toBe(50);
    });

    it('matching de existente es case-insensitive y trim', () => {
        const res = parseIngredientes(
            [{ Nombre: '  pulpo  ' }],
            EXISTENTES,
            [],
        );
        expect(res[0].yaExiste).toBe(true);
    });

    it('detecta duplicados dentro del propio Excel', () => {
        const res = parseIngredientes(
            [
                { Nombre: 'NUEVO_A' },
                { Nombre: 'NUEVO_A' }, // duplicado dentro del Excel
            ],
            [],
            [],
        );
        expect(res[0].dupEnArchivo).toBe(false);
        expect(res[1].dupEnArchivo).toBe(true);
    });

    it('una fila sin nombre no afecta al dedup (no se cuenta)', () => {
        const res = parseIngredientes(
            [
                { Nombre: '' },
                { Nombre: 'NUEVO' },
            ],
            [],
            [],
        );
        expect(res[1].dupEnArchivo).toBe(false);
    });
});

describe('parseIngredientes: caso B (actualizar proveedor en existente huérfano)', () => {
    it('existente SIN proveedor + Excel con proveedor emparejado → actualizarProveedor=true', () => {
        const res = parseIngredientes(
            [{ Nombre: 'CALABACIN', Proveedor: 'VERDURAS GOMEZ' }],
            [{ id: 80, nombre: 'CALABACIN', proveedor_id: null }],
            [{ id: 7, nombre: 'VERDURAS GOMEZ' }],
        );
        expect(res[0].yaExiste).toBe(true);
        expect(res[0].actualizarProveedor).toBe(true);
        expect(res[0].existenteId).toBe(80);
        expect(res[0].proveedorId).toBe(7);
    });

    it('existente CON proveedor (cualquiera) → NO se activa caso B', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Proveedor: 'CASH RECORD' }],
            [{ id: 50, nombre: 'X', proveedor_id: 999 }], // ya tiene proveedor distinto
            [{ id: 1, nombre: 'CASH RECORD' }],
        );
        expect(res[0].yaExiste).toBe(true);
        expect(res[0].actualizarProveedor).toBe(false);
    });

    it('existente sin proveedor pero Excel sin proveedor → NO caso B (no hay nada que actualizar)', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X' }],
            [{ id: 50, nombre: 'X', proveedor_id: null }],
            [],
        );
        expect(res[0].actualizarProveedor).toBe(false);
    });

    it('existente sin proveedor + Excel con proveedor que NO empareja → NO caso B (no hay id)', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Proveedor: 'INVENTADO' }],
            [{ id: 50, nombre: 'X', proveedor_id: null }],
            [{ id: 1, nombre: 'OTRO' }],
        );
        expect(res[0].actualizarProveedor).toBe(false);
        expect(res[0].proveedorAviso).toMatch(/INVENTADO/);
    });

    it('acepta proveedor_id ó proveedorId como nombre del campo (legacy)', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Proveedor: 'P' }],
            [{ id: 1, nombre: 'X', proveedorId: 99 }], // formato camelCase
            [{ id: 7, nombre: 'P' }],
        );
        expect(res[0].actualizarProveedor).toBe(false); // ya tiene proveedor (camelCase)
    });

    it('dupEnArchivo bloquea actualizarProveedor (la 2ª aparición no actúa)', () => {
        const res = parseIngredientes(
            [
                { Nombre: 'X', Proveedor: 'P' },
                { Nombre: 'X', Proveedor: 'P' },
            ],
            [{ id: 50, nombre: 'X', proveedor_id: null }],
            [{ id: 7, nombre: 'P' }],
        );
        expect(res[0].actualizarProveedor).toBe(true);
        expect(res[1].dupEnArchivo).toBe(true);
        expect(res[1].actualizarProveedor).toBe(false);
    });
});

describe('parseIngredientes: edge cases', () => {
    it('data vacío o no-array → []', () => {
        expect(parseIngredientes([])).toEqual([]);
        expect(parseIngredientes(null)).toEqual([]);
        expect(parseIngredientes(undefined)).toEqual([]);
    });

    it('precio inválido → 0', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', Precio: 'no-es-numero' }],
            [],
            [],
        );
        expect(res[0].precio).toBe(0);
    });

    it('stocks inválidos → 0', () => {
        const res = parseIngredientes(
            [{ Nombre: 'X', 'Stock Actual': 'abc', 'Stock Mínimo': null }],
            [],
            [],
        );
        expect(res[0].stockActual).toBe(0);
        expect(res[0].stockMinimo).toBe(0);
    });

    it('unidad por defecto = kg si falta', () => {
        const res = parseIngredientes([{ Nombre: 'X' }], [], []);
        expect(res[0].unidad).toBe('kg');
    });
});
