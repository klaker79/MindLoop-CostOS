/**
 * Catálogo de acciones recomendadas por categoría BCG.
 *
 * Generadas a partir del Excel "Ingeniería de Menús" + buenas prácticas
 * Jack Miller. Texto en castellano, directo, accionable. Sin emojis para
 * mantener el look editorial profesional.
 */

const ACCIONES = {
    estrella: [
        'Mantén la calidad constante: es tu carta de presentación.',
        'Destácalo en el menú principal con maquetación premium.',
        'Considera subir el precio entre 5 y 10% — pequeño impacto en demanda.',
        'Capacita al equipo para que lo recomiende activamente.',
        'Úsalo como contenido para redes sociales y fotos del local.'
    ],
    puzzle: [
        'Mejora la visibilidad en la carta (orden, descripción, foto).',
        'Añade una foto profesional si aún no la tienes.',
        'Forma al personal para que lo recomiende como sugerencia del día.',
        'Crea combos con platos populares para empujar la venta.',
        'Si tras 1-2 meses no mejora, evalúa retirarlo del menú.'
    ],
    caballo: [
        'Trabaja mucho pero deja poco: sube el precio gradualmente (5-10%).',
        'Renegocia con proveedores el coste de los ingredientes principales.',
        'Reduce porciones de forma que no afecte la percepción del cliente.',
        'Sustituye 1-2 ingredientes por alternativas más económicas.',
        'Si tras estos ajustes sigue caballo, evalúa retirarlo.'
    ],
    perro: [
        'Retíralo del menú cuanto antes: ocupa espacio sin aportar valor.',
        'Libera inventario y tiempo de cocina para los Estrella.',
        'Si tiene valor sentimental, déjalo como "especial del día" puntual.',
        'Plantea reformularlo: misma idea, ingredientes y precios distintos.',
        'Redirige los recursos liberados hacia tus platos Estrella.'
    ]
};

/**
 * Devuelve la lista de acciones recomendadas para una clasificación.
 * @param {'estrella'|'puzzle'|'caballo'|'perro'} clave
 * @returns {string[]}
 */
export function accionesRecomendadas(clave) {
    return ACCIONES[clave] || [];
}

export { ACCIONES };
