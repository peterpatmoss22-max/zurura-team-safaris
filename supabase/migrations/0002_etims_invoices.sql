CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.etims_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings (id) ON DELETE CASCADE,
  kra_invoice_number TEXT,
  qr_code_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'failed')),
  error_message TEXT,
  raw_response JSONB,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etims_invoices_booking_id
  ON public.etims_invoices (booking_id);

CREATE INDEX IF NOT EXISTS idx_etims_invoices_status
  ON public.etims_invoices (status);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kra_pin TEXT,
  ADD COLUMN IF NOT EXISTS business_name TEXT;

ALTER TABLE public.etims_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etims_invoices_admin_read"
  ON public.etims_invoices
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "etims_invoices_admin_insert"
  ON public.etims_invoices
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "etims_invoices_admin_update"
  ON public.etims_invoices
  FOR UPDATE
  USING (public.is_admin());
