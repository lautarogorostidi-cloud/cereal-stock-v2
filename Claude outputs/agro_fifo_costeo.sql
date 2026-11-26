-- ============================================================
-- Costeo FIFO de agroquímicos (Trazagro / Baratza SRL)
-- Pegar completo en Supabase > SQL Editor > Run
-- Solo crea vistas, funciones y triggers. NO modifica ningún costo todavía.
-- ============================================================

-- 1) Capas de stock (compras y ajustes positivos), con precio
create or replace view public.vw_agro_fifo_capas as
with ent as (
  select m.id, m.producto_id, m.fecha, m.tipo, m.cantidad as q, m.precio_unitario as p,
         sum(m.cantidad) over (partition by m.producto_id order by m.fecha, m.id) - m.cantidad as s0,
         sum(m.cantidad) over (partition by m.producto_id order by m.fecha, m.id) as s1
  from public.agroquimicos_movimientos m
  where m.tipo = 'compra' or (m.tipo = 'ajuste' and m.cantidad > 0)
)
select e.id, e.producto_id, e.fecha, e.tipo, e.q, e.p, e.s0, e.s1,
       coalesce(
         e.p,
         (select e2.p from ent e2 where e2.producto_id = e.producto_id and e2.p is not null and (e2.fecha, e2.id) >= (e.fecha, e.id) order by e2.fecha, e2.id limit 1),
         (select e2.p from ent e2 where e2.producto_id = e.producto_id and e2.p is not null order by e2.fecha desc, e2.id desc limit 1)
       ) as precio
from ent e;

-- 2) Consumos (aplicaciones y ajustes negativos) con el precio FIFO resultante
create or replace view public.vw_agro_fifo_consumos as
with con as (
  select m.id, m.producto_id, m.fecha, m.tipo, m.aplicacion_id, abs(m.cantidad) as q,
         sum(abs(m.cantidad)) over (partition by m.producto_id order by m.fecha, m.id) - abs(m.cantidad) as c0,
         sum(abs(m.cantidad)) over (partition by m.producto_id order by m.fecha, m.id) as c1
  from public.agroquimicos_movimientos m
  where m.tipo = 'aplicacion' or (m.tipo = 'ajuste' and m.cantidad < 0)
), x as (
  select c.id, c.producto_id, c.fecha, c.tipo, c.aplicacion_id, c.q,
         coalesce(sum(greatest(0, least(c.c1, e.s1) - greatest(c.c0, e.s0))), 0) as q_cub,
         sum(greatest(0, least(c.c1, e.s1) - greatest(c.c0, e.s0)) * e.precio) as costo_cub,
         max(e.fecha) as fecha_capa_max
  from con c
  left join public.vw_agro_fifo_capas e on e.producto_id = c.producto_id and e.s1 > c.c0 and e.s0 < c.c1
  group by c.id, c.producto_id, c.fecha, c.tipo, c.aplicacion_id, c.q
)
select x.id, x.producto_id, x.fecha, x.tipo, x.aplicacion_id, x.q as cantidad, x.q_cub,
       case when x.q_cub <= 0 or x.costo_cub is null then null
            else (x.costo_cub + (x.q - x.q_cub) * coalesce(
                    (select l.precio from public.vw_agro_fifo_capas l where l.producto_id = x.producto_id order by l.s1 desc limit 1),
                    x.costo_cub / x.q_cub)) / x.q
       end as precio_fifo,
       (x.fecha_capa_max is not null and x.fecha_capa_max > x.fecha) as usa_capa_posterior
from x;

-- 3) Stock remanente valorizado por FIFO
create or replace view public.vw_agro_fifo_stock as
select e.producto_id,
       sum(greatest(0, e.s1 - greatest(e.s0, coalesce(c.tot, 0)))) as stock_fifo,
       sum(greatest(0, e.s1 - greatest(e.s0, coalesce(c.tot, 0))) * coalesce(e.precio, 0)) as valor_fifo
from public.vw_agro_fifo_capas e
left join (
  select producto_id, sum(abs(cantidad)) as tot
  from public.agroquimicos_movimientos
  where tipo = 'aplicacion' or (tipo = 'ajuste' and cantidad < 0)
  group by producto_id
) c on c.producto_id = e.producto_id
group by e.producto_id;

grant select on public.vw_agro_fifo_capas, public.vw_agro_fifo_consumos, public.vw_agro_fifo_stock to authenticated;

-- 4) Función que recalcula los costos de las aplicaciones con FIFO
create or replace function public.agro_fifo_recalcular()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_setting('app.agro_fifo', true) = 'on' then return; end if;
  perform set_config('app.agro_fifo', 'on', true);

  create temp table if not exists _agro_fifo (id bigint, aplicacion_id bigint, producto_id bigint, precio numeric) on commit drop;
  delete from _agro_fifo where true;
  insert into _agro_fifo
  select f.id, f.aplicacion_id, f.producto_id, round(f.precio_fifo, 4)
  from public.vw_agro_fifo_consumos f
  where f.tipo = 'aplicacion' and f.aplicacion_id is not null and f.precio_fifo is not null;

  update public.sa_aplicacion_productos ap
  set costo_unitario = f.precio
  from _agro_fifo f
  join public.agroquimicos_productos p on p.id = f.producto_id
  where ap.aplicacion_id = f.aplicacion_id
    and lower(trim(ap.producto)) = lower(trim(p.nombre))
    and ap.costo_unitario is distinct from f.precio;

  perform set_config('app.agro_sync', 'on', true);
  update public.agroquimicos_movimientos m
  set precio_unitario = f.precio
  from _agro_fifo f
  where m.id = f.id and m.precio_unitario is distinct from f.precio;
  perform set_config('app.agro_sync', 'off', true);

  perform set_config('app.agro_fifo', 'off', true);
end;
$function$;

-- 5) Triggers: recalcula solo al cargar/editar compras, ajustes o aplicaciones
create or replace function public.trg_fn_agro_fifo_stmt()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if current_setting('app.agro_sync', true) = 'on' or current_setting('app.agro_fifo', true) = 'on' then
    return null;
  end if;
  perform public.agro_fifo_recalcular();
  return null;
end;
$function$;

drop trigger if exists trg_agro_fifo_mov on public.agroquimicos_movimientos;
create trigger trg_agro_fifo_mov after insert or update or delete on public.agroquimicos_movimientos
  for each statement execute function public.trg_fn_agro_fifo_stmt();

drop trigger if exists trg_agro_fifo_lineas on public.sa_aplicacion_productos;
create trigger trg_agro_fifo_lineas after insert or update or delete on public.sa_aplicacion_productos
  for each statement execute function public.trg_fn_agro_fifo_stmt();

drop trigger if exists trg_agro_fifo_apl on public.sa_aplicaciones;
create trigger trg_agro_fifo_apl after insert or update or delete on public.sa_aplicaciones
  for each statement execute function public.trg_fn_agro_fifo_stmt();
