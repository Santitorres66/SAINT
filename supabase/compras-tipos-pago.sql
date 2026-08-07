-- ============================================================
--  SAINT · Compras: tipo de ítem (mercadería/insumo/activo fijo) + pago
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de gestion.sql)
-- ============================================================

-- Medio de pago y cuotas de la compra. "cuotas" queda en 1 cuando no es
-- tarjeta de crédito. El tipo de cada ítem (mercadería/insumo/activo fijo)
-- vive dentro del jsonb "items", no hace falta columna nueva para eso.
alter table public.compras
  add column if not exists medio_pago text not null default '',
  add column if not exists cuotas integer not null default 1 check (cuotas >= 1),
  add column if not exists monto_cuota numeric(10,2) not null default 0;
