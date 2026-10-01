export type EtimsMode = "sandbox" | "production";

export interface EtimsConfig {
  mode: EtimsMode;
  baseUrl: string;
  kraPin: string;
  branchId: string;
  unitId: string;
  cmcKey: string;
}

export interface EtimsInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface EtimsInvoiceInput {
  bookingId: string;
  buyerName: string;
  buyerPin?: string;
  items: EtimsInvoiceItem[];
  currency?: string;
}

export interface EtimsInvoiceResult {
  success: boolean;
  kraInvoiceNumber?: string;
  qrCodeUrl?: string;
  rawResponse: unknown;
  error?: string;
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

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required eTIMS env var(s): ${missing.join(", ")}`);
  }

  return {
    mode,
    ...(required as Omit<EtimsConfig, "mode">),
  };
}

function buildInvoicePayload(input: EtimsInvoiceInput, config: EtimsConfig) {
  const items = input.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate,
    taxAmount: item.quantity * item.unitPrice * item.taxRate,
    total: item.quantity * item.unitPrice * (1 + item.taxRate),
  }));

  const totalTaxable = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);

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

export async function submitEtimsInvoice(
  input: EtimsInvoiceInput,
): Promise<EtimsInvoiceResult> {
  let config: EtimsConfig;

  try {
    config = getEtimsConfig();
  } catch (error) {
    return {
      success: false,
      rawResponse: null,
      error: error instanceof Error ? error.message : "Missing eTIMS configuration",
    };
  }

  const payload = buildInvoicePayload(input, config);

  try {
    const baseUrl = config.baseUrl.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.cmcKey}`,
        "X-Unit-Id": config.unitId,
      },
      body: JSON.stringify(payload),
    });

    let rawResponse: unknown = null;
    const responseText = await response.text();
    try {
      rawResponse = JSON.parse(responseText);
    } catch {
      rawResponse = responseText;
    }

    if (!response.ok) {
      return {
        success: false,
        rawResponse,
        error: `eTIMS submission failed with status ${response.status}`,
      };
    }

    const invoiceNumber =
      typeof rawResponse === "object" && rawResponse && "invoiceNumber" in rawResponse
        ? (rawResponse as { invoiceNumber?: string }).invoiceNumber
        : undefined;

    const qrCodeUrl =
      typeof rawResponse === "object" && rawResponse && "qrCodeUrl" in rawResponse
        ? (rawResponse as { qrCodeUrl?: string }).qrCodeUrl
        : undefined;

    return {
      success: true,
      kraInvoiceNumber: invoiceNumber,
      qrCodeUrl,
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
