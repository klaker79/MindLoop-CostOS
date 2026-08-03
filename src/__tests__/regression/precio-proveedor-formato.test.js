/**
 * @jest-environment node
 *
 * Guard de regresión — bug JOSEBA (2026-08-03).
 *
 * Al guardar un ingrediente con proveedor, el formulario auto-asocia el proveedor
 * llamando a `POST /ingredients/:id/suppliers`. Mandaba SOLO `precio` con el valor
 * de `ingrediente.precio`, que es **€/FORMATO** — pero ese campo de la tabla es
 * **€/UNIDAD-BASE**, y sin los datos del formato el backend no tenía con qué
 * derivarlo. Después, el desplegable de pedidos multiplica por
 * `cantidad_por_formato` para mostrarlo por formato:
 *
 *     CAJA de 10 l a 23,10 €  →  se mostraba 231,00 €
 *     BOTE de 750 g a 4,45 €  →  se mostraba 3.337,50 €
 *
 * POR QUÉ TARDÓ MESES EN VERSE: el carrito prioriza la ÚLTIMA COMPRA real sobre ese
 * precio. La Nave 5, con historial, casi nunca lo lee (31 de sus 46 filas malas
 * estaban tapadas por sus compras). Solo muerde a los clientes NUEVOS — o sea, a
 * quien acaba de comprar Lite.
 *
 * Este test FALLA si alguien vuelve a mandar el precio a secas.
 */
import { readFileSync } from 'fs';

const src = readFileSync('src/modules/ingredientes/ingredientes-crud.js', 'utf8');

// El bloque de auto-asociación del proveedor, acotado.
const inicio = src.indexOf('Auto-asociar proveedor con precio');
const fin = src.indexOf('Recargar proveedores para tener datos actualizados');
const bloque = src.slice(inicio, fin);

describe('auto-asociar proveedor: manda el formato, no el precio a secas', () => {
    test('el bloque existe (si no, este guard no vigila nada)', () => {
        expect(inicio).toBeGreaterThan(-1);
        expect(fin).toBeGreaterThan(inicio);
    });

    test('envía los tres campos que permiten derivar el precio', () => {
        expect(bloque).toMatch(/formato:/);
        expect(bloque).toMatch(/cantidad_por_formato:/);
        expect(bloque).toMatch(/precio_formato:/);
    });

    // El patrón exacto que causó el bug: `precio: precioProveedor` como ÚNICO dato
    // de precio, sin nada de formato alrededor.
    test('NO manda `precio` suelto cuando el ingrediente usa formato', () => {
        expect(bloque).toMatch(/usaFormato/);
        // La rama sin formato sigue existiendo (ingredientes que se compran por
        // unidad base), pero condicionada.
        expect(bloque).toMatch(/\?\s*\{[\s\S]*precio_formato[\s\S]*\}\s*:\s*\{[\s\S]*precio:/);
    });

    // `cantidad_por_formato` solo viaja si el usuario la editó (undefined = "no
    // cambiar"), así que al EDITAR sin tocar el formato hay que recuperarla del
    // ingrediente existente. Sin este fallback, editar un precio volvía a romperlo.
    test('recupera el formato del ingrediente cuando el form no lo trae', () => {
        expect(bloque).toMatch(/ingPrevio/);
        expect(bloque).toMatch(/cantidad_por_formato\s*\?\?\s*ingPrevio/);
        expect(bloque).toMatch(/formato_compra\s*\?\?\s*ingPrevio/);
    });

    // cpf de 1 significa "se compra por unidad base": no hay formato que derivar.
    test('solo usa la vía de formato si cpf > 1', () => {
        expect(bloque).toMatch(/cpf\s*>\s*1/);
    });
});
