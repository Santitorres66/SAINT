-- ============================================================
--  SAINT · Tela de la prenda, como dato propio
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
--  La tela vivía escondida adentro del nombre: "Remera Oversize
--  Heavyweight" y "Remera Oversize Estándar" son la misma prenda en dos
--  telas, pero para el sistema eran dos nombres cualesquiera. Así no se
--  podía filtrar ni reportar por tela, y alcanzaba con escribir el nombre
--  distinto una vez para crear un producto duplicado sin querer.
--
--  Solo aplica a prendas (remeras y buzos). En gorras queda vacío.

-- 1) LA COLUMNA ------------------------------------------------------
alter table public.products
  add column if not exists tela text not null default '';

create index if not exists idx_products_tela on public.products (tela);

-- 2) COMPLETARLA CON LO QUE YA DICE EL NOMBRE ------------------------
-- No toca el nombre: solo lee lo que ya está escrito ahí. Si mañana se
-- limpian los nombres, la tela ya va a estar guardada aparte.
update public.products
   set tela = 'Heavyweight'
 where categoria in ('remera', 'buzo')
   and tela = ''
   and nombre ilike '%heavyweight%';

update public.products
   set tela = 'Estándar'
 where categoria in ('remera', 'buzo')
   and tela = ''
   and (nombre ilike '%estándar%' or nombre ilike '%estandar%');

-- 3) VER CÓMO QUEDÓ -------------------------------------------------
-- Las prendas que quedaron sin tela son las que hay que completar a mano
-- desde la ficha del producto (o las que directamente no la necesitan).
--
--   select categoria, coalesce(nullif(tela,''), '(sin tela)') as tela,
--          count(*) as productos
--   from public.products
--   where categoria in ('remera', 'buzo')
--   group by categoria, tela
--   order by categoria, tela;
