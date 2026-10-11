-- ============================================================
--  SAINT · Que una compra no pueda perder stock en silencio
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de variantes.sql — reemplaza dos funciones)
-- ============================================================
--
--  Las dos funciones eran un UPDATE sobre una fila que tenía que existir de
--  antes. Si la combinación talle+color no estaba cargada, el UPDATE no
--  tocaba ninguna fila: la compra quedaba guardada, el stock no subía y no
--  aparecía ningún error. Ahora la fila se crea si falta, así el movimiento
--  siempre queda registrado en algún lado.

-- Suma stock a una variante. Si no existe, la crea con esa cantidad.
create or replace function public.sumar_stock_variante(
  p_product_id uuid, p_talle text, p_color text, p_cantidad int)
returns void language plpgsql as $$
declare
  v_talle text := coalesce(p_talle, '');
  v_color text := coalesce(p_color, '');
begin
  insert into public.product_variantes (product_id, talle, color, stock)
  values (p_product_id, v_talle, v_color, greatest(p_cantidad, 0))
  on conflict (product_id, talle, color)
  do update set stock = public.product_variantes.stock + greatest(p_cantidad, 0);

  -- Si el talle o el color no figuraban entre los del producto, la variante
  -- existiría pero no habría forma de elegirla en ningún formulario: quedaría
  -- stock invisible. Se agregan al producto para que se pueda operar con él.
  update public.products
  set talles  = case when v_talle <> '' and not (v_talle = any(talles))
                     then talles || v_talle else talles end,
      colores = case when v_color <> '' and not (v_color = any(colores))
                     then colores || v_color else colores end
  where id = p_product_id;
end;
$$;

-- Descuenta stock de una variante, sin bajar de cero. Si no existe, la deja
-- creada en cero: no hay stock que sacar, pero el producto queda sabiendo que
-- esa combinación existió.
create or replace function public.descontar_stock_variante(
  p_product_id uuid, p_talle text, p_color text, p_cantidad int)
returns void language plpgsql as $$
declare
  v_talle text := coalesce(p_talle, '');
  v_color text := coalesce(p_color, '');
begin
  insert into public.product_variantes (product_id, talle, color, stock)
  values (p_product_id, v_talle, v_color, 0)
  on conflict (product_id, talle, color)
  do update set stock = greatest(public.product_variantes.stock - greatest(p_cantidad, 0), 0);
end;
$$;

-- ¡Listo! Las compras ya no pueden sumar a la nada.
