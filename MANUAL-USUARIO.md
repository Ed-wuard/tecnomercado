# Manual de usuario — Stock TecnoMercado

Guía práctica para consultar el stock, registrar operaciones y administrar recetas.

## 1. Antes de empezar

1. Abrí `index.html` con un navegador moderno (Chrome, Edge o Firefox).
2. La aplicación carga con datos de demostración para que puedas probarla.
3. En una computadora, usá el menú de la izquierda. En un teléfono, tocá **☰** para abrirlo.
4. Los cambios se guardan automáticamente en el navegador y en el dispositivo donde abriste la aplicación.

> **Importante:** esta versión es una demo local. No tiene un servidor central: los datos no se comparten entre dispositivos ni usuarios. Si borrás los datos del navegador o cambiás de dispositivo, podrías perder el inventario. Exportá copias con regularidad.

## 2. El panel general

Al entrar, el **Panel general** muestra:

- **Productos activos:** total de productos simples y compuestos.
- **Unidades disponibles:** suma de las existencias registradas.
- **Stock bajo:** productos con stock igual o menor al mínimo establecido.
- **Productos compuestos:** cantidad de recetas creadas.
- **Productos con stock bajo:** lista de artículos que requieren atención.
- **Actividad reciente:** últimos movimientos registrados.

Usá **Ver inventario**, el menú principal o los accesos rápidos para ir a cada tarea.

## 3. Consultar y mantener el inventario

### Buscar y filtrar

1. Abrí **Inventario**.
2. Escribí en el buscador el nombre o el SKU (código).
3. Elegí una categoría para ver solamente sus productos.
4. Tocá el encabezado **Producto**, **Categoría** o **Disponible** para ordenar.
5. Usá **Limpiar filtros** para volver a ver todo.

El estado **Disponible**, **Stock bajo** o **Agotado** se calcula comparando la cantidad con el stock mínimo.

### Agregar un producto

1. Tocá **Nuevo producto**.
2. Completá el nombre, el SKU, la categoría, la unidad y las cantidades.
3. Tocá **Guardar producto**.

El SKU debe ser único. Si el producto tiene stock inicial, la aplicación también registra ese ingreso en el historial.

### Editar o eliminar

- En la fila del producto, tocá el lápiz para editarlo.
- Si cambiás la cantidad, se registra un ajuste. Si cambiás la categoría, se registra una transferencia.
- Tocá el ícono de papelera y confirmá para eliminarlo.
- No se puede eliminar un producto simple que todavía forme parte de una receta. Primero editá la receta y quitá ese componente.

## 4. Registrar entradas, salidas y ajustes

1. Abrí **Movimientos** y tocá **Registrar movimiento**.
2. Elegí el producto.
3. Seleccioná el tipo:
   - **Entrada:** suma la cantidad ingresada.
   - **Salida:** resta la cantidad. No se permite dejar el stock negativo.
   - **Ajuste de stock:** escribe la nueva cantidad total disponible; no es una suma. Por ejemplo, si hay 12 unidades y anotás 10, el stock final será 10.
   - **Transferencia de categoría:** cambia todo el producto a otra categoría; no altera su cantidad.
4. Agregá una nota o referencia si hace falta.
5. Tocá **Registrar movimiento**.

Cada operación queda asociada al nombre del usuario activo. Consultá el historial en **Movimientos**; podés buscar o filtrar por tipo.

## 5. Categorías

La demo empieza con **Materia prima**, **En proceso** y **Productos terminados**.

- Entrá en **Categorías** para consultar cuántos productos y unidades hay en cada una.
- Usá **Nueva categoría** para agregar otra y elegí un color identificador.
- Tocá el lápiz para cambiar el nombre o color. Los productos de esa categoría conservarán su lugar en la categoría renombrada.
- Tocá la papelera para eliminar una categoría vacía. No se puede eliminar si todavía tiene productos asignados.

Para mover un producto entre categorías, registrá una **Transferencia de categoría** desde Movimientos.

## 6. Recetas y producción (BOM)

Una receta describe cuánto material se necesita para fabricar **una unidad** de un producto compuesto.

### Crear una receta

1. Abrí **Producción** y tocá **Nueva receta**.
2. Escribí el nombre, un SKU único y la categoría del producto terminado.
3. En **Componentes de la receta**, seleccioná cada producto simple e indicá la cantidad necesaria por unidad.
4. Usá **Agregar componente** si necesitás más filas. No repitas el mismo producto en filas separadas.
5. Tocá **Guardar receta**.

### Consultar disponibilidad

La tarjeta de cada receta muestra cuántas unidades se pueden fabricar según el componente que alcance para menos unidades: ese es el **cuello de botella**. La cifra se actualiza al cambiar el stock.

### Registrar producción

1. En la receta elegida, tocá **Registrar producción**.
2. Consultá la disponibilidad y escribí una cantidad entera.
3. Tocá **Confirmar producción**.

La aplicación descuenta automáticamente la cantidad correspondiente de cada componente y suma los artículos terminados al stock. El consumo y la producción quedan anotados en Movimientos.

### Registrar una salida de un producto compuesto

En **Movimientos**, seleccioná el producto compuesto y elegí **Salida**. Se usarán primero las unidades terminadas disponibles. Si faltan unidades, la aplicación intentará completar la salida ensamblando las restantes al momento y descontando los componentes de la receta. Si no alcanza el stock de los componentes, la salida se rechaza sin procesarse.

## 7. Usuarios y auditoría

En **Usuarios y auditoría** podés:

- Agregar usuarios y asignarles un perfil: **Administrador**, **Producción** o **Depósito**.
- Cambiar el usuario activo desde el nombre de usuario en la parte superior o el ícono junto al perfil.
- Desactivar el acceso de otro usuario.
- Consultar las acciones registradas en **Registro de auditoría**.

Los perfiles muestran diferentes accesos dentro de esta demo:

- **Administrador:** gestiona todas las secciones.
- **Producción:** trabaja con recetas y producción.
- **Depósito:** trabaja con inventario y movimientos.

> **Límite importante:** cambiar de usuario no solicita contraseña y los permisos se aplican en la interfaz del navegador. Esto es útil para probar los perfiles, pero no es seguridad real ni reemplaza usuarios autenticados en un servidor.

## 8. Importar planillas

En **Informes y datos**, descargá primero la **plantilla CSV** si necesitás el formato esperado. Se aceptan archivos `.csv` y `.xlsx` de hasta **5 MB**. En Excel se utiliza la primera hoja.

La primera fila debe incluir estas columnas (escritas así):

```text
sku, nombre, categoria, stock, minimo, unidad
```

Ejemplo:

```csv
sku,nombre,categoria,stock,minimo,unidad
MP-005,Tornillo M8,Materia prima,240,50,u
```

1. Conservá los encabezados de la plantilla.
2. Completá un producto por fila. El SKU, nombre, categoría y unidad son obligatorios; stock y mínimo deben ser números iguales o mayores a cero.
3. En Excel, guardá el archivo como `.xlsx`; también podés usar CSV.
4. En **Importar inventario**, seleccioná el archivo o arrastralo al recuadro.
5. Esperá el mensaje de confirmación o corregí los errores indicados.

Un SKU que ya existe actualiza los datos y la cantidad del producto. Un SKU nuevo crea un producto. Las categorías desconocidas se agregan automáticamente. La importación se valida antes de procesar las filas; los cambios de stock importados también generan movimientos.

## 9. Exportar y guardar reportes

En **Informes y datos**, elegí el formato de exportación **CSV (.csv)** o **Excel (.xlsx)** y descargá:

- El inventario. Si ya tenés aplicado un filtro de categoría en Inventario, **Exportar** descarga esa categoría; desde Informes y datos se descarga el inventario completo.
- Las recetas y sus componentes.
- El historial de movimientos.
- El registro de auditoría.

Para filtrar movimientos o auditoría por fechas, completá **Desde** y/o **Hasta**. Dejá ambos campos vacíos para incluir todas las fechas. La fecha inicial no puede ser posterior a la final.

Para obtener un PDF, en **Reportes para imprimir** elegí el listado de stock, las fichas de recetas o el balance de movimientos. En la ventana de impresión, seleccioná **Guardar como PDF**. Los reportes incluyen la información de la sección; si querés imprimir todos los productos, limpiá los filtros del inventario antes de imprimir.

## 10. Recomendaciones de uso

- Registrá cada recepción, despacho o ajuste en el momento.
- Revisá el stock mínimo y las alertas antes de confirmar una producción.
- Mantené SKU únicos y fáciles de identificar.
- Descargá periódicamente el inventario y los movimientos como respaldo.
- Evitá abrir varias copias del sistema a la vez; para compartir datos entre personas o dispositivos se necesita una versión con servidor y base de datos.

## 11. Solución de problemas

| Si ocurre esto | Qué podés hacer |
|---|---|
| No puedo registrar una salida | Revisá el stock disponible y que la cantidad solicitada no lo supere. |
| No puedo producir la cantidad deseada | Consultá la disponibilidad de la receta y reponé el componente que limita la producción. |
| No puedo eliminar un producto | Puede estar usado en una receta. Quitalo de la receta y volvé a intentarlo. |
| No puedo borrar una categoría | Primero cambiá de categoría los productos que todavía pertenecen a ella. |
| La importación muestra un error | Verificá el formato, los encabezados, los SKU duplicados, los campos obligatorios y que el archivo no supere 5 MB. |
| La exportación a Excel o el diseño no carga | Revisá la conexión a Internet. La aplicación utiliza Bootstrap y la biblioteca de Excel desde una CDN. CSV es una alternativa de exportación. |
| Perdí los datos del navegador | Si no exportaste un respaldo, puede que no sea posible recuperarlos. Esta demo no sincroniza ni guarda copias en un servidor. |
