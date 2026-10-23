import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

type SearchParams = Promise<{ next?: string; error?: string }>

function safeNextPath(next?: string) {
  if (!next) return '/dashboard'
  const isInternal =
    next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
  return isInternal ? next : '/dashboard'
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const nextPath = safeNextPath(params.next)

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link className="wordmark dark-mark" href="/">
          <img
            className="wordmark-logo auth-logo"
            src="/images/zurura-team-safaris-logo.jpeg"
            alt="Zurura Team Safaris"
          />
        </Link>

        <p className="eyebrow">Your private safari desk</p>
        <h1>
          Welcome
          <br />
          <i>back.</i>
        </h1>
        <p className="auth-intro">
          Sign in to view your safari plans, enquiries, and profile.
        </p>

        <AuthForm
          mode="login"
          nextPath={nextPath}
          initialError={params.error}
        />

        <div className="auth-links">
          <Link href="/auth/signup">Create an account</Link>
          <Link href="/auth/recover">Forgot password?</Link>
        </div>
      </div>
    </main>
  )
}
