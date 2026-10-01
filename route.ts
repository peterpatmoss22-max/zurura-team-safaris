/**
 * ⚠️ SCAFFOLD — admin-only route to (re)submit a booking to eTIMS.
 *
 * Not wired into the real booking/payment flow yet. This is here so eTIMS
 * submission can be triggered manually (or retried after a failure) while
 * the automatic hook into the payment webhook is still being built.
 *
 * Expected usage once real: automatic submission happens right after a
 * payment_records row flips to 'completed' in app/api/payments/webhook.
 * This route stays as a manual fallback for failures.
 */
import { NextRequest, NextResponse } from "next/server";
import { submitEtimsInvoice } from "@/lib/etims-service";
// ⚠️ Adjust these imports to match the real Supabase admin client / auth
// helper locations once confirmed (likely lib/supabase/admin.ts and
// whatever helper checks the caller's 'admin' role from user_roles).
// import { createAdminClient } from "@/lib/supabase/admin";
// import { requireAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  // ⚠️ TODO: verify the caller is an admin before doing anything else.
  // const admin = await requireAdmin(request);
  // if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const bookingId: string | undefined = body?.bookingId;

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  // ⚠️ TODO: look up the real booking + package + buyer details from Supabase
  // instead of this placeholder. Needs: buyer name/PIN, package description,
  // price, quantity (e.g. number of travelers), and the applicable VAT rate.
  //
  // const supabase = createAdminClient();
  // const { data: booking } = await supabase
  //   .from("bookings")
  //   .select("*, safari_packages(*), profiles(*)")
  //   .eq("id", bookingId)
  //   .single();

  const result = await submitEtimsInvoice({
    bookingId,
    buyerName: "PLACEHOLDER — fetch from booking.profiles.full_name",
    items: [
      {
        description: "PLACEHOLDER — fetch from booking.safari_packages.name",
        quantity: 1,
        unitPrice: 0,
        taxRate: 0.16,
      },
    ],
  });

  // ⚠️ TODO: write `result` into the etims_invoices table (see
  // supabase/migrations/0002_etims_invoices.sql) regardless of success/failure,
  // so there's an audit trail and failed submissions are visible to admins.

  if (!result.success) {
    return NextResponse.json({ error: result.error, rawResponse: result.rawResponse }, { status: 502 });
  }

  return NextResponse.json({
    kraInvoiceNumber: result.kraInvoiceNumber,
    qrCodeUrl: result.qrCodeUrl,
  });
}
