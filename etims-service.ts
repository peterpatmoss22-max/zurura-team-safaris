/**
 * eTIMS (KRA Electronic Tax Invoice Management System) integration — OSCU flavor.
 *
 * ⚠️ SCAFFOLD, NOT WIRED UP YET. This mirrors the shape of lib/payment-service.ts:
 * the plumbing is here, but it has not been pointed at a real KRA sandbox/prod
 * environment or tested against the actual OSCU API responses.
 *
 * Confirm against the official OSCU Specification before relying on this in production:
 * https://www.kra.go.ke/images/publications/OSCU_Specification_Document_v2.0.pdf
 *
 * NOTE: OSCU and VSCU are different KRA integration types with different
 * endpoints/payloads. If it turns out this business needs VSCU instead
 * (e.g. because invoicing already happens in separate accounting software),
 * this file needs to be redone against the VSCU spec, not just reconfigured.
 */

export type EtimsMode = "sandbox" | "production";

export interface EtimsConfig {
  mode: EtimsMode;
  baseUrl: string;
  kraPin: string; // Taxpayer's KRA PIN
  branchId: string; // KRA branch/office code, e.g. "00"
  unitId: string; // OSCU device/unit ID issued by KRA at registration
  cmcKey: string; // CMC key issued by KRA during device initialization
}

export function getEtimsConfig(): EtimsConfig {
  const mode = (process.env.ETIMS_MODE as EtimsMode) || "sandbox";

  const required = {
    baseUrl: process.env.ETIMS_BASE_URL,
    kraPin: process.env.ETIMS_KRA_PIN,
    branchId: process.env.ETIMS_BRANCH_ID,
    unitId: process.env.ETIMS_UNIT_ID,
    cmcKey: process.env.ETIMS_CMC_KEY,
  };

  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required eTIMS env var for ${key}`);
    }
  }

  return { mode, ...(required as Omit<EtimsConfig, "mode">) };
}

export interface EtimsInvoiceItem {
  description: string; // e.g. "Great Migration Safari Package — 5D4N"
  quantity: number;
  unitPrice: number; // in KES, before tax
  taxRate: number; // e.g. 0.16 for standard 16% VAT; 0 for exempt/zero-rated
}

export interface EtimsInvoiceInput {
  bookingId: string;
  buyerName: string;
  buyerPin?: string; // optional — only required for B2B invoices
  items: EtimsInvoiceItem[];
  currency?: string; // defaults to KES
}

export interface EtimsInvoiceResult {
  success: boolean;
  kraInvoiceNumber?: string;
  qrCodeUrl?: string;
  rawResponse: unknown;
  error?: string;
}

function buildInvoicePayload(input: EtimsInvoiceInput, config: EtimsConfig) {
  // ⚠️ Field names below are illustrative, based on the general shape of the
  // OSCU spec (taxpayer PIN, branch, item lines with tax rate codes, totals).
  // They have NOT been verified against the actual OSCU request schema —
  // cross-check every field name against the spec PDF before going live.
  const items = input.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    taxAmount: item.quantity * item.unitPrice * item.taxRate,
    total: item.quantity * item.unitPrice * (1 + item.taxRate),
  }));

  const totalTaxable = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const totalTax = items.reduce((sum, i) => sum + i.taxAmount, 0);

  return {
    kraPin: config.kraPin,
    branchId: config.branchId,
    unitId: config.unitId,
    invoiceReference: input.bookingId,
    currency: input.currency ?? "KES",
    buyer: {
      name: input.buyerName,
      pin: input.buyerPin ?? null,
    },
    items,
    totals: {
      taxableAmount: totalTaxable,
      taxAmount: totalTax,
      grandTotal: totalTaxable + totalTax,
    },
  };
}

/**
 * Submit a confirmed booking as a tax invoice to KRA via eTIMS OSCU.
 *
 * Intended call site: after a booking's payment is confirmed (i.e. alongside
 * or just after whatever marks payment_records as 'completed' in
 * app/api/payments/webhook/route.ts). Not wired into that route yet.
 */
export async function submitEtimsInvoice(
  input: EtimsInvoiceInput
): Promise<EtimsInvoiceResult> {
  const config = getEtimsConfig();
  const payload = buildInvoicePayload(input, config);

  try {
    const response = await fetch(`${config.baseUrl}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ⚠️ Confirm the actual auth header shape required by OSCU —
        // some integrations use the CMC key as a bearer token, others
        // require it signed into the payload itself. Verify against spec.
        Authorization: `Bearer ${config.cmcKey}`,
      },
      body: JSON.stringify(payload),
    });

    const rawResponse = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        rawResponse,
        error: `eTIMS submission failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      kraInvoiceNumber: rawResponse?.invoiceNumber,
      qrCodeUrl: rawResponse?.qrCodeUrl,
      rawResponse,
    };
  } catch (err) {
    return {
      success: false,
      rawResponse: null,
      error: err instanceof Error ? err.message : "Unknown error calling eTIMS",
    };
  }
}
