-- HarvestLink PostgreSQL schema for Supabase
create extension if not exists pgcrypto;
create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (char_length(full_name) between 2 and 100),
 role text not null default 'buyer' check (role in ('buyer','farmer','admin')),
 phone text, location text, is_approved boolean not null default false, is_rejected boolean not null default false, created_at timestamptz not null default now()
);
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(name) between 2 and 60), description text);
create table public.produce (
 id uuid primary key default gen_random_uuid(), farmer_id uuid not null references public.users(id) on delete cascade,
 category_id uuid not null references public.categories(id), name text not null check (char_length(name) between 2 and 120),
 description text, price numeric(10,2) not null check (price > 0),
 unit text not null default 'kg' check (unit in ('kg','bunch','piece','crate','bag','litre')),
 quantity integer not null check (quantity >= 0), photo_url text, location text, is_approved boolean not null default false,
 is_rejected boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.users(id),
 status text not null default 'placed' check (status in ('placed','confirmed','dispatched','delivered','cancelled')),
 delivery_address text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 produce_id uuid not null references public.produce(id), quantity integer not null check (quantity > 0),
 unit_price numeric(10,2) not null check (unit_price > 0), created_at timestamptz not null default now(), unique(order_id,produce_id)
);
create index produce_catalogue_idx on public.produce(is_approved,category_id,created_at desc);
create index orders_buyer_idx on public.orders(buyer_id,created_at desc);
create index order_items_order_idx on public.order_items(order_id);
insert into public.categories(name,description) values ('Vegetables','Leafy greens and seasonal vegetables'),('Fruits','Fresh seasonal fruit'),('Grains','Grains, pulses and pantry staples') on conflict(name) do nothing;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare requested_role text;
begin
 requested_role:=coalesce(new.raw_user_meta_data->>'role','buyer');
 if requested_role not in ('buyer','farmer') then requested_role:='buyer'; end if;
 insert into public.users(id,full_name,role,is_approved) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),requested_role,requested_role='buyer');
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.users where id=auth.uid() and role='admin' and is_approved); $$;
create or replace function public.is_approved_farmer() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.users where id=auth.uid() and role='farmer' and is_approved); $$;
create or replace function public.order_belongs_to_buyer(p_order uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.orders where id=p_order and buyer_id=auth.uid()); $$;
create or replace function public.order_has_farmer_listing(p_order uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.order_items oi join public.produce p on p.id=oi.produce_id where oi.order_id=p_order and p.farmer_id=auth.uid()); $$;
create or replace function public.guard_user_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
 -- SQL Editor runs without an end-user auth.uid(); RLS still protects browser clients.
 if auth.uid() is not null and (new.role is distinct from old.role or new.is_approved is distinct from old.is_approved or new.is_rejected is distinct from old.is_rejected) and not public.is_admin() then raise exception 'Only an administrator can change roles or approvals'; end if;
 return new;
end; $$;
drop trigger if exists guard_user_role_update on public.users;
create trigger guard_user_role_update before update of role,is_approved,is_rejected on public.users for each row execute procedure public.guard_user_role();
alter table public.users enable row level security; alter table public.categories enable row level security; alter table public.produce enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security;
create policy "Users read own profile or admin reads all" on public.users for select using (id=auth.uid() or public.is_admin());
create policy "Users update own profile" on public.users for update using (id=auth.uid()) with check (id=auth.uid());
create policy "Admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());
create policy "Categories are public" on public.categories for select using (true);
create policy "Admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "Approved listings are public" on public.produce for select using ((is_approved and not is_rejected) or farmer_id=auth.uid() or public.is_admin());
create policy "Approved farmers create listings pending review" on public.produce for insert with check (farmer_id=auth.uid() and public.is_approved_farmer() and is_approved=false and is_rejected=false);
create policy "Farmers update own listings" on public.produce for update using (farmer_id=auth.uid() or public.is_admin()) with check ((farmer_id=auth.uid() and is_approved=false) or public.is_admin());
create policy "Farmers or admins remove listings" on public.produce for delete using (farmer_id=auth.uid() or public.is_admin());
create policy "Buyer creates own order" on public.orders for insert with check (buyer_id=auth.uid() and exists(select 1 from public.users where id=auth.uid() and role='buyer' and is_approved));
create policy "Buyer farmer or admin reads order" on public.orders for select using (buyer_id=auth.uid() or public.is_admin() or public.order_has_farmer_listing(id));
create policy "Buyer updates own placed order" on public.orders for update using (buyer_id=auth.uid() and status='placed') with check (buyer_id=auth.uid());
create policy "Admins update order status" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "Order owner inserts items for approved produce" on public.order_items for insert with check (public.order_belongs_to_buyer(order_id) and exists(select 1 from public.orders o where o.id=order_id and o.status='placed') and exists(select 1 from public.produce p where p.id=produce_id and p.is_approved and p.quantity>=order_items.quantity));
create policy "Order participants read items" on public.order_items for select using (public.order_belongs_to_buyer(order_id) or public.is_admin() or exists(select 1 from public.produce p where p.id=produce_id and p.farmer_id=auth.uid()));
create policy "Admins manage order items" on public.order_items for all using (public.is_admin()) with check (public.is_admin());
-- Existing projects should use supabase/migration_approvals.sql instead of rerunning this file.
-- After signup, promote a trusted account with the SQL in that migration file.
