-- ============================================================
--  SAINT · Módulo de Producción de Bordados
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de schema.sql, orders.sql y gestion.sql)
-- ============================================================

-- 1) BUCKET PRIVADO PARA ARCHIVOS DE PRODUCCIÓN -----------------------
-- Privado: los archivos (imágenes de referencia, .DST/.EMB, matrices)
-- NO son accesibles públicamente. Se ven/descargan con URLs firmadas.
insert into storage.buckets (id, name, public, file_size_limit)
values ('produccion', 'produccion', false, 52428800) -- 50 MB por archivo
on conflict (id) do nothing;

-- Solo usuarios autenticados (admin) acceden al bucket de producción.
drop policy if exists "prod ve archivos" on storage.objects;
create policy "prod ve archivos" on storage.objects
  for select to authenticated using (bucket_id = 'produccion');

drop policy if exists "prod sube archivos" on storage.objects;
create policy "prod sube archivos" on storage.objects
  for insert to authenticated with check (bucket_id = 'produccion');

drop policy if exists "prod actualiza archivos" on storage.objects;
create policy "prod actualiza archivos" on storage.objects
  for update to authenticated using (bucket_id = 'produccion');

drop policy if exists "prod borra archivos" on storage.objects;
create policy "prod borra archivos" on storage.objects
  for delete to authenticated using (bucket_id = 'produccion');

-- 2) BIBLIOTECA DE MATRICES ------------------------------------------
create table if not exists public.matrices (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  archivo_path   text,          -- ruta interna en el bucket (no pública)
  imagen_path    text,
  costo          numeric(10,2) not null default 0,
  observaciones  text default '',
  fecha_creacion timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- 3) ÓRDENES DE PRODUCCIÓN -------------------------------------------
create table if not exists public.ordenes_produccion (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint generated always as identity, -- se muestra como #00025
  pedido_referencia   text default '',
  cliente             text default '',
  fecha               timestamptz not null default now(),
  product_id          uuid references public.products(id) on delete set null,
  prenda              text default '',
  tipo_prenda         text default '',
  talle               text default '',
  color               text default '',
  cantidad            int not null default 1,
  bordado_descripcion text default '',
  bordado_ubicacion   text default '',
  bordado_tamano      text default '',
  bordado_colores     int default 0,
  observaciones       text default '',
  imagen_ref_path     text,
  archivo_bordado_path text,
  matriz_id           uuid references public.matrices(id) on delete set null,
  estado              text not null default 'pendiente'
                      check (estado in ('pendiente','en_produccion','fabricado','entregado')),
  fecha_inicio        timestamptz,
  fecha_fabricacion   timestamptz,
  costo_prenda        numeric(10,2) not null default 0,
  costo_matriz        numeric(10,2) not null default 0,
  costo_bordado       numeric(10,2) not null default 0,
  otros_costos        numeric(10,2) not null default 0,
  costo_total         numeric(10,2) not null default 0,
  posicion            int not null default 0,   -- orden dentro de la columna del Kanban
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_ordprod_estado on public.ordenes_produccion (estado);
create index if not exists idx_ordprod_matriz on public.ordenes_produccion (matriz_id);

-- updated_at automático (reusa la función creada en schema.sql)
drop trigger if exists trg_ordprod_updated on public.ordenes_produccion;
create trigger trg_ordprod_updated before update on public.ordenes_produccion
  for each row execute function public.set_updated_at();

-- 4) HISTORIAL DE ESTADOS --------------------------------------------
create table if not exists public.produccion_historial (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid references public.ordenes_produccion(id) on delete cascade,
  estado_anterior text,
  estado_nuevo    text,
  usuario         text default '',
  created_at      timestamptz not null default now()
);
create index if not exists idx_prodhist_orden on public.produccion_historial (orden_id);

-- 5) SEGURIDAD (RLS) — solo el admin logueado -----------------------
alter table public.matrices             enable row level security;
alter table public.ordenes_produccion   enable row level security;
alter table public.produccion_historial enable row level security;

drop policy if exists "admin matrices" on public.matrices;
create policy "admin matrices" on public.matrices
  for all to authenticated using (true) with check (true);

drop policy if exists "admin ordenes_produccion" on public.ordenes_produccion;
create policy "admin ordenes_produccion" on public.ordenes_produccion
  for all to authenticated using (true) with check (true);

drop policy if exists "admin produccion_historial" on public.produccion_historial;
create policy "admin produccion_historial" on public.produccion_historial
  for all to authenticated using (true) with check (true);

-- ¡Listo! Base y storage del módulo de producción creados.
