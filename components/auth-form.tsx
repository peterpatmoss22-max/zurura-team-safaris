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
            emailRedirectTo: (() => { const redirect = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`; const separator = redirect.includes('?') ? '&' : '?'; return `${redirect}${separator}next=${encodeURIComponent(next)}`; })(),
          },
        })
        if (error) throw new Error(error.message.toLowerCase().includes('already') ? 'An account may already exist with this email.' : error.message.toLowerCase().includes('weak') ? 'Choose a stronger password.' : error.message)
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

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      })
      if (error) throw new Error(error.message)
      if (data.url) {
        window.location.href = data.url
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Failed to sign in with ${provider}.`)
      setLoading(false)
    }
  }

  return <form className="auth-form" onSubmit={submit} noValidate>
    {mode === 'signup' && <label>Full name<input name="fullName" autoComplete="name" required minLength={2} /></label>}
    <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
    {mode !== 'recover' && <label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="toggle-password">{showPassword ? '👁️' : '👁️‍🗨️'}</button></div></label>}
    {mode === 'login' && <div className="auth-options"><label className="checkbox-label"><input type="checkbox" name="remember" /> Remember me</label><a href="/auth/recover">Forgot password?</a></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="auth-message" role="status">{message}</p>}
    <button type="submit" className="button button-dark" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send recovery email'} <span>→</span></button>
    
    {(mode === 'login' || mode === 'signup') && (
      <>
        <div className="divider">
          <span>Or continue with</span>
        </div>
        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-button google-button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={loading}
          >
            <svg className="oauth-icon" viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
          <button
            type="button"
            className="oauth-button apple-button"
            onClick={() => handleOAuthSignIn('apple')}
            disabled={loading}
          >
            <svg className="oauth-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17.05 13.5c-.91 0-1.8.53-2.55 1.5.9 1.14 1.92 2.66 1.92 4.5 0 2.66-1.85 4-4.42 4-.48 0-1.05-.08-1.47-.15.28-.43.56-.93.8-1.47.72.08 1.3.15 1.67.15 1.75 0 2.92-.83 2.92-2.53 0-1.46-.75-2.78-1.66-3.86.64-1.06 1.53-1.73 2.76-1.73 1.96 0 3.73 1.36 4.09 3.23.16.85.37 1.66.64 2.45.72-2.45 1.18-5.07 1.18-7.82 0-7.38-5.62-13.33-12.5-13.33-6.88 0-12.5 5.95-12.5 13.33S5.12 19.33 12 19.33c1.42 0 2.79-.2 4.09-.56-.27-.77-.48-1.59-.64-2.43-.36 1.87-2.13 3.23-4.09 3.23Z"/>
            </svg>
            Apple
          </button>
        </div>
      </>
    )}
  </form>
}
