/**
 * MindLoop CostOS - Dossier Técnico v2.5
 * Documentación completa integrada en la aplicación
 */

import { getDateLocale } from '../../utils/helpers.js';

export function generarDossierHTML() {
    // 🔒 Auditoría Capa 7 (S9): locale dinámico (era 'es-ES' fijo)
    const fechaActual = new Date().toLocaleDateString(getDateLocale(), {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Dossier Técnico - MindLoop CostOS v2.5</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            line-height: 1.7;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #1e293b;
            background: #f8fafc;
        }
        
        /* Print Button */
        .no-print {
            position: sticky;
            top: 0;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
            z-index: 100;
            box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
        }
        .no-print p { color: white; margin-bottom: 15px; }
        .no-print button {
            padding: 14px 28px;
            background: white;
            color: #7c3aed;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
            font-size: 1em;
            transition: transform 0.2s;
        }
        .no-print button:hover { transform: scale(1.05); }
        
        /* Cover */
        .cover {
            text-align: center;
            padding: 80px 40px;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%);
            color: white;
            border-radius: 20px;
            margin-bottom: 40px;
            box-shadow: 0 10px 40px rgba(124, 58, 237, 0.4);
        }
        .cover h1 { font-size: 3em; margin-bottom: 15px; }
        .cover .subtitle { font-size: 1.3em; opacity: 0.95; margin-bottom: 20px; }
        .cover .version { 
            display: inline-block;
            background: rgba(255,255,255,0.2);
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 0.95em;
        }
        
        /* TOC */
        .toc {
            background: white;
            padding: 35px;
            border-radius: 16px;
            margin-bottom: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .toc h2 { color: #7c3aed; margin-bottom: 20px; font-size: 1.4em; }
        .toc ul { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .toc li { padding: 10px 15px; background: #f8fafc; border-radius: 8px; }
        .toc a { color: #475569; text-decoration: none; font-weight: 500; }
        .toc a:hover { color: #7c3aed; }
        
        /* Sections */
        h2 {
            margin-top: 60px;
            padding: 20px 25px;
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            border-radius: 12px;
            font-size: 1.5em;
        }
        h3 { color: #334155; margin: 30px 0 15px; font-size: 1.2em; }
        h4 { color: #64748b; margin: 20px 0 10px; }
        
        /* Cards */
        .section-intro {
            background: white;
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border-left: 5px solid #7c3aed;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        /* Formula Box */
        .formula {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 1.1em;
            margin: 20px 0;
            text-align: center;
        }
        .formula-name {
            display: block;
            color: #a5b4fc;
            margin-bottom: 10px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.85em;
            letter-spacing: 1px;
        }
        
        /* Example Box */
        .example {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border: 1px solid #a7f3d0;
        }
        .example-title { font-weight: 700; color: #059669; margin-bottom: 12px; }
        
        /* Warning Box */
        .warning {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border: 1px solid #fcd34d;
        }
        .warning-title { font-weight: 700; color: #d97706; margin-bottom: 12px; }
        
        /* Tip Box */
        .tip {
            background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border: 1px solid #c4b5fd;
        }
        .tip-title { font-weight: 700; color: #7c3aed; margin-bottom: 12px; }
        
        /* Wine Box (NEW) */
        .wine-box {
            background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
            padding: 25px;
            border-radius: 12px;
            margin: 20px 0;
            border: 2px solid #f9a8d4;
        }
        .wine-title { font-weight: 700; color: #be185d; margin-bottom: 12px; }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        th {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td { padding: 15px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        tr:last-child td { border-bottom: none; }
        
        /* Icon Grid */
        .icon-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin: 25px 0;
        }
        .icon-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            transition: transform 0.2s;
        }
        .icon-card:hover { transform: translateY(-3px); }
        .icon-card .emoji { font-size: 2.5em; margin-bottom: 12px; }
        .icon-card h4 { margin: 0 0 8px; color: #1e293b; }
        .icon-card p { margin: 0; font-size: 0.9em; color: #64748b; }
        
        /* Thresholds Visual */
        .thresholds {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 20px 0;
        }
        .threshold-item {
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            font-weight: 600;
        }
        .threshold-green { background: #dcfce7; color: #166534; }
        .threshold-yellow { background: #fef9c3; color: #854d0e; }
        .threshold-orange { background: #ffedd5; color: #9a3412; }
        .threshold-red { background: #fee2e2; color: #991b1b; }
        
        /* Comparison Table */
        .comparison-table {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        .comparison-item {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .comparison-item h4 { color: #7c3aed; margin-bottom: 15px; }
        
        /* Footer */
        footer {
            margin-top: 60px;
            text-align: center;
            padding: 40px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            border-radius: 16px;
            color: white;
        }
        footer strong { color: #a5b4fc; }
        
        /* Print Styles */
        @media print {
            body { background: white; padding: 20px; }
            .no-print { display: none !important; }
            .cover { padding: 50px; page-break-after: always; }
            h2 { page-break-before: always; }
            .formula, .example, .tip, .warning { break-inside: avoid; }
        }
        
        /* Lists */
        ul, ol { margin: 15px 0 15px 25px; }
        li { margin: 8px 0; }
    </style>
</head>
<body>

<!-- PRINT BUTTON -->
<div class="no-print">
    <p><strong>💡 Para guardar como PDF:</strong> Haz clic en el botón y selecciona "Guardar como PDF" en el destino de impresión.</p>
    <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</div>

<!-- COVER -->
<div class="cover">
    <h1>📘 Dossier Técnico</h1>
    <p class="subtitle">Guía Completa de Fórmulas, Cálculos y Uso del Sistema</p>
    <span class="version">MindLoop CostOS v2.5 Premium | ${fechaActual}</span>
</div>

<!-- TOC -->
<div class="toc">
    <h2>📑 Índice de Contenidos</h2>
    <ul>
        <li><a href="#intro">1. Introducción al Sistema</a></li>
        <li><a href="#ingredientes">2. Gestión de Ingredientes</a></li>
        <li><a href="#recetas">3. Recetas y Costing</a></li>
        <li><a href="#vinos">4. Vinos y Variantes</a></li>
        <li><a href="#pedidos">5. Gestión de Pedidos</a></li>
        <li><a href="#inventario">6. Control de Inventario</a></li>
        <li><a href="#ventas">7. Registro de Ventas</a></li>
        <li><a href="#pl">8. Beneficio Neto (P&L)</a></li>
        <li><a href="#finanzas">9. Análisis Financiero</a></li>
        <li><a href="#escandallo">10. Escandallo Visual</a></li>
        <li><a href="#mermas">11. Control de Mermas</a></li>
        <li><a href="#forecast">12. Proyección de Ventas</a></li>
        <li><a href="#chatbot">13. Asistente IA</a></li>
        <li><a href="#faq">14. Preguntas Frecuentes</a></li>
    </ul>
</div>

<!-- 1. INTRODUCCIÓN -->
<h2 id="intro">1. 🎯 Introducción al Sistema</h2>
<div class="section-intro">
    <p><strong>MindLoop CostOS</strong> es una herramienta profesional de gestión de costes para restaurantes. Permite controlar ingredientes, calcular el coste real de cada plato, gestionar pedidos con proveedores, y obtener análisis financieros en tiempo real.</p>
</div>

<div class="icon-grid">
    <div class="icon-card">
        <div class="emoji">🥬</div>
        <h4>Ingredientes</h4>
        <p>Gestión de stock y precios</p>
    </div>
    <div class="icon-card">
        <div class="emoji">🍽️</div>
        <h4>Recetas</h4>
        <p>Costing y márgenes</p>
    </div>
    <div class="icon-card">
        <div class="emoji">🍷</div>
        <h4>Vinos</h4>
        <p>Variantes copa/botella</p>
    </div>
    <div class="icon-card">
        <div class="emoji">📊</div>
        <h4>Análisis</h4>
        <p>Dashboard financiero</p>
    </div>
</div>

<!-- 2. INGREDIENTES -->
<h2 id="ingredientes">2. 🥬 Gestión de Ingredientes</h2>
<div class="section-intro">
    <p>Los ingredientes son la base del sistema. Cada uno tiene un <strong>precio unitario</strong> que se calcula automáticamente según el formato de compra.</p>
</div>

<h3>Campos de un Ingrediente</h3>
<table>
    <tr><th>Campo</th><th>Descripción</th><th>Ejemplo</th></tr>
    <tr><td><strong>Nombre</strong></td><td>Identificador único</td><td>Mejillón de Roca</td></tr>
    <tr><td><strong>Familia</strong></td><td>Categoría de organización</td><td>Mariscos / Bebidas</td></tr>
    <tr><td><strong>Unidad</strong></td><td>Medida base</td><td>kg, L, ud</td></tr>
    <tr><td><strong>Precio Formato</strong></td><td>Coste de compra</td><td>85.00 €</td></tr>
    <tr><td><strong>Cantidad por Formato</strong></td><td>Unidades en el formato</td><td>10 kg</td></tr>
    <tr><td><strong>Stock Actual</strong></td><td>Cantidad disponible</td><td>25.00 kg</td></tr>
    <tr><td><strong>Stock Mínimo</strong></td><td>Umbral para alertas</td><td>5.00 kg</td></tr>
</table>

<div class="formula">
    <span class="formula-name">Precio Unitario</span>
    Precio Unitario = Precio Formato ÷ Cantidad por Formato
</div>

<div class="example">
    <div class="example-title">📌 Ejemplo: Mejillón</div>
    <p>Compras una caja de mejillón a <strong>85€</strong> que contiene <strong>10 kg</strong></p>
    <p>Precio Unitario = 85 ÷ 10 = <strong>8.50 €/kg</strong></p>
</div>

<h3>Precio Nominal vs Precio Medio de Compra</h3>
<div class="section-intro">
    <p>Cada ingrediente convive con <strong>dos precios distintos</strong> que la app calcula y usa en contextos diferentes. Entender la diferencia es clave para leer bien tus costes.</p>
</div>

<table>
    <tr><th>Concepto</th><th>De dónde sale</th><th>Cuándo cambia</th></tr>
    <tr>
        <td><strong>Precio Nominal</strong></td>
        <td>Lo que escribiste al crear el ingrediente (Precio Formato ÷ Cantidad por Formato)</td>
        <td>Solo cuando <strong>tú lo editas</strong></td>
    </tr>
    <tr>
        <td><strong>Precio Medio de Compra</strong></td>
        <td>Promedio de los albaranes recibidos los últimos <strong>90 días</strong></td>
        <td>Cada vez que <strong>registras un pedido</strong></td>
    </tr>
</table>

<div class="formula">
    <span class="formula-name">Cascada de Prioridad del Precio Unitario</span>
    1º Precio Medio de Compra (si hay albaranes)<br>
    2º Precio Medio configurado en inventario<br>
    3º Precio Nominal (Precio Formato ÷ Cantidad por Formato) — fallback
</div>

<div class="example">
    <div class="example-title">📌 Analogía para entenderlo</div>
    <p>Imagina que al abrir el bar calculaste "el café me debe costar 0.30 € por taza". Ese es tu <strong>precio nominal</strong> — tu plan.</p>
    <p>Operas unos meses y la realidad dice que has pagado <strong>0.33 €/taza</strong> de media. Ese es el <strong>precio medio de compra</strong> — lo que está pasando de verdad.</p>
    <p>La diferencia entre ambos es una <strong>alarma valiosa</strong>: o tus proveedores subieron, o tu plan estaba mal. El sistema te deja verlos separados para decidir qué hacer.</p>
</div>

<h3>Cuándo se usa cada uno</h3>
<ul>
    <li><strong>Dashboard, P&L mensual, Food Cost operativo, Análisis, Chat IA, registro de Ventas</strong> → usan siempre el <strong>precio real</strong> (cascada completa). Queremos que reflejen la realidad económica.</li>
    <li><strong>Modal del Escandallo</strong> → puedes elegir con el toggle entre <strong>Real</strong> (default) y <strong>Nominal</strong>. Solo afecta a lo que ves en ese modal — nada de lo anterior cambia.</li>
    <li><strong>Valoración de Stock</strong> → siempre usa precio configurado, no el medio de compra.</li>
</ul>

<div class="example" style="border-color:#f59e0b;background:#fef3c7;">
    <div class="example-title">⚠️ Por qué importa tener ambos</div>
    <p>Si el sistema <strong>solo usara precio real</strong>, un único albarán metido con error (OCR, typo) contaminaría la media de 90 días y rompería el food cost de ese ingrediente en todas las recetas.</p>
    <p>Con ambos precios visibles, una desviación enorme entre nominal y real es un <strong>chivato inmediato</strong> de que hay que revisar las compras de ese ingrediente.</p>
</div>

<!-- 3. RECETAS -->
<h2 id="recetas">3. 🍽️ Recetas y Costing</h2>
<div class="section-intro">
    <p>El sistema calcula automáticamente el <strong>coste de cada plato</strong> sumando el coste de todos sus ingredientes según las cantidades definidas en la receta.</p>
</div>

<div class="formula">
    <span class="formula-name">Coste de Receta</span>
    Coste Total = Σ (Cantidad Ingrediente × Precio Unitario)
</div>

<p style="font-size:0.92em;color:#475569;margin:10px 0 15px 0;">
    El <strong>Precio Unitario</strong> sigue la cascada descrita en la sección 2: primero el
    precio medio real de las compras de los últimos 90 días y, si no hay histórico, cae al precio
    nominal configurado. Por eso si tus proveedores suben precios, el coste de tus recetas se
    actualiza automáticamente sin que tengas que tocar nada.
</p>

<div class="example">
    <div class="example-title">📌 Ejemplo: Mejillones al Vapor</div>
    <table>
        <tr><th>Ingrediente</th><th>Cantidad</th><th>Precio Unit.</th><th>Coste</th></tr>
        <tr><td>Mejillón</td><td>0.400 kg</td><td>8.50 €/kg</td><td>3.40 €</td></tr>
        <tr><td>Vino Blanco</td><td>0.050 L</td><td>4.00 €/L</td><td>0.20 €</td></tr>
        <tr><td>Ajo</td><td>0.010 kg</td><td>6.00 €/kg</td><td>0.06 €</td></tr>
        <tr><td>Perejil</td><td>0.005 kg</td><td>12.00 €/kg</td><td>0.06 €</td></tr>
        <tr style="background:#ecfdf5;"><td colspan="3"><strong>TOTAL</strong></td><td><strong>3.72 €</strong></td></tr>
    </table>
</div>

<h3>Food Cost y Margen</h3>
<div class="formula">
    <span class="formula-name">Food Cost (%)</span>
    Food Cost = (Coste Receta ÷ Precio Venta) × 100
</div>

<div class="formula">
    <span class="formula-name">Margen de Beneficio</span>
    Margen (€) = Precio Venta - Coste Receta<br>
    Margen (%) = (Margen € ÷ Precio Venta) × 100
</div>

<div class="example">
    <div class="example-title">📌 Ejemplo: Cálculo de Rentabilidad</div>
    <p>PVP: <strong>14.00€</strong> | Coste: <strong>3.72€</strong></p>
    <p>Food Cost = (3.72 ÷ 14.00) × 100 = <strong>26.6%</strong> 🟢</p>
    <p>Margen = 14.00 - 3.72 = <strong>10.28€ (73.4%)</strong></p>
</div>

<h3>Umbrales de Rentabilidad - COMIDA</h3>
<div class="thresholds">
    <div class="threshold-item threshold-green">🟢 ≤30%<br><small>MUY RENTABLE</small></div>
    <div class="threshold-item threshold-yellow">🟡 31-35%<br><small>RENTABLE</small></div>
    <div class="threshold-item threshold-orange">🟠 36-40%<br><small>AJUSTADO</small></div>
    <div class="threshold-item threshold-red">🔴 >40%<br><small>NO RENTABLE</small></div>
</div>

<div class="formula">
    <span class="formula-name">Precio Ideal (objetivo 30%)</span>
    Precio Ideal = Coste ÷ 0.30
</div>

<!-- 4. VINOS -->
<h2 id="vinos">4. 🍷 Vinos y Variantes</h2>
<div class="wine-box">
    <div class="wine-title">⚠️ Importante: Los vinos tienen umbrales DIFERENTES</div>
    <p>Los vinos son productos de reventa con menor margen natural. Un food cost del <strong>45-50%</strong> es <strong>NORMAL</strong> para vinos, mientras que para comida sería problemático.</p>
</div>

<h3>Umbrales de Rentabilidad - VINOS</h3>
<div class="thresholds">
    <div class="threshold-item threshold-green" style="flex:1;">🟢 ≤40%<br><small>EXCELENTE</small></div>
    <div class="threshold-item threshold-yellow" style="flex:1;">🟡 41-50%<br><small>NORMAL</small></div>
    <div class="threshold-item threshold-red" style="flex:2;">🔴 >50%<br><small>REVISAR PRECIO</small></div>
</div>

<h3>Sistema de Variantes (Copa/Botella)</h3>
<div class="section-intro">
    <p>Cada vino puede tener múltiples formatos de venta con diferentes precios y un <strong>factor de coste</strong>:</p>
</div>

<table>
    <tr><th>Variante</th><th>Factor</th><th>Descripción</th></tr>
    <tr><td><strong>Botella</strong></td><td>1.000x</td><td>Formato completo (100% del coste)</td></tr>
    <tr><td><strong>Copa</strong></td><td>0.200x</td><td>1/5 de botella (20% del coste)</td></tr>
</table>

<div class="formula">
    <span class="formula-name">Coste por Variante</span>
    Coste Variante = Coste Botella × Factor
</div>

<div class="example">
    <div class="example-title">📌 Ejemplo: Vino Catro e Cadela</div>
    <p>Coste botella: <strong>8.25€</strong></p>
    <table>
        <tr><th>Variante</th><th>Factor</th><th>Coste</th><th>PVP</th><th>Margen</th><th>Food Cost</th></tr>
        <tr><td>Botella</td><td>1.0x</td><td>8.25€</td><td>22.00€</td><td>13.75€</td><td>🟢 37.5%</td></tr>
        <tr><td>Copa</td><td>0.2x</td><td>1.65€</td><td>4.00€</td><td>2.35€</td><td>🟡 41.3%</td></tr>
    </table>
</div>

<div class="formula">
    <span class="formula-name">Precio Ideal para Vinos (objetivo 45%)</span>
    Precio Ideal = Coste ÷ 0.45
</div>

<div class="example">
    <div class="example-title">📌 Ejemplo: Cálculo Precio Ideal Vino</div>
    <p>Coste de botella: <strong>11.20€</strong></p>
    <p>Precio Ideal (45%) = 11.20 ÷ 0.45 = <strong>24.89€</strong></p>
    <p><em>Nunca uses el 30% para vinos - resultaría en precios demasiado altos.</em></p>
</div>

<!-- 5. PEDIDOS -->
<h2 id="pedidos">5. 📦 Gestión de Pedidos</h2>
<div class="section-intro">
    <p>El sistema permite registrar pedidos a proveedores y detectar <strong>varianzas</strong> al recibirlos.</p>
</div>

<table>
    <tr><th>Estado</th><th>Descripción</th></tr>
    <tr><td>🟡 <strong>Pendiente</strong></td><td>Pedido creado, esperando recepción</td></tr>
    <tr><td>🟢 <strong>Recibido</strong></td><td>Consolidado con datos reales</td></tr>
</table>

<div class="formula">
    <span class="formula-name">Control de Varianzas</span>
    Varianza Cantidad = Cantidad Recibida - Cantidad Pedida<br>
    Varianza Precio = (Precio Real - Precio Original) × Cantidad<br>
    Varianza Total = Total Recibido - Total Original
</div>

<!-- 6. INVENTARIO -->
<h2 id="inventario">6. 📋 Control de Inventario</h2>
<div class="section-intro">
    <p>Compara el <strong>stock teórico</strong> (calculado) con el <strong>stock real</strong> (conteo físico) para detectar mermas.</p>
</div>

<div class="formula">
    <span class="formula-name">Stock Teórico</span>
    Stock Teórico = Stock Anterior + Compras - Consumo (Ventas)
</div>

<div class="formula">
    <span class="formula-name">Diferencia (Merma)</span>
    Diferencia = Stock Real - Stock Teórico
</div>

<div class="warning">
    <div class="warning-title">⚠️ Interpretación de Diferencias</div>
    <ul>
        <li><strong>Diferencia Negativa:</strong> Falta stock → mermas, robos, consumos no registrados</li>
        <li><strong>Diferencia Positiva:</strong> Sobra stock → errores en registro de ventas</li>
        <li><strong>Diferencia = 0:</strong> Stock perfectamente cuadrado ✅</li>
    </ul>
</div>

<!-- 7. VENTAS -->
<h2 id="ventas">7. 💰 Registro de Ventas</h2>
<div class="section-intro">
    <p>Cada venta descuenta automáticamente los ingredientes del stock y actualiza los KPIs.</p>
</div>

<div class="formula">
    <span class="formula-name">Descuento de Stock por Venta</span>
    Nuevo Stock = Stock Actual - (Cantidad Receta × Unidades Vendidas)
</div>

<!-- 8. P&L DIARIO -->
<h2 id="pl">8. 💰 Beneficio Neto por Día (P&L)</h2>
<div class="section-intro">
    <p>El sistema calcula el <strong>beneficio neto real</strong> de cada día, incluyendo la parte proporcional de gastos fijos.</p>
</div>

<div class="formula">
    <span class="formula-name">Beneficio Neto del Día</span>
    Beneficio Neto = Ingresos − Costes MP − (Gastos Fijos Mes ÷ Días del Mes)
</div>

<div class="formula">
    <span class="formula-name">Gasto Fijo Diario</span>
    Gasto Diario = Total Gastos Mensuales ÷ Días del Mes<br>
    Ejemplo: 800€ ÷ 31 días = 25.81€/día
</div>

<h3>Estados de los Días</h3>
<table>
    <tr><th>Icono</th><th>Estado</th><th>Significado</th></tr>
    <tr><td>✅</td><td>Día rentable</td><td>Beneficio positivo</td></tr>
    <tr><td>❌</td><td>Día con pérdida</td><td>Ventas insuficientes</td></tr>
    <tr><td>🔘</td><td>Día cerrado</td><td>Sin ventas, solo gastos fijos</td></tr>
</table>

<div class="example">
    <div class="example-title">📌 Ejemplo: Día con Ventas</div>
    <table>
        <tr><td>Ingresos del día</td><td style="text-align:right;">345.00€</td></tr>
        <tr><td>− Coste ingredientes</td><td style="text-align:right;color:#ef4444;">-80.00€</td></tr>
        <tr><td>− Gastos fijos diarios</td><td style="text-align:right;color:#ef4444;">-25.81€</td></tr>
        <tr style="background:#ecfdf5;font-weight:bold;"><td>= Beneficio Neto</td><td style="text-align:right;color:#10b981;">+239.19€ ✅</td></tr>
    </table>
</div>

<div class="tip">
    <div class="tip-title">💡 ¿Qué significa el número verde?</div>
    <p>El número grande a la derecha es el <strong>BENEFICIO NETO ACUMULADO</strong> hasta ese día, no las ventas totales. Es lo que te queda después de pagar ingredientes y gastos fijos.</p>
</div>

<div class="warning">
    <div class="warning-title">⚠️ Importante</div>
    <p>Los gastos fijos se restan <strong>todos los días</strong>, incluso cuando el restaurante está cerrado. Esto refleja la realidad contable: el alquiler se paga igual trabajes o no.</p>
</div>

<!-- 9. FINANZAS -->
<h2 id="finanzas">9. 💼 Análisis Financiero</h2>

<div class="formula">
    <span class="formula-name">Punto de Equilibrio (Break-Even)</span>
    Punto de Equilibrio = Gastos Fijos ÷ % Margen Bruto
</div>

<div class="example">
    <div class="example-title">📌 Ejemplo: Punto de Equilibrio</div>
    <p>Gastos Fijos: <strong>800€/mes</strong> | Margen Bruto: <strong>65%</strong></p>
    <p>Punto de Equilibrio = 800 ÷ 0.65 = <strong>1,230€</strong></p>
    <p><em>Debes facturar al menos 1,230€ para no tener pérdidas.</em></p>
</div>

<!-- 10. ESCANDALLO -->
<h2 id="escandallo">10. 📊 Escandallo Visual</h2>
<div class="section-intro">
    <p>El escandallo muestra el <strong>desglose de costes</strong> de cada receta con un gráfico circular interactivo.</p>
</div>

<div class="formula">
    <span class="formula-name">Porcentaje de cada Ingrediente</span>
    % Ingrediente = (Coste Ingrediente ÷ Coste Total) × 100
</div>

<h3>Información Mostrada</h3>
<ul>
    <li>📊 <strong>Gráfico Circular:</strong> Proporción visual de cada ingrediente</li>
    <li>📋 <strong>Tabla Desglose:</strong> Ordenado de mayor a menor coste</li>
    <li>📈 <strong>KPIs:</strong> Coste total, PVP, Margen, Food Cost</li>
    <li>📄 <strong>Exportar PDF:</strong> Ficha técnica profesional (incluye el modo de precio activo)</li>
</ul>

<h3>Modo de Precio: Real vs Nominal <span style="font-size:0.7em;color:#7c3aed;">(v2.5)</span></h3>
<div class="section-intro">
    <p>Arriba del modal hay un toggle <strong>Real (compras) / Nominal (configurado)</strong> que
    cambia qué precio se usa para calcular el coste visible. Es <strong>puramente informativo</strong>:
    ni ventas ni P&L ni dashboard se ven afectados.</p>
</div>

<table>
    <tr><th>Modo</th><th>Precio usado</th><th>Para qué sirve</th></tr>
    <tr>
        <td><strong>Real (compras)</strong> <em>[default]</em></td>
        <td>Cascada completa: media real de compras &gt; precio medio &gt; nominal</td>
        <td>Ver el coste que <strong>está pasando ahora</strong> según tus albaranes</td>
    </tr>
    <tr>
        <td><strong>Nominal (configurado)</strong></td>
        <td>Solo el precio que declaraste al crear el ingrediente</td>
        <td>Ver el coste <strong>teórico</strong> que planeaste — útil al diseñar el plato</td>
    </tr>
</table>

<h3>Banner de Desviación</h3>
<div class="section-intro">
    <p>Justo debajo del toggle aparece un <strong>banner</strong> que compara ambos costes de ración:
    <code>Nominal · Real · Δ%</code>. Es el termómetro de salud del plato.</p>
</div>

<ul>
    <li>🔵 <strong>Banner azul</strong> (desviación &lt; 15%): precios coherentes, todo bajo control.</li>
    <li>🟡 <strong>Banner amarillo</strong> (desviación ≥ 15%): algo a revisar — puede ser subida real
    de proveedor o, en los casos peligrosos, un albarán envenenado (OCR con precio mal leído).</li>
</ul>

<div class="example" style="border-color:#f59e0b;background:#fef3c7;">
    <div class="example-title">⚠️ Caso real: "PAN POR PERSONA" (La Nave 5, abril 2026)</div>
    <p>Una fila huérfana en la tabla de compras tenía el pan a <strong>12.95 €/kg</strong> (cuando
    el pan real cuesta 2.20 €/kg). Al ser la única compra registrada de pan en 90 días, monopolizó
    el precio medio y el escandallo mostraba:</p>
    <ul style="margin:8px 0 8px 20px;">
        <li>Coste ración: 0.72 € (lo real era 0.12 €)</li>
        <li>Food Cost: 143.9% (lo real era 24.4%)</li>
        <li>Margen: -43.9%</li>
    </ul>
    <p>Con el toggle activo, <strong>el modo Nominal habría mostrado 0.12 €</strong> y el banner
    amarillo habría delatado una desviación de <strong>+489%</strong> al instante. Por eso el toggle
    existe: convertir un diagnóstico que antes requería SQL en un vistazo al modal.</p>
</div>

<h3>Regla práctica de interpretación</h3>
<table>
    <tr><th>Desviación Real vs Nominal</th><th>Qué hacer</th></tr>
    <tr><td>±5% o menos</td><td>✅ Todo en orden, no tocar nada</td></tr>
    <tr><td>±5-15%</td><td>🔵 Banner informativo: fluctuación normal de precios</td></tr>
    <tr><td>>15%</td><td>🟡 Banner alerta: revisar compras del ingrediente principal, puede ser OCR mal leído o subida real de proveedor</td></tr>
</table>

<div class="example">
    <div class="example-title">📌 Ejemplo saludable: AMEIXAS</div>
    <p>Nominal 22 €/kg · Real 23.17 €/kg · <strong>+5.3%</strong> · 29 compras registradas en 90 días.</p>
    <p>Diagnóstico: el marisco fresco fluctúa, los proveedores están cobrando un pelín más que el
    nominal configurado. Si quieres alinear, editar el ingrediente y poner precio 23 €/kg. No urgente.</p>
</div>

<!-- 11. MERMAS -->
<h2 id="mermas">11. 🗑️ Control de Mermas</h2>
<div class="section-intro">
    <p>Registra pérdidas de producto descontando automáticamente del stock y calculando el impacto económico.</p>
</div>

<div class="formula">
    <span class="formula-name">Impacto Económico de Merma</span>
    Pérdida (€) = Cantidad × Precio Unitario
</div>

<div class="example">
    <div class="example-title">📌 Ejemplo: Merma de Pulpo</div>
    <p>Se detecta que <strong>0.5 kg</strong> de pulpo está en mal estado.</p>
    <p>Precio: <strong>41.90 €/kg</strong></p>
    <p>Pérdida = 0.5 × 41.90 = <strong>20.95€</strong></p>
</div>

<!-- 12. FORECAST -->
<h2 id="forecast">12. 📈 Proyección de Ventas</h2>
<div class="section-intro">
    <p>Predicción de la facturación de los próximos 7 días usando algoritmos de <strong>media móvil ponderada</strong>.</p>
</div>

<div class="formula">
    <span class="formula-name">Media Móvil Ponderada (WMA)</span>
    Predicción = Σ (Peso[i] × Venta[día-i]) ÷ Σ Pesos<br>
    <small>Pesos: [3, 2.5, 2, 1.5, 1, 0.8, 0.6] - más peso a días recientes</small>
</div>

<div class="formula">
    <span class="formula-name">Factor de Día de Semana</span>
    Factor = Media histórica del día ÷ Media global<br>
    Predicción Final = WMA × Factor día semana
</div>

<h3>Niveles de Confianza</h3>
<table>
    <tr><th>Nivel</th><th>Datos Requeridos</th><th>Precisión</th></tr>
    <tr><td>🟢 <strong>Alta</strong></td><td>30+ días</td><td>85-95%</td></tr>
    <tr><td>🟡 <strong>Media</strong></td><td>14-30 días</td><td>70-85%</td></tr>
    <tr><td>🟠 <strong>Baja</strong></td><td>7-14 días</td><td>50-70%</td></tr>
    <tr><td>🔴 <strong>Muy Baja</strong></td><td>&lt;7 días</td><td>&lt;50%</td></tr>
</table>

<!-- 13. CHATBOT -->
<h2 id="chatbot">13. 🤖 Asistente IA (Chatbot)</h2>
<div class="section-intro">
    <p>El chatbot integrado puede responder preguntas sobre tu negocio consultando la base de datos en tiempo real.</p>
</div>

<h3>Preguntas que Puede Responder</h3>
<table>
    <tr><th>Tipo</th><th>Ejemplos de Preguntas</th></tr>
    <tr><td>📊 Rentabilidad</td><td>"¿Qué platos están perdiendo dinero?"</td></tr>
    <tr><td>📦 Stock</td><td>"¿Qué ingredientes tengo bajo mínimos?"</td></tr>
    <tr><td>🍷 Vinos</td><td>"¿Cuál es el precio ideal del vino X para 45%?"</td></tr>
    <tr><td>👥 Proveedores</td><td>"¿Qué ingredientes tienen dos proveedores?"</td></tr>
    <tr><td>🍽️ Raciones</td><td>"¿Cuántas raciones de pulpo puedo hacer?"</td></tr>
    <tr><td>👷 Personal</td><td>"¿Quién trabaja hoy?"</td></tr>
</table>

<div class="tip">
    <div class="tip-title">💡 Consejo</div>
    <p>El chatbot usa <strong>fórmulas diferentes para comida y vinos</strong>. Cuando preguntes sobre precios ideales de vinos, automáticamente aplica el objetivo del 45% en lugar del 30%.</p>
</div>

<!-- 14. FAQ -->
<h2 id="faq">14. ❓ Preguntas Frecuentes</h2>

<h3>¿Por qué el número verde no coincide con mis ventas?</h3>
<p>El número verde es el <strong>BENEFICIO NETO ACUMULADO</strong>, no las ventas. Es lo que queda después de restar costes de ingredientes y gastos fijos.</p>

<h3>¿Por qué los días sin ventas muestran -25.81€?</h3>
<p>Es la parte diaria de los gastos fijos (800€ ÷ 31 días). Los gastos fijos se pagan igual trabajes o no.</p>

<h3>¿Por qué el vino tiene food cost del 45% y aparece en amarillo?</h3>
<p>Para vinos, un food cost del 40-50% es <strong>NORMAL</strong>. El sistema usa umbrales diferentes: comida objetivo 30%, vinos objetivo 45-50%.</p>

<h3>¿Cómo calculo el precio ideal de un vino?</h3>
<div class="formula">
    Precio Ideal Vino = Coste ÷ 0.45
</div>

<h3>¿Por qué el coste de la copa muestra 0€?</h3>
<p>Revisa que la receta del vino tenga ingredientes asignados. El coste se calcula: <code>Coste Copa = Coste Botella × Factor Copa (0.2)</code></p>

<h3>¿Cómo mejoro mi food cost?</h3>
<ol>
    <li>Negociar precios con proveedores</li>
    <li>Estandarizar porciones</li>
    <li>Reducir mermas</li>
    <li>Promocionar platos de alto margen</li>
    <li>Revisar recetas con ingredientes caros</li>
</ol>

<!-- RESUMEN FORMULAS -->
<h2>📋 Resumen de Fórmulas</h2>
<table>
    <tr><th>Concepto</th><th>Fórmula</th></tr>
    <tr><td>Precio Unitario</td><td><code>Precio Formato ÷ Cantidad Formato</code></td></tr>
    <tr><td>Coste Receta</td><td><code>Σ (Cantidad × Precio Unitario)</code></td></tr>
    <tr><td>Food Cost</td><td><code>(Coste ÷ PVP) × 100</code></td></tr>
    <tr><td>Margen</td><td><code>PVP - Coste</code></td></tr>
    <tr><td>Precio Ideal Comida (30%)</td><td><code>Coste ÷ 0.30</code></td></tr>
    <tr><td>Precio Ideal Vinos (45%)</td><td><code>Coste ÷ 0.45</code></td></tr>
    <tr><td>Coste Variante</td><td><code>Coste Base × Factor</code></td></tr>
    <tr><td>Beneficio Neto Diario</td><td><code>Ingresos − Costes − (GF mes ÷ días)</code></td></tr>
    <tr><td>Punto de Equilibrio</td><td><code>Gastos Fijos ÷ % Margen</code></td></tr>
</table>

<!-- FOOTER -->
<footer>
    <strong>MindLoop CostOS</strong><br>
    Sistema Profesional de Gestión de Costes para Restauración<br><br>
    Documento generado el ${fechaActual}<br>
    © ${new Date().getFullYear()} MindLoop. Todos los derechos reservados.
</footer>

</body>
</html>
    `;
}

// Función para abrir el dossier
export function abrirDossier() {
    const ventana = window.open('', '_blank');
    if (ventana) {
        ventana.document.write(generarDossierHTML());
        ventana.document.close();
    }
}

// Exponer globalmente
window.abrirDossierV24 = abrirDossier;
