'use client'

import StarRating from './star-rating';
import { WhatsAppCta } from '@/components/whatsapp-cta'

const vehicles = [
  {
    image: '/images/car-hire-minibus.jpeg',
    alt: 'White safari minibus parked beneath a bright Kenyan sky',
    label: 'Safari minibus',
    description: 'A comfortable option for group travel and guided days on the road.',
  },
  {
    image: '/images/car-hire-lineup.jpeg',
    alt: 'Lineup of vehicles outside a lodge',
    label: 'Travel vehicles',
    description: 'Ask about the right vehicle for your route, group and travel plans.',
  },
  {
    image: '/images/safari-vehicle-rear.jpg',
    alt: 'Safari vehicle ready for a journey in Kenya',
    label: 'Safari vehicle',
    description: 'A practical way to explore Kenya with a little more freedom.',
  },
]

export function CarHireSection() {
  return (
    <section className="car-hire section container" id="car-hire" aria-labelledby="car-hire-title">
      <div className="section-heading car-hire-heading">
        <div>
          <p className="eyebrow">Travel your way</p>
          <h2 id="car-hire-title">Car <i>hire.</i></h2>
        </div>
        <p>Explore Kenya at your own pace with a vehicle for your safari, business travel or personal adventure. Get in touch to find the right option for your journey.</p>
      </div>
      <div className="car-hire-grid">
        {vehicles.map((vehicle) => (
          <article className="car-hire-card" key={vehicle.image}>
            <div className="car-hire-image" role="img" aria-label={vehicle.alt} style={{ backgroundImage: `url(${vehicle.image})` }} />
            <div className="car-hire-content">
              <p className="card-meta">Available on enquiry</p>
              <h3>{vehicle.label}</h3>
              <p>{vehicle.description}</p>
              <StarRating totalStars={5} />
              <WhatsAppCta label="Enquire about car hire" carHireType={vehicle.label} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
