# 🐛 ZURURA TEAM SAFARIS - BUG REPORT & FIXES

## Critical Bugs Found in Actual Files

---

## 🔴 BUG #1: Invalid Email Regex Pattern - Line 4

**File:** `app/api/auth/route.ts`

**Current Code (BROKEN):**
```typescript
const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
```

**Issue:** Double backslashes `\\s` are incorrect. The pattern treats `\\` literally instead of as an escape sequence, making it invalid.

**Fixed Code:**
```typescript
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

**Impact:** Email validation may accept invalid emails with literal backslashes.

---

## 🔴 BUG #2: Missing Admin Authorization in Payment Webhook

**File:** `app/api/payments/webhook/route.ts` (Lines 15-32)

**Current Issue:** 
The webhook accepts payment updates from ANY request that has a valid signature. However, there's no verification that the signature came from the actual payment provider.

**Current Code:**
```typescript
export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!validSignature(rawBody, request.headers.get('x-payment-signature'))) 
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  // ... rest of code
}
```

**Risk:** An attacker who knows `PAYMENT_WEBHOOK_SECRET` can forge payment confirmations and mark any booking as paid without actual payment.

**Recommended Fix:**
1. Add provider verification (e.g., M-Pesa timestamp validation)
2. Add idempotency check - don't process the same payment twice
3. Add logging of all webhook calls

```typescript
export async function POST(request: Request) {
  const rawBody = await request.text()
  
  // Verify signature
  if (!validSignature(rawBody, request.headers.get('x-payment-signature'))) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }
  
  const body = JSON.parse(rawBody) as { paymentId?: unknown; status?: unknown; reference?: unknown }
  const paymentId = typeof body.paymentId === 'string' ? body.paymentId : ''
  const status = providerEventStatus(body.status)
  const reference = typeof body.reference === 'string' ? body.reference.slice(0, 120) : undefined
  
  if (!paymentId || !status) {
    return NextResponse.json({ error: 'Invalid payment event.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  
  // Check if this exact payment has already been processed (idempotency)
  const { data: existing } = await supabase
    .from('payment_records')
    .select('id, payment_status')
    .eq('id', paymentId)
    .single()
  
  if (existing?.payment_status === 'paid' && status === 'paid') {
    // Already processed - return success to prevent webhook retries
    return NextResponse.json({ received: true, paymentId, status: 'paid', duplicate: true })
  }

  // ... rest of processing
}
```

---

## 🔴 BUG #3: Email Validation Not Working in Bookings

**File:** `app/api/bookings/route.ts` (Line 43)

**Current Code:**
```typescript
if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) 
  return NextResponse.json({ error: 'Add a valid customer name and email.' }, { status: 400 })
```

**Issue:** The regex pattern here is correct but the one in `app/api/auth/route.ts` (Line 4) is broken. This creates inconsistency - auth accepts bad emails but bookings may reject them.

**Fix:** Use the corrected pattern consistently across both files.

---

## 🟡 BUG #4: No eTIMS Integration Despite File References

**File:** `route.ts` (at root) - SCAFFOLD NOT IMPLEMENTED

**Current Issue:** 
- The app has `etims-service.ts` and `route.ts` that reference KRA eTIMS integration
- These files are marked as "NOT WIRED UP YET"
- Payment webhook doesn't call eTIMS submission after successful payment
- No `etims_invoices` table exists in database
- No migration file `0002_etims_invoices.sql` exists

**Missing Implementation:**

1. **Missing Database Migration** - Create `supabase/migrations/0002_etims_invoices.sql`:
```sql
-- eTIMS invoice tracking table
CREATE TABLE public.etims_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  kra_invoice_number TEXT UNIQUE,
  qr_code_url TEXT,
  status TEXT CHECK (status IN ('pending', 'submitted', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  raw_response JSONB,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_etims_invoices_booking ON public.etims_invoices(booking_id);
CREATE INDEX idx_etims_invoices_status ON public.etims_invoices(status);

ALTER TABLE public.etims_invoices ENABLE ROW LEVEL SECURITY;

-- Admins can read and insert
CREATE POLICY "etims_invoices_admin_read" ON public.etims_invoices
  FOR SELECT USING (public.is_admin());

CREATE POLICY "etims_invoices_admin_insert" ON public.etims_invoices
  FOR INSERT WITH CHECK (public.is_admin());

-- Add KRA fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kra_pin TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_name TEXT;
```

2. **Missing Integration in Payment Webhook** - Add to `app/api/payments/webhook/route.ts`:
```typescript
import { submitEtimsInvoice } from '@/lib/etims-service'

export async function POST(request: Request) {
  // ... existing webhook code ...
  
  const bookingStatus = status === 'paid' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : 'pending'
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: bookingStatus, payment_status: status, updated_at: new Date().toISOString() })
    .eq('id', payment.booking_id)
  
  if (bookingError) {
    return NextResponse.json({ error: 'Payment recorded but booking update failed.' }, { status: 500 })
  }

  // ✅ NEW: Submit to eTIMS if payment is successful
  if (status === 'paid') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, safari_packages(*), profiles(*)')
      .eq('id', payment.booking_id)
      .single()

    if (booking) {
      try {
        const etimsResult = await submitEtimsInvoice({
          bookingId: booking.id,
          buyerName: booking.customer_name,
          buyerPin: booking.profiles?.kra_pin,
          items: [
            {
              description: `${booking.safari_packages.title} - ${booking.duration_days} days`,
              quantity: 1,
              unitPrice: Number(booking.total_amount),
              taxRate: 0.16,
            },
          ],
        })

        // Log eTIMS submission attempt
        await supabase.from('etims_invoices').insert({
          booking_id: booking.id,
          kra_invoice_number: etimsResult.kraInvoiceNumber,
          qr_code_url: etimsResult.qrCodeUrl,
          status: etimsResult.success ? 'submitted' : 'failed',
          error_message: etimsResult.error,
          raw_response: etimsResult.rawResponse,
          submitted_at: new Date().toISOString(),
        })
      } catch (etimsError) {
        console.error('eTIMS submission error:', etimsError)
        // Log but don't fail the entire webhook
      }
    }
  }

  return NextResponse.json({ received: true, paymentId, status: status as PaymentStatus })
}
```

---

## 🟡 BUG #5: eTIMS Field Names Not Verified Against Spec

**File:** `etims-service.ts` (Lines 71-105)

**Current Issue:**
Comments say: "⚠️ Field names below are illustrative, based on the general shape of the OSCU spec... They have NOT been verified against the actual OSCU request schema"

**Impact:** The eTIMS API will reject requests with wrong field names, breaking tax invoice generation.

**Fix:**
1. Download official spec: https://www.kra.go.ke/images/publications/OSCU_Specification_Document_v2.0.pdf
2. Cross-reference every field name in `buildInvoicePayload()`
3. Update based on actual OSCU API requirements
4. Test in KRA sandbox before production

---

## 🟡 BUG #6: No Medical/Insurance Information Captured

**Status:** NOT IMPLEMENTED

**Issue:** 
- No database fields for medical requirements
- No form fields for health information
- No allergies, emergency contacts, or insurance tracking
- Critical for safari safety compliance

**Recommended Schema Addition** (new migration `0003_medical.sql`):
```sql
-- Medical and safety requirements
CREATE TABLE public.medical_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safari_package_id UUID NOT NULL REFERENCES public.safari_packages(id),
  requirement TEXT NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical info per booking
CREATE TABLE public.booking_medical_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  allergies TEXT,
  medical_conditions TEXT,
  medications TEXT,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_medical_info ON public.booking_medical_info(booking_id);

ALTER TABLE public.booking_medical_info ENABLE ROW LEVEL SECURITY;

-- Users can see/edit their own medical info
CREATE POLICY "booking_medical_info_select_own_or_admin" 
  ON public.booking_medical_info
  FOR SELECT USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_medical_info.booking_id 
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "booking_medical_info_insert_own"
  ON public.booking_medical_info
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_medical_info.booking_id 
        AND b.user_id = auth.uid()
    )
  );
```

---

## 📋 QUICK FIX CHECKLIST

- [ ] **URGENT:** Fix email regex in `app/api/auth/route.ts` line 4
- [ ] **URGENT:** Add idempotency check to `app/api/payments/webhook/route.ts`
- [ ] **HIGH:** Create `supabase/migrations/0002_etims_invoices.sql`
- [ ] **HIGH:** Wire eTIMS submission into payment webhook
- [ ] **HIGH:** Verify eTIMS field names against OSCU spec
- [ ] **MEDIUM:** Create `supabase/migrations/0003_medical.sql`
- [ ] **MEDIUM:** Add medical info form to booking flow
- [ ] Test all changes in sandbox before production

---

## 📁 FILES AFFECTED

```
app/api/auth/route.ts                          ← BUG #1: Email regex
app/api/payments/webhook/route.ts              ← BUG #2 & #4: Missing checks & eTIMS
app/api/bookings/route.ts                      ← BUG #3: Email validation
etims-service.ts (at root)                     ← BUG #4 & #5: Not wired up
supabase/migrations/0001_init.sql              ← No medical/eTIMS tables
lib/supabase/admin.ts                          ✅ OK - credentials handling good
lib/payment-service.ts                         ✅ OK - basic structure sound
```

---

Generated: 2024-10-01
