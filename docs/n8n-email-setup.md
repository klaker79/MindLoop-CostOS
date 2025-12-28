# n8n Email Diario - Guía de Configuración

## Objetivo
Enviar un email diario a las 23:00 con el resumen de KPIs del restaurante.

---

## Workflow n8n

### Nodos necesarios:

```
[Schedule Trigger] → [HTTP Request] → [Set] → [Send Email]
```

### 1. Schedule Trigger
- **Tipo**: Cron
- **Expresión**: `0 23 * * *` (cada día a las 23:00)

### 2. HTTP Request (Obtener datos de Supabase)
- **Método**: GET
- **URL**: `https://[TU_SUPABASE_URL].supabase.co/rest/v1/ventas?fecha=gte.{{ $now.format('yyyy-MM-dd') }}`
- **Headers**:
  - `apikey`: tu anon key de Supabase
  - `Authorization`: `Bearer [tu_anon_key]`

### 3. Set (Calcular KPIs)
```javascript
// En el nodo Set, añade estas expresiones
const ventas = $input.all();
const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.json.total || 0), 0);
const numVentas = ventas.length;

return {
  ingresos: totalVentas.toFixed(2),
  numVentas: numVentas,
  ticketMedio: numVentas > 0 ? (totalVentas / numVentas).toFixed(2) : 0
};
```

### 4. Send Email
- **Tipo**: Gmail / SMTP
- **Para**: tu email
- **Asunto**: `📊 Resumen Diario - {{ $now.format('dd/MM/yyyy') }}`
- **Contenido HTML**: Ver template abajo

---

## Template Email HTML

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0; opacity: 0.9; }
    .content { padding: 30px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .kpi-card { background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; }
    .kpi-card .value { font-size: 28px; font-weight: 700; color: #1e293b; }
    .kpi-card .label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 5px; }
    .kpi-card.green .value { color: #10b981; }
    .kpi-card.purple .value { color: #8b5cf6; }
    .cta { display: block; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 10px; text-decoration: none; font-weight: 600; }
    .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Resumen Diario</h1>
      <p>{{ $now.format('EEEE, d MMMM yyyy') }}</p>
    </div>
    <div class="content">
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="value">{{ $json.ingresos }}€</div>
          <div class="label">Ingresos</div>
        </div>
        <div class="kpi-card">
          <div class="value">{{ $json.numVentas }}</div>
          <div class="label">Ventas</div>
        </div>
        <div class="kpi-card purple">
          <div class="value">{{ $json.ticketMedio }}€</div>
          <div class="label">Ticket Medio</div>
        </div>
        <div class="kpi-card">
          <div class="value">--</div>
          <div class="label">Margen</div>
        </div>
      </div>
      <a href="https://klaker79.github.io/MindLoop-CostOS/" class="cta">Ver Dashboard Completo →</a>
    </div>
    <div class="footer">
      MindLoop CostOS · Tu restaurante en piloto automático
    </div>
  </div>
</body>
</html>
```

---

## Configuración en tu n8n Cloud

1. Ve a **n8niker.mindloop.cloud**
2. Click en **Create workflow**
3. Añade los nodos según el diagrama
4. Configura las credenciales de Supabase y Email
5. Activa el workflow

---

## Variables necesarias

| Variable | Dónde obtenerla |
|----------|-----------------|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `EMAIL_SMTP` | Tu proveedor de email |

---

## Troubleshooting

- **No llega el email**: Revisa la carpeta de spam
- **Error 401**: Verifica las credenciales de Supabase
- **Datos vacíos**: Confirma que hay ventas del día en la base de datos
