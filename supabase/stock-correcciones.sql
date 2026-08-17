-- ============================================================
--  SAINT · Correcciones de stock
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
--  El stock se mueve solo por movimientos reales:
--    + compras     (sumar_stock_variante)
--    - ventas      (descontar_stock_variante)
--    - pérdidas    (descontar_stock_variante)
--
--  Cuando el número igual no coincide con lo que hay en el depósito, se
--  corrige a mano. Esa corrección NO es un movimiento comercial, así que
--  queda registrada aparte, con motivo obligatorio y autor.

-- 1) LIBRO DE CORRECCIONES ---------------------------------------------
create table if not exists public.stock_correcciones (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  talle          text not null default '',
  color          text not null default '',
  stock_anterior int  not null,
  stock_nuevo    int  not null,
  -- Positiva si aparecieron unidades, negativa si faltaban.
  diferencia     int  not null,
  motivo         text not null,
  usuario        text not null default '',
  created_at     timestamptz not null default now(),
  constraint motivo_no_vacio check (btrim(motivo) <> '')
);

create index if not exists idx_correcciones_product
  on public.stock_correcciones (product_id, created_at desc);

-- 2) SEGURIDAD (RLS) ----------------------------------------------------
alter table public.stock_correcciones enable row level security;

-- Es información interna: solo el admin autenticado la ve y la escribe.
drop policy if exists "admin correcciones" on public.stock_correcciones;
create policy "admin correcciones" on public.stock_correcciones
  for all to authenticated using (true) with check (true);

-- 3) CORREGIR EL STOCK DE UNA VARIANTE ---------------------------------
-- Fija el stock al valor real contado y deja el registro, todo en una sola
-- operación para que no puedan quedar desfasados.
create or replace function public.corregir_stock_variante(
  p_product_id uuid,
  p_talle      text,
  p_color      text,
  p_stock_nuevo int,
  p_motivo     text,
  p_usuario    text default '')
returns int language plpgsql as $$
declare
  v_talle    text := coalesce(p_talle, '');
  v_color    text := coalesce(p_color, '');
  v_anterior int;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El motivo de la corrección es obligatorio.';
  end if;
  if p_stock_nuevo is null or p_stock_nuevo < 0 then
    raise exception 'El stock corregido no puede ser negativo.';
  end if;

  select stock into v_anterior
    from public.product_variantes
   where product_id = p_product_id
     and talle = v_talle
     and color = v_color
   for update;

  if v_anterior is null then
    -- La variante todavía no existía: la creamos con el valor contado.
    insert into public.product_variantes (product_id, talle, color, stock)
    values (p_product_id, v_talle, v_color, p_stock_nuevo);
    v_anterior := 0;
  else
    update public.product_variantes
       set stock = p_stock_nuevo
     where product_id = p_product_id
       and talle = v_talle
       and color = v_color;
  end if;

  -- Si el número no cambió, no ensuciamos el historial.
  if p_stock_nuevo <> v_anterior then
    insert into public.stock_correcciones (
      product_id, talle, color,
      stock_anterior, stock_nuevo, diferencia,
      motivo, usuario)
    values (
      p_product_id, v_talle, v_color,
      v_anterior, p_stock_nuevo, p_stock_nuevo - v_anterior,
      btrim(p_motivo), coalesce(p_usuario, ''));
  end if;

  return p_stock_nuevo - v_anterior;
end;
$$;

-- ¡Listo! Ahora toda corrección manual de stock queda asentada con su motivo.
