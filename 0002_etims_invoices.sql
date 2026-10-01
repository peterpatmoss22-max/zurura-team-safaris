-- ⚠️ DRAFT — review before applying. Not yet run against any environment.
--
-- Tracks eTIMS (KRA) submission attempts and results per booking, so:
--   1. There's an audit trail of what was sent to KRA and what came back.
--   2. Failed submissions are visible and retryable from an admin view.
--   3. A booking is never silently missing its tax invoice.

create table if not exists public.etims_invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  status text not null check (status in ('pending', 'submitted', 'failed')),
  kra_invoice_number text,
  qr_code_url text,
  raw_response jsonb,
  error_message text,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists etims_invoices_booking_id_idx
  on public.etims_invoices (booking_id);

alter table public.etims_invoices enable row level security;

-- Admins can read all eTIMS submission records (mirrors the admin-only
-- pattern used for safari_availability).
create policy "Admins can read etims invoices"
  on public.etims_invoices
  for select
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
  );

-- Only server-side code using the service role key should write here
-- (submission happens from app/api routes, not the client), so no insert/
-- update policy is granted to regular authenticated users. The service role
-- key bypasses RLS entirely, which is the intended path for writes.
