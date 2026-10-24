-- ============================================================
--  SAINT · Estado "Perdido" en producción
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de cobros.sql)
-- ============================================================
--
--  Una orden pasa a "perdido" cuando la prenda se rompió o el bordado salió
--  mal: es merma, no se vende ni se cobra. El stock no se toca: ya se había
--  descontado al crear la orden.
--
-- ------------------------------------------------------------

alter table public.ordenes_produccion
  drop constraint if exists ordenes_produccion_estado_check;
alter table public.ordenes_produccion
  add constraint ordenes_produccion_estado_check
  check (estado in ('pendiente', 'en_produccion', 'fabricado',
                    'entregado', 'vendido', 'cobrado', 'perdido'));

-- ¡Listo! Ya podés mover órdenes a "Perdido" desde el tablero.
