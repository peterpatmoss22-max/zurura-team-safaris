/**
 * ⚠️ SCAFFOLD — receives Safaricom's async STK Push result.
 *
 * Not wired into the real booking/payment flow yet. The shape mirrors
 * app/api/payments/webhook/route.ts: verify the sender, parse the result,
 * update the booking/payment record.
 *
 * Safaricom POSTs here after the customer enters their PIN (or cancels, or
 * the prompt times out after 60s). This URL must be public HTTPS and must
 * match MPESA_CALLBACK_URL used when the STK Push was initiated.
 *
 * ⚠️ Unlike the existing payment webhook, Daraja does not sign this callback
 * with an HMAC secret — there's no built-in way to cryptographically verify
 * it came from Safaricom. Mitigate this by:
 *   - Only accepting a callback for a CheckoutRequestID you actually issued
 *     (look it up, don't trust the payload blindly).
 *   - Treating the callback as "probably true, confirm via queryStkPushStatus
 *     if anything looks off" rather than as fully trusted input.
 *   - Restricting the route at the network/firewall level if your host allows it.
 */
import { NextRequest, NextResponse } from "next/server";

interface MpesaCallbackItem {
  Name: string;
  Value?: string | number;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const stkCallback = body?.Body?.stkCallback;

  if (!stkCallback) {
    return NextResponse.json({ error: "Malformed callback body" }, { status: 400 });
  }

  const checkoutRequestId: string = stkCallback.CheckoutRequestID;
  const resultCode: number = stkCallback.ResultCode;
  const resultDesc: string = stkCallback.ResultDesc;

  // ⚠️ TODO: look up the pending payment/booking by checkoutRequestId instead
  // of trusting the callback blanketly. If there's no matching pending
  // payment for this CheckoutRequestID, reject it — don't process it.
  //
  // const supabase = createAdminClient();
  // const { data: payment } = await supabase
  //   .from("payment_records")
  //   .select("*")
  //   .eq("mpesa_checkout_request_id", checkoutRequestId)
  //   .single();
  // if (!payment) return NextResponse.json({ error: "Unknown transaction" }, { status: 404 });

  if (resultCode !== 0) {
    // Payment failed or was cancelled — ResultDesc has the human-readable reason
    // (e.g. "Request cancelled by user", "Insufficient balance").
    // ⚠️ TODO: mark the payment_records row as failed, with resultDesc stored
    // for support/debugging.
    return NextResponse.json({ received: true });
  }

  // On success, the metadata items carry the real transaction details —
  // MpesaReceiptNumber is the one to store as the source of truth.
  const metadata: MpesaCallbackItem[] =
    stkCallback.CallbackMetadata?.Item ?? [];
  const getValue = (name: string) =>
    metadata.find((item) => item.Name === name)?.Value;

  const mpesaReceiptNumber = getValue("MpesaReceiptNumber");
  const amountPaid = getValue("Amount");
  const transactionDate = getValue("TransactionDate");
  const phoneNumber = getValue("PhoneNumber");

  // ⚠️ TODO: write these into payment_records (mark 'completed'), then run
  // whatever already happens on successful payment elsewhere in the app —
  // confirming the booking, and (once wired) triggering the eTIMS invoice
  // submission from lib/etims-service.ts.

  void checkoutRequestId;
  void resultDesc;
  void mpesaReceiptNumber;
  void amountPaid;
  void transactionDate;
  void phoneNumber;

  // Always return 200 so Safaricom doesn't retry the callback.
  return NextResponse.json({ received: true });
}
