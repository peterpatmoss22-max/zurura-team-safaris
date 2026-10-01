# Zurura Team Safaris

A modern, race-safe booking platform for safari tour packages. Customers browse and book available dates; the app atomically holds spots during checkout and confirms bookings once payment is verified. Admins manage packages, availability, and tax invoice generation via KRA eTIMS integration.

**Live:** [https://zurura-team-safaris-kappa.vercel.app](https://zurura-team-safaris-kappa.vercel.app)

---

## Features

- **Public:** Browse published safari packages, book available dates, submit contact inquiries
- **Authenticated users:** View and manage their bookings, process payments, track confirmation status
- **Admins:** Manage safari packages, set availability windows, track payments, generate KRA tax invoices (eTIMS)
- **Race-safe booking holds** via PostgreSQL RPCs (row-locked, atomic — no application-level locking)
- **Payment webhooks** (HMAC-SHA256 verified, provider-agnostic)
- **KRA eTIMS integration** (tax invoice generation after payment confirmation)
- **Row-level security** enforced at the database layer (defense in depth with API validation)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Next.js 16 (App Router) + React 19 + TypeScript 5.7 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (Base UI) + Lucide icons |
| **Backend** | Supabase (Postgres + Auth + RLS) — no separate server |
| **Analytics** | Vercel Analytics |
| **Package manager** | pnpm |
| **Deployment** | Vercel |

---

## Architecture

```
Client (browser)
  ↓ @supabase/supabase-js (auth, direct queries)
  ↓
Supabase (Postgres + RLS + Auth)
  ↓
Next.js API routes (app/api/**)
  ├ app/api/auth/route.ts              (signup/login/recover)
  ├ app/api/bookings/route.ts          (create booking, atomic hold)
  ├ app/api/payments/route.ts          (initiate payment)
  ├ app/api/payments/webhook/route.ts  (confirm payment + auto-submit eTIMS)
  └ app/api/etims/route.ts             (manual invoice submission, admin-only)
```

**Key design decisions:**

- **Supabase RLS** is the primary access control layer. Every table has policies that match the API route logic (defense in depth).
- **Payment webhooks** use HMAC-SHA256 signature verification; the webhook idempotently updates payment and booking status.
- **eTIMS integration** is triggered automatically after successful payment via webhook, with an audit trail in `etims_invoices`.
- **Atomic booking holds** use PostgreSQL `reserve_safari_availability` RPC with row-level locking to prevent race conditions.
- **Proxy middleware** (`lib/supabase/proxy.ts`) refreshes Supabase sessions on every request in SSR environments.

---

## Quick Start

### Prerequisites

- Node.js 20+ (required for Next.js 16 / React 19)
- pnpm (`npm install -g pnpm`)
- A Supabase project
- Supabase CLI (optional, for local dev database setup)

### Installation

```bash
# Clone the repository
git clone https://github.com/peterpatmoss22-max/zurura-team-safaris.git
cd zurura-team-safaris

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local  # or create manually (see below)
```

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase credentials (from your project dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon/public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>  # NEVER expose this client-side
SUPABASE_URL=https://<your-project>.supabase.co

# Payment webhook secret (generate: openssl rand -hex 32)
PAYMENT_WEBHOOK_SECRET=<random-hex-string>
PAYMENT_MODE=test  # or "live" for production

# eTIMS configuration (KRA sandbox/production)
ETIMS_MODE=sandbox  # or "production"
ETIMS_BASE_URL=https://kra-sandbox.example.com  # KRA sandbox endpoint
ETIMS_KRA_PIN=<your-kra-pin>
ETIMS_BRANCH_ID=00  # or your branch code
ETIMS_UNIT_ID=<oscu-unit-id>
ETIMS_CMC_KEY=<cmc-key-from-kra>

# Optional: dev/redirect URLs
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
```

> ⚠️ **Security:** Never commit `.env.local`. Ensure it's in `.gitignore`. `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely — use only server-side.

### Database Setup

```bash
# Apply schema migrations (option 1: using Supabase CLI)
supabase link --project-ref <your-project-ref>
supabase db push

# Option 2: Paste supabase/migrations/0001_init.sql into Supabase SQL editor manually
```

This creates:
- `profiles`, `user_roles` (auto-provisioned on signup)
- `safari_packages`, `safari_availability`
- `bookings`, `payment_records`, `booking_status_history`
- `notification_events`, `contact_inquiries`
- `etims_invoices` (audit trail for tax invoice submissions)
- Postgres RPCs: `reserve_safari_availability`, `release_safari_availability`
- RLS policies for every table

**Optional: Seed sample data**

```bash
psql <connection-string> -f supabase/seed.sql
```

This inserts three published packages (`great-migration`, `northern-wilds`, `family-safari`) with matching pricing in the app.

**Optional: Make yourself an admin**

```sql
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '<your-auth-user-id>';
```

### Running Locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
pnpm build
pnpm start
```

Alternatively, deploy to Vercel (recommended):

```bash
vercel deploy
```

---

## Project Structure

```
app/
  ├ (public pages)
  │ ├ page.tsx                    # Homepage, safari browse
  │ └ safaris/[slug]/page.tsx     # Package detail
  ├ auth/
  │ ├ login/page.tsx
  │ ├ register/page.tsx
  │ └ recover/page.tsx
  ├ dashboard/
  │ └ bookings/page.tsx           # User bookings (protected)
  ├ admin/                        # Admin-only routes (RLS-protected)
  └ api/
    ├ auth/route.ts              # Signup/login/password recovery
    ├ bookings/route.ts          # Create booking (atomic hold)
    ├ payments/
    │ ├ route.ts                 # Initiate payment
    │ └ webhook/route.ts         # Webhook: confirm payment + auto-submit eTIMS
    ├ etims/route.ts             # Manual invoice submission (admin)
    └ ...other admin routes

components/
  └ ...shadcn/ui components, forms, nav

lib/
  ├ supabase/
  │ ├ client.ts                  # Browser client
  │ ├ server.ts                  # Server component client
  │ ├ admin.ts                   # Admin client (service role)
  │ └ proxy.ts                   # Middleware for session refresh
  ├ payment-service.ts           # Payment logic
  └ utils.ts

supabase/
  ├ migrations/
  │ ├ 0001_init.sql            # Initial schema
  │ └ 0002_etims_invoices.sql   # eTIMS audit table + KRA fields
  └ seed.sql                     # Sample packages

etims-service.ts                 # KRA eTIMS integration (root)
proxy.ts                         # Next.js middleware (session refresh)
```

---

## Core Flows

### 1. Safari Booking Flow

```
Customer
  → Browse packages (public API, RLS: published = true)
  → Select package + date
  → POST /api/bookings
    ├ Auth check (user must be signed in)
    ├ Validate inputs (date, guests, pricing)
    ├ Call reserve_safari_availability RPC (atomic, row-locked)
    ├ Insert booking record with status = 'pending'
    └ Return booking reference
  → Redirected to payment form
```

### 2. Payment & eTIMS Flow

```
Customer
  → POST /api/payments (bookingId, method)
    └ Create payment_records row, status = 'pending'
  
Payment Provider
  → Customer completes payment
  → Sends webhook to /api/payments/webhook
    ├ Verify HMAC-SHA256 signature
    ├ Check idempotency (reject if already processed)
    ├ Update payment_records.payment_status
    ├ Update bookings.status → 'confirmed'
    ├ If status = 'paid':
    │  ├ Auto-call submitEtimsInvoice
    │  ├ Log result to etims_invoices
    │  └ Email confirmation (optional, not yet implemented)
    └ Return { received: true }
```

### 3. Admin: Manual eTIMS Submission

```
Admin
  → POST /api/etims (bookingId)
    ├ Verify caller is admin
    ├ Fetch booking + package + buyer details
    ├ Call submitEtimsInvoice
    ├ Log to etims_invoices (upsert, idempotent)
    └ Return { kraInvoiceNumber, qrCodeUrl }
```

---

## Payments Integration

### Current Status: Provider-Agnostic Scaffold

`lib/payment-service.ts` and `app/api/payments/webhook/route.ts` are **ready for integration**, but do not directly call any payment provider's API.

**To integrate a payment provider (M-Pesa, Stripe, etc.):**

1. **Update `createPendingPayment` in `lib/payment-service.ts`:**
   - Add API call to initiate charge with provider
   - Pass provider-specific metadata

2. **Configure webhook endpoint:**
   - Provider sends POST to `/api/payments/webhook`
   - Include `x-payment-signature: sha256=<hmac>` header
   - Webhook verifies signature and updates booking status

3. **Set env vars:**
   - `PAYMENT_WEBHOOK_SECRET` (used for HMAC verification)
   - `PAYMENT_MODE=test` (sandbox) or `live` (production)

**Example webhook payload:**

```json
{
  "paymentId": "uuid-of-payment-record",
  "status": "paid",
  "reference": "provider-transaction-id"
}
```

---

## KRA eTIMS Integration

### Current Status: Production-Ready Wiring + Sandbox Testing Required

The integration is **fully wired** into the payment flow. After a successful payment:

1. `app/api/payments/webhook/route.ts` automatically calls `submitEtimsInvoice`
2. Invoice is submitted to KRA via OSCU API
3. Result (success/failure) is logged to `etims_invoices` table
4. Admin can manually retry failed submissions via `POST /api/etims`

### Prerequisites

You need KRA sandbox credentials:

```bash
ETIMS_MODE=sandbox
ETIMS_BASE_URL=https://kra-sandbox.example.com/api  # KRA sandbox endpoint
ETIMS_KRA_PIN=<your-kra-taxpayer-pin>
ETIMS_BRANCH_ID=00
ETIMS_UNIT_ID=<oscu-device-id>
ETIMS_CMC_KEY=<cmc-key-from-kra-device-init>
```

### Testing in Sandbox

1. Create a test booking and simulate a successful payment webhook
2. Check `etims_invoices` table for submission result
3. Verify `kra_invoice_number` and `qr_code_url` are populated
4. If submission fails, check `error_message` and `raw_response` for KRA error details

### Switching to Production

Once tested in sandbox:

```bash
ETIMS_MODE=production
ETIMS_BASE_URL=https://kra-production.example.com/api  # KRA production endpoint
ETIMS_KRA_PIN=<production-kra-pin>
ETIMS_UNIT_ID=<production-oscu-id>
ETIMS_CMC_KEY=<production-cmc-key>
```

### Reference

- **Official spec:** [OSCU Specification Document v2.0](https://www.kra.go.ke/images/publications/OSCU_Specification_Document_v2.0.pdf)
- **Note:** OSCU (online) and VSCU (offline) are different integration types. This implementation uses OSCU. If your business uses separate accounting software, VSCU may be more appropriate.

---

## Medical & Insurance Features

### Current Status: NOT IMPLEMENTED

The booking flow does not currently capture medical information, allergies, emergency contacts, or insurance details.

**To add this feature:**

1. Create migration `supabase/migrations/0003_medical.sql` to add:
   - `booking_medical_info` table (allergies, medications, emergency contact, insurance)
   - `medical_requirements` table (requirements per package)

2. Add form fields to booking flow:
   - Medical questionnaire
   - Emergency contact
   - Insurance provider + policy

3. Update RLS policies and API routes to handle medical data

4. Add admin dashboard view to review medical info before trip

---

## API Routes

All routes use Next.js 13+ App Router structure.

### Public Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/safaris` | GET | List published packages |
| `GET /api/safaris/:slug` | GET | Package details |

### Authenticated Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/auth` | POST | Signup, login, password recovery |
| `POST /api/bookings` | POST | Create booking (atomic hold) |
| `POST /api/payments` | POST | Initiate payment |
| `GET /api/bookings/:id` | GET | Fetch booking (owner only) |

### Admin-Only Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/etims` | POST | Submit invoice to KRA (manual) |
| `GET /api/admin/bookings` | GET | List all bookings |
| `GET /api/admin/availability` | GET | Availability by package |
| `POST /api/admin/safaris` | POST | Create/update package |

### Webhook Routes (External)

| Route | Method | Signature |
|-------|--------|-----------|
| `POST /api/payments/webhook` | POST | x-payment-signature: sha256=... |

---

## Database Schema

### Core Tables

- **profiles** (1:1 with auth.users) — full_name, email, kra_pin, business_name
- **user_roles** — role (user \| admin)
- **safari_packages** — title, description, itinerary, pricing, published flag
- **safari_availability** — date ranges, capacity, booked_spaces
- **bookings** — customer details, status, payment_status, total_amount
- **payment_records** — payment method, status, provider, transaction_reference
- **booking_status_history** — audit trail of status changes
- **notification_events** — payment/booking events for future email/SMS
- **contact_inquiries** — public inquiry form submissions
- **etims_invoices** — KRA invoice submissions (audit + retry trail)

### Access Control (RLS)

- **profiles:** Users see/edit their own; admins see all
- **safari_packages:** Public reads published; admins manage all
- **bookings:** Users see/create their own; admins see/update all
- **payment_records:** Users see payments on their bookings; admins see all
- **etims_invoices:** Admins only

---

## Known Limitations & TODOs

- [ ] Medical/insurance information not captured (see [Medical & Insurance Features](#medical--insurance-features))
- [ ] Email/SMS notifications not implemented (scaffolding exists in `notification_events`)
- [ ] Safari availability is admin-read-only; consider adding public aggregate counts (remaining spaces)
- [ ] Payment provider integration (M-Pesa, Stripe, etc.) required before going live
- [ ] eTIMS sandbox testing and production credentials setup
- [ ] Booking cancellation and refund workflows not implemented
- [ ] Multi-language support not implemented (all text in English)

---

## Development

### Running Tests

(Test suite not yet created. Recommended: Jest + React Testing Library)

```bash
pnpm test
```

### Linting & Formatting

```bash
pnpm lint           # ESLint
pnpm format         # Prettier (optional, if configured)
```

### Building

```bash
pnpm build
pnpm start
```

### Debugging

Enable verbose logging by setting `DEBUG=*` environment variable (optional).

---

## Deployment

### Vercel (Recommended)

1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Vercel auto-deploys on push to `main`

### Manual Deployment

```bash
vercel deploy --prod
```

---

## Security Considerations

- **Supabase Service Role Key** is never exposed to the client. Only used server-side in `lib/supabase/admin.ts`.
- **RLS Policies** enforce access control at the database layer, independent of API validation.
- **Payment webhooks** verify HMAC-SHA256 signature before processing.
- **Admin routes** check user role in `user_roles` table before allowing access.
- **Booking holds** use PostgreSQL row-level locking to prevent race conditions.

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes with clear messages
4. Push to the branch
5. Open a Pull Request

---

## License

MIT License. See [LICENSE](./LICENSE) for details.

---

## Support & Issues

For bugs, feature requests, or questions:

1. Check [existing issues](https://github.com/peterpatmoss22-max/zurura-team-safaris/issues)
2. Open a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs. actual behavior
   - Environment details (Node version, OS, etc.)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and breaking changes.

---

**Last updated:** October 1, 2026  
**Maintained by:** [@peterpatmoss22-max](https://github.com/peterpatmoss22-max)
