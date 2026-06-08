/**
 * Iconos SVG inline para las 4 categorías de la matriz BCG.
 *
 * Diseñados para verse bien a tamaños grandes (48-96px) en las cards
 * del dashboard sintético y del modal drill-down, y para empequeñecer
 * sin perder claridad en chips (16-24px).
 *
 * Estilo: trazos limpios, monocromos, color heredado de currentColor.
 * No usan emojis (los emojis no escalan bien y rompen el look editorial).
 */

const ICONOS = {
    // Estrella de 5 puntas
    estrella: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2.5l2.79 5.66 6.21.9-4.5 4.39 1.06 6.2L12 16.77l-5.56 2.88 1.06-6.2-4.5-4.39 6.21-.9L12 2.5z"/>
    </svg>`,
    // Signo de interrogación dentro de un círculo
    puzzle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
    // Caballo: silueta minimalista mirando al frente con melena
    caballo: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.6 4.4c-.7-1.2-2-1.9-3.4-1.9h-1.7L13.4 5h-2.1l-.5 1H8.5C6 6 4 8 4 10.5v2c0 .6.4 1 1 1h1l.6 5.4c.1.7.7 1.1 1.4 1.1h2c.8 0 1.4-.6 1.4-1.4v-3.8c0-.5.5-.8 1-.5l1.5 1 .9 4.3c.1.7.7 1.4 1.5 1.4h1.9c.8 0 1.4-.7 1.3-1.5l-.5-3.8 2.2-2.7c.5-.6.6-1.4.3-2.1l-1-2.5c-.2-.4-.1-.9.2-1.3l.2-.3c.5-.6.5-1.4.1-2.1l-.4-.8z"/>
    </svg>`,
    // Perro: cabeza con orejas caídas
    perro: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 7c0-1.7 1.3-3 3-3 .8 0 1.5.3 2 .8L12 6l2-1.2c.5-.5 1.2-.8 2-.8 1.7 0 3 1.3 3 3v3c0 .8-.3 1.5-.7 2.1l-.3.4v3.5c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4v-3.5l-.3-.4C5.3 11.5 5 10.8 5 10V7zm5 8.5c0 .8.7 1.5 1.5 1.5h1c.8 0 1.5-.7 1.5-1.5S13.3 14 12.5 14h-1c-.8 0-1.5.7-1.5 1.5zM9 9c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm6 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z"/>
    </svg>`
};

const COLORES = {
    estrella: '#10b981', // verde
    puzzle: '#3b82f6',   // azul
    caballo: '#f59e0b',  // naranja
    perro: '#ef4444'     // rojo
};

const LABELS = {
    estrella: 'Estrellas',
    puzzle: 'Puzzles',
    caballo: 'Caballos',
    perro: 'Perros'
};

const DESCRIPCIONES = {
    estrella: 'Mantén y destaca',
    puzzle: 'Promociona más',
    caballo: 'Sube el precio',
    perro: 'Retira o reforma'
};

/**
 * Devuelve el SVG de un icono envuelto en un span con color y tamaño.
 * @param {'estrella'|'puzzle'|'caballo'|'perro'} clave
 * @param {object} [opts]
 * @param {number} [opts.size=48] tamaño en px
 * @param {string} [opts.color] color CSS (default: el del mapa)
 */
export function renderIcono(clave, opts = {}) {
    const svg = ICONOS[clave];
    if (!svg) return '';
    const size = opts.size || 48;
    const color = opts.color || COLORES[clave];
    return `<span style="display:inline-flex;width:${size}px;height:${size}px;color:${color};" aria-label="${LABELS[clave]}">${svg}</span>`;
}

export { ICONOS, COLORES, LABELS, DESCRIPCIONES };
