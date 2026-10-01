'use client'

const MEDICAL_EVACUATION_URL =
  'https://YOUR-MEDICAL-EVACUATION-PROVIDER.example'

const TRAVEL_INSURANCE_URL =
  'https://YOUR-TRAVEL-INSURANCE-PROVIDER.example'

const EMERGENCY_PHONE = '+254000000000'

export function TravelSupportSection() {
  return (
    <section
      id="travel-support"
      className="travel-support-section"
      aria-labelledby="travel-support-title"
    >
      <div className="travel-support-inner">
        <p className="eyebrow">Travel with confidence</p>

        <h2 id="travel-support-title">
          Travel support, before and during your safari
        </h2>

        <p className="travel-support-intro">
          Arrange comprehensive travel insurance before you travel. For urgent
          situations, medical evacuation support may be available subject to
          location, weather, provider availability, and the terms of your cover.
        </p>

        <div className="travel-support-grid">
          <article className="travel-support-card">
            <p className="travel-support-card-label">
              01 · Emergency support
            </p>

            <h3>Medical evacuation</h3>

            <p>
              Medical evacuation is intended for serious emergencies during
              your journey. Contact the provider directly for assistance and
              confirmation of availability.
            </p>

            <div className="travel-support-actions">
              <a
                className="button button-dark"
                href={MEDICAL_EVACUATION_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Evacuation information <span aria-hidden="true">↗</span>
              </a>

              <a
                className="travel-support-phone"
                href={`tel:${EMERGENCY_PHONE}`}
              >
                Emergency assistance: {EMERGENCY_PHONE}
              </a>
            </div>
          </article>

          <article className="travel-support-card">
            <p className="travel-support-card-label">
              02 · Before departure
            </p>

            <h3>Travel insurance</h3>

            <p>
              We recommend arranging comprehensive cover for medical treatment,
              evacuation, cancellation, interruption, baggage, and personal
              liability. Check the policy exclusions carefully.
            </p>

            <div className="travel-support-actions">
              <a
                className="button button-gold"
                href={TRAVEL_INSURANCE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get travel insurance <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>
        </div>

        <p className="travel-support-disclaimer">
          Zurura Team Safaris does not provide insurance or guarantee
          evacuation services. Availability and benefits depend on the
          selected provider and policy terms.
        </p>
      </div>
    </section>
  )
}
