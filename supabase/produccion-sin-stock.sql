-- ============================================================
--  SAINT · Tomar pedidos de producción sin stock
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de produccion-perdido.sql). Se puede correr más de una vez.
-- ============================================================
--
--  Hasta ahora una orden de producción solo se podía crear si había stock de
--  la variante (talle + color). Ahora se puede tomar el pedido igual, con
--  aviso: se descuenta lo que haya y lo que falta queda anotado en
--  stock_pendiente.
--
--  Mientras stock_pendiente > 0 la orden se queda en "Pendiente": no puede
--  pasar a "En producción" porque no está la prenda. Cuando se repone (una
--  compra o una corrección de stock) y se mueve la orden a "En producción",
--  el sistema descuenta en ese momento lo que faltaba y la deja avanzar.
--
-- ------------------------------------------------------------

alter table public.ordenes_produccion
  add column if not exists stock_pendiente int not null default 0
    check (stock_pendiente >= 0);

create index if not exists idx_ordprod_sin_stock
  on public.ordenes_produccion (product_id)
  where stock_pendiente > 0;

-- ¡Listo! Ya podés tomar pedidos aunque no tengas la prenda.
