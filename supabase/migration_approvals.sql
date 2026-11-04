-- Run this migration in Supabase SQL Editor before deploying the updated app.
-- Adds explicit rejection state while preserving existing users and listings.

alter table public.users
  add column if not exists is_rejected boolean not null default false;
alter table public.produce
  add column if not exists is_rejected boolean not null default false;

create or replace function public.guard_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- SQL Editor has no end-user auth.uid(). Browser clients remain protected by RLS.
  if auth.uid() is not null
     and (new.role is distinct from old.role
       or new.is_approved is distinct from old.is_approved
       or new.is_rejected is distinct from old.is_rejected)
     and not public.is_admin() then
    raise exception 'Only an administrator can change roles or approvals';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_role_update on public.users;
create trigger guard_user_role_update
before update of role, is_approved, is_rejected on public.users
for each row execute procedure public.guard_user_role();

-- A SQL Editor user has no auth.uid(); RLS still blocks browser users from
-- writing another user's profile or changing role/approval fields.
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.produce enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Approved listings are public" on public.produce;
create policy "Approved listings are public" on public.produce
for select using ((is_approved and not is_rejected)
  or farmer_id = auth.uid() or public.is_admin());

drop policy if exists "Approved farmers create listings pending review" on public.produce;
create policy "Approved farmers create listings pending review" on public.produce
for insert with check (farmer_id = auth.uid()
  and public.is_approved_farmer() and is_approved = false and is_rejected = false);

-- Promote your own newly registered account. Replace the email, run this in
-- SQL Editor, and confirm the returned row shows role=admin and approved=true.
update public.users
set role = 'admin', is_approved = true, is_rejected = false
where id = (select id from auth.users where email = 'your-admin-email@example.com')
returning id, role, is_approved;
