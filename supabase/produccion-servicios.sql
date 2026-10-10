-- ============================================================
--  SAINT · Órdenes de servicio (bordado sobre prenda ajena)
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de produccion.sql)
-- ============================================================

-- Marca si la orden es un servicio de bordado en vez de la producción de una
-- prenda propia. Es independiente del stock: un servicio puede salir del
-- catálogo (y descontar stock, como cualquier orden) o hacerse sobre una
-- prenda que trae el cliente (y no tocarlo). Lo que define al servicio es
-- cómo se reporta el ingreso, no de dónde sale la prenda.
alter table public.ordenes_produccion
  add column if not exists es_servicio boolean not null default false;

-- Los reportes filtran por este campo para separar la facturación por
-- servicios de la de prendas.
create index if not exists idx_ordprod_servicio
  on public.ordenes_produccion (es_servicio);

-- ¡Listo! Ya podés marcar órdenes como servicio.
