-- ============================================================
--  SAINT · Molde de la prenda (oversize / básica)
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
-- La categoría sola no alcanza para saber qué medidas tiene una prenda: una
-- remera oversize y una remera básica son las dos `categoria = 'remera'` pero
-- tienen tablas de talles distintas. El molde es lo que las separa.
--
-- Todo lo que ya está cargado queda como 'oversize', que es lo que la web venía
-- mostrando para todos los productos.

alter table public.products
  add column if not exists molde text not null default 'oversize';

-- Sacamos el CHECK antes de crearlo para poder correr este script más de una vez.
alter table public.products
  drop constraint if exists products_molde_check;

alter table public.products
  add constraint products_molde_check
  check (molde in ('oversize', 'basica'));
