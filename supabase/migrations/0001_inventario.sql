-- Inventario de materia prima (filamento y resina), ventas del día y pedidos al proveedor.
-- Se ejecuta en el mismo proyecto de Supabase de Bubblab Intelligence (mismos usuarios):
-- Supabase → SQL Editor → pegar este archivo → Run. Las tablas llevan el prefijo inv_.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists inv_products (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'filamento' check (kind in ('filamento', 'resina')),
  material text not null default 'PLA',
  brand text,
  color text not null,
  hex text not null default '#888888',
  unit text not null default 'rollo 1 kg',
  cost numeric,
  default_price numeric,
  target integer not null default 20 check (target >= 0),
  market text not null default 'media' check (market in ('alta', 'media', 'baja')),
  on_demand boolean not null default false,
  active boolean not null default true,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inv_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);
create unique index if not exists inv_customers_name_phone on inv_customers (lower(name), coalesce(phone, ''));

create table if not exists inv_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null,
  customer_id uuid references inv_customers(id) on delete set null,
  channel text not null default 'local' check (channel in ('local', 'whatsapp')),
  payment text not null default 'efectivo' check (payment in ('efectivo', 'nequi', 'transferencia')),
  notes text,
  total numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists inv_sales_date on inv_sales (sale_date desc);

create table if not exists inv_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references inv_sales(id) on delete cascade,
  product_id uuid not null references inv_products(id),
  qty integer not null check (qty > 0),
  unit_price numeric not null default 0,
  unit_cost numeric
);
create index if not exists inv_sale_items_sale on inv_sale_items (sale_id);
create index if not exists inv_sale_items_product on inv_sale_items (product_id);

-- Cada cambio de existencias queda registrado (venta, entrada, conteo, corrección).
create table if not exists inv_movements (
  id bigserial primary key,
  product_id uuid not null references inv_products(id) on delete cascade,
  kind text not null check (kind in ('venta', 'entrada', 'conteo', 'correccion')),
  delta integer not null,
  ref_id uuid,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists inv_movements_product on inv_movements (product_id, created_at desc);

create table if not exists inv_orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pedido' check (status in ('pedido', 'recibido', 'cancelado')),
  items jsonb not null default '[]',
  message text,
  created_by text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists inv_settings (
  id integer primary key default 1 check (id = 1),
  supplier_name text,
  supplier_whatsapp text,
  lead_days integer not null default 4,
  safety_days integer not null default 3,
  min_order integer not null default 2,
  coverage_months numeric not null default 2
);
insert into inv_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists inv_products_touch on inv_products;
create trigger inv_products_touch before update on inv_products for each row execute function touch_updated_at();

-- Registrar una venta completa de una sola vez: cliente, renglones y descuento de existencias.
-- p = {sale_date, channel, payment, notes, customer_name, customer_phone, items: [{product_id, qty, unit_price}]}
create or replace function inv_register_sale(p jsonb, author text) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_customer uuid;
  v_sale uuid;
  v_item jsonb;
  v_name text := nullif(trim(p->>'customer_name'), '');
  v_phone text := nullif(regexp_replace(coalesce(p->>'customer_phone', ''), '[^0-9+]', '', 'g'), '');
  v_total numeric := 0;
begin
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if v_name is not null then
    select id into v_customer from inv_customers where lower(name) = lower(v_name) and coalesce(phone, '') = coalesce(v_phone, '') limit 1;
    if v_customer is null then
      insert into inv_customers (name, phone) values (v_name, v_phone) returning id into v_customer;
    end if;
  end if;
  insert into inv_sales (sale_date, customer_id, channel, payment, notes, created_by)
  values ((p->>'sale_date')::date, v_customer, coalesce(p->>'channel', 'local'), coalesce(p->>'payment', 'efectivo'), nullif(trim(p->>'notes'), ''), author)
  returning id into v_sale;
  for v_item in select * from jsonb_array_elements(p->'items') loop
    insert into inv_sale_items (sale_id, product_id, qty, unit_price, unit_cost)
    select v_sale, pr.id, (v_item->>'qty')::int, coalesce((v_item->>'unit_price')::numeric, 0), pr.cost
    from inv_products pr where pr.id = (v_item->>'product_id')::uuid;
    update inv_products set stock = stock - (v_item->>'qty')::int where id = (v_item->>'product_id')::uuid;
    insert into inv_movements (product_id, kind, delta, ref_id, created_by)
    values ((v_item->>'product_id')::uuid, 'venta', -(v_item->>'qty')::int, v_sale, author);
    v_total := v_total + (v_item->>'qty')::int * coalesce((v_item->>'unit_price')::numeric, 0);
  end loop;
  update inv_sales set total = v_total where id = v_sale;
  return v_sale;
end $$;

-- Borrar una venta mal anotada devuelve los productos al inventario.
create or replace function inv_delete_sale(p_sale uuid, author text) returns void
language plpgsql security invoker set search_path = public as $$
declare r record;
begin
  for r in select product_id, qty from inv_sale_items where sale_id = p_sale loop
    update inv_products set stock = stock + r.qty where id = r.product_id;
    insert into inv_movements (product_id, kind, delta, ref_id, created_by) values (r.product_id, 'correccion', r.qty, p_sale, author);
  end loop;
  delete from inv_sales where id = p_sale;
end $$;

-- Sumar mercancía recibida o fijar el conteo físico. items = [{product_id, qty}]
create or replace function inv_adjust_stock(items jsonb, mode text, ref uuid, author text) returns void
language plpgsql security invoker set search_path = public as $$
declare v_item jsonb; v_old integer; v_qty integer;
begin
  if mode not in ('entrada', 'conteo') then raise exception 'Modo no válido'; end if;
  for v_item in select * from jsonb_array_elements(items) loop
    v_qty := greatest(0, (v_item->>'qty')::int);
    select stock into v_old from inv_products where id = (v_item->>'product_id')::uuid for update;
    if v_old is null then continue; end if;
    if mode = 'entrada' then
      if v_qty = 0 then continue; end if;
      update inv_products set stock = stock + v_qty where id = (v_item->>'product_id')::uuid;
      insert into inv_movements (product_id, kind, delta, ref_id, created_by) values ((v_item->>'product_id')::uuid, 'entrada', v_qty, ref, author);
    else
      if v_qty = v_old then continue; end if;
      update inv_products set stock = v_qty where id = (v_item->>'product_id')::uuid;
      insert into inv_movements (product_id, kind, delta, ref_id, created_by) values ((v_item->>'product_id')::uuid, 'conteo', v_qty - v_old, ref, author);
    end if;
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['inv_products', 'inv_customers', 'inv_sales', 'inv_sale_items', 'inv_movements', 'inv_orders', 'inv_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "solo autenticados" on %I', t);
    execute format('create policy "solo autenticados" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

revoke execute on function inv_register_sale(jsonb, text) from public, anon;
revoke execute on function inv_delete_sale(uuid, text) from public, anon;
revoke execute on function inv_adjust_stock(jsonb, text, uuid, text) from public, anon;
grant execute on function inv_register_sale(jsonb, text) to authenticated;
grant execute on function inv_delete_sale(uuid, text) to authenticated;
grant execute on function inv_adjust_stock(jsonb, text, uuid, text) to authenticated;
