MINDLOOP COSTOS — PLANTILLAS DE IMPORTACIÓN
============================================

Estas 3 plantillas te ayudan a empezar rápido durante tu prueba de
10 días. Bórralas o adáptalas a tu carta real.

1. plantilla-proveedores.csv
   - Lista los proveedores con los que trabajas habitualmente.
   - El IVA habitual lo usamos solo para cuadrar el albarán físico
     al recibir un pedido (no afecta a precios ni a food cost).

2. plantilla-ingredientes.csv
   - Materia prima que usas en cocina con precio neto, unidad de
     compra y stock actual/mínimo.
   - Columna "Proveedor" debe coincidir con el nombre exacto del
     proveedor (importa primero el archivo de proveedores).

3. plantilla-recetas.csv
   - Formato largo: una fila por ingrediente.
   - La primera fila de cada receta lleva la cabecera (categoría,
     precio venta, porciones). Las siguientes solo el ingrediente
     y la cantidad.
   - Rendimiento por línea es opcional (% de aprovechamiento del
     ingrediente). Si lo dejas vacío, usamos el del ingrediente.

CÓMO USARLAS
============

1. Abre el archivo en Excel, Google Sheets o LibreOffice.
2. Edita los datos con tus proveedores, ingredientes y recetas reales.
3. Guarda como CSV (UTF-8) o como Excel (.xlsx).
4. En la app, pestaña Ingredientes / Recetas → botón "Importar".

ORDEN RECOMENDADO
=================

Proveedores → Ingredientes → Recetas

Si importas en otro orden, los ingredientes pueden quedar sin
proveedor asignado (se puede corregir luego desde la app).
