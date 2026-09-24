import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function adminClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) }
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
  if (role?.role !== 'admin') return { supabase, response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) }
  return { supabase, response: null }
}

export async function GET() {
  const { supabase, response } = await adminClient()
  if (response) return response
  const { data, error } = await supabase.from('safari_availability').select('id,safari_package_id,available_from,available_to,departure_time,capacity,booked_spaces,status,notes,safari_packages(title,slug)').order('available_from', { ascending: true })
  if (error) return NextResponse.json({ error: 'Unable to load availability.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const { supabase, response } = await adminClient()
  if (response) return response
  const body = await request.json().catch(() => null)
  const capacity = Number(body?.capacity)
  if (!body?.safari_package_id || !/^\d{4}-\d{2}-\d{2}$/.test(body.available_from) || !/^\d{4}-\d{2}-\d{2}$/.test(body.available_to) || body.available_to < body.available_from || !Number.isInteger(capacity) || capacity < 1) return NextResponse.json({ error: 'Choose a package, valid dates, and a capacity of at least 1.' }, { status: 400 })
  const { data, error } = await supabase.from('safari_availability').insert({ safari_package_id: body.safari_package_id, available_from: body.available_from, available_to: body.available_to, departure_time: body.departure_time || null, capacity, booked_spaces: 0, status: body.status === 'unavailable' ? 'unavailable' : 'available', notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : null }).select('id,safari_package_id,available_from,available_to,departure_time,capacity,booked_spaces,status,notes').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'An availability window already exists for these dates.' : 'Unable to create availability.' }, { status: error.code === '23505' ? 409 : 400 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, response } = await adminClient()
  if (response) return response
  const body = await request.json().catch(() => null)
  if (!body?.id) return NextResponse.json({ error: 'Availability id is required.' }, { status: 400 })
  const updates: Record<string, unknown> = {}
  for (const key of ['available_from', 'available_to', 'departure_time', 'status', 'notes']) if (key in body) updates[key] = body[key] || null
  if ('capacity' in body) { const capacity = Number(body.capacity); if (!Number.isInteger(capacity) || capacity < Number(body.booked_spaces ?? 0)) return NextResponse.json({ error: 'Capacity cannot be below booked spaces.' }, { status: 400 }); updates.capacity = capacity }
  const { data, error } = await supabase.from('safari_availability').update(updates).eq('id', body.id).select('id,safari_package_id,available_from,available_to,departure_time,capacity,booked_spaces,status,notes').single()
  if (error) return NextResponse.json({ error: 'Unable to update availability.' }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const { supabase, response } = await adminClient()
  if (response) return response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Availability id is required.' }, { status: 400 })
  const { data: row } = await supabase.from('safari_availability').select('booked_spaces').eq('id', id).maybeSingle()
  if ((row?.booked_spaces ?? 0) > 0) return NextResponse.json({ error: 'Booked availability cannot be deleted. Mark it unavailable instead.' }, { status: 409 })
  const { error } = await supabase.from('safari_availability').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to delete availability.' }, { status: 400 })
  return NextResponse.json({ success: true })
}
