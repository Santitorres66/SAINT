-- ============================================================
--  SAINT · Encontrar compras que no sumaron stock
--  Pegar en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
--  Son CONSULTAS: no modifican nada. Se pueden correr tranquilo.
--
--  El stock no vive en el producto sino en cada variante (talle + color).
--  Una compra cargada sin talle buscaba una variante que no existe, no
--  sumaba nada y no daba ningún error: la mercadería entraba y el stock
--  quedaba igual. Estas consultas muestran qué líneas quedaron así.

-- 1) LÍNEAS DE COMPRA QUE NO SUMARON STOCK ---------------------------
-- Cada fila es mercadería que entró pero nunca se contó. Son las compras
-- que hay que corregir.
select
  c.fecha::date                       as fecha,
  p.nombre                            as producto,
  coalesce(nullif(it->>'talle',''), '(sin talle)')  as talle,
  coalesce(nullif(it->>'color',''), '(sin color)')  as color,
  (it->>'cantidad')::int              as unidades_perdidas,
  c.id                                as compra_id
from public.compras c
cross join lateral jsonb_array_elements(c.items) it
left join public.products p on p.id = (it->>'product_id')::uuid
where coalesce(it->>'tipo', 'mercaderia') = 'mercaderia'
  and it->>'product_id' is not null
  and not exists (
    select 1 from public.product_variantes v
    where v.product_id = (it->>'product_id')::uuid
      and v.talle = coalesce(it->>'talle', '')
      and v.color = coalesce(it->>'color', '')
  )
order by c.fecha desc;

-- CÓMO SE ARREGLA CADA UNA
-- En el panel: Compras → Editar en la compra que aparece acá → elegir el
-- talle (y el color) que faltaba en cada línea → Guardar. Al guardar, el
-- sistema revierte el stock viejo (que era cero, porque nunca sumó) y
-- aplica el nuevo, así que el stock queda bien. No hay que tocar la base.
-- Importante: corregir cada compra UNA sola vez.

-- 2) CUÁNTO SE COMPRÓ DE CADA VARIANTE, CONTRA EL STOCK DE HOY -------
-- Para cotejar a ojo. No es un control exacto: del stock comprado se
-- restan ventas, pérdidas y las prendas que se fueron a producción, así
-- que es normal que el stock actual sea menor. Lo que llama la atención es
-- una variante con muchas compras y stock cero que nunca vendiste.
select
  p.nombre                             as producto,
  coalesce(nullif(it->>'talle',''), '—') as talle,
  coalesce(nullif(it->>'color',''), '—') as color,
  sum((it->>'cantidad')::int)          as total_comprado,
  coalesce(max(v.stock), 0)            as stock_hoy
from public.compras c
cross join lateral jsonb_array_elements(c.items) it
join public.products p on p.id = (it->>'product_id')::uuid
left join public.product_variantes v
       on v.product_id = p.id
      and v.talle = coalesce(it->>'talle', '')
      and v.color = coalesce(it->>'color', '')
where coalesce(it->>'tipo', 'mercaderia') = 'mercaderia'
  and it->>'product_id' is not null
group by p.nombre, it->>'talle', it->>'color'
order by p.nombre, talle;

-- 3) VARIANTES CON STOCK PERO SIN TALLE ------------------------------
-- Stock que existe pero no se puede elegir en ningún formulario, porque la
-- combinación no tiene talle cargado. Si aparece algo acá, ese stock está
-- "escondido" y conviene moverlo al talle que corresponda desde la ficha
-- del producto.
select p.nombre, v.talle, v.color, v.stock
from public.product_variantes v
join public.products p on p.id = v.product_id
where v.stock > 0
  and v.talle = ''
  and array_length(p.talles, 1) > 0
order by p.nombre;
