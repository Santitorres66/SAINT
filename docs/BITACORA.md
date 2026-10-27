# SAINT · Bitácora del proyecto

Registro de **todo lo que se fue haciendo** en la tienda y el panel, con el
porqué de cada decisión. La idea es que cualquiera (o Claude, en una sesión
nueva) pueda leer esto y tener el contexto completo sin tener que adivinar.

> **Regla:** cada cambio que se publica suma una entrada arriba de todo en
> [Historial](#historial), y si cambia algo del estado actual se actualiza
> la sección [Estado actual](#estado-actual).

---

## Estado actual

**Web:** https://saint-coral.vercel.app — repo `Santitorres66/SAINT` (rama
`main`, cada push deploya solo en Vercel). Stack: Next.js (App Router) +
TypeScript + Tailwind + Supabase.

**Cómo se vende hoy**

- La tienda web cobra por **transferencia** en modo **manual** (alias
  `saint.prendas`, centavos únicos por pedido, se confirma desde Ventas).
  Talo (CVU por pedido + confirmación automática) está programado pero
  **faltan las credenciales `TALO_*` en Vercel**. Detalle en
  [`PAGO-POR-TRANSFERENCIA.md`](./PAGO-POR-TRANSFERENCIA.md).
- Mercado Pago está apagado (el código sigue, por si vuelve).
- Pedidos con bordado también entran por WhatsApp (`/api/pedido` crea las
  órdenes de producción en Pendiente).

**Módulos del panel (`/admin`)**

| Módulo | Qué hace |
|---|---|
| Tablero | KPIs, facturado vs cobrado por mes, gastos por mes, rentabilidad, qué se vendió por rubro, stock bajo por variante, filtros por período y cliente, reportes Excel |
| Productos | Jerarquía categoría → familia → tipo (molde), tela, stock por talle+color, corrección de stock con motivo, precio por grupo, chequeo de duplicados |
| Producción | Kanban + vista tabla, filtros (estado, cliente, prioridad, prenda, talle, servicio, matriz), matrices, órdenes de servicio, **pedidos sin stock** |
| Mermas | Órdenes perdidas: motivo, etapa, rehacer, cerrar con resolución |
| Ventas | Manuales + web, filtros por canal/rubro/cliente con estado de cuenta, confirmar transferencias |
| Cobranzas | Todo lo cobrado + cuenta corriente por cliente, recordatorio por WhatsApp |
| Compras | Mercadería / insumos / activos fijos, medio de pago y cuotas, editar |
| Clientes, Proveedores, Galería | ABM; la galería alimenta `/galeria` y la home |

**El circuito de un pedido**

```
Pendiente → En producción → Fabricado → Entregado → Vendido → Cobrado
                                   (o Perdido → Mermas)
```

- El stock se descuenta **una sola vez**, al crear la orden de producción.
  La venta que la cierra va con `afecta_stock = false`.
- Si no hay stock, el pedido se puede **tomar igual** (ver 2026-10-26): lo
  que falta queda en `stock_pendiente` y la orden no pasa a producción hasta
  que se repone.
- Vendido y Cobrado los maneja la venta, no el Kanban.

### SQL que tiene que estar corrido en Supabase

En orden. Los que dicen **pendiente** hay que correrlos antes (o después,
según se indique) de usar la función nueva.

"Publicado" = la función que lo usa ya está en la web, así que en principio
se corrió. Confirmado contra la base solo donde lo dice.

| Archivo | Para qué | Estado |
|---|---|---|
| `schema.sql` → `orders.sql` → `gestion.sql` → `clientes.sql` → `produccion.sql` → `variantes.sql` → `compras-tipos-pago.sql` → `produccion-prioridad-fecha.sql` → `cobros.sql` | Base (ver README, Paso 2) | publicado (jul–ago 2026) |
| `stock-correcciones.sql` | Corrección de stock con motivo | publicado 2026-08-17 |
| `producto-molde.sql`, `producto-molde-libre.sql`, `producto-jerarquia.sql` | Tipo/molde y familia de productos | publicado 2026-09 |
| `galeria.sql` | Galería de trabajos | publicado 2026-09-25 |
| `produccion-servicios.sql` | Órdenes de servicio | publicado 2026-10-10 |
| `stock-upsert-variantes.sql` | Sumar stock crea la variante si falta | publicado 2026-10-11 (opcional) |
| `pagos-transferencia.sql` | Pago por transferencia | **confirmado** 2026-10-13 |
| `producto-tela.sql` | Tela como campo propio | publicado 2026-10-15 |
| `produccion-perdido.sql` | Estado Perdido + Mermas | publicado 2026-10-24 |
| **`produccion-sin-stock.sql`** | Tomar pedidos sin stock | **pendiente** (2026-10-26) |

Scripts de una sola vez / diagnóstico (no son migraciones):
`carga-compras-historicas.sql`, `unificar-productos.sql`,
`unificar-duplicados-auto.sql`, `diagnostico-stock.sql`.

> Si algún "corrido" resulta no estarlo, el síntoma suele ser un error de
> columna inexistente al guardar. Todos se pueden correr más de una vez.

### Pendientes / ideas abiertas

- Cargar credenciales de Talo en Vercel (probar primero con `TALO_SANDBOX=1`).
- Correr `produccion-sin-stock.sql`.

---

## Historial

Lo más nuevo arriba.

### 2026-10-26 — Producción: tomar pedidos aunque no haya stock

**Pedido:** poder crear una orden de producción aunque no haya stock de esa
prenda, con advertencia, y reponer después; mientras no esté la prenda, la
orden no puede pasar a producción.

**Cómo quedó:**

- El formulario de nueva orden ahora lista **todas** las prendas, colores y
  talles, también los que están en 0 (primero lo que tiene stock, y cada
  opción dice "sin stock" o "N en stock").
- Si la cantidad pedida supera el stock de la variante aparece un **aviso
  ámbar** con lo que hay y lo que falta, y la casilla **"Tomar el pedido
  igual"**. Sin marcarla no deja guardar (se valida también en el servidor).
- Al crear se descuenta lo que haya y el resto queda en la columna nueva
  `ordenes_produccion.stock_pendiente`.
- La orden se ve con el aviso **"Sin stock: faltan N"** en la tarjeta del
  Kanban, en la tabla y en el detalle.
- **No puede salir de Pendiente** (a En producción, Fabricado o Entregado)
  mientras falte stock. Cuando se repone (compra o corrección de stock) y se
  mueve la orden, el sistema descuenta en ese momento lo que faltaba y la deja
  avanzar. Si se repuso solo una parte, descuenta esa parte y avisa cuántas
  siguen faltando.
- Eliminar una orden devuelve solo lo que realmente se había descontado.
- **Rehacer** una merma ya no falla por falta de stock: la orden nueva se toma
  igual y queda esperando stock (hay un cliente esperando).

**Decisiones:**

- No se deja el stock en negativo: el faltante vive en la orden, no en la
  variante. Así el stock de productos sigue diciendo la verdad (lo que hay en
  el estante) y lo que se debe se ve en Producción.
- El descuento de lo pendiente se hace al pasar a producción y no al cargar
  la compra: la compra no tiene por qué saber qué orden la estaba esperando,
  y así no se reparte stock solo entre varias órdenes sin que nadie decida.
- La columna nueva solo se manda al crear cuando hay faltante, así las
  órdenes comunes siguen funcionando aunque el SQL no se haya corrido.

**Archivos:** `supabase/produccion-sin-stock.sql` (nuevo, **correrlo**),
`src/app/admin/produccion-actions.ts`,
`src/components/admin/OrdenProduccionForm.tsx`,
`src/components/admin/ProduccionBoard.tsx`,
`src/components/admin/ProduccionTabla.tsx`,
`src/app/admin/(panel)/produccion/[id]/page.tsx`, `src/lib/types.ts`.

### 2026-10-24 — Producción: pestaña Mermas

- Perdido y Cobrado ya no se ven en el tablero; lo perdido tampoco en Tabla.
- Al marcar una orden como perdida se pide motivo, detalle y si se rehace
  (orden nueva en Pendiente, prioridad alta, vinculada a la original).
- Pestaña Mermas: casos abiertos, costo perdido del mes y total, unidades,
  desglose por motivo y seguimiento (rehacer, cerrar con resolución, o volver
  a producción si fue un error). Requiere `produccion-perdido.sql`.

### 2026-10-24 — Producción: Cobrado sale del tablero y estado Perdido

- Las órdenes cobradas terminaron el circuito: no se muestran en el tablero
  (siguen en Tabla y en el detalle).
- Estado "Perdido" para prendas rotas o bordados que salieron mal. No toca
  stock (ya se descontó al crear la orden).

### 2026-10-24 — Cobranzas

- Una venta sin saldo (total 0 o descuento total) queda cobrada al cargarla
  y su orden pasa a Cobrado. "Marcar como cobrada" para las que quedaron
  trabadas.
- Pestaña **Cobranzas**: todo lo cobrado (manual + web) y la cuenta corriente
  por cliente. Botón de **recordatorio de saldo por WhatsApp** con el mensaje
  ya escrito.

### 2026-10-15 — Varias correcciones de productos, compras y producción

- **Producción:** filtros por prenda y por talle (armados con lo que aparece
  en las órdenes). La función que nombra el trabajo de una orden pasó a
  `constants` para que tablero, tabla y filtro coincidan.
- **Productos — tela:** campo propio para remeras y buzos (Heavyweight /
  Estándar…). El nombre no se toca (es lo que ve el cliente). El chequeo de
  duplicados la tiene en cuenta. Filtro por tela y columna en ventas/compras.
  Requiere `producto-tela.sql`.
- **Productos — duplicados:** script `unificar-duplicados-auto.sql` en tres
  pasos (mirar, ejecutar, confirmar); sobrevive el que tiene fotos y, entre
  esos, el más viejo. No se pierde stock ni historial.
- **Compras sin talle:** una línea sin talle no sumaba stock y no avisaba (así
  se perdieron 18 remeras de la compra del 8/10). Ahora talle y color son
  obligatorios cuando el producto los usa (formulario y servidor); se ofrecen
  los talles de la categoría, no solo los cargados. Botón de costo de envío.
  `diagnostico-stock.sql` para encontrar compras que no sumaron.
- **Compras — talle nuevo:** se puede comprar un talle que el producto no
  tenía; la compra crea la variante y suma el talle a la ficha.
- Redeploy para tomar credenciales de Talo.

### 2026-10-13 — Tienda: pago por transferencia

El carrito deja Mercado Pago y cobra por transferencia, como Tiendanube:
monto exacto + alias. Dos modos: Talo (automático por webhook) y cuenta
propia con centavos únicos (se confirma desde Ventas). La confirmación vive
en una sola función atómica que no descuenta stock dos veces. Ver
[`PAGO-POR-TRANSFERENCIA.md`](./PAGO-POR-TRANSFERENCIA.md).

### 2026-10-12 — Producción: vista de tabla y filtros

Con 63 órdenes el Kanban no alcanzaba. Vista tabla ordenable (fichas en
celular), la vista elegida se recuerda. Filtros por estado (por columna),
cliente, prioridad, prenda/servicio y matriz, válidos en las dos vistas.
Desde la tabla también se vende y se cobra.

### 2026-10-11 — Productos: frenar duplicados

El alta avisa si ya existe ese modelo + color y propone editarlo. El buscador
de compras muestra los talles de cada producto. SQL opcionales:
`unificar-productos.sql` y `stock-upsert-variantes.sql` (sumar stock a una
variante inexistente no hacía nada).

### 2026-10-10 — Producción: órdenes de servicio

La orden tiene tipo: prenda propia o **servicio de bordado**. En servicio la
prenda es opcional (si la trae el cliente no toca stock). El reporte de ventas
suma la columna "Tipo". Requiere `produccion-servicios.sql`.

### 2026-10-09 — Productos: stock talle por talle

Cada talle es un chip con su número (rojo 0, ámbar poco, gris ok). Filtro
"Con talles en 0" = lista de recompra.

### 2026-09-29 — Tablero: reportes en Excel

Ventas, compras y stock por variante, con filtro de período.

### 2026-09-25 — Gran actualización de catálogo y web

- **Productos:** listado por bloques (categoría → familia → tipo), precio
  editable en la fila y "precio del grupo/familia". Jerarquía de tres
  niveles; categorías finales: buzos, remeras, gorras y sombreros (crops pasan
  a tipo de remera, canguros a buzo). Lo sin clasificar se marca en ámbar.
  SQL: `producto-molde-libre.sql`, `producto-jerarquia.sql`.
- **Web:** productos del mismo modelo se agrupan en una tarjeta con sus
  colores; catálogo por secciones con orden "Sugerido"; animaciones (todo en
  `globals.css`, respeta reduced-motion); **previsualizador de bordado**
  (motivo/texto/imagen sobre la prenda, tamaño e hilo, 29 hilos + campo
  libre); **galería** de trabajos reales (`galeria.sql`).
- **Ficha:** muestra todos los colores del modelo.
- **Pedido por WhatsApp:** `/api/pedido` crea órdenes en Pendiente y devuelve
  el mensaje; siempre devuelve el mensaje aunque falle la base. El bordado
  está incluido en el precio (solo diseños muy complejos se hablan aparte).
- **Admin:** componente `Buscador` (filtra escribiendo, sin acentos) en lugar
  de desplegables largos; color en la etiqueta de cada producto.
- **Galería admin:** filtros por estado (web/home/archivo) y búsqueda.

### 2026-09-04 — Filtros de tienda y del tablero

- Tienda: búsqueda, talle y color múltiples, rango de precio, orden. Todo en
  la URL y filtrado en la base.
- Tablero: filtro por cliente, cobrado por mes (por fecha de cobro) y gastos
  por mes (mercadería / insumos / maquinaria). Facturado y cobrado comparten
  escala a propósito.
- Ventas: filtro por cliente con estado de cuenta.

### 2026-09-02 — Tabla de talles de la remera básica

`products.molde` para distinguir oversize de básica. `producto-molde.sql`.

### 2026-08-21 — Tablero, compras históricas y Kanban

- Compras y rentabilidad en el tablero (resultado del mes resta insumos pero
  no activos fijos). Filtro por rubro en ventas y tablero.
- Carga de 18 compras históricas ($4.081.586,19, incluye la bordadora Brother
  P910L en 24 cuotas) con `carga-compras-historicas.sql`.
- Kanban: Entregado y Vendido comparten columna; barra de scroll arriba;
  arreglo del botón "Ver".

### 2026-08-17 — Stock con motivo, editar compras, compartir producto

- El stock ya no se edita: se **corrige** con motivo obligatorio y queda
  historial (`stock-correcciones.sql`).
- Compras editables (revierte y reaplica stock).
- Botón compartir con el talle y color elegidos.

### 2026-08-13 — Cerrar el circuito: Vendido y Cobrado

"Cargar como vendido" desde Entregado; cobros parciales en la tabla `cobros`;
el estado de cobro lo calcula la base. Se corrigió el doble descuento de
stock (`afecta_stock = false`). La ganancia de una venta de producción usa el
`costo_total` de la orden. `cobros.sql`.

### 2026-08-01 a 2026-08-08 — Producción y tablero

Tabla de talles en la tienda; prenda en cascada (modelo → color → talle);
editar órdenes ya creadas; prioridad + fecha estimada con aviso de atraso
(el rojo queda reservado para "atrasado"); foto del producto en tarjeta y
detalle; compras con tipo (mercadería / insumo / activo fijo) y medio de pago
con cuotas; arreglo del gráfico de barras y torta por canal; stock bajo por
variante.

### 2026-07-29 a 2026-07-31 — Producción, clientes y stock por variante

Producción en 4 etapas (matrices con bucket privado, alta de orden, Kanban
drag & drop, detalle con historial); descuento y devolución de stock; master
de clientes; **stock por variante** (talle + color) en todo el sistema; la
venta online genera orden de producción; stock valorizado; tema claro de la
web; filtros de productos; analítica de ventas con filtro de fecha.

### 2026-07-18 a 2026-07-20 — Arranque

Tienda online con web pública, panel admin y Mercado Pago. Sistema de
gestión: proveedores, compras, ventas manuales, costo/ganancia y tablero.
WhatsApp real (+54 9 3512 08-1452) y botón flotante. Edición de ventas
manuales.

---

## Fuera del código

- **Reels de venta:** generador en `SAINT_REEL_VENTA/generador/` (fuera del
  repo). Estilo que funciona: gorras enteras, todas las fotos, stickers /
  polaroid, humor y ritmo; lo tierno y lento no.
- **Fotos:** `MARKETING/FOTOS DE GORRAS` (fuera del repo).
