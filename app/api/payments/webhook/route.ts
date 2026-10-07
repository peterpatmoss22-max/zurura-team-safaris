import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerEventStatus, type PaymentStatus } from "@/lib/payment-service";
import { submitEtimsInvoice } from "@/etims-service";

function validSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = require("node:crypto").createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  if (provided.length !== expected.length) return false;
  return require("node:crypto").timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!validSignature(rawBody, request.headers.get("x-payment-signature"))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: { paymentId?: unknown; status?: unknown; reference?: unknown };

  try {
    body = JSON.parse(rawBody) as { paymentId?: unknown; status?: unknown; reference?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid payment event payload." }, { status: 400 });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  const status = providerEventStatus(body.status);
  const reference = typeof body.reference === "string" ? body.reference.slice(0, 120) : undefined;

  if (!paymentId || !status) {
    return NextResponse.json({ error: "Invalid payment event." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: payment, error: paymentLookupError } = await supabase
    .from("payment_records")
    .select("id, booking_id, payment_status")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentLookupError) {
    return NextResponse.json({ error: "Payment lookup failed." }, { status: 500 });
  }

  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  if (payment.payment_status === status) {
    return NextResponse.json({ received: true, paymentId, status: status as PaymentStatus, duplicate: true });
  }

  const { error: paymentError } = await supabase
    .from("payment_records")
    .update({
      payment_status: status,
      transaction_reference: reference || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (paymentError) {
    return NextResponse.json({ error: "Payment event could not be recorded." }, { status: 500 });
  }

  const bookingStatus = status === "paid" ? "confirmed" : status === "cancelled" ? "cancelled" : "pending";
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      status: bookingStatus,
      payment_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.booking_id);

  if (bookingError) {
    return NextResponse.json({ error: "Payment recorded but booking update failed." }, { status: 500 });
  }

  if (status === "paid") {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, user_id, total_amount, customer_name, safari_package_id")
      .eq("id", payment.booking_id)
      .maybeSingle();

    if (booking) {
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
    }
  }

  return NextResponse.json({ received: true, paymentId, status: status as PaymentStatus });
}
