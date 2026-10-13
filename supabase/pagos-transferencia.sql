-- ============================================================
--  SAINT · Pago por transferencia (monto exacto + alias/CVU)
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de orders.sql y cobros.sql)
-- ============================================================
--
--  Qué agrega a `orders`:
--   · Cómo se paga cada pedido (mercadopago | transferencia).
--   · Los datos de la transferencia que se le muestran al cliente: monto
--     exacto, alias, CVU y hasta cuándo vale.
--   · El id del cobro en Talo, que es quien avisa cuando entra la plata.
--   · Una clave secreta por pedido para que el cliente pueda ver SU pedido
--     (y solo el suyo) sin tener cuenta.
--
--  Las órdenes viejas de Mercado Pago quedan con metodo_pago = 'mercadopago'.
-- ------------------------------------------------------------

alter table public.orders
  add column if not exists metodo_pago text not null default 'mercadopago',
  -- Código corto para nombrar el pedido por WhatsApp (WEB-7KQ2)
  add column if not exists referencia  text,
  -- Clave que va en el link del pedido: sin ella no se ve
  add column if not exists acceso      text,
  -- Lo que hay que transferir. Puede llevar centavos (ver modo manual).
  add column if not exists pago_monto  numeric(12,2),
  add column if not exists pago_alias  text,
  add column if not exists pago_cvu    text,
  add column if not exists pago_vence  timestamptz,
  -- Id del cobro en Talo y su último estado (PENDING, SUCCESS, OVERPAID,
  -- UNDERPAID, EXPIRED). Null en el modo manual.
  add column if not exists pago_id     text,
  add column if not exists pago_estado text,
  add column if not exists pagado_at   timestamptz,
  add column if not exists notas       text not null default '';

-- Un cobro de Talo pertenece a un solo pedido, y una referencia también.
create unique index if not exists ux_orders_pago_id
  on public.orders (pago_id) where pago_id is not null;
create unique index if not exists ux_orders_referencia
  on public.orders (referencia) where referencia is not null;

-- El admin busca "las transferencias que faltan confirmar".
create index if not exists idx_orders_metodo_status
  on public.orders (metodo_pago, status);

-- ¡Listo! No hace falta tocar nada más: las órdenes aprobadas siguen
-- apareciendo en Ventas como siempre.
