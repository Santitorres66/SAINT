-- ============================================================
--  SAINT · Producción: prioridad + fecha estimada de entrega
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================

alter table public.ordenes_produccion
  add column if not exists prioridad text not null default 'media'
    check (prioridad in ('alta', 'media', 'baja')),
  add column if not exists fecha_estimada_entrega timestamptz;
