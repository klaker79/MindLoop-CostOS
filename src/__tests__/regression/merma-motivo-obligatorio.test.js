/**
 * @jest-environment node
 *
 * Guard de regresión — hallazgo 2026-08-01.
 *
 * En "Merma Rápida", `Caduco` era la PRIMERA opción del desplegable de motivo, o
 * sea la que el navegador selecciona sola. Si nadie la tocaba, todo se guardaba
 * como caducado.
 *
 * Consecuencia real en La Nave 5: los cuadres de inventario —que se hacen a
 * propósito, para poner el contador a cero— entraron como caducidad. Un único
 * ajuste de −12.991 guantes, otro de −8.001 toallitas, −1.416 panes… El informe
 * de mermas decía que se habían tirado ~4.726 € de verdura en dos meses. Nada de
 * eso se tiró: era stock inflado corrigiéndose. El dato quedaba inservible para
 * decidir compras.
 *
 * Fix: el desplegable arranca SIN motivo y guardar exige elegirlo. Así se separa
 * lo que se tira de verdad de lo que solo es cuadrar ("Error Inventario").
 *
 * Este test FALLA si alguien vuelve a preseleccionar un motivo o se carga la
 * validación.
 */
import { readFileSync } from 'fs';

const src = readFileSync('src/modules/inventario/merma-rapida.js', 'utf8');

describe('Merma Rápida — el motivo no viene preseleccionado', () => {
    test('la primera opción del desplegable es la vacía "elige motivo"', () => {
        // Las dos filas (nueva y la creada desde foto) abren su <select> igual.
        const selects = src.match(/<select class="merma-motivo"[\s\S]{0,400}?<option[^>]*>/g) || [];
        expect(selects.length).toBeGreaterThanOrEqual(2);
        selects.forEach(bloque => {
            const primeraOption = bloque.slice(bloque.lastIndexOf('<option'));
            expect(primeraOption).toMatch(/value=""/);
        });
    });

    test('NINGUNA opción de motivo real viene marcada como selected fija', () => {
        // `selected` solo puede aparecer condicionado (${...}) o en la opción vacía.
        expect(src).not.toMatch(/<option value="Caduco"\s+selected/);
        expect(src).not.toMatch(/<option value="(Invitacion|Accidente|Error Cocina|Error Inventario|Otros)"\s+selected/);
    });

    test('guardar EXIGE motivo: nada de caer en un valor por defecto', () => {
        // El bug volvería si alguien restaura `|| 'Otros'` al leer el motivo.
        expect(src).not.toMatch(/querySelector\('\.merma-motivo'\)\?\.value\s*\|\|\s*'(Otros|Caduco)'/);
        expect(src).toMatch(/faltaMotivo/);
        expect(src).toMatch(/merma_reason_required/);
    });

    test('el aviso de motivo obligatorio existe en los tres idiomas', () => {
        ['es', 'en', 'zh'].forEach(lang => {
            const dict = JSON.parse(readFileSync(`src/i18n/locales/${lang}/inventario.json`, 'utf8'));
            expect(typeof dict.merma_reason_choose).toBe('string');
            expect(dict.merma_reason_choose.length).toBeGreaterThan(0);
            expect(typeof dict.merma_reason_required).toBe('string');
            expect(dict.merma_reason_required.length).toBeGreaterThan(0);
        });
    });
});
