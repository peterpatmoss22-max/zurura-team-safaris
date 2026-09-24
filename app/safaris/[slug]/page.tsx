import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { safariBySlug, safariPackages, safariSlugs } from '@/lib/safari-data'
import { FloatingWhatsApp, WhatsAppCta } from '@/components/whatsapp-cta'

export function generateStaticParams() {
  return safariSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const safari = safariBySlug(slug)
  if (!safari) return {}
  return { title: safari.title, description: safari.description, alternates: { canonical: `/safaris/${safari.slug}` }, openGraph: { title: `${safari.title} | Zurura Team Safaris`, description: safari.description, images: [{ url: safari.image, alt: safari.title }] } }
}

export default async function SafariDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const safari = safariBySlug(slug)
  if (!safari) notFound()
  const related = safariPackages.filter((item) => item.slug !== safari.slug)

  return <main className="detail-page">
    <header className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(18,35,27,.84), rgba(18,35,27,.22)), url(${safari.image})` }}>
      <nav className="detail-nav container" aria-label="Safari detail navigation"><a className="wordmark" href="/" aria-label="Zurura Team Safaris home"><img className="wordmark-logo" src="/images/zurura-team-safaris-logo.jpeg" alt="Zurura Team Safaris" /></a><a className="detail-back" href="/">Back to journeys <span aria-hidden="true">↗</span></a></nav>
      <div className="container detail-hero-content"><p className="eyebrow light">{safari.tag} · {safari.location}</p><h1>{safari.title}</h1><p>{safari.description}</p><div className="detail-hero-meta"><span>{safari.duration}</span><span>{safari.startingPrice}</span><div className="detail-hero-actions"><a className="button button-light" href="/#inquiry">Book this safari <span aria-hidden="true">→</span></a><WhatsAppCta safariName={safari.title} label="Book via WhatsApp" /></div></div></div>
    </header>

    <section className="detail-intro container"><div><p className="eyebrow">At a glance</p><h2>A route with<br /><i>room to breathe.</i></h2></div><div className="detail-facts"><div><span>Destination</span><strong>{safari.location}</strong></div><div><span>Best time</span><strong>{safari.bestTime}</strong></div><div><span>Travel style</span><strong>{safari.travelStyle}</strong></div></div></section>

    <div className="detail-layout container"><article className="detail-main"><section className="detail-section"><p className="eyebrow">The details</p><h2>What stays with you.</h2><ul className="highlight-grid">{safari.highlights.map((highlight) => <li key={highlight}><span aria-hidden="true">✳</span>{highlight}</li>)}</ul></section>
      <section className="detail-section" id="itinerary"><p className="eyebrow">Day by day</p><h2>A considered rhythm.</h2><div className="itinerary-list">{safari.itinerary.map((day) => <details key={day.day} open={day.day === safari.itinerary[0].day}><summary><span>{day.day}</span><strong>{day.title}</strong><b aria-hidden="true">+</b></summary><p>{day.description}</p></details>)}</div></section>
      <section className="detail-section detail-columns"><div><p className="eyebrow">Included</p><h3>In your journey</h3><ul className="plain-list">{safari.included.map((item) => <li key={item}><span aria-hidden="true">+</span>{item}</li>)}</ul></div><div><p className="eyebrow">Not included</p><h3>To arrange separately</h3><ul className="plain-list muted-list">{safari.excluded.map((item) => <li key={item}><span aria-hidden="true">—</span>{item}</li>)}</ul></div></section>
      <section className="detail-section stay-section"><div><p className="eyebrow">Stay & move</p><h2>The places between<br /><i>the wild.</i></h2></div><div className="stay-copy"><h3>Accommodation</h3><p>{safari.accommodation}</p><h3>Transport</h3><p>{safari.transport}</p></div></section>
      <section className="detail-section"><p className="eyebrow">Wildlife</p><h2>Who you may meet.</h2><div className="wildlife-list">{safari.wildlife.map((animal) => <span key={animal}>{animal}</span>)}</div></section>
      <section className="detail-section gallery-section"><p className="eyebrow">From the field</p><h2>See the feeling.</h2><div className="detail-gallery">{safari.gallery.map((image) => <div key={image.src} role="img" aria-label={image.alt} style={{ backgroundImage: `url(${image.src})` }} />)}</div></section>
      <section className="detail-section"><p className="eyebrow">Common questions</p><h2>Before you go.</h2><div className="faq-list">{safari.faq.map((item) => <details key={item.question}><summary>{item.question}<b aria-hidden="true">+</b></summary><p>{item.answer}</p></details>)}</div></section>
    </article>
    <aside className="detail-booking" aria-label="Safari booking panel"><p className="eyebrow">Start planning</p><h2>{safari.title}</h2><p className="detail-price">{safari.startingPrice}</p><p className="detail-booking-note">A starting point, not a set menu. We will shape the final details around your dates and interests.</p><a className="button button-dark" href="/#inquiry">Book this safari <span aria-hidden="true">→</span></a><WhatsAppCta safariName={safari.title} label="Book via WhatsApp" /><a className="detail-secondary-cta" href="/#inquiry">Customize this trip <span aria-hidden="true">↗</span></a><div className="booking-trust"><span aria-hidden="true">✳</span><p>Tell us what you are imagining and a safari designer will reply within two working days.</p></div></aside></div>

    <section className="related-safaris"><div className="container"><p className="eyebrow">Keep exploring</p><h2>More journeys<br /><i>to consider.</i></h2><div className="related-grid">{related.map((item) => <a href={`/safaris/${item.slug}`} className="related-card" key={item.slug}><div style={{ backgroundImage: `url(${item.image})` }} role="img" aria-label={item.title} /><span>{item.meta}</span><h3>{item.title}</h3></a>)}</div></div></section>
    <FloatingWhatsApp />
    <footer className="detail-footer"><a className="wordmark" href="/" aria-label="Zurura Team Safaris home"><img className="wordmark-logo" src="/images/zurura-team-safaris-logo.jpeg" alt="Zurura Team Safaris" /></a><span>Thoughtful journeys through the wild heart of Kenya.</span></footer>
  </main>
}
