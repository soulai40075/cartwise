-- =============================================================
-- CartWise Phase 1: Personalization schema
-- Run in Supabase SQL Editor. Safe to re-run.
-- Adds profiles, pantry, signals, savings, stores, badges.
-- Adds indexes/RLS to existing tables. Does NOT drop data.
-- =============================================================

-- ============= SHARED FUNCTIONS (idempotent) =============

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============= PROFILES =============

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  friend_code text unique,
  household_size int default 1,
  diet_tags text[] default array[]::text[],
  allergies text[] default array[]::text[],
  avoid_brands text[] default array[]::text[],
  favorite_brands text[] default array[]::text[],
  favorite_stores text[] default array[]::text[],
  shopping_style text default 'balanced',
  max_radius_miles int default 10,
  gas_cost_per_mile numeric default 0.67,
  public_profile boolean default true,
  onboarded_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (public_profile = true or auth.uid() = id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============= PANTRY =============

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  receipt_id uuid,
  item_name text not null,
  brand text,
  category text,
  quantity numeric default 1,
  unit text,
  estimated_price_cents int,
  purchased_at timestamp default now(),
  expires_at timestamp,
  still_have boolean default true,
  created_at timestamp default now()
);

create index if not exists pantry_user_idx
  on public.pantry_items(user_id, still_have);
create index if not exists pantry_expires_idx
  on public.pantry_items(user_id, expires_at)
  where still_have = true;

alter table public.pantry_items enable row level security;

drop policy if exists "pantry_all_own" on public.pantry_items;
create policy "pantry_all_own" on public.pantry_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============= ITEM SIGNALS =============

create table if not exists public.item_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  brand text,
  signal text not null,
  context jsonb default '{}'::jsonb,
  created_at timestamp default now()
);

create index if not exists signals_user_item_idx
  on public.item_signals(user_id, item_name);

alter table public.item_signals enable row level security;

drop policy if exists "signals_all_own" on public.item_signals;
create policy "signals_all_own" on public.item_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============= SAVINGS EVENTS =============

create table if not exists public.savings_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents int not null,
  baseline text,
  event_type text,
  context jsonb default '{}'::jsonb,
  created_at timestamp default now()
);

create index if not exists savings_user_time_idx
  on public.savings_events(user_id, created_at desc);

alter table public.savings_events enable row level security;

drop policy if exists "savings_all_own" on public.savings_events;
create policy "savings_all_own" on public.savings_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============= STORES (new, geo-located) =============

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text,
  address text,
  city text,
  state text,
  zip text,
  latitude double precision,
  longitude double precision,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index if not exists stores_geo_idx
  on public.stores(latitude, longitude);
create index if not exists stores_chain_idx
  on public.stores(chain);

alter table public.stores enable row level security;

drop policy if exists "stores_read_all" on public.stores;
create policy "stores_read_all" on public.stores for select using (true);

drop policy if exists "stores_write_auth" on public.stores;
create policy "stores_write_auth" on public.stores
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists stores_touch on public.stores;
create trigger stores_touch
  before update on public.stores
  for each row execute function public.touch_updated_at();

-- ============= BADGES =============

create table if not exists public.badges (
  key text primary key,
  name text not null,
  description text,
  icon text,
  tier text default 'bronze'
);

alter table public.badges enable row level security;

drop policy if exists "badges_read_all" on public.badges;
create policy "badges_read_all" on public.badges for select using (true);

insert into public.badges (key, name, description, icon, tier) values
  ('first_scan', 'First Scan', 'Uploaded your first receipt', 'receipt', 'bronze'),
  ('first_save', 'Smart Saver', 'Found a cheaper price for the first time', 'bulb', 'bronze'),
  ('pantry_stocked', 'Pantry Stocked', 'Logged 10 or more items in your pantry', 'can', 'silver'),
  ('profile_complete', 'Personalized', 'Completed your CartWise profile', 'sparkle', 'bronze'),
  ('streak_3', 'Three in a Row', 'Scanned receipts 3 weeks in a row', 'fire', 'silver'),
  ('savings_50', 'Fifty Dollar Club', 'Saved 50 dollars or more with CartWise', 'money', 'silver'),
  ('savings_500', 'Big Saver', 'Saved 500 dollars or more with CartWise', 'gem', 'gold'),
  ('explorer', 'Explorer', 'Tried 3 different stores', 'map', 'bronze'),
  ('meal_planner', 'Meal Planner', 'Generated your first meal plan', 'chef', 'bronze'),
  ('community_helper', 'Community Helper', 'Reported 25 or more prices for others', 'hands', 'gold')
on conflict (key) do nothing;

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null references public.badges(key) on delete cascade,
  awarded_at timestamp default now(),
  unique (user_id, badge_key)
);

create index if not exists user_badges_user_idx
  on public.user_badges(user_id);

alter table public.user_badges enable row level security;

drop policy if exists "user_badges_read_all" on public.user_badges;
create policy "user_badges_read_all" on public.user_badges for select using (true);

drop policy if exists "user_badges_insert_auth" on public.user_badges;
create policy "user_badges_insert_auth" on public.user_badges
  for insert with check (auth.role() = 'authenticated');

-- ============= ADD INDEXES TO EXISTING TABLES (no data changes) =============

create index if not exists receipts_user_idx
  on public.receipts(user_id, created_at desc);
create index if not exists receipts_item_idx
  on public.receipts(item_name);

create index if not exists store_prices_cluster_idx
  on public.store_prices(cluster_id);
create index if not exists store_prices_store_idx
  on public.store_prices(store_name);

-- ============= AUTO-BUILD PANTRY ON RECEIPT INSERT =============
-- Option A: zero-friction. Every scanned receipt = pantry items.
-- User marks items as "used up" later via the UI.

create or replace function public.on_receipt_inserted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid;
  v_estimated_cents int;
  v_expires timestamp;
begin
  -- If this row is from the new receipts schema (has user_id)
  v_user := new.user_id;

  -- Only act if we know who the user is
  if v_user is null then
    return new;
  end if;

  -- Estimate price in cents (unit_price is numeric dollars)
  if new.unit_price is not null then
    v_estimated_cents := round(new.unit_price * 100)::int;
  else
    v_estimated_cents := null;
  end if;

  -- Estimate expiration by category heuristic
  v_expires := case
    when new.item_name ~* '(milk|cream|yogurt|cheese|butter|egg)' then now() + interval '14 days'
    when new.item_name ~* '(bread|bagel|muffin)' then now() + interval '7 days'
    when new.item_name ~* '(chicken|beef|pork|fish|meat)' then now() + interval '3 days'
    when new.item_name ~* '(lettuce|spinach|kale|berry|apple|banana|vegetable|fruit|produce)' then now() + interval '7 days'
    when new.item_name ~* '(frozen)' then now() + interval '90 days'
    else null
  end;

  insert into public.pantry_items (
    user_id, receipt_id, item_name, brand,
    quantity, unit, estimated_price_cents,
    purchased_at, expires_at
  ) values (
    v_user, new.id, new.item_name, null,
    coalesce(new.quantity, 1), new.price_type, v_estimated_cents,
    coalesce(new.created_at, now()), v_expires
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists receipts_to_pantry on public.receipts;
create trigger receipts_to_pantry
  after insert on public.receipts
  for each row execute function public.on_receipt_inserted();

-- ============= SELF-CHECK =============
do $$
declare
  v_missing text := '';
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    v_missing := v_missing || 'profiles, ';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='pantry_items') then
    v_missing := v_missing || 'pantry_items, ';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='savings_events') then
    v_missing := v_missing || 'savings_events, ';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='stores') then
    v_missing := v_missing || 'stores, ';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='badges') then
    v_missing := v_missing || 'badges, ';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_badges') then
    v_missing := v_missing || 'user_badges, ';
  end if;

  if length(v_missing) > 0 then
    raise exception 'Missing tables: %', v_missing;
  end if;

  raise notice 'All CartWise tables present. Badges seeded: %.', (select count(*) from public.badges);
end $$;
