import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPendingPayment, type PaymentMethod } from '@/lib/payment-service'
import { initializePaystackTransaction } from '@/lib/paystack'

const methods = new Set<PaymentMethod>(['mpesa', 'card', 'bank_transfer', 'other', 'paystack'])

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const bookingId = body && typeof body.bookingId === 'string' ? body.bookingId : ''
  const method = body && typeof body.method === 'string' && methods.has(body.method as PaymentMethod) ? body.method as PaymentMethod : null

  if (!bookingId || !method) {
    return NextResponse.json({ error: 'Choose a valid booking and payment method.' }, { status: 400 })
  }

  if (method === 'paystack' && !process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: 'Paystack is not configured on this server.' }, { status: 500 })
  }

  const result = await createPendingPayment({ bookingId, method })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  if (method === 'paystack') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, total_amount, currency')
      .eq('id', bookingId)
      .eq('user_id', user?.id ?? '')
      .maybeSingle()

    const amountInKobo = Math.max(1, Math.round((Number(booking?.total_amount ?? result.payment.amount ?? 0) * 100)))
    const paystack = await initializePaystackTransaction({
      amount: amountInKobo,
      email: user?.email ?? 'customer@example.com',
      reference: `zts-${result.payment.id}`,
      currency: booking?.currency ?? 'KES',
      bookingId,
    })

    if ('error' in paystack) {
      await supabase.from('payment_records').update({
        payment_status: 'failed',
        metadata: {
          mode: process.env.PAYMENT_MODE === 'live' ? 'live' : 'test',
          paystack: { error: paystack.error },
        },
      }).eq('id', result.payment.id)

      return NextResponse.json({ error: paystack.error }, { status: paystack.status })
    }

    await supabase.from('payment_records').update({
      provider: 'paystack',
      transaction_reference: paystack.data.reference,
      metadata: {
        mode: process.env.PAYMENT_MODE === 'live' ? 'live' : 'test',
        paystack: {
          access_code: paystack.data.access_code,
          authorization_url: paystack.data.authorization_url,
          reference: paystack.data.reference,
          amount: amountInKobo,
        },
      },
    }).eq('id', result.payment.id)

    return NextResponse.json({
      payment: result.payment,
      mode: result.mode,
      reference: paystack.data.reference,
      authorization_url: paystack.data.authorization_url,
      message: 'Paystack checkout initialized successfully.',
    }, { status: 201 })
  }

  return NextResponse.json({
    payment: result.payment,
    mode: result.mode,
    message: result.mode === 'test' ? 'Payment is ready in safe test mode. No money was charged.' : 'Payment started. Complete the payment flow.',
  }, { status: 201 })
}
