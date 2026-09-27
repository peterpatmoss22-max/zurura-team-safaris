# Zurura Team Safaris

A booking platform for safari tour packages. Customers browse packages and book available dates; the app holds the spot atomically during checkout and confirms it once payment is verified. Admins manage availability and view bookings through an admin-only area.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router) + TypeScript 5.7 + React 19
- **Styling:** Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (built on [Base UI](https://base-ui.com/) rather than Radix)
- **Icons:** [Lucide](https://lucide.dev/)
- **Backend / DB:** [Supabase](https://supabase.com/) (`@supabase/supabase-js` + `@supabase/ssr`), talked to directly from the frontend/API routes — no separate backend server
- **Analytics:** [Vercel Analytics](https://vercel.com/analytics)
- **Package manager:** pnpm

## Architecture

Supabase is the backend — Postgres, auth, and Row Level Security — with **no traditional server in between** for most data access:

- `@supabase/supabase-js` (client-side) and `@supabase/ssr` (server-side, for session handling in Server Components/Server Actions) talk to Supabase directly.
- **RLS policies are the primary access control layer.** Every table has policies matching the access rules already enforced in application code (defense in depth) — see [Database schema](#database-schema-migrations) below.
- A handful of routes under `app/api/**` do need server-side logic that can't live purely in RLS — notably atomic booking holds and payment webhook verification (see below). Everything else goes straight through the Supabase client.
- `proxy.ts` — ⚠️ still TBD, confirm what this does.

## Getting Started

### Prerequisites

- Node.js 20+ (recommended for Next.js 16 / React 19)
- pnpm installed (`npm install -g pnpm`)
- A Supabase project
- (Optional, for schema setup) the [Supabase CLI](https://supabase.com/docs/guides/cli)

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>       # used by lib/supabase/admin.ts
PAYMENT_WEBHOOK_SECRET=<a random secret>            # verifies app/api/payments/webhook
PAYMENT_MODE=test                                   # or "live"
```

> ⚠️ Never commit `.env.local` — confirm it's listed in `.gitignore`. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely, so it must only ever be used server-side (`lib/supabase/admin.ts`), never shipped to the client.

### Database schema (migrations)

The app code in `app/api/**` and `lib/**` assumes a specific Supabase schema exists — you need to create it before the app will work.

**1. Apply the schema**, either:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or by pasting `migrations/0001_init.sql` into the Supabase SQL editor and running it.

`0001_init.sql` creates:

- `profiles`, `user_roles` — plus a trigger that auto-creates both when someone signs up (on `auth.users` insert)
- `safari_packages`, `safari_availability`
- `bookings`, `payment_records`, `booking_status_history`, `notification_events`
- `contact_inquiries`
- `reserve_safari_availability` / `release_safari_availability` — RPCs called by `app/api/bookings/route.ts` to atomically hold and release a spot (row-locked, race-safe)
- RLS policies for every table above

**2. Seed sample packages (optional, for local dev):**

```bash
psql <connection-string> -f supabase/seed.sql
```

Inserts three published packages whose slugs/prices match the hardcoded `trustedPricing` table in `app/api/bookings/route.ts` (`great-migration`, `northern-wilds`, `family-safari`), plus one availability window each so a test booking has somewhere to land.

**3. Make yourself an admin** — the signup flow never grants the `admin` role, so do it manually after creating your account:

```sql
update public.user_roles set role = 'admin' where user_id = '<your-auth-user-id>';
```

### Running locally

```bash
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Building for production

```bash
pnpm build
pnpm start
```

## Project Structure

```
app/
  api/            # Route handlers — bookings, payments webhook, admin availability
components/       # Reusable UI components (shadcn/ui-based)
lib/
  supabase/       # Supabase client setup (browser, server, admin)
  payment-service.ts
public/           # Static assets
supabase/
  migrations/0001_init.sql
  seed.sql
proxy.ts          # ⚠️ TBD — describe what this does
```

## Features

- Browse published safari packages
- Book a package for an available date, with race-safe availability holds (via Postgres RPCs, not application-level locking)
- Payment confirmation via a provider-agnostic webhook (HMAC-SHA256 verified)
- Contact inquiry form
- Admin-only availability management
- Role-based access (`admin` vs. regular user) enforced by RLS

## Payments — integration required before going live

`lib/payment-service.ts` and `app/api/payments/webhook/route.ts` are **provider-agnostic scaffolding**: the webhook verifies an HMAC-SHA256 signature but does not call any specific payment provider's API to *initiate* a charge.

To go live:

1. Wire up your provider's API call (e.g. M-Pesa, Stripe) inside `createPendingPayment`.
2. Configure that provider to send its webhook to `/api/payments/webhook`, signed to match `PAYMENT_WEBHOOK_SECRET`.

## Known gaps / things to double-check

- `safari_availability` is currently readable only by admins (matching the only route that queries it directly, `app/api/admin/availability`). If you want the public booking form to show live remaining spaces, add a narrower `select` policy exposing just aggregate counts.
- This project pins a `pnpm` override for `hono@4.12.25`. ⚠️ Confirm and document why (likely a transitive dependency conflict from Supabase or shadcn tooling) so it isn't accidentally removed later.
- `proxy.ts` at the project root — purpose not yet documented.

## Contributing

> ⚠️ Placeholder — add contribution guidelines if this is open to others, or remove this section if it's a solo/private project.

## License

> ⚠️ No license currently specified. Add a `LICENSE` file if you want to define usage terms.
