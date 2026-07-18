-- ============================================================
--  SAINT · Sistema de gestión: proveedores, compras y ventas manuales
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de schema.sql y orders.sql)
-- ============================================================

-- 0) COSTO Y GANANCIA EN PRODUCTOS -------------------------------------
-- Precio de costo (lo que te sale comprar el producto). La ganancia es
-- simplemente precio - costo. Se actualiza al cargar una compra.
alter table public.products
  add column if not exists costo numeric(10,2) not null default 0 check (costo >= 0);

-- 1) PROVEEDORES --------------------------------------------------------
create table if not exists public.proveedores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text default '',
  email      text default '',
  cuit       text default '',
  notas      text default '',
  created_at timestamptz not null default now()
);

-- 2) COMPRAS (a proveedores) -------------------------------------------
-- Cada compra SUMA stock. items = [{product_id, nombre, cantidad, costo_unitario}]
create table if not exists public.compras (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  fecha        timestamptz not null default now(),
  proveedor_id uuid references public.proveedores(id) on delete set null,
  total        numeric(10,2) not null default 0,
  items        jsonb not null default '[]',
  notas        text default ''
);
create index if not exists idx_compras_fecha on public.compras (fecha desc);

-- 3) VENTAS MANUALES ----------------------------------------------------
-- Ventas hechas por fuera de la web (efectivo, transferencia, Instagram).
-- Cada venta RESTA stock. items = [{product_id, nombre, talle, color, cantidad, precio_unitario}]
create table if not exists public.ventas (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  fecha       timestamptz not null default now(),
  cliente     text default '',
  medio_pago  text default '',   -- efectivo | transferencia | otro
  total       numeric(10,2) not null default 0,
  items       jsonb not null default '[]',
  notas       text default ''
);
create index if not exists idx_ventas_fecha on public.ventas (fecha desc);

-- 4) FUNCIÓN PARA SUMAR STOCK (compras) --------------------------------
create or replace function public.sumar_stock(p_product_id uuid, p_cantidad int)
returns void
language sql
as $$
  update public.products
  set stock = stock + p_cantidad
  where id = p_product_id;
$$;

-- (La función descontar_stock ya se creó en orders.sql)

-- 5) SEGURIDAD (RLS) ----------------------------------------------------
-- Estas tablas son solo del admin: nadie del público las ve ni las toca.
alter table public.proveedores enable row level security;
alter table public.compras     enable row level security;
alter table public.ventas      enable row level security;

drop policy if exists "admin proveedores" on public.proveedores;
create policy "admin proveedores" on public.proveedores
  for all to authenticated using (true) with check (true);

drop policy if exists "admin compras" on public.compras;
create policy "admin compras" on public.compras
  for all to authenticated using (true) with check (true);

drop policy if exists "admin ventas" on public.ventas;
create policy "admin ventas" on public.ventas
  for all to authenticated using (true) with check (true);

-- ¡Listo! Ya tenés proveedores, compras, ventas manuales y costo/ganancia.
