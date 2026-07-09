/**
 * ============================================
 * modules/recetas/recetas-alergenos.js
 * ============================================
 *
 * UI del bloque "Alérgenos" dentro del editor de recetas (Opción A 2026-07-09).
 *
 * Regla de negocio (salud/legal): la receta HEREDA los alérgenos de sus
 * ingredientes/subrecetas (solo lectura, no se pueden quitar) y el usuario puede
 * AÑADIR extras (trazas / contaminación cruzada / emplatado) → recetas.alergenos_extra.
 * Lista final a declarar = heredados ∪ extra. Ver [[project_alergenos_2026_06_11]].
 *
 * Este módulo NO calcula precios ni toca stock: solo pinta casillas y chips y
 * devuelve los códigos extra marcados para el payload de guardado.
 *
 * @module modules/recetas/recetas-alergenos
 */

import { t } from '@/i18n/index.js';
import { ALERGENOS, getAlergenosHeredados } from '../ingredientes/alergenos.js';

/** Traduce un código de alérgeno a su nombre legible (fallback = código). */
function nombreAlergeno(code) {
    const key = 'alergenos:' + code;
    const txt = t(key);
    return txt === key ? code : txt;
}

/**
 * Lee las líneas de ingredientes del formulario abierto y construye una receta
 * mínima `{ ingredientes: [...] }` compatible con getAlergenosHeredados. Mismo
 * criterio que guardarReceta/calcularCosteReceta (subreceta = "rec_<id>").
 */
function recetaDesdeFormulario() {
    const items = document.querySelectorAll('#lista-ingredientes-receta .ingrediente-item');
    const ingredientes = [];
    items.forEach(item => {
        const select = item.querySelector('select');
        if (!select || !select.value) return;
        if (select.value.startsWith('rec_')) {
            const recetaId = parseInt(select.value.replace('rec_', ''));
            if (Number.isFinite(recetaId)) ingredientes.push({ ingredienteId: 100000 + recetaId });
        } else {
            const ingId = parseInt(select.value);
            if (Number.isFinite(ingId)) ingredientes.push({ ingredienteId: ingId });
        }
    });
    return { ingredientes };
}

/**
 * Pinta las 14 casillas de "añadir extra" dentro de #alergenos-extra-checks.
 * Idempotente: si ya están pintadas, no las duplica.
 */
export function renderAlergenosExtraCheckboxes() {
    const cont = document.getElementById('alergenos-extra-checks');
    if (!cont || cont.dataset.rendered === '1') return;
    cont.innerHTML = ALERGENOS.map(a => `
        <label class="alergeno-extra-label" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid var(--border-color,#d1d5db);border-radius:8px;cursor:pointer;font-size:13px;">
            <input type="checkbox" class="alergeno-extra-check" value="${a.code}">
            <span>${a.emoji} ${nombreAlergeno(a.code)}</span>
        </label>
    `).join('');
    cont.dataset.rendered = '1';
}

/**
 * Recalcula los alérgenos HEREDADOS a partir de las líneas actuales del
 * formulario y refresca la UI:
 *  - pinta los chips heredados (solo lectura) en #alergenos-heredados-chips,
 *  - en las casillas extra, las que ya están heredadas se marcan y se
 *    deshabilitan (no se puede "añadir" lo que ya viene del ingrediente).
 * Se llama al abrir/editar y en cada cambio de ingredientes (calcularCosteReceta).
 */
export function actualizarAlergenosReceta() {
    const chipsCont = document.getElementById('alergenos-heredados-chips');
    if (!chipsCont) return; // el bloque no está en el DOM (otra vista)

    const ingredientes = window.ingredientes || [];
    const recetas = window.recetas || [];
    const ingMap = new Map(ingredientes.map(i => [i.id, i]));
    const recetasMap = new Map(recetas.map(r => [r.id, r]));

    const heredados = getAlergenosHeredados(recetaDesdeFormulario(), ingMap, recetasMap);
    const setHeredados = new Set(heredados);

    // Chips heredados (solo lectura).
    if (heredados.length === 0) {
        chipsCont.innerHTML = `<span style="font-size:13px;color:var(--text-secondary,#6b7280);">${t('recetas:alergenos_ninguno_heredado')}</span>`;
    } else {
        chipsCont.innerHTML = heredados.map(code => {
            const a = ALERGENOS.find(x => x.code === code);
            const emoji = a ? a.emoji : '';
            return `<span class="alergeno-chip-heredado" style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:var(--bg-secondary,#f3f4f6);border-radius:999px;font-size:13px;margin:2px;">${emoji} ${nombreAlergeno(code)}</span>`;
        }).join('');
    }

    // Casillas extra: deshabilitar (y marcar) las que ya vienen heredadas.
    document.querySelectorAll('#alergenos-extra-checks .alergeno-extra-check').forEach(chk => {
        const label = chk.closest('.alergeno-extra-label');
        if (setHeredados.has(chk.value)) {
            chk.checked = true;
            chk.disabled = true;
            if (label) { label.style.opacity = '0.55'; label.title = t('recetas:alergenos_ya_heredado'); }
        } else {
            chk.disabled = false;
            if (label) { label.style.opacity = '1'; label.title = ''; }
        }
    });
}

/**
 * Devuelve los códigos EXTRA marcados por el usuario (excluye los heredados, que
 * están deshabilitados). Es lo que se guarda en recetas.alergenos_extra.
 * @returns {string[]}
 */
export function getAlergenosExtraSeleccionados() {
    const out = [];
    document.querySelectorAll('#alergenos-extra-checks .alergeno-extra-check').forEach(chk => {
        if (chk.checked && !chk.disabled) out.push(chk.value);
    });
    return out;
}

/**
 * Pre-marca las casillas extra a partir de un array guardado (receta.alergenos_extra).
 * Debe llamarse DESPUÉS de renderAlergenosExtraCheckboxes y ANTES de
 * actualizarAlergenosReceta (que deshabilitará las heredadas).
 * @param {string[]} codes
 */
export function precargarAlergenosExtra(codes) {
    const set = new Set(Array.isArray(codes) ? codes : []);
    document.querySelectorAll('#alergenos-extra-checks .alergeno-extra-check').forEach(chk => {
        chk.checked = set.has(chk.value);
    });
}

/** Reset del bloque (nueva receta): desmarca todo y limpia estado. */
export function resetAlergenosExtra() {
    document.querySelectorAll('#alergenos-extra-checks .alergeno-extra-check').forEach(chk => {
        chk.checked = false;
        chk.disabled = false;
        const label = chk.closest('.alergeno-extra-label');
        if (label) { label.style.opacity = '1'; label.title = ''; }
    });
}

export default {
    renderAlergenosExtraCheckboxes,
    actualizarAlergenosReceta,
    getAlergenosExtraSeleccionados,
    precargarAlergenosExtra,
    resetAlergenosExtra,
};
