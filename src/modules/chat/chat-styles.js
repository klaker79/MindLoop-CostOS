/**
 * Chat Widget Styles
 * CSS styles for the MindLoop CostOS chat widget
 */

/**
 * Creates and injects CSS styles for the chat widget
 */
export function createChatStyles() {
    // Check if already injected
    if (document.getElementById('chat-widget-styles')) return;

    const style = document.createElement('style');
    style.id = 'chat-widget-styles';
    style.textContent = `
        /* Chat Button */
        .chat-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: #fff;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 9999;
        }

        .chat-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(124, 58, 237, 0.5);
        }

        .chat-fab-owl {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        /* Globo de invitación junto al FAB */
        .chat-fab-bubble {
            position: fixed;
            bottom: 40px;
            right: 96px;
            max-width: 230px;
            background: #fff;
            color: #1e293b;
            padding: 11px 30px 11px 15px;
            border-radius: 14px;
            box-shadow: 0 10px 34px rgba(0,0,0,0.28);
            font-size: 0.86rem;
            font-weight: 600;
            line-height: 1.3;
            opacity: 0;
            transform: translateX(10px) scale(0.95);
            pointer-events: none;
            transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
            z-index: 9999;
        }
        .chat-fab-bubble.show {
            opacity: 1;
            transform: translateX(0) scale(1);
            pointer-events: auto;
            cursor: pointer;
        }
        .chat-fab-bubble::after {
            content: '';
            position: absolute;
            right: -7px;
            bottom: 16px;
            border: 7px solid transparent;
            border-left-color: #fff;
            border-right: 0;
        }
        .chat-fab-bubble-x {
            position: absolute;
            top: 5px;
            right: 7px;
            background: transparent;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            font-size: 11px;
            line-height: 1;
            padding: 2px;
        }
        .chat-fab-bubble-x:hover { color: #475569; }

        .chat-fab svg {
            width: 28px;
            height: 28px;
            fill: white;
            transition: transform 0.3s;
        }

        .chat-fab.active svg {
            transform: rotate(90deg);
        }
        
        .chat-fab .notification-dot {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 12px;
            height: 12px;
            background: #10b981;
            border-radius: 50%;
            border: 2px solid white;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        /* Chat Window */
        .chat-window {
            position: fixed;
            bottom: 100px;
            right: 24px;
            /* 🔧 Responsive (2026-06-13): antes 450×550 FIJO → en pantallas
               pequeñas o con escalado del SO (Windows 125-150%) se veía enorme
               o se salía. Con min()/viewport se ve igual en Mac/Windows/móvil
               sin tocar nada de la lógica del chat. */
            width: min(450px, calc(100vw - 32px));
            /* dvh = dynamic viewport height: con el teclado abierto en móvil el
               viewport se encoge y la ventana (y su input) NO quedan tapados.
               Fallback a vh para navegadores sin dvh. */
            height: min(550px, calc(100vh - 140px));
            height: min(550px, calc(100dvh - 140px));
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            overflow: visible;
            z-index: 9998;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .chat-window.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }
        
        /* Chat Header */
        .chat-header {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            padding: 20px;
            color: white;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .chat-header-avatar {
            width: 45px;
            height: 45px;
            background: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            overflow: hidden;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }
        
        .chat-header-info h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
        }
        
        .chat-header-info p {
            margin: 4px 0 0;
            font-size: 12px;
            opacity: 0.9;
        }
        
        .chat-header-status {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            margin-left: auto;
            animation: pulse 2s infinite;
        }
        
        .chat-close-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }
        
        .chat-close-btn:hover {
            background: rgba(255,255,255,0.3);
        }
        
        .chat-close-btn svg {
            width: 18px;
            height: 18px;
            fill: white;
        }
        
        /* Chat Messages */
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            overflow-x: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: #f8fafc;
        }
        
        .chat-message {
            display: flex;
            gap: 10px;
            max-width: 92%;
            animation: messageIn 0.3s ease-out;
            min-width: 0;
        }
        
        @keyframes messageIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .chat-message.user {
            align-self: flex-end;
            flex-direction: row-reverse;
        }
        
        .chat-message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
        }
        
        .chat-message.user .chat-message-avatar {
            background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
        }

        /* Avatar del bot con la foto del búho azul: círculo blanco, foto entera */
        .chat-message-avatar.bot-omnes {
            background: #fff;
            overflow: hidden;
            padding: 2px;
            box-sizing: border-box;
        }
        .chat-message-avatar.bot-omnes img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 50%;
            display: block;
        }
        
        .chat-message-content {
            background: white;
            padding: 12px 16px;
            border-radius: 18px;
            border-top-left-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            font-size: 14px;
            line-height: 1.5;
            color: #1e293b;
            word-wrap: break-word;
            overflow-wrap: break-word;
            word-break: break-word;
            white-space: normal;
            max-width: 100%;
            min-width: 0;
            overflow-x: auto;
            overflow-y: hidden;
        }
        
        /* Markdown Tables in Chat */
        .chat-table-wrapper {
            overflow-x: auto !important;
            margin: 8px 0 !important;
            border-radius: 8px;
            max-width: 100% !important;
            -webkit-overflow-scrolling: touch;
        }
        
        .chat-table-wrapper::-webkit-scrollbar {
            height: 6px;
        }
        
        .chat-table-wrapper::-webkit-scrollbar-thumb {
            background: #7c3aed;
            border-radius: 3px;
        }
        
        /* 🔧 FIX RAIZ 2026-06-13 (v169): las tablas del chat se machacaban (texto en
           VERTICAL) porque theme-editorial.css y main.css tienen reglas GLOBALES
           con !important sobre TODA tabla (table tbody td padding 14px !important,
           table min-width 800px, etc.). En el panel del chat (~390px) ese padding
           y min-width gigantes aplastan las columnas. Mis reglas .chat-table
           perdian la cascada por NO llevar !important. Solucion: .chat-table con
           !important para ganar SIEMPRE. Ancho natural + el wrapper hace scroll-x. */
        .chat-table {
            width: auto !important;
            min-width: 0 !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
            background: #f8fafc !important;
            border-radius: 8px !important;
            box-shadow: none !important;
            margin: 0 !important;
        }

        .chat-table th, .chat-table td {
            padding: 6px 10px !important;
            text-align: left !important;
            border-bottom: 1px solid #e2e8f0 !important;
            white-space: nowrap !important;
            word-break: normal !important;
            overflow-wrap: normal !important;
            vertical-align: top !important;
            font-size: 11px !important;
            text-transform: none !important;
            letter-spacing: normal !important;
            min-width: 0 !important;
        }

        .chat-table th {
            background: #7c3aed !important;
            color: white !important;
            font-weight: 600 !important;
            font-size: 10px !important;
        }
        
        .chat-table tr:last-child td {
            border-bottom: none;
        }
        
        .chat-table tr:nth-child(even) {
            background: #f1f5f9;
        }
        
        .chat-inline-code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            color: #7c3aed;
        }
        
        .chat-list {
            margin: 8px 0;
            padding-left: 20px;
        }
        
        .chat-list li {
            margin: 4px 0;
        }
        
        .chat-message.user .chat-message-content {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            border-radius: 18px;
            border-top-right-radius: 4px;
        }
        
        .chat-message-time {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 4px;
        }
        
        /* Typing Indicator */
        .chat-typing {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: white;
            border-radius: 18px;
            width: fit-content;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .chat-typing-dots {
            display: flex;
            gap: 4px;
        }
        
        .chat-typing-dot {
            width: 8px;
            height: 8px;
            background: #94a3b8;
            border-radius: 50%;
            animation: typingBounce 1.4s infinite ease-in-out;
        }
        
        .chat-typing-dot:nth-child(1) { animation-delay: 0s; }
        .chat-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .chat-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typingBounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-6px); }
        }
        
        /* Chat Input */
        .chat-input-container {
            padding: 16px 20px;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        .chat-input {
            flex: 1;
            border: 2px solid #e2e8f0;
            border-radius: 24px;
            padding: 12px 20px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
            resize: none;
            max-height: 100px;
            font-family: inherit;
        }
        
        .chat-input:focus {
            border-color: #7c3aed;
        }
        
        .chat-input::placeholder {
            color: #94a3b8;
        }
        
        .chat-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        
        .chat-send-btn:hover:not(:disabled) {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
        }
        
        .chat-send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .chat-send-btn svg {
            width: 20px;
            height: 20px;
            fill: white;
        }
        
        /* Microphone Button */
        .chat-mic-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #f1f5f9;
            border: 2px solid #e2e8f0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }
        
        .chat-mic-btn:hover {
            background: #e2e8f0;
        }
        
        .chat-mic-btn.recording {
            background: #fee2e2;
            border-color: #ef4444;
            animation: pulse-mic 1s infinite;
        }
        
        @keyframes pulse-mic {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        .chat-mic-btn svg {
            width: 20px;
            height: 20px;
            fill: #64748b;
        }
        
        .chat-mic-btn.recording svg {
            fill: #ef4444;
        }
        
        /* Quick Actions */
        .chat-quick-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 0 20px 16px;
            background: white;
        }
        
        .chat-quick-btn {
            padding: 8px 14px;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            font-size: 12px;
            color: #64748b;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .chat-quick-btn:hover {
            background: #7c3aed;
            color: white;
            border-color: #7c3aed;
        }
        
        /* Action Buttons in Messages */
        .chat-action-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            margin: 8px 4px 0 0;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            border: none;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .chat-action-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
        }
        
        .chat-action-btn.secondary {
            background: #f1f5f9;
            color: #64748b;
        }
        
        .chat-action-btn.secondary:hover {
            background: #e2e8f0;
            box-shadow: none;
        }
        
        /* Popover de selección de mes — se ancla bajo el botón "Informe" */
        .chat-informe-menu {
            position: absolute;
            top: 78px;
            right: 14px;
            z-index: 10;
            min-width: 220px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
            overflow: hidden;
            animation: chat-informe-menu-in 0.15s ease;
        }
        @keyframes chat-informe-menu-in {
            from { opacity: 0; transform: translateY(-4px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .chat-informe-menu-header {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 10px 14px 6px;
            border-bottom: 1px solid #f1f5f9;
        }
        .chat-informe-menu-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: 100%;
            text-align: left;
            background: none;
            border: none;
            padding: 10px 14px;
            font-size: 14px;
            color: #0f172a;
            cursor: pointer;
            transition: background 0.12s ease;
        }
        .chat-informe-menu-item:hover {
            background: #fef3c7;
        }
        .chat-informe-menu-item + .chat-informe-menu-item {
            border-top: 1px solid #f8fafc;
        }
        .chat-informe-menu-label {
            font-weight: 600;
            line-height: 1.2;
        }
        .chat-informe-menu-sub {
            font-size: 11px;
            color: #f59e0b;
            font-weight: 600;
        }

        /* Mini badge "X/300" — esquina superior derecha del chat-window,
           justo bajo el header. Discreto, no estorba al contenido del chat. */
        .chat-window { position: fixed; }
        .chat-usage-badge {
            position: absolute;
            top: 92px;
            right: 14px;
            z-index: 3;
            font-size: 10px;
            font-weight: 600;
            color: #64748b;
            background: rgba(248, 250, 252, 0.92);
            border: 1px solid #e2e8f0;
            border-radius: 999px;
            padding: 2px 8px;
            line-height: 1.4;
            letter-spacing: 0.2px;
            pointer-events: none;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .chat-usage-badge:empty { display: none; }

        /* Header — botón "Informe ejecutivo" (acción premium del add-on) */
        .chat-informe-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
            color: #fff;
            border: none;
            border-radius: 999px;
            padding: 6px 12px;
            margin-right: 8px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.2px;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(245, 158, 11, 0.45);
            transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
            white-space: nowrap;
        }
        .chat-informe-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(245, 158, 11, 0.55);
        }
        .chat-informe-btn:active {
            transform: translateY(0);
        }
        .chat-informe-btn svg {
            flex-shrink: 0;
        }
        .chat-informe-label {
            line-height: 1;
        }
        /* En pantallas muy pequeñas, escondemos el label y dejamos solo el icono */
        @media (max-width: 420px) {
            .chat-informe-label { display: none; }
            .chat-informe-btn { padding: 6px 8px; }
        }

        /* Responsive — TODO el rango móvil/tablet (≤768), no solo ≤480: algunos
           móviles reportan viewport 481-768 y ahí la ventana se salía por la
           derecha. Anclada por los DOS lados (left+right, width:auto) es
           IMPOSIBLE que exceda la pantalla, pase lo que pase con el viewport. */
        @media (max-width: 768px) {
            .chat-window {
                left: 10px;
                right: 10px;
                width: auto;
                max-width: none;
                /* dvh para que el teclado NO tape el input; bottom respeta la
                   barra home del iPhone (safe-area). */
                bottom: calc(80px + env(safe-area-inset-bottom, 0px));
                height: 70vh;
                height: 70dvh;
                /* nada se sale de la caja redondeada */
                overflow: hidden;
            }

            .chat-fab {
                right: calc(16px + env(safe-area-inset-right, 0px));
                bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            }
            .chat-fab-bubble { display: none; }
        }
    `;
    document.head.appendChild(style);
}

export default { createChatStyles };
