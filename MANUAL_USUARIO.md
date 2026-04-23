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

#### Merma/rendimiento por receta

Al añadir un ingrediente a una receta, la app aplica automáticamente el **rendimiento** configurado en la ficha del ingrediente (ej. si el ingrediente "pulpo" tiene rendimiento 50% por limpieza, cada receta que lo use asume ese 50% al calcular el coste).

Pero ese valor es **editable por receta**: si una receta concreta aprovecha más el producto (por técnica de cocción, por usar también la cabeza, por hacer caldo con los recortes, etc.), puedes ajustar el rendimiento específicamente para esa receta sin modificar el del ingrediente base. Esto permite que recetas "generosas" con el producto no calculen un coste inflado.

Regla general: si la receta aprovecha **igual** que el rendimiento del ingrediente → dejar tal cual. Si aprovecha **más** → subir el rendimiento en la línea de esa receta (reduce el coste). Si aprovecha **menos** → bajarlo.

### 3.4 Variantes (opcional)

Una **"receta padre"** es la ficha principal del producto (ej. una receta creada como "Vino de la casa"). Cuando ese mismo producto se vende en **varios formatos** al cliente (botella entera, copa; ración entera, media ración; menú de mediodía, menú de fin de semana…), **cada formato es una variante** de esa receta padre. Todas las variantes comparten los ingredientes y la fórmula de coste, pero tienen su propio precio de venta, su propio código TPV y un "factor" que indica qué porción de la receta base consumen.

Las variantes se crean desde la receta padre → botón **"Variantes"**. Ejemplo con el vino "Rías Altas 2020":

| Variante | Factor | Precio venta | Código TPV |
|---|---|---|---|
| Rías Altas 2020 — BOTELLA | 1,000 | 40 € | 01143 |
| Rías Altas 2020 — COPA | 0,200 | 8 € | 01553 |

**Factor** = qué fracción de la unidad base (la botella, la ración entera) consume esa variante:
- Copa = 0,2 → salen 5 copas por botella
- Copa = 0,17 → salen 6 copas por botella
- Media ración = 0,5 → una media consume medio emplatado
- Ración entera / Botella = 1 (la variante "base")
- Café doble = 2 → consume el doble de producto que un café normal

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
3. Selecciona formato de compra.
4. Guarda como "pendiente" (aún no ha llegado) o "recibido" (ya en la casa).

#### Formato de compra — ejemplo práctico

Al añadir una línea de pedido, aparece un selector de **formato** para decidir si la cantidad la estás pidiendo en unidad base (kg, L, botella) o en formato agrupado (caja, garrafa, saco):

| Ejemplo | Selector formato | Cantidad | Precio unitario |
|---|---|---|---|
| 10 kg de pulpo | "Unidad base (kg)" | 10 | 17,50 €/kg |
| 2 cajas de cerveza (24 botellas/caja) | "Caja" | 2 | 25,44 €/caja |
| Media garrafa de aceite (5 L/garrafa) | "Unidad base (L)" | 2,5 | 7,60 €/L |

La app entiende la equivalencia: si eliges "Caja (24)" y pones cantidad 2, al recibir el pedido sumará 48 botellas al stock.

> ⚠️ **Pon mucha atención al formato** al añadir la línea. Si eliges "unidad (botella)" y pones cantidad 48, o eliges "caja" y pones cantidad 2, el resultado debe ser el mismo: 48 botellas. Si mezclas los conceptos (eliges "caja" pero pones cantidad 48), tu stock se multiplica por 24.

#### Recibir un pedido y marcar varianzas

Cuando llegue la mercancía, entra al pedido → **"Recibir"**. Por cada ingrediente la app te muestra:

- Lo que **pediste** (cantidad pedida + precio pedido)
- Lo que **recibiste** (editable: cantidad real recibida + precio real de la factura)

Si lo recibido coincide con lo pedido, pulsa **Confirmar**. El stock se suma y el precio medio de compra se actualiza.

Si hay **varianza** (el proveedor trajo menos/más, o el precio cambió):

1. Edita la cantidad o precio en la línea afectada.
2. Marca el estado de la línea como **"Con varianza"**.
3. El subtotal de la línea se recalcula automáticamente y el total del pedido refleja la diferencia respecto al original.
4. Confirma.

Esto deja rastro: el pedido queda marcado como recibido con varianza y los reportes pueden agrupar luego "pedidos con varianzas" para auditoría (ej. detectar un proveedor que sube precios sin avisar).

Si una línea **no llegó** (el proveedor no la trajo): márcala como "No entregado" y la app pondrá cantidad = 0 y no afectará a stock.

### 4.2 Ventas

Las ventas pueden llegar de 2 maneras:

**Manual**: Tab "Ventas" → Nueva venta (para casos puntuales).

**Automática desde tu TPV**: si lo tienes configurado, el TPV envía un email diario con el cierre del día. Un flujo automático lo importa a la app. **Requiere que los códigos TPV de tus recetas coincidan exactamente con los del TPV** — ver [Sección 6.2](#62-códigos-tpv--coincidencia-exacta-con-el-tpv).

### 4.3 Inventario y mermas

**Tab "Inventario"** → ver stock valorizado en tiempo real. Muestra, por cada ingrediente, stock virtual (lo que la app cree que tienes), stock real (lo que tú introduces tras recuento), diferencia, precio medio y valor total del stock.

**Botón "Guardar Stock"** → si acabas de hacer recuento físico y hay diferencia entre virtual y real, introduces el real, pulsas guardar y queda ajustado. La alerta "hay que hacer inventario" se resetea.

**Botón "Merma Rápida"** → registra producto que se tiró (roto, caducado, quemado). Descuenta stock y refleja en el P&L como pérdida.

**Botón "Ver Historial Mermas"** → listado histórico de mermas registradas.

**Botón "Actualizar Inventario Masivo"** → subir un archivo Excel/CSV con recuento físico de muchos ingredientes a la vez, útil tras inventario general de fin de mes.

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

Desglose detallado del negocio por categorías. Dos herramientas clave:

**Ranking BCG (Boston Consulting Group aplicado a recetas)**
Clasifica tus platos en 4 categorías según dos ejes: **popularidad** (cuánto se vende) y **rentabilidad** (cuánto margen deja). Los 4 cuadrantes:

- **Estrellas** ⭐ — populares y rentables. El motor del negocio. Cuidarlos, destacarlos en la carta.
- **Vacas lecheras** 🐄 — populares pero de margen más ajustado. Entradas seguras, pero revisar si se puede mejorar el coste.
- **Interrogantes** ❓ — poco populares pero rentables. Hay potencial, valdría la pena promocionar o reformular la presentación.
- **Perros** 🐕 — poco populares y poco rentables. Candidatos a retirar de la carta, reformular o subir precio.

**Ingeniería de menú (menu engineering)**
Metodología que usa el ranking BCG + otros datos (tiempo de preparación, estacionalidad, stock necesario) para decidir **qué platos promocionar, reformular o retirar**. La app te sugiere acciones concretas por cada plato. Úsala antes de rediseñar la carta o para decidir cambios puntuales: sube un plato estrella al inicio del menú, reformula un perro para mejorar su margen, retira los que no aportan.

### Tab "Diario"

**La pestaña más importante para la gestión diaria del restaurante.** Aquí aparece, día por día del mes seleccionado, toda la actividad financiera. Consúltala cada mañana para saber cómo fue el día anterior en 30 segundos.

Contiene 5 bloques:

**1. Compras diarias por ingrediente**
Qué ingredientes compraste cada día, con cantidad y coste. Útil para detectar picos de gasto concretos (ej. un día compraste mucho pulpo porque subió el precio, o un proveedor trajo algo no pedido).

**2. Compras diarias por proveedor**
Total gastado cada día con cada proveedor. Permite ver la concentración de gasto: si el 60% del gasto del mes es con un solo proveedor, conviene negociar.

**3. Ventas diarias por receta**
Qué platos se vendieron cada día, cantidad, ingresos. Es el detalle fino del TPV importado: ves platos estrella (los de cada día) y platos muertos (sin ventas en varios días seguidos).

**4. P&L diario (Pérdidas y Ganancias)**
El **estado de resultados contable** aplicado al día. Muestra:
- **Ingresos** del día (lo que facturaste, IVA aparte).
- **Coste de ingredientes** (COGS) — lo que te costó producir lo vendido.
- **Gastos fijos prorrateados** (el total mensual dividido por días del mes).
- **Beneficio neto del día** = Ingresos − Costes ingredientes − Gastos fijos del día.

Un P&L diario en positivo significa que ese día el restaurante ganó dinero. En negativo, perdió. Sumando todos los días del mes tienes el resultado del mes completo (sin tener que esperar al contable).

**5. Punto de equilibrio (break-even point)**
El nivel de ventas diarias a partir del cual el restaurante deja de perder dinero y empieza a ganar. Fórmula: **punto de equilibrio = gastos fijos del día + coste variable por euro vendido**. Si tu punto de equilibrio es 800 €/día y un día vendes 900 €, ese día ganaste 100 € netos. Si vendes 700 €, perdiste 100 €.

La app muestra el punto de equilibrio de cada día y compara con tus ventas reales. Sirve para:
- Saber el mínimo que tienes que vender para cubrir costes.
- Detectar días del mes especialmente malos o especialmente buenos.
- Tomar decisiones como abrir o no determinados días, ajustar personal, hacer promociones.

**6. Gastos fijos**
Todos tus costes fijos mensuales (alquiler, sueldos, seguros, suministros...) agrupados por categoría. Aquí los editas si cambian. Se prorratean automáticamente en el P&L diario.

> 💡 **Rutina recomendada**: cada mañana, abrir Diario → mirar el beneficio neto del día anterior y compararlo con el punto de equilibrio. 30 segundos y sabes cómo va el mes.

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

- **La receta padre** (ej. "Vino de la casa") y **cada variante** (botella, copa) **son productos distintos** en el TPV. Cada uno debe tener **su propio código**.
- **Jamás compartas el mismo código entre una receta y una de sus variantes**, ni entre dos recetas distintas.

#### Ejemplo práctico

Supón que creas la receta **"Vino de la casa"** con `código TPV = 01553`. Y en esa misma receta, añades una variante **"Copa"** también con `código TPV = 01553` (el mismo). Resultado: cuando el TPV envía ventas de copas, la app las asigna a la receta padre **con factor 1.0** (botella entera). Cada copa vendida **descuenta una botella del stock** en vez de 1/5 de botella. Un día tranquilo con 33 copas servidas aparece en el sistema como un día catastrófico: 33 botellas consumidas y food cost del 190%.

**Regla**: al configurar variantes, asegúrate de que el código TPV de la receta padre (BOTELLA) es distinto al de la variante (COPA). Borra el código de la receta padre si tu variante "principal" ya lo tiene.

### 6.2 Códigos TPV — coincidencia exacta con el TPV

El código que pones en la app debe ser **letra por letra y número por número** el mismo que aparece en tu TPV. No traduzcas, no reordenes, no quites ceros a la izquierda.

#### Ejemplo práctico

Supón que tu receta **"Mejillones al vapor"** está registrada en la app con `código TPV = 01162`. Pero en el TPV real el código `01162` corresponde a **"Ensalada mixta"**, y los mejillones tienen código `01467`.

Durante semanas:
- Cada venta de ensalada mixta en el TPV entra en la app como "Mejillones vendidos". El histórico de mejillones está inflado con datos que no son suyos.
- Las ventas reales de mejillones se rechazan silenciosamente con "Receta no encontrada". Aparecen como "cero ventas" en las estadísticas.

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
| Una receta vende **1000 unidades** en un día cuando lo normal son 10 | Informe del TPV con formato distinto al habitual que se interpretó mal al importarlo | Reportar urgente |
| Receta que **aparece o desaparece** del catálogo | Alguien la borró en lugar de desactivarla | Reportar al soporte |
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

- **Email**: mindloopia@gmail.com
- **Urgencias** (números raros en producción): escribe al email indicando "URGENTE" en el asunto.
- **Sugerencias y mejoras**: mismo email.

> 💡 **Regla de oro**: cuanto antes avises, más rápido lo arreglamos. Un número raro avisado el mismo día tarda minutos en localizarse. Un mes después, horas.

---

*MindLoop CostOS — cuidar los números para cuidar el restaurante.*
