-- HarvestLink marketplace extension.
-- Run once in Supabase SQL Editor after migration_approvals.sql.
-- Adds configurable farmer allocations, persistent carts and atomic checkout.

create table if not exists public.default_allocation (
  id uuid primary key default gen_random_uuid(),
  product_name text not null unique check (char_length(product_name) between 2 and 100),
  category text not null check (category in ('vegetables','fruits','grains')),
  unit text not null check (unit in ('kg','bunch')),
  default_quantity integer not null check (default_quantity >= 0),
  default_price_per_unit numeric(10,2) not null check (default_price_per_unit > 0),
  image_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.default_allocation(product_name,category,unit,default_quantity,default_price_per_unit,image_url) values
 ('Maize','grains','kg',50,80,'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=85'),
 ('Beans','grains','kg',50,180,'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=900&q=85'),
 ('Tomatoes','vegetables','kg',50,120,'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=85'),
 ('Potatoes','vegetables','kg',50,80,'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=900&q=85'),
 ('Kale (sukuma wiki)','vegetables','bunch',50,50,'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=900&q=85')
on conflict(product_name) do nothing;

create table if not exists public.farmer_products (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.default_allocation(id) on delete restrict,
  allocated_qty integer not null check (allocated_qty >= 0),
  available_qty integer not null check (available_qty >= 0),
  sold_qty integer not null default 0 check (sold_qty >= 0),
  price numeric(10,2) not null check (price > 0),
  farmer_name text not null default 'HarvestLink farmer',
  is_active boolean not null default false,
  is_customized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(farmer_id, product_id),
  check (available_qty + sold_qty <= allocated_qty)
);

create index if not exists farmer_products_catalogue_idx on public.farmer_products(is_active,available_qty,product_id);
create index if not exists farmer_products_farmer_idx on public.farmer_products(farmer_id,created_at desc);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null unique references public.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  item_type text not null check (item_type in ('allocation','produce')),
  farmer_product_id uuid references public.farmer_products(id) on delete cascade,
  produce_id uuid references public.produce(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  check ((item_type='allocation' and farmer_product_id is not null and produce_id is null)
      or (item_type='produce' and produce_id is not null and farmer_product_id is null))
);
create unique index if not exists cart_items_allocation_unique on public.cart_items(cart_id,farmer_product_id) where farmer_product_id is not null;
create unique index if not exists cart_items_produce_unique on public.cart_items(cart_id,produce_id) where produce_id is not null;

alter table public.orders add column if not exists delivery_name text;
alter table public.orders add column if not exists delivery_phone text;
alter table public.orders add column if not exists delivery_location text;
alter table public.order_items alter column produce_id drop not null;
alter table public.order_items add column if not exists farmer_product_id uuid references public.farmer_products(id) on delete set null;
alter table public.order_items add column if not exists item_name text;
alter table public.order_items add column if not exists item_unit text;
create unique index if not exists order_items_farmer_product_unique on public.order_items(order_id,farmer_product_id) where farmer_product_id is not null;

create or replace function public.is_approved_farmer_id(p_farmer uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.users u where u.id=p_farmer and u.role='farmer' and u.is_approved and not u.is_rejected)
$$;

create or replace function public.is_approved_buyer(p_buyer uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.users u where u.id=p_buyer and u.role='buyer' and u.is_approved)
$$;

-- Seed all configured goods when a farmer profile is created or approved.
create or replace function public.seed_farmer_products()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role='farmer' then
    insert into public.farmer_products(farmer_id,product_id,allocated_qty,available_qty,price,farmer_name,is_active)
    select new.id,a.id,a.default_quantity,a.default_quantity,a.default_price_per_unit,new.full_name,
      (new.is_approved and not new.is_rejected and a.is_active)
    from public.default_allocation a
    where a.is_active
    on conflict(farmer_id,product_id) do nothing;

    update public.farmer_products fp
    set is_active=(new.is_approved and not new.is_rejected and a.is_active),
        farmer_name=new.full_name,updated_at=now()
    from public.default_allocation a
    where fp.farmer_id=new.id and fp.product_id=a.id;
  end if;
  return new;
end;
$$;

drop trigger if exists seed_farmer_products_after_profile on public.users;
create trigger seed_farmer_products_after_profile
after insert or update of role,is_approved,is_rejected on public.users
for each row execute procedure public.seed_farmer_products();

create or replace function public.sync_default_allocation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' then
    update public.farmer_products fp
    set allocated_qty=new.default_quantity,
        available_qty=greatest(new.default_quantity-fp.sold_qty,0),
        price=new.default_price_per_unit,
        is_active=fp.is_active and new.is_active,
        updated_at=now()
    where fp.product_id=new.id and not fp.is_customized;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_default_allocation_after_update on public.default_allocation;
create trigger sync_default_allocation_after_update
after update of default_quantity,default_price_per_unit,is_active on public.default_allocation
for each row execute procedure public.sync_default_allocation();

create or replace function public.guard_farmer_product_update()
returns trigger language plpgsql set search_path=public as $$
begin
  -- Direct browser updates run as authenticated; SECURITY DEFINER checkout/seed
  -- functions run as their database owner and may adjust stock atomically.
  if current_user='authenticated' and not public.is_admin() then
    if new.farmer_id is distinct from old.farmer_id
       or new.product_id is distinct from old.product_id
       or new.allocated_qty is distinct from old.allocated_qty
       or new.sold_qty is distinct from old.sold_qty
       or new.is_customized is distinct from old.is_customized
       or new.farmer_name is distinct from old.farmer_name then
      raise exception 'Farmers can edit price, available stock and listing visibility only';
    end if;
    if auth.uid()=old.farmer_id and (new.price is distinct from old.price or new.available_qty is distinct from old.available_qty) then
      new.is_customized:=true;
    end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
drop trigger if exists guard_farmer_product_update_before on public.farmer_products;
create trigger guard_farmer_product_update_before before update on public.farmer_products
for each row execute procedure public.guard_farmer_product_update();

create or replace function public.order_has_farmer_listing(p_order uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.order_items oi
    left join public.produce p on p.id=oi.produce_id
    left join public.farmer_products fp on fp.id=oi.farmer_product_id
    where oi.order_id=p_order and (p.farmer_id=auth.uid() or fp.farmer_id=auth.uid())
  )
$$;

-- Admin-edited allocation configuration; buyers can read active product cards.
alter table public.default_allocation enable row level security;
alter table public.farmer_products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

drop policy if exists "Public read active default allocation" on public.default_allocation;
drop policy if exists "Public read default allocation" on public.default_allocation;
create policy "Public read default allocation" on public.default_allocation for select using (true);
drop policy if exists "Admins manage default allocation" on public.default_allocation;
create policy "Admins manage default allocation" on public.default_allocation for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Read active or own farmer products" on public.farmer_products;
create policy "Read active or own farmer products" on public.farmer_products for select using (farmer_id=auth.uid() or public.is_admin() or (is_active and public.is_approved_farmer_id(farmer_id)));
drop policy if exists "Farmers update own products" on public.farmer_products;
create policy "Farmers update own products" on public.farmer_products for update using (farmer_id=auth.uid() and public.is_approved_farmer_id(farmer_id)) with check (farmer_id=auth.uid() and public.is_approved_farmer_id(farmer_id));
drop policy if exists "Admins manage farmer products" on public.farmer_products;
create policy "Admins manage farmer products" on public.farmer_products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Buyers read own carts" on public.carts;
create policy "Buyers read own carts" on public.carts for select using (buyer_id=auth.uid());
drop policy if exists "Buyers read own cart items" on public.cart_items;
create policy "Buyers read own cart items" on public.cart_items for select using (exists(select 1 from public.carts c where c.id=cart_id and c.buyer_id=auth.uid()));

drop policy if exists "Buyer creates own order" on public.orders;
drop policy if exists "Order owner inserts items for approved produce" on public.order_items;
drop policy if exists "Buyer farmer or admin reads order" on public.orders;
drop policy if exists "Order participants read items" on public.order_items;
create policy "Buyer farmer or admin reads order" on public.orders for select using (buyer_id=auth.uid() or public.is_admin() or public.order_has_farmer_listing(id));
create policy "Order participants read items" on public.order_items for select using (
  public.order_belongs_to_buyer(order_id) or public.is_admin()
  or exists(select 1 from public.produce p where p.id=produce_id and p.farmer_id=auth.uid())
  or exists(select 1 from public.farmer_products fp where fp.id=farmer_product_id and fp.farmer_id=auth.uid())
);

create or replace function public.save_my_cart(p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_user uuid:=auth.uid(); v_cart uuid; v_line record; v_stock integer; v_qty integer;
begin
  if not public.is_approved_buyer(v_user) then raise exception 'Only approved buyer accounts can save a cart'; end if;
  insert into public.carts(buyer_id) values(v_user) on conflict(buyer_id) do update set updated_at=now();
  select id into v_cart from public.carts where buyer_id=v_user;
  delete from public.cart_items where cart_id=v_cart;
  for v_line in select * from jsonb_to_recordset(coalesce(p_items,'[]'::jsonb)) as x(item_type text,product_id uuid,quantity integer) loop
    if v_line.quantity is null or v_line.quantity<1 then continue; end if;
    v_stock:=0;
    if v_line.item_type='allocation' then
      select fp.available_qty into v_stock from public.farmer_products fp join public.default_allocation a on a.id=fp.product_id
      where fp.id=v_line.product_id and fp.is_active and a.is_active and public.is_approved_farmer_id(fp.farmer_id);
    elsif v_line.item_type='produce' then
      select p.quantity into v_stock from public.produce p where p.id=v_line.product_id and p.is_approved and not p.is_rejected and public.is_approved_farmer_id(p.farmer_id);
    else continue;
    end if;
    v_qty:=least(v_line.quantity,coalesce(v_stock,0));
    if v_qty>0 and v_line.item_type='allocation' then
      insert into public.cart_items(cart_id,item_type,farmer_product_id,quantity) values(v_cart,'allocation',v_line.product_id,v_qty);
    elsif v_qty>0 then
      insert into public.cart_items(cart_id,item_type,produce_id,quantity) values(v_cart,'produce',v_line.product_id,v_qty);
    end if;
  end loop;
end;
$$;
grant execute on function public.save_my_cart(jsonb) to authenticated;

create or replace function public.checkout_marketplace(
  p_delivery_name text,p_delivery_phone text,p_delivery_location text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_buyer uuid:=auth.uid(); v_item record; v_stock integer; v_price numeric; v_name text; v_unit text;
  v_issues jsonb:='[]'::jsonb; v_normalized jsonb:='[]'::jsonb; v_order uuid; v_cart uuid;
  v_phone text:=regexp_replace(coalesce(p_delivery_phone,''),'[[:space:]()/-]','','g');
begin
  if not public.is_approved_buyer(v_buyer) then raise exception 'Sign in with an approved buyer account to check out'; end if;
  if char_length(trim(coalesce(p_delivery_name,'')))<2 then raise exception 'Enter the delivery recipient name'; end if;
  if v_phone !~ '^(\+254|0)(7|1)[0-9]{8}$' then raise exception 'Enter a valid Kenyan phone number, for example 0712345678 or +254712345678'; end if;
  if char_length(trim(coalesce(p_delivery_location,'')))<3 then raise exception 'Enter a delivery location'; end if;
  if coalesce(jsonb_typeof(p_items),'null')<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Your cart is empty'; end if;

  -- Lock products in stable order, then validate every requested quantity before writing anything.
  for v_item in
    select item_type,product_id,sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(item_type text,product_id uuid,quantity integer)
    group by item_type,product_id order by item_type,product_id
  loop
    if v_item.quantity is null or v_item.quantity<1 then raise exception 'Quantity must be at least one'; end if;
    v_stock:=0; v_price:=0; v_name:='Produce'; v_unit:='kg';
    if v_item.item_type='allocation' then
      select fp.available_qty,fp.price,a.product_name,a.unit into v_stock,v_price,v_name,v_unit
      from public.farmer_products fp join public.default_allocation a on a.id=fp.product_id
      where fp.id=v_item.product_id and fp.is_active and a.is_active and public.is_approved_farmer_id(fp.farmer_id)
      for update of fp;
    elsif v_item.item_type='produce' then
      select p.quantity,p.price,p.name,p.unit into v_stock,v_price,v_name,v_unit
      from public.produce p where p.id=v_item.product_id and p.is_approved and not p.is_rejected and public.is_approved_farmer_id(p.farmer_id)
      for update;
    else
      v_issues:=v_issues||jsonb_build_array(jsonb_build_object('item_type',v_item.item_type,'product_id',v_item.product_id,'available',0));
      continue;
    end if;
    if not found then v_stock:=0; end if;
    if v_item.quantity>coalesce(v_stock,0) then
      v_issues:=v_issues||jsonb_build_array(jsonb_build_object('item_type',v_item.item_type,'product_id',v_item.product_id,'available',coalesce(v_stock,0)));
    else
      v_normalized:=v_normalized||jsonb_build_array(jsonb_build_object('item_type',v_item.item_type,'product_id',v_item.product_id,'quantity',v_item.quantity,'price',v_price,'name',v_name,'unit',v_unit));
    end if;
  end loop;
  if jsonb_array_length(v_issues)>0 then return jsonb_build_object('ok',false,'issues',v_issues); end if;

  insert into public.orders(buyer_id,status,delivery_name,delivery_phone,delivery_location,delivery_address)
  values(v_buyer,'placed',trim(p_delivery_name),v_phone,trim(p_delivery_location),trim(p_delivery_location)) returning id into v_order;
  for v_item in select * from jsonb_to_recordset(v_normalized) as x(item_type text,product_id uuid,quantity integer,price numeric,name text,unit text) loop
    insert into public.order_items(order_id,produce_id,farmer_product_id,quantity,unit_price,item_name,item_unit)
    values(v_order,case when v_item.item_type='produce' then v_item.product_id end,
      case when v_item.item_type='allocation' then v_item.product_id end,v_item.quantity,v_item.price,v_item.name,v_item.unit);
    if v_item.item_type='allocation' then
      update public.farmer_products set available_qty=available_qty-v_item.quantity,sold_qty=sold_qty+v_item.quantity where id=v_item.product_id;
    else
      update public.produce set quantity=quantity-v_item.quantity,updated_at=now() where id=v_item.product_id;
    end if;
  end loop;
  select id into v_cart from public.carts where buyer_id=v_buyer;
  if v_cart is not null then delete from public.cart_items where cart_id=v_cart; end if;
  return jsonb_build_object('ok',true,'order_id',v_order,'message','Order placed. Pay on delivery; M-Pesa is coming soon.');
end;
$$;
grant execute on function public.checkout_marketplace(text,text,text,jsonb) to authenticated;

-- Idempotent backfill: creates any configured starter item missing for an existing farmer.
insert into public.farmer_products(farmer_id,product_id,allocated_qty,available_qty,price,farmer_name,is_active)
select u.id,a.id,a.default_quantity,a.default_quantity,a.default_price_per_unit,u.full_name,
  (u.is_approved and not u.is_rejected and a.is_active)
from public.users u cross join public.default_allocation a
where u.role='farmer' and a.is_active
on conflict(farmer_id,product_id) do nothing;
