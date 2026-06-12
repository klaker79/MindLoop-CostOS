/**
 * Detección masiva de alérgenos — botón "✨ Detectar alérgenos".
 *
 * Recorre TODOS los ingredientes, sugiere alérgenos por nombre (detectarAlergenos)
 * y muestra un modal de revisión con los NUEVOS (los que aún no tiene el ingrediente)
 * pre-marcados. El usuario confirma y se guardan en bloque.
 *
 * SEGURIDAD: solo AÑADE alérgenos, NUNCA los quita (no se puede strip un alérgeno
 * en masa por error → health-safe). Para quitar uno, se edita el ingrediente.
 */

import { t } from '@/i18n/index.js';
import { escapeHTML } from '../../utils/helpers.js';
import { ALERGENOS } from './alergenos.js';
import { detectarAlergenos } from './alergenos-deteccion.js';
import { api } from '../../api/client.js';

const ALERGENOS_MAP = new Map(ALERGENOS.map(a => [a.code, a]));
const label = (code) => {
    const a = ALERGENOS_MAP.get(code);
    return `${a ? a.emoji + ' ' : ''}${escapeHTML(t('alergenos:' + code) || code)}`;
};

// Devuelve [{id, nombre, nuevos:[codes]}] de ingredientes con alérgenos por detectar.
function calcularPendientes() {
    const ings = Array.isArray(window.ingredientes) ? window.ingredientes : [];
    const filas = [];
    for (const ing of ings) {
        const existing = Array.isArray(ing.alergenos) ? ing.alergenos : [];
        const sugeridos = detectarAlergenos(ing.nombre);
        const nuevos = sugeridos.filter(c => !existing.includes(c));
        if (nuevos.length) filas.push({ id: ing.id, nombre: ing.nombre, existing, nuevos });
    }
    return filas;
}

export function abrirDeteccionAlergenosBatch() {
    const filas = calcularPendientes();

    if (filas.length === 0) {
        window.showToast?.(t('ingredientes:detect_none') || 'Todos tus ingredientes ya tienen sus alérgenos detectados ✅', 'info');
        return;
    }

    let modal = document.getElementById('modal-deteccion-alergenos');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-deteccion-alergenos';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const filasHtml = filas.map(f => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 8px;font-weight:600;">${escapeHTML(f.nombre)}</td>
            <td style="padding:10px 8px;">
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                    ${f.nuevos.map(code => `
                        <label style="display:inline-flex;align-items:center;gap:5px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:3px 10px;font-size:12px;cursor:pointer;">
                            <input type="checkbox" class="batch-alergeno" data-ing-id="${f.id}" value="${code}" checked style="cursor:pointer;accent-color:#10b981;">
                            ${label(code)}
                        </label>`).join('')}
                </div>
            </td>
        </tr>`).join('');

    modal.innerHTML = `
        <div class="modal-content" style="max-width:760px;display:flex;flex-direction:column;max-height:85vh;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-shrink:0;">
                <h3 style="margin:0;">✨ ${escapeHTML(t('ingredientes:detect_title') || 'Detectar alérgenos')}</h3>
                <button onclick="window.cerrarDeteccionAlergenosBatch()" style="background:none;border:none;font-size:24px;cursor:pointer;">✕</button>
            </div>
            <p style="margin:0 0 12px;color:#64748b;font-size:13px;flex-shrink:0;">
                ${escapeHTML(t('ingredientes:detect_review_hint') || 'Hemos detectado alérgenos en estos ingredientes por su nombre. Revisa, desmarca lo que no aplique y guarda. Solo se AÑADEN — la información de alérgenos es tu responsabilidad.')}
            </p>
            <!-- 🔧 Fix scroll (2026-06-12): la LISTA scrollea por dentro (flex:1 +
                 overflow-y:auto + min-height:0) y cabecera/botones quedan siempre
                 visibles. Antes la tabla quedaba cortada sin scroll con 75 items. -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:16px;flex:1 1 auto;min-height:0;overflow-y:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead><tr style="background:#f1f5f9;position:sticky;top:0;z-index:1;">
                        <th style="text-align:left;padding:10px 8px;background:#f1f5f9;">${escapeHTML(t('ingredientes:title') || 'Ingrediente')}</th>
                        <th style="text-align:left;padding:10px 8px;background:#f1f5f9;">${escapeHTML(t('ingredientes:form_label_allergens') || 'Alérgenos (UE)')}</th>
                    </tr></thead>
                    <tbody>${filasHtml}</tbody>
                </table>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0;">
                <span style="font-size:13px;color:#64748b;">${filas.length} ${escapeHTML(t('ingredientes:title') || 'ingredientes')}</span>
                <div style="display:flex;gap:10px;">
                    <button type="button" onclick="window.cerrarDeteccionAlergenosBatch()" style="background:#e5e7eb;color:#374151;border:none;border-radius:6px;padding:10px 20px;cursor:pointer;">${escapeHTML(t('common:cancel') || 'Cancelar')}</button>
                    <button type="button" id="btn-guardar-deteccion-alergenos" onclick="window.confirmarDeteccionAlergenosBatch()" style="background:#10b981;color:white;border:none;border-radius:6px;padding:10px 20px;font-weight:600;cursor:pointer;">💾 ${escapeHTML(t('ingredientes:detect_save') || 'Guardar todos')}</button>
                </div>
            </div>
        </div>`;
    modal.classList.add('active');
}

export function cerrarDeteccionAlergenosBatch() {
    const modal = document.getElementById('modal-deteccion-alergenos');
    if (modal) modal.classList.remove('active');
}

export async function confirmarDeteccionAlergenosBatch() {
    const btn = document.getElementById('btn-guardar-deteccion-alergenos');
    if (btn?.dataset.loading === '1') return;
    if (btn) { btn.dataset.loading = '1'; btn.disabled = true; btn.style.opacity = '0.6'; }

    // Agrupar por ingrediente los códigos marcados.
    const porIng = new Map();
    document.querySelectorAll('.batch-alergeno:checked').forEach(chk => {
        const id = parseInt(chk.dataset.ingId);
        if (!porIng.has(id)) porIng.set(id, []);
        porIng.get(id).push(chk.value);
    });

    const ingMap = new Map((window.ingredientes || []).map(i => [i.id, i]));
    let ok = 0;
    const fallos = [];

    for (const [id, codes] of porIng.entries()) {
        const ing = ingMap.get(id);
        const existing = Array.isArray(ing?.alergenos) ? ing.alergenos : [];
        // UNIÓN: solo añade, nunca quita lo que ya tenía.
        const final = Array.from(new Set([...existing, ...codes])).sort();
        try {
            await api.updateIngrediente(id, { alergenos: final });
            ok++;
        } catch (err) {
            fallos.push(ing?.nombre || `#${id}`);
            // eslint-disable-next-line no-console
            console.error('Error guardando alérgenos de', id, err);
        }
    }

    cerrarDeteccionAlergenosBatch();
    await window.cargarDatos?.();
    window.renderizarIngredientes?.();

    if (fallos.length === 0) {
        window.showToast?.((t('ingredientes:detect_saved') || 'Alérgenos guardados en {{n}} ingredientes ✅').replace('{{n}}', ok), 'success');
    } else {
        window.showToast?.(`Guardados ${ok}. Fallaron: ${fallos.join(', ')}`, 'warning');
    }

    if (btn) { btn.dataset.loading = '0'; btn.disabled = false; btn.style.opacity = ''; }
}

if (typeof window !== 'undefined') {
    window.abrirDeteccionAlergenosBatch = abrirDeteccionAlergenosBatch;
    window.cerrarDeteccionAlergenosBatch = cerrarDeteccionAlergenosBatch;
    window.confirmarDeteccionAlergenosBatch = confirmarDeteccionAlergenosBatch;
}
