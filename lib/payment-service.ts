import { createClient } from '@/lib/supabase/server'

export type PaymentMethod = 'mpesa' | 'card' | 'bank_transfer' | 'other'
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export type PaymentRequest = {
  bookingId: string
  method: PaymentMethod
}

export function paymentMode() {
  return process.env.PAYMENT_MODE === 'live' ? 'live' : 'test'
}

export async function createPendingPayment({ bookingId, method }: PaymentRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Authentication required.', status: 401 as const }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, total_amount, currency, status, payment_status')
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (bookingError || !booking) return { error: 'Booking not found.', status: 404 as const }
  if (booking.payment_status === 'paid') return { error: 'This booking has already been paid.', status: 409 as const }

  const { data: payment, error } = await supabase
    .from('payment_records')
    .insert({
      booking_id: booking.id,
      amount: booking.total_amount ?? 0,
      currency: booking.currency ?? 'USD',
      payment_method: method,
      payment_status: 'pending',
      provider: paymentMode() === 'test' ? 'test' : method === 'mpesa' ? 'mpesa' : 'card',
      metadata: { mode: paymentMode() },
    })
    .select('id, booking_id, amount, currency, payment_method, payment_status, provider, created_at')
    .single()

  if (error) return { error: 'We could not start payment. Please try again.', status: 500 as const }

  await supabase.from('bookings').update({ payment_status: 'pending', status: 'pending' }).eq('id', booking.id).eq('user_id', user.id)
  return { payment, mode: paymentMode(), status: 201 as const }
}

export function providerEventStatus(value: unknown): PaymentStatus | null {
  if (value === 'paid' || value === 'processing' || value === 'failed' || value === 'cancelled' || value === 'refunded' || value === 'pending') return value
  return null
}

export async function applyVerifiedPaymentUpdate(paymentId: string, status: PaymentStatus, reference?: string) {
  const supabase = await createClient()
  const { data: payment, error } = await supabase
    .from('payment_records')
    .update({ payment_status: status, transaction_reference: reference || null, updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select('id, booking_id, payment_status')
    .single()
  if (error || !payment) return { error: 'Payment record not found.', status: 404 as const }

  const bookingStatus = status === 'paid' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : status === 'failed' ? 'pending' : 'pending'
  const paymentStatus = status === 'paid' ? 'paid' : status
  const { error: bookingError } = await supabase.from('bookings').update({ status: bookingStatus, payment_status: paymentStatus, updated_at: new Date().toISOString() }).eq('id', payment.booking_id)
  if (bookingError) return { error: 'Payment was recorded but booking status could not be updated.', status: 500 as const }
  return { payment, status: 200 as const }
}
