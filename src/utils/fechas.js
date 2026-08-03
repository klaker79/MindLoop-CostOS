/**
 * fechas.js — utilidades de fecha para pedidos y recepciones (puro, sin
 * dependencias → testeable sin DOM ni Vite).
 *
 * Todo va en 'YYYY-MM-DD' y se compara como STRING. Es lexicográficamente
 * correcto y evita las ambigüedades de huso de `new Date('2026-08-03')`, que se
 * parsea como medianoche UTC: en España (UTC+2) son las 2 AM del mismo día, y
 * comparado con "ahora" a las 0 AM local salía "futuro" para hoy mismo.
 * (Ese fue el fix de 2026-05-12 en pedidos-crud.js.)
 */

/**
 * "Hoy" en la zona horaria del usuario, en 'YYYY-MM-DD'.
 *
 * ⚠️ NO usar `new Date().toISOString().split('T')[0]`: eso da la fecha UTC, y a
 * las 00:30 en España devuelve AYER.
 */
export function hoyLocal() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/**
 * Devuelve la fecha en 'YYYY-MM-DD' sin pasar de hoy. Entrada inválida → hoy.
 *
 * Se usa para la fecha de RECEPCIÓN, que es el día en que la mercancía ENTRA y
 * por tanto no puede ser futura: el backend la rechaza (`validators.js`,
 * `allowFuture:false`).
 *
 * ⚠️ POR QUÉ HACE FALTA (Iker, 2026-08-03): desde que un pedido puede
 * programarse a futuro ("pídeme esto para el viernes"), la recepción heredaba
 * `ped.fecha` tal cual y quedaba BLOQUEADA con "Fecha de recepción inválida: La
 * fecha no puede ser futura". Si el pedido era para el viernes y llega hoy, la
 * recepción es HOY; y si lo recibes el viernes, ese día su fecha ya no es futura
 * y se respeta. Las PASADAS no se tocan: el albarán retroactivo debe llegar al
 * Diario con SU fecha.
 *
 * Acepta 'YYYY-MM-DD' y el ISO completo que devuelve la API.
 */
export function acotarAHoy(candidata) {
    const hoy = hoyLocal();
    const soloFecha = String(candidata ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) return hoy;
    return soloFecha > hoy ? hoy : soloFecha;
}
