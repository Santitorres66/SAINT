-- ============================================================
--  SAINT · Órdenes de compra + descuento de stock (Mercado Pago)
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de schema.sql)
-- ============================================================

-- 1) TABLA DE ÓRDENES ---------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  status           text        not null default 'pending', -- pending | approved | rejected | cancelled
  total            numeric(10,2) not null default 0,
  items            jsonb       not null default '[]',        -- detalle de productos comprados
  comprador        jsonb,                                     -- {nombre, email} (lo completa Mercado Pago)
  mp_preference_id text,                                      -- id de la preferencia de pago
  mp_payment_id    text                                       -- id del pago (cuando se aprueba)
);

create index if not exists idx_orders_created on public.orders (created_at desc);
create index if not exists idx_orders_status  on public.orders (status);

-- 2) SEGURIDAD (RLS) ----------------------------------------------------
alter table public.orders enable row level security;

-- Solo el admin logueado puede LEER las órdenes desde el panel.
drop policy if exists "admin lee ordenes" on public.orders;
create policy "admin lee ordenes"
  on public.orders
  for select
  to authenticated
  using (true);

-- Nadie escribe órdenes con la clave pública: las crea/actualiza el servidor
-- con la clave secreta (service_role), que saltea RLS de forma segura.

-- 3) FUNCIÓN PARA DESCONTAR STOCK DE FORMA ATÓMICA ---------------------
-- El webhook la llama cuando el pago se aprueba. Nunca baja de 0.
create or replace function public.descontar_stock(p_product_id uuid, p_cantidad int)
returns void
language sql
as $$
  update public.products
  set stock = greatest(stock - p_cantidad, 0)
  where id = p_product_id;
$$;

-- ¡Listo! Ya tenés la tabla de órdenes y el descuento de stock.
