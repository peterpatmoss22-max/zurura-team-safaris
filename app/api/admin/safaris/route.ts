import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const required = (value: unknown) => typeof value === 'string' && value.trim().length > 0

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
  const { data, error } = await supabase.from('safari_packages').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Unable to load packages.' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const { supabase, response } = await adminClient()
  if (response) return response
  const body = await request.json().catch(() => null)
  if (!body || !required(body.slug) || !required(body.title)) return NextResponse.json({ error: 'Slug and title are required.' }, { status: 400 })
  const payload = { ...body, slug: body.slug.trim().toLowerCase(), title: body.title.trim(), published: Boolean(body.published) }
  const { data, error } = await supabase.from('safari_packages').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'A package with this slug already exists.' : 'Unable to create package.' }, { status: error.code === '23505' ? 409 : 400 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, response } = await adminClient()
  if (response) return response
  const body = await request.json().catch(() => null)
  if (!body?.id || !required(body.title)) return NextResponse.json({ error: 'Package id and title are required.' }, { status: 400 })
  const { id, ...updates } = body
  const { data, error } = await supabase.from('safari_packages').update({ ...updates, title: updates.title.trim(), updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'Unable to update package.' }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(request: Request) {
  const { supabase, response } = await adminClient()
  if (response) return response
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Package id is required.' }, { status: 400 })
  const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('safari_package_id', id)
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'This package has booking history. Archive it instead of deleting it.' }, { status: 409 })
  const { error } = await supabase.from('safari_packages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Unable to delete package.' }, { status: 400 })
  return NextResponse.json({ success: true })
}
