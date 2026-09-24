'use client'

type WhatsAppCtaProps = {
  label?: string
  safariName?: string
  carHireType?: string
  accommodationType?: string
  destination?: string
  travelDates?: string
  travelers?: number
  variant?: 'button' | 'floating' | 'link'
  className?: string
}

const whatsappNumber = '254751873809'
const generalMessage = 'Hello Zurura Team Safaris! I would like to book a safari. Please help me with the available options, dates and pricing.'
const carHireMessage = 'Hello Zurura Team Safaris! I am interested in your car hire services. Please help me with the available vehicles, pricing and booking details.'
const accommodationMessage = 'Hello Zurura Team Safaris! I am interested in booking accommodation. Please help me with the available options, prices and booking details.'

function buildMessage({ safariName, carHireType, accommodationType, destination, travelDates, travelers }: Pick<WhatsAppCtaProps, 'safariName' | 'carHireType' | 'accommodationType' | 'destination' | 'travelDates' | 'travelers'>) {
  let message = carHireType
    ? `Hello Zurura Team Safaris! I am interested in hiring the ${carHireType}. Please share the availability, pricing and booking details.`
    : accommodationType
    ? accommodationMessage
    : safariName
      ? `Hello Zurura Team Safaris! I am interested in booking the ${safariName}. I would like to know more about availability, dates and pricing.`
      : destination
      ? `Hello Zurura Team Safaris! I am interested in planning a trip to ${destination}. Please help me with available safari options, dates and pricing.`
      : generalMessage

  const details = [travelDates && `My preferred dates are ${travelDates}`, travelers && `${travelers} traveler${travelers === 1 ? '' : 's'}`].filter(Boolean)
  if (details.length) message += ` ${details.join('. ')}.`
  return message
}

export function WhatsAppCta({ label = 'Book via WhatsApp', safariName, carHireType, accommodationType, destination, travelDates, travelers, variant = 'button', className = '' }: WhatsAppCtaProps) {
  const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildMessage({ safariName, carHireType, accommodationType, destination, travelDates, travelers }))}`
  const classes = `whatsapp-cta whatsapp-cta-${variant} ${className}`.trim()

  return (
    <a className={classes} href={href} target="_blank" rel="noopener noreferrer" data-event-name="whatsapp_booking_click" aria-label={`${label} — opens WhatsApp`}>
      <span className="whatsapp-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.08 0C5.57 0 .28 5.29.28 11.8c0 2.08.54 4.12 1.56 5.93L.18 24l6.42-1.63a11.78 11.78 0 0 0 5.48 1.35h.01c6.5 0 11.79-5.29 11.79-11.8 0-3.15-1.2-6.12-3.38-8.42ZM12.1 21.73h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.81.97 1.02-3.71-.23-.38a9.9 9.9 0 1 1 8.44 4.71Zm5.43-7.42c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.52.07-.8.37-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.49 1.72.63.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.58-.35Z" /></svg></span><span>{label}</span>
    </a>
  )
}

export function FloatingWhatsApp() {
  return <WhatsAppCta variant="floating" label="Chat with us on WhatsApp" />
}

export { generalMessage }
