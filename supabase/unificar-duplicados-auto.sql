-- ============================================================
--  SAINT · Unificar TODOS los productos duplicados de una vez
--  Pegar en: Supabase → SQL Editor → New query → Run
--  (Necesita la función de unificar-productos.sql ya creada)
-- ============================================================
--
--  Un producto es modelo + color y lleva adentro todos sus talles. Cuando
--  el mismo artículo quedó cargado dos veces —uno con el talle L y otro con
--  el M— el listado los muestra como dos renglones y cada compra ve solo la
--  mitad de los talles.
--
--  Esto usa la función `unificar_productos`, que mueve el stock de cada
--  talle, el historial de correcciones, las órdenes de producción, las fotos
--  de la galería y los ítems de ventas y compras ya cargadas, y recién
--  después borra el duplicado.
--
--  El que SOBREVIVE de cada grupo se elige así: primero el que tenga fotos
--  cargadas (perder la foto sería lo más molesto) y, entre esos, el más
--  viejo. Conserva su precio, su descripción y su categoría.

-- ============================================================
--  PASO 1 · MIRAR QUÉ VA A PASAR (no cambia nada)
-- ============================================================
-- Corré esto solo, y revisá la lista antes de seguir.

with normalizados as (
  select
    id, nombre, created_at,
    lower(btrim(nombre)) as clave_nombre,
    (select array_agg(c order by c) from unnest(colores) c) as clave_colores,
    coalesce(array_length(imagenes, 1), 0) as fotos,
    talles
  from public.products
),
grupos as (
  select
    clave_nombre, clave_colores,
    array_agg(id order by (case when fotos > 0 then 0 else 1 end), created_at)
      as ids,
    array_agg(nombre order by (case when fotos > 0 then 0 else 1 end), created_at)
      as nombres,
    array_agg(talles order by (case when fotos > 0 then 0 else 1 end), created_at)
      as talles_de_cada_uno
  from normalizados
  group by clave_nombre, clave_colores
  having count(*) > 1
)
select
  nombres[1]            as producto,
  clave_colores         as color,
  talles_de_cada_uno    as talles_separados_hoy,
  ids[1]                as id_que_queda,
  ids[2:]               as ids_que_se_absorben
from grupos
order by producto;

-- ============================================================
--  PASO 2 · UNIFICARLOS (esto sí modifica)
-- ============================================================
-- Si la lista de arriba es la que esperabas, corré este bloque.
-- Al terminar imprime, en la pestaña de mensajes, qué unificó.

do $$
declare
  g  record;
  i  int;
  n  int := 0;
begin
  for g in
    with normalizados as (
      select
        id, nombre, created_at,
        lower(btrim(nombre)) as clave_nombre,
        (select array_agg(c order by c) from unnest(colores) c) as clave_colores,
        coalesce(array_length(imagenes, 1), 0) as fotos
      from public.products
    )
    select
      array_agg(id order by (case when fotos > 0 then 0 else 1 end), created_at)
        as ids
    from normalizados
    group by clave_nombre, clave_colores
    having count(*) > 1
  loop
    -- El primero del grupo es el que queda; los demás se absorben.
    for i in 2 .. array_length(g.ids, 1) loop
      raise notice '%', public.unificar_productos(g.ids[1], g.ids[i]);
      n := n + 1;
    end loop;
  end loop;

  if n = 0 then
    raise notice 'No habia duplicados para unificar.';
  else
    raise notice 'Listo: % duplicado(s) unificado(s).', n;
  end if;
end;
$$;

-- ============================================================
--  PASO 3 · CONFIRMAR
-- ============================================================
-- Tiene que volver vacío.
--
--   select nombre, colores, count(*)
--   from public.products
--   group by nombre, colores
--   having count(*) > 1;
