/**
 * 🧠 Inteligencia - Dashboard Predictivo
 */

// ========== API ==========
async function fetchIntelligence(endpoint) {
    try {
        const apiBase = window.getApiUrl ? window.getApiUrl() : 'https://lacaleta-api.mindloop.cloud';
        const token = localStorage.getItem('token');

        const response = await fetch(`${apiBase}/api/intelligence/${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        console.error(`Error fetching ${endpoint}:`, err);
        return null;
    }
}

// ========== ESTILOS ==========
const INTEL_STYLES = `
<style id="intel-styles">
.intel-dashboard {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    min-height: 100vh;
    padding: 24px;
    color: #e2e8f0;
}
.intel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}
.intel-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
.intel-title h1 {
    font-size: 2rem;
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
}
.intel-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
}
.intel-panel {
    background: rgba(30,41,59,0.9);
    border-radius: 16px;
    padding: 20px;
    border: 1px solid rgba(99,102,241,0.2);
}
.intel-panel-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}
.intel-panel-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
}
.panel-fresh .intel-panel-icon { background: linear-gradient(135deg, #f97316, #ea580c); }
.panel-buy .intel-panel-icon { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.panel-stop .intel-panel-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }
.panel-price .intel-panel-icon { background: linear-gradient(135deg, #22c55e, #16a34a); }
.intel-panel-title { font-weight: 700; color: #f1f5f9; }
.intel-panel-sub { font-size: 0.75rem; color: #94a3b8; }
.intel-list {
    max-height: 280px;
    overflow-y: auto;
}
.intel-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: rgba(15,23,42,0.6);
    border-radius: 8px;
    margin-bottom: 8px;
}
.intel-item-name { font-weight: 600; font-size: 0.9rem; }
.intel-item-detail { font-size: 0.75rem; color: #94a3b8; }
.intel-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
}
.badge-danger { background: #ef4444; }
.badge-warn { background: #f97316; }
.badge-ok { background: #22c55e; }
.intel-empty {
    text-align: center;
    padding: 32px;
    color: #64748b;
}
.intel-empty-icon { font-size: 40px; margin-bottom: 8px; }
.intel-btn {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
}
.intel-days { display: flex; gap: 6px; margin-bottom: 12px; }
.intel-day-btn {
    padding: 6px 12px;
    border: 1px solid rgba(99,102,241,0.3);
    background: transparent;
    color: #94a3b8;
    border-radius: 6px;
    cursor: pointer;
}
.intel-day-btn.active {
    background: #3b82f6;
    color: white;
    border-color: transparent;
}
</style>
`;

// ========== RENDER PANELS ==========
function renderFreshness(data) {
    if (!data || data.length === 0) {
        return `<div class="intel-empty"><div class="intel-empty-icon">✅</div><div>Todo el stock está fresco</div></div>`;
    }
    return `<div class="intel-list">${data.slice(0, 8).map(a => `
        <div class="intel-item">
            <div>
                <div class="intel-item-name">${a.nombre}</div>
                <div class="intel-item-detail">${a.stock_actual} ${a.unidad} · Hace ${a.dias_desde_compra || 0} días</div>
            </div>
            <span class="intel-badge ${a.urgencia === 'critico' ? 'badge-danger' : 'badge-warn'}">
                ${a.urgencia === 'critico' ? '⚠️ REVISAR' : '📋 USAR HOY'}
            </span>
        </div>
    `).join('')}</div>`;
}

function renderPurchase(data, day) {
    const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayBtns = `<div class="intel-days">${DIAS.map((d, i) => `
        <button class="intel-day-btn ${i === day ? 'active' : ''}" onclick="window.loadPurchasePlan(${i})">${d}</button>
    `).join('')}</div>`;

    if (!data || !data.sugerencias || data.sugerencias.length === 0) {
        return dayBtns + `<div class="intel-empty"><div class="intel-empty-icon">📦</div><div>Stock suficiente para ${data?.dia_objetivo || 'este día'}</div></div>`;
    }
    return dayBtns + `<div class="intel-list">${data.sugerencias.slice(0, 6).map(s => `
        <div class="intel-item">
            <div>
                <div class="intel-item-name">${s.nombre}</div>
                <div class="intel-item-detail">Stock: ${parseFloat(s.stock_actual).toFixed(1)} ${s.unidad}</div>
            </div>
            <span class="intel-badge badge-warn">+${parseFloat(s.sugerencia_pedido).toFixed(1)}</span>
        </div>
    `).join('')}</div>`;
}

function renderOverstock(data) {
    if (!data || data.length === 0) {
        return `<div class="intel-empty"><div class="intel-empty-icon">👍</div><div>Niveles óptimos</div></div>`;
    }
    return `<div class="intel-list">${data.slice(0, 8).map(i => `
        <div class="intel-item">
            <div>
                <div class="intel-item-name">${i.nombre}</div>
                <div class="intel-item-detail">${parseFloat(i.stock_actual).toFixed(1)} ${i.unidad}</div>
            </div>
            <span class="intel-badge badge-warn">📦 ${Math.round(i.dias_stock)} días</span>
        </div>
    `).join('')}</div>`;
}

function renderPricing(data) {
    if (!data || !data.recetas_problema || data.recetas_problema.length === 0) {
        return `<div class="intel-empty"><div class="intel-empty-icon">💰</div><div>Precios rentables</div></div>`;
    }
    return `<div class="intel-list">${data.recetas_problema.slice(0, 6).map(r => `
        <div class="intel-item">
            <div>
                <div class="intel-item-name">${r.nombre}</div>
                <div class="intel-item-detail">Coste: ${r.coste.toFixed(2)}€ · Actual: ${r.precio_actual.toFixed(2)}€</div>
            </div>
            <span class="intel-badge badge-danger">${r.food_cost}% → ${r.precio_sugerido.toFixed(2)}€</span>
        </div>
    `).join('')}</div>`;
}

// ========== MAIN ==========
async function renderizarInteligencia() {
    const container = document.getElementById('content-inteligencia');
    if (!container) return;

    if (!document.getElementById('intel-styles')) {
        document.head.insertAdjacentHTML('beforeend', INTEL_STYLES);
    }

    container.innerHTML = `<div class="intel-dashboard"><div style="text-align:center;padding:60px;"><div style="font-size:40px;">⏳</div><div style="color:#64748b;">Cargando...</div></div></div>`;

    const [fresh, purchase, over, price] = await Promise.all([
        fetchIntelligence('freshness'),
        fetchIntelligence('purchase-plan?day=6'),
        fetchIntelligence('overstock'),
        fetchIntelligence('price-check')
    ]);

    window._purchaseDay = 6;
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    container.innerHTML = `
        <div class="intel-dashboard">
            <div class="intel-header">
                <div class="intel-title">
                    <span style="font-size:40px;">🧠</span>
                    <div><h1>Inteligencia</h1><div style="color:#64748b;font-size:0.8rem;">Actualizado: ${time}</div></div>
                </div>
                <button class="intel-btn" onclick="window.renderizarInteligencia()">🔄 Actualizar</button>
            </div>
            <div class="intel-grid">
                <div class="intel-panel panel-fresh">
                    <div class="intel-panel-header">
                        <div class="intel-panel-icon">🧊</div>
                        <div><div class="intel-panel-title">Frescura del Stock</div><div class="intel-panel-sub">Productos a revisar (vida útil marisco: 2 días)</div></div>
                    </div>
                    ${renderFreshness(fresh)}
                </div>
                <div class="intel-panel panel-buy" id="panel-purchase">
                    <div class="intel-panel-header">
                        <div class="intel-panel-icon">📅</div>
                        <div><div class="intel-panel-title">Plan de Compras</div><div class="intel-panel-sub">Basado en ventas históricas por día</div></div>
                    </div>
                    <div id="purchase-content">${renderPurchase(purchase, 6)}</div>
                </div>
                <div class="intel-panel panel-stop">
                    <div class="intel-panel-header">
                        <div class="intel-panel-icon">🛑</div>
                        <div><div class="intel-panel-title">No Compres Más</div><div class="intel-panel-sub">Stock excesivo para consumo actual</div></div>
                    </div>
                    ${renderOverstock(over)}
                </div>
                <div class="intel-panel panel-price">
                    <div class="intel-panel-header">
                        <div class="intel-panel-icon">💰</div>
                        <div><div class="intel-panel-title">Revisión de Precios</div><div class="intel-panel-sub">Recetas con food cost > 40%</div></div>
                    </div>
                    ${renderPricing(price)}
                </div>
            </div>
        </div>
    `;
}

window.loadPurchasePlan = async function (day) {
    const data = await fetchIntelligence(`purchase-plan?day=${day}`);
    const content = document.getElementById('purchase-content');
    if (content) content.innerHTML = renderPurchase(data, day);
    window._purchaseDay = day;
};

window.renderizarInteligencia = renderizarInteligencia;
