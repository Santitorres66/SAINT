-- ============================================================
--  SAINT · Master de Clientes
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) TABLA DE CLIENTES --------------------------------------------------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  apellido      text default '',
  telefono      text default '',
  email         text default '',
  domicilio     text default '',
  localidad     text default '',
  provincia     text default '',
  observaciones text default '',
  created_at    timestamptz not null default now()
);

alter table public.clientes enable row level security;
drop policy if exists "admin clientes" on public.clientes;
create policy "admin clientes" on public.clientes
  for all to authenticated using (true) with check (true);

-- 2) RELACIÓN CON VENTAS Y ÓRDENES DE PRODUCCIÓN -----------------------
-- Guardamos cliente_id (opcional). El texto "cliente" queda como respaldo/mostrar.
alter table public.ventas
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

alter table public.ordenes_produccion
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

-- ¡Listo! Ya tenés el master de clientes relacionado con ventas y producción.
