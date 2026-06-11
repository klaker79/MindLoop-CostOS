/**
 * Omnes — Descartes de avisos.
 *
 * El usuario puede "quitar" un aviso del feed. Se guarda en localStorage
 * PREFIJADO POR restauranteId (aislamiento multi-tenant, igual que el chat) y
 * con CADUCIDAD de 7 días: un aviso descartado reaparece a la semana si sigue
 * vigente, para no perder para siempre algo que vuelve a importar (ej. un stock
 * crítico). Los ids de aviso son estables (basados en el id del item).
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function tenantId() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.restauranteId ? String(user.restauranteId) : 'anon';
    } catch {
        return 'anon';
    }
}

function storageKey() {
    return 'omnes_dismissed_' + tenantId();
}

/**
 * Devuelve el mapa { idAviso: timestamp } de descartes vigentes (no caducados).
 * Purga de paso los caducados.
 */
export function loadDismissed(now = Date.now(), key = storageKey()) {
    try {
        const raw = JSON.parse(localStorage.getItem(key) || '{}');
        const out = {};
        let changed = false;
        for (const [id, ts] of Object.entries(raw)) {
            if (typeof ts === 'number' && now - ts < TTL_MS) out[id] = ts;
            else changed = true;
        }
        if (changed) localStorage.setItem(key, JSON.stringify(out));
        return out;
    } catch {
        return {};
    }
}

export function dismissAviso(id, now = Date.now()) {
    if (!id) return;
    const key = storageKey();
    const map = loadDismissed(now, key);
    map[id] = now;
    try {
        localStorage.setItem(key, JSON.stringify(map));
    } catch {
        /* localStorage lleno o no disponible: el descarte no persiste, sin romper */
    }
}

export function isDismissed(id, now = Date.now()) {
    return Object.prototype.hasOwnProperty.call(loadDismissed(now), id);
}

/**
 * Filtra una lista de avisos quitando los descartados vigentes.
 */
export function filtrarVisibles(avisos, now = Date.now()) {
    const map = loadDismissed(now);
    return (avisos || []).filter(a => !Object.prototype.hasOwnProperty.call(map, a.id));
}
