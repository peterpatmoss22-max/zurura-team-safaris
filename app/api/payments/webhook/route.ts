import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { providerEventStatus, type PaymentStatus } from '@/lib/payment-service'
import { verifyPaystackSignature } from '@/lib/paystack'

function validLegacySignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || !signature) return false

  const expected = require('node:crypto').createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = signature.replace(/^sha256=/, '')

  if (provided.length !== expected.length) return false
  return require('node:crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const paystackSignature = request.headers.get('x-paystack-signature')
  const legacySignature = request.headers.get('x-payment-signature')

  if (paystackSignature && verifyPaystackSignature(rawBody, paystackSignature)) {
    let payload: { event?: string; data?: { reference?: string; status?: string } } = {}

    try {
      payload = JSON.parse(rawBody) as { event?: string; data?: { reference?: string; status?: string } }
    } catch {
      return NextResponse.json({ error: 'Invalid Paystack payload.' }, { status: 400 })
    }

    const event = typeof payload.event === 'string' ? payload.event : ''
    const reference = typeof payload.data?.reference === 'string' ? payload.data.reference : ''
    const status = payload.data?.status === 'success' || event === 'charge.success' ? 'paid' : payload.data?.status === 'failed' ? 'failed' : null

    if (!reference || !status) {
      return NextResponse.json({ received: true, ignored: true, event }, { status: 200 })
    }

    const supabase = createAdminClient()
    const { data: payment, error: paymentLookupError } = await supabase
      .from('payment_records')
      .select('id, booking_id, payment_status')
      .eq('transaction_reference', reference)
      .maybeSingle()

    if (paymentLookupError) {
      return NextResponse.json({ error: 'Payment lookup failed.' }, { status: 500 })
    }

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    }

    if (payment.payment_status === status) {
      return NextResponse.json({ received: true, paymentId: payment.id, status: status as PaymentStatus, duplicate: true })
    }

    const { error: paymentError } = await supabase
      .from('payment_records')
      .update({
        payment_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    if (paymentError) {
      return NextResponse.json({ error: 'Payment event could not be recorded.' }, { status: 500 })
    }

    const bookingStatus = status === 'paid' ? 'confirmed' : 'pending'
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.booking_id)

    if (bookingError) {
      return NextResponse.json({ error: 'Payment recorded but booking update failed.' }, { status: 500 })
    }

    return NextResponse.json({ received: true, paymentId: payment.id, status: status as PaymentStatus, reference })
  }

  if (legacySignature && validLegacySignature(rawBody, legacySignature)) {
    let body: { paymentId?: unknown; status?: unknown; reference?: unknown }

    try {
      body = JSON.parse(rawBody) as { paymentId?: unknown; status?: unknown; reference?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid payment event payload.' }, { status: 400 })
    }

    const paymentId = typeof body.paymentId === 'string' ? body.paymentId : ''
    const status = providerEventStatus(body.status)
    const reference = typeof body.reference === 'string' ? body.reference.slice(0, 120) : undefined

    if (!paymentId || !status) {
      return NextResponse.json({ error: 'Invalid payment event.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: payment, error: paymentLookupError } = await supabase
      .from('payment_records')
      .select('id, booking_id, payment_status')
      .eq('id', paymentId)
      .maybeSingle()

    if (paymentLookupError) {
      return NextResponse.json({ error: 'Payment lookup failed.' }, { status: 500 })
    }

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    }

    if (payment.payment_status === status) {
      return NextResponse.json({ received: true, paymentId, status: status as PaymentStatus, duplicate: true })
    }

    const { error: paymentError } = await supabase
      .from('payment_records')
      .update({
        payment_status: status,
        transaction_reference: reference || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)

    if (paymentError) {
      return NextResponse.json({ error: 'Payment event could not be recorded.' }, { status: 500 })
    }

    const bookingStatus = status === 'paid' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : 'pending'
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status: bookingStatus,
        payment_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.booking_id)

    if (bookingError) {
      return NextResponse.json({ error: 'Payment recorded but booking update failed.' }, { status: 500 })
    }

    return NextResponse.json({ received: true, paymentId, status: status as PaymentStatus })
  }

  return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
}
