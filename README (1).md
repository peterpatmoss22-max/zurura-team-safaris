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

## eTIMS (KRA tax compliance) — scaffolded, not wired up

Kenya requires tax invoices to be submitted to KRA's Electronic Tax Invoice Management System (eTIMS). `lib/etims-service.ts` scaffolds this against **OSCU** (Online Sales Control Unit) — the integration type that fits a direct web-based sales system like this one. **VSCU** (Virtual Sales Control Unit) is the other KRA integration type, typically used when invoicing already happens in separate accounting/ERP software — if that turns out to be the right fit instead, this scaffold needs to be redone against the VSCU spec, not just reconfigured.

⚠️ **Not yet confirmed against KRA:** this business hasn't registered with KRA for eTIMS yet, so none of the request/response field names below have been verified against the real API — only against the general shape described in the public OSCU spec. Treat every field name as a placeholder to confirm once device credentials exist.

### What's scaffolded

- `lib/etims-service.ts` — builds an invoice payload from booking/item data and submits it to the OSCU API. Includes VAT calculation (16% standard rate, configurable per line item).
- `app/api/admin/etims/retry/route.ts` — admin-only endpoint to manually (re)submit a booking to eTIMS. Currently uses placeholder booking data — needs wiring to actually fetch the booking, package, and buyer details from Supabase.
- `supabase/migrations/0002_etims_invoices.sql` — draft migration adding an `etims_invoices` table (status, KRA invoice number, QR code URL, raw response, error message) with admin-only read access via RLS, written only via the service role key.

### Still to do

1. **Register with KRA for eTIMS (OSCU)** to get a KRA PIN, branch ID, unit ID, and CMC key.
2. Confirm the real OSCU request/response schema against the [official spec](https://www.kra.go.ke/images/publications/OSCU_Specification_Document_v2.0.pdf) and fix any field-name mismatches in `buildInvoicePayload`.
3. Wire automatic submission into `app/api/payments/webhook/route.ts` so a tax invoice is generated the moment a payment is confirmed — right now it only happens via the manual admin retry route.
4. Decide what happens on an eTIMS submission failure (booking still confirmed? admin alert? auto-retry?) — currently it just returns an error with no retry logic.
5. Apply `supabase/migrations/0002_etims_invoices.sql` (after review) and write results into it from both the webhook hook and the retry route.

### Environment variables

```bash
ETIMS_MODE=sandbox                          # or "production"
ETIMS_BASE_URL=https://etims-api-sbx.kra.go.ke   # confirm actual sandbox/prod URLs at registration
ETIMS_KRA_PIN=<your KRA PIN>
ETIMS_BRANCH_ID=<your KRA branch code>
ETIMS_UNIT_ID=<OSCU device/unit ID from KRA>
ETIMS_CMC_KEY=<CMC key issued at device initialization>
```

## Security Checklist

Config existing (RLS policies, env vars, webhook secrets) isn't the same as it being verified. Before going live, work through:

- [ ] **Audit for leaked secrets** — confirm `.env.local` is in `.gitignore`, and check git history (`git log -p -- .env.local`) to make sure no secret was ever committed, even in a commit that was later "removed."
- [ ] **Verify RLS actually blocks what it should** — the migration creates policies for every table, but test as a logged-in non-admin user that you genuinely cannot read/write other users' `bookings`, `payment_records`, or `profiles` rows, and that `safari_availability` really is admin-only.
- [ ] **Lock down the service role key** — `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. Grep for it and confirm it's only imported in `lib/supabase/admin.ts` and only used in server-only files, never in anything shipped to the browser bundle.
- [ ] **Harden the payment webhook** — confirm the HMAC signature check in `app/api/payments/webhook/route.ts` uses a timing-safe comparison (e.g. `crypto.timingSafeEqual`), not `===`. Confirm `PAYMENT_MODE=test` vs `live` actually switches which secret/endpoint is used, so a misconfigured env var can't process real charges in a test environment (or vice versa).
- [ ] **Add an audit trail for admin role changes** — promotion to `admin` is a manual SQL update with no logging today. Consider a trigger writing to a `role_change_log` table (who changed it, when) once more than one person can run that SQL.
- [ ] **Rate-limit sensitive API routes** — `app/api/bookings` and the payment webhook are prime targets for abuse (fake booking spam holding availability, webhook flooding). Add rate limiting if not already handled by your hosting platform.
- [ ] **Review `proxy.ts`** — once its purpose is confirmed, check whether it handles any third-party API keys that need the same server-side-only treatment as the rest of `app/api`.

## Known gaps / things to double-check

- `safari_availability` is currently readable only by admins (matching the only route that queries it directly, `app/api/admin/availability`). If you want the public booking form to show live remaining spaces, add a narrower `select` policy exposing just aggregate counts.
- This project pins a `pnpm` override for `hono@4.12.25`. ⚠️ Confirm and document why (likely a transitive dependency conflict from Supabase or shadcn tooling) so it isn't accidentally removed later.
- `proxy.ts` at the project root — purpose not yet documented. See Security Checklist above.

## Contributing

> ⚠️ Placeholder — add contribution guidelines if this is open to others, or remove this section if it's a solo/private project.

## License

> ⚠️ No license currently specified. Add a `LICENSE` file if you want to define usage terms.
