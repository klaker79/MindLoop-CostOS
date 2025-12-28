/**
 * Sales Calendar Heatmap Module
 * Shows monthly view with color-coded sales intensity
 * 
 * @module modules/analytics/sales-calendar
 */

/**
 * Calculates percentile thresholds for color coding
 * @param {Array} values - Array of sales values
 * @returns {Object} Thresholds for each color level
 */
function calcularUmbrales(values) {
    const sorted = [...values].filter(v => v > 0).sort((a, b) => a - b);

    if (sorted.length === 0) {
        return { p20: 0, p40: 0, p60: 0, p80: 0 };
    }

    const getPercentile = (arr, p) => {
        const index = Math.ceil((p / 100) * arr.length) - 1;
        return arr[Math.max(0, index)] || 0;
    };

    return {
        p20: getPercentile(sorted, 20),
        p40: getPercentile(sorted, 40),
        p60: getPercentile(sorted, 60),
        p80: getPercentile(sorted, 80)
    };
}

/**
 * Gets color based on value and thresholds
 * @param {number} value - Sales value for the day
 * @param {Object} umbrales - Percentile thresholds
 * @returns {Object} Color info with background and text color
 */
function getColorPorValor(value, umbrales) {
    if (value === 0 || value === null || value === undefined) {
        return { bg: '#f1f5f9', text: '#94a3b8', level: 0 };
    }
    if (value <= umbrales.p20) {
        return { bg: '#dcfce7', text: '#166534', level: 1 }; // Verde claro
    }
    if (value <= umbrales.p40) {
        return { bg: '#86efac', text: '#166534', level: 2 }; // Verde
    }
    if (value <= umbrales.p60) {
        return { bg: '#fef08a', text: '#854d0e', level: 3 }; // Amarillo
    }
    if (value <= umbrales.p80) {
        return { bg: '#fdba74', text: '#9a3412', level: 4 }; // Naranja
    }
    return { bg: '#f87171', text: '#7f1d1d', level: 5 }; // Rojo
}

/**
 * Generates calendar data for a specific month
 * @param {Array} ventas - Sales data
 * @param {Date} fecha - Date within the target month
 * @returns {Object} Calendar data with days and stats
 */
export function generarCalendarioMes(ventas, fecha = new Date()) {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();

    // Get first and last day of month
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();

    // Day of week for first day (0=Sun, 1=Mon...)
    // Adjust for Monday start (0=Mon, 6=Sun)
    let primerDiaSemana = primerDia.getDay();
    primerDiaSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

    // Group sales by date
    const ventasPorDia = {};
    ventas.forEach(v => {
        const fechaVenta = (v.fecha || '').split('T')[0];
        if (fechaVenta) {
            if (!ventasPorDia[fechaVenta]) {
                ventasPorDia[fechaVenta] = 0;
            }
            ventasPorDia[fechaVenta] += parseFloat(v.total) || 0;
        }
    });

    // Get all values for this month to calculate percentiles
    const valoresMes = [];
    for (let d = 1; d <= diasEnMes; d++) {
        const fechaStr = `${año}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        valoresMes.push(ventasPorDia[fechaStr] || 0);
    }

    const umbrales = calcularUmbrales(valoresMes);

    // Generate calendar days
    const dias = [];

    // Empty cells for days before month starts
    for (let i = 0; i < primerDiaSemana; i++) {
        dias.push({ empty: true });
    }

    // Days of the month
    for (let d = 1; d <= diasEnMes; d++) {
        const fechaStr = `${año}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const valor = ventasPorDia[fechaStr] || 0;
        const color = getColorPorValor(valor, umbrales);
        const esFuturo = new Date(fechaStr) > new Date();

        dias.push({
            dia: d,
            fecha: fechaStr,
            valor: valor,
            color: color,
            esFuturo: esFuturo,
            esHoy: fechaStr === new Date().toISOString().split('T')[0]
        });
    }

    // Stats
    const totalMes = valoresMes.reduce((a, b) => a + b, 0);
    const diasConVentas = valoresMes.filter(v => v > 0).length;
    const mediaDiaria = diasConVentas > 0 ? totalMes / diasConVentas : 0;
    const mejorDia = Math.max(...valoresMes);

    return {
        año,
        mes,
        mesNombre: primerDia.toLocaleDateString('es-ES', { month: 'long' }),
        dias,
        stats: {
            totalMes: Math.round(totalMes),
            diasConVentas,
            mediaDiaria: Math.round(mediaDiaria),
            mejorDia: Math.round(mejorDia)
        },
        umbrales
    };
}

/**
 * Renders the calendar heatmap
 * @param {string} containerId - Container element ID
 * @param {Array} ventas - Sales data
 * @param {Date} fecha - Month to display
 */
export function renderCalendarioHeatmap(containerId, ventas, fecha = new Date()) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = generarCalendarioMes(ventas, fecha);

    const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    container.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 320px; margin: 0 auto;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <button onclick="window.cambiarMesCalendario(-1)" style="background: #f1f5f9; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">←</button>
                <div style="text-align: center;">
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b; text-transform: capitalize;">${data.mesNombre} ${data.año}</div>
                    <div style="font-size: 10px; color: #64748b;">${data.stats.totalMes.toLocaleString()}€</div>
                </div>
                <button onclick="window.cambiarMesCalendario(1)" style="background: #f1f5f9; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">→</button>
            </div>
            
            <!-- Days of week header -->
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px;">
                ${diasSemana.map(d => `<div style="text-align: center; font-size: 9px; color: #94a3b8; font-weight: 600;">${d}</div>`).join('')}
            </div>
            
            <!-- Calendar grid - COMPACT -->
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
                ${data.dias.map(dia => {
        if (dia.empty) {
            return `<div style="width: 100%; padding-top: 100%; position: relative;"></div>`;
        }

        const opacity = dia.esFuturo ? '0.4' : '1';
        const border = dia.esHoy ? '2px solid #3b82f6' : 'none';

        return `
                    <div 
                        onclick="window.verDetallesDia('${dia.fecha}')"
                        style="
                            width: 100%;
                            padding-top: 100%;
                            position: relative;
                            cursor: pointer;
                        "
                        title="${dia.dia}/${data.mes + 1}: ${dia.valor.toFixed(0)}€"
                    >
                        <div style="
                            position: absolute;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background: ${dia.color.bg};
                            border-radius: 3px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            opacity: ${opacity};
                            border: ${border};
                            font-size: 9px;
                            font-weight: 600;
                            color: ${dia.color.text};
                        ">${dia.dia}</div>
                    </div>
                `;
    }).join('')}
            </div>
            
            <!-- Legend - inline compact -->
            <div style="display: flex; justify-content: center; gap: 6px; margin-top: 8px;">
                <div style="display: flex; align-items: center; gap: 2px;">
                    <div style="width: 8px; height: 8px; background: #f1f5f9; border-radius: 1px;"></div>
                    <span style="font-size: 8px; color: #94a3b8;">0</span>
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <div style="width: 8px; height: 8px; background: #86efac; border-radius: 1px;"></div>
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <div style="width: 8px; height: 8px; background: #fef08a; border-radius: 1px;"></div>
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <div style="width: 8px; height: 8px; background: #fdba74; border-radius: 1px;"></div>
                </div>
                <div style="display: flex; align-items: center; gap: 2px;">
                    <div style="width: 8px; height: 8px; background: #f87171; border-radius: 1px;"></div>
                    <span style="font-size: 8px; color: #94a3b8;">Max</span>
                </div>
            </div>
            
            <!-- Stats - compact row -->
            <div style="display: flex; justify-content: space-around; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                <div style="text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: #10b981;">${data.stats.diasConVentas}</div>
                    <div style="font-size: 8px; color: #64748b;">Días</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: #6366f1;">${data.stats.mediaDiaria}€</div>
                    <div style="font-size: 8px; color: #64748b;">Media</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: #f97316;">${data.stats.mejorDia}€</div>
                    <div style="font-size: 8px; color: #64748b;">Mejor</div>
                </div>
            </div>
        </div>
    `;
}

// Current displayed month
let mesActual = new Date();

/**
 * Changes the displayed month
 */
export function cambiarMesCalendario(delta) {
    mesActual.setMonth(mesActual.getMonth() + delta);
    renderCalendarioHeatmap('calendario-ventas', window.ventas || [], mesActual);
}

/**
 * Shows details for a specific day
 */
export function verDetallesDia(fecha) {
    const ventas = (window.ventas || []).filter(v =>
        (v.fecha || '').startsWith(fecha)
    );

    if (ventas.length === 0) {
        window.showToast?.(`Sin ventas registradas el ${fecha}`, 'info');
        return;
    }

    const total = ventas.reduce((sum, v) => sum + (parseFloat(v.total) || 0), 0);
    window.showToast?.(`${fecha}: ${ventas.length} ventas, ${total.toFixed(2)}€ total`, 'success');
}

// Export to window
if (typeof window !== 'undefined') {
    window.renderCalendarioHeatmap = renderCalendarioHeatmap;
    window.cambiarMesCalendario = cambiarMesCalendario;
    window.verDetallesDia = verDetallesDia;
}

export default {
    generarCalendarioMes,
    renderCalendarioHeatmap,
    cambiarMesCalendario,
    verDetallesDia
};
