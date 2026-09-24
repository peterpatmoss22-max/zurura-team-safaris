'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'recover'

export function AuthForm({ mode, nextPath = '/dashboard', initialError = '' }: { mode: Mode; nextPath?: string; initialError?: string }) {
  const router = useRouter()
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const next = nextPath.startsWith('/') ? nextPath : '/dashboard'

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    body.action = mode
    try {
      if (mode === 'login') {
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({ email: String(body.email), password: String(body.password) })
        if (error) throw new Error(error.message.toLowerCase().includes('confirm') ? 'Please confirm your email before signing in.' : 'Invalid email or password.')
        router.replace(next)
        router.refresh()
        return
      }
      if (mode === 'signup') {
        const supabase = createClient()
        const { data, error } = await supabase.auth.signUp({
          email: String(body.email),
          password: String(body.password),
          options: {
            data: { full_name: String(body.fullName) },
            emailRedirectTo: (() => { const redirect = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`; const separator = redirect.includes('?') ? '&' : '?'; return `${redirect}${separator}next=${encodeURIComponent(next)}` })(),
          },
        })
        if (error) throw new Error(error.message.toLowerCase().includes('already') ? 'An account may already exist with this email.' : error.message.toLowerCase().includes('weak') ? 'Choose a stronger password.' : 'We could not create your account. Please check your details.')
        if (data.session) {
          router.replace(next)
          router.refresh()
          return
        }
        setMessage('Account created. Check your email to confirm your account, then sign in.')
        return
      }
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Something went wrong.')
      setMessage(result.message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    {mode === 'signup' && <label>Full name<input name="fullName" autoComplete="name" required minLength={2} /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
    {mode !== 'recover' && <label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>}
    {mode === 'login' && <div className="auth-options"><label className="checkbox-label"><input type="checkbox" name="remember" /> Remember me</label><a href="/auth/recover">Forgot password?</a></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="auth-message" role="status">{message}</p>}
    <button className="button button-dark" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send recovery email'} <span>→</span></button>
  </form>
}
