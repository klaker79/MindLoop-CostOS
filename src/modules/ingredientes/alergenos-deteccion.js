/**
 * Auto-detección de alérgenos por NOMBRE de ingrediente (hostelería ES).
 *
 * Devuelve SUGERENCIAS — el usuario SIEMPRE confirma. Los alérgenos son
 * información de salud y responsabilidad legal del restaurante; esto solo
 * ahorra el trabajo de partir de cero, nunca decide por el usuario.
 *
 * Matching: por PALABRA completa (token === keyword o plural simple) para
 * keywords de una palabra → evita falsos positivos por subcadena
 * (p.ej. "PANGA" NO debe disparar "pan"→gluten). Las keywords con espacio
 * ("pan rallado", "salsa de soja") se buscan como subcadena de la frase.
 * Guardas NEGATIVAS para trampas típicas ("leche de coco" NO es lácteo).
 *
 * Puro y sin dependencias pesadas → testeable.
 */

import { ALERGENOS_CODES } from './alergenos.js';

// Código de alérgeno → palabras/frases clave (en singular, sin acentos).
const DICCIONARIO = {
    gluten: [
        'harina', 'trigo', 'pan', 'pan rallado', 'pasta', 'espagueti', 'macarron',
        'fideo', 'noqui', 'ñoqui', 'pizza', 'masa', 'rebozado', 'empanado', 'empanada',
        'empanadilla', 'croqueta', 'bechamel', 'galleta', 'bizcocho', 'magdalena',
        'cruasan', 'croissant', 'hojaldre', 'brioche', 'gofre', 'tortita', 'crep',
        'cuscus', 'semola', 'espelta', 'centeno', 'cebada', 'avena', 'kamut', 'bulgur',
        'seitan', 'cerveza', 'picos', 'colin', 'tostada', 'biscote', 'salsa de soja',
        'pan de', 'masa madre', 'fideua',
    ],
    crustaceos: [
        'gamba', 'langostino', 'langosta', 'cangrejo', 'cigala', 'necora', 'nécora',
        'bogavante', 'camaron', 'carabinero', 'percebe', 'buey de mar', 'quisquilla',
        'santiaguino', 'krill',
    ],
    huevos: [
        'huevo', 'mayonesa', 'mahonesa', 'tortilla', 'merengue', 'clara de huevo',
        'yema de huevo', 'alioli',
    ],
    pescado: [
        'merluza', 'bacalao', 'atun', 'salmon', 'anchoa', 'boqueron', 'sardina',
        'lubina', 'dorada', 'rape', 'caballa', 'trucha', 'bonito', 'lenguado',
        'rodaballo', 'anguila', 'gallo', 'panga', 'surimi', 'pez espada', 'emperador',
        'mero', 'besugo', 'rosada', 'perca', 'tilapia', 'arenque', 'salmonete',
        'cazon', 'jurel', 'chicharro', 'palometa', 'sepia', 'garum', 'gula',
    ],
    cacahuetes: ['cacahuete', 'cacahué', 'cacahue', 'mani', 'manteca de cacahuete'],
    soja: [
        'soja', 'tofu', 'edamame', 'miso', 'tempeh', 'tamari', 'teriyaki',
        'salsa de soja', 'lecitina de soja', 'brote de soja',
    ],
    lacteos: [
        'leche', 'nata', 'queso', 'mantequilla', 'yogur', 'yogurt', 'mozzarella',
        'parmesano', 'requeson', 'requesón', 'cuajada', 'mascarpone', 'ricotta',
        'kefir', 'burrata', 'gorgonzola', 'cheddar', 'emmental', 'gruyer', 'feta',
        'manchego', 'idiazabal', 'tetilla', 'brie', 'camembert', 'roquefort', 'gouda',
        'helado', 'batido', 'dulce de leche', 'crema de leche', 'cuajo', 'suero',
    ],
    frutos_cascara: [
        'almendra', 'nuez', 'nueces', 'avellana', 'pistacho', 'anacardo', 'macadamia',
        'pacana', 'marcona', 'praline', 'praliné', 'mazapan', 'mazapán', 'turron',
        'turrón', 'crocanti', 'garrapinada', 'nutella',
    ],
    apio: ['apio', 'apionabo'],
    mostaza: ['mostaza', 'dijon'],
    sesamo: ['sesamo', 'sésamo', 'ajonjoli', 'tahini', 'tahin', 'gomasio', 'hummus', 'halva'],
    sulfitos: [
        'vino', 'vinagre', 'mosto', 'sidra', 'cava', 'champan', 'champán', 'jerez',
        'oporto', 'vermut', 'brandy', 'coñac', 'cognac', 'licor', 'orejon', 'pasa',
        'ciruela pasa', 'higo seco', 'datil', 'fruta deshidratada',
    ],
    altramuces: ['altramuz', 'altramuces', 'lupino', 'chocho'],
    moluscos: [
        'almeja', 'mejillon', 'calamar', 'pulpo', 'chipiron', 'chipirón', 'sepia',
        'berberecho', 'navaja', 'ostra', 'vieira', 'zamburina', 'zamburiña', 'chirla',
        'bigaro', 'bígaro', 'canailla', 'cañailla', 'longueiron', 'caracol', 'choco',
        'jibia', 'volandeira', 'pulpitos',
    ],
};

// Frases que ANULAN una sugerencia (trampas comunes). Si el nombre contiene
// alguna, NO se sugiere ese alérgeno aunque haya hecho match por keyword.
const NEGATIVOS = {
    lacteos: [
        'leche de coco', 'leche de almendra', 'leche de almendras', 'leche de avena',
        'leche de soja', 'leche de arroz', 'leche de avellana', 'leche de anacardo',
        'bebida de soja', 'bebida de avena', 'bebida vegetal', 'queso vegano',
        'queso vegetal', 'nata vegetal', 'nata de soja', 'mantequilla de cacahuete',
        'mantequilla de almendra', 'mantequilla vegetal', 'crema de cacahuete',
    ],
};

function normaliza(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// keywords y negativos pre-normalizados (sin acentos) una sola vez.
const DICC_N = Object.fromEntries(
    Object.entries(DICCIONARIO).map(([code, kws]) => [code, kws.map(normaliza)])
);
const NEG_N = Object.fromEntries(
    Object.entries(NEGATIVOS).map(([code, negs]) => [code, negs.map(normaliza)])
);

function matchKeyword(kw, nombreN, toks) {
    if (kw.includes(' ')) return nombreN.includes(kw); // frase → subcadena
    // palabra suelta → token exacto o plural simple (gamba→gambas, mejillon→mejillones)
    return toks.some(tk => tk === kw || tk === kw + 's' || tk === kw + 'es');
}

/**
 * @param {string} nombre - nombre del ingrediente
 * @returns {string[]} códigos de alérgeno SUGERIDOS (únicos, ordenados)
 */
export function detectarAlergenos(nombre) {
    const n = normaliza(nombre);
    if (!n.trim()) return [];
    const toks = n.split(/[^a-z0-9ñ]+/).filter(Boolean);

    const out = new Set();
    for (const [code, kws] of Object.entries(DICC_N)) {
        if (!kws.some(kw => matchKeyword(kw, n, toks))) continue;
        const negs = NEG_N[code];
        if (negs && negs.some(neg => n.includes(neg))) continue; // trampa → no sugerir
        if (ALERGENOS_CODES.has(code)) out.add(code);
    }
    return Array.from(out).sort();
}

export default { detectarAlergenos };
