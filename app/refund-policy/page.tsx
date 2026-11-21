import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Refund & Cancellation Policy', alternates: { canonical: '/refund-policy' } }

export default function RefundPolicyPage() {
  return (
    <main className="legal-page">
      <div className="container legal-inner">
        <Link className="legal-back" href="/">← Back to Zurura Team Safaris</Link>
        <h1>Refund &amp; Cancellation Policy</h1>
       <p className="legal-updated">Last updated: 21 November 2026</p>
        <h2>Cancelling a confirmed booking</h2>
        <p>If you need to cancel a paid booking, email <a href="mailto:hello@zururasafaris.com">hello@zururasafaris.com</a> with your booking reference. Refunds are calculated from the date we receive your cancellation email, based on how far ahead of your arrival date you cancel:</p>
        <ul>
          <li><strong>30+ days before arrival:</strong> full refund, minus a 5% processing fee.</li>
          <li><strong>15–29 days before arrival:</strong> 50% refund.</li>
          <li><strong>Less than 15 days before arrival:</strong> no refund.</li>
        </ul>

        <h2>If we need to cancel</h2>
        <p>If we cancel your safari (for example, due to a genuine safety concern or an inability to secure the booked accommodation), you'll receive a full refund, or the option to rebook for different dates at no extra cost.</p>

        <h2>How refunds are paid</h2>
        <p>Refunds for M-Pesa payments are sent back to the M-Pesa number the original payment was made from, usually within 7–10 business days of approval.</p>

        <h2>Changes to your dates</h2>
        <p>Asking to move your travel dates (rather than cancelling) is treated as a date change, not a cancellation, and is free of charge if requested 14+ days before your original arrival date, subject to availability.</p>

        <h2>Questions</h2>
        <p>Contact us any time at <a href="mailto:hello@zururasafaris.com">hello@zururasafaris.com</a> <em>[replace with your real business email]</em> — we're happy to talk through your specific situation.</p>
      </div>
    </main>
  )
}
