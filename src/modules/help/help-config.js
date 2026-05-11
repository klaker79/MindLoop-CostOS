/**
 * Mapping de videos/playlists de YouTube por pestaña.
 *
 * Estructuras soportadas (en orden de preferencia):
 *   - { videos: [{ videoId, title? }, ...] } → lista clickable de vídeos
 *     con miniaturas. UX: el usuario elige cuál ver. Si no hay `title`,
 *     se etiqueta como "Vídeo 1", "Vídeo 2"...
 *   - { videoId: 'XXX' }  → un solo vídeo embebido directo (sin lista).
 *   - { playlistId: 'PL...' } → playlist completa embebida (cola de YouTube).
 *
 * Si una pestaña NO está en este mapping, el botón "?" no aparece en
 * su header. Cuando Iker añade un video o crea una playlist nueva,
 * basta con añadir una entrada aquí — la UI se adapta automáticamente
 * sin más cambios.
 *
 * Las claves son los `data-tab` de los botones del nav lateral / tabs
 * horizontales en index.html (ingredientes, recetas, proveedores,
 * pedidos, ventas, inventario, diario, analisis, inteligencia,
 * horarios, configuracion, busqueda).
 */
export const HELP_VIDEOS = {
    proveedores: { videoId: 'TtcgS67S0W4' },
    ingredientes: {
        videos: [
            { videoId: 'seyEDQhSDoU', title: 'Crear ingrediente — paso a paso' },
            { videoId: 'Pv_imHrH8vM', title: 'Editar y configurar formato' }
        ]
    },
    recetas: {
        videos: [
            { videoId: 'tMLDZqzH6fI', title: 'Crear tu primera receta' },
            { videoId: '7RwG2IDA-tU', title: 'Variantes y costes' }
        ]
    },
    ventas: { videoId: 'nfuKIg5CH7s' },
    // Pendiente — irán entrando aquí a medida que Iker suba a YouTube:
    // pedidos:        { videoId: '...' },
    // inventario:     { videoId: '...' },
    // diario:         { videoId: '...' },
    // analisis:       { videoId: '...' },
    // inteligencia:   { videoId: '...' },
    // horarios:       { videoId: '...' },
    // configuracion:  { videoId: '...' },
};
