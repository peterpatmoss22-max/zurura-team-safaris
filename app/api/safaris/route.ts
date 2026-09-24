import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('safari_packages').select('id, slug, title, tag, meta, description, hero_image_url, starting_price, duration_days').eq('published', true).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Unable to load safari packages.' }, { status: 500 })
  return NextResponse.json({ data })
}
