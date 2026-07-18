-- ============================================================
--  SAINT · Setup completo de base de datos + storage
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) TABLA DE PRODUCTOS -------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  nombre      text        not null,
  categoria   text        not null
              check (categoria in ('buzo','remera','gorra','canguro','crop')),
  precio      numeric(10,2) not null default 0 check (precio >= 0),
  descripcion text        default '',
  colores     text[]      not null default '{}',   -- ej: {'Negro','Blanco'}
  talles      text[]      not null default '{}',   -- ej: {'S','M','L','XL'}
  imagenes    text[]      not null default '{}',   -- URLs públicas de Supabase Storage
  stock       integer     not null default 0 check (stock >= 0),
  activo      boolean     not null default true,   -- si es false no se muestra en la web
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Índices para que el catálogo filtre rápido
create index if not exists idx_products_activo    on public.products (activo);
create index if not exists idx_products_categoria on public.products (categoria);

-- Mantener updated_at al día automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- 2) SEGURIDAD DE LA TABLA (RLS) ----------------------------------------
-- Con RLS activo, nadie ve/toca nada salvo lo que permitan las políticas.
alter table public.products enable row level security;

-- El público (clave publishable = rol anon) SOLO lee productos activos.
drop policy if exists "publico lee activos" on public.products;
create policy "publico lee activos"
  on public.products
  for select
  to anon
  using (activo = true);

-- El admin logueado (rol authenticated) puede ver y hacer TODO.
drop policy if exists "admin acceso total" on public.products;
create policy "admin acceso total"
  on public.products
  for all
  to authenticated
  using (true)
  with check (true);

-- 3) BUCKET DE IMÁGENES -------------------------------------------------
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

-- 4) SEGURIDAD DEL STORAGE ---------------------------------------------
-- Cualquiera puede VER las imágenes (necesario para mostrarlas en la web).
drop policy if exists "publico ve imagenes" on storage.objects;
create policy "publico ve imagenes"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'productos');

-- Solo el admin logueado puede SUBIR, REEMPLAZAR o BORRAR imágenes.
drop policy if exists "admin sube imagenes" on storage.objects;
create policy "admin sube imagenes"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'productos');

drop policy if exists "admin actualiza imagenes" on storage.objects;
create policy "admin actualiza imagenes"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'productos');

drop policy if exists "admin borra imagenes" on storage.objects;
create policy "admin borra imagenes"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'productos');

-- ¡Listo! Ya tenés tabla, seguridad y storage configurados.
