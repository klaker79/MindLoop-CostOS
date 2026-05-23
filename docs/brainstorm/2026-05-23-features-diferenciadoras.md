# Brainstorm: Features diferenciadoras MindLoop CostOS

> **Fecha:** 2026-05-23
> **Propósito:** Brainstorm libre sin filtros. Objetivo: diferenciación competitiva pura — ideas que NADIE en el mercado de software para restaurantes tiene hoy.
> **Estado actual del producto (referencia):** 17 tenants, principalmente España + Malasia. Pricing 95 €/mes plan base (Polar) + 30 €/mes add-on Chat IA. Chat con 17 tools (incluye `diagnostico_ingrediente` y `diagnostico_receta` añadidos el 21-may). Memoria conversacional mínima (6 mensajes) añadida el 23-may.
>
> 🌟 = features que ningún competidor tiene hoy (apuesta máxima por diferenciación).

---

## 1. IA generativa avanzada

### 1.1 🌟 Generador de escandallos por foto del plato
Subes foto del plato terminado → IA detecta ingredientes visibles, propone receta + cantidades estimadas, vincula con tu inventario, calcula food cost. **El cocinero no escribe nada.** Acelera onboarding de 100 platos de horas a minutos.
**Stack:** Claude Vision o GPT-4V + tools existentes.

### 1.2 Auto-renombrado y dedup inteligente de ingredientes
Hoy hay `COSTELA` y `Costilla` separados. La IA detecta duplicados/variantes, propone fusión con histórico preservado, sugiere nombre canónico. Activable desde la propia tabla.

### 1.3 Generador de menús del día con criterios económicos
"Necesito menú de 3 platos con margen >65 %, usando ingredientes con stock alto y proveedor X" → IA propone 5 combinaciones equilibradas con coste calculado y precio sugerido. Resuelve el problema #1 del jefe de cocina.

### 1.4 🌟 Coach de chef IA (proactivo, no reactivo)
En vez de esperar que el cliente pregunte, el sistema le **notifica** cada mañana:
- "Tienes 239 kg COSTELA y solo vendes 5 platos/día. Aplica menú especial X días o congela parte."
- "Tu food cost ha subido 2 pp este mes por subida del 12 % en pulpo. Sube precio del plato Y 1,50 €."
- "Llevas 6 días sin meter inventario. Probable que stock real no cuadre."

**Diferencial:** la mayoría de software te muestra datos, no te dice qué hacer.

### 1.5 Simulador de cambios "what-if"
"¿Qué pasa si subo precio del menú a 25 €?" → IA proyecta impacto en ventas (elasticidad histórica del tenant), ingresos, margen.

---

## 2. Operativa cocina

### 2.1 Modo cocina voice-first
Tablet en cocina con micrófono. El cocinero dice: "merma 2 kg de pulpo congelado", "recibo del proveedor X: 30 kg costela, 8 € kg". Sin tocar teclado.
**Stack:** speech-to-text → parse → llamada a API. 🌟 para mercados donde el cocinero NO usa pantallas hoy.

### 2.2 Báscula conectada por Bluetooth
Cuando pones algo en la báscula y pulsas un botón en la app, el peso se rellena automáticamente. Hardware: básculas comerciales con BLE (~200 €). Reduce rozamiento de inventario a casi cero.

### 2.3 🌟 Escáner OCR de albaranes (reactivar)
El OCR n8n+Gemini está hoy desconectado (memoria `feedback_ocr_desconectado.md`). Reactivar + mejorar precisión + integrar con foto desde móvil. "Subo foto del albarán → pedido pre-rellenado pendiente de confirmar." Feature diferenciadora del plan base.

### 2.4 Recetas con video corto inline
Cada receta lleva un video Loom de 30 s con el chef ejecutándola. El cocinero nuevo abre receta, ve el video, sabe qué corte hacer. Reduce dependencia del jefe de cocina.

### 2.5 Modo "noche de servicio"
Vista TPV-like simplificada para anotar mermas/regalos/cortesías DURANTE el servicio sin abrir tabs. Tap "salió un plato sin cobrar a mesa 3" → al final del día está registrado.

---

## 3. 🌟 Datos y benchmarking entre tenants

**El diferenciador máximo que ningún competidor puede replicar sin escala.**

### 3.1 Benchmark anónimo entre restaurantes similares
"Tu food cost en COMIDA es 35,2 %. Restaurantes similares (3 turnos, cocina mediterránea, ticket medio 25-30 €) tienen mediana 32,8 %." Solo se desbloquea cuando hay >10 restaurantes en cada bucket.

### 3.2 Precio justo de mercado por ingrediente
"Pagas 17,50 €/kg de pulpo. Restaurantes en tu zona compran al mismo proveedor X a 15,20 €/kg." Presión competitiva sobre proveedores.

### 3.3 Top recetas trending del sector
"Esta semana, en 17 restaurantes de tu categoría, el plato más vendido fue X. Considera incluirlo en tu carta." Anonimizado.

### 3.4 Marketplace de proveedores recomendado por la red
Ya diseñado en memoria `project_marketplace_proveedores_aparcado.md`. Activar a partir de 30 tenants.

---

## 4. Conexión con el cliente final del restaurante

### 4.1 App del comensal con stock real
Tus clientes finales escanean QR en la mesa → ven menú con fotos + alérgenos + opcionalmente puntuación. Si el plato no queda en stock, se oculta automáticamente.

### 4.2 Sugerencias de upselling en TPV en tiempo real
Cuando el camarero introduce el pedido, MindLoop sugiere: "este cliente suele pedir vino, sugiere ALBARIÑO LAGAR (margen 62 %, en stock)." Aumenta ticket medio 5-10 %.

### 4.3 Programa de fidelización integrado
Sistema de puntos por gastronómico (no por importe), conectado con MindLoop. Visitante recurrente reconocido → menú personalizado / descuento estratégico.

---

## 5. Sostenibilidad y compliance regulatorio

### 5.1 🌟 Huella de carbono por plato
Cada ingrediente tiene CO2e/kg (datos públicos EWG/Carbon Database). Cada receta calcula su huella. Cada ticket muestra al cliente "este menú emitió X kg CO2e". ORO PURO para restaurantes vegetarianos/sostenibles.

### 5.2 Gestor de alérgenos automático
A partir del escandallo, MindLoop sabe qué alérgenos tiene cada plato. Imprime carta para tablet del comensal con iconos automáticos. Cumple Reglamento UE 1169/2011. Para Malasia: etiquetas Halal.

### 5.3 Inspección sanitaria pre-flight
Checklist diario con cámara para que el responsable fotografíe temperatura del frigorífico, fecha de envasado de productos abiertos, etc. Log de 6 meses para inspectores.

### 5.4 Caducidades inteligentes
La cocina marca fecha de apertura de un envase. App predice "este saco de harina caduca el viernes; tienes recetas X, Y, Z que la usan, propón menú con ella esta semana." Reduce mermas reales 15-25 %.

---

## 6. 🌟 Financiero avanzado (justifica subir el ticket fuerte)

### 6.1 Predictor de cash-flow a 30 días
Combinando calendario de pagos + previsión de ventas (estacionalidad histórica) + gastos fijos → "el 18 del mes próximo te quedan 1.200 € en caja, AVISO." Hoy esto los restaurantes lo llevan en cabeza o en Excel.

### 6.2 Financiación basada en data
Conexión con fintech (Capchase, iwoca). Como tu data está limpia en MindLoop, el banco aprueba anticipo en 1 h al ver tus ventas reales. Comisión de MindLoop por intermediación.

### 6.3 P&L automático para Hacienda / asesor
Exportador en formato compatible con asesoría española (Modelo 100, 130) o Malasia (LHDN). Tu asesor recibe PDF mensual sin trabajo manual. Vale 50 €/mes adicionales sin pestañear.

### 6.4 Detección de fraude del personal
Patrones anómalos: "mucha merma de licor de alto valor en turno de Pedro vs otros turnos." Sin acusar, alerta al dueño. Tabu pero útil.

---

## 7. 🌟 Pricing dinámico y revenue management

### 7.1 Precio óptimo por día/hora
Si los miércoles tienes mesa vacía, MindLoop sugiere bajar 10 % el menú esos días. Si los viernes hay lista de espera, sugiere subir 8 %. Hotelero ya lo hace, restauración nunca.

### 7.2 Menús degustación dinámicos
"Esta noche, basado en stock disponible + previsión + margen objetivo, el menú degustación rentable sería: entrante X (1,20 €), plato Y (3,40 €), postre Z (0,80 €). Precio sugerido 28 €." El restaurante imprime menú especial cada noche con margen garantizado.

### 7.3 Tarjeta regalo / bono prepago
Vende experiencias a futuro. MindLoop lleva el saldo. Reduce churn del cliente final del restaurante.

---

## 8. Hardware / IoT

### 8.1 Sensores de temperatura nevera (cumplimiento APPCC)
Sensores inalámbricos en cámaras y abatidores → log automático cada 15 min. Cumplimiento APPCC sin libreta. ~150 €/sensor.

### 8.2 Cámaras IA en cocina (tipo Winnow)
Cámara sobre cubo de basura detecta qué se tira, cuánto pesa. MindLoop ya conoce el food cost → te dice "esta semana has tirado 340 € en merma de pescado."

### 8.3 Display táctil mural cocina
Pantalla grande con KPIs del día en vivo: platos vendidos / target, food cost real día / objetivo, merma día. Motivación del personal.

---

## 9. Internacionalización agresiva

### 9.1 Adaptación profunda al mercado malayo
Ya tienes Stefania KL. Profundizar:
- Halal compliance automático (ingredientes marcados)
- IVA → SST de Malasia
- Integración con e-Invoice MyInvois (obligatorio en 2026)
- Idiomas: bahasa malayo + mandarín simplificado + inglés

### 9.2 Plantillas regionales preconfiguradas
"Tipo de restaurante: mediterráneo / sushi / brasería / kebab / curry → recetas básicas, proveedores típicos, food cost objetivo ya configurados." Onboarding de 3 horas a 30 min.

### 9.3 LATAM y Brasil
Mercado masivo, ningún SaaS de costes está bien posicionado. Brasil tiene 1M de bares. 10× España. Adaptación: portugués + Real + impuestos locales.

---

## 10. 🌟 Network effects y comunidad

### 10.1 Marketplace de recetas premium
Chef famoso publica escandallo en MindLoop. Otros restaurantes pagan 50 € por la receta + permiso de uso. MindLoop se queda 30 %. Modelo Etsy-de-gastronomía.

### 10.2 Foro / Slack interno entre dueños MindLoop
Comunidad cerrada donde dueños hablan de proveedores, problemas, técnicas. "Cancelar MindLoop = perder acceso a la comunidad."

### 10.3 Programa de afiliados / referidos
"Trae 1 restaurante, te descuento 30 €/mes."

---

## 11. Locas pero diferenciadoras (sin filtros)

### 11.1 AR para emplatado consistente
Tablet apuntada al plato, overlay AR muestra cómo debe quedar el emplatado. Cocinero junior aprende sin mancharse las manos. Consistencia entre turnos.

### 11.2 Voz del CEO virtual (clon del dueño)
El dueño graba 10 min de su voz. La IA del chat le habla CON SU PROPIA VOZ cuando le notifica algo. TTS personalizado.

### 11.3 Subasta inversa de proveedores en tiempo real
Necesitas 30 kg pulpo. Lanzas subasta abierta a 5 proveedores en MindLoop. El mejor precio en 1 h gana. Marketplace B2B integrado.

### 11.4 Asistente de contratación
IA escribe ofertas de empleo para cocinero/camarero con base en tu coste salarial actual y mercado local. Conecta con InfoJobs/portales.

### 11.5 Wikipedia gastronómica privada
Cada plato del restaurante tiene su ficha con video, foto referencia, escandallo, historia. Cocinero nuevo recibe link, se hace 100 % autónomo en 3 días.

---

## Apuestas TOP 3 (por si fuera mi voto)

| # | Feature | Esfuerzo | Impacto | Razón |
|---|---------|----------|---------|-------|
| 1 | **Coach IA proactivo (1.4)** | Medio | Enorme | Extensión natural del chat actual + notificaciones. Brutal en retención. |
| 2 | **Benchmark anónimo entre tenants (3.1)** | Medio | Enorme y creciente | Ventaja competitiva imitable: crece con cada nuevo cliente. |
| 3 | **Generador de escandallos por foto (1.1)** | Alto | Magia para el cliente | Reduce onboarding de 100 platos de horas a 1 hora. |

---

## Lo que NO se ha incluido (descarte consciente)

- Cripto/blockchain: no aporta a restauración real.
- Web3 / NFTs de platos: gimmick, no resuelve dolor.
- Chatbot Telegram/WhatsApp como interfaz primaria: ya tienes chat IA propio mejor.
- Marketplace de tickets de descuento estilo Groupon: erosiona margen, contradice tu producto.

---

## Memoria relacionada (para retomar en el futuro)

- [[project_marketplace_proveedores_aparcado]] — feature 3.4 ya tiene diseño completo aparcado
- [[feedback_ocr_desconectado]] — relevante para feature 2.3
- [[project_chat_diagnostico_tools_2026_05_21]] — base sobre la que extender el Coach IA (1.4)
- [[project_landing_copy_pendiente_2026_05_13]] — usar features de este dossier en landing
