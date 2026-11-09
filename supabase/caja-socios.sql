-- ============================================================
--  SAINT · Socios, pagos de compras (quién pone la plata, cuotas) y Caja
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de compras-tipos-pago.sql). Se puede correr más de
--  una vez.
-- ============================================================

-- 1) SOCIOS ---------------------------------------------------------------
-- Cuando SAINT no llega a pagar una compra, la ponen los socios. Para saber
-- cuánto puso cada uno (y cuánto se les devolvió) hace falta tenerlos.
create table if not exists public.socios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  dni        text not null unique,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.socios (nombre, dni) values
  ('Diego Cabral',    '35654566'),
  ('Santiago Torres', '36433456')
on conflict (dni) do nothing;

-- 2) PAGOS DE COMPRAS -----------------------------------------------------
-- Cada salida de plata hacia una compra: el pago de contado, cada cuota de
-- una compra en plazos, o la parte que puso un socio.
--   socio_id null  → lo pagó SAINT (sale de la caja)
--   socio_id ≠ null → lo puso ese socio de su bolsillo (no sale de la caja;
--                     queda como aporte del socio)
-- Lo pagado de una compra es la suma de sus pagos; el saldo, total − pagado.
create table if not exists public.compra_pagos (
  id         uuid primary key default gen_random_uuid(),
  compra_id  uuid not null references public.compras(id) on delete cascade,
  fecha      timestamptz not null default now(),
  monto      numeric(12,2) not null check (monto > 0),
  socio_id   uuid references public.socios(id) on delete restrict,
  medio_pago text not null default '',
  notas      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_compra_pagos_compra on public.compra_pagos (compra_id);
create index if not exists idx_compra_pagos_fecha  on public.compra_pagos (fecha);

-- Las compras de contado cargadas ANTES de esto se dan por pagadas por SAINT
-- (era lo que se asumía). Las de cuotas quedan con el saldo abierto: las
-- cuotas ya pagadas se registran desde Compras → Pagos.
-- El corte por fecha evita que, si se vuelve a correr, marque como pagada
-- una compra nueva que se dejó a deber a propósito.
insert into public.compra_pagos (compra_id, fecha, monto, medio_pago, notas)
select c.id, c.fecha, c.total, coalesce(c.medio_pago, ''),
       'Pago asumido al migrar (antes no se registraba quién pagaba)'
from public.compras c
where c.cuotas <= 1
  and c.total > 0
  and c.created_at < '2026-11-10'
  and not exists (select 1 from public.compra_pagos p where p.compra_id = c.id);

-- 3) CAJA: movimientos que no son cobros ni pagos de compras ----------------
-- Aportes y devoluciones a socios, retiros, gastos sueltos, depósitos de
-- efectivo en Brubank y ajustes contra el saldo real del banco.
--   monto > 0 entra plata, monto < 0 sale.
--   cuenta: 'brubank' | 'efectivo'
create table if not exists public.caja_movimientos (
  id         uuid primary key default gen_random_uuid(),
  fecha      timestamptz not null default now(),
  cuenta     text not null default 'brubank' check (cuenta in ('brubank', 'efectivo')),
  concepto   text not null,
  monto      numeric(12,2) not null check (monto <> 0),
  socio_id   uuid references public.socios(id) on delete restrict,
  notas      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_caja_movimientos_fecha on public.caja_movimientos (fecha);

-- 4) CONTROLES CONTRA BRUBANK ---------------------------------------------
-- Cada vez que se mira el saldo real de Brubank y se compara con el del
-- sistema queda registrado, para ver si la diferencia crece o se achica.
create table if not exists public.caja_controles (
  id            uuid primary key default gen_random_uuid(),
  fecha         timestamptz not null default now(),
  saldo_real    numeric(12,2) not null,
  saldo_sistema numeric(12,2) not null,
  notas         text not null default '',
  created_at    timestamptz not null default now()
);

-- 5) SEGURIDAD (RLS): solo el admin ----------------------------------------
alter table public.socios           enable row level security;
alter table public.compra_pagos     enable row level security;
alter table public.caja_movimientos enable row level security;
alter table public.caja_controles   enable row level security;

drop policy if exists "admin socios" on public.socios;
create policy "admin socios" on public.socios
  for all to authenticated using (true) with check (true);

drop policy if exists "admin compra_pagos" on public.compra_pagos;
create policy "admin compra_pagos" on public.compra_pagos
  for all to authenticated using (true) with check (true);

drop policy if exists "admin caja_movimientos" on public.caja_movimientos;
create policy "admin caja_movimientos" on public.caja_movimientos
  for all to authenticated using (true) with check (true);

drop policy if exists "admin caja_controles" on public.caja_controles;
create policy "admin caja_controles" on public.caja_controles
  for all to authenticated using (true) with check (true);

-- ¡Listo! Socios cargados, compras con pagos y la Caja lista para usar.
