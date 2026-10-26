import crypto from 'node:crypto'

export type PaystackInitResult = {
  status: 200
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
}

export function paystackIsConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY)
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  const provided = signature.replace(/^sha512=/, '')

  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

export async function initializePaystackTransaction({
  amount,
  email,
  reference,
  currency = 'KES',
  bookingId,
}: {
  amount: number
  email: string
  reference: string
  currency?: string
  bookingId: string
}) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return { error: 'Paystack secret key is not configured.', status: 500 as const }
  }

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      email,
      amount,
      currency,
      reference,
      metadata: {
        booking_id: bookingId,
        source: 'zurura-team-safaris',
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.status) {
    return {
      error: payload?.message ?? 'Unable to initialize Paystack payment.',
      status: 502 as const,
    }
  }

  return {
    status: 200 as const,
    data: payload.data as PaystackInitResult['data'],
  }
}

export async function verifyPaystackReference(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return { error: 'Paystack secret key is not configured.', status: 500 as const }
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.status) {
    return {
      error: payload?.message ?? 'Unable to verify Paystack payment.',
      status: 502 as const,
    }
  }

  return {
    status: 200 as const,
    data: payload.data,
  }
}
