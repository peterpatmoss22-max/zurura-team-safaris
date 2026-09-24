import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Zurura Team Safaris | Private Kenya Safaris',
    template: '%s | Zurura Team Safaris',
  },
  description: 'Private and small-group Kenya safaris planned by people who know the Mara, Samburu, Amboseli, Tsavo, and the coast.',
  keywords: ['Kenya safari', 'private safari Kenya', 'Masai Mara safari', 'Samburu safari', 'family safari Kenya'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Zurura Team Safaris',
    title: 'Zurura Team Safaris | Private Kenya Safaris',
    description: 'Thoughtful private and small-group journeys through the wild heart of Kenya.',
    locale: 'en_KE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zurura Team Safaris | Private Kenya Safaris',
    description: 'Thoughtful private and small-group journeys through the wild heart of Kenya.',
  },
  robots: { index: true, follow: true },
  generator: 'v0.app',
} 

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'TouristTrip',
  name: 'Zurura Team Safaris',
  description: 'Private and small-group safari journeys through Kenya.',
  areaServed: { '@type': 'Country', name: 'Kenya' },
  knowsAbout: ['Kenya safaris', 'wildlife', 'conservation', 'Masai Mara', 'Samburu', 'Amboseli', 'Tsavo'],
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f0e8',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-[#f4f0e8]">
      <body className="antialiased">
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
