import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const statuses = ['inquiry', 'pending', 'confirmed', 'cancelled', 'completed'] as const
type Status = typeof statuses[number]

async function getAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (role?.role !== 'admin') return { supabase, user: null, response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) }
  return { supabase, user, response: null }
}

export async function GET(request: Request) {
  const { supabase, response } = await getAdmin()
  if (response) return response
  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim() || ''
  const status = params.get('status')
  let builder = supabase.from('bookings').select('id,booking_reference,customer_name,customer_email,arrival_date,duration_days,guests,accommodation,transport,status,payment_status,currency,total_amount,created_at,safari_packages(title,slug)').order('created_at', { ascending: false }).limit(100)
  if (status && statuses.includes(status as Status)) builder = builder.eq('status', status)
  if (query) builder = builder.or(`booking_reference.ilike.%${query}%,customer_name.ilike.%${query}%,customer_email.ilike.%${query}%`)
  const { data, error } = await builder
  if (error) return NextResponse.json({ error: 'Unable to load bookings.' }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function PATCH(request: Request) {
  const { supabase, user, response } = await getAdmin()
  if (response || !user) return response
  const body = await request.json().catch(() => null)
  const nextStatus = body?.status as Status
  if (!body?.id || !statuses.includes(nextStatus)) return NextResponse.json({ error: 'Booking and valid status are required.' }, { status: 400 })
  if (nextStatus === 'confirmed') return NextResponse.json({ error: 'Bookings are confirmed by a verified payment webhook.' }, { status: 409 })
  const { data: booking } = await supabase.from('bookings').select('id,user_id,status,booking_reference,customer_email,total_amount,currency').eq('id', body.id).single()
  if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
  const allowed: Record<Status, Status[]> = { inquiry: ['pending', 'cancelled'], pending: ['cancelled'], confirmed: ['completed', 'cancelled'], cancelled: [], completed: [] }
  if (!allowed[booking.status as Status]?.includes(nextStatus)) return NextResponse.json({ error: `Cannot move a ${booking.status} booking to ${nextStatus}.` }, { status: 409 })
  const { data: updated, error } = await supabase.from('bookings').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', booking.id).select('id,booking_reference,status,payment_status,total_amount').single()
  if (error) return NextResponse.json({ error: 'Unable to update booking.' }, { status: 500 })
  await supabase.from('booking_status_history').insert({ booking_id: booking.id, actor_user_id: user.id, from_status: booking.status, to_status: nextStatus, note: typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null })
  if (['cancelled', 'completed'].includes(nextStatus)) await supabase.from('notification_events').insert({ user_id: booking.user_id, booking_id: booking.id, event_type: `booking_${nextStatus}`, payload: { bookingReference: booking.booking_reference, customerEmail: booking.customer_email, totalAmount: booking.total_amount, currency: booking.currency } })
  return NextResponse.json({ data: updated })
}
