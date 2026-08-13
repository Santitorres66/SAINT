-- ============================================================
--  SAINT · Cobros de ventas + cierre del circuito de producción
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de gestion.sql, clientes.sql y produccion.sql)
-- ============================================================
--
--  Qué agrega:
--   · Una venta se puede cobrar en VARIAS veces (seña + saldo, cuotas).
--   · Se puede aplicar un descuento sobre el total al momento de cobrar.
--   · Una orden de producción se cierra con una venta, y esa venta con su cobro.
--     Circuito completo: Pendiente → En producción → Fabricado → Entregado
--                        → Vendido → Cobrado
--
-- ------------------------------------------------------------

-- 1) CAMPOS DE COBRO EN VENTAS -----------------------------------------
-- total          = lo facturado (lo que suman los ítems)
-- descuento      = rebaja acordada al cobrar
-- total_cobrado  = suma de los cobros registrados (lo calcula la base sola)
-- saldo          = total - descuento - total_cobrado
alter table public.ventas
  add column if not exists descuento numeric(10,2) not null default 0
    check (descuento >= 0),
  add column if not exists total_cobrado numeric(10,2) not null default 0,
  add column if not exists estado_cobro text not null default 'pendiente'
    check (estado_cobro in ('pendiente', 'parcial', 'cobrado')),
  add column if not exists fecha_cobro timestamptz;

-- Las ventas que nacen de una orden de producción NO descuentan stock: la
-- prenda ya salió del stock cuando se creó la orden. Sin esta bandera, la
-- misma unidad se descontaría dos veces.
alter table public.ventas
  add column if not exists afecta_stock boolean not null default true;

create index if not exists idx_ventas_estado_cobro
  on public.ventas (estado_cobro);

-- 2) VÍNCULO ORDEN ↔ VENTA ---------------------------------------------
-- La relación vive en UN solo lado (la orden conoce su venta). Guardarla
-- también en `ventas` sería redundante y los dos lados podrían quedar
-- desincronizados.
alter table public.ordenes_produccion
  add column if not exists venta_id uuid
    references public.ventas(id) on delete set null;

create index if not exists idx_ordprod_venta
  on public.ordenes_produccion (venta_id);

-- 3) NUEVOS ESTADOS DE PRODUCCIÓN --------------------------------------
-- El CHECK original solo permitía hasta 'entregado'.
alter table public.ordenes_produccion
  drop constraint if exists ordenes_produccion_estado_check;
alter table public.ordenes_produccion
  add constraint ordenes_produccion_estado_check
  check (estado in ('pendiente', 'en_produccion', 'fabricado',
                    'entregado', 'vendido', 'cobrado'));

-- Fechas del cierre del circuito (para el detalle de la orden).
alter table public.ordenes_produccion
  add column if not exists fecha_venta timestamptz,
  add column if not exists fecha_cobro timestamptz;

-- 4) TABLA DE COBROS ----------------------------------------------------
-- Una fila por cada vez que entra plata de una venta.
create table if not exists public.cobros (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid not null references public.ventas(id) on delete cascade,
  fecha       timestamptz not null default now(),
  monto       numeric(10,2) not null check (monto > 0),
  medio_pago  text default '',
  cuotas      integer not null default 1 check (cuotas >= 1),
  monto_cuota numeric(10,2) not null default 0,
  notas       text default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_cobros_venta on public.cobros (venta_id);
create index if not exists idx_cobros_fecha on public.cobros (fecha desc);

-- 5) LA BASE MANTIENE EL ESTADO DE COBRO AL DÍA ------------------------
-- Recalcula total_cobrado, estado_cobro y fecha_cobro de una venta a partir
-- de sus cobros. Así el estado nunca se desincroniza de la plata real.
create or replace function public.recalcular_cobro_venta(p_venta_id uuid)
returns void
language plpgsql
as $$
declare
  v_total    numeric(10,2);
  v_desc     numeric(10,2);
  v_neto     numeric(10,2);
  v_cobrado  numeric(10,2);
  v_ultima   timestamptz;
  v_estado   text;
begin
  select total, coalesce(descuento, 0)
    into v_total, v_desc
  from public.ventas
  where id = p_venta_id;

  if not found then
    return;
  end if;

  select coalesce(sum(monto), 0), max(fecha)
    into v_cobrado, v_ultima
  from public.cobros
  where venta_id = p_venta_id;

  v_neto := greatest(v_total - v_desc, 0);

  if v_neto <= 0.01 then
    -- Nada que cobrar (total 0, o descuento igual al total): ya está saldada.
    v_estado := 'cobrado';
  elsif v_cobrado <= 0 then
    v_estado := 'pendiente';
  elsif v_cobrado >= v_neto - 0.01 then   -- margen por redondeo de centavos
    v_estado := 'cobrado';
  else
    v_estado := 'parcial';
  end if;

  update public.ventas
  set total_cobrado = v_cobrado,
      estado_cobro  = v_estado,
      fecha_cobro   = case when v_estado = 'cobrado' then v_ultima else null end
  where id = p_venta_id;
end;
$$;

-- Cada vez que se agrega, edita o borra un cobro → recalcular la venta.
create or replace function public.trg_cobros_recalcular()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_cobro_venta(coalesce(new.venta_id, old.venta_id));
  -- Si el cobro cambió de venta, hay que recalcular las dos.
  if tg_op = 'UPDATE' and new.venta_id is distinct from old.venta_id then
    perform public.recalcular_cobro_venta(old.venta_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_cobros_sync on public.cobros;
create trigger trg_cobros_sync
  after insert or update or delete on public.cobros
  for each row execute function public.trg_cobros_recalcular();

-- Si cambia el total o el descuento de la venta, el estado también cambia.
-- El WHEN evita que el UPDATE de recalcular_cobro_venta vuelva a disparar
-- este trigger (recursión infinita): esa función no toca total ni descuento.
create or replace function public.trg_ventas_recalcular()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_cobro_venta(new.id);
  return null;
end;
$$;

drop trigger if exists trg_ventas_sync_cobro on public.ventas;
create trigger trg_ventas_sync_cobro
  after update on public.ventas
  for each row
  when (old.total is distinct from new.total
        or old.descuento is distinct from new.descuento)
  execute function public.trg_ventas_recalcular();

-- 6) SEGURIDAD (RLS) ----------------------------------------------------
alter table public.cobros enable row level security;

drop policy if exists "admin cobros" on public.cobros;
create policy "admin cobros" on public.cobros
  for all to authenticated using (true) with check (true);

-- 7) VENTAS QUE YA EXISTÍAN --------------------------------------------
-- Todas las ventas cargadas ANTES de esta migración quedan como
-- "pendiente de cobro", porque la base no tiene forma de saber si se
-- cobraron o no.
--
-- Si esas ventas YA estaban cobradas (lo más probable), quitá los guiones
-- de las 3 líneas de abajo y ejecutalas UNA SOLA VEZ. Eso registra un cobro
-- por el total de cada venta anterior y las marca como cobradas.
--
-- insert into public.cobros (venta_id, fecha, monto, medio_pago, notas)
-- select id, fecha, total, coalesce(medio_pago, ''), 'Cobro registrado en la migración'
-- from public.ventas where total > 0;

-- ¡Listo! Ya podés registrar cobros parciales y cerrar el circuito completo.
