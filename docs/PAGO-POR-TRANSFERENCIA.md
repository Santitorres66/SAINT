# Pago por transferencia con confirmación automática

> Estudio + implementación. Octubre 2026.
> Objetivo: que la web de SAINT cobre como la tienda de Taller de Santa Clara
> (Tiendanube): el cliente arma el carrito, ve **el monto exacto y un alias**,
> transfiere, y **el pedido se confirma solo**.

---

## 1. Qué estudiamos

### La compra de referencia

Pedido #41411 en `tallerdesantaclara.com.ar` (Tiendanube):

- 13 remeras, subtotal $117.500, envío $12.874,40 → **total $130.374,40**.
- Pedido hecho 13:35 → **"Pago confirmado" 14:18**, sin intervención de nadie.
- La página de éxito no muestra el medio de pago ni la entidad; eso se ve solo
  durante el checkout.

### Cómo lo hace Tiendanube (Pago Nube)

| Tema | Cómo funciona |
|------|---------------|
| Quién está atrás | **dLocal** (procesadora de Pago Nube) es dueña del CVU. |
| Modelo actual | **Un CVU único por tienda** para todas las ventas. Antes era un CVU temporal por pedido. |
| Cómo sabe de quién es cada pago | Pide el **DNI** en el checkout y cruza **CVU de la tienda + CUIT de quien transfiere + monto exacto (con centavos)**. Si el DNI no coincide con el titular de la cuenta, devuelve la plata. |
| Tolerancia | Acepta hasta 1 USD oficial de más o $15 de menos. Fuera de eso devuelve solo (hasta 96 hs hábiles). |
| Plazo para pagar | 24 hs; después el pago queda "Vencido". |
| Comisión | 1,50% + IVA (planes Inicial/Esencial), 0,99% Impulso, 0,85% Escala. |

Fuentes: ayuda de Tiendanube sobre Pago Nube
([cómo funciona](https://ayuda.tiendanube.com/es_AR/preguntas-frecuentes-pago-nube/como-funcionan-los-pagos-con-transferencia-bancaria-en-pago-nube),
[monto diferente](https://ayuda.tiendanube.com/es_AR/preguntas-frecuentes-pago-nube/que-pasa-si-el-monto-de-la-transferencia-es-diferente-al-de-la-compra-en-pago-nube),
[acreditación](https://ayuda.tiendanube.com/es_AR/preguntas-frecuentes-pago-nube/cuando-se-acredita-el-dinero-de-una-venta-en-pago-nube)).

**Conclusión:** ese mecanismo exacto no se puede copiar con una cuenta propia,
porque requiere ser el dueño del CVU y ver en tiempo real el CUIT de quien
transfiere. Lo que sí se puede es **lograr la misma experiencia** con un
proveedor que dé CVU por pedido.

### Opciones evaluadas para una web propia

| Opción | ¿Sirve? | Por qué |
|--------|---------|---------|
| **Talo** (talo.com.ar) | ✅ **Elegida** | API pública, **CVU + alias propios para cada pedido**, webhook, sandbox para probar, alta como monotributista con DNI, **1% + IVA**. |
| Mercado Pago | ❌ | En Argentina no ofrece "transferencia" como medio de pago (no hay CVU por cobro) y no tiene webhook de transferencias recibidas. Leer movimientos por API no está documentado y es frágil. |
| Localpayment / dLocal | ⚠️ | Tienen CVU por pedido, pero apuntan a empresas: verificación corporativa, IPs en lista blanca, etc. |
| Ualá Bis | ❌ | Su API solo documenta tarjetas. |
| BIND, TelePagos | ⚠️ | Alta comercial con el banco, sin webhooks documentados. |
| Alias propio + revisar el banco a mano | ✅ como plan B | Funciona desde el día 1 sin dar de alta nada, pero alguien confirma cada pago. |

Detalles verificados de Talo ([docs](https://docs.talo.com.ar/transfers/payments-api)):

- `POST /payments/` con `user_id`, monto, `payment_options: ["transfer"]` y
  `external_id` (nuestro id de pedido) → devuelve **CVU, alias y vencimiento**
  (~5 días).
- Estados: `PENDING`, `SUCCESS`, `OVERPAID` (pagó de más), `UNDERPAID` (pagó
  de menos), `EXPIRED`.
- Webhook mínimo `{ paymentId, externalId }`, **sin firma todavía**: el estado
  real se consulta con `GET /payments/{id}` usando un token
  (`POST /users/{user_id}/tokens` con `client_id` + `client_secret`).
- Sandbox: `sandbox-api.talo.com.ar` y un simulador para "transferir" plata de
  mentira.

---

## 2. Cómo quedó en SAINT

La web elige sola el modo según las variables de entorno:

| | **Modo Talo (automático)** | **Modo manual (plan B)** |
|-|----------------------------|--------------------------|
| Se activa con | `TALO_USER_ID` + `TALO_CLIENT_ID` + `TALO_CLIENT_SECRET` | `TRANSFERENCIA_ALIAS` (y opcional `TRANSFERENCIA_CBU`, `TRANSFERENCIA_TITULAR`) |
| A dónde transfiere el cliente | Un CVU/alias **nuevo para su pedido** | El alias propio de SAINT |
| Monto | El precio exacto | El precio **+ centavos únicos** (ej. $45.000,37), para reconocer cada transferencia |
| Confirmación | **Sola**, en segundos | La hace el admin con un botón |

Si están las dos configuraciones, gana Talo.

### El recorrido del cliente

1. Arma el carrito → deja **nombre, WhatsApp** (obligatorio), email y notas.
2. Toca **"Pagar por transferencia"** → va a `/pedido/<id>?k=<clave>`.
3. Ve **el monto exacto**, el **alias** y el **CVU**, cada uno con su botón de
   copiar, y los 3 pasos.
4. Transfiere desde su banco. Al volver a la pestaña, la página consulta
   enseguida y **cambia sola a "¡Pago recibido!"**, con un botón para
   coordinar bordado y envío por WhatsApp.
5. Si no paga en el plazo, el pedido vence y nadie bloqueó stock.

Si tiene dudas con el bordado, en el carrito sigue estando
**"Consultalo antes por WhatsApp"**, que es el circuito de siempre.

### Qué pasa cuando entra la plata

Todo pasa por una sola función, `confirmarOrden` (`src/lib/confirmar-orden.ts`):

- La orden pasa a **approved** (una sola vez, aunque lleguen dos avisos juntos).
- Se **descuenta el stock** de cada variante.
- Se abre una **orden de producción** por prenda en el tablero, con el
  bordado, el teléfono y las notas del cliente.
- La venta aparece en **Ventas** como cobrada, con medio
  "Transferencia (Talo) · WEB-XXXXX".

Casos especiales con Talo:

- **Pagó de más:** se confirma igual y queda una alerta en Ventas para
  devolver la diferencia desde Talo.
- **Pagó de menos:** **no** se confirma; queda en Ventas para que decidas
  (confirmar igual o cancelar y devolver).
- **Se perdió el aviso de Talo:** la página del cliente le pregunta a Talo
  cada 6 segundos mientras está abierta, y en el admin hay un botón
  **"Consultar en Talo"**.

### En el admin

**Ventas → "Pedidos web por transferencia"** (solo aparece si hay algo):
pedidos esperando la plata, con el monto a buscar en el banco y botones
**"Ya entró la plata · confirmar"**, **"Consultar en Talo"** y
**"Cancelar pedido"**.

### Seguridad

- Los precios y el stock se recalculan en el servidor; el navegador no decide
  nada.
- Cada pedido tiene una **clave secreta** en su link; sin ella no se ve.
- El aviso de Talo no se cree: solo indica qué cobro mirar, y el estado se
  consulta a Talo con nuestro token. Además se verifica que el cobro sea de
  ese pedido y por ese monto.
- Las claves de Talo y de Supabase viven solo en el servidor (Vercel).

### Archivos

| Archivo | Qué hace |
|---------|----------|
| `supabase/pagos-transferencia.sql` | Columnas nuevas en `orders`. |
| `src/lib/talo.ts` | Cliente de la API de Talo. |
| `src/lib/pago-transferencia.ts` | Modos, centavos únicos, conciliación. |
| `src/lib/confirmar-orden.ts` | Confirmar un pedido (stock + producción). |
| `src/lib/carrito-servidor.ts` | Validar carrito, precios y stock. |
| `src/app/api/checkout/transferencia/route.ts` | Crea el pedido y el CVU. |
| `src/app/api/orden/[id]/route.ts` | Estado del pedido (lo consulta la página). |
| `src/app/api/webhooks/talo/route.ts` | Recibe el aviso de Talo. |
| `src/app/(public)/pedido/[id]/page.tsx` + `src/components/PagoTransferencia.tsx` | La pantalla de pago. |
| `src/app/admin/transferencias-actions.ts` + `src/components/admin/TransferenciasPendientes.tsx` | El panel del admin. |

---

## 3. Puesta en marcha

### Paso 1 — Base de datos (obligatorio, antes de publicar)

Supabase → **SQL Editor** → pegar `supabase/pagos-transferencia.sql` → **Run**.

### Paso 2a — Arrancar ya en modo manual

**Ya está hecho:** la cuenta de SAINT (alias `saint.prendas`) quedó cargada
en `src/lib/pago-transferencia.ts`. Para cambiarla sin tocar código, se
pueden cargar estas variables en Vercel → **Settings → Environment
Variables**, que tienen prioridad:

```env
TRANSFERENCIA_ALIAS=tu.alias.saint
TRANSFERENCIA_CBU=0000000000000000000000      # opcional
TRANSFERENCIA_TITULAR=Nombre del titular      # opcional
NEXT_PUBLIC_SITE_URL=https://saint-coral.vercel.app
```

### Paso 2b — Pasar a automático con Talo

1. Crear la cuenta en [talo.com.ar](https://talo.com.ar) (monotributo + DNI +
   validación biométrica).
2. **Probar primero en sandbox:** crear cuenta en
   [sandbox.talo.com.ar](https://sandbox.talo.com.ar), sacar las credenciales
   en *Usuario → Credenciales*, y cargar en Vercel:

   ```env
   TALO_USER_ID=...
   TALO_CLIENT_ID=...
   TALO_CLIENT_SECRET=...
   TALO_SANDBOX=1
   ```

3. Hacer un pedido en la web, copiar el CVU y "pagarlo" desde el
   [simulador de Talo](https://docs.talo.com.ar/sandbox/simulator). La página
   del pedido tiene que pasar sola a "¡Pago recibido!" y el pedido aparecer en
   Producción y en Ventas.
4. Cuando funcione: cambiar las tres credenciales por las de producción y
   **borrar `TALO_SANDBOX`**. Redeploy.

Con Talo configurado, el webhook se arma solo:
`https://saint-coral.vercel.app/api/webhooks/talo` (no hay que cargarlo en
ningún panel; viaja en cada cobro).

---

## 4. Límites y cosas a saber

- **Bordados que no se pueden hacer.** Antes el pago estaba apagado justamente
  porque algunos diseños se ven recién al mirarlos. Ahora se cobra antes: si
  un pedido pagado no se puede hacer, se devuelve la plata (desde Talo o desde
  tu cuenta). El carrito mantiene el aviso de que la vista previa es una
  referencia y ofrece consultar antes por WhatsApp.
- **Stock:** se descuenta al pagar, no al pedir. Si dos personas pagan a la vez
  la última unidad, las dos se confirman y el stock queda en 0: se resuelve
  hablando con una de ellas. Con el volumen de SAINT es un caso raro.
- **Envío:** igual que antes, se coordina por WhatsApp después del pago. No
  está sumado al total.
- **Webhooks sin firma:** Talo dice que la firma llega "pronto". Cuando esté,
  conviene validarla en `api/webhooks/talo`.
- **Plata de Talo:** queda en tu cuenta de Talo y se retira al banco desde su
  panel.
- **Mercado Pago:** quedó fuera del carrito, pero su código sigue en el
  proyecto (`api/checkout`, `api/webhooks/mercadopago`) por si se quiere
  volver a ofrecer.
