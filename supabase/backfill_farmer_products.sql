-- Safe to run once after migration_marketplace.sql; it is idempotent.
-- Creates configured starter rows for existing farmers that do not already have them.
insert into public.farmer_products(
  farmer_id, product_id, allocated_qty, available_qty, price, farmer_name, is_active
)
select
  u.id,
  a.id,
  a.default_quantity,
  a.default_quantity,
  a.default_price_per_unit,
  u.full_name,
  (u.is_approved and not u.is_rejected and a.is_active)
from public.users u
cross join public.default_allocation a
where u.role = 'farmer'
  and a.is_active
on conflict (farmer_id, product_id) do nothing;
