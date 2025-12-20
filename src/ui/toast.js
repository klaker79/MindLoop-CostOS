/**
 * Sistema de notificaciones Toast
 * Muestra mensajes temporales al usuario
 */

/**
 * Muestra un mensaje toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error('toast-container no encontrado en DOM');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { 
    success: '✅', 
    error: '❌', 
    warning: '⚠️', 
    info: 'ℹ️' 
  };

  // Crear estructura HTML (sin inyectar mensaje directamente por seguridad XSS)
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-message"></div>
  `;
  
  // Establecer mensaje de forma segura (previene XSS)
  const messageEl = toast.querySelector('.toast-message');
  if (messageEl) {
    messageEl.textContent = message;
  }

  container.appendChild(toast);
  
  // Auto-cerrar después de 3 segundos
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Alias para compatibilidad con código existente
 */
export default showToast;
