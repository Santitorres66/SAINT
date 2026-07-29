-- ============================================================
--  SAINT · Stock por variante (talle + color)
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) TABLA DE VARIANTES -------------------------------------------------
-- Una fila por combinación talle+color de cada producto, con su stock.
create table if not exists public.product_variantes (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  talle      text not null default '',
  color      text not null default '',
  stock      int  not null default 0,
  unique (product_id, talle, color)
);
create index if not exists idx_variantes_product on public.product_variantes (product_id);

-- 2) SEGURIDAD (RLS) ----------------------------------------------------
alter table public.product_variantes enable row level security;
-- El público puede LEER el stock por variante (para mostrar disponibilidad).
drop policy if exists "public lee variantes" on public.product_variantes;
create policy "public lee variantes" on public.product_variantes
  for select to anon using (true);
-- El admin puede todo.
drop policy if exists "admin variantes" on public.product_variantes;
create policy "admin variantes" on public.product_variantes
  for all to authenticated using (true) with check (true);

-- 3) TOTAL DEL PRODUCTO = SUMA DE SUS VARIANTES ------------------------
create or replace function public.recompute_product_stock()
returns trigger language plpgsql as $$
declare pid uuid;
begin
  pid := coalesce(new.product_id, old.product_id);
  update public.products
  set stock = coalesce(
    (select sum(stock) from public.product_variantes where product_id = pid), 0)
  where id = pid;
  return null;
end;
$$;
drop trigger if exists trg_variantes_stock on public.product_variantes;
create trigger trg_variantes_stock
  after insert or update or delete on public.product_variantes
  for each row execute function public.recompute_product_stock();

-- 4) FUNCIONES PARA MOVER STOCK DE UNA VARIANTE ------------------------
create or replace function public.descontar_stock_variante(
  p_product_id uuid, p_talle text, p_color text, p_cantidad int)
returns void language sql as $$
  update public.product_variantes
  set stock = greatest(stock - p_cantidad, 0)
  where product_id = p_product_id
    and talle = coalesce(p_talle, '')
    and color = coalesce(p_color, '');
$$;

create or replace function public.sumar_stock_variante(
  p_product_id uuid, p_talle text, p_color text, p_cantidad int)
returns void language sql as $$
  update public.product_variantes
  set stock = stock + p_cantidad
  where product_id = p_product_id
    and talle = coalesce(p_talle, '')
    and color = coalesce(p_color, '');
$$;

-- ¡Listo! El stock ahora se maneja por variante (talle + color).
-- El total de cada producto se calcula solo.
