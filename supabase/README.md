# Backend setup

The app code (in `app/api/**` and `lib/**`) already assumed a Supabase schema
existed. It didn't — this folder adds it.

## 1. Create a Supabase project and set env vars

Add a `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>       # used by lib/supabase/admin.ts
PAYMENT_WEBHOOK_SECRET=<a random secret>            # used to verify app/api/payments/webhook
PAYMENT_MODE=test                                   # or "live"
```

## 2. Apply the schema

Using the Supabase CLI:

```
supabase link --project-ref <your-project-ref>
supabase db push
```

Or just paste `migrations/0001_init.sql` into the Supabase SQL editor and run it.

`0001_init.sql` creates:
- `profiles`, `user_roles` — plus a trigger that auto-creates both when
  someone signs up (`auth.users` insert)
- `safari_packages`, `safari_availability`
- `bookings`, `payment_records`, `booking_status_history`, `notification_events`
- `contact_inquiries`
- `reserve_safari_availability` / `release_safari_availability` — the two
  RPCs `app/api/bookings/route.ts` calls to atomically hold and release a
  spot (row-locked, race-safe)
- Row Level Security policies for every table, matching the access rules the
  API routes already enforce in application code (defense in depth)

## 3. Seed sample packages (optional, for local dev)

```
psql <connection-string> -f supabase/seed.sql
```

This inserts three published packages whose slugs and prices match the
hardcoded `trustedPricing` table in `app/api/bookings/route.ts`
(`great-migration`, `northern-wilds`, `family-safari`), plus one availability
window each so a test booking has somewhere to land.

## 4. Make yourself an admin

The signup flow never grants the `admin` role — do it manually after you've
created your account:

```sql
update public.user_roles set role = 'admin' where user_id = '<your-auth-user-id>';
```

## Notes / things to double check against your provider

- **Payments** (`lib/payment-service.ts`, `app/api/payments/webhook/route.ts`)
  are provider-agnostic scaffolding — the webhook verifies an HMAC-SHA256
  signature but doesn't call any specific payment provider's API to
  *initiate* a charge. Wire up M-Pesa/Stripe/etc. calls in
  `createPendingPayment` and configure that provider to send its webhook to
  `/api/payments/webhook` with a matching signature.
- `safari_availability` is currently readable only by admins (matching the
  only route that queries it directly, `app/api/admin/availability`). If you
  later want the public booking form to show live remaining spaces, add a
  narrower `select` policy exposing just aggregate counts.
