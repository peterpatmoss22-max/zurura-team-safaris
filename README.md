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
      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingData, idempotencyKey }),
      })
      const bookingResult = await bookingResponse.json().catch(() => ({}))

      if (!bookingResponse.ok) {
        throw new Error(bookingResult.error || 'We could not save your booking.')
      }

      const bookingId = bookingResult?.booking?.id
      if (!bookingId) {
        throw new Error('Your booking was created, but payment could not be initialized.')
      }

      const paymentResponse = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, method: 'paystack' }),
      })
      const paymentResult = await paymentResponse.json().catch(() => ({}))

      if (!paymentResponse.ok) {
        throw new Error(paymentResult.error || 'Paystack payment could not be initialized.')
      }

      setBookingReference(bookingResult.booking.booking_reference)

      if (paymentResult.authorization_url) {
        window.location.href = paymentResult.authorization_url
        return
      }

      setBookingStep('confirmation')
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'We could not save your booking. Please try again.')
    } finally {
      setBookingSubmitting(false)
    }
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
            <span />
            <span />
            <span />
          </button>
          <div className={`nav-links ${menuOpen ? 'is-open' : ''}`} id="primary-navigation">
            <a href="#journeys" onClick={handleNavClick}>Journeys</a>
            <a href="#car-hire" onClick={handleNavClick}>Car hire</a>
            <a href="#story" onClick={handleNavClick}>Our Kenya</a>
            <a href="#journal" onClick={handleNavClick}>Field notes</a>
            <a className="nav-cta" href="#inquiry" onClick={handleNavClick}>Plan your safari <span>↗</span></a>
            <WhatsAppCta variant="link" label="WhatsApp Us" />
            <span className="auth-nav-controls" aria-label="Account access"><a className="auth-nav-button" href="/register">Register</a><a className="auth-nav-button auth-nav-button-primary" href="/login">Login</a></span>
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
        <div className="intro-copy"><p className="eyebrow">A different kind of safari</p><h2 id="intro-title">Come for the wildlife.<br /><i>Leave with a story.</i></h2><p>A good safari leaves room for wonder, not just logistics. We plan the time between places to feel like the journey itself.</p></div>
      </section>

      <section className="stats-strip"><div className="container stats"><div><strong>16</strong><span>years in the field</span></div><div><strong>28</strong><span>conservation partners</span></div><div><strong>92%</strong><span>return guests</span></div><div><strong>4.9/5</strong><span>guest rating</span></div></div></section>

      <section className="journeys section container" id="journeys">
        <div className="section-heading"><div><p className="eyebrow">Find your wild</p><h2>Journeys worth<br /><i>remembering.</i></h2></div><p>These itineraries are starting points, not set menus. We tailor pacing, stay style, and route to the way you travel.</p></div>
        <div className="journey-grid">{itineraries.map((item) => <article className="journey-card" key={item.title}><div className="card-image" role="img" aria-label={`${item.title} safari in Kenya`} style={{ backgroundImage: `url(${item.image})` }} /><div className="journey-card-copy"><span className="journey-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.meta}</p><p>{item.description}</p><button type="button" className="button button-primary" onClick={() => openBooking(item.title)}>Plan this trip</button></div></article>)}</div>
      </section>

      <CarHireSection />

      <AccommodationSection />

      <section className="story section" id="story" aria-labelledby="story-title"><div className="story-image" role="img" aria-label="A lone acacia tree at sunset in Kenya" /><div className="story-copy"><p className="eyebrow">Our Kenya</p><h2 id="story-title">A country that asks<br /><i>you to slow down.</i></h2><p>We build safari days around wildlife movement, local knowledge, and the rhythm of each place. The result is not rushed, and never generic.</p></div></section>

      <section className="journal section container" id="journal" aria-labelledby="journal-title"><div className="section-heading"><div><p className="eyebrow">From the field</p><h2 id="journal-title">Field notes<br /><i>from the road.</i></h2></div></div></section>

      <section className="inquiry section" id="inquiry"><div className="container inquiry-inner"><div><p className="eyebrow light">Your story starts here</p><h2>Let&apos;s make<br /><i>it wild.</i></h2></div><form onSubmit={handleInquirySubmit} className="inquiry-form">{submissionError ? <p className="form-error">Something went wrong. Please try again.</p> : null}<label><span>Name</span><input name="name" type="text" required /></label><label><span>Email</span><input name="email" type="email" required /></label><label><span>Tell us about your trip</span><textarea name="message" rows={4} required /></label><button type="submit" className="button button-light" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send inquiry'}</button></form></div></section>

      {bookingOpen && <div className="booking-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeBooking() }}><section className="booking-dialog" aria-label="Safari booking form"><div className="booking-header"><div><p className="eyebrow">Plan your safari</p><h3>{bookingData.trip}</h3></div><button type="button" className="close-button" onClick={closeBooking} aria-label="Close booking form">×</button></div><div className="booking-steps">{bookingSteps.map((step) => <span key={step.id} className={step.id === bookingStep ? 'is-active' : ''}>{step.label}</span>)}</div>{bookingStep === 'trip' && <div className="booking-panel"><label><span>Arrival date</span><input type="date" value={bookingData.date} onChange={(event) => updateBooking('date', event.target.value)} /></label><label><span>Trip duration</span><select value={bookingData.duration} onChange={(event) => updateBooking('duration', event.target.value)}><option value="8 days">8 days</option><option value="10 days">10 days</option><option value="7 days">7 days</option></select></label><label><span>Travelers</span><input type="number" min={1} max={12} value={bookingData.guests} onChange={(event) => updateBooking('guests', Number(event.target.value) || 1)} /></label></div>}{bookingStep === 'travelers' && <div className="booking-panel"><label><span>Accommodation style</span><select value={bookingData.accommodation} onChange={(event) => updateBooking('accommodation', event.target.value)}><option value="Lodge & tented camp">Lodge & tented camp</option><option value="Luxury lodge">Luxury lodge</option><option value="Private camp">Private camp</option></select></label><label><span>Transport</span><select value={bookingData.transport} onChange={(event) => updateBooking('transport', event.target.value)}><option value="Private 4x4">Private 4x4</option><option value="Safari van">Safari van</option><option value="Combination of both">Combination of both</option></select></label></div>}{bookingStep === 'details' && <div className="booking-panel"><label><span>Full name</span><input type="text" value={bookingData.name} onChange={(event) => updateBooking('name', event.target.value)} /></label><label><span>Email address</span><input type="email" value={bookingData.email} onChange={(event) => updateBooking('email', event.target.value)} /></label><label><span>Add-ons</span><div className="inline-checks"><label><input type="checkbox" checked={bookingData.addOns.includes('coast')} onChange={(event) => updateBooking('addOns', event.target.checked ? [...bookingData.addOns, 'coast'] : bookingData.addOns.filter((item) => item !== 'coast'))} /> Coast extension</label><label><input type="checkbox" checked={bookingData.addOns.includes('photography')} onChange={(event) => updateBooking('addOns', event.target.checked ? [...bookingData.addOns, 'photography'] : bookingData.addOns.filter((item) => item !== 'photography'))} /> Photography add-on</label></div></label></div>}{bookingStep === 'payment' && <div className="booking-panel"><h4>Review your booking</h4><p>{bookingData.guests} travelers · {bookingData.date}</p><p>{bookingData.trip}</p><p>Total: KES {bookingTotal.toLocaleString()}</p><p>Pay securely with Paystack.</p></div>}{bookingStep === 'confirmation' && <div className="booking-panel"><h4>Booking received</h4><p>Your booking reference is <strong>{bookingReference}</strong>.</p><p>We will confirm the details and send the itinerary to {bookingData.email}.</p></div>}{bookingError && <p className="form-error">{bookingError}</p>}<div className="booking-actions"><button type="button" className="button button-secondary" onClick={previousBookingStep} disabled={bookingStep === 'trip' || bookingStep === 'confirmation'}>Back</button>{bookingStep !== 'confirmation' ? <button type="button" className="button button-primary" onClick={bookingStep === 'payment' ? submitBooking : nextBookingStep} disabled={bookingSubmitting}>{bookingSubmitting ? 'Processing...' : bookingStep === 'payment' ? 'Pay with Paystack' : 'Continue'}</button> : <button type="button" className="button button-primary" onClick={closeBooking}>Close</button>}</div></section></div>}

      <FloatingWhatsApp />
      <footer className="footer"><div className="container footer-top"><a className="wordmark dark-mark" href="#top"><img className="wordmark-logo" src="/images/zurura-team-safaris-logo.jpeg" alt="Zurura Team Safaris" /></a><div className="footer-links"><a href="#journeys">Journeys</a><a href="#story">Our Kenya</a><a href="#inquiry">Inquire</a></div></div></footer>
    </main>
  )
}






















































































"}, {