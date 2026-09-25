-- ============================================================
--  SAINT · Galería de trabajos reales
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de schema.sql)
-- ============================================================
--
-- Las fotos de bordados YA HECHOS: lo que se entregó, puesto, en la vida real.
-- Es lo único que prueba que el bordado queda bien, y también lo que fija la
-- expectativa: el previsualizador de la tienda es un dibujo, esto es la pieza.
--
-- Las imágenes se guardan en el bucket "productos", que ya existe y es público.
-- No hace falta bucket nuevo.

create table if not exists public.galeria_trabajos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text        not null default '',
  -- La historia corta del trabajo: qué pidió, para qué era.
  descripcion text        default '',
  -- Una o varias fotos. La primera es la portada del mosaico.
  imagenes    text[]      not null default '{}',
  -- El nombre de pila de quien lo encargó, si dio permiso. Vacío se banca:
  -- no todo el mundo quiere aparecer, y la foto vale igual.
  cliente     text        default '',
  -- Qué prenda es, escrito como se lee ("Buzo oversize negro").
  prenda      text        default '',
  -- Opcional: la prenda del catálogo, para poder ir a comprarla desde la foto.
  product_id  uuid        references public.products(id) on delete set null,
  -- Los destacados son los que salen en la home; el resto vive en /galeria.
  destacado   boolean     not null default false,
  -- Orden manual: más chico, más arriba. Empatados, primero el más nuevo.
  orden       integer     not null default 0,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_galeria_activo    on public.galeria_trabajos (activo);
create index if not exists idx_galeria_destacado on public.galeria_trabajos (destacado);
create index if not exists idx_galeria_orden     on public.galeria_trabajos (orden, created_at desc);

-- `set_updated_at` ya quedó creada en schema.sql; acá solo se la engancha.
drop trigger if exists trg_galeria_updated_at on public.galeria_trabajos;
create trigger trg_galeria_updated_at
  before update on public.galeria_trabajos
  for each row execute function public.set_updated_at();

-- SEGURIDAD (RLS) -------------------------------------------------------
alter table public.galeria_trabajos enable row level security;

-- El público solo ve los trabajos activos: un trabajo a medio cargar, sin
-- foto o con el nombre del cliente sin confirmar, no tiene que aparecer.
drop policy if exists "publico lee trabajos activos" on public.galeria_trabajos;
create policy "publico lee trabajos activos"
  on public.galeria_trabajos
  for select
  to anon
  using (activo = true);

-- El admin logueado ve y hace todo.
drop policy if exists "admin acceso total galeria" on public.galeria_trabajos;
create policy "admin acceso total galeria"
  on public.galeria_trabajos
  for all
  to authenticated
  using (true)
  with check (true);

-- ¡Listo! Ya podés cargar trabajos desde el panel, en "Galería".
