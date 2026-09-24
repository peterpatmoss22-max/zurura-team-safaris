-- Zurura Team Safaris — initial schema
-- Recreates every table, function and policy that app/ and lib/ already assume exist.
-- Run with `supabase db push`, or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- security definer so it can read user_roles without recursing through
-- user_roles' own RLS policies.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- auto-provision profile + role on signup
-- (app code also upserts profiles on signup when a session is returned
--  immediately; this trigger covers the email-confirmation path too.)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- safari_packages
-- ---------------------------------------------------------------------------

create table public.safari_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta text,
  description text,
  hero_image_url text,
  tag text,
  location text,
  duration_days integer not null default 8,
  duration text,
  starting_price numeric(10, 2) not null default 4200,
  best_time text,
  travel_style text,
  highlights text[] not null default '{}',
  itinerary jsonb not null default '[]',   -- [{ day, title, description }]
  included text[] not null default '{}',
  excluded text[] not null default '{}',
  accommodation text,
  transport text,
  wildlife text[] not null default '{}',
  gallery jsonb not null default '[]',     -- [{ src, alt }]
  faq jsonb not null default '[]',         -- [{ question, answer }]
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index safari_packages_published_idx on public.safari_packages (published);

create trigger safari_packages_set_updated_at
  before update on public.safari_packages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- safari_availability
-- ---------------------------------------------------------------------------

create table public.safari_availability (
  id uuid primary key default gen_random_uuid(),
  safari_package_id uuid not null references public.safari_packages (id) on delete cascade,
  available_from date not null,
  available_to date not null,
  departure_time time,
  capacity integer not null check (capacity >= 1),
  booked_spaces integer not null default 0 check (booked_spaces >= 0),
  status text not null default 'available' check (status in ('available', 'unavailable')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safari_availability_window unique (safari_package_id, available_from, available_to),
  constraint safari_availability_capacity check (booked_spaces <= capacity),
  constraint safari_availability_dates check (available_to >= available_from)
);

create index safari_availability_package_idx on public.safari_availability (safari_package_id);
create index safari_availability_window_idx on public.safari_availability (available_from, available_to);

create trigger safari_availability_set_updated_at
  before update on public.safari_availability
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  safari_package_id uuid not null references public.safari_packages (id),
  availability_id uuid references public.safari_availability (id),
  booking_reference text not null unique,
  arrival_date date not null,
  duration_days integer not null check (duration_days between 1 and 60),
  guests integer not null check (guests between 1 and 12),
  accommodation text,
  transport text,
  status text not null default 'pending'
    check (status in ('inquiry', 'pending', 'confirmed', 'cancelled', 'completed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  currency text not null default 'USD',
  total_amount numeric(10, 2) not null default 0,
  base_amount numeric(10, 2) not null default 0,
  additional_amount numeric(10, 2) not null default 0,
  customer_name text not null,
  customer_email text not null,
  selected_options text[] not null default '{}',
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_user_idempotency unique (user_id, idempotency_key)
);

create index bookings_user_idx on public.bookings (user_id);
create index bookings_package_idx on public.bookings (safari_package_id);
create index bookings_status_idx on public.bookings (status);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_records
-- ---------------------------------------------------------------------------

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  payment_method text not null check (payment_method in ('mpesa', 'card', 'bank_transfer', 'other')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  provider text,
  transaction_reference text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_records_booking_idx on public.payment_records (booking_id);

create trigger payment_records_set_updated_at
  before update on public.payment_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- booking_status_history
-- ---------------------------------------------------------------------------

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_user_id uuid references auth.users (id),
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index booking_status_history_booking_idx on public.booking_status_history (booking_id);

-- ---------------------------------------------------------------------------
-- notification_events
-- ---------------------------------------------------------------------------

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index notification_events_user_idx on public.notification_events (user_id);

-- ---------------------------------------------------------------------------
-- contact_inquiries
-- ---------------------------------------------------------------------------

create table public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RPCs used by app/api/bookings/route.ts
-- ---------------------------------------------------------------------------

-- Atomically finds an availability window with room for p_guests on
-- p_travel_date, locks it, and increments booked_spaces.
create or replace function public.reserve_safari_availability(
  p_safari_package_id uuid,
  p_travel_date date,
  p_guests integer
)
returns table (availability_id uuid, remaining_spaces integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.safari_availability%rowtype;
begin
  select *
    into v_row
    from public.safari_availability
   where safari_package_id = p_safari_package_id
     and status = 'available'
     and available_from <= p_travel_date
     and available_to >= p_travel_date
     and capacity - booked_spaces >= p_guests
   order by available_from
   limit 1
   for update skip locked;

  if not found then
    return;
  end if;

  update public.safari_availability
     set booked_spaces = booked_spaces + p_guests
   where id = v_row.id
   returning id, capacity - booked_spaces
   into availability_id, remaining_spaces;

  return next;
end;
$$;

-- Releases a reservation (e.g. when the booking insert that followed
-- reserve_safari_availability failed).
create or replace function public.release_safari_availability(
  p_availability_id uuid,
  p_guests integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.safari_availability
     set booked_spaces = greatest(booked_spaces - p_guests, 0)
   where id = p_availability_id;
end;
$$;

grant execute on function public.reserve_safari_availability(uuid, date, integer) to authenticated;
grant execute on function public.release_safari_availability(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.safari_packages enable row level security;
alter table public.safari_availability enable row level security;
alter table public.bookings enable row level security;
alter table public.payment_records enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.notification_events enable row level security;
alter table public.contact_inquiries enable row level security;

-- profiles: a user manages their own row; admins see everyone
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_upsert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- user_roles: read-only from the client; only admins (or the service role,
-- which bypasses RLS) can see other users' roles. Role assignment is done
-- from the Supabase dashboard / service role, not the public API.
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (auth.uid() = user_id or public.is_admin());

-- safari_packages: public reads published packages; admins manage everything
create policy "safari_packages_select_published_or_admin" on public.safari_packages
  for select using (published = true or public.is_admin());
create policy "safari_packages_admin_insert" on public.safari_packages
  for insert with check (public.is_admin());
create policy "safari_packages_admin_update" on public.safari_packages
  for update using (public.is_admin());
create policy "safari_packages_admin_delete" on public.safari_packages
  for delete using (public.is_admin());

-- safari_availability: admin-only via the API today (reservations go
-- through the SECURITY DEFINER RPCs above, which bypass RLS).
create policy "safari_availability_admin_select" on public.safari_availability
  for select using (public.is_admin());
create policy "safari_availability_admin_insert" on public.safari_availability
  for insert with check (public.is_admin());
create policy "safari_availability_admin_update" on public.safari_availability
  for update using (public.is_admin());
create policy "safari_availability_admin_delete" on public.safari_availability
  for delete using (public.is_admin());

-- bookings: a user sees and creates their own; admins see and update all
create policy "bookings_select_own_or_admin" on public.bookings
  for select using (auth.uid() = user_id or public.is_admin());
create policy "bookings_insert_own" on public.bookings
  for insert with check (auth.uid() = user_id);
create policy "bookings_admin_update" on public.bookings
  for update using (public.is_admin());

-- payment_records: visible/insertable by the booking's owner, or an admin
create policy "payment_records_select_owner_or_admin" on public.payment_records
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = payment_records.booking_id and b.user_id = auth.uid()
    )
  );
create policy "payment_records_insert_owner" on public.payment_records
  for insert with check (
    exists (
      select 1 from public.bookings b
      where b.id = payment_records.booking_id and b.user_id = auth.uid()
    )
  );
-- Payment status updates arrive only through the signed webhook, which
-- uses the service-role admin client and so bypasses RLS entirely.

-- booking_status_history: booking owner or admin can read; only admins write
create policy "booking_status_history_select_owner_or_admin" on public.booking_status_history
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_status_history.booking_id and b.user_id = auth.uid()
    )
  );
create policy "booking_status_history_admin_insert" on public.booking_status_history
  for insert with check (public.is_admin());

-- notification_events: the target user or an admin can read; only admins write
create policy "notification_events_select_owner_or_admin" on public.notification_events
  for select using (auth.uid() = user_id or public.is_admin());
create policy "notification_events_admin_insert" on public.notification_events
  for insert with check (public.is_admin());

-- contact_inquiries: anyone (including anonymous visitors) can submit one;
-- only admins can read them back
create policy "contact_inquiries_insert_any" on public.contact_inquiries
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy "contact_inquiries_admin_select" on public.contact_inquiries
  for select using (public.is_admin());
