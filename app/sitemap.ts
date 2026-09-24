import type { MetadataRoute } from 'next'
import { safariSlugs } from '@/lib/safari-data'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    ...safariSlugs.map((slug) => ({ url: `${siteUrl}/safaris/${slug}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 })),
  ]
}
