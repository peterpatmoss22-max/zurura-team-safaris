'use client'

import { useState } from 'react'
import { AccommodationSection } from '@/components/accommodation-section'
import { CarHireSection } from '@/components/car-hire-section'
import { FloatingWhatsApp, WhatsAppCta } from '@/components/whatsapp-cta'

type BookingStep = 'trip' | 'travelers' | 'details' | 'payment' | 'confirmation'

type BookingData = {
  trip: string
  date: string
  duration: string
  guests: number
  accommodation: string
  transport: string
  addOns: string[]
  name: string
  email: string
}

const bookingSteps: { id: BookingStep; label: string }[] = [
  { id: 'trip', label: 'Trip' },
  { id: 'travelers', label: 'Travelers' },
  { id: 'details', label: 'Details' },
  { id: 'payment', label: 'Payment' },
]

const bookingPrices = { base: 4200, traveler: 1850, addOns: { coast: 680, photography: 240 } } as const

const itineraries = [
  {
    slug: 'great-migration', title: 'The Great Migration',
    meta: '8 days · Masai Mara',
    description: 'Track the herds across the Mara, with time to watch, listen, and let the day unfold.',
    image: '/images/elephants-savannah.jpg',
    tag: 'Signature',
  },
  {
    slug: 'northern-wilds', title: 'Northern Wilds',
    meta: '10 days · Samburu & Laikipia',
    description: 'Head north for red earth, open country, and close encounters with Kenya’s rare wildlife.',
    image: '/images/journeys-vehicle.jpg',
    tag: 'Off the map',
  },
  {
    slug: 'family-safari', title: 'The Family Safari',
    meta: '7 days · Amboseli & Tsavo',
    description: 'A relaxed route through Amboseli and Tsavo, planned around curious young travellers and unhurried days.',
    image: '/images/giraffe-encounter.jpg',
    tag: 'For families',
  },
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [bookingStep, setBookingStep] = useState<BookingStep>('trip')
  const [bookingError, setBookingError] = useState('')
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingReference, setBookingReference] = useState('')
  const [bookingData, setBookingData] = useState<BookingData>({ trip: itineraries[0].title, date: '', duration: '8 days', guests: 2, accommodation: 'Lodge & tented camp', transport: 'Private 4x4', addOns: [], name: '', email: '' })

  const handleNavClick = () => setMenuOpen(false)
  const openBooking = (trip = itineraries[0].title) => { setBookingData((current) => ({ ...current, trip })); setBookingStep('trip'); setBookingError(''); setBookingOpen(true) }
  const closeBooking = () => setBookingOpen(false)
  const updateBooking = <K extends keyof BookingData>(key: K, value: BookingData[K]) => setBookingData((current) => ({ ...current, [key]: value }))
  const bookingTotal = bookingPrices.base + bookingData.guests * bookingPrices.traveler + (bookingData.addOns.includes('coast') ? bookingPrices.addOns.coast : 0) + (bookingData.addOns.includes('photography') ? bookingPrices.addOns.photography : 0)

  const nextBookingStep = () => {
    setBookingError('')
    if (bookingStep === 'trip' && !bookingData.date) return setBookingError('Choose an arrival date to continue.')
    if (bookingStep === 'details' && (!bookingData.name.trim() || !bookingData.email.trim())) return setBookingError('Add your name and email so we can prepare your itinerary.')
    const currentIndex = bookingSteps.findIndex((step) => step.id === bookingStep)
    setBookingStep(bookingSteps[currentIndex + 1]?.id ?? 'confirmation')
  }
  const previousBookingStep = () => { setBookingError(''); const currentIndex = bookingSteps.findIndex((step) => step.id === bookingStep); setBookingStep(bookingSteps[currentIndex - 1]?.id ?? 'trip') }
  const submitBooking = async () => {
    setBookingError('')
    setBookingSubmitting(true)
    try {
      const idempotencyKey = crypto.randomUUID()
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bookingData, idempotencyKey }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'We could not save your booking.')
      setBookingReference(result.booking.booking_reference)
      setBookingStep('confirmation')
    } catch (error) { setBookingError(error instanceof Error ? error.message : 'We could not save your booking. Please try again.') } finally { setBookingSubmitting(false) }
  }

  const handleInquirySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmissionError(false)
    setIsSubmitting(true)
    const form = event.currentTarget
    const payload = Object.fromEntries(new FormData(form).entries())
    try {
      const response = await fetch('/api/inquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error('Inquiry request failed')
      setSubmitted(true)
      form.reset()
    } catch {
      setSubmissionError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const itinerarySchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Zurura Team Safaris Kenya journeys',
    itemListElement: itineraries.map((item, index) => ({
      '@type': 'TouristTrip',
      position: index + 1,
      name: item.title,
      description: item.description,
      touristType: item.tag,
      itinerary: item.meta,
    })),
  }

  return (
    <main className="site-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itinerarySchema) }} />
      <section className="hero" id="top" aria-labelledby="hero-title">
        <nav className="nav container" aria-label="Main navigation">
          <a className="wordmark" href="#top" aria-label="Zurura Team Safaris home">
            <img className="wordmark-logo" src="/images/zurura-team-safaris-logo.jpeg" alt="Zurura Team Safaris" />
          </a>
          <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="primary-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>
            <span /> <span />
          </button>
          <div className={`nav-links ${menuOpen ? 'is-open' : ''}`} id="primary-navigation">
            <a href="#journeys" onClick={handleNavClick}>Journeys</a>
            <a href="#car-hire" onClick={handleNavClick}>Car hire</a>
            <a href="#story" onClick={handleNavClick}>Our Kenya</a>
            <a href="#journal" onClick={handleNavClick}>Field notes</a>
            <a className="nav-cta" href="#inquiry" onClick={handleNavClick}>Plan your safari <span>↗</span></a>
            <WhatsAppCta variant="link" label="WhatsApp Us" />
            <span className="auth-nav-controls" aria-label="Account access"><a className="auth-nav-button" href="/register">Register</a><a className="auth-nav-button auth-nav-button-primary" href="/login">Sign In</a></span>
          </div>
        </nav>
        <div className="hero-content container">
          <p className="eyebrow light">Privately guided journeys · Since 2008</p>
          <h1 id="hero-title">Go where the<br /><i>wild still is.</i></h1>
          <p className="hero-copy">Private and small-group safaris planned by people who know Kenya well, from the Mara grasslands to the coast.</p>
          <div className="hero-actions"><button className="button button-light" type="button" onClick={() => openBooking()}>Plan your safari <span>→</span></button><WhatsAppCta label="Book via WhatsApp" /></div>
        </div>
        <div className="hero-bottom container">
          <span className="scroll-note"><span className="scroll-line" /> Scroll to explore</span>
          <span className="hero-location">Masai Mara · Kenya <b>01 / 03</b></span>
        </div>
      </section>

      <section className="intro section container" aria-labelledby="intro-title">
        <div className="intro-label" role="img" aria-label="Travel with intention"><span className="sun-mark" aria-hidden="true">✳</span><p>Travel with intention</p></div>
        <div className="intro-copy"><p className="eyebrow">A different kind of safari</p><h2 id="intro-title">Come for the wildlife.<br /><i>Leave with a story.</i></h2><p>A good safari leaves room for the unexpected. We take the time to watch the light change, listen to our guides, and stay with the moments you will talk about long after you return.</p><a className="text-link" href="#story">Discover our approach <span>↗</span></a></div>
      </section>

      <section className="stats-strip"><div className="container stats"><div><strong>16</strong><span>years in the field</span></div><div><strong>28</strong><span>conservation partners</span></div><div><strong>4.9</strong><span>guest rating</span></div><div><strong>100%</strong><span>locally owned</span></div></div></section>

      <section className="journeys section container" id="journeys">
        <div className="section-heading"><div><p className="eyebrow">Find your wild</p><h2>Journeys worth<br /><i>remembering.</i></h2></div><p>These itineraries are starting points, not set menus. Tell us how you like to travel and we will shape the route around you.</p></div>
        <div className="journey-grid">{itineraries.map((item) => <article className="journey-card" key={item.title}><div className="card-image" role="img" aria-label={`${item.title} safari in Kenya`} style={{ backgroundImage: `url(${item.image})` }}><span aria-hidden="true">{item.tag}</span></div><div className="card-content"><p className="card-meta">{item.meta}</p><h3>{item.title}</h3><p>{item.description}</p><a className="arrow-link" href={`/safaris/${item.slug}`} aria-label={`Explore ${item.title}`}>Explore this journey <span aria-hidden="true">↗</span></a></div></article>)}</div>
      </section>

      <CarHireSection />

      <AccommodationSection />

      <section className="story section" id="story" aria-labelledby="story-title"><div className="story-image" role="img" aria-label="A lone acacia tree at sunset in Kenya" /><div className="story-copy"><p className="eyebrow">The Zurura Team SafarI difference</p><h2 id="story-title">Kenya is not a backdrop.<br /><i>It is the story.</i></h2><p>From morning chai to the last light over the escarpment, we make space for Kenya beyond the game drive. Our guides bring local knowledge, sharp eyes, and a real connection to home.</p><div className="story-signature">“The planning felt personal from the very first call.”<small>— A recent Zurura Team Safaris guest</small></div></div></section>

      <section className="journal section container" id="journal" aria-labelledby="journal-title"><div className="section-heading"><div><p className="eyebrow">From the field</p><h2 id="journal-title">Notes from<br /><i>the wild.</i></h2></div><a className="text-link" href="#inquiry">Read the journal <span>↗</span></a></div><div className="journal-grid"><article><div className="journal-img journal-img-1" role="img" aria-label="Elephants walking across Amboseli beneath Mount Kilimanjaro" /><p className="card-meta">Conservation ·</p><h3>Why space matters for Amboseli’s elephants</h3></article><article><div className="journal-img journal-img-2" role="img" aria-label="A Kenyan community guide in the field" /><p className="card-meta">Field notes ·</p><h3>Shooting range</h3></article></div></section>

      <section className="inquiry section" id="inquiry"><div className="container inquiry-inner"><div><p className="eyebrow light">Your story starts here</p><h2>Let&apos;s make<br /><i>it wild.</i></h2><p>Share a few details about the trip you have in mind. A safari designer will reply within two working days with thoughtful next steps.</p></div><form onSubmit={handleInquirySubmit} className="inquiry-form" aria-label="Safari enquiry form" aria-live="polite">{submitted ? <div className="success-message"><span aria-hidden="true">✳</span><h3>We&apos;ve got your note.</h3><p>Our team will be in touch soon.</p><button className="text-link inquiry-reset" type="button" onClick={() => { setSubmitted(false); setSubmissionError(false) }}>Send another note <span>↗</span></button></div> : <><label>Your name<input required name="name" autoComplete="name" placeholder="First and last name" /></label><label>Email address<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" /></label><label>Tell us about your dream safari<textarea required name="message" rows={3} placeholder="When would you like to travel? Who&apos;s coming?" /></label>{submissionError && <div className="form-error" role="alert" tabIndex={-1}><strong>We couldn&apos;t send your enquiry.</strong><span>Please check your connection and try again.</span><button className="text-link inquiry-retry" type="button" onClick={() => setSubmissionError(false)}>Try again <span>↗</span></button></div>}<button className="button button-gold" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? 'Sending note…' : 'Send your enquiry'} <span aria-hidden="true">→</span></button></>}</form></div></section>

      {bookingOpen && <div className="booking-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeBooking() }}><section className="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title"><button className="booking-close" type="button" onClick={closeBooking} aria-label="Close booking planner">×</button>{bookingStep === 'confirmation' ? <div className="booking-confirmation"><span className="booking-check" aria-hidden="true">✓</span><p className="eyebrow">Your safari is taking shape</p><h2 id="booking-title">We&apos;ve saved<br /><i>your plan.</i></h2><p>Your booking request is saved and a safari designer will review it shortly. Payment is not collected yet.</p>{bookingReference && <p className="booking-reference">Reference <strong>{bookingReference}</strong></p>}<button className="button button-dark" type="button" onClick={closeBooking}>Return to the site <span>↗</span></button></div> : <><div className="booking-header"><p className="eyebrow">Plan your safari</p><h2 id="booking-title">Make it <i>yours.</i></h2><p>Build a starting point, then let our team refine the details with you.</p></div><div className="booking-progress" aria-label={`Booking step ${bookingSteps.findIndex((step) => step.id === bookingStep) + 1} of ${bookingSteps.length}`}><span className="booking-progress-line" style={{ width: `${(bookingSteps.findIndex((step) => step.id === bookingStep) / (bookingSteps.length - 1)) * 100}%` }} />{bookingSteps.map((step, index) => <span className={step.id === bookingStep ? 'is-active' : index < bookingSteps.findIndex((current) => current.id === bookingStep) ? 'is-complete' : ''} key={step.id}><b>{index + 1}</b>{step.label}</span>)}</div><div className="booking-body"><div className="booking-fields">{bookingStep === 'trip' && <div className="booking-step-content"><h3>Where should we begin?</h3><label>Journey<select value={bookingData.trip} onChange={(event) => updateBooking('trip', event.target.value)}>{itineraries.map((item) => <option key={item.title}>{item.title}</option>)}</select></label><div className="booking-two-col"><label>Arrival date<input type="date" value={bookingData.date} onChange={(event) => updateBooking('date', event.target.value)} /></label><label>Duration<select value={bookingData.duration} onChange={(event) => updateBooking('duration', event.target.value)}><option>7 days</option><option>8 days</option><option>10 days</option><option>14 days</option></select></label></div></div>}{bookingStep === 'travelers' && <div className="booking-step-content"><h3>Who&apos;s coming along?</h3><label>Number of guests<input type="number" min="1" max="12" value={bookingData.guests} onChange={(event) => updateBooking('guests', Math.max(1, Math.min(12, Number(event.target.value))))} /></label><fieldset><legend>Accommodation</legend>{['Lodge & tented camp', 'Private villa'].map((option) => <label className="booking-choice" key={option}><input type="radio" name="accommodation" checked={bookingData.accommodation === option} onChange={() => updateBooking('accommodation', option)} /><span>{option}</span></label>)}</fieldset><fieldset><legend>Add to the journey</legend>{[['coast', 'Indian Ocean extension', bookingPrices.addOns.coast], ['photography', 'Photography guide', bookingPrices.addOns.photography]].map(([id, label, price]) => <label className="booking-choice" key={id as string}><input type="checkbox" checked={bookingData.addOns.includes(id as string)} onChange={(event) => updateBooking('addOns', event.target.checked ? [...bookingData.addOns, id as string] : bookingData.addOns.filter((item) => item !== id))} /><span>{label as string} <small>+${price as number}</small></span></label>)}</fieldset></div>}{bookingStep === 'details' && <div className="booking-step-content"><h3>How can we reach you?</h3><label>Your name<input autoComplete="name" value={bookingData.name} onChange={(event) => updateBooking('name', event.target.value)} placeholder="First and last name" /></label><label>Email address<input type="email" autoComplete="email" value={bookingData.email} onChange={(event) => updateBooking('email', event.target.value)} placeholder="you@example.com" /></label><p className="booking-note">We&apos;ll use these details only to prepare your safari plan.</p></div>}{bookingStep === 'payment' && <div className="booking-step-content"><h3>Review your starting point</h3><p className="booking-note">No payment is collected here. A safari designer will confirm availability and final pricing before anything is booked.</p><div className="booking-payment-placeholder"><span aria-hidden="true">◇</span><strong>Payment details come later</strong><small>This planner is for shaping your enquiry.</small></div></div>}{bookingError && <p className="booking-error" role="alert">{bookingError}</p>}<div className="booking-actions">{bookingStep !== 'trip' && <button className="button button-quiet" type="button" onClick={previousBookingStep}>Back</button>}<button className="button button-dark" type="button" onClick={bookingStep === 'payment' ? submitBooking : nextBookingStep} disabled={bookingSubmitting}>{bookingSubmitting ? 'Saving booking…' : bookingStep === 'payment' ? 'Send my plan' : 'Continue'} <span>→</span></button></div></div><aside className="booking-summary"><p className="eyebrow">Your starting point</p><strong>{bookingData.trip}</strong><div><span>{bookingData.duration}</span><span>{bookingData.guests} guests</span></div><hr /><div><span>Safari design fee</span><b>${bookingPrices.base.toLocaleString()}</b></div><div><span>Estimated travel</span><b>${(bookingData.guests * bookingPrices.traveler).toLocaleString()}</b></div>{bookingData.addOns.includes('coast') && <div><span>Coast extension</span><b>${bookingPrices.addOns.coast.toLocaleString()}</b></div>}{bookingData.addOns.includes('photography') && <div><span>Photography guide</span><b>${bookingPrices.addOns.photography.toLocaleString()}</b></div>}<hr /><div className="booking-total"><span>Starting estimate</span><b>${bookingTotal.toLocaleString()}</b></div><small>USD · subject to availability</small></aside></div></>}</section></div>}

      <FloatingWhatsApp />
      <footer className="footer"><div className="container footer-top"><a className="wordmark dark-mark" href="#top"><img className="wordmark-logo" src="/images/zurura-team-safaris-logo.jpeg" alt="Zurura Team Safaris" /></a><p>Thoughtful journeys through<br />the wild heart of Kenya.</p><div className="footer-links"><a href="#journeys">Journeys</a><a href="#car-hire">Car hire</a><a href="#story">Our Kenya</a><a href="#journal">Field notes</a><a href="#inquiry">Contact</a></div></div><div className="container footer-bottom"><span>© 2026 Zurura Team Safaris Kenya</span><span>Designed for the wild</span><span><a className="instagram-link" href="https://www.instagram.com/zururateamsafaris?stkn=dHd0cDM2bXB0bnJ4" target="_blank" rel="noreferrer" aria-label="Instagram"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg></a>&nbsp;Follow us&nbsp;</span></div></footer>
    </main>
  )
}
