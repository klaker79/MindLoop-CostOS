/**
 * Onboarding Checklist (4 pasos)
 *
 * Widget persistente que aparece arriba del dashboard mientras el cliente
 * no ha terminado los 4 pasos críticos (proveedores → ingredientes →
 * recetas → pedidos). Cuando el backend marca onboarding_completado_at,
 * desaparece y no vuelve aunque el cliente borre datos (decisión Iker
 * 2026-06-03).
 *
 * Datos: GET /api/onboarding/status → { pasos: [{key, completed_at}], completado: bool }
 *
 * NO dismissable. Se quita solo al completarse el 4º paso.
 * NO reemplaza al OnboardingBanner antiguo — ese sigue mostrándose hasta
 * que el usuario hace el primer paso (basado en heurística de datos), y
 * este toma el relevo en cuanto hay un timestamp de paso seteado.
 */
import { api } from '../../api/client.js';
import { escapeHTML } from '../../utils/helpers.js';

const PASOS = [
    {
        key: 'proveedores',
        label: 'Crea tu primer proveedor',
        descripcion: 'Quiénes te abastecen. 30 segundos.',
        tab: 'proveedores',
        cta: 'Ir a Proveedores'
    },
    {
        key: 'ingredientes',
        label: 'Añade tus ingredientes',
        descripcion: 'Tu inventario base. Puedes importar Excel.',
        tab: 'ingredientes',
        cta: 'Ir a Ingredientes'
    },
    {
        key: 'recetas',
        label: 'Crea tus recetas (escandallo)',
        descripcion: 'Aquí nace el food cost real de cada plato.',
        tab: 'recetas',
        cta: 'Ir a Recetas'
    },
    {
        key: 'pedidos',
        label: 'Registra tu primer pedido',
        descripcion: 'Empieza a trackear compras y precios reales.',
        tab: 'pedidos',
        cta: 'Ir a Pedidos'
    }
];

const CONTAINER_ID = 'onboarding-checklist';

/**
 * Va a la pestaña indicada (usa el patrón global de cambio de tab).
 */
function navigateToTab(tab) {
    if (typeof window.cambiarTab === 'function') {
        window.cambiarTab(tab);
    } else {
        const btn = document.querySelector(`[data-tab="${tab}"]`);
        if (btn) btn.click();
    }
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
}

if (typeof window !== 'undefined') {
    window.__onboardingChecklistNav = navigateToTab;
}

/**
 * Refresca el status desde el backend y re-renderiza si hay cambios.
 * Pensado para llamarse tras crear proveedor/ingrediente/receta/pedido
 * desde cualquier punto de la app.
 */
export async function refreshOnboardingChecklist() {
    const dashboardContent = document.querySelector('.dashboard-content')
        || document.querySelector('#dashboard')
        || document.querySelector('main');
    if (dashboardContent) await renderOnboardingChecklist(dashboardContent);
}

if (typeof window !== 'undefined') {
    window.refreshOnboardingChecklist = refreshOnboardingChecklist;
}

function buildRowHTML(paso, completado, esSiguiente) {
    const checkIcon = completado
        ? '<span style="color:#10b981;font-size:20px;">✓</span>'
        : esSiguiente
            ? '<span style="display:inline-block;width:20px;height:20px;border:2px solid #6d28d9;border-radius:50%;"></span>'
            : '<span style="display:inline-block;width:20px;height:20px;border:2px solid #d1d5db;border-radius:50%;"></span>';

    const textoColor = completado ? '#9ca3af' : esSiguiente ? '#111827' : '#6b7280';
    const textoDecoration = completado ? 'text-decoration: line-through;' : '';
    const fontWeight = esSiguiente ? '600' : '500';

    return `
        <div class="onb-checklist-row" style="
            display:flex;align-items:center;gap:12px;padding:12px 0;
            border-bottom:1px solid #f3f4f6;
        ">
            <div style="flex:0 0 24px;display:flex;justify-content:center;">${checkIcon}</div>
            <div style="flex:1;min-width:0;">
                <div style="color:${textoColor};font-weight:${fontWeight};font-size:15px;${textoDecoration}">
                    ${escapeHTML(paso.label)}
                </div>
                <div style="color:#6b7280;font-size:13px;margin-top:2px;${textoDecoration}">
                    ${escapeHTML(paso.descripcion)}
                </div>
            </div>
            ${esSiguiente ? `
                <button onclick="window.__onboardingChecklistNav('${escapeHTML(paso.tab)}')"
                        style="
                            background:linear-gradient(135deg,#7c3aed,#6d28d9);
                            color:white;border:none;padding:8px 16px;border-radius:8px;
                            font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;
                            box-shadow:0 2px 4px rgba(124,58,237,0.3);
                        ">
                    ${escapeHTML(paso.cta)} →
                </button>
            ` : ''}
        </div>
    `;
}

function buildChecklistHTML(status) {
    const pasos = PASOS.map(def => {
        const stepStatus = (status.pasos || []).find(p => p.key === def.key);
        return { ...def, completado: !!(stepStatus && stepStatus.completed_at) };
    });

    const completados = pasos.filter(p => p.completado).length;
    const total = pasos.length;
    const indiceSiguiente = pasos.findIndex(p => !p.completado);

    const rowsHTML = pasos.map((p, i) =>
        buildRowHTML(p, p.completado, i === indiceSiguiente)
    ).join('');

    return `
        <div id="${CONTAINER_ID}" style="
            background:white;
            border:1px solid #e5e7eb;
            border-radius:16px;
            padding:24px;
            margin-bottom:20px;
            box-shadow:0 2px 8px rgba(0,0,0,0.04);
        ">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                <div style="
                    background:linear-gradient(135deg,#7c3aed,#6d28d9);
                    color:white;width:36px;height:36px;border-radius:10px;
                    display:flex;align-items:center;justify-content:center;
                    font-size:18px;
                ">🚀</div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:16px;color:#111827;">
                        Configura tu restaurante
                    </div>
                    <div style="color:#6b7280;font-size:13px;margin-top:2px;">
                        ${completados} de ${total} pasos completados. Hazlos en orden para que las métricas funcionen.
                    </div>
                </div>
                <div style="
                    background:#f3f4f6;color:#374151;padding:6px 12px;border-radius:999px;
                    font-weight:700;font-size:13px;
                ">${completados}/${total}</div>
            </div>
            <div style="
                width:100%;height:6px;background:#f3f4f6;border-radius:999px;
                overflow:hidden;margin:12px 0 4px;
            ">
                <div style="
                    height:100%;background:linear-gradient(90deg,#7c3aed,#6d28d9);
                    width:${(completados / total * 100).toFixed(0)}%;transition:width 0.4s;
                "></div>
            </div>
            <div style="margin-top:8px;">${rowsHTML}</div>
        </div>
    `;
}

/**
 * Renderiza el checklist al principio del dashboard si el tenant aún no
 * ha completado los 4 pasos. Si ya completó, retira el widget si existía.
 */
export async function renderOnboardingChecklist(parent) {
    if (!parent) return;

    let status;
    try {
        status = await api.getOnboardingStatus();
    } catch (err) {
        // Si el endpoint no existe aún (deploy parcial) o falla, no romper dashboard.
        console.log('[OnboardingChecklist] status no disponible:', err?.message);
        return;
    }

    const existing = document.getElementById(CONTAINER_ID);

    if (status.completado) {
        if (existing) existing.remove();
        return;
    }

    const html = buildChecklistHTML(status);

    if (existing) {
        existing.outerHTML = html;
    } else {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        parent.insertBefore(wrapper.firstElementChild, parent.firstChild);
    }
}
