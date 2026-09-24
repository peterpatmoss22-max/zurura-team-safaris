import { NextResponse } from 'next/server'
import { createPendingPayment, type PaymentMethod } from '@/lib/payment-service'

const methods = new Set<PaymentMethod>(['mpesa', 'card', 'bank_transfer', 'other'])

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const bookingId = body && typeof body.bookingId === 'string' ? body.bookingId : ''
  const method = body && typeof body.method === 'string' && methods.has(body.method as PaymentMethod) ? body.method as PaymentMethod : null
  if (!bookingId || !method) return NextResponse.json({ error: 'Choose a valid booking and payment method.' }, { status: 400 })
  const result = await createPendingPayment({ bookingId, method })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ payment: result.payment, mode: result.mode, message: result.mode === 'test' ? 'Payment is ready in safe test mode. No money was charged.' : 'Payment started. Complete the provider steps to continue.' }, { status: 201 })
}
