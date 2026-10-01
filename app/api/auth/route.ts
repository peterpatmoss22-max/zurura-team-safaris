import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const action = typeof body?.action === 'string' ? body.action : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''

  if (action !== 'logout' && (!isValidEmail(email) || (action !== 'recover' && password.length < 8))) {
    return NextResponse.json(
      { error: action === 'recover' ? 'Enter a valid email address.' : 'Enter a valid email and password.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  if (action === 'signup') {
    if (fullName.length < 2) return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? new URL('/auth/callback', request.url).toString()}?next=/`,
      },
    })

    if (error) {
      const message = error.message.toLowerCase()
      return NextResponse.json(
        { error: message.includes('already') ? 'An account may already exist with this email.' : message.includes('weak') ? 'Please choose a stronger password.' : error.message },
        { status: 400 }
      )
    }

    if (data.user && data.session) {
      await supabase.from('profiles').upsert({ id: data.user.id, full_name: fullName, email })
    }

    return NextResponse.json({
      ok: true,
      authenticated: Boolean(data.session),
      message: data.session ? 'Account created.' : 'Check your email to confirm your account.',
    })
  }

  if (action === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = error.message.toLowerCase()
      return NextResponse.json(
        { error: message.includes('confirm') ? 'Please confirm your email before signing in.' : 'Invalid email or password.' },
        { status: 401 }
      )
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'recover') {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? new URL('/auth/callback', request.url).toString()}?next=/reset-password`,
    })

    if (error) {
      return NextResponse.json({ error: 'We could not start password recovery. Please try again.' }, { status: 400 })
    }

    return NextResponse.json({ message: 'If an account exists, password recovery instructions are on their way.' })
  }

  if (action === 'logout') {
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unsupported authentication action.' }, { status: 400 })
}
