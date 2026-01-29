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

export default { createChatStyles };
