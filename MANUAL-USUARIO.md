# Manual de usuario — Stock TecnoMercado

Guía práctica para consultar el stock, registrar operaciones y administrar recetas.

## 1. Antes de empezar

1. Abrí `index.html` con un navegador moderno (Chrome, Edge o Firefox).
   La primera vez, creá la contraseña de al menos ocho caracteres para el usuario **administrador** y confirmala. No hay contraseña predefinida.
2. La aplicación carga 17 perfiles de barra en **Materia prima** y relaciona con ellos las 23 piezas fabricadas del documento. Por ejemplo, **H22** es la materia prima de **Guia accionamiento**. Los productos, recetas y saldos cero se conservan al recargar. Los perfiles sin saldo aparecen como **Pendiente de carga**.
3. Iniciá sesión con tu usuario y contraseña. En una computadora, usá el menú de la izquierda; en un teléfono, tocá **☰** para abrirlo.
4. Los cambios se guardan automáticamente en el navegador y en el dispositivo donde abriste la aplicación.

> **Importante:** esta versión es local y no tiene servidor. Las contraseñas se guardan como hash con sal, pero los datos y permisos se almacenan en el navegador y pueden manipularse desde el dispositivo. No reemplaza autenticación ni control de acceso de un servidor. Los datos no se comparten entre dispositivos; si borrás los datos del navegador, también perdés las cuentas y podrías perder el inventario.

## 2. El panel general

Al entrar, el **Panel general** muestra:

- **Productos activos:** total de productos simples y compuestos.
- **Unidades disponibles:** suma de las existencias registradas.
- **Stock bajo:** productos con saldo conocido de hasta 700 unidades.
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

La alarma es fija en **700 unidades** para todos los productos. Los artículos cuyo saldo todavía no se cargó muestran **Pendiente de carga** y no disparan la alarma. La tarjeta **Stock bajo**, la campana y el enlace del panel abren el inventario filtrado por esa alarma. El panel prioriza primero los productos asociados a los plazos de entrega más largos.

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

Las categorías iniciales son **Materia prima**, **En proceso**, **Productos terminados**, **Pieza de proveedores** y **Pieza de mecanizado**. En **Categorías**, usá el botón de abrir en una tarjeta para ir directamente al inventario filtrado por esa categoría. En el documento, el campo **Materia Prima** identifica la barra: **H** indica hexagonal y **R**, redonda. El peso por pieza se usa para la conversión. Reconquista es el proveedor habitual; las piezas Forja se asocian a Packling. Si un perfil tiene más de un proveedor, se puede elegir en el pedido.

- Entrá en **Categorías** para consultar cuántos productos y unidades hay en cada una.
- Usá **Nueva categoría** para agregar otra y elegí un color identificador.
- Tocá el lápiz para cambiar el nombre o color. Los productos de esa categoría conservarán su lugar en la categoría renombrada.
- Tocá la papelera para eliminar una categoría vacía. No se puede eliminar si todavía tiene productos asignados.

Para mover un producto entre categorías, registrá una **Transferencia de categoría** desde Movimientos.

## 6. Pedidos y compras

1. Abrí **Pedidos** y tocá **Nuevo pedido**.
2. Elegí el sector y luego el producto. **Mecanizado** muestra perfiles de **Materia prima** y pide kg; **Línea de armado** muestra únicamente productos de **Pieza de proveedores** y pide unidades. También podés indicar fecha necesaria y una observación.
3. Elegí el proveedor del catálogo. El formulario muestra su plazo y la fecha estimada de llegada; si esta queda después de la fecha necesaria, aparece una advertencia antes de enviar el pedido.
4. El perfil **Compras** puede cambiar el estado a **En gestión**, **Comprado**, **Recibido** o **Rechazado**. Administrador también puede gestionar los estados.
5. Al marcar un pedido como **Recibido**, los kilos se suman al stock del perfil de materia prima. La conversión a piezas es una estimación de la calculadora; no fabrica ni ingresa piezas automáticamente.
6. **Lista de compras** descarga en CSV o Excel las solicitudes **Solicitado** y **En gestión**, consolidadas por SKU y proveedor con cantidades sumadas. Incluye plazo y fecha estimada, respeta el filtro de sector y, si seleccionás un estado, exporta ese estado.

Producción y Administrador pueden generar pedidos. Los datos se guardan en este navegador; no se sincronizan automáticamente con otros dispositivos.

En **Proveedores**, Administrador puede agregar proveedores y modificar el plazo en días. Los tiempos se cargaron desde la planilla; cuando un proveedor tenía distintos plazos, se usa el mayor como estimación conservadora. ADAP-CAR, BREMET y PALUMBO no tenían un plazo informado y quedan pendientes de completar. Reconquista, Packling y TECNOMERCADO también quedan sin días hasta que se definan.

## 7. Calculadora de mecanizado

1. Abrí **Calculadora** y elegí la pieza fabricada.
2. La pantalla muestra el perfil de barra asociado y el peso por pieza. Ingresá kilos disponibles para estimar cuántas piezas completas rendirían, o ingresá piezas para calcular los kilos de barra requeridos.

El peso usado es el peso por pieza indicado en el documento. La conversión no contempla merma de corte ni proceso, por lo que es una estimación teórica para planificación.

## 8. Recetas y producción (BOM)

Una receta describe cuánto material se necesita para fabricar **una unidad** de un producto compuesto.

La aplicación incluye las recetas **Valvula de cilindro**, **Valvula de carga** y **Regulador**, importadas de sus planillas. La disponibilidad queda en cero si un componente no está vinculado o todavía no tiene stock. En **Editar receta**, los ingredientes pendientes conservan el nombre de origen para poder asignarles el producto correcto. Hay tres descripciones que necesitan revisión: **ANILLO DE RESPALDO**, **TORRE LATON NACIONAL** y **CONECTOR DE AGUA M10 Ø10 AEB** (el catálogo disponible indica Ø9). **RESORTE CONTRASTE** está identificado como VM4522, pero requiere cargar su stock.

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

### Producción diaria

En **Producción diaria**, elegí la fecha y registrá la cantidad de un producto compuesto en **Línea de armado**. Se comprueba el stock, se descuentan los componentes y se suman las unidades terminadas. Si el saldo de algún componente o del producto terminado está pendiente de carga, primero registrá su stock actual con un **Ajuste de stock** en Movimientos; podés ingresar cero.

En **Mecanizado**, seleccioná una pieza y registrá la cantidad fabricada. Esta queda en **Stock pendiente de entrega**, sin modificar el inventario general. Al pulsar **Entregado**, se suma una única vez al stock general de la pieza y queda registrado el movimiento. Antes de entregar, el stock general debe estar cargado, incluso si es cero. La calculadora no descuenta barras automáticamente.

## 9. Usuarios y auditoría

En **Usuarios y auditoría** podés:

- Agregar usuarios con nombre de acceso, contraseña y permisos de **Ver** y **Modificar** por módulo. Los sectores de armado y mecanizado tienen permisos separados.
- Editar los permisos, nombre de acceso o contraseña de un usuario con el botón de lápiz. Dejá la contraseña vacía para conservarla.
- Cerrar sesión desde el nombre de usuario en la parte superior o el ícono junto al perfil e iniciar sesión con otra cuenta.
- Desactivar el acceso de otro usuario.
- Consultar las acciones registradas en **Registro de auditoría**.

La cuenta **Administrador** tiene acceso completo. Las cuentas nuevas acceden únicamente a los módulos y acciones que se habiliten explícitamente; marcar **Modificar** activa también **Ver**. La actualización inicial conserva únicamente la cuenta Administrador y no elimina el inventario ni el historial de movimientos.

## 10. Importar planillas

En **Informes y datos**, descargá primero la **plantilla CSV** si necesitás el formato esperado. Se aceptan archivos `.csv` y `.xlsx` de hasta **5 MB**. En Excel se utiliza la primera hoja.

La plantilla incluye estas columnas; solo las primeras seis son obligatorias. Las columnas técnicas son opcionales:

```text
sku, nombre, categoria, stock, minimo, unidad, proveedor, perfil_barra, peso_barra_g, unidad_compra
```

Ejemplo:

```csv
sku,nombre,categoria,stock,minimo,unidad,proveedor,perfil_barra,peso_barra_g,unidad_compra
MP-005,Tornillo M8,Materia prima,240,700,u,Proveedor ejemplo,,,u
```

1. Conservá los encabezados de la plantilla.
2. Completá un producto por fila. El SKU, nombre, categoría y unidad son obligatorios; stock y mínimo deben ser números iguales o mayores a cero.
3. En Excel, guardá el archivo como `.xlsx`; también podés usar CSV.
4. En **Importar inventario**, seleccioná el archivo o arrastralo al recuadro.
5. Esperá el mensaje de confirmación o corregí los errores indicados.

Un SKU que ya existe actualiza los datos y la cantidad del producto. Un SKU nuevo crea un producto. Las categorías desconocidas se agregan automáticamente. La importación se valida antes de procesar las filas; los cambios de stock importados también generan movimientos. Las exportaciones conservan proveedor, perfil, peso por pieza y unidad de compra.

## 11. Exportar y guardar reportes

En **Informes y datos**, elegí el formato de exportación **CSV (.csv)** o **Excel (.xlsx)** y descargá:

- El inventario. Si ya tenés aplicado un filtro de categoría en Inventario, **Exportar** descarga esa categoría; desde Informes y datos se descarga el inventario completo.
- Las recetas y sus componentes.
- El historial de movimientos.
- El registro de auditoría.
- La lista de compras pendiente desde **Pedidos**.

Para filtrar movimientos o auditoría por fechas, completá **Desde** y/o **Hasta**. Dejá ambos campos vacíos para incluir todas las fechas. La fecha inicial no puede ser posterior a la final.

Para obtener un PDF, en **Reportes para imprimir** elegí el listado de stock, las fichas de recetas o el balance de movimientos. En la ventana de impresión, seleccioná **Guardar como PDF**. Los reportes incluyen la información de la sección; si querés imprimir todos los productos, limpiá los filtros del inventario antes de imprimir.

## 12. Recomendaciones de uso

- Registrá cada recepción, despacho o ajuste en el momento.
- Cargá los saldos actuales de las piezas nuevas antes de usar la alarma o registrar movimientos; la calculadora puede usarse desde el principio.
- Mantené SKU únicos y fáciles de identificar.
- Descargá periódicamente el inventario y los movimientos como respaldo.
- Evitá abrir varias copias del sistema a la vez; para compartir datos entre personas o dispositivos se necesita una versión con servidor y base de datos.

## 13. Solución de problemas

| Si ocurre esto | Qué podés hacer |
|---|---|
| No puedo registrar una salida | Revisá el stock disponible y que la cantidad solicitada no lo supere. |
| No puedo producir la cantidad deseada | Consultá la disponibilidad de la receta y reponé el componente que limita la producción. |
| No puedo eliminar un producto | Puede estar usado en una receta. Quitalo de la receta y volvé a intentarlo. |
| No puedo borrar una categoría | Primero cambiá de categoría los productos que todavía pertenecen a ella. |
| La importación muestra un error | Verificá el formato, los encabezados, los SKU duplicados, los campos obligatorios y que el archivo no supere 5 MB. |
| La exportación a Excel o el diseño no carga | Revisá la conexión a Internet. La aplicación utiliza Bootstrap y la biblioteca de Excel desde una CDN. CSV es una alternativa de exportación. |
| Perdí los datos del navegador | Si no exportaste un respaldo, puede que no sea posible recuperarlos. Esta demo no sincroniza ni guarda copias en un servidor. |
