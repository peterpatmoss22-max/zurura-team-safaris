import { createClient } from '@/lib/supabase/server'
import type { SafariPackage } from '@/lib/safari-data'

const asArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const asGallery = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => typeof item === 'object' && item && 'src' in item && typeof item.src === 'string' ? [{ src: item.src, alt: typeof item.alt === 'string' ? item.alt : 'Safari landscape' }] : []) : []
const asFaq = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => typeof item === 'object' && item && 'question' in item && 'answer' in item && typeof item.question === 'string' && typeof item.answer === 'string' ? [{ question: item.question, answer: item.answer }] : []) : []

export function normalizeSafariPackage(row: Record<string, unknown>): SafariPackage {
  const durationDays = typeof row.duration_days === 'number' ? row.duration_days : 8
  const startingPrice = typeof row.starting_price === 'number' ? row.starting_price : 4200
  return {
    slug: String(row.slug ?? ''), title: String(row.title ?? 'Untitled safari'), meta: String(row.meta ?? `${durationDays} days`), description: String(row.description ?? ''), image: String(row.hero_image_url ?? ''), tag: String(row.tag ?? 'Safari'), location: String(row.location ?? 'Kenya'), duration: String(row.duration ?? `${durationDays} days / ${Math.max(durationDays - 1, 1)} nights`), startingPrice: `From $${startingPrice.toLocaleString()} per guest`, bestTime: String(row.best_time ?? 'Year-round'), travelStyle: String(row.travel_style ?? 'Private safari'), highlights: asArray(row.highlights), itinerary: Array.isArray(row.itinerary) ? row.itinerary.flatMap((item) => typeof item === 'object' && item && typeof item.day === 'string' && typeof item.title === 'string' ? [{ day: item.day, title: item.title, description: typeof item.description === 'string' ? item.description : '' }] : []) : [], included: asArray(row.included), excluded: asArray(row.excluded), accommodation: String(row.accommodation ?? ''), transport: String(row.transport ?? ''), wildlife: asArray(row.wildlife), gallery: asGallery(row.gallery), faq: asFaq(row.faq),
  }
}

export async function getPublishedSafaris() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('safari_packages').select('*').eq('published', true).order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => normalizeSafariPackage(row as Record<string, unknown>))
}

export async function getPublishedSafari(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('safari_packages').select('*').eq('slug', slug).eq('published', true).maybeSingle()
  if (error) throw error
  return data ? normalizeSafariPackage(data as Record<string, unknown>) : null
}

export async function getAdminSafaris() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('safari_packages').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function fallbackSafari(slug: string) {
  return import('@/lib/safari-data').then(({ safariBySlug }) => safariBySlug(slug) ?? null)
}
