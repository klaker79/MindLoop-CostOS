/**
 * Tests de la sección "Personal extra (por horas)".
 *  (a) El subtotal mostrado = suma de los `total` de las filas dadas.
 *  (b) Un `nombre` con payload XSS se renderiza ESCAPADO (no inyecta HTML).
 *
 * Mockeamos el módulo de API (../../api/client.js) — igual que hacen otros
 * tests del repo con jest.unstable_mockModule — para no arrastrar
 * import.meta.env ni hacer fetch real.
 */
import { jest } from '@jest/globals';

const getPersonalExtra = jest.fn();
const crearPersonalExtra = jest.fn();
const borrarPersonalExtra = jest.fn();

jest.unstable_mockModule('../../api/client.js', () => ({
    api: { getPersonalExtra, crearPersonalExtra, borrarPersonalExtra },
    apiClient: {},
    default: {},
}));

const { renderPersonalExtra } = await import('./personal-extra.js');

describe('renderPersonalExtra', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '<div id="cont"></div>';
    });

    test('(a) el subtotal mostrado = suma de los total de las filas', async () => {
        getPersonalExtra.mockResolvedValue([
            { id: 1, fecha: '2026-06-01', nombre: 'Ana', horas: 4, precio_hora: 10, total: 40 },
            { id: 2, fecha: '2026-06-02', nombre: 'Leo', horas: 3, precio_hora: 12, total: 36 },
            { id: 3, fecha: '2026-06-03', nombre: '', horas: 2, precio_hora: 11, total: 22 },
        ]);

        const cont = document.getElementById('cont');
        await renderPersonalExtra(cont, { desde: '2026-06-01', hasta: '2026-06-30' });

        const subtotalEl = document.getElementById('pe-subtotal');
        expect(subtotalEl).not.toBeNull();
        // 40 + 36 + 22 = 98
        const num = parseFloat(subtotalEl.textContent.replace(/[^0-9.,-]/g, '').replace(',', '.'));
        expect(num).toBeCloseTo(98, 2);
    });

    test('(c) la fecha ISO se muestra como YYYY-MM-DD (sin la hora) y horas sin €', async () => {
        getPersonalExtra.mockResolvedValue([
            { id: 7, fecha: '2026-06-24T00:00:00.000Z', nombre: 'Iker', horas: 10, precio_hora: 15, total: 150 },
        ]);

        const cont = document.getElementById('cont');
        await renderPersonalExtra(cont, { desde: '2026-06-01', hasta: '2026-06-30' });

        const row = cont.querySelector('.pe-row');
        expect(row).not.toBeNull();
        // Fecha limpia, sin el "T00:00..." que desbordaba y pisaba el nombre.
        expect(row.textContent).toContain('2026-06-24');
        expect(row.textContent).not.toContain('T00:00');
        // Las horas (10) NO llevan símbolo de € (sí lo llevan €/h y total).
        const celdas = row.querySelectorAll('span');
        const horasTxt = celdas[2].textContent; // fecha, nombre, HORAS, €/h, total
        expect(horasTxt).not.toContain('€');
        expect(horasTxt.replace(',', '.')).toContain('10');
    });

    test('(b) un nombre con payload XSS se renderiza escapado (no inyecta HTML)', async () => {
        getPersonalExtra.mockResolvedValue([
            { id: 99, fecha: '2026-06-01', nombre: '<img src=x onerror="alert(1)">', horas: 1, precio_hora: 10, total: 10 },
        ]);

        const cont = document.getElementById('cont');
        await renderPersonalExtra(cont, { desde: '2026-06-01', hasta: '2026-06-30' });

        // No debe existir un <img> inyectado en el DOM.
        expect(cont.querySelector('img')).toBeNull();
        // El texto debe aparecer literal (escapado) en el HTML serializado.
        expect(cont.innerHTML).toContain('&lt;img');
    });
});
