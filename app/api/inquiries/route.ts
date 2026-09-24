import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (name.length < 2 || name.length > 120 || !isValidEmail(email) || message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: 'Please provide a valid name, email, and message.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('contact_inquiries').insert({ name, email, message, user_id: user?.id ?? null })
  if (error) return NextResponse.json({ error: 'We could not save your inquiry. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
