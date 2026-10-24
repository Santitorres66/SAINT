-- ============================================================
--  SAINT · Mermas de producción (estado "Perdido")
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de cobros.sql). Se puede correr más de una vez.
-- ============================================================
--
--  Una orden pasa a "perdido" cuando la prenda se rompió o el bordado salió
--  mal: es merma, no se vende ni se cobra. El stock no se toca: ya se había
--  descontado al crear la orden.
--
--  Cada merma guarda por qué pasó, en qué etapa y cómo se resolvió, para
--  poder hacerle seguimiento desde la pestaña "Mermas".
--
-- ------------------------------------------------------------

-- 1) NUEVO ESTADO -------------------------------------------------------
alter table public.ordenes_produccion
  drop constraint if exists ordenes_produccion_estado_check;
alter table public.ordenes_produccion
  add constraint ordenes_produccion_estado_check
  check (estado in ('pendiente', 'en_produccion', 'fabricado',
                    'entregado', 'vendido', 'cobrado', 'perdido'));

-- 2) DATOS DE LA MERMA --------------------------------------------------
-- merma_motivo      = por qué se perdió (prenda rota, bordado mal hecho…)
-- merma_etapa       = en qué estado estaba la orden cuando se perdió
-- merma_estado      = seguimiento: abierta → rehecha / cerrada
-- merma_resolucion  = qué se hizo con la prenda al cerrar el caso
-- rehecha_orden_id  = la orden nueva que reemplaza a la perdida
-- origen_merma_id   = en la orden nueva: a qué orden perdida reemplaza
alter table public.ordenes_produccion
  add column if not exists merma_motivo text,
  add column if not exists merma_nota text default '',
  add column if not exists merma_etapa text,
  add column if not exists fecha_merma timestamptz,
  add column if not exists merma_estado text
    check (merma_estado in ('abierta', 'rehecha', 'cerrada')),
  add column if not exists merma_resolucion text,
  add column if not exists rehecha_orden_id uuid
    references public.ordenes_produccion(id) on delete set null,
  add column if not exists origen_merma_id uuid
    references public.ordenes_produccion(id) on delete set null;

create index if not exists idx_ordprod_merma
  on public.ordenes_produccion (fecha_merma desc)
  where estado = 'perdido';

-- ¡Listo! Ya podés marcar órdenes como perdidas y seguirlas en "Mermas".
