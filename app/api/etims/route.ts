import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitEtimsInvoice } from "../../../etims-service";

export async function POST(request: Request) {
  const supabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (role?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const bookingId = typeof body?.bookingId === "string" ? body.bookingId : "";

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, total_amount, customer_name, duration_days, safari_package_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const { data: safariPackage } = await supabase
    .from("safari_packages")
    .select("title")
    .eq("id", booking.safari_package_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, kra_pin")
    .eq("id", booking.user_id)
    .maybeSingle();

  const result = await submitEtimsInvoice({
    bookingId: booking.id,
    buyerName: booking.customer_name || profile?.full_name || "Safari customer",
    buyerPin: profile?.kra_pin ?? undefined,
    items: [
      {
        description: safariPackage?.title || "Safari booking",
        quantity: 1,
        unitPrice: Number(booking.total_amount || 0),
        taxRate: 0.16,
      },
    ],
  });

  await supabase.from("etims_invoices").upsert(
    {
      booking_id: booking.id,
      kra_invoice_number: result.kraInvoiceNumber ?? null,
      qr_code_url: result.qrCodeUrl ?? null,
      status: result.success ? "submitted" : "failed",
      error_message: result.error ?? null,
      raw_response: result.rawResponse,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "booking_id" },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error, rawResponse: result.rawResponse }, { status: 502 });
  }

  return NextResponse.json({
    kraInvoiceNumber: result.kraInvoiceNumber,
    qrCodeUrl: result.qrCodeUrl,
  });
}
