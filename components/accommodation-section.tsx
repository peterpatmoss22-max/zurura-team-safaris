'use client'

import { WhatsAppCta } from './whatsapp-cta'

const accommodations = [
  {
    id: 'living',
    image: '/images/accommodation-living-room.jpg',
    alt: 'Comfortable living room with fireplace and seating area'
  },
  {
    id: 'bedroom',
    image: '/images/accommodation-bedroom.jpg',
    alt: 'Bright bedroom with views overlooking lush green landscape'
  },
  {
    id: 'entry',
    image: '/images/accommodation-entry.jpg',
    alt: 'Spacious entry and dining area with natural light'
  }
]

export function AccommodationSection() {
  return (
    <section className="accommodation section container" id="accommodation" aria-labelledby="accommodation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Extend your journey</p>
          <h2 id="accommodation-title">
            Accommodation<br />
            <i>booking.</i>
          </h2>
        </div>
        <p>Find the right place to stay for your safari. Explore selected accommodation options and book your stay with Zurura Team Safaris.</p>
      </div>

      <div className="accommodation-grid">
        {accommodations.map((accommodation) => (
          <article key={accommodation.id} className="accommodation-card">
            <div
              className="accommodation-image"
              role="img"
              aria-label={accommodation.alt}
              style={{ backgroundImage: `url(${accommodation.image})` }}
            />
            <div className="accommodation-content">
              <WhatsAppCta
                label="Enquire about accommodation"
                accommodationType="selected accommodation"
                variant="button"
              />
            </div>
          </article>
        ))}
      </div>

      <div className="accommodation-footer">
        <p className="accommodation-promo">Special accommodation offers coming soon</p>
      </div>
    </section>
  )
}
