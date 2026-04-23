# Manual de usuario — MindLoop CostOS

> Guía práctica para restaurantes que usan MindLoop CostOS como sistema de gestión de costes, inventario y análisis.
> **Actualizado: abril 2026 — versión 1.0**

---

## Índice

1. [Qué es MindLoop CostOS](#1-qué-es-mindloop-costos)
2. [Primeros pasos](#2-primeros-pasos)
3. [Configuración inicial](#3-configuración-inicial)
4. [Operativa diaria](#4-operativa-diaria)
5. [Análisis y KPIs](#5-análisis-y-kpis)
6. ⚠️ [Zonas críticas — donde se rompen los cálculos](#6-zonas-críticas--donde-se-rompen-los-cálculos)
7. [Señales de alarma](#7-señales-de-alarma)
8. [Preguntas frecuentes](#8-preguntas-frecuentes)
9. [Soporte](#9-soporte)

---

## 1. Qué es MindLoop CostOS

MindLoop CostOS es el "cerebro financiero" de tu restaurante: conecta tus ingredientes, recetas, compras, ventas e inventario, y te devuelve en tiempo real números críticos como food cost, margen por plato, stock valorizado, y beneficio neto diario.

**Para qué sirve:**

- Saber en cualquier momento cuánto te cuesta cada plato y cuánto margen te deja.
- Detectar cuándo un ingrediente subió de precio y cómo afecta a tus recetas.
- Recibir alertas de stock bajo antes de quedarte sin producto clave.
- Ver un P&L diario (ingresos − costes − gastos fijos) sin calcularlo tú.
- Planificar pedidos basándote en consumo real.

**Para quién es:**

Restaurantes pequeños y medianos. Cualquier persona del equipo puede operarlo (no requiere conocimientos técnicos), pero hay zonas donde un dato mal introducido rompe cálculos en cadena — ver [Sección 6](#6-zonas-críticas--donde-se-rompen-los-cálculos).

---

## 2. Primeros pasos

### 2.1 Acceder a la app

Entra en `https://app.mindloop.cloud` con el email y contraseña que te proporcionamos.

### 2.2 Si tienes varios restaurantes

Al hacer login, la app te pide elegir el restaurante. En la esquina inferior izquierda del menú lateral tienes un switcher para cambiar de restaurante cuando quieras.

> ⚠️ **Cada restaurante tiene sus propios datos, totalmente aislados.** Cambiar de restaurante recarga la app: lo que hagas en uno nunca se mezcla con otro.

### 2.3 Cerrar sesión

Botón **"Cerrar Sesión"** arriba a la derecha. Cierra tu sesión en ese dispositivo.

---

## 3. Configuración inicial

Esta es la fase más importante del onboarding. Si los datos de base están bien, todo lo demás funciona. Si aquí metes algo mal, los cálculos estarán mal para siempre hasta corregirlo.

### 3.1 Proveedores

**Tab "Proveedores" → Nuevo proveedor**

- **Nombre**: el proveedor tal como lo llamáis (ej. "Mariscos Paco").
- **Contacto**: teléfono / email (opcional).
- **Tipo**: habitual, mercado, etc.

Los proveedores aparecerán luego al crear pedidos.

### 3.2 Ingredientes

**Tab "Ingredientes" → Nuevo ingrediente**

Por cada producto que compres al proveedor:

| Campo | Qué poner | Ejemplo |
|---|---|---|
| **Nombre** | Descripción clara, única | "Pulpo gallego" |
| **Categoría** | Alimentos / Bebidas / Base | Alimentos |
| **Unidad** | Unidad base (kg, L, botella, unidad) | kg |
| **Precio** | Precio **tal cual en la factura** | 25,44 € |
| **Cantidad por formato (cpf)** | Cuántas unidades base hay en el formato de compra | 1 (si compras por kg) o 24 (si compras caja de 24 botellas) |
| **Stock actual** | El stock físico que tienes hoy | 5,2 |
| **Stock mínimo** | Cuándo quieres que salte alerta | 2 |
| **Rendimiento** | % que aprovechas tras limpieza (opcional) | 50% en pulpo sucio |

> ⚠️ **`cantidad_por_formato` y `precio` es donde más errores se cometen.** Ver [Sección 6.3](#63-cantidad-por-formato-cpf--el-multiplicador-oculto).

### 3.3 Recetas

**Tab "Recetas" → Nueva Receta**

Define cada plato, bebida o ítem vendible:

| Campo | Qué poner |
|---|---|
| **Nombre** | Nombre en la carta / TPV |
| **Código TPV** | ID exacto de ese ítem en tu TPV |
| **Categoría** | Bebidas / Alimentos / Vinos |
| **Precio de venta** | Precio público por ración |
| **Porciones** | Cuántas raciones produce la receta |
| **Ingredientes** | Qué y cuánto de cada ingrediente lleva |

> ⚠️ **El código TPV tiene que coincidir exactamente con el del TPV.** Un dígito mal y las ventas de ese plato se registran en otra receta. Ver [Sección 6.2](#62-códigos-tpv--coincidencia-exacta-con-el-tpv).

### 3.4 Variantes (opcional)

Si un producto se vende en varios formatos (botella + copa, ración + media), cada variante se crea desde la receta padre → botón **"Variantes"**:

| Variante | Factor | Precio venta | Código TPV |
|---|---|---|---|
| BOTELLA | 1,000 | 40€ | 01143 |
| COPA | 0,200 | 8€ | 01553 |

**Factor** = qué fracción de la unidad base consume esa variante:
- Copa = 0,2 → 5 copas por botella
- Copa = 0,17 → 6 copas por botella
- Media ración = 0,5
- Ración entera / Botella = 1

> ⚠️ **Factor mal = cálculos rotos.** Ver [Sección 6.5](#65-variantes--factor-correcto).

### 3.5 Gastos fijos

**Tab "Diario" o "Balance" → Gastos Fijos Mensuales**

Introduce alquiler, sueldos, seguros, impuestos… agrupados por categoría. Se suman automáticamente al P&L diario proporcionalmente a los días del mes.

---

## 4. Operativa diaria

### 4.1 Pedidos

**Tab "Pedidos" → Nuevo pedido**

1. Elige proveedor.
2. Añade ingredientes con cantidad y precio **confirmados por la factura**.
3. Selecciona formato (unidad base vs caja).
4. Guarda como "pendiente" o, si ya llegó, marca como "recibido".

Cuando llegue la mercancía, entra al pedido → **"Recibir"** → ajusta cantidades/precios reales si cambiaron y confirma. Esto actualiza stock y precio medio de compra.

### 4.2 Ventas

Las ventas pueden llegar de 2 maneras:

**Manual**: Tab "Ventas" → Nueva venta (para casos puntuales).

**Automática desde tu TPV**: si lo tienes configurado, el TPV envía un email diario con el cierre del día. Un flujo automático lo importa a la app. **Requiere que los códigos TPV de tus recetas coincidan exactamente con los del TPV** — ver [Sección 6.2](#62-códigos-tpv--coincidencia-exacta-con-el-tpv).

### 4.3 Inventario y mermas

**Tab "Inventario"** → ver stock valorizado en tiempo real.

**Marcar inventario realizado** → confirma que has hecho recuento físico y el stock en la app coincide con el real. Actualiza la alerta "hay que hacer inventario".

**Tab "Pedidos" → botón Mermas** → registra producto que se tiró (roto, caducado). Descuenta stock y refleja en P&L.

### 4.4 Cambio de precio de un ingrediente

Si el proveedor te sube/baja el precio, **no crees un ingrediente nuevo**. Edita el existente y actualiza el campo `precio`. Automáticamente se recalculan los costes de todas las recetas que lo usan.

---

## 5. Análisis y KPIs

### Dashboard principal (Tab "Ingredientes" por defecto)

- **Ingresos** del día/semana/mes
- **Pedidos** pendientes y recibidos
- **Stock bajo** — ingredientes por debajo de mínimo
- **Food cost %** — ratio coste/ingreso
- **Valor del stock actual**
- **Beneficio neto** proyectado

### Tab "Análisis"

Desglose detallado por categoría, ranking BCG de recetas, evolución histórica.

### Tab "Diario"

P&L día por día, con desglose de ingresos, costes, gastos fijos y beneficio neto.

### Umbrales food cost (referencia)

| Rango | Color | Significado |
|---|---|---|
| ≤ 30% | 🟢 Verde | Excelente |
| 31-35% | 🔵 Azul | Target OK |
| 36-40% | 🟠 Naranja | Watch — revisar |
| > 40% | 🔴 Rojo | Alert — acción inmediata |

Para vinos el target es más alto (≤ 45% es normal).

---

## 6. ⚠️ Zonas críticas — donde se rompen los cálculos

**Esta sección es la más importante del manual.** Son 6 puntos donde un dato mal introducido genera números falsos en toda la app. Lee cada ejemplo — son todos incidentes reales.

### 6.1 Códigos TPV — 1 código = 1 producto, sin repetir

Cada producto del TPV tiene un código único. Cuando configures recetas y variantes:

- **La receta padre** (ej. "VINO ALMA DE MAR") y **cada variante** (botella, copa) **son productos distintos** en el TPV. Cada uno debe tener **su propio código**.
- **Jamás compartas el mismo código entre una receta y una de sus variantes**, ni entre dos recetas distintas.

#### Caso real (abril 2026)

La receta **VINO ALMA DE MAR** se creó con `código TPV = 01553`. La variante **COPA** también tenía `código TPV = 01553` (el mismo). Resultado: cuando el TPV enviaba ventas de copas, la app las asignaba a la receta padre **con factor 1.0** (botella entera). Cada copa vendida **descontaba una botella del stock** en vez de 1/5 de botella. Un día tranquilo con 33 copas servidas apareció en el sistema como un día catastrófico con 33 botellas consumidas y food cost del 190%.

**Regla**: al configurar variantes, asegúrate de que el código TPV de la receta padre (BOTELLA) es distinto al de la variante (COPA). Borra el código de la receta padre si tu variante "principal" ya lo tiene.

### 6.2 Códigos TPV — coincidencia exacta con el TPV

El código que pones en la app debe ser **letra por letra y número por número** el mismo que aparece en tu TPV. No traduzcas, no reordenes, no quites ceros a la izquierda.

#### Caso real (abril 2026)

La receta **NAVAJAS** en la app tenía `código TPV = 01162`. Pero en el TPV real el código `01162` era el de **BERBERECHOS**, y NAVAJAS tenía código `01467`.

Durante semanas:
- Cada venta de berberechos en el TPV entraba en la app como "NAVAJAS vendidas". El histórico de NAVAJAS estaba inflado con datos de BERBERECHOS.
- Las ventas reales de NAVAJAS se rechazaban silenciosamente con "Receta no encontrada". Aparecían como "cero ventas" en las estadísticas de navajas.

**Regla**: antes de guardar un código TPV, abre el ticket/informe del TPV y copia el dígito exacto. Si no estás seguro, pide el catálogo al responsable del TPV.

### 6.3 Cantidad por formato (cpf) — el multiplicador oculto

Al crear un ingrediente, el campo **"cantidad por formato"** (cpf) dice cuántas **unidades base** vienen en un **formato de compra**:

| Producto | Unidad base | Formato compra | cpf correcto |
|---|---|---|---|
| Cerveza | botella | Caja de 24 botellas | **24** |
| Aceite | litro | Garrafa de 5 L | **5** |
| Pulpo | kg | Pieza | **1** |
| Azúcar | kg | Saco de 25 kg | **25** |

**Qué pasa si lo dejas a 1 cuando no es 1:**

- Precio = `25,44 €` (caja de 24 cervezas)
- cpf mal = `1` → la app cree que cada botella cuesta 25,44 €
- Cuando vendes una cerveza, el sistema descuenta **25,44 € de coste** en vez de ~1 €

**Regla**: al introducir un ingrediente, piensa en la factura. Si la factura dice "1 caja – 25,44 €", pon `precio = 25,44` y `cpf = 24`. La app divide sola.

### 6.4 Precio del ingrediente — el de la factura, no dividido

Nunca divides tú mentalmente. La app se encarga:

| Lo que recibes | Cómo introducirlo | ❌ Cómo NO introducirlo |
|---|---|---|
| Factura: "Caja 24 cervezas, 25,44 €" | precio = 25,44 y cpf = 24 | precio = 1,06 y cpf = 1 |
| Factura: "Garrafa 5 L aceite, 38 €" | precio = 38 y cpf = 5 | precio = 7,60 y cpf = 1 |

Si divides tú y además te equivocas con el cpf, los errores se multiplican. **Factura tal cual viene. Punto.**

### 6.5 Variantes — factor correcto

Cuando creas una variante (copa, media ración, menú), el campo **factor** dice cuánta "unidad base" consume esa variante:

- **Botella** (variante base) → factor `1`
- **Copa de vino** → factor `0,2` (si salen 5 copas por botella) o `0,17` (si salen 6)
- **Media ración** → factor `0,5`
- **Doble** (café doble) → factor `2`

#### Caso real

Si pones `factor = 1` en una copa de vino, cada copa consumirá el mismo stock que una botella entera. Cliente pide 1 copa → app descuenta 1 botella → stock y coste se inflan por 5.

**Regla**: antes de guardar la variante, pregúntate: "de una unidad base, ¿cuántas de estas variantes salen?". El factor es `1 / ese número`.

### 6.6 Ingredientes duplicados — buscar antes de crear

Antes de añadir "Alma de Mar 2022", **busca si ya existe "Alma de Mar"** en la lista de ingredientes. Si existe, **edita el existente** para reflejar el nuevo precio/añada.

**Por qué importa:** dos ingredientes con el mismo nombre crean caos:
- Las recetas apuntan a uno o al otro aleatoriamente.
- El stock se divide entre los dos IDs.
- El precio medio de compra se calcula sobre compras de uno solo.

**Cuando SÍ crear uno nuevo**: si es un producto genuinamente distinto (añada diferente, proveedor distinto con calidad diferente), añade un sufijo claro y único: `Alma de Mar 2022 (Bodega X)`.

### 6.7 Importación automática desde el TPV

Si tu restaurante tiene configurado el flujo automático n8n + MindLoop, cada noche el TPV envía un informe por email y se importa a la app. Este flujo depende de dos cosas:

1. **Que todos los códigos TPV de tus recetas coincidan con los del TPV** (Sección 6.2).
2. **Que el formato del informe del TPV no cambie bruscamente** (si el diseño del PDF cambia mucho, el parser IA puede confundirse).

**Si un día aparecen números raros** (food cost > 60%, cantidades imposibles tipo 1000 unidades de un producto, recetas que reportan ventas pero deberían estar en "no encontrada"):
1. **Avisa inmediatamente** al soporte de MindLoop.
2. No modifiques datos en la app hasta que confirmemos si fue fallo de importación o de datos.

---

## 7. Señales de alarma

Estas son cosas que si ves, debes **avisar al responsable o a soporte MindLoop en el momento**, no al final del mes:

| Señal | Posible causa | Acción |
|---|---|---|
| Food cost > 60% de golpe | Datos mal importados o receta mal configurada | Revisar Sección 6 y reportar |
| Stock **negativo** en un ingrediente | Venta registrada sin compra previa, o cpf/factor mal | Reportar al soporte |
| Una receta vende **1000 unidades** en un día cuando lo normal son 10 | Parser IA del flujo n8n confundió columnas | Reportar urgente |
| Receta que **aparece o desaparece** del catálogo | Alguien borró en vez de desactivar | Reportar, puede recuperarse desde `deleted_at` |
| Ingrediente con **2 entradas casi idénticas** | Alguien creó duplicado en vez de editar | Reportar para fusionar |
| "Valor stock" cambia bruscamente sin compras del día | Precio medio alterado por factura mal introducida | Revisar últimos pedidos |

---

## 8. Preguntas frecuentes

**¿Puedo borrar una receta/ingrediente?**

Puedes desactivarla (campo "activo" en off) — se recomienda siempre. Borrar "de verdad" rompe referencias históricas: pedidos y ventas antiguas dejan de poder leer la ficha. Si borras por error, puede recuperarse desde la base de datos por el soporte.

**¿Los datos están aislados entre restaurantes?**

Sí. Cada restaurante es un "tenant" lógico separado. Nada se cruza con otros. El único que ve varios a la vez eres tú si tienes acceso a varios.

**¿Cómo veo el histórico de un ingrediente?**

Ficha del ingrediente → botón "Ver evolución de precio" → gráfico de los últimos 90 días.

**¿Cómo veo por qué el food cost de un plato está alto?**

Ficha de receta → botón "Escandallo" → desglose línea por línea del coste, con el precio usado para cada ingrediente y el rendimiento aplicado.

**¿Qué pasa si mi TPV cambia de modelo/versión?**

Si cambian los códigos, hay que reconfigurarlos en la app. Si cambia el formato del informe, el parser automático puede necesitar ajuste — avisa al soporte.

**¿Puedo recuperar una venta borrada?**

Sí, se puede restaurar desde la base de datos. Contacta con soporte.

---

## 9. Soporte

- **Email**: iker@mindloop.cloud
- **Urgencias** (números raros en producción): contactar directamente a Iker.
- **Sugerencias y mejoras**: email o WhatsApp al equipo MindLoop.

> 💡 **Regla de oro**: cuanto antes avises, más rápido lo arreglamos. Un número raro avisado el mismo día tarda minutos en localizarse. Un mes después, horas.

---

*MindLoop CostOS — cuidar los números para cuidar el restaurante.*
