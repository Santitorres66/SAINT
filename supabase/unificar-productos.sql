-- ============================================================
--  SAINT · Unificar productos duplicados (mismo modelo y color)
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
--  En este sistema un producto es modelo + color, y adentro lleva todos sus
--  talles. Cuando el mismo artículo quedó cargado dos veces —uno con el talle
--  L y otro con el M, por ejemplo— cada compra o venta ve solo la mitad de los
--  talles, porque está mirando uno de los dos registros.
--
--  Esto NO unifica nada solo: crea una función para hacerlo de a un par por
--  vez, así revisás cada caso antes de tocarlo.

-- 1) ¿QUÉ DUPLICADOS HAY? --------------------------------------------
-- Corré esto primero. Cada fila es un artículo cargado más de una vez.
--
--   select nombre, colores, count(*) as veces,
--          array_agg(id) as ids, array_agg(talles) as talles_de_cada_uno
--   from public.products
--   group by nombre, colores
--   having count(*) > 1
--   order by nombre;

-- 2) LA FUNCIÓN QUE UNIFICA ------------------------------------------
-- Mueve todo lo del producto "absorbido" al que queda y después lo borra.
-- Lo importante es lo que NO se pierde: el stock de cada talle, el historial
-- de correcciones, las órdenes de producción, las fotos de la galería y los
-- ítems de ventas y compras ya cargadas. Borrar el duplicado a mano, sin
-- esto, se lleva puesto el historial de correcciones (la FK es ON DELETE
-- CASCADE) y deja las ventas viejas apuntando a un producto que no existe.
create or replace function public.unificar_productos(
  p_queda    uuid,   -- el producto que sobrevive
  p_absorbido uuid)  -- el duplicado, que se borra al final
returns text language plpgsql as $$
declare
  v        record;
  n_var    int := 0;
  n_hist   int := 0;
  v_nombre text;
begin
  if p_queda = p_absorbido then
    raise exception 'Son el mismo producto: no hay nada que unificar.';
  end if;
  if not exists (select 1 from public.products where id = p_queda) then
    raise exception 'No existe el producto que queda (%).', p_queda;
  end if;
  select nombre into v_nombre from public.products where id = p_absorbido;
  if v_nombre is null then
    raise exception 'No existe el producto a absorber (%).', p_absorbido;
  end if;

  -- a) Stock por variante. Si la combinación talle+color ya existe en el que
  --    queda, los stocks se SUMAN (son el mismo artículo); si no, la fila se
  --    muda tal cual. El total del producto lo recalcula solo el trigger.
  for v in select * from public.product_variantes where product_id = p_absorbido loop
    if exists (
      select 1 from public.product_variantes
      where product_id = p_queda and talle = v.talle and color = v.color
    ) then
      update public.product_variantes
        set stock = stock + v.stock
        where product_id = p_queda and talle = v.talle and color = v.color;
      delete from public.product_variantes where id = v.id;
    else
      update public.product_variantes set product_id = p_queda where id = v.id;
    end if;
    n_var := n_var + 1;
  end loop;

  -- b) Talles y colores del que queda = la unión de los dos, sin repetidos y
  --    respetando el orden en que ya venían.
  update public.products g set
    talles = coalesce((
      select array_agg(e order by orden)
      from (select e, min(ord) as orden
            from unnest(g.talles || a.talles) with ordinality as t(e, ord)
            group by e) s
    ), g.talles),
    colores = coalesce((
      select array_agg(e order by orden)
      from (select e, min(ord) as orden
            from unnest(g.colores || a.colores) with ordinality as t(e, ord)
            group by e) s
    ), g.colores)
  from public.products a
  where g.id = p_queda and a.id = p_absorbido;

  -- c) Todo lo que apunta al duplicado por FK pasa a apuntar al que queda.
  update public.stock_correcciones set product_id = p_queda where product_id = p_absorbido;
  get diagnostics n_hist = row_count;
  update public.ordenes_produccion set product_id = p_queda where product_id = p_absorbido;
  update public.galeria_trabajos   set product_id = p_queda where product_id = p_absorbido;

  -- d) Ventas, compras y órdenes web guardan sus ítems como JSON, sin FK: si
  --    no se repuntan acá, los reportes dejan de encontrar el producto.
  update public.ventas set items = (
    select jsonb_agg(case when it->>'product_id' = p_absorbido::text
                          then jsonb_set(it, '{product_id}', to_jsonb(p_queda::text))
                          else it end)
    from jsonb_array_elements(items) it)
  where items @> jsonb_build_array(jsonb_build_object('product_id', p_absorbido::text));

  update public.compras set items = (
    select jsonb_agg(case when it->>'product_id' = p_absorbido::text
                          then jsonb_set(it, '{product_id}', to_jsonb(p_queda::text))
                          else it end)
    from jsonb_array_elements(items) it)
  where items @> jsonb_build_array(jsonb_build_object('product_id', p_absorbido::text));

  update public.orders set items = (
    select jsonb_agg(case when it->>'product_id' = p_absorbido::text
                          then jsonb_set(it, '{product_id}', to_jsonb(p_queda::text))
                          else it end)
    from jsonb_array_elements(items) it)
  where items @> jsonb_build_array(jsonb_build_object('product_id', p_absorbido::text));

  -- e) Recién ahora se puede borrar: ya no queda nada colgando de él.
  delete from public.products where id = p_absorbido;

  return format(
    'Listo: "%s" absorbido. %s variante(s) movida(s), %s corrección(es) de stock reasignada(s).',
    v_nombre, n_var, n_hist);
end;
$$;

-- 3) CÓMO USARLA -----------------------------------------------------
-- Con los ids que te devolvió la consulta del punto 1 (primero el que querés
-- conservar — normalmente el que tiene la foto y el precio bien cargados):
--
--   select public.unificar_productos(
--     'id-del-que-queda'::uuid,
--     'id-del-duplicado'::uuid);
--
-- Devuelve un resumen de lo que movió. Repetilo por cada duplicado.
