/**
 * Modo LITE — la casa Lite es "lo justo".
 *
 * Lite no lleva chat inteligente: lleva OCR y el informe mensual como
 * entregable de un botón. Es la diferencia por la que la app grande cuesta más.
 *
 * ⚠️ Estos tests cubren la CAPA VISIBLE. El corte de verdad está en el servidor
 * (`CHAT_ENABLED=false` en lite-api, que ni monta el router del chat) y tiene su
 * propio guardián en el backend: `tests/unit/liteSinOmnes.test.js`. Esconder un
 * botón no impide que nadie llame a la API.
 */
import { jest } from '@jest/globals';
import {
    ocultarOmnes,
    construirTarjetaInforme,
    montarInformeMensual,
    abrirInformeMensual,
    initLiteMode
} from '../../modules/lite/lite-mode.js';

/** Recorte del index.html real de la rama lite. */
function montarDom() {
    document.body.innerHTML = `
        <button class="nav-item" data-tab="analisis">Análisis</button>
        <button class="nav-item" data-tab="inteligencia">Omnes</button>
        <button id="tab-btn-inteligencia" class="tab" data-tab="inteligencia">🦉 Omnes</button>
        <div id="tab-inteligencia" class="tab-content">contenido de Omnes</div>
        <div id="chat-addon-container">alta del addon</div>
        <div id="tab-dashboard">
            <div style="margin-top: 16px;">
                <div class="dashboard-card">
                    <div id="dashboard-proveedores-barras"></div>
                </div>
            </div>
        </div>`;
}

beforeEach(montarDom);

describe('Omnes desaparece de la interfaz', () => {
    test('oculta pestaña, botón de menú, contenido y la tarjeta del addon', () => {
        const n = ocultarOmnes();
        expect(n).toBeGreaterThanOrEqual(4);
        expect(document.getElementById('tab-inteligencia').style.display).toBe('none');
        expect(document.getElementById('tab-btn-inteligencia').style.display).toBe('none');
        expect(document.getElementById('chat-addon-container').style.display).toBe('none');
        document.querySelectorAll('[data-tab="inteligencia"]').forEach(el => {
            expect(el.style.display).toBe('none');
        });
    });

    test('no toca las demás pestañas', () => {
        ocultarOmnes();
        expect(document.querySelector('[data-tab="analisis"]').style.display).toBe('');
    });

    // Se oculta también para lectores de pantalla: un botón invisible pero
    // anunciado sigue siendo una puerta que no lleva a ningún sitio.
    test('marca aria-hidden', () => {
        ocultarOmnes();
        expect(document.getElementById('tab-inteligencia').getAttribute('aria-hidden')).toBe('true');
    });

    test('sin elementos de Omnes no revienta (HTML de otra rama)', () => {
        document.body.innerHTML = '<div>nada</div>';
        expect(ocultarOmnes()).toBe(0);
    });
});

describe('el informe mensual: un botón, no un chat', () => {
    test('la tarjeta lleva su botón', () => {
        const card = construirTarjetaInforme();
        expect(card.querySelector('#btn-lite-informe')).not.toBeNull();
        // Nada de caja de texto ni conversación: es un entregable.
        expect(card.querySelector('input, textarea')).toBeNull();
    });

    test('se monta en el Dashboard, detrás de Top Proveedores', () => {
        expect(montarInformeMensual()).toBe(true);
        expect(document.getElementById('lite-informe-mensual')).not.toBeNull();
    });

    test('es idempotente: no duplica la tarjeta', () => {
        montarInformeMensual();
        expect(montarInformeMensual()).toBe(false);
        expect(document.querySelectorAll('#lite-informe-mensual')).toHaveLength(1);
    });

    // Si el dashboard cambia de estructura, mejor sin tarjeta que con una
    // tarjeta suelta en mitad de la página.
    test('sin anclaje no monta nada', () => {
        document.body.innerHTML = '<div>otro dashboard</div>';
        expect(montarInformeMensual()).toBe(false);
        expect(document.getElementById('lite-informe-mensual')).toBeNull();
    });

    test('abre la ruta NUEVA del informe, no la del chat', () => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        window.getApiUrl = () => 'https://lite-api.mindloop.cloud/api';
        abrirInformeMensual();
        const url = open.mock.calls[0][0];
        expect(url).toContain('/informes/mensual/html');
        expect(url).not.toContain('/chat/');
        open.mockRestore();
    });

    test('el botón dispara la apertura', () => {
        const open = jest.spyOn(window, 'open').mockImplementation(() => null);
        montarInformeMensual();
        document.getElementById('btn-lite-informe').click();
        expect(open).toHaveBeenCalled();
        open.mockRestore();
    });
});

describe('initLiteMode', () => {
    test('hace las dos cosas de una vez', () => {
        initLiteMode();
        expect(document.getElementById('tab-inteligencia').style.display).toBe('none');
        expect(document.getElementById('lite-informe-mensual')).not.toBeNull();
    });

    // Si el modo Lite fallara, la app tiene que seguir cargando.
    test('no propaga errores', () => {
        document.body.innerHTML = '';
        expect(() => initLiteMode()).not.toThrow();
    });
});
