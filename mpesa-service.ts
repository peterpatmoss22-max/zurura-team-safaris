/**
 * M-Pesa (Safaricom Daraja API) integration — STK Push ("Lipa na M-Pesa Online").
 *
 * ⚠️ SCAFFOLD, NOT WIRED UP YET. Mirrors the shape of lib/etims-service.ts and
 * lib/payment-service.ts: the plumbing is here, but it hasn't been tested
 * against a real Daraja sandbox or production app yet.
 *
 * Docs: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
 *
 * Flow:
 *   1. Get an OAuth token (short-lived, cache it rather than fetching per request).
 *   2. Call STK Push — this sends a PIN prompt to the customer's phone.
 *   3. Safaricom calls back to MPESA_CALLBACK_URL with the result (async —
 *      the initial STK Push response just confirms the request was accepted,
 *      not that payment succeeded).
 *   4. If no callback arrives (network issue, etc.), use STK Push Query to
 *      poll the status with the CheckoutRequestID.
 */

export type MpesaMode = "sandbox" | "production";

export interface MpesaConfig {
  mode: MpesaMode;
  baseUrl: string; // sandbox: https://sandbox.safaricom.co.ke, prod: https://api.safaricom.co.ke
  consumerKey: string;
  consumerSecret: string;
  shortcode: string; // Paybill or Till number
  passkey: string; // Lipa Na M-Pesa Online Passkey, from the Daraja portal
  callbackUrl: string; // must be a public HTTPS URL
}

export function getMpesaConfig(): MpesaConfig {
  const mode = (process.env.MPESA_MODE as MpesaMode) || "sandbox";

  const required = {
    baseUrl: process.env.MPESA_BASE_URL,
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required M-Pesa env var for ${key}`);
    }
  }

  return { mode, ...(required as Omit<MpesaConfig, "mode">) };
}

// --- Threshold routing: M-Pesa for bookings under $200 USD ---

const MPESA_MAX_USD = Number(process.env.MPESA_MAX_USD ?? 200);

// ⚠️ Placeholder exchange rate handling. A fixed env var is the simplest
// thing that works, but it will drift from the real rate over time.
// Swap this for a live forex API call if that drift matters for the business.
const USD_TO_KES_RATE = Number(process.env.EXCHANGE_RATE_USD_KES ?? 129);

export function shouldUseMpesa(amountUsd: number): boolean {
  return amountUsd < MPESA_MAX_USD;
}

export function usdToKes(amountUsd: number): number {
  // Safaricom's STK Push API requires a whole-number KES amount — no decimals.
  return Math.round(amountUsd * USD_TO_KES_RATE);
}

// --- OAuth ---

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: MpesaConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString("base64");

  const response = await fetch(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!response.ok) {
    throw new Error(`M-Pesa OAuth failed with status ${response.status}`);
  }

  const data = await response.json();
  // expires_in is typically 3599 seconds — refresh a minute early to be safe.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3599) - 60) * 1000,
  };

  return cachedToken.value;
}

function buildPassword(config: MpesaConfig, timestamp: string): string {
  return Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString(
    "base64"
  );
}

function buildTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

// --- STK Push ---

export interface StkPushInput {
  bookingId: string; // used as AccountReference — keep it short, KRA/Daraja caps this around 12 chars
  phoneNumber: string; // format 2547XXXXXXXX (no leading +, no spaces)
  amountUsd: number;
  description: string; // shown to the customer on the STK prompt, e.g. package name
}

export interface StkPushResult {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  responseDescription?: string;
  error?: string;
  rawResponse: unknown;
}

export async function initiateStkPush(
  input: StkPushInput
): Promise<StkPushResult> {
  const config = getMpesaConfig();
  const token = await getAccessToken(config);
  const timestamp = buildTimestamp();
  const amountKes = usdToKes(input.amountUsd);

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: buildPassword(config, timestamp),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amountKes,
    PartyA: input.phoneNumber,
    PartyB: config.shortcode,
    PhoneNumber: input.phoneNumber,
    CallBackURL: config.callbackUrl,
    AccountReference: input.bookingId.slice(0, 12),
    TransactionDesc: input.description.slice(0, 13), // Daraja truncates this anyway
  };

  try {
    const response = await fetch(
      `${config.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const rawResponse = await response.json().catch(() => null);

    if (!response.ok || rawResponse?.ResponseCode !== "0") {
      return {
        success: false,
        error: rawResponse?.errorMessage ?? `STK Push failed with status ${response.status}`,
        rawResponse,
      };
    }

    return {
      success: true,
      checkoutRequestId: rawResponse.CheckoutRequestID,
      merchantRequestId: rawResponse.MerchantRequestID,
      responseDescription: rawResponse.ResponseDescription,
      rawResponse,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling M-Pesa",
      rawResponse: null,
    };
  }
}

// --- STK Push Query (fallback if no callback arrives) ---

export async function queryStkPushStatus(checkoutRequestId: string) {
  const config = getMpesaConfig();
  const token = await getAccessToken(config);
  const timestamp = buildTimestamp();

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: buildPassword(config, timestamp),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const response = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return response.json().catch(() => null);
}
