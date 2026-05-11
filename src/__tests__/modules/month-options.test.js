/**
 * @jest-environment node
 *
 * Unit tests para buildMonthOptions — selector de mes del informe ejecutivo.
 *
 * Bug class que previene: off-by-one en transiciones de año.
 * Si el cliente abre el informe el 1 de enero, "Diciembre" debe ser
 * 2025, no 2026. Y "Recién cerrado" solo en el primer mes cerrado, no
 * en todos.
 *
 * Tests deterministas: el segundo parámetro `now` inyectable evita
 * depender de la fecha real del sistema (que cambia entre CI runs).
 */

import { buildMonthOptions } from '../../modules/chat/month-options.js';

describe('buildMonthOptions', () => {
    test('devuelve 6 opciones (mes en curso + 5 cerrados)', () => {
        const opts = buildMonthOptions('es', new Date('2026-05-11T00:00:00Z'));
        expect(opts).toHaveLength(6);
    });

    test('mes en curso: mes=null y label en idioma correcto', () => {
        const optsEs = buildMonthOptions('es', new Date('2026-05-11T00:00:00Z'));
        expect(optsEs[0]).toMatchObject({ mes: null, label: 'Mes en curso' });
        expect(optsEs[0].sublabel.toLowerCase()).toContain('mayo');

        const optsEn = buildMonthOptions('en', new Date('2026-05-11T00:00:00Z'));
        expect(optsEn[0]).toMatchObject({ mes: null, label: 'Current month' });
        expect(optsEn[0].sublabel.toLowerCase()).toContain('may');
    });

    test('orden: meses descendentes desde el más reciente cerrado', () => {
        // Hoy = 2026-05-11 → primer cerrado abril 2026, hasta diciembre 2025
        const opts = buildMonthOptions('es', new Date('2026-05-11T00:00:00Z'));
        expect(opts[1].mes).toBe('2026-04');
        expect(opts[2].mes).toBe('2026-03');
        expect(opts[3].mes).toBe('2026-02');
        expect(opts[4].mes).toBe('2026-01');
        expect(opts[5].mes).toBe('2025-12');
    });

    test('"Recién cerrado" SOLO en el primer mes cerrado (el más reciente)', () => {
        const optsEs = buildMonthOptions('es', new Date('2026-05-11T00:00:00Z'));
        expect(optsEs[1].sublabel).toBe('Recién cerrado');
        // El resto de cerrados tienen sublabel vacío
        expect(optsEs[2].sublabel).toBe('');
        expect(optsEs[3].sublabel).toBe('');
        expect(optsEs[4].sublabel).toBe('');
        expect(optsEs[5].sublabel).toBe('');

        const optsEn = buildMonthOptions('en', new Date('2026-05-11T00:00:00Z'));
        expect(optsEn[1].sublabel).toBe('Just closed');
        expect(optsEn[2].sublabel).toBe('');
    });

    test('transición de año: enero 2026 → "Recién cerrado" es diciembre 2025', () => {
        const opts = buildMonthOptions('es', new Date('2026-01-15T00:00:00Z'));
        expect(opts[0].mes).toBe(null); // mes en curso = enero 2026
        expect(opts[1].mes).toBe('2025-12');
        expect(opts[2].mes).toBe('2025-11');
        expect(opts[3].mes).toBe('2025-10');
        expect(opts[4].mes).toBe('2025-09');
        expect(opts[5].mes).toBe('2025-08');
        expect(opts[1].sublabel).toBe('Recién cerrado');
    });

    test('transición de año en febrero: diciembre 2025 aparece sin saltar meses', () => {
        const opts = buildMonthOptions('es', new Date('2026-02-15T00:00:00Z'));
        expect(opts[1].mes).toBe('2026-01');
        expect(opts[2].mes).toBe('2025-12');
        expect(opts[3].mes).toBe('2025-11');
    });

    test('formato YYYY-MM correcto: siempre 2 dígitos para el mes', () => {
        const opts = buildMonthOptions('es', new Date('2026-05-11T00:00:00Z'));
        opts.slice(1).forEach(o => {
            expect(o.mes).toMatch(/^\d{4}-\d{2}$/);
        });
    });

    test('labels de meses cerrados empiezan con mayúscula', () => {
        // toLocaleDateString puede devolver "abril 2026" en es-ES (minúscula);
        // la función lo capitaliza para coherencia visual.
        const opts = buildMonthOptions('es', new Date('2026-05-11T00:00:00Z'));
        opts.slice(1).forEach(o => {
            expect(o.label.charAt(0)).toBe(o.label.charAt(0).toUpperCase());
            expect(o.label.charAt(0)).not.toBe(o.label.charAt(0).toLowerCase());
        });
    });

    test('último día visible del mes (mediodía UTC): mes en curso correcto', () => {
        // Mediodía UTC en cualquier timezone cae en el mismo día — evita
        // que ±12h del runner CI metan el cálculo en el día siguiente.
        const opts = buildMonthOptions('es', new Date('2027-02-27T12:00:00Z'));
        expect(opts[1].mes).toBe('2027-01');
        expect(opts[2].mes).toBe('2026-12');
        expect(opts[0].sublabel.toLowerCase()).toContain('febrero');
    });

    test('lang inválido cae a español', () => {
        // 'fr' no soportado → se evalúa como `!== 'en'` → cae a es-ES
        const opts = buildMonthOptions('fr', new Date('2026-05-11T00:00:00Z'));
        expect(opts[0].label).toBe('Mes en curso');
        expect(opts[1].sublabel).toBe('Recién cerrado');
    });

    test('sin parámetro now (default): no crash y devuelve 6 opciones válidas', () => {
        const opts = buildMonthOptions('es');
        expect(opts).toHaveLength(6);
        expect(opts[0].mes).toBeNull();
        opts.slice(1).forEach(o => {
            expect(o.mes).toMatch(/^\d{4}-\d{2}$/);
        });
    });
});
