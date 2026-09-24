import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const packageSlugs: Record<string, string> = {
  'The Great Migration': 'great-migration',
  'Northern Wilds': 'northern-wilds',
  'The Family Safari': 'family-safari',
}

const trustedPricing: Record<string, { base: number; traveler: number; options: Record<string, number> }> = {
  'great-migration': { base: 4200, traveler: 1850, options: { coast: 680, photography: 240 } },
  'northern-wilds': { base: 3900, traveler: 1650, options: { coast: 720, photography: 240 } },
  'family-safari': { base: 3600, traveler: 1250, options: { coast: 680, photography: 240 } },
}

function reference() {
  return `ZTS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in before submitting a booking.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle()
  const trip = typeof body.trip === 'string' ? body.trip.trim() : ''
  const slug = packageSlugs[trip]
  const date = typeof body.date === 'string' ? body.date : ''
  const guests = Number(body.guests)
  const durationDays = Number.parseInt(String(body.duration || '').replace(/\D/g, ''), 10)
  const name = typeof body.name === 'string' ? body.name.trim() : profile?.full_name?.trim() || ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : profile?.email?.trim().toLowerCase() || ''
  const accommodation = typeof body.accommodation === 'string' ? body.accommodation.trim() : ''
  const transport = typeof body.transport === 'string' ? body.transport.trim() : ''
  const addOns = Array.isArray(body.addOns) ? body.addOns.filter((item: unknown): item is string => typeof item === 'string') : []
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 100) : ''

  if (!slug || !trustedPricing[slug] || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`) < new Date(new Date().toISOString().slice(0, 10))) return NextResponse.json({ error: 'Choose a valid future travel date and safari package.' }, { status: 400 })
  if (!Number.isInteger(guests) || guests < 1 || guests > 12 || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 60) return NextResponse.json({ error: 'Check the number of travelers and trip duration.' }, { status: 400 })
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Add a valid customer name and email.' }, { status: 400 })
  const pricing = trustedPricing[slug]
  const validOptions = addOns.filter((option: string): option is keyof typeof pricing.options => Object.hasOwn(pricing.options, option))
  const baseAmount = pricing.base
  const additionalAmount = validOptions.reduce((sum: number, option: keyof typeof pricing.options) => sum + pricing.options[option], guests * pricing.traveler)
  const totalAmount = baseAmount + additionalAmount

  const { data: safari } = await supabase.from('safari_packages').select('id').eq('slug', slug).eq('published', true).maybeSingle()
  if (!safari) return NextResponse.json({ error: 'That safari is not currently available.' }, { status: 409 })

  if (idempotencyKey) {
    const { data: existing } = await supabase.from('bookings').select('booking_reference,status,payment_status,total_amount').eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing) return NextResponse.json({ booking: existing, duplicate: true }, { status: 200 })
  }

  const { data: reservedRow, error: reserveError } = await supabase.rpc('reserve_safari_availability', { p_safari_package_id: safari.id, p_travel_date: date, p_guests: guests }).maybeSingle()
  const reserved = reservedRow as { availability_id: string; remaining_spaces: number | null } | null
  if (reserveError || !reserved?.availability_id) return NextResponse.json({ error: 'That safari is not available for the selected date or group size.' }, { status: 409 })

  const { data: booking, error } = await supabase.from('bookings').insert({ user_id: user.id, safari_package_id: safari.id, booking_reference: reference(), arrival_date: date, duration_days: durationDays, guests, accommodation, transport, status: 'pending', currency: 'USD', total_amount: totalAmount, customer_name: name, customer_email: email, selected_options: validOptions, base_amount: baseAmount, additional_amount: additionalAmount, payment_status: 'unpaid', idempotency_key: idempotencyKey || null }).select('booking_reference,status,payment_status,total_amount').single()
  if (error) {
    await supabase.rpc('release_safari_availability', { p_availability_id: reserved.availability_id, p_guests: guests })
    if (error.code === '23505' && idempotencyKey) { const { data: existing } = await supabase.from('bookings').select('booking_reference,status,payment_status,total_amount').eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle(); if (existing) return NextResponse.json({ booking: existing, duplicate: true }) }
    return NextResponse.json({ error: 'We could not save your booking. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ booking }, { status: 201 })
}
