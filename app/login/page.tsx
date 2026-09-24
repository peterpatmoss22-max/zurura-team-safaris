import { redirect } from 'next/navigation'

export default async function LoginAlias({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams
  redirect(`/auth${params.next ? `?next=${encodeURIComponent(params.next)}` : ''}`)
}
