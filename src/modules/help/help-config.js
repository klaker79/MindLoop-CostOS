/**
 * Mapping de videos/playlists de YouTube por pestaña.
 *
 * Estructura de cada entry:
 *   - { videoId: 'XXX' }      → un solo video. Se embebe directamente.
 *   - { playlistId: 'PL...' } → playlist completa. Se embebe la lista.
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
    proveedores:  { videoId: 'TtcgS67S0W4' },
    ingredientes: { playlistId: 'PLeufMvZTEfBpP-4ininZQDp7L_DgZSuSU' },
    recetas:      { playlistId: 'PLeufMvZTEfBoiD6F_2j_yeEDbPXNZ2VvR' },
    // Pendiente — irán entrando aquí a medida que Iker suba a YouTube:
    // pedidos:        { videoId: '...' },
    // ventas:         { videoId: '...' },
    // inventario:     { videoId: '...' },
    // diario:         { videoId: '...' },
    // analisis:       { videoId: '...' },
    // inteligencia:   { videoId: '...' },
    // horarios:       { videoId: '...' },
    // configuracion:  { videoId: '...' },
};
