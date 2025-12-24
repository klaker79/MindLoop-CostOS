/**
 * MindLoop CostOS - Chat Widget con IA
 * Integración con n8n para asistente contable inteligente
 */

const CHAT_CONFIG = {
    webhookUrl: 'https://n8niker.mindloop.cloud/webhook/3f075a6e-b005-407d-911c-93f710727449',
    botName: 'Asistente CostOS',
    welcomeMessage: '¡Hola! 👋 Soy tu asistente de costos. Puedo ayudarte con:\n\n• 📊 Análisis de food cost\n• 💰 Costes de platos y recetas\n• 📦 Stock y raciones disponibles\n• 📈 Márgenes y rentabilidad\n• 🏪 Comparativa de proveedores\n\n¿En qué puedo ayudarte?',
    placeholderText: 'Escribe tu pregunta...',
    errorMessage: 'Lo siento, hubo un error. Inténtalo de nuevo.'
};

// Generar sessionId único
function generateSessionId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

let chatSessionId = localStorage.getItem('chatSessionId') || generateSessionId();
localStorage.setItem('chatSessionId', chatSessionId);

let chatMessages = JSON.parse(localStorage.getItem('chatHistory') || '[]');
let isChatOpen = false;
let isWaitingResponse = false;

/**
 * Inicializa el widget de chat
 */
export function initChatWidget() {
    createChatStyles();
    createChatHTML();
    bindChatEvents();

    // Mostrar mensaje de bienvenida si no hay historial
    if (chatMessages.length === 0) {
        addMessage('bot', CHAT_CONFIG.welcomeMessage);
    } else {
        renderChatHistory();
    }

    console.log('💬 Chat Widget inicializado');
}

/**
 * Crea los estilos CSS del chat
 */
function createChatStyles() {
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
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 9999;
        }
        
        .chat-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(124, 58, 237, 0.5);
        }
        
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
            width: 450px;
            height: 550px;
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
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
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
            overflow-x: hidden;
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
        }
        
        /* Markdown Tables in Chat */
        .chat-table-wrapper {
            overflow-x: auto;
            margin: 8px 0;
            border-radius: 8px;
            max-width: 100%;
            -webkit-overflow-scrolling: touch;
        }
        
        .chat-table-wrapper::-webkit-scrollbar {
            height: 6px;
        }
        
        .chat-table-wrapper::-webkit-scrollbar-thumb {
            background: #7c3aed;
            border-radius: 3px;
        }
        
        .chat-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            background: #f8fafc;
            border-radius: 8px;
            white-space: nowrap;
        }
        
        .chat-table th, .chat-table td {
            padding: 6px 8px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .chat-table th {
            background: #7c3aed;
            color: white;
            font-weight: 600;
            font-size: 9px;
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
        
        /* Responsive */
        @media (max-width: 480px) {
            .chat-window {
                width: calc(100% - 32px);
                right: 16px;
                bottom: 90px;
                height: 70vh;
            }
            
            .chat-fab {
                right: 16px;
                bottom: 16px;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Crea el HTML del chat
 */
function createChatHTML() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-widget-container';
    chatContainer.innerHTML = `
        <!-- Chat FAB Button -->
        <button class="chat-fab" id="chat-fab" title="Asistente IA">
            <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <span class="notification-dot"></span>
        </button>
        
        <!-- Chat Window -->
        <div class="chat-window" id="chat-window">
            <!-- Header -->
            <div class="chat-header">
                <div class="chat-header-avatar">🤖</div>
                <div class="chat-header-info">
                    <h3>${CHAT_CONFIG.botName}</h3>
                    <p>Asistente inteligente de costos</p>
                </div>
                <div class="chat-header-status"></div>
                <button class="chat-clear-btn" id="chat-clear" title="Limpiar chat" style="background:none;border:none;cursor:pointer;padding:8px;margin-right:4px;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
                <button class="chat-close-btn" id="chat-close">
                    <svg viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
            
            <!-- Messages -->
            <div class="chat-messages" id="chat-messages"></div>
            
            <!-- Quick Actions (contextual) -->
            <div class="chat-quick-actions" id="chat-quick-actions">
                <!-- Se actualizan dinámicamente según la pestaña -->
            </div>
            
            <!-- Input -->
            <div class="chat-input-container">
                <textarea 
                    class="chat-input" 
                    id="chat-input" 
                    placeholder="${CHAT_CONFIG.placeholderText}"
                    rows="1"
                ></textarea>
                <button class="chat-send-btn" id="chat-send">
                    <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);
}

/**
 * Vincula eventos del chat
 */
function bindChatEvents() {
    const fab = document.getElementById('chat-fab');
    const chatWindow = document.getElementById('chat-window');
    const closeBtn = document.getElementById('chat-close');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const quickBtns = document.querySelectorAll('.chat-quick-btn');

    // Toggle chat
    fab.addEventListener('click', () => toggleChat());
    closeBtn.addEventListener('click', () => toggleChat(false));

    // Clear chat
    const clearBtn = document.getElementById('chat-clear');
    clearBtn.addEventListener('click', () => clearChat());

    // Send message
    sendBtn.addEventListener('click', () => sendMessage());

    // Enter to send
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // Quick actions (delegated event)
    document.getElementById('chat-quick-actions').addEventListener('click', (e) => {
        if (e.target.classList.contains('chat-quick-btn')) {
            input.value = e.target.dataset.msg;
            sendMessage();
        }
    });

    // Update quick buttons on tab change
    updateQuickButtons();
}

/**
 * Toggle ventana de chat
 */
function toggleChat(forceState) {
    const chatWindow = document.getElementById('chat-window');
    const fab = document.getElementById('chat-fab');

    isChatOpen = forceState !== undefined ? forceState : !isChatOpen;

    chatWindow.classList.toggle('open', isChatOpen);
    fab.classList.toggle('active', isChatOpen);

    // Hide notification dot when opened
    if (isChatOpen) {
        fab.querySelector('.notification-dot').style.display = 'none';
        document.getElementById('chat-input').focus();
    }
}

/**
 * Añade un mensaje al chat
 */
function addMessage(type, text, save = true) {
    const messagesContainer = document.getElementById('chat-messages');
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    messageEl.innerHTML = `
        <div class="chat-message-avatar">${type === 'bot' ? '🤖' : '👤'}</div>
        <div>
            <div class="chat-message-content">${parseMarkdown(text)}</div>
            <div class="chat-message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Guardar en historial
    if (save) {
        chatMessages.push({ type, text, time: Date.now() });
        // Mantener solo los últimos 50 mensajes
        if (chatMessages.length > 50) chatMessages = chatMessages.slice(-50);
        localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
    }
}

/**
 * Añade mensaje con botones de acción
 */
function addMessageWithAction(type, text, actionData) {
    const messagesContainer = document.getElementById('chat-messages');
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const actionId = 'action_' + Date.now();

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${type}`;
    messageEl.innerHTML = `
        <div class="chat-message-avatar">🤖</div>
        <div>
            <div class="chat-message-content">${parseMarkdown(text)}</div>
            <div class="chat-action-buttons" id="${actionId}" style="margin-top: 12px; display: flex; gap: 8px;">
                <button class="chat-action-confirm" data-action="${encodeURIComponent(actionData)}" 
                    style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    ✅ Confirmar
                </button>
                <button class="chat-action-cancel" 
                    style="background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    ❌ Cancelar
                </button>
            </div>
            <div class="chat-message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Eventos de los botones
    const confirmBtn = messageEl.querySelector('.chat-action-confirm');
    const cancelBtn = messageEl.querySelector('.chat-action-cancel');
    const buttonsContainer = document.getElementById(actionId);

    confirmBtn.addEventListener('click', async () => {
        buttonsContainer.innerHTML = '<span style="color: #f59e0b;">⏳ Ejecutando...</span>';
        const success = await executeAction(actionData);
        if (success) {
            buttonsContainer.innerHTML = '<span style="color: #10b981;">✅ ¡Hecho! Cambio aplicado correctamente.</span>';
            addMessage('bot', '✅ Acción completada. Los datos se han actualizado.', false);
        } else {
            buttonsContainer.innerHTML = '<span style="color: #ef4444;">❌ Error al ejecutar la acción.</span>';
        }
    });

    cancelBtn.addEventListener('click', () => {
        buttonsContainer.innerHTML = '<span style="color: #64748b;">🚫 Acción cancelada.</span>';
    });

    // Guardar mensaje (sin la acción)
    chatMessages.push({ type, text, time: Date.now() });
    if (chatMessages.length > 50) chatMessages = chatMessages.slice(-50);
    localStorage.setItem('chatHistory', JSON.stringify(chatMessages));
}

/**
 * Ejecuta una acción del chat
 * Formato: tipo|entidad|campo|valor (ej: "update|ingrediente|PULPO|precio|25")
 */
async function executeAction(actionData) {
    try {
        const parts = actionData.split('|');
        const action = parts[0]; // update, add, etc.
        const entity = parts[1]; // ingrediente, receta
        const name = parts[2];   // nombre del item
        const field = parts[3];  // campo a modificar
        const value = parts[4];  // nuevo valor

        console.log('🔧 Ejecutando acción:', { action, entity, name, field, value });

        if (action === 'update' && entity === 'ingrediente') {
            // Buscar ingrediente por nombre
            const ing = window.ingredientes?.find(i =>
                i.nombre.toLowerCase().includes(name.toLowerCase())
            );
            if (!ing) {
                console.error('Ingrediente no encontrado:', name);
                return false;
            }

            // Preparar actualización
            const updates = { ...ing };
            if (field === 'precio') updates.precio = parseFloat(value);
            if (field === 'stock') updates.stock_actual = parseFloat(value);

            // Llamar API
            await window.api.updateIngrediente(ing.id, updates);
            await window.cargarDatos();
            window.renderizarIngredientes?.();
            window.showToast?.(`${ing.nombre} actualizado: ${field} = ${value}`, 'success');
            return true;

        } else if (action === 'update' && entity === 'receta') {
            // Buscar receta por nombre
            const rec = window.recetas?.find(r =>
                r.nombre.toLowerCase().includes(name.toLowerCase())
            );
            if (!rec) {
                console.error('Receta no encontrada:', name);
                return false;
            }

            // Preparar actualización
            const updates = { ...rec };
            if (field === 'precio' || field === 'precio_venta') updates.precio_venta = parseFloat(value);

            // Llamar API
            await window.api.updateReceta(rec.id, updates);
            await window.cargarDatos();
            window.renderizarRecetas?.();
            window.showToast?.(`${rec.nombre} actualizado: precio = ${value}€`, 'success');
            return true;
        }

        console.warn('Acción no reconocida:', actionData);
        return false;

    } catch (error) {
        console.error('Error ejecutando acción:', error);
        window.showToast?.('Error: ' + error.message, 'error');
        return false;
    }
}

/**
 * Muestra indicador de typing
 */
function showTyping() {
    const messagesContainer = document.getElementById('chat-messages');

    const typingEl = document.createElement('div');
    typingEl.id = 'chat-typing';
    typingEl.className = 'chat-typing';
    typingEl.innerHTML = `
        <div class="chat-message-avatar" style="width:28px;height:28px;font-size:12px;">🤖</div>
        <div class="chat-typing-dots">
            <div class="chat-typing-dot"></div>
            <div class="chat-typing-dot"></div>
            <div class="chat-typing-dot"></div>
        </div>
    `;

    messagesContainer.appendChild(typingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Oculta indicador de typing
 */
function hideTyping() {
    const typingEl = document.getElementById('chat-typing');
    if (typingEl) typingEl.remove();
}

/**
 * Envía mensaje al webhook
 */
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const message = input.value.trim();

    if (!message || isWaitingResponse) return;

    // Add user message
    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    // Disable input
    isWaitingResponse = true;
    sendBtn.disabled = true;
    input.disabled = true;
    showTyping();

    try {
        const tabContext = getCurrentTabContext();

        const response = await fetch(CHAT_CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                sessionId: chatSessionId,
                restaurante: window.getRestaurantName ? window.getRestaurantName() : 'Restaurante',
                timestamp: new Date().toISOString(),
                fechaHoy: new Date().toLocaleDateString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                fechaISO: new Date().toISOString().split('T')[0],
                contexto: tabContext
            })
        });

        hideTyping();

        if (!response.ok) {
            throw new Error('Error en la respuesta');
        }

        const data = await response.text();

        // Detectar si hay una acción pendiente de confirmar
        const actionMatch = data.match(/\[ACTION:([^\]]+)\]/);
        if (actionMatch) {
            const actionData = actionMatch[1];
            const cleanMessage = data.replace(/\[ACTION:[^\]]+\]/, '').trim();
            addMessageWithAction('bot', cleanMessage, actionData);
        } else {
            addMessage('bot', data || 'No hay respuesta disponible.');
        }

    } catch (error) {
        hideTyping();
        console.error('Chat error:', error);
        addMessage('bot', CHAT_CONFIG.errorMessage);
    } finally {
        isWaitingResponse = false;
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

/**
 * Renderiza el historial
 */
function renderChatHistory() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';

    chatMessages.forEach(msg => {
        addMessage(msg.type, msg.text, false);
    });
}

/**
 * Limpia el historial
 */
export function clearChatHistory() {
    chatMessages = [];
    localStorage.removeItem('chatHistory');
    chatSessionId = generateSessionId();
    localStorage.setItem('chatSessionId', chatSessionId);

    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
        addMessage('bot', CHAT_CONFIG.welcomeMessage);
    }
}

/**
 * Limpia el chat (wrapper para el botón)
 */
function clearChat() {
    if (confirm('¿Borrar toda la conversación?')) {
        clearChatHistory();
    }
}

/**
 * Actualiza botones rápidos según la pestaña actual
 */
function updateQuickButtons() {
    const container = document.getElementById('chat-quick-actions');
    if (!container) return;

    const currentTab = getCurrentTab();

    const buttonsByTab = {
        'ingredientes': [
            { msg: '¿Qué ingrediente ha subido de precio?', label: '📈 Subidas' },
            { msg: '¿Qué ingredientes tengo con stock bajo?', label: '⚠️ Stock bajo' },
            { msg: '¿Cuál es mi ingrediente más caro?', label: '💰 Más caro' }
        ],
        'recetas': [
            { msg: '¿Cuál es mi plato más rentable?', label: '⭐ Más rentable' },
            { msg: '¿Qué platos tienen food cost alto?', label: '🔴 Food cost alto' },
            { msg: '¿Qué precio debería poner a este plato?', label: '💵 Precio sugerido' }
        ],
        'proveedores': [
            { msg: '¿Qué proveedor es más barato para el mismo producto?', label: '🏪 Comparar' },
            { msg: '¿Cuánto gasto por proveedor?', label: '💳 Gastos' }
        ],
        'dashboard': [
            { msg: 'Dame un resumen del día', label: '📊 Resumen' },
            { msg: '¿Cuál es el food cost actual?', label: '🎯 Food Cost' },
            { msg: '¿Cuántas raciones puedo hacer hoy?', label: '🍽️ Raciones' }
        ],
        'default': [
            { msg: '¿Cuál es el food cost actual?', label: '📊 Food Cost' },
            { msg: '¿Cuántas raciones puedo hacer?', label: '🍽️ Raciones' },
            { msg: '¿Qué proveedor es más barato?', label: '🏪 Proveedores' },
            { msg: 'Muéstrame los márgenes', label: '📈 Márgenes' }
        ]
    };

    const buttons = buttonsByTab[currentTab] || buttonsByTab['default'];

    container.innerHTML = buttons.map(btn =>
        `<button class="chat-quick-btn" data-msg="${btn.msg}">${btn.label}</button>`
    ).join('');
}

/**
 * Obtiene la pestaña actual
 */
function getCurrentTab() {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
        return activeTab.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }
    return 'dashboard';
}

/**
 * Obtiene contexto de la pestaña actual para enviar al agente
 */
function getCurrentTabContext() {
    const tab = getCurrentTab();
    const context = { tab };

    try {
        // Siempre incluir gastos fijos reales
        const opex = JSON.parse(localStorage.getItem('opex_inputs') || '{}');
        context.gastosFijos = {
            alquiler: parseFloat(opex.alquiler) || 0,
            personal: parseFloat(opex.personal) || 0,
            suministros: parseFloat(opex.suministros) || 0,
            otros: parseFloat(opex.otros) || 0,
            total: (parseFloat(opex.alquiler) || 0) + (parseFloat(opex.personal) || 0) +
                (parseFloat(opex.suministros) || 0) + (parseFloat(opex.otros) || 0)
        };

        // Siempre incluir resumen de ingredientes (top 10 por precio)
        if (window.ingredientes && Array.isArray(window.ingredientes)) {
            context.ingredientes = window.ingredientes
                .slice(0, 15)
                .map(i => ({
                    nombre: i.nombre,
                    precio: parseFloat(i.precio) || 0,
                    unidad: i.unidad || 'kg',
                    stock: parseFloat(i.stock_actual) || 0,
                    stockMinimo: parseFloat(i.stock_minimo) || 0,
                    proveedor: i.proveedor?.nombre || 'Sin proveedor'
                }));
            context.totalIngredientes = window.ingredientes.length;
            context.stockBajo = window.ingredientes.filter(i =>
                i.stock_minimo > 0 && parseFloat(i.stock_actual) <= parseFloat(i.stock_minimo)
            ).length;
        }

        // Siempre incluir resumen de recetas con ingredientes detallados
        if (window.recetas && Array.isArray(window.recetas)) {
            context.recetas = window.recetas
                .slice(0, 15)
                .map(r => {
                    const coste = window.calcularCosteRecetaCompleto ? window.calcularCosteRecetaCompleto(r) : 0;
                    const precioVenta = parseFloat(r.precio_venta) || 0;
                    const foodCost = precioVenta > 0 ? (coste / precioVenta * 100) : 0;
                    const margen = precioVenta > 0 ? ((precioVenta - coste) / precioVenta * 100) : 0;

                    // Incluir ingredientes detallados
                    const ingredientesDetalle = (r.ingredientes || []).map(item => {
                        const ing = window.ingredientes?.find(i => i.id === item.ingredienteId);
                        const precio = ing ? parseFloat(ing.precio) || 0 : 0;
                        const cantidad = parseFloat(item.cantidad) || 0;
                        return {
                            nombre: ing?.nombre || 'Desconocido',
                            cantidad: cantidad,
                            unidad: ing?.unidad || 'kg',
                            precioUd: precio,
                            coste: Math.round(precio * cantidad * 100) / 100
                        };
                    });

                    return {
                        nombre: r.nombre,
                        categoria: r.categoria,
                        coste: Math.round(coste * 100) / 100,
                        precioVenta: precioVenta,
                        foodCost: Math.round(foodCost * 10) / 10,
                        margen: Math.round(margen * 10) / 10,
                        ingredientes: ingredientesDetalle
                    };
                });
            context.totalRecetas = window.recetas.length;
            context.recetasFoodCostAlto = context.recetas.filter(r => r.foodCost > 33).length;
        }

        // Incluir proveedores
        if (window.proveedores && Array.isArray(window.proveedores)) {
            context.proveedores = window.proveedores.map(p => ({
                nombre: p.nombre,
                telefono: p.telefono || '',
                email: p.email || ''
            }));
            context.totalProveedores = window.proveedores.length;
        }

        // Incluir ventas si existen
        if (window.ventas && Array.isArray(window.ventas)) {
            const hoy = new Date().toISOString().split('T')[0];
            const ventasHoy = window.ventas.filter(v => v.fecha === hoy);
            const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
            context.ventas = {
                hoy: Math.round(totalVentasHoy * 100) / 100,
                totalRegistros: window.ventas.length
            };
        }

    } catch (e) {
        console.warn('Error obteniendo contexto:', e);
    }

    return context;
}


// Escuchar cambios de pestaña para actualizar botones
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
        setTimeout(updateQuickButtons, 100);
    }
});

/**
 * Parse Markdown to HTML (tablas, negritas, listas, código)
 */
function parseMarkdown(text) {
    if (!text) return '';

    // Detectar si hay una tabla markdown (líneas con | y separador con ---)
    const lines = text.split('\n');
    let tableStartIndex = -1;
    let tableEndIndex = -1;
    let hasSeparator = false;

    // Buscar tabla markdown estándar
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detectar separador de tabla (|---|---|)
        if (/^\|?[\s\-:]+\|[\s\-:|]+\|?$/.test(line) || /^[\-\|:\s]+$/.test(line)) {
            if (tableStartIndex === -1 && i > 0) tableStartIndex = i - 1;
            hasSeparator = true;
            continue;
        }

        // Línea con pipes (posible fila de tabla)
        if (line.includes('|') && hasSeparator) {
            tableEndIndex = i;
        } else if (line.includes('|') && tableStartIndex === -1) {
            tableStartIndex = i;
        } else if (!line.includes('|') && tableEndIndex > tableStartIndex) {
            // Fin de la tabla
            break;
        }
    }

    // Si encontramos una tabla, convertirla
    if (hasSeparator && tableStartIndex >= 0 && tableEndIndex > tableStartIndex) {
        const beforeTable = lines.slice(0, tableStartIndex).join('\n');
        const tableLines = lines.slice(tableStartIndex, tableEndIndex + 1);
        const afterTable = lines.slice(tableEndIndex + 1).join('\n');

        let tableHtml = '<div class="chat-table-wrapper"><table class="chat-table"><tbody>';
        let isHeader = true;

        for (const line of tableLines) {
            // Ignorar separadores
            if (/^[\s\-:|]+$/.test(line.trim())) continue;
            if (/^\|?[\s\-:]+\|/.test(line.trim())) continue;

            // Extraer celdas
            const cells = line.split('|')
                .map(c => c.trim())
                .filter(c => c !== '');

            if (cells.length > 0) {
                const tag = isHeader ? 'th' : 'td';
                tableHtml += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
                isHeader = false;
            }
        }

        tableHtml += '</tbody></table></div>';

        return formatTextContent(beforeTable) + tableHtml + formatTextContent(afterTable);
    }

    // Fallback: formateo normal sin tabla
    return formatTextContent(text);
}


/**
 * Formatea contenido de texto (negritas, listas, etc.)
 */
function formatTextContent(text) {
    if (!text) return '';

    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Negritas **texto** o __texto__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Código inline `código`
    html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');

    // Listas con •
    html = html.replace(/•\s+([^\n]+)/g, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)+/g, '<ul class="chat-list">$&</ul>');

    // Emojis en mayúsculas como títulos (simplificado)
    html = html.replace(/([📊💰📦📈🏪🎯✅❌⚠️🔴🟢🟡])\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]*:)/g, '<strong>$1 $2</strong>');

    // Saltos de línea
    html = html.replace(/\n/g, '<br>');

    return html;
}

// Exportar para uso global
window.initChatWidget = initChatWidget;
window.clearChatHistory = clearChatHistory;
window.toggleChat = toggleChat;
