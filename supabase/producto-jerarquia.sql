-- ============================================================
--  SAINT · Jerarquía de productos: familia + tipo, y clasificación inicial
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
-- Tres cosas, en orden:
--   1) Se agrega `familia`, el nivel del medio (Gorras / Pilusos / Sombreros).
--   2) Se retiran dos categorías: los crops pasan a ser un tipo de remera y
--      los canguros pasan a cargarse como buzos.
--   3) Se clasifica lo que ya está cargado leyendo el NOMBRE del producto.
--
-- El paso 3 es el que conviene mirar con atención: adivina a partir del
-- nombre. Lo que no reconoce queda vacío, y el listado del admin lo muestra
-- como "Sin clasificar" en ámbar para que salte a la vista y lo corrijas.
--
-- Se puede correr más de una vez sin romper nada, pero OJO: volvería a pisar
-- las correcciones que hayas hecho a mano sobre los productos que sí matchean.

-- 1) EL NIVEL DEL MEDIO --------------------------------------------------
-- Vacío = esta categoría no usa familias (todas las prendas).
alter table public.products
  add column if not exists familia text not null default '';


-- 2) CATEGORÍAS QUE SE RETIRAN -------------------------------------------
-- Los crops pasan a ser un tipo de remera.
update public.products
   set categoria = 'remera',
       molde      = 'Crop'
 where categoria = 'crop';

-- Los canguros se cargan como buzos. El tipo se deja vacío a propósito: lo
-- resuelve el paso 3.b leyendo el nombre, igual que al resto de los buzos.
-- El nombre del producto no se toca, así "Canguro Oversize" sigue diciendo
-- que es un canguro.
update public.products
   set categoria = 'buzo',
       molde      = ''
 where categoria = 'canguro';


-- 3) CLASIFICACIÓN INICIAL POR NOMBRE ------------------------------------
-- Antes de adivinar se borra el 'oversize' que había puesto el default: era
-- válido para los buzos pero mentía en las gorras, y acá se decide de nuevo.
update public.products
   set molde = ''
 where lower(btrim(molde)) = 'oversize';

-- 3.a) Gorras y sombreros.
--      El orden importa: "Piluso Vintage" tiene que caer en Pilusos y no en
--      la gorra vintage, así que los pilusos se resuelven primero.
update public.products
   set familia = 'Pilusos',
       molde   = case
                   when nombre ilike '%vintage%' then 'Vintage'
                   else ''
                 end
 where categoria = 'gorra'
   and nombre ilike '%piluso%';

update public.products
   set familia = 'Sombreros',
       molde   = 'Australiano'
 where categoria = 'gorra'
   and nombre ilike '%australian%';

update public.products
   set familia = 'Gorras',
       molde   = case
                   when nombre ilike '%baseball%'                    then 'Baseball'
                   when nombre ilike '%trucker%'                     then 'Trucker'
                   when nombre ilike '%niñ%'
                     or nombre ilike '%nino%'                       then 'Niño'
                   when nombre ilike '%vintage%'                     then 'Vintage'
                   else ''
                 end
 where categoria = 'gorra'
   and familia = '';

-- 3.b) Buzos. "Cuello redondo" es el que no es oversize, así que entra como
--      Básico. Si en tu cabeza es un tipo aparte, cambialo desde el admin.
update public.products
   set molde = case
                 when nombre ilike '%oversize%'       then 'Oversize'
                 when nombre ilike '%cuello redondo%' then 'Básico'
                 when nombre ilike '%basic%'
                   or nombre ilike '%básic%'          then 'Básico'
                 else ''
               end
 where categoria = 'buzo'
   and molde = '';

-- 3.c) Remeras. Los crops ya quedaron marcados en el paso 2, así que no se
--      tocan; el resto se reparte entre básica, oversize y lo que diga el
--      nombre (por ejemplo "Boxy", que aparecerá como su propio tipo).
update public.products
   set molde = case
                 when nombre ilike '%boxy%'     then 'Boxy'
                 when nombre ilike '%basic%'
                   or nombre ilike '%básic%'  then 'Básica'
                 when nombre ilike '%oversize%' then 'Oversize'
                 else ''
               end
 where categoria = 'remera'
   and molde = '';

-- 4) CÓMO QUEDÓ ----------------------------------------------------------
-- Esta consulta no cambia nada: es para mirar el resultado antes de ir al
-- admin. Lo que salga con familia o tipo en blanco es lo que hay que revisar.
select categoria,
       coalesce(nullif(familia, ''), '· sin clasificar ·') as familia,
       coalesce(nullif(molde, ''),   '· sin clasificar ·') as tipo,
       count(*)                                            as productos
  from public.products
 group by 1, 2, 3
 order by 1, 2, 3;
