-- ============================================================
--  SAINT · Carga de compras anteriores al sistema
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
--  (Ejecutar DESPUÉS de gestion.sql y compras-tipos-pago.sql)
-- ============================================================
--
--  Compras hechas antes de que existiera el sistema, cargadas para que el
--  histórico de gastos quede completo.
--
--  Criterios usados:
--   · Las líneas del mismo día, mismo proveedor y mismo medio de pago se
--     agrupan en UNA compra con varios ítems (es lo que fue: un ticket).
--   · Las líneas idénticas repetidas se consolidan sumando la cantidad.
--   · Ningún ítem es "mercadería": son insumos y un activo fijo, así que
--     esta carga NO toca el stock del catálogo ni el costo de los productos.
--   · Las transferencias quedan en 1 cuota (pago único): la tabla exige
--     cuotas >= 1, no admite 0.
--
--  Se puede correr más de una vez sin duplicar: si detecta la carga, sale.

-- 1) PROVEEDORES --------------------------------------------------------
-- Solo los que falten (no se toca ninguno que ya exista).
insert into public.proveedores (nombre)
select v.nombre
  from (values
    ('Casa La Rioja'), ('DSI Trading'), ('Bordarte Mass'),
    ('HAEDO MAQUINAS'), ('Easy'), ('Casa G.V.'), ('AquaEtiquetas'),
    ('Creativa Bolsas'), ('Mercería'), ('Librería'), ('Papelera'), ('Ferni')
  ) as v(nombre)
 where not exists (
   select 1 from public.proveedores p where p.nombre = v.nombre
 );

-- 2) COMPRAS ------------------------------------------------------------
do $carga$
declare
  v_marca text := 'Carga histórica';
begin
  if exists (select 1 from public.compras where notas like v_marca || '%') then
    raise notice 'Las compras históricas ya estaban cargadas: no se hace nada.';
    return;
  end if;

  ------------------------------------------------------------------
  -- La grande: la bordadora. Activo fijo, 24 cuotas desde el 01/04.
  ------------------------------------------------------------------
  insert into public.compras
    (fecha, proveedor_id, total, items, medio_pago, cuotas, monto_cuota, notas)
  values (
    '2026-04-01', null, 3472804.00,
    '[{"tipo":"activo_fijo","product_id":null,"nombre":"Máquina bordadora Brother P910L","talle":null,"color":null,"cantidad":1,"costo_unitario":3472804.00}]'::jsonb,
    'Tarjeta de crédito', 24, 144700.17,
    v_marca || ' (compra previa al sistema). 24 cuotas, la primera el 01/04/2026.');

  ------------------------------------------------------------------
  -- Abril
  ------------------------------------------------------------------
  insert into public.compras
    (fecha, proveedor_id, total, items, medio_pago, cuotas, monto_cuota, notas)
  values

  -- 01/04 · Casa La Rioja · 1 bobina blanca + 5 conos de bordar
  ('2026-04-01',
   (select id from public.proveedores where nombre = 'Casa La Rioja' limit 1),
   46781.61,
   '[{"tipo":"insumo","product_id":null,"nombre":"Hilo Bobina Blanco (Caja 72)","talle":null,"color":null,"cantidad":1,"costo_unitario":22603.61},
     {"tipo":"insumo","product_id":null,"nombre":"Hilo de bordar 4000 m","talle":null,"color":null,"cantidad":5,"costo_unitario":4835.60}]'::jsonb,
   'Tarjeta de crédito', 1, 46781.61,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 01/04 · DSI Trading · hilos metálicos
  ('2026-04-01',
   (select id from public.proveedores where nombre = 'DSI Trading' limit 1),
   15181.52,
   '[{"tipo":"insumo","product_id":null,"nombre":"Hilo Metálico Lurex Dorado","talle":null,"color":null,"cantidad":1,"costo_unitario":7590.76},
     {"tipo":"insumo","product_id":null,"nombre":"Hilo Metálico Lurex Plateado","talle":null,"color":null,"cantidad":1,"costo_unitario":7590.76}]'::jsonb,
   'Tarjeta de crédito', 1, 15181.52,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 01/04 · sin proveedor anotado · agujas
  ('2026-04-01', null, 11121.87,
   '[{"tipo":"insumo","product_id":null,"nombre":"Agujas","talle":null,"color":null,"cantidad":1,"costo_unitario":11121.87}]'::jsonb,
   'Tarjeta de crédito', 1, 11121.87,
   v_marca || ' (compra previa al sistema). Compró: Santi. Sin proveedor anotado.'),

  -- 01/04 · Bordarte Mass · entretela negra
  ('2026-04-01',
   (select id from public.proveedores where nombre = 'Bordarte Mass' limit 1),
   24827.05,
   '[{"tipo":"insumo","product_id":null,"nombre":"Kit Entretela (Negra)","talle":null,"color":null,"cantidad":1,"costo_unitario":24827.05}]'::jsonb,
   'Tarjeta de crédito', 1, 24827.05,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 01/04 · HAEDO MAQUINAS · pack de conos
  ('2026-04-01',
   (select id from public.proveedores where nombre = 'HAEDO MAQUINAS' limit 1),
   37099.15,
   '[{"tipo":"insumo","product_id":null,"nombre":"Pack 10 Conos Hilo (2750 m)","talle":null,"color":null,"cantidad":1,"costo_unitario":37099.15}]'::jsonb,
   'Tarjeta de crédito', 1, 37099.15,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 04/04 · Bordarte Mass · entretela blanca
  ('2026-04-04',
   (select id from public.proveedores where nombre = 'Bordarte Mass' limit 1),
   22077.17,
   '[{"tipo":"insumo","product_id":null,"nombre":"Kit Entretela (Blanca)","talle":null,"color":null,"cantidad":1,"costo_unitario":22077.17}]'::jsonb,
   'Transferencia', 1, 22077.17,
   v_marca || ' (compra previa al sistema). Compró: Diego.'),

  -- 08/04 · HAEDO MAQUINAS · 2 packs
  ('2026-04-08',
   (select id from public.proveedores where nombre = 'HAEDO MAQUINAS' limit 1),
   65980.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Pack 10 Conos Hilo (2750 m)","talle":null,"color":null,"cantidad":2,"costo_unitario":32990.00}]'::jsonb,
   'Tarjeta de crédito', 1, 65980.00,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 11/04 · Easy · quita pelusa
  ('2026-04-11',
   (select id from public.proveedores where nombre = 'Easy' limit 1),
   4995.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Quita Pelusa Papel","talle":null,"color":null,"cantidad":1,"costo_unitario":4995.00}]'::jsonb,
   'Tarjeta de crédito', 1, 4995.00,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 14/04 · Casa G.V. · pegamento
  ('2026-04-14',
   (select id from public.proveedores where nombre = 'Casa G.V.' limit 1),
   37100.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Pegamento para entretela","talle":null,"color":null,"cantidad":1,"costo_unitario":37100.00}]'::jsonb,
   'Transferencia', 1, 37100.00,
   v_marca || ' (compra previa al sistema). Compró: Diego.'),

  -- 14/04 · AquaEtiquetas · 1000 etiquetas
  ('2026-04-14',
   (select id from public.proveedores where nombre = 'AquaEtiquetas' limit 1),
   40590.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Etiquetas de Marca","talle":null,"color":null,"cantidad":1000,"costo_unitario":40.59}]'::jsonb,
   'Tarjeta de crédito', 1, 40590.00,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 14/04 · Creativa Bolsas · 100 bolsas
  ('2026-04-14',
   (select id from public.proveedores where nombre = 'Creativa Bolsas' limit 1),
   125812.04,
   '[{"tipo":"insumo","product_id":null,"nombre":"Bolsas","talle":null,"color":null,"cantidad":100,"costo_unitario":1258.1204}]'::jsonb,
   'Tarjeta de crédito', 1, 125812.04,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 21/04 · HAEDO MAQUINAS · 2 packs
  ('2026-04-21',
   (select id from public.proveedores where nombre = 'HAEDO MAQUINAS' limit 1),
   65980.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Pack 10 Conos Hilo (2750 m)","talle":null,"color":null,"cantidad":2,"costo_unitario":32990.00}]'::jsonb,
   'Tarjeta de crédito', 1, 65980.00,
   v_marca || ' (compra previa al sistema). Compró: Diego.'),

  -- 22/04 · Mercería · fizelina
  ('2026-04-22',
   (select id from public.proveedores where nombre = 'Mercería' limit 1),
   12050.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Tela fizelina 10 m (5 m negro; 5 m blanco)","talle":null,"color":null,"cantidad":1,"costo_unitario":12050.00}]'::jsonb,
   'Transferencia', 1, 12050.00,
   v_marca || ' (compra previa al sistema). Compró: Diego.'),

  -- 23/04 · Librería · escuadra
  ('2026-04-23',
   (select id from public.proveedores where nombre = 'Librería' limit 1),
   6500.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Escuadra","talle":null,"color":null,"cantidad":1,"costo_unitario":6500.00}]'::jsonb,
   'Transferencia', 1, 6500.00,
   v_marca || ' (compra previa al sistema). Compró: Diego.'),

  -- 23/04 · HAEDO MAQUINAS · hilos, aceite y porta conos
  ('2026-04-23',
   (select id from public.proveedores where nombre = 'HAEDO MAQUINAS' limit 1),
   72001.87,
   '[{"tipo":"insumo","product_id":null,"nombre":"Hilo para bordar 2750 m · 10 conos","talle":null,"color":null,"cantidad":1,"costo_unitario":32990.00},
     {"tipo":"insumo","product_id":null,"nombre":"Hilo para bordar 2750 m · 5 conos","talle":null,"color":null,"cantidad":1,"costo_unitario":18990.00},
     {"tipo":"insumo","product_id":null,"nombre":"Aceite lubricante para máquinas de coser 1/2 litro","talle":null,"color":null,"cantidad":1,"costo_unitario":7790.00},
     {"tipo":"insumo","product_id":null,"nombre":"Porta conos de mesa para máquina","talle":null,"color":null,"cantidad":1,"costo_unitario":12231.87}]'::jsonb,
   'Tarjeta de crédito', 1, 72001.87,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  ------------------------------------------------------------------
  -- Mayo
  ------------------------------------------------------------------

  -- 09/05 · Ferni · insumos varios
  ('2026-05-09',
   (select id from public.proveedores where nombre = 'Ferni' limit 1),
   10198.00,
   '[{"tipo":"insumo","product_id":null,"nombre":"Insumos varios","talle":null,"color":null,"cantidad":1,"costo_unitario":10198.00}]'::jsonb,
   'Tarjeta de crédito', 1, 10198.00,
   v_marca || ' (compra previa al sistema). Compró: Santi.'),

  -- 15/05 · Papelera · 100 papel cristal
  ('2026-05-15',
   (select id from public.proveedores where nombre = 'Papelera' limit 1),
   10486.91,
   '[{"tipo":"insumo","product_id":null,"nombre":"Papel Cristal","talle":null,"color":null,"cantidad":100,"costo_unitario":104.8691}]'::jsonb,
   'Transferencia', 1, 10486.91,
   v_marca || ' (compra previa al sistema). Compró: Santi.');

  raise notice 'Compras históricas cargadas.';
end
$carga$;

-- 3) CONTROL ------------------------------------------------------------
-- Tienen que salir 18 compras y un total de 4081586.19
select count(*) as compras, sum(total) as total_cargado
  from public.compras
 where notas like 'Carga histórica%';
