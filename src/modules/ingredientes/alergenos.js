/**
 * ============================================
 * modules/ingredientes/alergenos.js
 * ============================================
 *
 * Catálogo canónico de los 14 alérgenos de declaración obligatoria en la UE
 * y utilidad para calcular los alérgenos de una receta (unión de los de sus
 * ingredientes, recursivo a través de subrecetas).
 *
 * Contrato (compartido entre agentes — NO cambiar nombres):
 *  - ingredientes.alergenos = JSONB array de CÓDIGOS string (DEFAULT '[]').
 *  - 14 códigos canónicos en minúscula, sin acentos.
 *  - i18nKey = 'alergenos:' + code.
 *
 * Módulo PURO (sin imports pesados) para que sea testeable.
 *
 * @module modules/ingredientes/alergenos
 */

/**
 * Catálogo de los 14 alérgenos UE.
 * @type {{code: string, emoji: string, i18nKey: string}[]}
 */
export const ALERGENOS = [
    { code: 'gluten', emoji: '🌾', i18nKey: 'alergenos:gluten' },
    { code: 'crustaceos', emoji: '🦐', i18nKey: 'alergenos:crustaceos' },
    { code: 'huevos', emoji: '🥚', i18nKey: 'alergenos:huevos' },
    { code: 'pescado', emoji: '🐟', i18nKey: 'alergenos:pescado' },
    { code: 'cacahuetes', emoji: '🥜', i18nKey: 'alergenos:cacahuetes' },
    { code: 'soja', emoji: '🫛', i18nKey: 'alergenos:soja' },
    { code: 'lacteos', emoji: '🥛', i18nKey: 'alergenos:lacteos' },
    { code: 'frutos_cascara', emoji: '🌰', i18nKey: 'alergenos:frutos_cascara' },
    { code: 'apio', emoji: '🥬', i18nKey: 'alergenos:apio' },
    { code: 'mostaza', emoji: '🟡', i18nKey: 'alergenos:mostaza' },
    { code: 'sesamo', emoji: '⚫', i18nKey: 'alergenos:sesamo' },
    { code: 'sulfitos', emoji: '🍷', i18nKey: 'alergenos:sulfitos' },
    { code: 'altramuces', emoji: '🌱', i18nKey: 'alergenos:altramuces' },
    { code: 'moluscos', emoji: '🐚', i18nKey: 'alergenos:moluscos' },
];

/**
 * Conjunto de códigos válidos (lookup O(1)).
 * @type {Set<string>}
 */
export const ALERGENOS_CODES = new Set(ALERGENOS.map(a => a.code));

/**
 * Calcula los alérgenos de una receta: unión ÚNICA y ORDENADA de los alérgenos
 * de cada ingrediente de receta.ingredientes y, si el ingredienteId es > 100000,
 * de la subreceta (id = ingredienteId - 100000) de forma RECURSIVA.
 *
 * Guarda contra ciclos con `_visto` (ids de recetas ya visitadas).
 *
 * @param {Object} receta - Receta con `.ingredientes` (array de líneas con `ingredienteId`).
 * @param {Map<number, Object>} ingMap - Map(id -> ingrediente con `.alergenos` array).
 * @param {Map<number, Object>} recetasMap - Map(id -> receta).
 * @param {Set<number>} [_visto] - Ids de recetas ya visitadas (anti-ciclos).
 * @returns {string[]} Array único y ordenado de códigos de alérgeno.
 */
export function getAlergenosReceta(receta, ingMap, recetasMap, _visto = new Set()) {
    const out = new Set();

    if (!receta || !Array.isArray(receta.ingredientes)) {
        return [];
    }

    for (const linea of receta.ingredientes) {
        if (!linea) continue;
        const ingredienteId = Number(
            linea.ingredienteId ?? linea.ingrediente_id
        );
        if (!Number.isFinite(ingredienteId)) continue;

        if (ingredienteId > 100000) {
            // Subreceta: id real = ingredienteId - 100000.
            const subId = ingredienteId - 100000;
            if (_visto.has(subId)) continue; // anti-ciclo
            _visto.add(subId);
            const sub = recetasMap && recetasMap.get(subId);
            if (sub) {
                for (const code of getAlergenosReceta(sub, ingMap, recetasMap, _visto)) {
                    out.add(code);
                }
            }
        } else {
            const ing = ingMap && ingMap.get(ingredienteId);
            const alergenos = ing && Array.isArray(ing.alergenos) ? ing.alergenos : null;
            if (alergenos) {
                for (const code of alergenos) {
                    if (ALERGENOS_CODES.has(code)) out.add(code);
                }
            }
        }
    }

    return Array.from(out).sort();
}

export default { ALERGENOS, ALERGENOS_CODES, getAlergenosReceta };
