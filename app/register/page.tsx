import { redirect } from 'next/navigation'

export default async function RegisterAlias({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams
  redirect(`/auth/signup${params.next ? `?next=${encodeURIComponent(params.next)}` : ''}`)
}
