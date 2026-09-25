-- ============================================================
--  SAINT · El molde pasa a ser un subgrupo libre por categoría
--  Pegar TODO esto en: Supabase → SQL Editor → New query → Run
-- ============================================================
--
-- `molde` nació con dos valores fijos (oversize / basica) porque solo servía
-- para elegir la tabla de talles de las remeras. Ahora también agrupa el
-- listado del admin, y cada categoría tiene los suyos: las gorras son vintage,
-- baseball o trucker, y las remeras suman boxy, heavyweight y lo que venga.
--
-- Mantener la lista cerrada en la base obligaría a tocar SQL cada vez que
-- aparece un modelo nuevo. Se saca el CHECK y el admin ofrece sugerencias por
-- categoría, que es donde ese conocimiento cambia seguido.
--
-- No se pierde nada de lo cargado: los valores actuales siguen siendo válidos.

alter table public.products
  drop constraint if exists products_molde_check;

-- Sigue siendo obligatorio y con el mismo default: lo que no se elige es
-- "oversize", igual que antes.
alter table public.products
  alter column molde set default 'oversize';

update public.products
  set molde = 'oversize'
  where molde is null or btrim(molde) = '';

alter table public.products
  alter column molde set not null;
