/**
 * KPI deriva de precio — garantía de "sin riesgo".
 *
 * La tarjeta es un AÑADIDO a una home que ya funcionaba. El requisito no es solo
 * que pinte bien cuando hay datos, sino que sea INCAPAZ de estropear la home
 * cuando algo va mal: endpoint caído, respuesta rara, backend antiguo sin ese
 * endpoint, o simplemente que no haya subidas que avisar.
 *
 * En todos esos casos la tarjeta debe quedarse oculta y la función no debe lanzar.
 */

import { jest } from '@jest/globals';

// El módulo importa `cm` de helpers.js, que a su vez tira de i18n para el idioma
// de formato — por eso el mock necesita también getCurrentLanguage.
jest.unstable_mockModule('@/i18n/index.js', () => ({
    t: (k, opts) => (opts?.count !== undefined ? `${k}:${opts.count}` : k),
    getCurrentLanguage: () => 'es'
}));

const { renderKpiDerivaPrecio } = await import('../../modules/dashboard/kpis/deriva-precio.js');

function montarDom() {
    document.body.innerHTML = `
        <div class="dashboard-card" id="card-deriva-precio" style="display: none;">
          <div id="deriva-precio-total"></div>
          <div id="lista-deriva-precio"></div>
        </div>
    `;
    return {
        card: document.getElementById('card-deriva-precio'),
        lista: document.getElementById('lista-deriva-precio'),
        total: document.getElementById('deriva-precio-total')
    };
}

const ALERTA = {
    id: 7, nombre: 'Tomate', unidad: 'kg',
    precio_app: 2.2, media_90d: 2.75, desviacion_pct: 25,
    n_compras_90d: 6, gasto_90d: 480, impacto_mes: 41.25,
    precio_fijado: false, ultima_compra: '2026-07-28'
};

beforeEach(() => {
    window.getApiUrl = () => 'https://lite-api.test/api';
    window.authToken = 'token-de-prueba';
});

afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
});

describe('KPI deriva de precio — a prueba de fallos', () => {
    test('con alertas: muestra la tarjeta, el producto y el sobrecoste mensual', async () => {
        const { card, lista, total } = montarDom();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ventana_dias: 90, alertas: [ALERTA] })
        });

        await renderKpiDerivaPrecio();

        expect(card.style.display).not.toBe('none');
        expect(lista.innerHTML).toContain('Tomate');
        expect(lista.innerHTML).toContain('25.0');
        expect(total.textContent).toContain('41');
    });

    test('sin alertas: la tarjeta permanece oculta (no deja hueco vacío)', async () => {
        const { card } = montarDom();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ventana_dias: 90, alertas: [] })
        });

        await renderKpiDerivaPrecio();

        expect(card.style.display).toBe('none');
    });

    test('endpoint que responde error (404/500): oculta y NO lanza', async () => {
        const { card } = montarDom();
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

        await expect(renderKpiDerivaPrecio()).resolves.toBeUndefined();
        expect(card.style.display).toBe('none');
    });

    test('red caída: oculta y NO lanza', async () => {
        const { card } = montarDom();
        global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

        await expect(renderKpiDerivaPrecio()).resolves.toBeUndefined();
        expect(card.style.display).toBe('none');
    });

    test('respuesta con forma inesperada: oculta y NO lanza', async () => {
        const { card } = montarDom();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ cualquier_cosa: true })
        });

        await expect(renderKpiDerivaPrecio()).resolves.toBeUndefined();
        expect(card.style.display).toBe('none');
    });

    test('sin la tarjeta en el DOM (otra vista): no lanza', async () => {
        document.body.innerHTML = '<div>otra pantalla</div>';
        global.fetch = jest.fn();

        await expect(renderKpiDerivaPrecio()).resolves.toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('marca con 📌 los ingredientes con precio fijado a mano', async () => {
        const { lista } = montarDom();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ alertas: [{ ...ALERTA, precio_fijado: true }] })
        });

        await renderKpiDerivaPrecio();

        expect(lista.innerHTML).toContain('📌');
    });
});
