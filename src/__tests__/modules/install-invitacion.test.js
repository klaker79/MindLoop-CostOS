/**
 * Invitación a instalar la PWA — reglas de "no molestar".
 *
 * Un cartel que sale cuando no debe es peor que no tenerlo: aparece encima de
 * la app recién abierta, o le insiste a alguien que ya la instaló. Estos tests
 * fijan las cuatro condiciones y el detalle de iOS, que es donde más fácil se
 * rompe (Chrome en iPhone también dice "Safari" en su user agent).
 */
import { debeInvitar, esIosSafari } from '@modules/mobile/mobile-install.js';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = 1_800_000_000_000;

describe('debeInvitar — cuándo se enseña el cartel', () => {
    const base = { instalada: false, esMovil: true, descartadaEn: null, ahora: AHORA };

    test('móvil, no instalada y nunca descartada → se invita', () => {
        expect(debeInvitar(base)).toBe(true);
    });

    test('ya instalada → nunca se invita', () => {
        expect(debeInvitar({ ...base, instalada: true })).toBe(false);
    });

    test('escritorio → nunca se invita (allí no hay pantalla de inicio)', () => {
        expect(debeInvitar({ ...base, esMovil: false })).toBe(false);
    });

    test('descartada hace 3 días → sigue callado', () => {
        expect(debeInvitar({ ...base, descartadaEn: String(AHORA - 3 * DIA) })).toBe(false);
    });

    test('descartada hace 29 días → sigue callado (el silencio es de 30)', () => {
        expect(debeInvitar({ ...base, descartadaEn: String(AHORA - 29 * DIA) })).toBe(false);
    });

    test('descartada hace 31 días → vuelve a ofrecerse', () => {
        expect(debeInvitar({ ...base, descartadaEn: String(AHORA - 31 * DIA) })).toBe(true);
    });

    test('valor corrupto en localStorage → se invita, no se queda mudo para siempre', () => {
        expect(debeInvitar({ ...base, descartadaEn: 'ayer' })).toBe(true);
    });

    test('instalada gana sobre todo lo demás', () => {
        expect(debeInvitar({ instalada: true, esMovil: true, descartadaEn: null, ahora: AHORA })).toBe(false);
    });
});

describe('esIosSafari — a quién le damos las instrucciones manuales', () => {
    const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const CHROME_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1';
    const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
    const SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

    test('Safari en iPhone → sí (es el único sitio donde hace falta explicarlo)', () => {
        expect(esIosSafari(SAFARI_IPHONE)).toBe(true);
    });

    test('Chrome en iPhone → no: su menú es otro, las instrucciones de Safari confundirían', () => {
        expect(esIosSafari(CHROME_IPHONE)).toBe(false);
    });

    test('Chrome en Android → no: ahí hay diálogo nativo, no instrucciones', () => {
        expect(esIosSafari(CHROME_ANDROID)).toBe(false);
    });

    test('Safari en Mac → no es iOS', () => {
        expect(esIosSafari(SAFARI_MAC)).toBe(false);
    });
});
