/**
 * Empty State con Onboarding
 *
 * Sustituye los empty states "sosos" (icono + texto) por un panel que
 * guía activamente al cliente nuevo: video tutorial embebido + 2 CTAs
 * grandes (importar Excel / empezar manual).
 *
 * Pensado para usarse en pestañas donde un cliente nuevo se queda
 * mirando "tabla vacía" sin saber qué hacer (Ingredientes, Recetas,
 * Proveedores, Pedidos).
 *
 * Reutiliza HELP_VIDEOS para no duplicar la base de vídeos.
 *
 * Uso:
 *   import { renderEmptyStateOnboarding } from '@/components/domain/EmptyStateOnboarding.js';
 *
 *   container.innerHTML = renderEmptyStateOnboarding({
 *       tab: 'ingredientes',
 *       icon: '🥕',
 *       title: 'Empieza con tus ingredientes',
 *       subtitle: 'Es el primer paso. En 90 segundos lo tienes claro.',
 *       videoId: 'seyEDQhSDoU',
 *       primaryCta: { label: '📥 Importar Excel', onclick: 'window.abrirImportIngredientes?.()' },
 *       secondaryCta: { label: '✏️ Empezar manual', onclick: 'window.mostrarFormulario?.()' }
 *   });
 *
 * NOTAS:
 * - El onclick va como string porque se inyecta como HTML inline
 *   (mismo patrón que el resto de la app).
 * - Si no hay videoId, oculta el bloque del video (sigue mostrando CTAs).
 */
import { escapeHTML } from '../../utils/helpers.js';

export function renderEmptyStateOnboarding({
    icon = '👋',
    title = '',
    subtitle = '',
    videoId = null,
    primaryCta = null,
    secondaryCta = null,
    tertiaryHelp = null,
    // 2026-06-06: link a plantilla CSV/Excel descargable para que el
    // cliente nuevo tenga un punto de partida ya con datos de ejemplo.
    // { url: '/templates/x.csv', label: '📥 Descargar plantilla' }
    templateDownload = null,
}) {
    const safeTitle = escapeHTML(title);
    const safeSubtitle = escapeHTML(subtitle);

    // Bloque del video: miniatura YouTube clickable → reemplaza por iframe
    // (lazy load para no bloquear render inicial). Reutiliza el patrón que
    // ya tenemos en help-modal.
    const videoBlock = videoId
        ? `
        <div class="onb-video-wrapper" data-video-id="${escapeHTML(videoId)}">
            <div class="onb-video-thumb" onclick="
                const wrap = this.parentElement;
                const vid = wrap.dataset.videoId;
                wrap.innerHTML = '<iframe src=\\'https://www.youtube.com/embed/' + vid + '?autoplay=1&rel=0\\' frameborder=\\'0\\' allow=\\'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\\' allowfullscreen style=\\'width:100%;height:100%;border:0;border-radius:12px;\\'></iframe>';
            ">
                <img src="https://i.ytimg.com/vi/${escapeHTML(videoId)}/maxresdefault.jpg"
                     alt="Tutorial"
                     onerror="this.src='https://i.ytimg.com/vi/${escapeHTML(videoId)}/hqdefault.jpg'"
                     style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;" />
                <div class="onb-play-btn">▶</div>
            </div>
        </div>`
        : '';

    const primaryHtml = primaryCta
        ? `<button class="onb-cta-primary" onclick="${primaryCta.onclick}">${escapeHTML(primaryCta.label)}</button>`
        : '';
    const secondaryHtml = secondaryCta
        ? `<button class="onb-cta-secondary" onclick="${secondaryCta.onclick}">${escapeHTML(secondaryCta.label)}</button>`
        : '';
    const tertiaryHtml = tertiaryHelp
        ? `<div class="onb-tertiary-help">${escapeHTML(tertiaryHelp)}</div>`
        : '';

    const templateHtml = templateDownload && templateDownload.url
        ? `<div class="onb-template-link">
                <a href="${escapeHTML(templateDownload.url)}" download
                   style="display:inline-flex; align-items:center; gap:6px; color:#6366f1; text-decoration:none; font-weight:600; font-size:13px; padding:8px 14px; border:1px dashed #c7d2fe; border-radius:8px; background:rgba(199,210,254,0.18);">
                    ${escapeHTML(templateDownload.label || '📥 Descargar plantilla de ejemplo')}
                </a>
                <div style="font-size:11px; color:#6b7280; margin-top:6px;">CSV editable en Excel o Google Sheets. Datos de ejemplo realistas — bórralos y mete los tuyos.</div>
           </div>`
        : '';

    return `
    <div class="onb-empty-state">
        <style>
            .onb-empty-state {
                max-width: 880px;
                margin: 24px auto;
                padding: 36px 28px;
                background: linear-gradient(135deg, #fafbff 0%, #f4f0ff 100%);
                border: 1px solid #e5e7f3;
                border-radius: 20px;
                text-align: center;
                box-shadow: 0 4px 24px rgba(67, 56, 202, 0.06);
            }
            .onb-icon {
                font-size: 56px;
                margin-bottom: 14px;
                display: block;
            }
            .onb-title {
                font-size: 24px;
                font-weight: 700;
                color: #1e1b4b;
                margin: 0 0 8px;
                letter-spacing: -0.4px;
            }
            .onb-subtitle {
                font-size: 15px;
                color: #6b7280;
                margin: 0 0 28px;
                line-height: 1.5;
            }
            .onb-video-wrapper {
                position: relative;
                width: 100%;
                max-width: 560px;
                aspect-ratio: 16 / 9;
                margin: 0 auto 28px;
                background: #000;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            }
            .onb-video-thumb {
                position: relative;
                width: 100%;
                height: 100%;
                cursor: pointer;
            }
            .onb-play-btn {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                width: 72px; height: 72px;
                border-radius: 50%;
                background: rgba(255,255,255,0.92);
                color: #1e1b4b;
                font-size: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding-left: 6px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.3);
                transition: transform 0.2s, background 0.2s;
            }
            .onb-video-thumb:hover .onb-play-btn {
                transform: translate(-50%, -50%) scale(1.06);
                background: white;
            }
            .onb-ctas {
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
                margin-bottom: 12px;
            }
            .onb-cta-primary, .onb-cta-secondary {
                padding: 14px 28px;
                font-size: 15px;
                font-weight: 600;
                border-radius: 10px;
                cursor: pointer;
                border: none;
                transition: transform 0.15s, box-shadow 0.15s;
            }
            .onb-cta-primary {
                background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
                color: white;
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            }
            .onb-cta-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
            }
            .onb-cta-secondary {
                background: white;
                color: #4f46e5;
                border: 1.5px solid #c7d2fe;
            }
            .onb-cta-secondary:hover {
                border-color: #4f46e5;
                transform: translateY(-1px);
            }
            .onb-tertiary-help {
                font-size: 13px;
                color: #9ca3af;
                margin-top: 14px;
            }
            @media (max-width: 600px) {
                .onb-title { font-size: 20px; }
                .onb-icon { font-size: 44px; }
                .onb-ctas { flex-direction: column; }
                .onb-cta-primary, .onb-cta-secondary { width: 100%; }
            }
        </style>
        <span class="onb-icon">${escapeHTML(icon)}</span>
        <h2 class="onb-title">${safeTitle}</h2>
        <p class="onb-subtitle">${safeSubtitle}</p>
        ${videoBlock}
        <div class="onb-ctas">
            ${primaryHtml}
            ${secondaryHtml}
        </div>
        ${templateHtml}
        ${tertiaryHtml}
    </div>`;
}
