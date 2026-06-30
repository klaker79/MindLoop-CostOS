/**
 * 🥇 GOLDEN PARITY — Costes de receta (lado FRONTEND).
 *
 * Fixture compartida con el backend: lacaleta-api/tests/unit/golden-parity-costes.test.js
 * ⚠️ SI CAMBIAS UN NÚMERO AQUÍ, CAMBIA EL ESPEJO EN EL OTRO REPO. Los valores
 * esperados están CLAVADOS A MANO (no calculados por el propio código bajo test):
 * si una fórmula cambia en un solo lado, este test (o su espejo) se pone rojo.
 *
 * Cubre los invariantes sellados en la auditoría 2026-06-12:
 *  - Prioridad de precio: precio_medio_compra > precio_medio > precio/cpf, con
 *    semántica > 0 ("0.0000" string de NUMERIC cae al siguiente nivel — fix M1).
 *  - Rendimiento: línea > ingrediente base > 100 (Jack Miller: coste = precio/(rend/100)).
 *  - Subrecetas (id>100000): coste por porción de la subreceta × cantidad.
 *  - División por porciones del lote.
 *  - Ciclo (receta que se contiene a sí misma) corta a 0 — fix M4.
 *  - Diamante (dos caminos a la misma subreceta) SUMA ambos (no corta).
 */
import { jest } from '@jest/globals';
import { getIngredientUnitPrice } from '../../utils/cost-calculator.js';

// recetas-crud → recipeStore → api/client → app-config → import.meta.env (Vite).
// Mismo patrón que recipeStore.test.js: mockear el client ANTES del import dinámico.
jest.unstable_mockModule('../../api/client.js', () => ({
    api: {}, apiClient: {}, default: {},
}));
const { calcularCosteRecetaCompleto } = await import('@modules/recetas/recetas-crud.js');

// ===== FIXTURE (espejo exacto del backend) =====
const INGREDIENTES = [
    // nominal puro: 1.20 €/kg (sin registro en inventario)
    { id: 1, nombre: 'HARINA GOLDEN', precio: 1.20, cantidad_por_formato: null, rendimiento: null },
    // pmc real 17.50 (gana a nominal 30/2=15). Rendimiento base 60%.
    { id: 2, nombre: 'PULPO GOLDEN', precio: 30, cantidad_por_formato: 2, rendimiento: 60 },
    // pmc y precio_medio en "0.0000" (string NUMERIC) → cae a precio/cpf = 4.00 (M1)
    { id: 3, nombre: 'ACEITE GOLDEN', precio: 4, cantidad_por_formato: null, rendimiento: null },
];
const INVENTARIO = [
    { id: 2, precio_medio_compra: '17.5000' },
    { id: 3, precio_medio_compra: '0.0000', precio_medio: '0.0000' },
];
const SUB_AJADA = {
    id: 50, nombre: 'AJADA GOLDEN', porciones: 10,
    ingredientes: [{ ingredienteId: 1, cantidad: 2 }], // 2×1.20 = 2.40 lote → 0.24/porción
};
const RECETA_PRINCIPAL = {
    id: 60, nombre: 'PULPO PRINCIPAL GOLDEN', porciones: 4,
    ingredientes: [
        { ingredienteId: 2, cantidad: 1 },                    // 17.50/0.60 = 29.1667 (rend base 60)
        { ingredienteId: 3, cantidad: 0.5, rendimiento: 100 },// 4.00 × 0.5 = 2.00
        { ingredienteId: 100050, cantidad: 2 },               // sub: 0.24 × 2 = 0.48
    ],
    // Lote = 31.6467 → /4 porciones = 7.9117 → FE redondea a 2 dec = 7.91
};
const RECETA_CICLO = {
    id: 70, nombre: 'CICLO GOLDEN', porciones: 1,
    ingredientes: [
        { ingredienteId: 1, cantidad: 1 },     // 1.20
        { ingredienteId: 100070, cantidad: 5 },// se contiene a sí misma → 0 (anti-ciclo)
    ],
};
const SUB_PUENTE = {
    id: 81, nombre: 'PUENTE GOLDEN', porciones: 1,
    ingredientes: [{ ingredienteId: 100050, cantidad: 1 }], // AJADA vía puente: 0.24
};
const RECETA_DIAMANTE = {
    id: 80, nombre: 'DIAMANTE GOLDEN', porciones: 1,
    ingredientes: [
        { ingredienteId: 100050, cantidad: 1 }, // AJADA directa: 0.24
        { ingredienteId: 100081, cantidad: 1 }, // AJADA vía puente: 0.24 (NO debe cortar)
    ],
};

beforeEach(() => {
    // Arrays NUEVOS en cada test → invalida los caches getIngMap/getInvMap (por referencia)
    window.ingredientes = [...INGREDIENTES];
    window.inventarioCompleto = [...INVENTARIO];
    window.recetas = [SUB_AJADA, RECETA_PRINCIPAL, RECETA_CICLO, SUB_PUENTE, RECETA_DIAMANTE];
});

describe('🥇 Golden parity — getIngredientUnitPrice (prioridad y semántica >0)', () => {
    test('pmc real gana: 17.50', () => {
        expect(getIngredientUnitPrice(INVENTARIO[0], INGREDIENTES[1])).toBeCloseTo(17.50, 4);
    });
    test('pmc "0.0000" (string NUMERIC) cae a precio/cpf: 4.00 — fix M1', () => {
        expect(getIngredientUnitPrice(INVENTARIO[1], INGREDIENTES[2])).toBeCloseTo(4.00, 4);
    });
    test('sin inventario → nominal precio/cpf: 1.20', () => {
        expect(getIngredientUnitPrice(undefined, INGREDIENTES[0])).toBeCloseTo(1.20, 4);
    });
    test('pmc negativo se ignora (cae a la cascada)', () => {
        expect(getIngredientUnitPrice({ precio_medio_compra: '-5' }, INGREDIENTES[0])).toBeCloseTo(1.20, 4);
    });
});

describe('🥇 Golden parity — calcularCosteRecetaCompleto (espejo de getRecipeCostBase)', () => {
    test('subreceta AJADA: 0.24 €/porción', () => {
        expect(calcularCosteRecetaCompleto(SUB_AJADA)).toBeCloseTo(0.24, 2);
    });
    test('receta principal (merma base + M1 + subreceta + porciones): 7.91 €/porción', () => {
        // GOLDEN: lote = 17.50/0.60 + 4.00×0.5 + 0.24×2 = 29.1667 + 2 + 0.48 = 31.6467
        //         por porción = 31.6467 / 4 = 7.9117 → FE 2 dec = 7.91
        // El BE no redondea intermedios: paridad exigida dentro de 1 céntimo.
        expect(calcularCosteRecetaCompleto(RECETA_PRINCIPAL)).toBeCloseTo(7.91, 2);
    });
    test('ciclo (receta que se contiene a sí misma) corta a 0: coste = 1.20 — fix M4', () => {
        expect(calcularCosteRecetaCompleto(RECETA_CICLO)).toBeCloseTo(1.20, 2);
    });
    test('diamante (misma subreceta por dos caminos) SUMA ambos: 0.48', () => {
        expect(calcularCosteRecetaCompleto(RECETA_DIAMANTE)).toBeCloseTo(0.48, 2);
    });
});
