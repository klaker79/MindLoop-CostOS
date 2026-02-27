/**
 * Onboarding Banner Component
 * Shows a welcome banner for new restaurants with setup guidance
 * Dismissible — stored in localStorage per restaurant
 */
import { t } from '@/i18n/index.js';

const STORAGE_KEY = 'onboarding_dismissed';

/**
 * Check if the restaurant is "new" (few ingredients beyond template, no recipes, no sales)
 */
function isNewRestaurant() {
    const ingredientes = window.ingredientes || [];
    const recetas = window.recetas || [];
    const ventas = window.ventas || [];

    // If they have recipes or sales, they're not new
    if (recetas.length > 5 || ventas.length > 0) return false;

    // If they only have template ingredients (<=30) and no custom ones
    const hasCustomIngredients = ingredientes.some(i => parseFloat(i.precio_actual || i.precio) > 0);
    if (ingredientes.length > 35 || hasCustomIngredients) return false;

    return true;
}

/**
 * Check if banner was dismissed for this restaurant
 */
function isDismissed() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const key = `${STORAGE_KEY}_${user.restauranteId || 'default'}`;
        return localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
}

/**
 * Dismiss the banner permanently for this restaurant
 */
function dismissBanner() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const key = `${STORAGE_KEY}_${user.restauranteId || 'default'}`;
        localStorage.setItem(key, 'true');
    } catch { /* ignore */ }

    const banner = document.getElementById('onboarding-banner');
    if (banner) {
        banner.style.transition = 'opacity 0.3s, transform 0.3s';
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-10px)';
        setTimeout(() => banner.remove(), 300);
    }
}

/**
 * Render the onboarding banner into a container
 */
export function renderOnboardingBanner(container) {
    if (!container) return;
    if (isDismissed() || !isNewRestaurant()) return;

    // Remove existing banner if re-rendering
    const existing = document.getElementById('onboarding-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'onboarding-banner';
    banner.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
            border-radius: 16px;
            padding: 28px 32px;
            margin-bottom: 20px;
            position: relative;
            overflow: hidden;
            color: white;
            box-shadow: 0 4px 24px rgba(67, 56, 202, 0.25);
        ">
            <!-- Decorative circles -->
            <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,0.05);"></div>
            <div style="position: absolute; bottom: -20px; right: 60px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.03);"></div>

            <!-- Close button -->
            <button id="onboarding-dismiss" style="
                position: absolute; top: 12px; right: 16px;
                background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.6);
                width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
                font-size: 16px; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.2)';this.style.color='white'"
               onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.6)'"
            >&times;</button>

            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 44px; height: 44px; background: rgba(255,255,255,0.12); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px;">
                    ${String.fromCodePoint(0x1F680)}
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">${t('onboarding:welcome_title', { defaultValue: 'Bienvenido a CostOS' })}</h3>
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.6);">${t('onboarding:welcome_subtitle', { defaultValue: 'Tu restaurante est\u00e1 listo. Elige c\u00f3mo empezar.' })}</p>
                </div>
            </div>

            <!-- Two options -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 8px;">

                <!-- Option 1: Self-service -->
                <div id="onboarding-self" style="
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 12px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.14)';this.style.borderColor='rgba(255,255,255,0.25)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='rgba(255,255,255,0.12)'"
                >
                    <div style="font-size: 28px; margin-bottom: 10px;">${String.fromCodePoint(0x1F4DD)}</div>
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">${t('onboarding:self_title', { defaultValue: 'Lo hago yo' })}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5;">
                        ${t('onboarding:self_desc', { defaultValue: 'Empieza a\u00f1adiendo tus ingredientes, proveedores y recetas. Ya tienes una plantilla b\u00e1sica cargada.' })}
                    </div>
                    <div style="margin-top: 14px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #a5b4fc;">
                        ${t('onboarding:self_cta', { defaultValue: 'Empezar ahora' })} <span style="font-size: 16px;">${String.fromCodePoint(0x2192)}</span>
                    </div>
                </div>

                <!-- Option 2: Assisted setup -->
                <div id="onboarding-assisted" style="
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 12px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                " onmouseover="this.style.background='rgba(255,255,255,0.14)';this.style.borderColor='rgba(255,255,255,0.25)'"
                   onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='rgba(255,255,255,0.12)'"
                >
                    <!-- Popular badge -->
                    <div style="
                        position: absolute; top: -1px; right: 16px;
                        background: linear-gradient(135deg, #f59e0b, #d97706);
                        color: #1e1b4b; font-size: 10px; font-weight: 700;
                        padding: 3px 10px; border-radius: 0 0 6px 6px;
                        text-transform: uppercase; letter-spacing: 0.5px;
                    ">Popular</div>
                    <div style="font-size: 28px; margin-bottom: 10px;">${String.fromCodePoint(0x1F91D)}</div>
                    <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">${t('onboarding:assisted_title', { defaultValue: 'Setup Asistido' })}</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5;">
                        ${t('onboarding:assisted_desc', { defaultValue: 'Nuestro equipo configura tus ingredientes, recetas y escandallos. T\u00fa solo env\u00edanos tu carta.' })}
                    </div>
                    <div style="margin-top: 14px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #fbbf24;">
                        ${t('onboarding:assisted_cta', { defaultValue: 'Solicitar setup' })} <span style="font-size: 16px;">${String.fromCodePoint(0x2192)}</span>
                    </div>
                </div>
            </div>

            <!-- Progress hint -->
            <div style="margin-top: 16px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.4);">
                <div style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 8px;">i</div>
                ${t('onboarding:hint', { defaultValue: 'Puedes cerrar esto y volver cuando quieras desde Configuraci\u00f3n.' })}
            </div>
        </div>
    `;

    container.insertBefore(banner, container.firstChild);

    // Event listeners
    document.getElementById('onboarding-dismiss')?.addEventListener('click', dismissBanner);

    document.getElementById('onboarding-self')?.addEventListener('click', () => {
        dismissBanner();
        // Navigate to ingredients tab
        window.cambiarTab?.('ingredientes');
    });

    document.getElementById('onboarding-assisted')?.addEventListener('click', () => {
        // Open WhatsApp or contact form
        window.open('https://wa.me/34602629013?text=Hola!%20Quiero%20el%20Setup%20Asistido%20para%20mi%20restaurante', '_blank');
    });
}
