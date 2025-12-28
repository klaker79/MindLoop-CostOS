/**
 * Integrations Status Module
 * Verifica el estado real de las conexiones con n8n y APIs
 * 
 * @module modules/integrations/integrations-status
 */

import { appConfig } from '../../config/app-config.js';

/**
 * Estado de las integraciones
 */
const integrationStatus = {
    n8n: { connected: false, lastCheck: null, error: null },
    sheets: { connected: false, lastCheck: null, error: null },
    cuiner: { connected: false, lastCheck: null, error: null }
};

/**
 * Verifica el estado del webhook de n8n
 * Hace un ping al webhook para ver si responde
 */
async function checkN8nStatus() {
    const webhookUrl = appConfig.chat?.webhookUrl;
    if (!webhookUrl) {
        integrationStatus.n8n = { connected: false, lastCheck: new Date(), error: 'URL no configurada' };
        return false;
    }

    try {
        // Solo verificamos que el endpoint existe (HEAD o GET con timeout corto)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping', source: 'mindloop-costos' }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // n8n puede responder 200, 201, o incluso 400 si el workflow espera datos específicos
        // Lo importante es que responda (no timeout ni error de red)
        integrationStatus.n8n = {
            connected: response.status < 500,
            lastCheck: new Date(),
            error: response.status >= 500 ? `Error ${response.status}` : null
        };

        return integrationStatus.n8n.connected;
    } catch (error) {
        integrationStatus.n8n = {
            connected: false,
            lastCheck: new Date(),
            error: error.name === 'AbortError' ? 'Timeout' : error.message
        };
        return false;
    }
}

/**
 * Verifica el estado de la API (que se usa para Sheets y Cuiner vía n8n)
 */
async function checkAPIStatus() {
    const apiUrl = appConfig.api?.baseUrl;
    if (!apiUrl) {
        return false;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${apiUrl}/api/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const isConnected = response.ok;

        // Si la API está conectada, asumimos que Sheets y Cuiner también
        // (ya que funcionan a través de n8n que escribe a la API)
        integrationStatus.sheets = { connected: isConnected, lastCheck: new Date(), error: null };
        integrationStatus.cuiner = { connected: isConnected, lastCheck: new Date(), error: null };

        return isConnected;
    } catch (error) {
        integrationStatus.sheets = { connected: false, lastCheck: new Date(), error: error.message };
        integrationStatus.cuiner = { connected: false, lastCheck: new Date(), error: error.message };
        return false;
    }
}

/**
 * Verifica todas las integraciones y actualiza la UI
 */
export async function checkAllIntegrations() {
    console.log('🔗 Verificando estado de integraciones...');

    // Verificar en paralelo
    const [n8nOk, apiOk] = await Promise.all([
        checkN8nStatus(),
        checkAPIStatus()
    ]);

    // Actualizar UI
    updateIntegrationUI('status-n8n', n8nOk);
    updateIntegrationUI('status-sheets', apiOk);
    updateIntegrationUI('status-cuiner', apiOk);

    console.log('✅ Estado de integraciones:', integrationStatus);

    return integrationStatus;
}

/**
 * Actualiza el badge de una integración en la UI
 */
function updateIntegrationUI(elementId, isConnected) {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (isConnected) {
        element.innerHTML = '✓ Conectado';
        element.style.background = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)';
        element.style.color = 'white';
    } else {
        element.innerHTML = '⚠️ Sin conexión';
        element.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        element.style.color = 'white';
    }
}

/**
 * Obtiene el estado actual de las integraciones
 */
export function getIntegrationStatus() {
    return { ...integrationStatus };
}

/**
 * Inicializa el módulo de integraciones
 * Se llama al cargar la tab de configuración
 */
export function initIntegrations() {
    // Verificar estado al entrar en la tab de configuración
    checkAllIntegrations();
}

// Exponer globalmente para uso desde HTML
window.checkAllIntegrations = checkAllIntegrations;
window.initIntegrations = initIntegrations;
